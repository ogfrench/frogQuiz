# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""set_question_number refuses a question the game does not have.

"Hide results" on the last question asked for the question after it, which raised
IndexError in the handler, after it had already reset the answer clock. A negative number
would have wrapped round to the last question. Driven with a fake session and a fake
Redis, so it needs neither the socket server nor a database.
"""

import asyncio
import uuid

import pytest

import frogquiz.socket_server as server
from frogquiz.db.models import PlayGame, QuizQuestion


class FakeRedis:
    def __init__(self, game: PlayGame):
        self.values = {"game:123456": game.model_dump_json()}
        self.writes: list[str] = []

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, ex=None):
        self.writes.append(key)
        self.values[key] = value


@pytest.fixture
def game_server(monkeypatch):
    game = PlayGame(
        quiz_id=str(uuid.uuid4()),
        description="",
        user_id=None,
        title="Two questions",
        questions=[
            QuizQuestion(question="A", time="20", type="ABCD", answers=[{"answer": "x", "right": True}]),
            QuizQuestion(question="B", time="20", type="ABCD", answers=[{"answer": "y", "right": True}]),
        ],
        game_id=uuid.uuid4(),
        game_pin="123456",
    )
    fake = FakeRedis(game)
    shown: list[int] = []

    async def session(_sid, _sio):
        return {"game_pin": "123456", "admin": True}

    async def update(_pin, change):
        g = PlayGame.model_validate_json(fake.values["game:123456"])
        change(g)
        shown.append(g.current_question)
        return g

    async def emit(*_args, **_kwargs):
        return None

    monkeypatch.setattr(server, "redis", fake)
    monkeypatch.setattr(server, "get_session", session)
    monkeypatch.setattr(server, "update_game", update)
    monkeypatch.setattr(server.sio, "emit", emit)
    return fake, shown


@pytest.mark.parametrize("asked", ["2", "-1", "7", "not a number", "inf", "nan"])
def test_a_question_past_either_end_is_refused_before_the_clock_moves(game_server, asked):
    fake, shown = game_server
    asyncio.run(server.set_question_number("sid", asked))
    assert shown == []
    assert fake.writes == []


def test_the_last_question_itself_is_still_shown(game_server):
    fake, shown = game_server
    asyncio.run(server.set_question_number("sid", "1"))
    assert shown == [1]
    assert fake.writes == ["game:123456:current_time"]
