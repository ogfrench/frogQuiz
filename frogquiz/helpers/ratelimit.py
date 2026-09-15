# SPDX-FileCopyrightText: 2026 frogQuiz contributors
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

    Each proxy appends what it saw to X-Forwarded-For rather than replacing it, so
    the rightmost entry is the one the nearest proxy added and everything to its
    left is only as trustworthy as the hop that wrote it. With one proxy in front
    of the app (Caddy, per Caddyfile-docker) the last entry is the client. With two
    -- a CDN or Netlify in front of Caddy -- the last entry is the CDN's egress
    address, identical for every user, so an IP bucket becomes one shared bucket
    for the whole user base. TRUSTED_PROXY_HOPS says how many hops to step back.

    Raising it past the number of proxies that actually front the app makes the
    chosen entry caller-supplied and the limiter forgeable, so it is only safe when
    the app cannot be reached except through those proxies. Good enough for rate
    limiting either way; never good enough for identity.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        chain = [part.strip() for part in forwarded.split(",") if part.strip()]
        if chain:
            hops = max(settings().trusted_proxy_hops, 1)
            return chain[-min(hops, len(chain))]
    return request.client.host if request.client else "unknown"


async def rate_limit_key(bucket_key: str, limit: int, window_seconds: int) -> None:
    """Raise 429 once `limit` attempts against `bucket_key` occur inside the window.

    Separate from rate_limit() because not everything worth limiting is keyed on the
    caller's address. The mail endpoints also limit per recipient: behind a proxy
    that presents one source IP for every user -- which is what a Netlify-style
    split deployment does -- an IP bucket is shared by the whole user base, and a
    limit of five an hour then locks everyone out at once.
    """
    if not settings().rate_limit_enabled:
        return
    key = f"ratelimit:{bucket_key}"
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


async def rate_limit(request: Request, bucket: str, limit: int, window_seconds: int) -> None:
    """Raise 429 once `limit` attempts from one address occur inside the window."""
    await rate_limit_key(f"{bucket}:{client_ip(request)}", limit=limit, window_seconds=window_seconds)
