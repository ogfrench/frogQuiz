# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""What a saved quiz may hold for the question types coming back in #93. No database.

These are ceilings against abuse, not the draft rule: a half-typed slider or an empty
slide still saves (as a draft), and only what no editor would ever send is refused.
"""

import pytest
from pydantic import ValidationError

from frogquiz.db.models import QuizInput, QuizQuestion


def quiz(**question):
    q = {"question": "Q", "time": "20", **question}
    return QuizInput(title="Quiz", description="", questions=[q])


def test_a_plain_slide_keeps_its_text():
    saved = quiz(type="SLIDE", answers="", body="Eight questions, 20 seconds each.")
    assert saved.questions[0].body == "Eight questions, 20 seconds each."
    assert QuizQuestion(question="Q", time="20", type="ABCD", answers=[{"answer": "A", "right": True}]).body is None


def test_a_slide_body_is_bounded():
    quiz(type="SLIDE", answers="", body="x" * 500)
    with pytest.raises(ValidationError):
        quiz(type="SLIDE", answers="", body="x" * 501)


def test_an_old_drawing_is_bounded():
    quiz(type="SLIDE", answers="{" + "x" * 1000 + "}")
    with pytest.raises(ValidationError):
        quiz(type="SLIDE", answers="x" * 200_001)


def test_a_slider_saves_half_typed_but_not_absurd():
    # A draft: max below min while typing, and a span the draft rule refuses.
    quiz(type="RANGE", answers={"min": 10, "max": 5, "min_correct": 0, "max_correct": 0})
    quiz(type="RANGE", answers={"min": 0, "max": 100_000, "min_correct": 1, "max_correct": 2})
    with pytest.raises(ValidationError):
        quiz(type="RANGE", answers={"min": 0, "max": 10**30, "min_correct": 1, "max_correct": 2})
    with pytest.raises(ValidationError):
        quiz(type="RANGE", answers={"min": -(10**12), "max": 0, "min_correct": -1, "max_correct": 0})
