# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Bounds on the strings a player supplies when joining a game.

The join form caps the nickname at 17 characters, but the socket server is
reachable without the form, so until these validators existed nothing
server-side bounded what arrived. A nickname becomes a Redis key, a member of
the player set and a line on the host's projector, so an unbounded one is a way
to bloat Redis and break the display for everyone else in the room.

These are pure model tests -- no Redis, no socket, no database -- so they say
nothing about the handler around them, only that the payload cannot carry a
nickname the rest of the system was never built to hold.
"""

import pytest
from pydantic import ValidationError

from frogquiz.socket_server.models import (
    MAX_CUSTOM_FIELD_LENGTH,
    MAX_USERNAME_LENGTH,
    JoinGameData,
    RejoinGameData,
)


def join(**over):
    return JoinGameData(**{"username": "Tiago", "game_pin": "123456", **over})


class TestUsernameBounds:
    def test_accepts_an_ordinary_nickname(self):
        assert join().username == "Tiago"

    def test_accepts_the_longest_the_form_allows(self):
        # The form's own cap is 17. The server bound is deliberately looser, so
        # it can never reject someone the UI let through.
        assert len(join(username="a" * 17).username) == 17

    def test_trims_surrounding_whitespace(self):
        # Otherwise " Tiago" and "Tiago" are two different players, and two
        # different Redis keys, which looks like a duplicate-name bug.
        assert join(username="  Tiago  ").username == "Tiago"

    @pytest.mark.parametrize("blank", ["", "   ", "\t\n"])
    def test_rejects_an_empty_or_blank_nickname(self, blank):
        with pytest.raises(ValidationError):
            join(username=blank)

    def test_rejects_an_overlong_nickname(self):
        with pytest.raises(ValidationError):
            join(username="a" * (MAX_USERNAME_LENGTH + 1))

    @pytest.mark.parametrize("raw", ["Ti\nago", "Ti\x00ago", "Ti\x7fago"])
    def test_strips_control_characters(self, raw):
        # A newline in a nickname wraps the projector's player list; a null byte
        # has no business in a Redis key.
        assert join(username=raw).username == "Tiago"

    def test_length_is_measured_after_cleaning(self):
        # Padding that is stripped must not count towards the limit, or a
        # legitimate nickname could be refused for whitespace the user cannot
        # see.
        assert join(username="  " + "a" * MAX_USERNAME_LENGTH + "  ").username == "a" * MAX_USERNAME_LENGTH

    def test_rejoin_cleans_the_same_way(self):
        # A rejoin that cleaned differently would look up a key the join path
        # could never have written, so the player would silently fail to return.
        data = RejoinGameData(old_sid="abc", game_pin="123456", username="  Tiago  ")
        assert data.username == "Tiago"


class TestCustomFieldBounds:
    def test_absent_and_empty_stay_as_they_are(self):
        # The handler treats "" as "not supplied", so the validator must not
        # turn it into a rejection.
        assert join(custom_field=None).custom_field is None
        assert join(custom_field="").custom_field == ""

    def test_trims_and_accepts_a_value(self):
        assert join(custom_field="  Team Frog  ").custom_field == "Team Frog"

    def test_rejects_an_overlong_value(self):
        with pytest.raises(ValidationError):
            join(custom_field="a" * (MAX_CUSTOM_FIELD_LENGTH + 1))
