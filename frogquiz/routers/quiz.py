# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0


import json
import random
import re
import uuid
from datetime import datetime
from random import randint

import ormar.exceptions

from frogquiz.helpers import generate_spreadsheet, handle_import_from_excel
from fastapi import APIRouter, Depends, HTTPException, Header, Request, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError, BaseModel

from frogquiz.auth import get_current_user, get_current_user_optional, verify_anon_secret
from frogquiz.config import redis, settings, storage, meilisearch
from frogquiz.db.models import Quiz, User, PlayGame, GameInLobby, QuizQuestion, QuizQuestionType
from frogquiz.helpers.box_controller import generate_code
from frogquiz.helpers.ratelimit import rate_limit
from frogquiz.kahoot_importer.import_quiz import import_quiz
import urllib.parse


def _quiz_expired(quiz: Quiz) -> bool:
    return quiz.expire_at is not None and quiz.expire_at < datetime.now()

settings = settings()

router = APIRouter()


@router.get("/get/{quiz_id}")
async def get_quiz_from_id(quiz_id: str, user: User | None = Depends(get_current_user)):
    try:
        quiz_id = uuid.UUID(quiz_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="badly formed quiz id")
    if user is None:
        quiz = await Quiz.objects.get_or_none(id=quiz_id, public=True)
    else:
        quiz = await Quiz.objects.get_or_none(id=quiz_id, user_id=user.id)
    if quiz is None:
        public_quiz = await Quiz.objects.get_or_none(id=quiz_id, public=True)
        if public_quiz is None:
            return JSONResponse(status_code=404, content={"detail": "quiz not found"})
        else:
            return public_quiz
    else:
        return quiz


class PublicQuizResponseUser(BaseModel):
    username: str
    id: uuid.UUID


class PublicQuizResponse(Quiz.get_pydantic(exclude={"questions"})):
    user_id: PublicQuizResponseUser | None
    questions: list[QuizQuestion]
    likes: int
    dislikes: int
    views: int
    plays: int


@router.get("/get/public/{quiz_id}")
async def get_public_quiz(quiz_id: uuid.UUID):
    quiz = await Quiz.objects.select_related("user_id").get_or_none(id=quiz_id)
    if quiz is None or _quiz_expired(quiz):
        return JSONResponse(status_code=404, content={"detail": "quiz not found"})
    else:
        quiz.views += 1
        await quiz.update()
        return PublicQuizResponse(**quiz.model_dump())


@router.post("/start/{quiz_id}")
async def start_quiz(
    request: Request,
    quiz_id: str,
    game_mode: str,
    captcha_enabled: bool = True,
    custom_field: str | None = None,
    cqcs_enabled: bool = False,
    randomize_answers: bool = False,
    user: User | None = Depends(get_current_user_optional),
    x_anon_secret: str | None = Header(default=None, alias="X-Anon-Secret"),
):
    try:
        quiz_id = uuid.UUID(quiz_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="badly formed quiz id")
    if user is not None:
        quiz = await Quiz.objects.get_or_none(id=quiz_id, user_id=user.id)
        if quiz is None:
            quiz = await Quiz.objects.get_or_none(id=quiz_id, public=True)
    else:
        # No public-quiz fallback here: hosting without an account is only
        # allowed for a quiz that was itself created anonymously and whose
        # secret the caller holds, not for hosting someone else's quiz.
        await rate_limit(request, "quiz_start_anon", limit=20, window_seconds=60)
        quiz = await Quiz.objects.get_or_none(id=quiz_id, user_id=None)
        if quiz is not None and not verify_anon_secret(x_anon_secret, quiz.anon_secret):
            quiz = None
    if quiz is None or _quiz_expired(quiz):
        return JSONResponse(status_code=404, content={"detail": "quiz not found"})
    quiz.plays += 1
    await quiz.update()
    game_pin = randint(100000, 999999)
    if custom_field == "":
        custom_field = None
    game = await redis.get(f"game:{game_pin}")
    while game is not None:
        game_pin = randint(100000, 999999)
        game = await redis.get(f"game:{game_pin}")

    if randomize_answers:
        for question in quiz.questions:
            if question["type"] == QuizQuestionType.RANGE:
                continue
            if question["type"] == QuizQuestionType.SLIDE:
                continue
            random.shuffle(question["answers"])

    game = PlayGame(
        quiz_id=quiz_id,
        game_pin=str(game_pin),
        questions=quiz.questions,
        game_id=uuid.uuid4(),
        title=quiz.title,
        description=quiz.description,
        captcha_enabled=captcha_enabled,
        cover_image=quiz.cover_image,
        game_mode=game_mode,
        user_id=user.id if user is not None else None,
        background_color=quiz.background_color,
        custom_field=custom_field,
        background_image=quiz.background_image,
    )
    code = None
    if cqcs_enabled:
        code = generate_code(6)
        await redis.set(f"game:cqc:code:{code}", game_pin, ex=3600)
    await redis.set(f"game:{str(game.game_pin)}", game.model_dump_json(), ex=18000)

    if user is not None:
        await redis.set(f"game_pin:{user.id}:{quiz_id}", game_pin, ex=18000)
        await redis.set(
            f"game_in_lobby:{user.id.hex}",
            GameInLobby(game_id=game.game_id, game_pin=str(game_pin), quiz_title=quiz.title).model_dump_json(),
            ex=900,
        )
    return {**quiz.model_dump(exclude={"id"}), **game.model_dump(exclude={"questions"}), "cqc_code": code}


@router.post("/claim/{quiz_id}")
async def claim_quiz(
    request: Request,
    quiz_id: uuid.UUID,
    user: User = Depends(get_current_user),
    x_anon_secret: str = Header(..., alias="X-Anon-Secret"),
):
    """Attach a quiz created without an account to the caller's account.

    Requires being signed in -- claiming isn't itself something an anonymous
    caller can do. A wrong secret and a nonexistent/already-claimed/expired
    quiz all 404 identically, so this can't be used to probe which quiz IDs
    exist or which ones are still unclaimed.
    """
    await rate_limit(request, "quiz_claim", limit=20, window_seconds=60)
    quiz = await Quiz.objects.get_or_none(id=quiz_id, user_id=None)
    if quiz is None or _quiz_expired(quiz) or not verify_anon_secret(x_anon_secret, quiz.anon_secret):
        raise HTTPException(status_code=404, detail="quiz not found")
    quiz.user_id = user.id
    quiz.anon_secret = None
    quiz.expire_at = None
    await quiz.update()
    return quiz


class CheckIfCaptchaEnabledResponse(BaseModel):
    enabled: bool
    game_mode: str | None = None
    custom_field: str | None = None


@router.get("/play/check_captcha/{game_pin}", response_model=CheckIfCaptchaEnabledResponse)
async def check_if_captcha_enabled(game_pin: str):
    game = await redis.get(f"game:{game_pin}")
    if game is None:
        return JSONResponse(status_code=404, content={"detail": "game not found"})
    game = PlayGame.model_validate_json(game)
    if game.captcha_enabled:
        return CheckIfCaptchaEnabledResponse(enabled=True, game_mode=game.game_mode, custom_field=game.custom_field)
    else:
        return CheckIfCaptchaEnabledResponse(enabled=False, game_mode=game.game_mode, custom_field=game.custom_field)


@router.get("/join/{game_pin}", deprecated=True)
async def get_game_id(game_pin: str):
    redis_res = await redis.get(f"game:{game_pin}")
    if redis_res is None:
        raise HTTPException(status_code=404, detail="game not found")
    else:
        return json.loads(redis_res)["game_id"]


@router.get("/list")
async def get_quiz_list(user: User = Depends(get_current_user), page_size: int | None = 10, page: int | None = 1):
    try:
        return (
            await Quiz.objects.order_by(Quiz.updated_at.desc())
            .filter(user_id=user.id)
            .paginate(page, page_size=page_size)
            .all()
        )
    except ormar.exceptions.QueryDefinitionError:
        raise HTTPException(status_code=400, detail="Invalid page(size). page(size) have to be greater than 0.")


@router.post("/import/{quiz_id}")
async def import_quiz_route(quiz_id: str, user: User = Depends(get_current_user)):
    if user.storage_used > settings.free_storage_limit:
        raise HTTPException(status_code=409, detail="Storage limit reached")
    resp_data = await import_quiz(quiz_id, user)
    try:
        if type(resp_data) is int:
            raise HTTPException(status_code=resp_data, detail="kahoot")
        else:
            return resp_data
    except ValidationError:
        raise HTTPException(400, detail="unsupported")


@router.delete("/delete/{quiz_id}")
async def delete_quiz(quiz_id: str, user: User = Depends(get_current_user)):
    try:
        quiz_id = uuid.UUID(quiz_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="badly formed quiz id")
    quiz = await Quiz.objects.get_or_none(id=quiz_id, user_id=user.id)

    if quiz is None:
        return JSONResponse(status_code=404, content={"detail": "quiz not found"})
    pics_to_delete = []
    pic_name_regex = re.compile("^.*/(.{36}--.{36})$")
    for question in quiz.questions:
        try:
            if question["image"] is not None and not str(question["image"]).startswith("https://i.imgur.com/"):
                old_image_to_delete = pic_name_regex.match(question["image"])
                if old_image_to_delete is not None:
                    pics_to_delete.append(old_image_to_delete.group(1))
        except KeyError:
            pass
    if len(pics_to_delete) != 0:
        await storage.delete(pics_to_delete)
    meilisearch.index(settings.meilisearch_index).delete_document(str(quiz.id))
    return await quiz.delete()


@router.get("/export_data/{export_token}", response_class=StreamingResponse)
async def export_quiz_answers(export_token: str, game_pin: str):
    data = await redis.get(f"export_token:{export_token}")
    if data is None:
        raise HTTPException(status_code=404, detail="export token not found")
    data = json.loads(data)
    data2 = await redis.get(f"game:{game_pin}")
    game_data = PlayGame.model_validate_json(data2)
    quiz = await Quiz.objects.get_or_none(id=game_data.quiz_id)
    if quiz is None:
        raise HTTPException(status_code=404, detail="quiz not found")

    player_fields = await redis.hgetall(f"game:{game_pin}:players:custom_fields")
    score_data = await redis.hgetall(f"game_session:{game_pin}:player_scores")
    spreadsheet = await generate_spreadsheet(
        quiz=quiz, quiz_results=data, player_fields=player_fields, player_scores=score_data
    )

    def iter_file():
        yield from spreadsheet

    await redis.delete(f"export_token:{export_token}")
    return StreamingResponse(
        iter_file(),
        media_type="application/vnd.ms-excel",
        headers={
            "Content-Disposition": f"attachment;filename=frogQuiz-{urllib.parse.quote(quiz.title)}-{datetime.now().strftime('%m-%d-%Y')}.xlsx"  # noqa: E501
        },
    )


@router.post("/excel-import")
async def import_from_excel(file: UploadFile = File(), user: User = Depends(get_current_user)) -> Quiz:
    quiz = await handle_import_from_excel(file.file, user)
    return Quiz.model_validate(quiz.model_dump(exclude={"user_id": ...}))
