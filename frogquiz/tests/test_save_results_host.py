# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Save results writes a row only for a host who has, or had, an account (#52).

An anonymous host's game has no owner, and every results read filters by owner, so the
row it used to write could never be opened. The button is hidden for that host; the
server now refuses too. A host whose account was deleted mid-game still gets an
ownerless row, as before: that one was saved on purpose. Driven with a fake session and
a fake Redis, so it needs neither the socket server nor a database.
"""

import asyncio
import uuid

import pytest

import frogquiz.socket_server as server
import frogquiz.socket_server.export_helpers as export_helpers
from frogquiz.db.models import PlayGame, QuizQuestion


def make_game(user_id):
    return PlayGame(
        quiz_id=str(uuid.uuid4()),
        description="",
        user_id=user_id,
        title="One question",
        questions=[
            QuizQuestion(question="A", time="20", type="ABCD", answers=[{"answer": "x", "right": True}]),
        ],
        game_id=uuid.uuid4(),
        game_pin="123456",
    )


class FakeRedis:
    def __init__(self, game: PlayGame):
        self.values = {"game:123456": game.model_dump_json()}

    async def get(self, key):
        return self.values.get(key)

    async def scard(self, _key):
        return 1

    async def hgetall(self, _key):
        return {}


@pytest.fixture
def host(monkeypatch):
    emitted: list[tuple] = []
    saved: list[str] = []

    def run(game: PlayGame):
        monkeypatch.setattr(server, "redis", FakeRedis(game))

        async def session(_sid, _sio):
            return {"game_pin": "123456", "admin": True}

        async def emit(event, data=None, room=None, **_kwargs):
            emitted.append((event, data, room))

        async def save(pin):
            saved.append(pin)

        monkeypatch.setattr(server, "get_session", session)
        monkeypatch.setattr(server.sio, "emit", emit)
        monkeypatch.setattr(server, "save_quiz_to_storage", save)
        asyncio.run(server.save_quiz("host-sid"))
        return emitted, saved

    return run


def test_an_anonymous_host_is_refused_with_a_reason_and_nothing_is_written(host):
    emitted, saved = host(make_game(user_id=None))
    assert saved == []
    assert [(e, room) for e, _, room in emitted] == [("results_not_saved", "host-sid")]
    assert emitted[0][1]["reason"]


def test_a_signed_in_host_still_saves(host):
    emitted, saved = host(make_game(user_id=uuid.uuid4()))
    assert saved == ["123456"]
    assert [(e, room) for e, _, room in emitted] == [("results_saved_successfully", "host-sid")]


def test_a_host_whose_account_is_gone_still_gets_an_ownerless_row(monkeypatch):
    game = make_game(user_id=uuid.uuid4())
    monkeypatch.setattr(export_helpers, "redis", FakeRedis(game))
    rows: list[dict] = []

    class NoUser:
        class objects:
            @staticmethod
            def filter(**_kwargs):
                class Query:
                    @staticmethod
                    async def get_or_none():
                        return None

                return Query

    class Row:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        async def save(self):
            rows.append(self.kwargs)

    monkeypatch.setattr(export_helpers, "User", NoUser)
    monkeypatch.setattr(export_helpers, "GameResults", Row)
    asyncio.run(export_helpers.save_quiz_to_storage("123456"))
    assert len(rows) == 1
    assert rows[0]["user"] is None
    assert rows[0]["id"] == game.game_id
