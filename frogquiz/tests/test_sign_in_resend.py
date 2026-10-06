# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

""""Send a new code" on the sign-in page, and the slow first email.

The first email is the slow one, which is why anyone presses "Send a new code". A resend
used to start a new sign-in, so the first email's code, arriving afterwards, was answered
"Wrong code" and spent the tries. These run the two endpoints against a fake Redis with
the mailer captured, so they hold without the database or a mail relay.
"""

import json

import pytest
from fastapi import HTTPException

import frogquiz.routers.login as login

# CI runs pytest with --asyncio-mode=strict, where an async test runs only if marked.
pytestmark = pytest.mark.asyncio


class _FakeRedis:
    def __init__(self):
        self.data, self.ttls = {}, {}

    async def set(self, key, value, ex=None):
        self.data[key] = value
        self.ttls[key] = ex

    async def get(self, key):
        return self.data.get(key)

    async def delete(self, *keys):
        for key in keys:
            self.data.pop(key, None)

    async def incr(self, key):
        self.data[key] = int(self.data.get(key, 0)) + 1
        return self.data[key]

    async def expire(self, key, seconds):
        self.ttls[key] = seconds

    async def ttl(self, key):
        return self.ttls.get(key, -1)


class _Request:
    headers = {}

    class client:
        host = "10.0.0.1"


@pytest.fixture
def env(monkeypatch):
    fake = _FakeRedis()
    sent = []

    async def send(email, link, code):
        sent.append({"to": email, "link": link, "code": code})

    async def finish(email, return_to, request, response):
        return {"signed_in": email, "return_to": return_to}

    monkeypatch.setattr(login, "redis", fake)
    monkeypatch.setattr("frogquiz.helpers.ratelimit.redis", fake)  # the cooldown's release
    monkeypatch.setattr(login, "send_sign_in_email", send)
    monkeypatch.setattr(login, "_finish_sign_in", finish)
    off = type("S", (), {"rate_limit_enabled": False, "trusted_proxy_hops": 1})()
    monkeypatch.setattr("frogquiz.helpers.ratelimit.settings", lambda: off)
    monkeypatch.setattr(type(login.settings), "mail_configured", property(lambda self: True))
    monkeypatch.setattr(type(login.settings), "email_domain_allowed", lambda self, email: True)
    return fake, sent


async def ask(email, challenge=None, return_to="/q"):
    data = login.EmailSignInInput(email=email, return_to=return_to, challenge=challenge)
    return (await login.email_sign_in(data, _Request()))["challenge"]


async def enter(challenge, code):
    return await login.email_verify(login.EmailVerifyInput(challenge=challenge, code=code), _Request(), None)


async def test_a_resend_joins_the_sign_in_it_came_from(env):
    _, sent = env
    first = await ask("someone@frog.co")
    again = await ask("someone@frog.co", challenge=first)
    assert again == first  # the same sign-in, not a new one
    assert [m["to"] for m in sent] == ["someone@frog.co", "someone@frog.co"]


async def test_the_slow_first_email_still_signs_in_after_a_resend(env):
    _, sent = env
    first = await ask("someone@frog.co")
    # The page holds whatever the resend hands back, and that is what the code is typed into.
    held = await ask("someone@frog.co", challenge=first)
    assert await enter(held, sent[0]["code"]) == {"signed_in": "someone@frog.co", "return_to": "/q"}


async def test_so_does_the_newest_one(env):
    _, sent = env
    first = await ask("someone@frog.co")
    held = await ask("someone@frog.co", challenge=first)
    assert (await enter(held, sent[1]["code"]))["signed_in"] == "someone@frog.co"


async def test_a_code_from_nowhere_is_still_wrong(env):
    _, sent = env
    first = await ask("someone@frog.co")
    held = await ask("someone@frog.co", challenge=first)
    wrong = next(c for c in (f"{n:06d}" for n in range(10)) if c not in {m["code"] for m in sent})
    with pytest.raises(HTTPException) as refused:
        await enter(held, wrong)
    assert refused.value.status_code == 401


async def test_another_address_cannot_join_someone_elses_sign_in(env):
    fake, sent = env
    first = await ask("someone@frog.co")
    other = await ask("intruder@frog.co", challenge=first)
    assert other != first
    held = json.loads(fake.data[f"login_code:{first}"])
    assert len(held["codes"]) == 1  # nothing was added to the first sign-in


async def test_an_expired_challenge_starts_a_fresh_sign_in(env):
    fake, _ = env
    first = await ask("someone@frog.co")
    fake.data.pop(f"login_code:{first}")
    assert await ask("someone@frog.co", challenge=first) != first


async def test_a_sign_in_keeps_a_bounded_number_of_codes(env):
    fake, sent = env
    held = await ask("someone@frog.co")
    for _ in range(login.CODES_PER_SIGN_IN + 2):
        held = await ask("someone@frog.co", challenge=held)
    stored = json.loads(fake.data[f"login_code:{held}"])
    assert len(stored["codes"]) == login.CODES_PER_SIGN_IN
    with pytest.raises(HTTPException):
        await enter(held, sent[0]["code"])  # the oldest has been let go
    assert (await enter(held, sent[-1]["code"]))["signed_in"] == "someone@frog.co"


async def test_a_failed_resend_leaves_the_sign_in_as_it_was(env, monkeypatch):
    fake, sent = env
    first = await ask("someone@frog.co")

    async def broken(email, link, code):
        raise OSError("relay down")

    monkeypatch.setattr(login, "send_sign_in_email", broken)
    with pytest.raises(HTTPException) as failed:
        await ask("someone@frog.co", challenge=first)
    assert failed.value.status_code == 502
    assert (await enter(first, sent[0]["code"]))["signed_in"] == "someone@frog.co"


async def test_a_sign_in_stored_before_this_change_still_takes_its_code(env):
    fake, _ = env
    fake.data["login_code:legacy"] = json.dumps(
        {"email": "someone@frog.co", "return_to": None, "code": login.hash_session_key("123456")}
    )
    assert (await enter("legacy", "123456"))["signed_in"] == "someone@frog.co"
