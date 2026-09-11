# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
#
# SPDX-License-Identifier: MPL-2.0


from frogquiz.db.models import User, UserSession
from fastapi import Response, Request, HTTPException
import os
import uuid
from frogquiz.config import settings, redis
from datetime import timedelta, datetime
from frogquiz.auth import create_access_token, hash_session_key

settings = settings()

# Deployments served over HTTPS must not leak auth cookies over plain HTTP.
COOKIE_SECURE = str(settings.root_address).startswith("https://")


async def log_user_in(user: User | None, request: Request, response: Response):
    if user is None:
        raise HTTPException(status_code=401, detail="User not matched!")
    remote_ip = None
    forwarded_for_header = request.headers.get("X-Forwarded-For")
    if forwarded_for_header is None:
        remote_ip = request.client.host

    else:
        if "," in forwarded_for_header:
            remote_ip = forwarded_for_header.split(", ")[0]
        else:
            remote_ip = forwarded_for_header
    session_key = os.urandom(32).hex()
    # Only the hash is stored: a database read must not hand over live sessions.
    user_session = UserSession(
        user=user,
        session_key=hash_session_key(session_key),
        ip_address=remote_ip,
        user_agent=request.headers.get("User-Agent"),
        id=uuid.uuid4(),
    )
    await user_session.save()
    # await user_session.save()
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(data={"sub": user.email}, expires_delta=access_token_expires)
    await redis.set(access_token, user.email, ex=settings.access_token_expire_minutes * 60)
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=settings.access_token_expire_minutes * 60,
    )
    response.set_cookie(
        key="rememberme_token",
        value=session_key,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=60 * 60 * 24 * 365,
    )
    return {"access_token": access_token, "token_type": "bearer"}


async def rememberme_check(rememberme_token: str, response: Response):
    user_session: UserSession | None = (
        await UserSession.objects.filter(session_key=hash_session_key(rememberme_token)).select_related(UserSession.user).get_or_none()
    )
    if (user_session is None) or (user_session.user is None):
        raise HTTPException(status_code=401, detail="No user session")
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(data={"sub": user_session.user.email}, expires_delta=access_token_expires)
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=settings.access_token_expire_minutes * 60,
    )
    response.set_cookie(key="expiry", value="", max_age=settings.access_token_expire_minutes * 60)
    response.status_code = 200
    await user_session.update(last_seen=datetime.now())
