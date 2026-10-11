# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Avatar seats are kept for as long as the game is, not for a fixed five hours after a join.

The game key is reset to two hours on every write, so a game still being written for more
than five hours after its last new seat used to lose every frog. Saving the game now
refreshes the seat keys with the same five-hour lifetime, and update_game does the same
inside its transaction.
"""

import asyncio
import uuid

import frogquiz.db.models as models
from frogquiz.db.models import AVATAR_TTL_SECONDS, PlayGame, QuizQuestion, avatar_seat_keys


class FakeRedis:
    def __init__(self):
        self.expires: dict[str, int] = {}

    async def set(self, _key, _value, ex=None):
        return True

    async def expire(self, key, seconds):
        self.expires[key] = seconds
        return True


def test_saving_the_game_refreshes_the_seats_for_the_full_lifetime(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(models, "redis", fake)
    game = PlayGame(
        quiz_id=str(uuid.uuid4()),
        description="",
        user_id=None,
        title="One question",
        questions=[QuizQuestion(question="A", time="20", type="ABCD", answers=[{"answer": "x", "right": True}])],
        game_id=uuid.uuid4(),
        game_pin="123456",
    )
    asyncio.run(game.save("123456"))
    for key in avatar_seat_keys("123456"):
        assert fake.expires[key] == AVATAR_TTL_SECONDS
    # Longer than the two-hour game key, so the seats can never expire while the game lives.
    assert AVATAR_TTL_SECONDS > 7200
