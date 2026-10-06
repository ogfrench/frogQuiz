# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The live game's score curve: Kahoot's, since 5 Oct 2026."""

from frogquiz.socket_server import calculate_score


def test_score_curve_matches_kahoot():
    assert calculate_score(0, 20) == 1000
    assert calculate_score(499, 20) == 1000  # inside half a second is full marks
    assert calculate_score(10_000, 20) == 750
    assert calculate_score(20_000, 20) == 500  # the buzzer is half marks, not zero
    assert calculate_score(21_400, 20) == 500  # inside the grace window, still the buzzer's
