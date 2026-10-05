# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Sign-in by emailed link or code, for frog.co and capgemini.com addresses, no passwords.

The suite runs with passwords on and any domain allowed (.env.ci), for the tests that
predate 5 Oct. Every test here switches back to what production runs.
"""

import uuid

import pyotp
import pytest
from fastapi.testclient import TestClient

from frogquiz.db.models import User
from frogquiz.routers import login
from frogquiz.tests import test_client  # noqa: F401

# Creates accounts, so it runs after test_server.py's exact global counts, and removes them.
pytestmark = pytest.mark.order(-1)


@pytest.fixture
def mail(monkeypatch, test_client: TestClient):  # noqa: F811
    sent: list[dict] = []

    async def capture(email: str, link: str, code: str):
        sent.append({"email": email, "token": link.split("?token=")[1], "code": code, "link": link})

    monkeypatch.setattr(login, "send_sign_in_email", capture)
    monkeypatch.setattr(login.settings, "allowed_email_domains", ["frog.co", "capgemini.com"])
    monkeypatch.setattr(login.settings, "enable_password_login", False)
    test_client.cookies.clear()
    yield sent
    test_client.cookies.clear()


def _address(domain: str = "frog.co") -> str:
    return f"ml-{uuid.uuid4().hex[:10]}@{domain}"


def _drop(client: TestClient, *emails: str):
    client.portal.call(lambda: User.objects.filter(email__in=list(emails)).delete())


def _sign_up(client: TestClient, mail: list, email: str, username: str | None = None):
    assert client.post("/api/v1/login/email", json={"email": email}).status_code == 200
    signup = client.post("/api/v1/login/email/verify", json={"token": mail[-1]["token"]}).json()["signup"]
    username = username or f"u{uuid.uuid4().hex[:8]}"
    resp = client.post("/api/v1/login/email/signup", json={"signup": signup, "username": username})
    assert resp.status_code == 200, resp.text
    return username


def test_the_domain_rule_matches_whole_domains_only(monkeypatch):
    # Shared by the emailed link and the OAuth providers, which would otherwise make an
    # account for any address once configured.
    rule = login.settings
    monkeypatch.setattr(rule, "allowed_email_domains", ["frog.co", "capgemini.com"])
    assert rule.email_domain_allowed(" Ana@Frog.co ")
    assert rule.email_domain_allowed("ana@capgemini.com")
    for outsider in ["a@mail.capgemini.com", "a@frog.co.evil.com", "frog.co@evil.com", "a@gmail.com"]:
        assert not rule.email_domain_allowed(outsider), outsider
    monkeypatch.setattr(rule, "allowed_email_domains", [])
    assert rule.email_domain_allowed("a@anything.example")


def test_only_the_team_domains_can_ask_for_a_link(test_client: TestClient, mail):  # noqa: F811
    for email in ["someone@gmail.com", "someone@mail.capgemini.com", "someone@frog.co.evil.com"]:
        assert test_client.post("/api/v1/login/email", json={"email": email}).status_code == 403, email
    assert test_client.post("/api/v1/login/email", json={"email": "not an address"}).status_code == 400
    assert mail == []
    assert test_client.post("/api/v1/login/email", json={"email": _address("capgemini.com")}).status_code == 200
    assert test_client.post("/api/v1/login/email", json={"email": _address("frog.co")}).status_code == 200
    assert len(mail) == 2


def test_a_first_sign_in_asks_for_a_username_and_makes_a_passwordless_account(
    test_client: TestClient, mail  # noqa: F811
):
    email = _address()
    try:
        resp = test_client.post("/api/v1/login/email", json={"email": email, "return_to": "/explore"})
        assert resp.status_code == 200
        assert mail[-1]["email"] == email
        assert mail[-1]["link"].startswith("http") and "/account/login?token=" in mail[-1]["link"]
        first = test_client.post("/api/v1/login/email/verify", json={"token": mail[-1]["token"]}).json()
        assert first["return_to"] == "/explore"
        assert test_client.get("/api/v1/users/me").status_code == 401, "no account until a username is picked"

        resp = test_client.post("/api/v1/login/email/signup", json={"signup": first["signup"], "username": " Kermit "})
        assert resp.status_code == 200, resp.text
        assert resp.json()["return_to"] == "/explore"
        me = test_client.get("/api/v1/users/me").json()
        assert me["email"] == email and me["username"] == "Kermit"
        stored = test_client.portal.call(lambda: User.objects.get(email=email))
        assert stored.password is None and stored.verified is True
        # A signup is used once.
        again = test_client.post("/api/v1/login/email/signup", json={"signup": first["signup"], "username": "Other"})
        assert again.status_code == 401
    finally:
        _drop(test_client, email)


def test_a_username_is_unique_whatever_the_case(test_client: TestClient, mail):  # noqa: F811
    first, second = _address(), _address()
    try:
        name = _sign_up(test_client, mail, first)
        test_client.cookies.clear()
        test_client.post("/api/v1/login/email", json={"email": second})
        signup = test_client.post("/api/v1/login/email/verify", json={"token": mail[-1]["token"]}).json()["signup"]
        taken = test_client.post("/api/v1/login/email/signup", json={"signup": signup, "username": name.upper()})
        assert taken.status_code == 409
        short = test_client.post("/api/v1/login/email/signup", json={"signup": signup, "username": "ab"})
        assert short.status_code == 422
    finally:
        _drop(test_client, first, second)


def test_the_link_signs_in_until_it_expires_not_just_once(test_client: TestClient, mail):  # noqa: F811
    # Outlook's Safe Links opens a link before the person does. Spent on first use, it would
    # be dead by the time they clicked, so it lasts its 15 minutes, as frogViz's does.
    email = _address()
    try:
        _sign_up(test_client, mail, email)
        test_client.cookies.clear()
        test_client.post("/api/v1/login/email", json={"email": email})
        token = mail[-1]["token"]
        for _ in range(2):
            test_client.cookies.clear()
            assert test_client.post("/api/v1/login/email/verify", json={"token": token}).status_code == 200
            assert test_client.get("/api/v1/users/me").json()["email"] == email
        bad = test_client.post("/api/v1/login/email/verify", json={"token": token + "x"})
        assert bad.status_code == 401
    finally:
        _drop(test_client, email)


def test_the_code_signs_in_and_dies_after_five_wrong_tries(test_client: TestClient, mail):  # noqa: F811
    email = _address()
    try:
        _sign_up(test_client, mail, email)
        test_client.cookies.clear()
        challenge = test_client.post("/api/v1/login/email", json={"email": email}).json()["challenge"]
        right = mail[-1]["code"]
        wrong = f"{(int(right) + 1) % 1_000_000:06d}"
        for _ in range(5):
            resp = test_client.post("/api/v1/login/email/verify", json={"challenge": challenge, "code": wrong})
            assert resp.status_code == 401
        dead = test_client.post("/api/v1/login/email/verify", json={"challenge": challenge, "code": right})
        assert dead.status_code == 429
        assert test_client.get("/api/v1/users/me").status_code == 401

        challenge = test_client.post("/api/v1/login/email", json={"email": email}).json()["challenge"]
        resp = test_client.post(
            "/api/v1/login/email/verify", json={"challenge": challenge, "code": f" {mail[-1]['code']} "}
        )
        assert resp.status_code == 200
        assert test_client.get("/api/v1/users/me").json()["email"] == email
    finally:
        _drop(test_client, email)


def test_an_address_typed_in_capitals_finds_the_same_account(test_client: TestClient, mail):  # noqa: F811
    email = _address()
    try:
        _sign_up(test_client, mail, email)
        test_client.cookies.clear()
        test_client.post("/api/v1/login/email", json={"email": email.upper()})
        assert mail[-1]["email"] == email
        resp = test_client.post("/api/v1/login/email/verify", json={"token": mail[-1]["token"]})
        assert "signup" not in resp.json()
        assert test_client.get("/api/v1/users/me").json()["email"] == email
    finally:
        _drop(test_client, email)


def test_return_to_must_be_a_path_on_this_site(test_client: TestClient, mail):  # noqa: F811
    for evil in ["//evil.example", "https://evil.example", "/\\evil.example"]:
        test_client.post("/api/v1/login/email", json={"email": _address(), "return_to": evil})
        resp = test_client.post("/api/v1/login/email/verify", json={"token": mail[-1]["token"]})
        assert resp.json()["return_to"] is None, evil


def test_an_authenticator_set_up_before_the_cut_is_still_asked_for(test_client: TestClient, mail):  # noqa: F811
    email = _address()
    secret = pyotp.random_base32()
    try:
        _sign_up(test_client, mail, email)
        test_client.cookies.clear()

        async def add_totp():
            user = await User.objects.get(email=email)
            user.totp_secret = secret
            await user.update()

        test_client.portal.call(add_totp)
        test_client.post("/api/v1/login/email", json={"email": email})
        resp = test_client.post("/api/v1/login/email/verify", json={"token": mail[-1]["token"]})
        assert resp.status_code == 202
        assert resp.json()["step_2"] == ["TOTP"]
        assert test_client.get("/api/v1/users/me").status_code == 401
        step = test_client.post(
            f"/api/v1/login/step/2?session_id={resp.json()['session_id']}",
            json={"auth_type": "TOTP", "data": pyotp.TOTP(secret).now()},
        )
        assert step.status_code == 200, step.text
        assert test_client.get("/api/v1/users/me").json()["email"] == email
    finally:
        _drop(test_client, email)


def test_the_password_routes_are_off(test_client: TestClient, mail):  # noqa: F811
    email = _address()
    try:
        assert test_client.post("/api/v1/login/start", json={"email": email}).status_code == 404
        created = test_client.post(
            "/api/v1/users/create", json={"email": email, "username": "nopass1", "password": "long-enough-1"}
        )
        assert created.status_code == 404
        assert test_client.post("/api/v1/users/forgot-password", json={"email": email}).status_code == 404
        assert test_client.post("/api/v1/users/resend-verification", json={"email": email}).status_code == 404
        reset = test_client.post("/api/v1/users/reset-password", json={"token": "x", "password": "long-enough-1"})
        assert reset.status_code == 404
        _sign_up(test_client, mail, email)
        change = test_client.put(
            "/api/v1/users/password/update", json={"old_password": "x", "new_password": "long-enough-2"}
        )
        assert change.status_code == 404
    finally:
        _drop(test_client, email)


def test_discover_and_its_listings_need_a_signed_in_account(test_client: TestClient, mail):  # noqa: F811
    assert test_client.post("/api/v1/search/", json={"q": ""}).status_code == 401
    assert test_client.get("/api/v1/search/?q=frog").status_code == 401
    assert test_client.get("/api/v1/sitemap/get").status_code == 401
    assert test_client.get(f"/api/v1/community/quizzes/{uuid.uuid4()}").status_code == 401
    email = _address()
    try:
        _sign_up(test_client, mail, email)
        assert test_client.post("/api/v1/search/", json={"q": ""}).status_code == 200
    finally:
        _drop(test_client, email)


def test_deleting_a_passwordless_account_asks_for_its_address(test_client: TestClient, mail):  # noqa: F811
    email = _address()
    try:
        _sign_up(test_client, mail, email)
        wrong = test_client.request("DELETE", "/api/v1/users/me", json={"email": "someone@frog.co"})
        assert wrong.status_code == 400
        right = test_client.request("DELETE", "/api/v1/users/me", json={"email": email.upper()})
        assert right.status_code == 200
        assert test_client.portal.call(lambda: User.objects.filter(email=email).exists()) is False
    finally:
        _drop(test_client, email)
