# SPDX-FileCopyrightText: 2026 FrogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""A small fixed-window rate limiter backed by Redis.

Redis is already a hard dependency, so this avoids pulling in a limiter library
for the handful of endpoints that need one. Fixed-window is coarse but it is the
right shape here: the goal is to stop unthrottled password guessing, not to meter
traffic precisely.
"""

from fastapi import HTTPException, Request

from frogquiz.config import redis, settings


def client_ip(request: Request) -> str:
    """Best-effort client address.

    X-Forwarded-For is attacker-controlled unless a trusted proxy overwrites it,
    so this is good enough for rate limiting but must not be treated as identity.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def rate_limit(request: Request, bucket: str, limit: int, window_seconds: int) -> None:
    """Raise 429 once `limit` attempts from one address occur inside the window."""
    if not settings().rate_limit_enabled:
        return
    key = f"ratelimit:{bucket}:{client_ip(request)}"
    hits = await redis.incr(key)
    if hits == 1:
        await redis.expire(key, window_seconds)
    if hits > limit:
        ttl = await redis.ttl(key)
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Try again shortly.",
            headers={"Retry-After": str(max(ttl, 1))},
        )
