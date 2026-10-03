# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Logging out is a POST; a GET only points you at the page that has the button.

It was a GET, so any page could sign a frogQuiz user out by sending them to the URL
(a link or a redirect is a top-level navigation, which SameSite=Lax cookies ride on).
"""

import pytest
from fastapi.testclient import TestClient

from frogquiz.config import settings
from frogquiz.tests import test_client  # noqa: F401

# Runs last and removes its user afterwards: test_server.py's stats tests assert exact
# user counts, which a leftover row would throw off (see test_anonymous_quiz.py).
pytestmark = pytest.mark.order(-1)

EMAIL = "logout-tester@byom.de"
PASSWORD = "test-password"


def _log_in(client: TestClient):
    resp = client.post("/api/v1/login/start", json={"email": EMAIL})
    session_id = resp.json()["session_id"]
    resp = client.post(
        f"/api/v1/login/step/1?session_id={session_id}",
        json={"auth_type": "PASSWORD", "data": PASSWORD},
    )
    assert resp.status_code == 200
    return resp.cookies


class TestLogout:
    @pytest.mark.asyncio
    async def test_setup_user(self, test_client: TestClient):  # noqa: F811
        resp = test_client.post(
            "/api/v1/users/create",
            json={"email": EMAIL, "password": PASSWORD, "username": "logout-tester"},
        )
        assert resp.status_code == 200
        user = test_client.get(f"/api/v1/internal/testing/user/{EMAIL}?secret_key={settings().secret_key}")
        test_client.get(f"/api/v1/users/verify/{user.json()['verify_key']}")

    @pytest.mark.asyncio
    async def test_a_get_does_not_log_you_out(self, test_client: TestClient):  # noqa: F811
        cookies = _log_in(test_client)
        resp = test_client.get("/api/v1/users/logout", cookies=cookies, follow_redirects=False)
        assert resp.status_code == 303
        assert resp.headers["location"] == "/account/settings"
        assert test_client.get("/api/v1/users/me", cookies=cookies).status_code == 200

    @pytest.mark.asyncio
    async def test_a_post_logs_you_out(self, test_client: TestClient):  # noqa: F811
        cookies = _log_in(test_client)
        assert test_client.get("/api/v1/users/me", cookies=cookies).status_code == 200
        resp = test_client.post("/api/v1/users/logout", cookies=cookies, follow_redirects=False)
        assert resp.status_code == 303
        assert resp.headers["location"] == "/"
        # The same cookies, replayed: the token is on the denylist and the session row
        # is gone, so clearing them in the browser is not the only thing that happened.
        assert test_client.get("/api/v1/users/me", cookies=cookies).status_code == 401
        # And logging straight back in works. Tokens used to be identical within a
        # second, so this new login got the very token just revoked and was signed out.
        again = _log_in(test_client)
        assert test_client.get("/api/v1/users/me", cookies=again).status_code == 200

    @pytest.mark.asyncio
    async def test_cleanup_user(self, test_client: TestClient):  # noqa: F811
        cookies = _log_in(test_client)
        resp = test_client.request("DELETE", "/api/v1/users/me", json={"password": PASSWORD}, cookies=cookies)
        assert resp.status_code == 200
