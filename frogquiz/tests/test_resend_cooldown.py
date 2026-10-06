# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The minute between two emails to one address.

Kept apart from test_ratelimit.py, which needs the full stack: these run against a fake
Redis, so they hold anywhere and in a second.
"""

import pytest


class _FakeRedis:
    """Just enough of Redis for a fixed-window counter: incr, expire, ttl."""

    def __init__(self):
        self.counts, self.ttls = {}, {}

    async def incr(self, key):
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    async def expire(self, key, seconds):
        self.ttls[key] = seconds

    async def ttl(self, key):
        return self.ttls.get(key, -1)


@pytest.fixture
def fake_redis(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr("frogquiz.helpers.ratelimit.redis", fake)
    monkeypatch.setattr(
        "frogquiz.helpers.ratelimit.settings",
        lambda: type("S", (), {"rate_limit_enabled": True, "trusted_proxy_hops": 1})(),
    )
    return fake


async def test_resend_cooldown_lets_the_first_ask_through(fake_redis):
    from frogquiz.helpers.ratelimit import enforce_resend_cooldown

    await enforce_resend_cooldown("someone@frog.co")


async def test_resend_cooldown_refuses_a_second_ask_and_says_how_long(fake_redis):
    from fastapi import HTTPException

    from frogquiz.helpers.ratelimit import RESEND_COOLDOWN_SECONDS, enforce_resend_cooldown

    await enforce_resend_cooldown("someone@frog.co")
    with pytest.raises(HTTPException) as refused:
        await enforce_resend_cooldown("someone@frog.co")
    assert refused.value.status_code == 429
    # Short enough that the page can show it as a countdown, which is how it tells
    # this refusal apart from the hourly limit's.
    assert 1 <= int(refused.value.headers["Retry-After"]) <= RESEND_COOLDOWN_SECONDS


async def test_resend_cooldown_is_per_address_and_ignores_case_and_padding(fake_redis):
    from fastapi import HTTPException

    from frogquiz.helpers.ratelimit import enforce_resend_cooldown

    await enforce_resend_cooldown("someone@frog.co")
    await enforce_resend_cooldown("somebody.else@frog.co")  # a different mailbox is not held back
    with pytest.raises(HTTPException):
        await enforce_resend_cooldown("  Someone@FROG.co ")  # the same mailbox, however typed


async def test_resend_cooldown_is_a_minute_not_an_hour(fake_redis):
    from frogquiz.helpers.ratelimit import enforce_resend_cooldown

    await enforce_resend_cooldown("someone@frog.co")
    assert list(fake_redis.ttls.values()) == [60]


async def test_resend_cooldown_respects_the_switch_that_turns_limits_off(monkeypatch, fake_redis):
    from frogquiz.helpers.ratelimit import enforce_resend_cooldown

    monkeypatch.setattr(
        "frogquiz.helpers.ratelimit.settings",
        lambda: type("S", (), {"rate_limit_enabled": False, "trusted_proxy_hops": 1})(),
    )
    await enforce_resend_cooldown("someone@frog.co")
    await enforce_resend_cooldown("someone@frog.co")


async def test_sign_in_and_confirmation_mail_keep_separate_clocks(fake_redis):
    from frogquiz.helpers.ratelimit import enforce_resend_cooldown

    await enforce_resend_cooldown("someone@frog.co", "sign_in")
    # A confirmation email right after a sign-in email is a different ask, not a repeat.
    await enforce_resend_cooldown("someone@frog.co", "verification")


async def test_a_failed_send_does_not_make_the_person_wait(fake_redis):
    from frogquiz.helpers.ratelimit import enforce_resend_cooldown, release_resend_cooldown

    deleted = []

    async def delete(*keys):
        deleted.extend(keys)
        for key in keys:
            fake_redis.counts.pop(key, None)

    fake_redis.delete = delete
    await enforce_resend_cooldown("someone@frog.co", "sign_in")
    await release_resend_cooldown("Someone@frog.co ", "sign_in")
    # Released under the very key the cooldown wrote, however the address was typed.
    assert deleted == ["ratelimit:resend_cooldown:sign_in:someone@frog.co"]
    await enforce_resend_cooldown("someone@frog.co", "sign_in")  # the retry goes through
