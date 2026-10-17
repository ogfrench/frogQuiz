# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The draft rule: which saved quizzes /quiz/start refuses. No database needed.

It mirrors frontend/src/lib/editor/question_complete.ts; the cases are the same ones.
"""

import json
from pathlib import Path

import pytest

from frogquiz.db.models import QuizQuestionType
from frogquiz.helpers.completeness import question_is_complete, unfinished_questions

# The same cases as frontend/src/lib/editor/question_complete.test.ts: the editor and the
# server must agree on which quizzes are drafts, and they had drifted before.
CASES = json.loads(
    (Path(__file__).resolve().parents[2] / "frontend/src/lib/editor/completeness_cases.json").read_text()
)


def q(**over):
    return {
        "question": "<p>Which of these is an amphibian?</p>",
        "time": "20",
        "type": "ABCD",
        "answers": [{"answer": "Tree frog", "right": True}, {"answer": "Gecko", "right": False}],
        **over,
    }


def test_a_runnable_question_is_complete():
    assert question_is_complete(q())
    assert question_is_complete(q(type=QuizQuestionType.CHECK)), "an enum before it is stored"
    assert question_is_complete(q(type=None)), "old questions saved before type existed"


def test_an_emptied_rich_text_title_is_blank():
    assert not question_is_complete(q(question="<p></p>"))
    assert not question_is_complete(q(question="<p> &nbsp; </p>")), "a non-breaking space is blank too"


def test_answers_need_two_texts_and_a_right_one():
    assert not question_is_complete(q(answers=[{"answer": "Only", "right": True}]))
    assert not question_is_complete(q(answers=[{"answer": "A", "right": False}, {"answer": "B", "right": False}]))
    # The server stores a blank answer as None.
    assert not question_is_complete(q(answers=[{"answer": "A", "right": True}, {"answer": None, "right": False}]))
    assert not question_is_complete(q(answers=[{"answer": "A", "right": True}, {"answer": "  ", "right": False}]))


def test_unfinished_questions_are_numbered_from_one():
    assert unfinished_questions([q(), q(question=""), q(), q(answers=[])]) == [2, 4]
    assert unfinished_questions([q()]) == []


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_the_shared_draft_rule_cases(case):
    assert question_is_complete(case["question"]) is case["complete"]
