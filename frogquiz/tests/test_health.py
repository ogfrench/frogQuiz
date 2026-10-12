# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""/api/v1/health says which part is down (#60).

Postgres or Redis down stops a game, so either one is a 503. Search or the worker down
leaves games running, so the answer is a 200 that says "degraded". The suite's stack has no
worker, so these tests write the heartbeat themselves.
"""

import time

import pytest
from redis import Redis

from frogquiz.config import WORKER_HEARTBEAT_KEY, settings
from frogquiz.routers import health as health_router
from frogquiz.tests import test_client  # noqa: F401

PATH = "/api/v1/health"


@pytest.fixture(autouse=True)
def fresh_database_check(monkeypatch):
    """Each test starts with no passing database check to reuse."""
    monkeypatch.setattr(health_router, "_database_ok_at", None)


@pytest.fixture
def beat():
    """Writes the worker's heartbeat as the given number of seconds old."""
    client = Redis.from_url(str(settings().redis))

    def write(age: float):
        client.set(WORKER_HEARTBEAT_KEY, str(time.time() - age))

    yield write
    client.delete(WORKER_HEARTBEAT_KEY)


class _Down:
    """Stands in for the database or Redis client: every call fails."""

    def __getattr__(self, _name):
        async def fail(*_args, **_kwargs):
            raise ConnectionError("down")

        return fail


def test_everything_up_is_ok(test_client, beat):  # noqa: F811
    beat(5)
    res = test_client.get(PATH)
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "ok", "redis": "ok", "search": "ok", "worker": "ok"}
    assert res.headers["cache-control"] == "no-store"


def test_a_worker_that_never_beat_is_down_but_games_still_run(test_client, beat):  # noqa: F811
    Redis.from_url(str(settings().redis)).delete(WORKER_HEARTBEAT_KEY)
    res = test_client.get(PATH)
    assert res.status_code == 200
    assert res.json()["status"] == "degraded"
    assert res.json()["worker"] == "down"


def test_a_stale_heartbeat_reads_as_stale(test_client, beat):  # noqa: F811
    beat(health_router.WORKER_STALE_AFTER_SECONDS + 60)
    res = test_client.get(PATH)
    assert res.status_code == 200
    assert res.json()["worker"] == "stale"
    assert res.json()["status"] == "degraded"


def test_search_down_is_degraded(test_client, beat, monkeypatch):  # noqa: F811
    beat(5)
    monkeypatch.setattr(settings(), "meilisearch_url", "http://127.0.0.1:9")
    res = test_client.get(PATH)
    assert res.status_code == 200
    assert res.json()["search"] == "down"
    assert res.json()["status"] == "degraded"


def test_redis_down_is_a_503(test_client, monkeypatch):  # noqa: F811
    monkeypatch.setattr(health_router, "redis", _Down())
    res = test_client.get(PATH)
    assert res.status_code == 503
    body = res.json()
    assert body["status"] == "down"
    assert body["redis"] == "down"
    # Without Redis there is no heartbeat to read, so the worker cannot be vouched for.
    assert body["worker"] == "down"


def test_the_database_down_is_a_503(test_client, beat, monkeypatch):  # noqa: F811
    beat(5)
    monkeypatch.setattr(health_router, "database", _Down())
    res = test_client.get(PATH)
    assert res.status_code == 503
    assert res.json()["database"] == "down"
    assert res.json()["redis"] == "ok"


def test_a_passing_database_check_is_reused_so_neon_can_sleep(test_client, beat, monkeypatch):  # noqa: F811
    beat(5)
    assert test_client.get(PATH).json()["database"] == "ok"
    # Within the hour the database is not asked again, so a sleeping Neon stays asleep.
    monkeypatch.setattr(health_router, "database", _Down())
    assert test_client.get(PATH).json()["database"] == "ok"
    # Once the hour is up it is asked again, and a failure shows.
    monkeypatch.setattr(health_router, "DATABASE_CHECK_REUSE_SECONDS", 0)
    assert test_client.get(PATH).status_code == 503
    # A failing check is not kept, so the next call asks again.
    assert health_router._database_ok_at is None


def test_it_needs_no_sign_in_and_says_nothing_else(test_client, beat):  # noqa: F811
    beat(5)
    res = test_client.get(PATH)
    assert res.status_code == 200
    assert set(res.json()) == {"status", "database", "redis", "search", "worker"}
