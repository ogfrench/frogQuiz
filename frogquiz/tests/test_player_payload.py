# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""What a phone is sent for a question carries no solution (security audit, 11 Oct).

A text question's answers are the ones it accepts, and they went to every player with
the question. A multiple-choice question has its `right` flags taken off; a text question
now has its answers taken off altogether, since the phone only shows a box to type in.
"""

import uuid

from frogquiz.db.models import PlayGame, QuizQuestion
from frogquiz.socket_server import question_for_players


def _game(*questions: QuizQuestion) -> PlayGame:
    return PlayGame(
        quiz_id=str(uuid.uuid4()),
        description="",
        user_id=None,
        title="Payload",
        questions=list(questions),
        game_id=uuid.uuid4(),
        game_pin="123456",
    )


def test_a_text_question_goes_out_without_the_answers_it_accepts():
    game = _game(
        QuizQuestion(
            question="Young frog?", time="20", type="TEXT", answers=[{"answer": "Tadpole", "case_sensitive": False}]
        )
    )
    sent = question_for_players(game, 0)
    assert sent["answers"] == []
    assert "Tadpole" not in str(sent)


def test_a_multiple_choice_question_still_shows_its_options_without_the_right_one():
    game = _game(
        QuizQuestion(
            question="Capital of Portugal?",
            time="20",
            type="ABCD",
            answers=[{"answer": "Lisbon", "right": True}, {"answer": "Porto", "right": False}],
        )
    )
    sent = question_for_players(game, 0)
    assert [a["answer"] for a in sent["answers"]] == ["Lisbon", "Porto"]
    assert all("right" not in a for a in sent["answers"])
