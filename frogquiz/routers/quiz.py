# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0


import io
import json
import random
import secrets
import uuid
from datetime import datetime, timedelta
from random import randint

import ormar.exceptions

from frogquiz.db import database
from frogquiz.helpers import (
    adjust_storage_used,
    check_image_string,
    extract_image_ids_from_quiz,
    generate_spreadsheet,
    release_quiz_images,
)
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request, Response, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError, BaseModel

from frogquiz.auth import (
    get_current_user,
    get_current_user_optional,
    hash_anon_secret,
    require_anonymous_quizzes,
    verify_anon_secret,
)
from frogquiz.config import arq, redis, settings, meilisearch, storage
from frogquiz.db.models import Quiz, User, PlayGame, GameInLobby, QuizQuestion, QuizQuestionType, StorageItem
from frogquiz.examples import examples_owner
from frogquiz.helpers.anonymous_quiz import ANON_QUIZ_EXPIRE_DAYS, enforce_anonymous_quiz_ceilings
from frogquiz.helpers.excel_workbook import MAX_FILE_BYTES, MIME_TYPE, excel_template, parse_excel
from frogquiz.helpers.quiz_create import build_plain_quiz, save_new_quiz
from frogquiz.db.models import (
    MAX_TITLE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
    MAX_QUESTION_LENGTH,
    MAX_ANSWER_LENGTH,
)
from starlette.concurrency import run_in_threadpool
from frogquiz.helpers.box_controller import generate_code
from frogquiz.helpers.completeness import unfinished_questions
from frogquiz.helpers.live_images import hold_images, is_live, mark_live
from frogquiz.helpers.ratelimit import rate_limit, rate_limit_key
from frogquiz.kahoot_importer.import_quiz import import_quiz
import urllib.parse


def _quiz_expired(quiz: Quiz) -> bool:
    return quiz.expire_at is not None and quiz.expire_at < datetime.now()


_COUNTERS = {
    "views": "UPDATE quiz SET views = views + 1 WHERE id = :id",
    "plays": "UPDATE quiz SET plays = plays + 1 WHERE id = :id",
}


async def _count(quiz: Quiz, column: str) -> None:
    """Add one to `views` or `plays`, in one statement that touches nothing else.

    Both used to add one to the copy loaded at the start of the request and write the
    whole row back. A save that landed in between was reverted, `updated_at` included,
    and the editor's next save then got a 409 it had not earned (#35 row 7). The view
    runs on every visit to a quiz page, so it took only a viewer, not a second editor.
    Two at once also lost a count.
    """
    await database.execute(_COUNTERS[column], {"id": quiz.id.hex})
    setattr(quiz, column, getattr(quiz, column) + 1)


async def _find_own_quiz(quiz_id: uuid.UUID, user: User | None, anon_secret: str | None) -> Quiz | None:
    """The quiz if the caller owns it, by account or by anonymous secret.

    The two are checked independently rather than as either/or. Someone who makes
    a quiz without an account and then signs in, without claiming it first, still
    holds its secret, and used to find their own quiz 404ing on start and delete.
    """
    if user is not None:
        quiz = await Quiz.objects.get_or_none(id=quiz_id, user_id=user.id)
        if quiz is not None:
            return quiz
    if anon_secret is None:
        return None
    quiz = await Quiz.objects.get_or_none(id=quiz_id, user_id=None)
    if quiz is None or _quiz_expired(quiz) or not verify_anon_secret(anon_secret, quiz.anon_secret):
        return None
    return quiz


settings = settings()

router = APIRouter()


def _captcha_configured() -> bool:
    """Whether a captcha provider is actually set up. See start_quiz."""
    if settings.hcaptcha_key is None and settings.recaptcha_key is None:
        return False
    return True


# A slider's answers are not a list, a slide's are not answers, and a Put in order
# question's stored order is its answer key: shuffling it made "Randomize answers" score a
# random order as right (#93).
_KEEP_ORDER = {QuizQuestionType.RANGE, QuizQuestionType.SLIDE, QuizQuestionType.ORDER}


def shuffle_answers(questions: list[dict]) -> None:
    """The host's "Randomize answers": shuffle each question's options in place."""
    for question in questions:
        if question.get("type") in _KEEP_ORDER or not isinstance(question.get("answers"), list):
            continue
        random.shuffle(question["answers"])


@router.get("/get/{quiz_id}")
async def get_quiz_from_id(
    quiz_id: str,
    user: User | None = Depends(get_current_user_optional),
    x_anon_secret: str | None = Header(default=None, alias="X-Anon-Secret"),
):
    try:
        quiz_id = uuid.UUID(quiz_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="badly formed quiz id")
    if user is None and x_anon_secret is None:
        # Kept as it was: signed out and without a secret, this route has only
        # ever served public quizzes, and a caller with neither got a 401.
        raise HTTPException(status_code=401, detail="Not authenticated")
    quiz = await _find_own_quiz(quiz_id, user, x_anon_secret)
    if quiz is not None:
        # The secret is a credential, not quiz content; the editor has it already.
        return quiz.model_dump(exclude={"anon_secret"})
    public_quiz = await Quiz.objects.get_or_none(id=quiz_id, public=True)
    if public_quiz is None:
        return JSONResponse(status_code=404, content={"detail": "quiz not found"})
    return public_quiz


class PublicQuizResponseUser(BaseModel):
    username: str
    id: uuid.UUID


# `anon_secret` is excluded deliberately: the response is unauthenticated, and
# although the stored value is a SHA-256 of 256 random bits and so not
# reversible, it is an ownership credential and has no business being served.
class PublicQuizResponse(Quiz.get_pydantic(exclude={"questions", "anon_secret"})):
    user_id: PublicQuizResponseUser | None
    questions: list[QuizQuestion]
    likes: int
    dislikes: int
    views: int
    plays: int
    is_example: bool = False


@router.get("/get/public/{quiz_id}")
async def get_public_quiz(quiz_id: uuid.UUID):
    quiz = await Quiz.objects.select_related("user_id").get_or_none(id=quiz_id)
    if quiz is None or _quiz_expired(quiz):
        return JSONResponse(status_code=404, content={"detail": "quiz not found"})
    else:
        await _count(quiz, "views")
        owner = await examples_owner()
        is_example = owner is not None and quiz.user_id is not None and quiz.user_id.id == owner.id
        return PublicQuizResponse(**quiz.model_dump(), is_example=is_example)


@router.post("/start/{quiz_id}")
async def start_quiz(
    request: Request,
    quiz_id: str,
    game_mode: str,
    # Defaulted to True, which only looked harmless because the one caller
    # (lib/dashboard/start_game.svelte) sends 'False' explicitly. Any other caller got a
    # game with a captcha nobody can solve -- the join page needs a sitekey to render a
    # widget -- and which check_captcha then passed for everyone, because with no secret
    # configured it fell through to return True. Off unless asked for.
    captcha_enabled: bool = False,
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
    if user is None:
        require_anonymous_quizzes()
        await rate_limit(request, "quiz_start_anon", limit=20, window_seconds=60)
    quiz = await _find_own_quiz(quiz_id, user, x_anon_secret)
    if quiz is None:
        # Any public quiz, with or without an account: hosting needs none (D43).
        quiz = await Quiz.objects.get_or_none(id=quiz_id, public=True)
    if quiz is None or _quiz_expired(quiz):
        return JSONResponse(status_code=404, content={"detail": "quiz not found"})
    if not quiz.questions:
        # An empty quiz used to open a live game with nothing in it.
        return JSONResponse(status_code=400, content={"detail": "quiz has no questions"})
    unfinished = unfinished_questions(quiz.questions)
    if unfinished:
        # The editor autosaves, so a quiz can be saved half-written (MVP.md D14). Starting
        # one would put a question with no right answer, or no answers, on the projector.
        numbers = ", ".join(str(n) for n in unfinished)
        return JSONResponse(
            status_code=400,
            content={"detail": f"This quiz is a draft. Finish question {numbers} in the editor first."},
        )
    await _count(quiz, "plays")
    game_pin = randint(100000, 999999)
    if custom_field == "":
        custom_field = None
    game = await redis.get(f"game:{game_pin}")
    while game is not None:
        game_pin = randint(100000, 999999)
        game = await redis.get(f"game:{game_pin}")

    if randomize_answers:
        shuffle_answers(quiz.questions)

    game = PlayGame(
        quiz_id=quiz_id,
        game_pin=str(game_pin),
        questions=quiz.questions,
        game_id=uuid.uuid4(),
        title=quiz.title,
        description=quiz.description,
        # A captcha with no secret cannot verify anything, so asking for one here is a
        # misconfiguration rather than a preference. Refusing to store it is what keeps
        # check_captcha's fail-closed branch unreachable: there is no way to open a game
        # that demands a captcha the server could never check.
        captcha_enabled=captcha_enabled and _captcha_configured(),
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
    # While this game runs, its quiz's images are held rather than released (#35).
    await mark_live(quiz.id, game.game_pin)

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
    quiz all 404 for non-owners, so this cannot be used to probe which quiz IDs
    exist or which ones are still unclaimed.
    """
    # Per account: an office shares one address, as editor saves did (E9).
    await rate_limit_key(f"quiz_claim_user:{user.id.hex}", limit=20, window_seconds=60)
    await rate_limit(request, "quiz_claim", limit=120, window_seconds=60)
    # A committed claim may lose its HTTP response. The account's own authority
    # makes that retry safe; the spent guest secret grants no access to anyone else.
    owned = await Quiz.objects.get_or_none(id=quiz_id, user_id=user.id)
    if owned is not None:
        return owned
    quiz = await Quiz.objects.get_or_none(id=quiz_id, user_id=None)
    if quiz is None or _quiz_expired(quiz) or not verify_anon_secret(x_anon_secret, quiz.anon_secret):
        raise HTTPException(status_code=404, detail="quiz not found")
    # One conditional write, taken only while the quiz is still unclaimed, unexpired and
    # holds the secret just checked. Two claims at once both passed the read above, and the
    # second wrote over the first: the quiz went to whoever came last, and its images were
    # counted twice (#43). The expiry sweep deletes on the opposite condition, so a claim and
    # the sweep never both win. Only these three columns, so a save in between stays (#35).
    # Ownership, images and quota move together. A failure must leave the guest
    # secret usable so the caller can retry the entire claim.
    async with database.transaction():
        won = await database.fetch_one(
            "UPDATE quiz SET user_id = :user, anon_secret = NULL, expire_at = NULL"
            " WHERE id = :id AND user_id IS NULL AND anon_secret = :secret"
            " AND (expire_at IS NULL OR expire_at >= :now) RETURNING id",
            {"user": user.id.hex, "id": quiz.id.hex, "secret": quiz.anon_secret, "now": datetime.now()},
        )
        if won is None:
            # Another request from this same account may have won while we waited.
            owned = await Quiz.objects.get_or_none(id=quiz_id, user_id=user.id)
            if owned is not None:
                return owned
            raise HTTPException(status_code=404, detail="quiz not found")
        # The conditional update locks this row. Read the current questions/images,
        # including an edit that finished after the initial ownership check.
        quiz = await Quiz.objects.get(id=quiz_id)
        # The images it was made with come along (C7 in docs/crud-audit-2026-10.md): left
        # ownerless, they counted against nobody's quota and outlived the account. Only the
        # ones already hashed are counted here; calculate_hash counts the rest when it runs,
        # now that they have an owner, so nothing is counted twice.
        #
        # One statement per image, because calculate_hash may be writing the same row. Read,
        # changed and saved whole, the job's stale copy put the owner back to nobody, and
        # neither side counted the bytes (E12 in docs/edge-cases-2026-10.md). Postgres runs the
        # two updates one after the other, so whichever comes second sees the other's write:
        # exactly one of them counts the image.
        counted = 0
        for image in extract_image_ids_from_quiz(quiz):
            item_id = check_image_string(str(image))[1]
            if item_id is None:
                continue
            row = await database.fetch_one(
                'UPDATE storage_items SET "user" = :user WHERE id = :id AND "user" IS NULL'
                " AND deleted_at IS NULL RETURNING hash, size",
                {"user": user.id.hex, "id": item_id.hex},
            )
            if row is not None and row["hash"] is not None:
                counted += row["size"]
        await adjust_storage_used(user.id, counted)
    return quiz


class ExampleQuiz(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    questions: int


class ExamplesResponse(BaseModel):
    # Explore lists these apart, and leaves this account's quizzes out of Newest.
    username: str | None
    quizzes: list[ExampleQuiz]


@router.get("/examples", response_model=ExamplesResponse)
async def list_examples():
    """The ready-made quizzes Explore shows above Newest (#39)."""
    owner = await examples_owner()
    if owner is None:
        return ExamplesResponse(username=None, quizzes=[])
    quizzes = await Quiz.objects.filter(user_id=owner.id, public=True).order_by(Quiz.title.asc()).all()
    return ExamplesResponse(
        username=owner.username,
        quizzes=[
            ExampleQuiz(id=q.id, title=q.title, description=q.description, questions=len(q.questions)) for q in quizzes
        ],
    )


async def _copy_image(image: str, user: User | None) -> StorageItem | None:
    """A new upload owned by `user` with the same bytes, or None when there is nothing to copy."""
    item_id = check_image_string(str(image))[1]
    # ponytail: upstream's old `uuid--uuid` keys are dropped from a copy rather than copied.
    # Production was wiped clean before the sign-in change, so none exist there.
    source = await StorageItem.objects.get_or_none(id=item_id, deleted_at=None) if item_id else None
    if source is None:
        return None
    data = io.BytesIO()
    async for chunk in storage.download(source.storage_path or source.id.hex):
        if chunk is None:
            return None
        data.write(chunk)
    data.seek(0)
    copy = StorageItem(
        id=uuid.uuid4(),
        uploaded_at=datetime.now(),
        mime_type=source.mime_type,
        hash=None,
        user=user,
        size=0,
        alt_text=source.alt_text,
        filename=source.filename,
    )
    await storage.upload(file_name=copy.id.hex, file_data=data, mime_type=source.mime_type)
    await copy.save()
    # Measures the file and charges it to the copier, as for any upload.
    await arq.enqueue_job("calculate_hash", copy.id.hex)
    return copy


@router.post("/copy/{quiz_id}")
async def copy_quiz(
    request: Request,
    response: Response,
    quiz_id: uuid.UUID,
    user: User | None = Depends(get_current_user_optional),
):
    """Copy a quiz into the caller's account (#39, D33).

    Your own quiz, or any public one, which includes the examples. An unlisted quiz of
    someone else's is a 404, the same answer as no quiz at all. The copy is unlisted.
    Its images are copied rather than shared: a shared file counted against the first
    owner's quota and vanished from the copy when that owner deleted their account.
    """
    await rate_limit(request, "quiz_copy", limit=20, window_seconds=60)
    if user is None:
        require_anonymous_quizzes()
        owner = await examples_owner()
        source = (
            await Quiz.objects.get_or_none(id=quiz_id, user_id=owner.id, public=True) if owner is not None else None
        )
    else:
        source = await Quiz.objects.get_or_none(id=quiz_id, user_id=user.id) or await Quiz.objects.get_or_none(
            id=quiz_id, public=True
        )
    if source is None or _quiz_expired(source):
        raise HTTPException(status_code=404, detail="quiz not found")
    if user is None:
        await enforce_anonymous_quiz_ceilings(request)
        raw_anon_secret = secrets.token_hex(32)
        anon_secret_hash = hash_anon_secret(raw_anon_secret)
        expire_at = datetime.now() + timedelta(days=ANON_QUIZ_EXPIRE_DAYS)
    else:
        raw_anon_secret = None
        anon_secret_hash = None
        expire_at = None
        image_ids = {check_image_string(str(i))[1] for i in extract_image_ids_from_quiz(source)} - {None}
        sizes = await StorageItem.objects.filter(id__in=list(image_ids), deleted_at=None).all() if image_ids else []
        if user.storage_used + sum(i.size for i in sizes) > settings.free_storage_limit:
            raise HTTPException(status_code=409, detail="Storage limit reached")

    copies: dict[str, StorageItem | None] = {}

    async def copied(image: str | None) -> str | None:
        if image is None:
            return None
        if image not in copies:
            copies[image] = await _copy_image(image, user)
        # The dashed form, as the upload route returns it: the orphan sweep and quiz_update
        # compare strings, and a hex id read as an image no quiz uses.
        return str(copies[image].id) if copies[image] else None

    questions = []
    for question in source.questions:
        question = dict(question)
        question["image"] = await copied(question.get("image"))
        questions.append(question)
    now = datetime.now()
    suffix = " (copy)"
    quiz = Quiz(
        id=uuid.uuid4(),
        public=False,
        title=source.title + suffix if len(source.title) + len(suffix) <= 100 else source.title,
        description=source.description,
        created_at=now,
        updated_at=now,
        user_id=user.id if user is not None else None,
        anon_secret=anon_secret_hash,
        expire_at=expire_at,
        questions=questions,
        cover_image=await copied(source.cover_image),
        background_color=source.background_color,
        background_image=await copied(source.background_image),
    )
    await quiz.save()
    for item in {c.id: c for c in copies.values() if c}.values():
        await quiz.storageitems.add(item)
    await redis.delete("global_quiz_count")
    if raw_anon_secret is not None:
        response.headers["X-Anon-Secret"] = raw_anon_secret
    return {"id": quiz.id}


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
    # This used to hand the game_id -- the host's credential -- to anyone who knew
    # the PIN, which is to say every player in the room; with it they could take the
    # host seat or drive the game from register_as_remote. Nothing in the frontend
    # calls it. The route stays, answering 410, so an old client gets a clear answer
    # rather than a 404 that looks like a typo'd PIN.
    raise HTTPException(status_code=410, detail="this endpoint has been retired")


@router.get("/list")
async def get_quiz_list(
    user: User = Depends(get_current_user),
    # 100 is what My Quizzes and the delete-account dialog ask for; it had no ceiling (C12).
    page_size: int = Query(10, ge=1, le=100),
    page: int = Query(1, ge=1),
):
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
async def delete_quiz(
    request: Request,
    quiz_id: str,
    user: User | None = Depends(get_current_user_optional),
    x_anon_secret: str | None = Header(default=None, alias="X-Anon-Secret"),
):
    """Delete a quiz, as its signed-in owner or as the anonymous creator.

    Without the anonymous path a quiz made at /create?anon=true could be edited
    and hosted by whoever holds its secret but never deleted by them, so the only
    way out of a mistake was to wait for the 30-day sweep.

    A wrong secret and a nonexistent quiz both 404, matching /claim, so this
    can't be used to probe which quiz IDs exist.
    """
    try:
        quiz_id = uuid.UUID(quiz_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="badly formed quiz id")
    if user is None:
        await rate_limit(request, "quiz_delete_anon", limit=20, window_seconds=60)
    quiz = await _find_own_quiz(quiz_id, user, x_anon_secret)

    if quiz is None:
        return JSONResponse(status_code=404, content={"detail": "quiz not found"})
    # Captured before the delete, released after: while the quiz row exists every one of
    # its images still counts as referenced, and the reference count is the whole point.
    image_ids = extract_image_ids_from_quiz(quiz)
    live = await is_live(quiz.id)
    meilisearch.index(settings.meilisearch_index).delete_document(str(quiz.id))
    deleted = await quiz.delete()
    if live:
        # A game of it is still showing these; its end releases them (#35 row 10).
        await hold_images(quiz.id, image_ids)
    else:
        await release_quiz_images(image_ids)
    return deleted


@router.get("/export_data/{export_token}", response_class=StreamingResponse)
async def export_quiz_answers(export_token: str, game_pin: str):
    data = await redis.get(f"export_token:{export_token}")
    if data is None:
        raise HTTPException(status_code=404, detail="export token not found")
    data = json.loads(data)
    # The token is minted for one game (socket_server get_export_token). The PIN used to
    # come only from the query string, so a host could read another game's players,
    # scores and custom fields, and an unknown PIN was a 500 (C4).
    data2 = await redis.get(f"game:{game_pin}")
    if data.get("game_pin") != game_pin or data2 is None:
        raise HTTPException(status_code=404, detail="export token not found")
    data = data["results"]
    game_data = PlayGame.model_validate_json(data2)
    quiz = await Quiz.objects.get_or_none(id=game_data.quiz_id)
    if quiz is None:
        raise HTTPException(status_code=404, detail="quiz not found")

    player_fields = await redis.hgetall(f"game:{game_pin}:players:custom_fields")
    score_data = await redis.hgetall(f"game_session:{game_pin}:player_scores")
    spreadsheet = await generate_spreadsheet(
        quiz=quiz,
        quiz_results=data,
        player_fields=player_fields,
        player_scores=score_data,
        custom_field=game_data.custom_field,
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


@router.get("/excel-template")
async def download_excel_template():
    return Response(
        content=await run_in_threadpool(excel_template),
        media_type=MIME_TYPE,
        headers={"Content-Disposition": 'attachment; filename="frogQuiz-template.xlsx"'},
    )


@router.post("/excel-import")
@router.post("/excel-preview")
async def import_from_excel(
    request: Request,
    response: Response,
    file: UploadFile = File(),
    dry_run: bool = False,
    require_account: bool = False,
    user: User | None = Depends(get_current_user_optional),
):
    # A UI expecting an account must not silently save as a guest after token expiry.
    if user is None:
        if require_account:
            raise HTTPException(status_code=401, detail="Sign in again to save to your account")
        require_anonymous_quizzes()
    await rate_limit(request, "excel_import", limit=30, window_seconds=60)
    try:
        data = await file.read(MAX_FILE_BYTES + 1)
    finally:
        await file.close()
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="The file must be at most 2 MB")
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Use an .xlsx workbook")
    preview = await run_in_threadpool(
        parse_excel,
        data,
        title_limit=MAX_TITLE_LENGTH,
        description_limit=MAX_DESCRIPTION_LENGTH,
        question_limit=MAX_QUESTION_LENGTH,
        answer_limit=MAX_ANSWER_LENGTH,
    )
    # A separate preview URL is safe against an older API that ignores `dry_run` and
    # immediately imports. Such a deployment returns 404 instead of silently saving.
    if dry_run or request.url.path.endswith("/excel-preview"):
        return preview
    if preview["errors"]:
        return JSONResponse(status_code=400, content=preview)
    # Cells are plain text; build_plain_quiz escapes markup before it enters the editor's
    # rich-text fields. The agent API makes its quizzes the same way.
    quiz_input = build_plain_quiz(preview["title"], preview["description"], preview["questions"])
    secret = None
    if user is None:
        # Preview never spends the creation quota or allocates an ownership secret.
        await enforce_anonymous_quiz_ceilings(request)
        secret = secrets.token_hex(32)
    quiz = await save_new_quiz(
        quiz_input,
        user.id if user else None,
        anon_secret_hash=hash_anon_secret(secret) if secret else None,
        expire_at=datetime.now() + timedelta(days=ANON_QUIZ_EXPIRE_DAYS) if secret else None,
    )
    if secret:
        response.headers["X-Anon-Secret"] = secret
    return {"id": str(quiz.id), "anonymous": secret is not None}
