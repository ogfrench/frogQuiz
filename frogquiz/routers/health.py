# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Whether the app is up, for an uptime monitor and the compose healthcheck (#60).

No auth and no data: one word per part. A game needs Postgres and Redis, so either one
down is a 503. Search and the worker can be down while games still run, so they make the
answer "degraded" and leave it a 200; a monitor that only reads the status code then
alerts on what stops a game, and the body says what else is wrong.
"""

import asyncio
import time

from aiohttp import ClientSession, ClientTimeout
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from frogquiz.config import WORKER_HEARTBEAT_KEY, redis, settings
from frogquiz.db import database

router = APIRouter()

CHECK_TIMEOUT_SECONDS = 3
# Neon's compute sleeps when idle and takes a few seconds to wake.
DATABASE_TIMEOUT_SECONDS = 10
# Production's database is Neon on the free plan: its compute sleeps after five idle minutes
# and every hour it is awake counts against the month. The compose healthcheck calls this
# every 30 seconds and an uptime monitor every few minutes, so querying each time would keep
# it awake around the clock. A passing check is reused for an hour instead; a failing one is
# re-run on every call, so a recovery shows at once.
DATABASE_CHECK_REUSE_SECONDS = 3600
# The worker beats once a minute; three missed beats is a worker that stopped.
WORKER_STALE_AFTER_SECONDS = 180

_database_ok_at: float | None = None


async def _passes(check, timeout: float = CHECK_TIMEOUT_SECONDS) -> bool:
    try:
        await asyncio.wait_for(check(), timeout)
        return True
    except Exception:  # noqa: BLE001 - any failure is "down", whatever raised it
        return False


async def _database_is_up() -> bool:
    global _database_ok_at
    if _database_ok_at is not None and time.monotonic() - _database_ok_at < DATABASE_CHECK_REUSE_SECONDS:
        return True
    up = await _passes(lambda: database.fetch_val("SELECT 1"), DATABASE_TIMEOUT_SECONDS)
    _database_ok_at = time.monotonic() if up else None
    return up


async def _search_is_up() -> None:
    # Meilisearch's own client is synchronous; its /health route is one cheap GET.
    timeout = ClientTimeout(total=CHECK_TIMEOUT_SECONDS)
    async with ClientSession(timeout=timeout) as session:
        async with session.get(f"{settings().meilisearch_url}/health") as response:
            response.raise_for_status()


async def _worker_beat_age() -> float | None:
    try:
        beat = await asyncio.wait_for(redis.get(WORKER_HEARTBEAT_KEY), CHECK_TIMEOUT_SECONDS)
        return max(0.0, time.time() - float(beat)) if beat else None
    except Exception:  # noqa: BLE001 - an unreadable beat is no beat
        return None


# HEAD too: uptime monitors such as UptimeRobot probe with it by default, and a 405 would
# read as down forever.
@router.api_route("", methods=["GET", "HEAD"])
async def health():
    database_up, redis_up, search_up = await asyncio.gather(
        _database_is_up(),
        _passes(redis.ping),
        _passes(_search_is_up),
    )
    age = await _worker_beat_age() if redis_up else None
    if age is None:
        worker = "down"
    else:
        worker = "ok" if age <= WORKER_STALE_AFTER_SECONDS else "stale"

    parts = {
        "database": "ok" if database_up else "down",
        "redis": "ok" if redis_up else "down",
        "search": "ok" if search_up else "down",
        "worker": worker,
    }
    if not (database_up and redis_up):
        status = "down"
    elif search_up and worker == "ok":
        status = "ok"
    else:
        status = "degraded"
    return JSONResponse(
        status_code=503 if status == "down" else 200,
        content={"status": status, **parts},
        headers={"Cache-Control": "no-store"},
    )
