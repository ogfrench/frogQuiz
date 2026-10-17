# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""A new question starts with two blank answers (#92), so blank answer text has to survive
a save and a read.

The save path used to turn "" into None, which the answer models (`answer: str`) then
refused on every read: the quiz page's loader answered 500 for any quiz holding a blank
answer. Rows already stored that way must load as well.
"""

import pytest
from fastapi.testclient import TestClient

from frogquiz.db.models import ABCDQuizAnswer, QuizQuestion, VotingQuizAnswer
from frogquiz.tests import test_client  # noqa: F401

# It creates a quiz, and test_server.py's TestStats asserts the exact global quiz count.
pytestmark = pytest.mark.order(-1)

QUIZ = {
    "public": False,
    "title": "Blank answers",
    "description": "#92",
    "questions": [
        {
            "question": "Written?",
            "time": "20",
            "type": "ABCD",
            "answers": [{"answer": "Yes", "right": True}, {"answer": "No", "right": False}],
        },
        {
            "question": "Not yet",
            "time": "20",
            "type": "CHECK",
            "answers": [{"answer": "", "right": False}, {"answer": "", "right": False}],
        },
    ],
}


def test_a_stored_null_answer_reads_as_blank():
    assert ABCDQuizAnswer(answer=None, right=False).answer == ""
    assert VotingQuizAnswer(answer=None).answer == ""
    question = QuizQuestion(
        question="Q", time="20", type="CHECK", answers=[{"answer": None, "right": False}]
    )
    assert question.answers[0].answer == ""


@pytest.mark.asyncio
async def test_blank_answers_save_and_read_back(test_client: TestClient):  # noqa: F811
    token = test_client.post("/api/v1/editor/start?edit=false").json()["token"]
    resp = test_client.post(f"/api/v1/editor/finish?edit_id={token}", json=QUIZ)
    assert resp.status_code == 200, resp.text
    quiz_id = resp.json()["id"]
    secret = resp.headers["X-Anon-Secret"]

    public = test_client.get(f"/api/v1/quiz/get/public/{quiz_id}")
    assert public.status_code == 200, public.text
    assert [a["answer"] for a in public.json()["questions"][1]["answers"]] == ["", ""]

    # Reopened and saved again as the editor sends it, the blanks are still blanks.
    token = test_client.post(
        f"/api/v1/editor/start?edit=true&quiz_id={quiz_id}", headers={"X-Anon-Secret": secret}
    ).json()["token"]
    resp = test_client.post(
        f"/api/v1/editor/finish?edit_id={token}", json=QUIZ, headers={"X-Anon-Secret": secret}
    )
    assert resp.status_code == 200, resp.text
    assert test_client.get(f"/api/v1/quiz/get/public/{quiz_id}").status_code == 200

    # A draft cannot be hosted, and says so rather than failing to read the quiz.
    start = test_client.post(
        f"/api/v1/quiz/start/{quiz_id}?game_mode=kahoot", headers={"X-Anon-Secret": secret}
    )
    assert start.status_code in (400, 409, 422), start.text
