# SPDX-FileCopyrightText: 2025 Marlon W (Mawoka)
#
# SPDX-License-Identifier: MPL-2.0

import re

from pydantic import BaseModel, field_validator, ValidationInfo
from frogquiz.db.models import QuizQuestion, QuizQuestionType, VotingQuizAnswer

# The join form caps the nickname at 17 characters, but the socket server is
# reachable without it, so nothing server-side bounded what arrived. A nickname
# becomes a Redis key, a member of the player set and a line on the projector,
# so an unbounded one is a way to bloat Redis and break the host's layout for
# everyone in the room. The bound here is deliberately looser than the form's so
# it cannot reject anyone the UI would have let in.
MAX_USERNAME_LENGTH = 50
MAX_CUSTOM_FIELD_LENGTH = 200

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def _clean_display_text(value: str, *, max_length: int, field: str) -> str:
    """Trim a player-supplied string and reject what cannot be displayed.

    Control characters are stripped rather than escaped: they have no meaning in
    a nickname, and a newline in one wraps the projector's player list.
    """
    cleaned = _CONTROL_CHARS.sub("", value).strip()
    if not cleaned:
        raise ValueError(f"{field} must not be empty")
    if len(cleaned) > max_length:
        raise ValueError(f"{field} must be at most {max_length} characters")
    return cleaned


class JoinGameData(BaseModel):
    username: str
    game_pin: str
    captcha: str | None = None
    custom_field: str | None = None

    @field_validator("username")
    def clean_username(cls, v: str) -> str:
        return _clean_display_text(v, max_length=MAX_USERNAME_LENGTH, field="username")

    @field_validator("custom_field")
    def clean_custom_field(cls, v: str | None) -> str | None:
        # Unlike the nickname this one is optional, and an empty value is
        # meaningful -- the handler treats "" as "not supplied".
        if v is None or v.strip() == "":
            return v
        return _clean_display_text(v, max_length=MAX_CUSTOM_FIELD_LENGTH, field="custom_field")


class RejoinGameData(BaseModel):
    old_sid: str
    game_pin: str
    username: str

    @field_validator("username")
    def clean_username(cls, v: str) -> str:
        # Cleaned the same way as on join, or a rejoin would look up a key the
        # join path could never have written.
        return _clean_display_text(v, max_length=MAX_USERNAME_LENGTH, field="username")


class RegisterAsAdminData(BaseModel):
    game_pin: str
    game_id: str


class ABCDQuizAnswerWithoutSolution(BaseModel):
    answer: str
    color: str | None = None


class RangeQuizAnswerWithoutSolution(BaseModel):
    min: int
    max: int


class ReturnQuestion(QuizQuestion):
    answers: list[ABCDQuizAnswerWithoutSolution] | RangeQuizAnswerWithoutSolution | list[VotingQuizAnswer]
    type: QuizQuestionType = QuizQuestionType.ABCD

    @field_validator("answers")
    def answers_not_none_if_abcd_type(cls, v, info: ValidationInfo):
        if info.data["type"] == QuizQuestionType.ABCD and type(v[0]) is not ABCDQuizAnswerWithoutSolution:
            raise ValueError("Answers can't be none if type is ABCD")
        if info.data["type"] == QuizQuestionType.RANGE and type(v) is not RangeQuizAnswerWithoutSolution:
            raise ValueError("Answer must be from type RangeQuizAnswer if type is RANGE")
        # skipcq: PTC-W0047
        if info.data["type"] == QuizQuestionType.VOTING and type(v[0]) is not VotingQuizAnswer:
            pass
        return v


class SubmitAnswerDataOrderType(BaseModel):
    answer: str


class SubmitAnswerData(BaseModel):
    question_index: int
    answer: str | int
    complex_answer: list[SubmitAnswerDataOrderType] | None = None


class KickPlayerInput(BaseModel):
    username: str


class ConnectSessionIdEvent(BaseModel):
    session_id: str
