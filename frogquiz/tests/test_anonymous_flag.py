# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Making, editing and hosting a quiz need an account unless the flag says otherwise (#55).

François, 11 Oct: creating, uploading and hosting need a team account, behind the setting
`anonymous_quizzes_enabled`, off by default. Players still join by PIN with no account. A
quiz made while the flag was on can still be read with its secret and claimed into an
account. With the flag on, two ceilings stop a script filling the database: new quizzes per
address a day, and quizzes without an account alive at once.

The suite runs with the flag on (`.env.ci`), since the rest of it hosts anonymously; these
tests turn it off on the settings object the routers share.
"""

import copy
import io

import pytest
from fastapi.testclient import TestClient

from frogquiz.config import settings as get_settings
from frogquiz.tests import test_client, example_quiz  # noqa: F401
from frogquiz.tests.test_claim_races import PASSWORD, _sign_up

# Creates quizzes and deletes them again, so test_server.py's exact counts are taken first.
pytestmark = pytest.mark.order(-1)

PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f"
    b"\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x03\x00\x08\xfc\x02\xfe\xa7\x9a\xa0\xa0"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _anon_quiz(client: TestClient):
    token = client.post("/api/v1/editor/start?edit=false").json()["token"]
    resp = client.post(f"/api/v1/editor/finish?edit_id={token}", json=copy.deepcopy(example_quiz))
    assert resp.status_code == 200
    return resp.json()["id"], resp.headers["X-Anon-Secret"]


@pytest.fixture
def flag_off(monkeypatch):
    monkeypatch.setattr(get_settings(), "anonymous_quizzes_enabled", False)


def test_with_the_flag_off_nothing_is_made_edited_uploaded_or_hosted_without_an_account(
    test_client: TestClient, monkeypatch  # noqa: F811
):
    # One made while the flag was on, then the flag goes off.
    quiz_id, secret = _anon_quiz(test_client)
    start = test_client.post("/api/v1/editor/start?edit=false")
    assert start.status_code == 200
    token = start.json()["token"]
    monkeypatch.setattr(get_settings(), "anonymous_quizzes_enabled", False)
    headers = {"X-Anon-Secret": secret}
    try:
        assert test_client.post("/api/v1/editor/start?edit=false").status_code == 401
        edit = test_client.post(f"/api/v1/editor/start?edit=true&quiz_id={quiz_id}", headers=headers)
        assert edit.status_code == 401
        # A session opened while the flag was on cannot save once it is off.
        body = copy.deepcopy(example_quiz)
        assert test_client.post(f"/api/v1/editor/save?edit_id={token}", json=body).status_code == 401
        assert test_client.post(f"/api/v1/editor/finish?edit_id={token}", json=body).status_code == 401
        upload = test_client.post("/api/v1/storage/", files={"file": ("a.png", io.BytesIO(PNG), "image/png")})
        assert upload.status_code == 401
        assert test_client.post(f"/api/v1/quiz/start/{quiz_id}?game_mode=kahoot", headers=headers).status_code == 401
        # Reading it back with its secret still works, so it can be claimed into an account.
        assert test_client.get(f"/api/v1/quiz/get/{quiz_id}", headers=headers).status_code == 200
        # The error says what to do.
        assert "Sign in" in test_client.post("/api/v1/editor/start?edit=false").json()["detail"]
    finally:
        monkeypatch.undo()
        test_client.delete(f"/api/v1/quiz/delete/{quiz_id}", headers=headers)


def test_the_flag_tells_the_frontend(test_client: TestClient, monkeypatch):  # noqa: F811
    assert test_client.get("/api/v1/utils/config").json()["anonymous_quizzes_enabled"] is True
    monkeypatch.setattr(get_settings(), "anonymous_quizzes_enabled", False)
    assert test_client.get("/api/v1/utils/config").json() == {"anonymous_quizzes_enabled": False}


def test_a_new_anonymous_quiz_past_the_live_total_is_refused(test_client: TestClient, monkeypatch):  # noqa: F811
    first, secret = _anon_quiz(test_client)
    try:
        # At most as many as are alive already: the next one would pass the ceiling.
        monkeypatch.setattr(get_settings(), "anon_quiz_total_limit", 1)
        token = test_client.post("/api/v1/editor/start?edit=false").json()["token"]
        resp = test_client.post(f"/api/v1/editor/save?edit_id={token}", json=copy.deepcopy(example_quiz))
        assert resp.status_code == 429
        assert "Sign in" in resp.json()["detail"]
        # Editing one that exists is never stopped.
        edit = test_client.post(
            f"/api/v1/editor/start?edit=true&quiz_id={first}", headers={"X-Anon-Secret": secret}
        ).json()["token"]
        saved = test_client.post(
            f"/api/v1/editor/save?edit_id={edit}", json=copy.deepcopy(example_quiz), headers={"X-Anon-Secret": secret}
        )
        assert saved.status_code == 200
    finally:
        monkeypatch.undo()
        test_client.delete(f"/api/v1/quiz/delete/{first}", headers={"X-Anon-Secret": secret})


def test_the_twenty_first_new_anonymous_quiz_in_a_day_from_one_address_is_refused(
    test_client: TestClient, monkeypatch  # noqa: F811
):
    # The suite runs with rate limits off; this one is the point of the test.
    monkeypatch.setattr(get_settings(), "rate_limit_enabled", True)
    monkeypatch.setattr(get_settings(), "anon_quiz_daily_limit", 2)
    made = []
    try:
        for _ in range(2):
            made.append(_anon_quiz(test_client))
        token = test_client.post("/api/v1/editor/start?edit=false").json()["token"]
        resp = test_client.post(f"/api/v1/editor/finish?edit_id={token}", json=copy.deepcopy(example_quiz))
        assert resp.status_code == 429
        assert "today" in resp.json()["detail"]
    finally:
        monkeypatch.undo()
        for quiz_id, secret in made:
            test_client.delete(f"/api/v1/quiz/delete/{quiz_id}", headers={"X-Anon-Secret": secret})


def test_with_the_flag_off_a_signed_in_user_still_makes_and_hosts_quizzes(
    test_client: TestClient, flag_off  # noqa: F811
):
    user = _sign_up(test_client, "flag-off-host")
    cookies = user["cookies"]
    try:
        token = test_client.post("/api/v1/editor/start?edit=false", cookies=cookies).json()["token"]
        resp = test_client.post(
            f"/api/v1/editor/finish?edit_id={token}", json=copy.deepcopy(example_quiz), cookies=cookies
        )
        assert resp.status_code == 200
        started = test_client.post(f"/api/v1/quiz/start/{resp.json()['id']}?game_mode=kahoot", cookies=cookies)
        assert started.status_code == 200
    finally:
        # Deleting the account takes its quizzes with it.
        test_client.request("DELETE", "/api/v1/users/me", json={"password": PASSWORD}, cookies=cookies)
        test_client.cookies.clear()
