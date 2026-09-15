# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
#
# SPDX-License-Identifier: MPL-2.0


import io
import json
import uuid
from datetime import datetime

import bleach
from aiohttp import ClientSession

from frogquiz.config import settings, storage, meilisearch, ALLOWED_TAGS_FOR_QUIZ, arq
from frogquiz.db.models import Quiz, ABCDQuizAnswer, QuizQuestion, QuizQuestionType, User, StorageItem
from frogquiz.kahoot_importer import _Question
from frogquiz.kahoot_importer.get import get as get_quiz
from frogquiz.helpers import get_meili_data

settings = settings()


async def _download_image(url: str) -> bytes:
    async with ClientSession() as session, session.get(url) as resp:
        return await resp.read()


async def handle_image_upload(url: str, user: User) -> StorageItem:
    image_bytes = await _download_image(url)
    file_obj = StorageItem(
        id=uuid.uuid4(),
        uploaded_at=datetime.now(),
        mime_type="application/octet-stream",
        hash=None,
        user=user,
        size=0,
        deleted_at=None,
        alt_text=None,
        imported=True,
    )
    await file_obj.save()
    await storage.upload(file_name=file_obj.id.hex, file_data=io.BytesIO(image_bytes))
    await arq.enqueue_job("calculate_hash", file_obj.id.hex)
    return file_obj


def map_question(q: _Question, image: str | None) -> dict | None:
    """Map one Kahoot question onto a frogQuiz question, or None if it is not importable."""
    answers = [
        ABCDQuizAnswer(
            right=a.correct,
            answer=bleach.clean(a.answer, tags=[], strip=True),
            # No colour. This used to stamp a fixed four-colour palette onto every
            # imported answer, which both overrode the app's own answer palette and
            # raised IndexError on any question with more than four choices. Leaving it
            # None lets the play screen apply the shared palette by position, the same
            # as a quiz written in the editor.
            color=None,
        )
        for a in q.choices
    ]
    # A Kahoot deck mixes scored questions with surveys and polls, which have choices
    # but mark none of them correct. Imported as an ABCD question that is a round
    # nobody can score, so skip it. Keyed off the answers themselves rather than off
    # Kahoot's type string, which is undocumented and gains new values whenever they
    # ship a new question kind.
    if not any(a.right for a in answers):
        return None
    return QuizQuestion(
        question=bleach.clean(q.question, tags=ALLOWED_TAGS_FOR_QUIZ, strip=True),
        answers=answers,
        # Stated rather than left to the model default: the importer only ever produces
        # ABCD, which is what the MVP supports. See docs/mvp-scope.md.
        type=QuizQuestionType.ABCD,
        time=str(q.time / 1000),
        image=image,
    ).model_dump()


async def import_quiz(quiz_id: str, user: User) -> Quiz | int:
    """
    Imports a quiz from Kahoot.
    :param user: The user object
    :param quiz_id: The ID of the quiz to import.
    :return: True if the import was successful, False otherwise.
    """
    kahoot_quiz_id = quiz_id
    quiz = await get_quiz(kahoot_quiz_id)
    if type(quiz) is int:
        return quiz
    quiz_questions: list[dict] = []
    new_quiz_id = uuid.uuid4()
    meilisearch.delete_index(settings.meilisearch_index)
    meilisearch.create_index(settings.meilisearch_index)
    uploaded_images: list[StorageItem] = []

    for q in quiz.kahoot.questions:
        image = None
        if q.image is not None and q.image != "":
            image_obj = await handle_image_upload(q.image, user)
            uploaded_images.append(image_obj)
            image = image_obj.id.hex
        question = map_question(q, image)
        if question is not None:
            quiz_questions.append(question)

    if not quiz_questions:
        # Every question in the deck was a survey or a poll, so there is nothing to
        # import. 422 rather than 404: the Kahoot exists, it just has no scored
        # question in it.
        return 422
    cover = None
    if quiz.kahoot.cover != "" and quiz.kahoot.cover is not None:
        img_obj = await handle_image_upload(quiz.kahoot.cover, user)
        uploaded_images.append(img_obj)
        cover = img_obj.id.hex
    if quiz.kahoot.description is None or quiz.kahoot.description == "":
        quiz.kahoot.description = "Description Missing!"
    quiz_data = Quiz(
        id=new_quiz_id,
        public=False,
        title=bleach.clean(quiz.kahoot.title, tags=ALLOWED_TAGS_FOR_QUIZ, strip=True),
        description=bleach.clean(quiz.kahoot.description, tags=ALLOWED_TAGS_FOR_QUIZ, strip=True),
        created_at=datetime.now(),
        updated_at=datetime.now(),
        user_id=user.id,
        questions=json.dumps(quiz_questions),
        imported_from_kahoot=True,
        cover_image=cover,
        kahoot_id=uuid.UUID(kahoot_quiz_id),
    )
    meilisearch.index(settings.meilisearch_index).add_documents([await get_meili_data(quiz_data)])
    await quiz_data.save()
    for img in uploaded_images:
        await quiz_data.storageitems.add(img)
    return quiz_data
