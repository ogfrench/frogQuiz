# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""join_game checks the payload before it reads the PIN out of it.

It used to index data['game_pin'] first, so a message without one raised KeyError instead
of being refused. Driven with a fake sio and Redis, so it needs neither the socket server
nor a database.
"""

import asyncio

import frogquiz.socket_server as server


def test_a_join_without_a_pin_is_refused_not_raised(monkeypatch):
    emitted: list[str] = []

    async def emit(event, *_args, **_kwargs):
        emitted.append(event)

    class NoRedis:
        async def get(self, key):
            raise AssertionError("the payload was not validated before Redis was read")

    monkeypatch.setattr(server.sio, "emit", emit)
    monkeypatch.setattr(server, "redis", NoRedis())

    asyncio.run(server.join_game("sid", {"username": "ana"}))
    assert emitted == ["error"]
