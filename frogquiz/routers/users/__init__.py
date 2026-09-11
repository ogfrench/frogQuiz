# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
#
# SPDX-License-Identifier: MPL-2.0


import gzip
import os
from datetime import datetime

import ormar
import pydantic
from email_validator import validate_email, EmailNotValidError
from fastapi import APIRouter, Response, HTTPException, Request, Depends
from fastapi.background import BackgroundTasks
from fastapi.responses import JSONResponse, RedirectResponse, PlainTextResponse


from frogquiz import oauth
from frogquiz.helpers.avatar import gzipped_user_avatar
import base64

from frogquiz.auth import (
    get_password_hash,
    hash_session_key,
    revoke_token,
    verify_password,
    get_current_user,
)
from frogquiz.cache import clear_cache_for_account
from frogquiz.config import redis, settings, meilisearch
from frogquiz.helpers.ratelimit import rate_limit
import uuid
import bleach
from pydantic import BaseModel
from frogquiz.db.models import User, UserSession, UpdatePassword, Quiz, ApiKey
from frogquiz.emails import send_register_email, send_forgotten_password_email
from frogquiz.routers.users import webauthn, twofa

settings = settings()
router = APIRouter()

router.include_router(webauthn.router, prefix="/webauthn")
router.include_router(twofa.router, prefix="/2fa")


class RouteUser(pydantic.BaseModel):
    username: str
    # Mirrors the rule the register form enforces; without it the API accepted
    # a one-character password.
    password: str = pydantic.Field(min_length=8, max_length=100)
    email: str


async def _sign_out_everywhere(user: User) -> None:
    await UserSession.objects.filter(user=user).delete()
    await clear_cache_for_account(user)


router.include_router(oauth.router, tags=["users", "oauth"], prefix="/oauth")


@router.post(
    "/create",
    response_model=User,
    response_model_include={"id": ..., "verified": ..., "email": ...},
)
async def create_user(user: RouteUser, request: Request) -> User | JSONResponse:
    await rate_limit(request, "register", limit=10, window_seconds=3600)
    if settings.registration_disabled:
        raise HTTPException(status_code=423)
    user: User = User(
        **user.model_dump(),
        id=uuid.uuid4(),
        avatar=gzipped_user_avatar(),
        created_at=datetime.now(),
    )
    try:
        # Deliverability is a live DNS/MX lookup, so it needs outbound DNS at signup
        # and rejects internal-only mail domains. On by default; see the setting.
        validate_email(user.email, check_deliverability=settings.validate_email_deliverability)
    except EmailNotValidError as e:
        raise HTTPException(status_code=400, detail=str(e))
    user.verify_key = str(os.urandom(16).hex())
    res = await User.objects.filter((User.email == user.email) | (User.username == user.username)).all()
    if len(res) != 0:
        raise HTTPException(status_code=409, detail="User already exists")

    user.password = get_password_hash(user.password)
    user.username = bleach.clean(user.username, tags=[], strip=True)
    if len(user.username) == 32:
        return JSONResponse({"details": "Username mustn't be 32 characters long"}, 400)
    await user.save()
    if settings.skip_email_verification:
        user.verify_key = None
        user.verified = True
        await user.update()
    else:
        await send_register_email(user)
    await redis.delete("global_user_count")
    return user


@router.get("/logout")
async def logout(request: Request, response: Response):
    remember_token = request.cookies.get("rememberme_token")
    if remember_token is not None:
        await UserSession.objects.filter(session_key=hash_session_key(remember_token)).delete()
    # Clearing the cookie only affects this browser; dropping the Redis entry is
    # what actually ends the session for a token that has already been copied.
    access_token = request.cookies.get("access_token")
    if access_token is not None:
        await revoke_token(access_token.removeprefix("Bearer "))
    response.delete_cookie("access_token")
    response.delete_cookie("expiry")
    response.delete_cookie("rememberme")
    response.delete_cookie("rememberme_token")
    response.status_code = 302
    response.headers["Location"] = "/"
    return response


@router.get("/check")
async def check_token(user: User = Depends(get_current_user)):
    return {"email": user.email}


@router.get("/verify/{verify_key}")
async def verify_user(verify_key: str):
    user = await User.objects.filter(verify_key=verify_key).get_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.verified = True
    user.verify_key = None
    await user.update()
    return RedirectResponse(url="/account/login?verified=true")


@router.put("/password/update")
async def change_password(
    password_data: UpdatePassword,
    response: Response,
    user: User = Depends(get_current_user),
):
    if not verify_password(password_data.old_password, user.password):
        raise HTTPException(status_code=400, detail="Incorrect password")
    user.password = get_password_hash(password_data.new_password)
    await user.update()
    await clear_cache_for_account(user)
    await UserSession.objects.filter(user=user).delete()
    response.delete_cookie("access_token")
    response.delete_cookie("expiry")
    response.delete_cookie("rememberme")
    response.delete_cookie("rememberme_token")
    return {"message": "Password updated successfully"}


@router.delete("/signout-everywhere")
async def signout_everywhere(response: Response, user: User = Depends(get_current_user)):
    await _sign_out_everywhere(user)
    response.delete_cookie("access_token")
    response.delete_cookie("expiry")
    response.delete_cookie("rememberme")
    response.delete_cookie("rememberme_token")
    return {"message": "Signout everywhere"}


@router.get(
    "/me",
    response_model_exclude={
        "password",
        "verify_key",
        "usersessions",
        "avatar",
        "quizs",
        "fidocredentialss",
        "backup_code",
        "apikeys",
        "totp_secret",
    },
    response_model=User,
)
async def get_me(user: User = Depends(get_current_user)):
    return user


class ForgotPassword(BaseModel):
    email: str


@router.post("/forgot-password")
async def forgotten_password(forgot_password: ForgotPassword):
    user = await User.objects.filter(email=forgot_password.email, verified=True).get_or_none()
    if user is not None:
        await send_forgotten_password_email(email=user.email)
    return {"message": "Password reset email sent"}


class ResetPassword(BaseModel):
    password: str
    token: str


@router.post("/reset-password")
async def reset_password_with_token(reset_password: ResetPassword, response: Response):
    redis_res = await redis.get(f"reset_passwd:{reset_password.token}")
    if redis_res is None:
        raise HTTPException(status_code=400, detail="Invalid token")
    user = await User.objects.filter(id=uuid.UUID(redis_res)).get_or_none()
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid token")
    user.password = get_password_hash(reset_password.password)
    await user.update()
    await _sign_out_everywhere(user)
    response.delete_cookie("access_token")
    response.delete_cookie("expiry")
    response.delete_cookie("rememberme")
    response.delete_cookie("rememberme_token")
    return {"message": "Password updated successfully"}


@router.get(
    "/sessions/list",
    response_model=list[UserSession],
    response_model_exclude={"user", "session_key", "quizs"},
)
async def list_sessions(user: User = Depends(get_current_user)):
    sessions = await UserSession.objects.filter(user=user).all()
    return [session.model_dump() for session in sessions]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: uuid.UUID, user: User = Depends(get_current_user)):
    await UserSession.objects.filter(user=user, id=session_id).delete()
    return {"message": "Session deleted"}


@router.get(
    "/session",
    response_model=UserSession,
    response_model_exclude={"user": ..., "session_key": ..., "quizs": ...},
)
async def get_session(request: Request, user: User = Depends(get_current_user)):
    try:
        session = await UserSession.objects.filter(
            user=user, session_key=hash_session_key(request.cookies.get("rememberme_token") or "")
        ).first()
        return session
    except ormar.NoMatch:
        raise HTTPException(status_code=404, detail="Session not found")


class DeleteUserInput(BaseModel):
    password: str


@router.delete("/me")
async def delete_user_account(input_data: DeleteUserInput, user: User = Depends(get_current_user)):
    if not verify_password(input_data.password, user.password):
        raise HTTPException(status_code=400, detail="Incorrect password")
    user = await User.objects.filter(id=user.id).get_or_none()
    await UserSession.objects.filter(user=user).delete()
    quizzes = await Quiz.objects.filter(user_id=user).all()
    quizzes_to_delete = []
    for quiz in quizzes:
        if quiz.public:
            quizzes_to_delete.append(str(quiz.id))
    if len(quizzes_to_delete) > 0:
        meilisearch.index(settings.meilisearch_index).delete_documents(quizzes_to_delete)
    await Quiz.objects.filter(user_id=user).delete()
    await User.objects.filter(id=user.id).delete()
    await user.delete()


@router.get("/avatar", response_class=PlainTextResponse)
async def get_own_avatar(respo: Response, user: User = Depends(get_current_user)):
    respo.headers.append("Content-Type", "image/svg+xml")
    return gzip.decompress(base64.b64decode(user.avatar))


@router.get("/avatar/{user_id}", response_class=PlainTextResponse)
async def get_other_avatar(respo: Response, user_id: uuid.UUID):
    user = await User.objects.filter(id=user_id).get_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    respo.headers.append("Content-Type", "image/svg+xml")
    return gzip.decompress(base64.b64decode(user.avatar))


class InternalAuthData(BaseModel):
    rememberme: str
    jwt: str | None = None


class GetEmailFromJWT(BaseModel):
    jwt: str


@router.post("/api_keys", response_model=ApiKey, response_model_include={"key"})
async def generate_api_key(user: User = Depends(get_current_user)):
    key = ApiKey(key=os.urandom(24).hex(), user=user)
    await key.save()
    return key.model_dump(include={"key"})


@router.get("/api_keys", response_model=list[ApiKey], response_model_include={"key"})
async def list_api_keys(user: User = Depends(get_current_user)):
    keys = await ApiKey.objects.filter(user=user).all()
    return keys


@router.delete("/api_keys")
async def delete_api_key(api_key: str, _: User = Depends(get_current_user)):
    key = await ApiKey.objects.get_or_none(key=api_key)
    if key is None:
        raise HTTPException(status_code=404, detail="Key not found")
    await redis.delete(f"apikey:{key.key}")
    await key.delete()
