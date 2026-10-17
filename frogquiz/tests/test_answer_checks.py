# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""What a submitted answer must look like for each question type, and how it scores (#93).

No database: check_answer and answer_is_valid read only the game held in memory. A crafted
client used to crash submit_answer with "nan" on a slider, and a vote for an option that
does not exist broke the host's counts.
"""

import uuid

import pytest

from frogquiz.db.models import PlayGame, QuizQuestion
from frogquiz.socket_server.helpers import answer_is_valid, check_answer
from frogquiz.socket_server.models import SubmitAnswerData

QUESTIONS = {
    "ABCD": {"answers": [{"answer": "Lisbon", "right": True}, {"answer": "Porto", "right": False}]},
    "CHECK": {"answers": [{"answer": "Frog", "right": True}, {"answer": "Gecko", "right": False}]},
    "VOTING": {"answers": [{"answer": "Lisbon"}, {"answer": "Porto"}]},
    "TEXT": {"answers": [{"answer": "Lisbon", "case_sensitive": False}]},
    "RANGE": {"answers": {"min": 0, "max": 10, "min_correct": 4, "max_correct": 6}},
    "ORDER": {"answers": [{"answer": "Egg"}, {"answer": "Tadpole"}, {"answer": "Frog"}]},
    "SLIDE": {"answers": ""},
}


def game(type_: str) -> PlayGame:
    q = QuizQuestion(question="Q", time="20", type=type_, **QUESTIONS[type_])
    return PlayGame(
        quiz_id=uuid.uuid4(),
        description="",
        user_id=None,
        title="T",
        questions=[q],
        game_id=uuid.uuid4(),
        game_pin="123456",
        current_question=0,
        question_show=True,
    )


def submit(answer, order=None) -> SubmitAnswerData:
    data = {"question_index": 0, "answer": answer}
    if order is not None:
        data["complex_answer"] = [{"answer": a} for a in order]
    return SubmitAnswerData(**data)


def check(type_: str, answer, order=None):
    return check_answer(game(type_), submit(answer, order))


def valid(type_: str, answer, order=None) -> bool:
    return answer_is_valid(game(type_).questions[0], submit(answer, order))


# What scores today, kept as it is.


def test_multiple_choice_scores_the_right_option():
    assert check("ABCD", "Lisbon") == (True, "Lisbon")
    assert check("ABCD", "Porto") == (False, "Porto")


def test_a_poll_never_scores():
    assert check("VOTING", "Lisbon") == (False, "Lisbon")


def test_type_answer_ignores_case_unless_asked():
    assert check("TEXT", "lisbon")[0] is True
    assert check("TEXT", "Porto")[0] is False


def test_order_scores_only_the_exact_order():
    assert check("ORDER", "a", ["Egg", "Tadpole", "Frog"]) == (True, "Egg, Tadpole, Frog")
    assert check("ORDER", "a", ["Tadpole", "Egg", "Frog"])[0] is False


# The slider, which used to return None outside the range and raise on junk.


@pytest.mark.parametrize("answer, right", [("4", True), ("6", True), ("5", True), ("3", False), ("7", False)])
def test_a_slider_is_right_inside_the_range_and_wrong_outside(answer, right):
    assert check("RANGE", answer) == (right, answer)


@pytest.mark.parametrize("answer", ["nan", "inf", "-inf", "abc", "", "1e400"])
def test_a_slider_never_raises_on_junk(answer):
    assert check("RANGE", answer)[0] is False
    assert not valid("RANGE", answer)


def test_a_slider_takes_a_half_value_an_untouched_handle_can_sit_on():
    assert valid("RANGE", "2.5") and check("RANGE", "5.5")[0] is True
    assert check("RANGE", "6.5")[0] is False


def test_a_slider_answer_must_be_on_the_slider():
    assert valid("RANGE", "0") and valid("RANGE", "10")
    assert not valid("RANGE", "-1") and not valid("RANGE", "11")
    assert not valid("RANGE", str(10**30))


# What each type accepts at all.


def test_a_choice_must_be_one_of_the_options():
    assert valid("ABCD", "Lisbon") and valid("VOTING", "Porto")
    assert not valid("ABCD", "Madrid")
    assert not valid("VOTING", "Madrid"), "the host's poll counts broke on an unknown option"


def test_an_order_must_be_the_same_items_reordered():
    assert valid("ORDER", "a", ["Frog", "Egg", "Tadpole"])
    assert not valid("ORDER", "a", ["Egg", "Tadpole"]), "an item missing"
    assert not valid("ORDER", "a", ["Egg", "Tadpole", "Frog", "Frog"]), "an item twice"
    assert not valid("ORDER", "a", ["Egg", "Tadpole", "Toad"]), "an item made up"
    assert not valid("ORDER", "a"), "no order at all"


def test_nothing_is_answered_on_a_slide():
    assert not valid("SLIDE", "anything")


def test_check_choice_and_type_answer_take_what_scoring_reads():
    assert valid("CHECK", "0") and valid("CHECK", "01")
    assert valid("TEXT", "anything at all")


# Sizes, refused before any of the above runs.


def test_an_answer_is_bounded():
    with pytest.raises(ValueError):
        submit("x" * 1001)
    with pytest.raises(ValueError):
        submit("a", ["x"] * 11)
    with pytest.raises(ValueError):
        submit("a", ["x" * 1001])
    # A stored option can be longer than 100 once its formatting tags are counted.
    assert submit("<b>" + "x" * 100 + "</b>").answer.startswith("<b>")


def test_randomize_answers_keeps_an_orders_key():
    from frogquiz.routers.quiz import shuffle_answers

    items = [{"answer": str(n)} for n in range(6)]
    questions = [
        {"type": "ORDER", "answers": list(items)},
        {"type": "RANGE", "answers": QUESTIONS["RANGE"]["answers"]},
        {"type": "SLIDE", "answers": ""},
        {"type": "ABCD", "answers": [{"answer": str(n), "right": n == 0} for n in range(6)]},
    ]
    for _ in range(20):
        shuffle_answers(questions)
    assert questions[0]["answers"] == items, "the stored order is the answer"
    assert questions[1]["answers"] == QUESTIONS["RANGE"]["answers"]
    assert questions[2]["answers"] == ""


def test_a_wrong_phone_is_shown_the_right_answer_for_every_scored_type():
    from frogquiz.socket_server.helpers import correct_answer_texts

    def shown(type_, **answers):
        q = QuizQuestion(question="Q", time="20", type=type_, **(answers or QUESTIONS[type_]))
        return correct_answer_texts(q)

    assert shown("ABCD") == ["Lisbon"]
    assert shown("CHECK") == ["Frog"]
    assert shown("TEXT") == ["Lisbon"]
    assert shown("RANGE") == ["4–6"]
    assert shown("RANGE", answers={"min": 0, "max": 10, "min_correct": 4, "max_correct": 4}) == ["4"]
    assert shown("ORDER") == ["Egg", "Tadpole", "Frog"]
    assert shown("VOTING") is None, "a poll has no right answer"
    assert shown("SLIDE") is None


def test_a_phone_never_starts_an_order_question_in_the_right_order():
    from frogquiz.socket_server import question_for_players

    for items in (["Egg", "Frog"], ["Egg", "Tadpole", "Frog"]):
        g = game("ORDER")
        g.questions[0].answers = [{"answer": a} for a in items]
        g = PlayGame.model_validate(g.model_dump())
        for _ in range(40):
            sent = [a["answer"] for a in question_for_players(g, 0)["answers"]]
            assert sorted(sent) == sorted(items)
            assert sent != items
