# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The /live API answers only the host's own API key (security audit, 11 Oct).

`/scores`, `/get_question/now` and `/voting` checked that the key existed and never that
it belonged to the game's host, and `/user_count` checked nothing. Any account can mint a
key, so anyone signed in could read a running game of somebody else's by its PIN,
the correct answer to the question on screen included. `/` and `/set_question` already
compared the key's owner with the host; the rest do now.
"""

import copy

import pytest
from fastapi.testclient import TestClient

from frogquiz.config import settings as get_settings
from frogquiz.tests import test_client, example_quiz  # noqa: F401

PASSWORD = "test-password"
ROUTES = ["/api/v1/live/scores", "/api/v1/live/get_question/now", "/api/v1/live/voting", "/api/v1/live/user_count"]

# Makes two users and a quiz and removes them, so test_server.py's exact counts come first.
pytestmark = pytest.mark.order(-1)


def _user(client: TestClient, email: str, username: str):
    secret_key = get_settings().secret_key
    assert (
        client.post(
            "/api/v1/users/create", json={"email": email, "password": PASSWORD, "username": username}
        ).status_code
        == 200
    )
    user = client.get(f"/api/v1/internal/testing/user/{email}?secret_key={secret_key}")
    client.get(f"/api/v1/users/verify/{user.json()['verify_key']}")
    session_id = client.post("/api/v1/login/start", json={"email": email}).json()["session_id"]
    resp = client.post(
        f"/api/v1/login/step/1?session_id={session_id}", json={"auth_type": "PASSWORD", "data": PASSWORD}
    )
    assert resp.status_code == 200
    cookies = resp.cookies
    key = client.post("/api/v1/users/api_keys", cookies=cookies).json()["key"]
    return cookies, key


# One game for the module: two accounts per test was 24 registrations a run.
@pytest.fixture(scope="module")
def game(test_client: TestClient):  # noqa: F811
    host_cookies, host_key = _user(test_client, "live-host@byom.de", "livehost")
    other_cookies, other_key = _user(test_client, "live-other@byom.de", "liveother")
    token = test_client.post("/api/v1/editor/start?edit=false", cookies=host_cookies).json()["token"]
    body = copy.deepcopy(example_quiz)
    body["questions"].append(
        {
            "type": "TEXT",
            "question": "Young frog?",
            "time": "10",
            "answers": [{"answer": "Tadpole", "case_sensitive": False}],
        }
    )
    quiz_id = test_client.post(f"/api/v1/editor/finish?edit_id={token}", json=body, cookies=host_cookies).json()["id"]
    started = test_client.post(f"/api/v1/quiz/start/{quiz_id}?game_mode=kahoot", cookies=host_cookies)
    assert started.status_code == 200
    yield started.json()["game_pin"], host_key, other_key
    for cookies in (host_cookies, other_cookies):
        test_client.request("DELETE", "/api/v1/users/me", json={"password": PASSWORD}, cookies=cookies)


@pytest.mark.parametrize("route", ROUTES)
def test_another_accounts_key_cannot_read_the_game(test_client, game, route):  # noqa: F811
    pin, _, other_key = game
    assert test_client.get(f"{route}?game_pin={pin}&api_key={other_key}").status_code == 404


@pytest.mark.parametrize("route", ROUTES)
def test_a_key_that_does_not_exist_cannot_read_the_game(test_client, game, route):  # noqa: F811
    pin, _, _ = game
    assert test_client.get(f"{route}?game_pin={pin}&api_key=not-a-key").status_code == 404


@pytest.mark.parametrize("route", ROUTES)
def test_the_hosts_own_key_still_can(test_client, game, route):  # noqa: F811
    pin, host_key, _ = game
    assert test_client.get(f"{route}?game_pin={pin}&api_key={host_key}").status_code == 200


def test_a_crafted_pin_is_a_404_not_a_500(test_client, game):  # noqa: F811
    pin, host_key, _ = game
    resp = test_client.get(f"/api/v1/live/scores?game_pin={pin}:current_time&api_key={host_key}")
    assert resp.status_code == 404


def test_set_question_sends_players_no_text_answers(test_client, game, monkeypatch):  # noqa: F811
    # It built the question for the room itself instead of going through
    # question_for_players, so a text question's accepted answers still went to the phones.
    import frogquiz.routers.live as live

    pin, host_key, _ = game
    sent = []

    async def emit(event, data=None, room=None, **_kwargs):
        sent.append((event, data))

    monkeypatch.setattr(live.sio, "emit", emit)
    text_question = len(example_quiz["questions"])
    resp = test_client.post(
        f"/api/v1/live/set_question?game_pin={pin}&question_number={text_question}&api_key={host_key}"
    )
    assert resp.status_code == 200
    ((event, data),) = sent
    assert event == "set_question_number"
    assert data["question"]["answers"] == []
    assert "Tadpole" not in str(data)
