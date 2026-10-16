# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Personal API keys, as the agent API and My Account use them (docs/mcp.md).

The keys sat in the table in plaintext, as its primary key; `GET /users/api_keys`
answered [] whatever an account held; and "sign out everywhere" left them working
(finding 5 in docs/security-audit-2026-10-11.md). These pin each of those shut.
"""

import pytest
from fastapi.testclient import TestClient

from frogquiz.auth import api_key_cache_key, check_api_key, hash_api_key
from frogquiz.config import redis, settings as get_settings
from frogquiz.db import database
from frogquiz.db.models import ApiKey
from frogquiz.routers.users import MAX_API_KEYS_PER_ACCOUNT
from frogquiz.tests import test_client  # noqa: F401

PASSWORD = "test-password"

# Makes accounts and removes them, so test_server.py's exact counts come first.
pytestmark = pytest.mark.order(-1)


def _login(client: TestClient, email: str, username: str):
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
    return resp.cookies


@pytest.fixture(scope="module")
def account(test_client: TestClient):  # noqa: F811
    cookies = _login(test_client, "keys-owner@byom.de", "keysowner")
    yield cookies
    test_client.request("DELETE", "/api/v1/users/me", json={"password": PASSWORD}, cookies=cookies)


def _agent(client: TestClient, key: str):
    return client.get("/api/v1/agent/me", headers={"Authorization": f"Bearer {key}"})


def _revoke_all(client: TestClient, cookies):
    for row in client.get("/api/v1/users/api_keys", cookies=cookies).json():
        client.delete(f"/api/v1/users/api_keys/{row['id']}", cookies=cookies)


def test_a_new_key_is_shown_once_and_listed_without_it(test_client, account):  # noqa: F811
    made = test_client.post("/api/v1/users/api_keys", json={"name": "  Claude on my laptop "}, cookies=account)
    assert made.status_code == 200
    body = made.json()
    key = body["key"]
    assert key.startswith("fq_") and len(key) == 46
    assert body["name"] == "Claude on my laptop"
    assert key.startswith(body["prefix"]) and len(body["prefix"]) == 7

    listed = test_client.get("/api/v1/users/api_keys", cookies=account)
    assert listed.status_code == 200
    (row,) = [r for r in listed.json() if r["id"] == body["id"]]
    assert set(row) == {"id", "name", "prefix", "created_at", "last_used_at"}
    # Neither the key nor its hash ever comes back.
    assert key not in listed.text and hash_api_key(key) not in listed.text
    _revoke_all(test_client, account)


def test_only_the_hash_is_stored(test_client, account):  # noqa: F811
    key = test_client.post("/api/v1/users/api_keys", cookies=account).json()["key"]
    rows = test_client.portal.call(lambda: database.fetch_all("SELECT * FROM api_keys"))
    stored = " ".join(str(value) for row in rows for value in dict(row).values())
    assert key not in stored
    assert hash_api_key(key) in stored
    _revoke_all(test_client, account)


def test_a_key_posted_with_no_body_gets_a_default_name(test_client, account):  # noqa: F811
    # test_live_owner.py makes its keys this way.
    body = test_client.post("/api/v1/users/api_keys", cookies=account).json()
    assert body["name"] == "API key"
    _revoke_all(test_client, account)


@pytest.mark.parametrize("name", ["", "   ", "x" * 61])
def test_a_bad_name_is_refused(test_client, account, name):  # noqa: F811
    assert test_client.post("/api/v1/users/api_keys", json={"name": name}, cookies=account).status_code == 422


def test_an_account_has_at_most_ten_keys(test_client, account):  # noqa: F811
    for _ in range(MAX_API_KEYS_PER_ACCOUNT):
        assert test_client.post("/api/v1/users/api_keys", cookies=account).status_code == 200
    assert test_client.post("/api/v1/users/api_keys", cookies=account).status_code == 409
    _revoke_all(test_client, account)
    assert test_client.post("/api/v1/users/api_keys", cookies=account).status_code == 200
    _revoke_all(test_client, account)


def test_keys_need_a_session(test_client):  # noqa: F811
    assert test_client.post("/api/v1/users/api_keys").status_code == 401
    assert test_client.get("/api/v1/users/api_keys").status_code == 401


def test_a_revoked_key_stops_working_at_once(test_client, account):  # noqa: F811
    body = test_client.post("/api/v1/users/api_keys", cookies=account).json()
    # Used once, so its owner is cached in Redis: the revoke has to clear that too.
    assert _agent(test_client, body["key"]).status_code == 200
    assert test_client.portal.call(redis.get, api_key_cache_key(hash_api_key(body["key"]))) is not None
    assert test_client.delete(f"/api/v1/users/api_keys/{body['id']}", cookies=account).status_code == 200
    assert _agent(test_client, body["key"]).status_code == 401
    # The cache no longer names the owner, whatever it now holds.
    assert test_client.portal.call(check_api_key, body["key"]) is None


def test_a_check_racing_a_revoke_does_not_bring_the_key_back(test_client, account, monkeypatch):  # noqa: F811
    # The check reads the row, the revoke deletes it and clears the cache, then the check
    # caches the owner it read. With a plain delete that left the key working for an hour.
    import frogquiz.auth as auth

    body = test_client.post("/api/v1/users/api_keys", cookies=account).json()
    key_hash = hash_api_key(body["key"])
    real = auth.ApiKey.objects

    class RevokedMidway:
        async def get_or_none(self, **kwargs):
            row = await real.get_or_none(**kwargs)
            await real.filter(key_hash=key_hash).delete()
            await auth.forget_api_key(key_hash)
            return row

    # ormar's `objects` cannot be set, so the name check_api_key looks up is replaced.
    class ApiKeyRevokedMidway:
        objects = RevokedMidway()

    monkeypatch.setattr(auth, "ApiKey", ApiKeyRevokedMidway)
    # This request read the row before the revoke, so it may still pass...
    test_client.portal.call(auth.check_api_key, body["key"])
    monkeypatch.undo()
    # ...but the next one must not.
    assert _agent(test_client, body["key"]).status_code == 401


def test_nobody_can_revoke_or_see_another_accounts_key(test_client, account):  # noqa: F811
    other = _login(test_client, "keys-other@byom.de", "keysother")
    try:
        mine = test_client.post("/api/v1/users/api_keys", cookies=account).json()
        assert test_client.delete(f"/api/v1/users/api_keys/{mine['id']}", cookies=other).status_code == 404
        assert all(r["id"] != mine["id"] for r in test_client.get("/api/v1/users/api_keys", cookies=other).json())
        assert _agent(test_client, mine["key"]).status_code == 200
    finally:
        test_client.request("DELETE", "/api/v1/users/me", json={"password": PASSWORD}, cookies=other)
        _revoke_all(test_client, account)


def test_sign_out_everywhere_revokes_every_key(test_client):  # noqa: F811
    cookies = _login(test_client, "keys-signout@byom.de", "keyssignout")
    keys = [test_client.post("/api/v1/users/api_keys", cookies=cookies).json()["key"] for _ in range(2)]
    assert all(_agent(test_client, k).status_code == 200 for k in keys)
    assert test_client.delete("/api/v1/users/signout-everywhere", cookies=cookies).status_code == 200
    assert all(_agent(test_client, k).status_code == 401 for k in keys)
    # Signed out, so sign in again to clean up.
    cookies = _login_again(test_client, "keys-signout@byom.de")
    test_client.request("DELETE", "/api/v1/users/me", json={"password": PASSWORD}, cookies=cookies)


def test_deleting_the_account_kills_its_keys(test_client):  # noqa: F811
    cookies = _login(test_client, "keys-gone@byom.de", "keysgone")
    key = test_client.post("/api/v1/users/api_keys", cookies=cookies).json()["key"]
    assert _agent(test_client, key).status_code == 200
    test_client.request("DELETE", "/api/v1/users/me", json={"password": PASSWORD}, cookies=cookies)
    assert _agent(test_client, key).status_code == 401
    assert test_client.portal.call(lambda: ApiKey.objects.filter(key_hash=hash_api_key(key)).count()) == 0


def _login_again(client: TestClient, email: str):
    session_id = client.post("/api/v1/login/start", json={"email": email}).json()["session_id"]
    resp = client.post(
        f"/api/v1/login/step/1?session_id={session_id}", json={"auth_type": "PASSWORD", "data": PASSWORD}
    )
    assert resp.status_code == 200
    return resp.cookies
