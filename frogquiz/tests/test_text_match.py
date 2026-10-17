# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Type answer's tolerant matching (#93). The same cases as frontend/src/lib/play/text_match.test.ts."""

import json
from pathlib import Path

import pytest

from frogquiz.db.models import TextQuizAnswer
from frogquiz.helpers.text_match import matches
from frogquiz.socket_server.helpers import check_text_question

CASES = json.loads(
    (Path(__file__).resolve().parents[2] / "frontend/src/lib/play/text_match_cases.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_the_shared_matching_cases(case):
    assert matches(case["answer"], case["spelling"], case.get("case_sensitive", False)) is case["match"]


def test_any_accepted_spelling_scores():
    spellings = [
        TextQuizAnswer(answer="Lisbon", case_sensitive=False),
        TextQuizAnswer(answer="Lisboa", case_sensitive=False),
    ]
    assert check_text_question(" lisboa", spellings)
    assert not check_text_question("Porto", spellings)
