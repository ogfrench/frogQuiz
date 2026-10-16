# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The agent API: what the MCP service in mcp-server/ calls for Claude or another agent.

Every rule lives here, not in the MCP service, which holds no secrets and only forwards
the caller's `Authorization` header. Mounted at /api/v1/agent when AGENT_API_ENABLED is
on. What an agent may do is deliberately less than what the editor may:

- read and list only its owner's quizzes. Another account's quiz, public or not, is a
  404: its text would reach the agent as input, which is a way to steer it;
- make an unlisted quiz of the two question types the editor offers, with no images. The
  owner looks it over and publishes it from the editor, so nothing an agent writes
  reaches Discover or the search index on its own;
- never edit or delete.

See docs/mcp.md.
"""

import html
import uuid
from datetime import datetime
from typing import Annotated, Literal

import bleach
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationError,
    model_validator,
)

from frogquiz.auth import get_agent_user
from frogquiz.config import settings
from frogquiz.db.models import (
    MAX_ANSWER_LENGTH,
    MAX_ANSWERS_PER_QUESTION,
    MAX_DESCRIPTION_LENGTH,
    MAX_QUESTION_LENGTH,
    MAX_QUESTION_SECONDS,
    MAX_TITLE_LENGTH,
    Quiz,
    QuizQuestionType,
    User,
)
from frogquiz.helpers.quiz_create import build_plain_quiz, save_new_quiz
from frogquiz.helpers.ratelimit import rate_limit_key

settings = settings()


async def require_agent_api() -> None:
    # Checked per request rather than by leaving the router unmounted, so the setting is a
    # plain switch and the suite can test both sides of it. Off, this is a 404 before any
    # key is looked at.
    if not settings.agent_api_enabled:
        raise HTTPException(status_code=404, detail="Not found")


router = APIRouter(dependencies=[Depends(require_agent_api)])

# The editor's own cap (yupSchemas.ts). The backend allows 1000, as a DoS ceiling for
# imports; an agent writing a live quiz has no reason to go past what a person can.
MAX_AGENT_QUESTIONS = 50
# Per account. Generous for a person asking for quizzes, tight for a loop gone wrong.
CALLS_PER_MINUTE = 120
CREATES_PER_HOUR = 30
CREATES_PER_DAY = 200


async def agent_user(user: User = Depends(get_agent_user)) -> User:
    await rate_limit_key(f"agent_calls:{user.id}", limit=CALLS_PER_MINUTE, window_seconds=60)
    return user


def _plain(value: str | None) -> str:
    """Rich text as the words a person sees, for an agent to read."""
    return html.unescape(bleach.clean(value or "", tags=[], strip=True)).strip()


def _links(quiz_id: uuid.UUID) -> dict:
    return {
        "edit_url": f"{settings.root_address}/edit?quiz_id={quiz_id}",
        "view_url": f"{settings.root_address}/view/{quiz_id}",
    }


_TYPE_NAMES = {QuizQuestionType.ABCD: "single", QuizQuestionType.CHECK: "multiple"}


def _question(q: dict) -> dict:
    kind = q.get("type") or QuizQuestionType.ABCD
    out = {
        "question": _plain(q.get("question")),
        "time": q.get("time"),
        # The editor's two types by the names create_quiz takes; an older quiz's other
        # types by their own, lower-cased, so the agent can tell them apart.
        "type": _TYPE_NAMES.get(QuizQuestionType(kind), str(QuizQuestionType(kind).value).lower()),
    }
    answers = q.get("answers")
    if isinstance(answers, list):
        out["answers"] = [
            {"text": _plain(a.get("answer")), **({"right": a["right"]} if "right" in a else {})}
            for a in answers
            if isinstance(a, dict)
        ]
    return out


class AgentMe(BaseModel):
    username: str


class AgentQuizSummary(BaseModel):
    id: uuid.UUID
    title: str
    questions: int
    public: bool
    updated_at: datetime
    edit_url: str
    view_url: str


class AgentQuizPage(BaseModel):
    quizzes: list[AgentQuizSummary]
    page: int
    has_more: bool


def _no_nul(value: str) -> str:
    # Postgres stores no NUL character: in the title it was a 500, in a question it was
    # kept in the JSON and handed to every later reader.
    if "\x00" in value:
        raise ValueError("text cannot contain a NUL character")
    return value


NoNul = AfterValidator(_no_nul)
PlainText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1), NoNul]


class AgentAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: Annotated[PlainText, StringConstraints(max_length=MAX_ANSWER_LENGTH)]
    right: bool


class AgentQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: Annotated[PlainText, StringConstraints(max_length=MAX_QUESTION_LENGTH)]
    # "single": one right answer (the editor's multiple choice). "multiple": select all
    # that apply, scored all or nothing (docs/mvp-scope.md).
    type: Literal["single", "multiple"] = "single"
    time: int = Field(default=20, ge=5, le=MAX_QUESTION_SECONDS)
    answers: list[AgentAnswer] = Field(min_length=2, max_length=MAX_ANSWERS_PER_QUESTION)

    @model_validator(mode="after")
    def right_answers_fit_the_type(self):
        right = sum(a.right for a in self.answers)
        if right == 0:
            raise ValueError("mark at least one answer right")
        # The editor's save keeps the first right answer of a single-answer question and
        # quietly unmarks the rest. An agent is told instead, so it can choose.
        if self.type == "single" and right > 1:
            raise ValueError('a "single" question has exactly one right answer; use "multiple" for more')
        return self


class AgentQuizIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Annotated[PlainText, StringConstraints(max_length=MAX_TITLE_LENGTH)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=MAX_DESCRIPTION_LENGTH), NoNul] = ""
    questions: list[AgentQuestion] = Field(min_length=1, max_length=MAX_AGENT_QUESTIONS)


class AgentQuizCreated(BaseModel):
    id: uuid.UUID
    title: str
    questions: int
    public: bool
    edit_url: str
    view_url: str


@router.get("/me", response_model=AgentMe)
async def whoami(user: User = Depends(get_agent_user)):
    """Whose key this is. The MCP service checks a key here before every request it answers,
    so it is not metered: counting it would bill each tool call twice, and a busy key would
    come back as an invalid one (401) rather than as the tool call's own 429."""
    return {"username": user.username}


@router.get("/quizzes", response_model=AgentQuizPage)
async def list_quizzes(
    user: User = Depends(agent_user),
    page: int = Query(1, ge=1, le=1000),
    page_size: int = Query(20, ge=1, le=100),
):
    """The caller's quizzes, most recently changed first. The same query as /quiz/list."""
    rows = (
        await Quiz.objects.order_by(Quiz.updated_at.desc())
        .filter(user_id=user.id)
        .offset((page - 1) * page_size)
        .limit(page_size + 1)
        .all()
    )
    return {
        "quizzes": [
            {
                "id": quiz.id,
                "title": _plain(quiz.title),
                "questions": len(quiz.questions or []),
                "public": bool(quiz.public),
                "updated_at": quiz.updated_at,
                **_links(quiz.id),
            }
            for quiz in rows[:page_size]
        ],
        "page": page,
        "has_more": len(rows) > page_size,
    }


@router.get("/quizzes/{quiz_id}")
async def get_quiz(quiz_id: uuid.UUID, user: User = Depends(agent_user)):
    """One of the caller's quizzes as plain text. Anybody else's is a 404, as is a quiz
    that does not exist, so this cannot be used to find out which ids do."""
    quiz = await Quiz.objects.get_or_none(id=quiz_id, user_id=user.id)
    if quiz is None:
        raise HTTPException(status_code=404, detail="No quiz of yours has that id")
    questions = [q.model_dump() if hasattr(q, "model_dump") else q for q in quiz.questions or []]
    return {
        "id": quiz.id,
        "title": _plain(quiz.title),
        "description": _plain(quiz.description),
        "public": bool(quiz.public),
        "updated_at": quiz.updated_at,
        "questions": [_question(q) for q in questions],
        **_links(quiz.id),
    }


@router.post("/quizzes", response_model=AgentQuizCreated, status_code=201)
async def create_quiz(data: AgentQuizIn, user: User = Depends(agent_user)):
    """A new unlisted quiz in the caller's account."""
    await rate_limit_key(f"agent_create_hour:{user.id}", limit=CREATES_PER_HOUR, window_seconds=3600)
    await rate_limit_key(f"agent_create_day:{user.id}", limit=CREATES_PER_DAY, window_seconds=86400)
    try:
        quiz_input = build_plain_quiz(data.title, data.description, [q.model_dump() for q in data.questions])
    except ValidationError as e:
        # The bounds above match the editor's, so this is a rule only QuizInput knows.
        raise HTTPException(status_code=422, detail=[err["msg"] for err in e.errors()])
    quiz = await save_new_quiz(quiz_input, user.id)
    return {
        "id": quiz.id,
        "title": data.title,
        "questions": len(data.questions),
        "public": False,
        **_links(quiz.id),
    }
