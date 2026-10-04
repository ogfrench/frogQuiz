# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0


import secrets
import uuid
from typing import Optional

import asyncpg.exceptions
import bleach
from fastapi import APIRouter, HTTPException, Depends, Header, Request, Response
from pydantic import BaseModel
import html

from frogquiz.config import (
    settings,
    redis,
    storage,
    meilisearch,
    ALLOWED_TAGS_FOR_QUIZ,
    arq,
)
from frogquiz.db.models import Quiz, QuizInput, User, QuizQuestionType, StorageItem
from frogquiz.auth import get_current_user_optional, hash_anon_secret, verify_anon_secret
from frogquiz.helpers.ratelimit import rate_limit, rate_limit_key
import os
from datetime import datetime, timedelta
from uuid import UUID

from frogquiz.helpers import (
    get_meili_data,
    check_image_string,
    extract_image_ids_from_quiz,
)
from frogquiz.storage.errors import DeletionFailedError

settings = settings()

router = APIRouter()

allowed_image_extensions = [".gif", ".jpg", ".jpeg", ".png", ".svg", ".webp", ".jfif"]

# How long a quiz created without an account is kept before it's swept up if
# no one claims it (see the arq cleanup job in frogquiz/worker/__init__.py).
ANON_QUIZ_EXPIRE_DAYS = 30


class InitEditorResponse(BaseModel):
    token: str


class EditSessionData(BaseModel):
    quiz_id: UUID
    edit: bool
    user_id: UUID | None


def _quiz_expired(quiz: Quiz) -> bool:
    return quiz.expire_at is not None and quiz.expire_at < datetime.now()


def _image_ids(quiz_input: QuizInput) -> set[str]:
    images = [quiz_input.cover_image, quiz_input.background_image, *(q.image for q in quiz_input.questions)]
    return {str(image) for image in images if image}


async def _refuse_other_accounts_images(quiz_input: QuizInput, old_quiz: Quiz | None, caller_id: UUID | None):
    """400 if the quiz names an upload that belongs to another account.

    Saving links a quiz to every image it names, and nothing checked whose they were, so
    one account could pin another's bytes to its own quiz (C3 in docs/crud-audit-2026-10.md).
    Images the quiz already had are left alone, so an older quiz still saves. Uploads made
    without an account have no owner to protect and stay usable.
    """
    already = set(extract_image_ids_from_quiz(old_quiz)) if old_quiz is not None else set()
    for image in _image_ids(quiz_input) - {str(i) for i in already}:
        valid, item_id = check_image_string(image)
        if not valid or item_id is None:
            continue
        item = await StorageItem.objects.get_or_none(id=item_id)
        if item is not None and item.user is not None and item.user.id != caller_id:
            raise HTTPException(status_code=400, detail="An image in this quiz belongs to another account")


@router.post("/start", response_model=InitEditorResponse)
async def init_editor(
    request: Request,
    edit: bool,
    quiz_id: Optional[UUID] = None,
    user: User | None = Depends(get_current_user_optional),
    x_anon_secret: str | None = Header(default=None, alias="X-Anon-Secret"),
):
    await rate_limit(request, "editor_start", limit=30, window_seconds=60)
    if not edit and quiz_id is not None:
        raise HTTPException(status_code=400, detail="You can't choose the id for your quiz")
    if edit and quiz_id is None:
        raise HTTPException(status_code=400, detail="Edit can't be true if quiz_id is None")
    if edit:
        if user is not None:
            quiz = await Quiz.objects.get_or_none(id=quiz_id, user_id=user.id)
        else:
            # Anonymous editors prove ownership with the secret minted at
            # creation instead of a JWT -- same 404 either way so a wrong
            # secret can't be told apart from a quiz that doesn't exist.
            quiz = await Quiz.objects.get_or_none(id=quiz_id, user_id=None)
            if quiz is not None and not verify_anon_secret(x_anon_secret, quiz.anon_secret):
                quiz = None
        if quiz is None or _quiz_expired(quiz):
            raise HTTPException(status_code=404, detail="Quiz not found")
    if quiz_id is None:
        quiz_id = uuid.uuid4()
    edit_id = os.urandom(4).hex()
    await redis.set(
        f"edit_session:{edit_id}",
        EditSessionData(quiz_id=quiz_id, edit=edit, user_id=user.id if user is not None else None).model_dump_json(),
        ex=3600,
    )
    return InitEditorResponse(token=edit_id)


async def _end_session(edit_id: str):
    await redis.delete(f"edit_session:{edit_id}")


@router.post("/finish")
async def finish_edit(
    request: Request,
    response: Response,
    edit_id: str,
    quiz_input: QuizInput,
    user: User | None = Depends(get_current_user_optional),
    x_anon_secret: str | None = Header(default=None, alias="X-Anon-Secret"),
):
    """Save and close the edit session."""
    await rate_limit(request, "editor_finish", limit=30, window_seconds=60)
    return await _persist(response, edit_id, quiz_input, user, x_anon_secret, keep_session=False)


@router.post("/save")
async def save_edit(
    request: Request,
    response: Response,
    edit_id: str,
    quiz_input: QuizInput,
    user: User | None = Depends(get_current_user_optional),
    x_anon_secret: str | None = Header(default=None, alias="X-Anon-Secret"),
    base: datetime | None = None,
):
    """Save and keep editing: the editor's autosave (MVP.md D14).

    Unfinished quizzes save; /quiz/start is what refuses them. The session stays open and
    its hour starts again, so an editor left open no longer loses its session mid-edit.
    The first save of a new quiz creates it, and the session then edits that quiz.
    """
    # Per edit session: an office shares one public address, and a per-address limit of
    # 60 a minute was reached by a handful of people editing at once (E9 in
    # docs/edge-cases-2026-10.md). The address limit stays, generous, against scripts.
    await rate_limit_key(f"editor_save_session:{edit_id}", limit=60, window_seconds=60)
    await rate_limit(request, "editor_save", limit=600, window_seconds=60)
    return await _persist(response, edit_id, quiz_input, user, x_anon_secret, keep_session=True, base=base)


async def _persist(
    response: Response,
    edit_id: str,
    quiz_input: QuizInput,
    user: User | None,
    x_anon_secret: str | None,
    *,
    keep_session: bool,
    base: datetime | None = None,
):
    session_data = await redis.get(f"edit_session:{edit_id}")
    if session_data is None:
        raise HTTPException(status_code=401, detail="Edit ID not found!")
    session_data = EditSessionData.model_validate_json(session_data)
    caller_id = user.id if user is not None else None
    # The edit id alone is not a credential: it is 32 bits and lives for an hour.
    # Without this check, knowing it was enough to write a quiz into its owner's account.
    if session_data.user_id != caller_id:
        raise HTTPException(status_code=403, detail="This edit session belongs to another user")
    is_anonymous = session_data.user_id is None
    if is_anonymous:
        # Anonymous quizzes are never public/searchable -- there's no
        # account behind them to hold accountable for indexed content.
        quiz_input.public = False
    quiz_input.title = bleach.clean(quiz_input.title, tags=ALLOWED_TAGS_FOR_QUIZ, strip=True)
    quiz_input.description = bleach.clean(quiz_input.description, tags=ALLOWED_TAGS_FOR_QUIZ, strip=True)
    if quiz_input.background_color is not None:
        quiz_input.background_color = bleach.clean(quiz_input.background_color, tags=[], strip=True)

    for i, question in enumerate(quiz_input.questions):
        # CHECK was missing here, so its answers were stored exactly as sent.
        if question.type in (QuizQuestionType.ABCD, QuizQuestionType.CHECK, QuizQuestionType.VOTING):
            for i2, answer in enumerate(question.answers):
                if answer.color is not None:
                    quiz_input.questions[i].answers[i2].color = bleach.clean(answer.color, tags=[], strip=True)
                if answer.answer == "":
                    quiz_input.questions[i].answers[i2].answer = None
                if answer.answer is not None:
                    quiz_input.questions[i].answers[i2].answer = html.unescape(
                        bleach.clean(answer.answer, tags=ALLOWED_TAGS_FOR_QUIZ, strip=True)
                    )

    images_to_delete = []
    old_quiz_data: Quiz = await Quiz.objects.get_or_none(id=session_data.quiz_id, user_id=session_data.user_id)
    if (
        session_data.edit
        and is_anonymous
        and (
            old_quiz_data is None
            or _quiz_expired(old_quiz_data)
            or not verify_anon_secret(x_anon_secret, old_quiz_data.anon_secret)
        )
    ):
        # Defense in depth: /start already checked the secret when the edit
        # session was created, but re-check here too since that session is
        # cached in Redis for up to an hour.
        raise HTTPException(status_code=404, detail="Quiz not found")

    for i, question in enumerate(quiz_input.questions):
        image = question.image
        quiz_input.questions[i].question = bleach.clean(
            quiz_input.questions[i].question, tags=ALLOWED_TAGS_FOR_QUIZ, strip=True
        )
        if image == "":
            question.image = None
        if image is not None and not check_image_string(image)[0]:
            raise HTTPException(status_code=400, detail="Image URL(s) aren't valid!")
        # ABCD is single-correct-answer by definition (CHECK is the multi-select type).
        # The editor now enforces this when marking an answer, but a crafted or legacy
        # payload could still carry more than one `right: true` -- keep the first and
        # unmark the rest rather than reject the whole save.
        if question.type == QuizQuestionType.ABCD:
            seen_correct = False
            for answer in question.answers:
                if answer.right and seen_correct:
                    answer.right = False
                elif answer.right:
                    seen_correct = True

    if quiz_input.cover_image == "":
        quiz_input.cover_image = None

    if quiz_input.cover_image is not None and not check_image_string(quiz_input.cover_image)[0]:
        raise HTTPException(status_code=400, detail="image url is not valid")

    if quiz_input.background_image is not None and not check_image_string(quiz_input.background_image)[0]:
        raise HTTPException(status_code=400, detail="image url is not valid")

    await _refuse_other_accounts_images(quiz_input, old_quiz_data, caller_id)

    if session_data.edit:
        if old_quiz_data is None:
            # The quiz was deleted while its editor was still open.
            raise HTTPException(status_code=404, detail="Quiz not found")
        # `base` is the version the editor last saw. Every save sends the whole quiz, so a
        # tab left open behind a newer save wrote its older copy over it (E8).
        if base is not None and old_quiz_data.updated_at != base:
            raise HTTPException(
                status_code=409,
                detail="this quiz was changed in another tab or device. Reload to get that version",
            )
        # arq pickles its arguments here, so updating this object below does not reach
        # the job: it still diffs the images against the quiz as it was.
        await arq.enqueue_job("quiz_update", old_quiz_data, old_quiz_data.id, _defer_by=2)
        quiz = old_quiz_data
        quiz.title = quiz_input.title
        quiz.public = quiz_input.public
        quiz.description = quiz_input.description
        quiz.updated_at = datetime.now()
        quiz.questions = quiz_input.model_dump()["questions"]
        quiz.cover_image = quiz_input.cover_image
        quiz.background_color = quiz_input.background_color
        quiz.background_image = quiz_input.background_image
        quiz.mod_rating = None
        for image in images_to_delete:
            if image is not None:
                try:
                    await storage.delete([image])
                except DeletionFailedError:
                    pass
        await quiz.update()
        if not is_anonymous:
            # get_meili_data looks up the owning user, which anonymous quizzes don't have --
            # and they're never indexed anyway. This used to run before the fields above
            # were assigned, so the index always held the previous save's title.
            if quiz.public:
                meilisearch.index(settings.meilisearch_index).add_documents([await get_meili_data(quiz)])
            else:
                meilisearch.index(settings.meilisearch_index).delete_document(str(quiz.id))
        if keep_session:
            await redis.expire(f"edit_session:{edit_id}", 3600)
        else:
            await _end_session(edit_id)
        return quiz
    else:
        raw_anon_secret = None
        anon_secret_hash = None
        expire_at = None
        if is_anonymous:
            raw_anon_secret = secrets.token_hex(32)
            anon_secret_hash = hash_anon_secret(raw_anon_secret)
            expire_at = datetime.now() + timedelta(days=ANON_QUIZ_EXPIRE_DAYS)
        quiz = Quiz(
            **quiz_input.model_dump(),
            user_id=session_data.user_id,
            id=session_data.quiz_id,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            anon_secret=anon_secret_hash,
            expire_at=expire_at,
        )

        await redis.delete("global_quiz_count")
        if quiz_input.public:
            meilisearch.index(settings.meilisearch_index).add_documents([await get_meili_data(quiz)])
        try:
            if not keep_session:
                await _end_session(edit_id)
            await quiz.save()
        except asyncpg.exceptions.UniqueViolationError:
            raise HTTPException(status_code=400, detail="The quiz already exists")
        if keep_session:
            # From here on this session edits the quiz it just created, so the next autosave
            # updates it instead of creating it a second time. Only once the row exists: done
            # before the save, a failed save left the session pointing at a missing quiz.
            now_editing = EditSessionData(quiz_id=session_data.quiz_id, edit=True, user_id=session_data.user_id)
            await redis.set(f"edit_session:{edit_id}", now_editing.model_dump_json(), ex=3600)
        for image in extract_image_ids_from_quiz(quiz):
            # Upstream's legacy `uuid--uuid` key has no row to link, and uuid.UUID() raised on it.
            item_id = check_image_string(image)[1]
            item = await StorageItem.objects.get_or_none(id=item_id) if item_id else None
            if item is not None:
                await quiz.storageitems.add(item)
        if raw_anon_secret is not None:
            # Issued exactly once, here -- the hash on the row is all that's
            # kept server-side, so this is the caller's only chance to see it.
            response.headers["X-Anon-Secret"] = raw_anon_secret
        # Without the images just linked: once the worker has hashed one, its `hash` is raw
        # bytes, which FastAPI's encoder cannot decode, and every first save of a quiz with
        # an image answered 500 after the quiz was already saved (C14).
        return quiz.model_dump(exclude={"storageitems"})
