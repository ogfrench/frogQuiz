# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
#
# SPDX-License-Identifier: MPL-2.0


import pytest

from frogquiz.db.models import QuizQuestionType
from frogquiz.kahoot_importer import _Choice, _Question, _Video
from frogquiz.kahoot_importer.import_quiz import _download_image, map_question

ddg_robots_txt = b"""a"""
test_url = (
    "https://gist.githubusercontent.com/mawoka-myblock/b43f0d888a9e6a25806b3c73e63b658f/raw"
    "/134f135f99f8f385695304f739667c70b636386a/test-gist"
)


@pytest.mark.asyncio
async def test_download_image():
    image = await _download_image(test_url)
    assert image == ddg_robots_txt


def _kahoot_question(choices: list[tuple[str, bool]], question: str = "Q?") -> _Question:
    return _Question(
        type="quiz",
        question=question,
        time=20000,
        choices=[_Choice(answer=a, correct=c) for a, c in choices],
        video=_Video(startTime=0, endTime=0, service=""),
        questionFormat=0,
        media=[],
    )


def test_imported_answers_carry_no_colour():
    """The importer used to stamp a fixed four-colour palette onto every answer, which
    overrode the app's own palette. Leaving colour unset lets the play screen colour by
    position, the same as a quiz written in the editor."""
    mapped = map_question(_kahoot_question([("a", True), ("b", False)]), None)
    assert [a["color"] for a in mapped["answers"]] == [None, None]


def test_more_than_four_choices_import():
    """Indexing a four-entry colour list by choice position raised IndexError here."""
    choices = [(f"answer {i}", i == 0) for i in range(6)]
    mapped = map_question(_kahoot_question(choices), None)
    assert len(mapped["answers"]) == 6


def test_imported_questions_are_abcd():
    """The MVP only supports ABCD, so the importer must not be a back door to the
    question types that were cut. See docs/mvp-scope.md."""
    mapped = map_question(_kahoot_question([("a", True)]), None)
    assert mapped["type"] == QuizQuestionType.ABCD


def test_survey_questions_are_skipped():
    """A Kahoot survey or poll has choices but marks none of them correct. Imported as an
    ABCD question it becomes a round nobody can score."""
    assert map_question(_kahoot_question([("a", False), ("b", False)]), None) is None


def test_question_html_is_stripped():
    mapped = map_question(_kahoot_question([("<b>a</b>", True)], question="<script>x</script>hi"), None)
    assert mapped["answers"][0]["answer"] == "a"
    assert "<script>" not in mapped["question"]
