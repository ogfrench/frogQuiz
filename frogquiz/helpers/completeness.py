# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Whether a saved quiz can be played, or is still a draft (MVP.md D14).

The editor saves unfinished quizzes as they are typed, so "saved" no longer means
"playable". There is no draft column: a quiz is a draft exactly when one of its questions
is unfinished, worked out from the questions each time. A stored flag could disagree with
the questions it describes; this cannot.

The rule is the editor's own, `frontend/src/lib/editor/question_complete.ts`, and the two
must stay the same -- the editor marks questions with one and the server refuses to start
a game with the other. Both test suites read one list of cases,
`frontend/src/lib/editor/completeness_cases.json`.
"""

import html
from typing import Any

import bleach

# The same numbers as question_complete.ts.
MAX_ORDER_ITEMS = 6
MAX_POLL_OPTIONS = 10
MAX_TEXT_SPELLINGS = 10
MAX_SLIDER_SPAN = 10_000


def _visible_text(value: Any) -> str:
    # Question titles are rich-text HTML: an emptied editor hands back "<p></p>".
    if not isinstance(value, str):
        return ""
    return " ".join(html.unescape(bleach.clean(value, tags=[], strip=True)).split())


def _texts(answers: Any) -> list[str] | None:
    if not isinstance(answers, list):
        return None
    return [_visible_text(a.get("answer")) if isinstance(a, dict) else "" for a in answers]


def _distinct(texts: list[str]) -> bool:
    # Two options that differ only in case or spacing are the same option to a player.
    return len({t.lower() for t in texts}) == len(texts)


def _is_int(n: Any) -> bool:
    # 4.0 is 4 in JSON's eyes and in the editor's (Number.isInteger).
    if isinstance(n, float):
        return n.is_integer()
    return isinstance(n, int) and not isinstance(n, bool)


def question_is_complete(question: dict[str, Any]) -> bool:
    # A string from the database, or a QuizQuestionType before it has been stored.
    type_ = getattr(question.get("type"), "value", question.get("type")) or "ABCD"
    answers = question.get("answers")
    # An old drawn slide keeps its text in the drawing, and was made with an empty title.
    if type_ == "SLIDE" and isinstance(answers, str) and answers != "":
        return True
    if not _visible_text(question.get("question")):
        return False
    if type_ in ("ABCD", "CHECK"):
        texts = _texts(answers)
        return (
            texts is not None
            and len(texts) >= 2
            and all(texts)
            and any(isinstance(a, dict) and a.get("right") for a in answers)
        )
    if type_ == "VOTING":
        texts = _texts(answers)
        return texts is not None and 2 <= len(texts) <= MAX_POLL_OPTIONS and all(texts) and _distinct(texts)
    if type_ == "TEXT":
        texts = _texts(answers)
        return texts is not None and 1 <= len(texts) <= MAX_TEXT_SPELLINGS and all(texts)
    if type_ == "ORDER":
        texts = _texts(answers)
        return texts is not None and 2 <= len(texts) <= MAX_ORDER_ITEMS and all(texts) and _distinct(texts)
    if type_ == "RANGE":
        if not isinstance(answers, dict):
            return False
        lo, hi = answers.get("min"), answers.get("max")
        right_lo, right_hi = answers.get("min_correct"), answers.get("max_correct")
        if not all(_is_int(n) for n in (lo, hi, right_lo, right_hi)):
            return False
        return lo < hi and hi - lo <= MAX_SLIDER_SPAN and lo <= right_lo <= right_hi <= hi
    if type_ == "SLIDE":
        return True
    return False


def unfinished_questions(questions: list[dict[str, Any]]) -> list[int]:
    """1-based numbers of the questions that stop this quiz from being played."""
    return [n for n, q in enumerate(questions, start=1) if not question_is_complete(q)]
