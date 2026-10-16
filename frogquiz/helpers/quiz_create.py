# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""A quiz made from plain text, for the paths that do not go through the editor.

The Excel import and the agent API (routers/agent.py) both take questions as plain text
with a right/wrong flag per answer. They build and save the quiz here, so the two cannot
drift on escaping, on which question types they make, or on the cached quiz count.
"""

import html
from collections.abc import Iterable, Mapping
from datetime import datetime

from frogquiz.config import redis
from frogquiz.db.models import Quiz, QuizInput, QuizQuestion, QuizQuestionType

# The two question types the editor offers (docs/mvp-scope.md). Anything else a plain-text
# path is asked for is refused before it gets here.
PLAIN_QUESTION_TYPES = {
    "single": QuizQuestionType.ABCD,
    "multiple": QuizQuestionType.CHECK,
}


def _text(value: str) -> str:
    # The editor's fields are rich text, so markup in plain text would be rendered. Escaped,
    # "<b>" reads as itself, and the length rules still count what a person sees
    # (_visible_length unescapes).
    return html.escape(value, quote=False)


def build_plain_quiz(title: str, description: str, questions: Iterable[Mapping]) -> QuizInput:
    """A private QuizInput from plain text.

    Each question is a mapping with `question`, `time` (seconds), `type` ("single" or
    "multiple") and `answers`, a list of mappings with `text` and `right`. Constructing
    the QuizInput runs every rule a save from the editor meets, and raises pydantic's
    ValidationError when one fails.
    """
    return QuizInput(
        title=_text(title),
        description=_text(description),
        public=False,
        questions=[
            QuizQuestion(
                question=_text(q["question"]),
                time=str(q["time"]),
                type=PLAIN_QUESTION_TYPES["multiple" if q["type"] == "multiple" else "single"],
                answers=[{"answer": _text(a["text"]), "right": a["right"]} for a in q["answers"]],
            )
            for q in questions
        ],
    )


async def save_new_quiz(
    quiz_input: QuizInput,
    user_id=None,
    *,
    anon_secret_hash: str | None = None,
    expire_at: datetime | None = None,
) -> Quiz:
    """Save a new quiz and drop the cached quiz count.

    Not for a public quiz: this does not index into Meilisearch, which is why both callers
    make theirs private.
    """
    quiz = Quiz(
        **quiz_input.model_dump(),
        user_id=user_id,
        anon_secret=anon_secret_hash,
        expire_at=expire_at,
    )
    await quiz.save()
    await redis.delete("global_quiz_count")
    return quiz
