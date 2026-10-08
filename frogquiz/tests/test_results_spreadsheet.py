# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The Players sheet of the end-of-game download, without a database or a game.

Read straight out of the .xlsx zip: the shared-strings table holds every text cell,
and a formula cell is an <f> element in the sheet XML.
"""

import asyncio
import zipfile

from frogquiz.helpers import generate_spreadsheet


def players_sheet(**kwargs) -> tuple[str, str]:
    data = asyncio.run(generate_spreadsheet(quiz_results={}, quiz=None, **kwargs))
    with zipfile.ZipFile(data) as z:
        return z.read("xl/worksheets/sheet1.xml").decode(), z.read("xl/sharedStrings.xml").decode()


def test_the_join_column_is_headed_with_the_hosts_question():
    _, strings = players_sheet(
        player_fields={"ana": "Sales"},
        player_scores={"ana": "100"},
        custom_field="Your department",
    )
    assert "Your department" in strings
    assert "Custom-Field" not in strings


def test_a_game_without_a_join_question_still_names_the_column():
    _, strings = players_sheet(player_fields={}, player_scores={"ana": "100"})
    assert "Join question" in strings


def test_what_players_type_is_never_a_formula():
    sheet, strings = players_sheet(
        player_fields={"=1+1": '=HYPERLINK("http://example.com","x")'},
        player_scores={"=1+1": "100"},
        custom_field="=2+2",
    )
    assert "<f>" not in sheet
    assert "=1+1" in strings
    assert "=2+2" in strings
