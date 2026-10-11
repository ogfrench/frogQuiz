# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""join_game checks the payload before it reads the PIN out of it.

It used to index data['game_pin'] first, so a message without one raised KeyError instead
of being refused. Driven with a fake sio and Redis, so it needs neither the socket server
nor a database.
"""

import asyncio

import pytest

import frogquiz.socket_server as server


@pytest.mark.parametrize("payload", [{"username": "ana"}, "not an object", None])
def test_a_join_without_a_pin_is_refused_not_raised(monkeypatch, payload):
    emitted: list[str] = []

    async def emit(event, *_args, **_kwargs):
        emitted.append(event)

    class NoRedis:
        async def get(self, key):
            raise AssertionError("the payload was not validated before Redis was read")

    monkeypatch.setattr(server.sio, "emit", emit)
    monkeypatch.setattr(server, "redis", NoRedis())

    asyncio.run(server.join_game("sid", payload))
    assert emitted == ["error"]


HANDLERS = ["register_as_admin", "submit_answer", "kick_player", "register_as_remote", "set_control_visibility"]


@pytest.mark.parametrize("handler", HANDLERS)
@pytest.mark.parametrize("payload", ["not an object", None])
def test_every_handler_refuses_a_payload_that_is_not_an_object(monkeypatch, handler, payload):
    # join_game and rejoin_game were fixed for this; the other handlers that validate a
    # payload still let the TypeError out, so the client got no "error" back.
    emitted: list[str] = []

    async def emit(event, *_args, **_kwargs):
        emitted.append(event)

    async def no_session(*_args, **_kwargs):
        raise AssertionError("the payload was not validated before the session was read")

    monkeypatch.setattr(server.sio, "emit", emit)
    monkeypatch.setattr(server, "get_session", no_session)

    asyncio.run(getattr(server, handler)("sid", payload))
    assert emitted == ["error"]
