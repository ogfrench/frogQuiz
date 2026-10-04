# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Which entry of X-Forwarded-For the rate limiter keys on.

Get this wrong to the right and every user shares one bucket, so a limit of five
an hour locks out the whole deployment at once. Get it wrong to the left and the
key is caller-supplied and the limiter is bypassable. Neither failure is visible
until it matters, hence the table.
"""

import base64
import uuid

import pytest
from fastapi.testclient import TestClient

from frogquiz.config import redis, settings
from frogquiz.db.models import Quiz, User
from frogquiz.helpers.ratelimit import client_ip
from frogquiz.tests import example_quiz, test_client  # noqa: F401


class _FakeClient:
    def __init__(self, host):
        self.host = host


class _FakeRequest:
    def __init__(self, forwarded=None, peer="10.0.0.1"):
        self.headers = {} if forwarded is None else {"X-Forwarded-For": forwarded}
        self.client = _FakeClient(peer)


@pytest.mark.parametrize(
    "forwarded,hops,expected",
    [
        # One proxy (the bundled Caddy): the entry it appended is the client.
        ("203.0.113.9", 1, "203.0.113.9"),
        # A forged chain cannot move the entry Caddy itself wrote.
        ("1.1.1.1, 203.0.113.9", 1, "203.0.113.9"),
        # Two proxies (a CDN in front of Caddy): the last is the CDN's egress
        # address, identical for every user. Stepping back one reaches the client.
        ("203.0.113.9, 198.51.100.7", 2, "203.0.113.9"),
        # More hops configured than the chain has: clamp rather than wrap round to
        # the far end, which would key every request on the same forged value.
        ("203.0.113.9", 4, "203.0.113.9"),
        # 0 and negatives are meaningless; treat them as one hop.
        ("1.1.1.1, 203.0.113.9", 0, "203.0.113.9"),
        # Whitespace and empty entries are not addresses.
        ("  1.1.1.1 ,, 203.0.113.9  ", 1, "203.0.113.9"),
    ],
)
def test_client_ip_picks_the_configured_hop(monkeypatch, forwarded, hops, expected):
    monkeypatch.setattr(
        "frogquiz.helpers.ratelimit.settings",
        lambda: type("S", (), {"trusted_proxy_hops": hops})(),
    )
    assert client_ip(_FakeRequest(forwarded)) == expected


def test_client_ip_falls_back_to_the_peer():
    assert client_ip(_FakeRequest(forwarded=None, peer="10.0.0.1")) == "10.0.0.1"


def test_client_ip_survives_a_header_with_no_addresses(monkeypatch):
    monkeypatch.setattr(
        "frogquiz.helpers.ratelimit.settings",
        lambda: type("S", (), {"trusted_proxy_hops": 1})(),
    )
    assert client_ip(_FakeRequest(" , ", peer="10.0.0.1")) == "10.0.0.1"


_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)


# C5 in docs/crud-audit-2026-10.md. Uploads need no account, and with no limit anyone could
# fill the disk at 6 MB a request. Rate limiting is off in .env.ci and e2e.env, so the test
# switches it on for itself, and clears its bucket so later anonymous uploads still work.
def test_anonymous_uploads_are_rate_limited(test_client: TestClient, monkeypatch):  # noqa: F811
    on = settings().model_copy(update={"rate_limit_enabled": True})
    monkeypatch.setattr("frogquiz.helpers.ratelimit.settings", lambda: on)
    # "testclient" is the peer address Starlette's TestClient reports.
    bucket = "ratelimit:upload_anon:testclient"
    test_client.portal.call(redis.delete, bucket)
    statuses = []
    try:
        for _ in range(40):
            res = test_client.post("/api/v1/storage/", files={"file": ("dot.png", _PNG, "image/png")})
            statuses.append(res.status_code)
            if res.status_code == 429:
                break
    finally:
        test_client.portal.call(redis.delete, bucket)
    assert statuses[-1] == 429, statuses
    assert statuses.count(200) == 30, statuses


# E9 in docs/edge-cases-2026-10.md. Autosave was limited per address, and an office shares
# one: a handful of people editing at once used up 60 saves a minute between them. Each edit
# session now has its own bucket, so one busy editor cannot stall the others.
def test_editor_saves_are_limited_per_edit_session(test_client: TestClient, monkeypatch):  # noqa: F811
    on = settings().model_copy(update={"rate_limit_enabled": True})
    monkeypatch.setattr("frogquiz.helpers.ratelimit.settings", lambda: on)
    busy = test_client.post("/api/v1/editor/start?edit=false").json()["token"]
    other = test_client.post("/api/v1/editor/start?edit=false").json()["token"]
    keys = [
        f"ratelimit:editor_save_session:{busy}",
        "ratelimit:editor_save:testclient",
        "ratelimit:editor_start:testclient",
    ]
    # The busy session has used its whole minute.
    test_client.portal.call(lambda: redis.set(keys[0], 60, ex=60))
    saved = None
    try:
        assert test_client.post(f"/api/v1/editor/save?edit_id={busy}", json=example_quiz).status_code == 429
        saved = test_client.post(f"/api/v1/editor/save?edit_id={other}", json=example_quiz)
        assert saved.status_code == 200
    finally:
        for key in keys:
            test_client.portal.call(redis.delete, key)
        # TestStats counts quizzes and expects none left behind.
        if saved is not None and saved.status_code == 200:
            test_client.portal.call(lambda: Quiz.objects.filter(id=uuid.UUID(saved.json()["id"])).delete())


# E16 in docs/edge-cases-2026-10.md. Registration allowed 10 an hour per address, and an
# office signs up from behind one: the eleventh person in the room was locked out for an hour.
def test_registration_fits_an_office_behind_one_address(test_client: TestClient, monkeypatch):  # noqa: F811
    on = settings().model_copy(update={"rate_limit_enabled": True})
    monkeypatch.setattr("frogquiz.helpers.ratelimit.settings", lambda: on)
    bucket = "ratelimit:register:testclient"
    email = "eleventh-colleague@byom.de"
    # Ten colleagues have already signed up from this address.
    test_client.portal.call(lambda: redis.set(bucket, 10, ex=3600))
    try:
        res = test_client.post(
            "/api/v1/users/create", json={"email": email, "username": "eleventh", "password": "test-password"}
        )
        assert res.status_code == 200, res.text
    finally:
        test_client.portal.call(redis.delete, bucket)
        # TestStats counts accounts and expects none left behind.
        test_client.portal.call(lambda: User.objects.filter(email=email).delete())
