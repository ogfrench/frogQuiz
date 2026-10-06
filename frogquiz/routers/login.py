# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0


import base64
import enum
import hmac
import json
import logging
import os
import secrets
import urllib.parse
import uuid
from datetime import datetime
from typing import Annotated

import asyncpg.exceptions
import bleach
import pyotp
from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, StringConstraints, ValidationError

from frogquiz.auth import hash_session_key, verify_password
from frogquiz.cache import clear_cache_for_account
from frogquiz.config import redis, settings
from frogquiz.emails import SIGN_IN_TTL_SECONDS, send_sign_in_email
from frogquiz.helpers.avatar import gzipped_user_avatar

from frogquiz.db.models import User, FidoCredentials
from webauthn import (
    generate_authentication_options,
    options_to_json,
    verify_authentication_response,
    base64url_to_bytes,
)
from webauthn.helpers.structs import (
    PublicKeyCredentialDescriptor,
    UserVerificationRequirement,
    AuthenticationCredential,
)

from frogquiz.oauth.authenticate_user import log_user_in
from frogquiz.helpers.ratelimit import enforce_resend_cooldown, rate_limit, rate_limit_key, release_resend_cooldown

settings = settings()
router = APIRouter()
LOGGER = logging.getLogger("frogquiz.login")


class StartLoginInput(BaseModel):
    email: str


class StartLoginResponseTypes(enum.Enum):
    PASSWORD = "PASSWORD"
    PASSKEY = "PASSKEY"
    TOTP = "TOTP"
    BACKUP = "BACKUP"


class LoginSession(BaseModel):
    user_id: str
    step_1: set[StartLoginResponseTypes]
    step_2: set[StartLoginResponseTypes]
    webauthn_challenge: str | None = None
    step1_success: bool = False


class StartLoginResponse(BaseModel):
    step_1: set[StartLoginResponseTypes]
    step_2: set[StartLoginResponseTypes]
    session_id: str
    webauthn_data: None | str = None


def verify_webauthn(data, fidocredentialss: list[FidoCredentials], login_session: LoginSession):
    try:
        credential = AuthenticationCredential.model_validate(data)
    except ValidationError:
        print("ValidationError")
        raise HTTPException(401)

    user_cred: FidoCredentials | None = None

    credential.id = base64url_to_bytes(credential.id)
    for cred in fidocredentialss:
        if cred.id == credential.id:
            user_cred = cred
            break
    if user_cred is None:
        print("user_cred not in DB")
        raise HTTPException(401)
    credential.id = base64.urlsafe_b64encode(credential.raw_id).decode("utf-8").replace("=", "")
    credential.response.client_data_json = credential.response.client_data_json
    credential.response.authenticator_data = credential.response.authenticator_data
    credential.response.signature = credential.response.signature
    try:
        verify_authentication_response(
            credential=credential,
            expected_challenge=base64.b64decode(login_session.webauthn_challenge),
            expected_rp_id=urllib.parse.urlparse(settings.root_address).hostname,
            expected_origin=settings.root_address,
            credential_public_key=user_cred.public_key,
            credential_current_sign_count=user_cred.sign_count,
            require_user_verification=False,
        )
        print("logging in...")
        return True
    except Exception as err:
        print(err)
        raise HTTPException(status_code=401)


@router.post("/start")
async def start_login(data: StartLoginInput, request: Request):
    # The password login's first step. Sign-in is by emailed link since 5 Oct (/email below).
    if not settings.enable_password_login:
        raise HTTPException(status_code=404, detail="Not found")
    # Without this, password guessing against /step is unthrottled. Sized for an office behind
    # one address (E16 in docs/edge-cases-2026-10.md); the per-account bucket below is the
    # one that stops guessing at a single account.
    await rate_limit(request, "login_start", limit=100, window_seconds=300)
    # The per-IP bucket above is advisory: with TRUSTED_PROXY_HOPS > 1 the address it
    # keys on comes from a header the caller can forge by reaching Caddy directly.
    # This one keys on what is being attacked instead, which cannot be forged.
    await rate_limit_key(f"login_start_addr:{data.email.strip().lower()}", limit=20, window_seconds=300)
    # Addresses are stored folded (create_user); the exact match is for rows from before
    # that rule. Matching only exactly refused "Ana@Frog.co" typed the way it was registered.
    folded = data.email.strip().lower()
    user = (
        await User.objects.select_related("fidocredentialss")
        .filter((User.email == folded) | (User.email == data.email) | (User.username == data.email))
        .get_or_none()
    )
    step_1: set[StartLoginResponseTypes] = set()
    step_2: set[StartLoginResponseTypes] = set()
    webauthn_data = None
    webauthn_challenge = None
    if user is None or not user.verified:
        step_1.add(StartLoginResponseTypes.PASSWORD)
        return StartLoginResponse(step_1=step_1, step_2=step_2, session_id=os.urandom(16).hex(), webauthn_data=None)
    if user.password is not None:
        step_1.add(StartLoginResponseTypes.PASSWORD)
    if len(user.fidocredentialss) > 0:
        if user.require_password is True:
            step_2.add(StartLoginResponseTypes.PASSKEY)
        else:
            step_1.add(StartLoginResponseTypes.PASSKEY)
        webauthn_data = generate_authentication_options(
            rp_id=urllib.parse.urlparse(settings.root_address).hostname,
            allow_credentials=[
                PublicKeyCredentialDescriptor(id=cred.id, type="public-key") for cred in user.fidocredentialss
            ],
            user_verification=UserVerificationRequirement.PREFERRED,
        )
        webauthn_challenge = base64.b64encode(webauthn_data.challenge).decode("utf-8")
        webauthn_data = options_to_json(webauthn_data)
    if user.totp_secret is not None:
        if user.require_password:
            step_2.add(StartLoginResponseTypes.TOTP)
        else:
            step_1.add(StartLoginResponseTypes.TOTP)
    login_session = LoginSession(
        step_1=step_1,
        step_2=step_2,
        user_id=user.id.hex,
        webauthn_challenge=webauthn_challenge,
    )
    session_id = os.urandom(16).hex()
    await redis.set(f"login_session:{session_id}", login_session.model_dump_json(), ex=600)
    return StartLoginResponse(step_1=step_1, step_2=step_2, session_id=session_id, webauthn_data=webauthn_data)


class StepInput(BaseModel):
    auth_type: StartLoginResponseTypes
    data: str | dict


@router.post("/step/{step_id}")
async def step_1_endpoint(session_id: str, data: StepInput, request: Request, response: Response, step_id: int):
    # Per address, sized for an office (E16); login_step_user below caps guesses per account.
    await rate_limit(request, "login_step", limit=50, window_seconds=300)
    if step_id < 0 or step_id > 2:
        raise HTTPException(status_code=401)
    redis_res = await redis.get(f"login_session:{session_id}")
    if redis_res is None:
        raise HTTPException(401, detail="wrong credentials")
    login_session = LoginSession.model_validate_json(redis_res)
    # Keyed on the account being guessed at, not the source address. A password
    # guesser who forges X-Forwarded-For gets a fresh per-IP bucket every request;
    # they do not get a fresh account.
    await rate_limit_key(f"login_step_user:{login_session.user_id}", limit=10, window_seconds=300)

    if step_id == 1:
        if data.auth_type not in {*login_session.step_1, StartLoginResponseTypes.BACKUP}:
            print("AUTH_TYPE not in data")
            raise HTTPException(401)
    elif step_id == 2:
        if data.auth_type not in login_session.step_2:
            print("AUTH_TYPE not in data")
            raise HTTPException(401)
    else:
        print("unknown step")
        raise HTTPException(401)
    user = await User.objects.select_related("fidocredentialss").get_or_none(id=uuid.UUID(login_session.user_id))
    if data.auth_type == StartLoginResponseTypes.PASSWORD:
        if not settings.enable_password_login or user.password is None:
            raise HTTPException(401, detail="wrong credentials")
        if verify_password(data.data, user.password):
            if len(login_session.step_2) == 0 or (step_id == 2 and login_session.step1_success is True):
                return await log_user_in(user, request, response)
            else:
                login_session.step1_success = True
                await redis.set(f"login_session:{session_id}", login_session.model_dump_json(), ex=600)
                return Response(status_code=202)
        else:
            print("Wrong Password")
            raise HTTPException(401, detail="wrong credentials")
    elif data.auth_type == StartLoginResponseTypes.PASSKEY:
        res = verify_webauthn(data=data.data, fidocredentialss=user.fidocredentialss, login_session=login_session)
        if res is True:
            if len(login_session.step_2) == 0 or (step_id == 2 and login_session.step1_success is True):
                return await log_user_in(user, request, response)
            else:
                login_session.step1_success = True
                await redis.set(f"login_session:{session_id}", login_session.model_dump_json(), ex=600)
                return Response(status_code=202)
        else:
            raise HTTPException(401, detail="webauthn failed")
    elif data.auth_type == StartLoginResponseTypes.BACKUP:
        if isinstance(data.data, str) and hmac.compare_digest(hash_session_key(data.data), user.backup_code):
            user.backup_code = hash_session_key(os.urandom(32).hex())
            await user.update()
            return await log_user_in(user, request, response)
        else:
            print("Wrong Backup-Code")
            raise HTTPException(status_code=401)
    elif data.auth_type == StartLoginResponseTypes.TOTP:
        if step_id == 1 and user.require_password:
            print("TOTP Cant be step 1")
            raise HTTPException(401)
        totp = pyotp.TOTP(user.totp_secret)
        if totp.verify(data.data):
            return await log_user_in(user, request, response)
        else:
            raise HTTPException(401, detail="totp wrong")


# Sign-in by an emailed link or six-digit code, for addresses on ALLOWED_EMAIL_DOMAINS, with
# no passwords: François's call on 5 Oct, modelled on frogViz's gate. The link stays good
# until it expires rather than working once, because Outlook's Safe Links opens it before
# the person does; frogViz made the same choice for the same reason.

# A code can be guessed, so it gets this many tries, and an address this many a day.
CODE_TRIES = 5
CODE_TRIES_PER_ADDRESS_PER_DAY = 10


def _safe_return_to(value: str | None) -> str | None:
    """A path on this site, or nothing. It is handed back to the page after sign-in."""
    if value and value.startswith("/") and not value.startswith("//") and "\\" not in value:
        return value
    return None


class EmailSignInInput(BaseModel):
    email: str
    return_to: str | None = None
    # Set by "Send a new code": the challenge the page already holds. The new email's code
    # is added to that sign-in instead of replacing it, so the code in a slow first email
    # still works once it arrives.
    challenge: str | None = None


# How many codes one sign-in keeps: the first and a few resends. Each code's tries come out
# of the same CODE_TRIES, so keeping more of them adds no guesses.
CODES_PER_SIGN_IN = 4


@router.post("/email")
async def email_sign_in(data: EmailSignInInput, request: Request):
    """Mail a sign-in link and code. The answer is the same whether the address has an account or not."""
    await rate_limit(request, "login_email", limit=100, window_seconds=300)
    try:
        email = validate_email(data.email.strip(), check_deliverability=False).normalized.lower()
    except EmailNotValidError:
        raise HTTPException(status_code=400, detail="That is not an email address")
    if not settings.email_domain_allowed(email):
        raise HTTPException(status_code=403, detail="That address is not on an allowed domain")
    if not settings.mail_configured:
        raise HTTPException(status_code=503, detail="This server has no mail server configured.")
    # A minute between emails to one address, before the hourly bucket below: three quick
    # clicks while the first email is still in transit used to spend most of the hour.
    await enforce_resend_cooldown(email, "sign_in")
    # Per recipient, so one inbox cannot be flooded from many source addresses.
    await rate_limit_key(f"login_email_addr:{email}", limit=5, window_seconds=3600)

    token = secrets.token_urlsafe(32)
    code = f"{secrets.randbelow(1_000_000):06d}"
    # Only hashes are stored, so a read of Redis hands over no working link or code.
    link_key = f"login_link:{hash_session_key(token)}"
    claim = {"email": email, "return_to": _safe_return_to(data.return_to)}

    # A resend for a sign-in that is still live, for this same address, joins it: the same
    # challenge, the new code's hash beside the earlier ones, and a fresh TTL. Anything
    # else (no challenge, an expired one, another address's) starts a sign-in of its own.
    challenge, codes, earlier = None, [], None
    if data.challenge:
        raw = await redis.get(f"login_code:{data.challenge}")
        if raw is not None:
            held = json.loads(raw)
            if held.get("email") == email:
                challenge, earlier = data.challenge, raw
                claim = {"email": email, "return_to": held.get("return_to")}
                codes = held.get("codes") or ([held["code"]] if "code" in held else [])
    if challenge is None:
        challenge = secrets.token_urlsafe(16)
    code_key = f"login_code:{challenge}"
    codes = [*codes, hash_session_key(code)][-CODES_PER_SIGN_IN:]

    await redis.set(link_key, json.dumps(claim), ex=SIGN_IN_TTL_SECONDS)
    await redis.set(code_key, json.dumps({**claim, "codes": codes}), ex=SIGN_IN_TTL_SECONDS)
    try:
        await send_sign_in_email(email, f"{settings.root_address}/account/login?token={token}", code)
    except Exception:
        LOGGER.exception("Could not send a sign-in email")
        await redis.delete(link_key)
        # A failed resend puts the sign-in back as it was rather than ending it: the
        # codes already sent still work, and only this one never went.
        if earlier is not None:
            await redis.set(code_key, earlier, ex=SIGN_IN_TTL_SECONDS)
        else:
            await redis.delete(code_key)
        # Nothing arrived, so there is nothing to wait for: the retry the message asks for
        # must not be refused by the cooldown this attempt started.
        await release_resend_cooldown(email, "sign_in")
        raise HTTPException(status_code=502, detail="Could not send the email. Try again in a minute.")
    return {"challenge": challenge}


class EmailVerifyInput(BaseModel):
    token: str | None = None
    challenge: str | None = None
    code: str | None = None


@router.post("/email/verify")
async def email_verify(data: EmailVerifyInput, request: Request, response: Response):
    """Sign in with the link's token, or with the challenge the page holds and the code from the email."""
    await rate_limit(request, "login_email_verify", limit=100, window_seconds=300)
    if data.token:
        raw = await redis.get(f"login_link:{hash_session_key(data.token)}")
        if raw is None:
            raise HTTPException(status_code=401, detail="This link has expired")
        claim = json.loads(raw)
    elif data.challenge and data.code:
        code_key = f"login_code:{data.challenge}"
        raw = await redis.get(code_key)
        if raw is None:
            raise HTTPException(status_code=401, detail="This code has expired")
        claim = json.loads(raw)
        tries = await redis.incr(f"{code_key}:tries")
        await redis.expire(f"{code_key}:tries", SIGN_IN_TTL_SECONDS)
        if tries > CODE_TRIES:
            await redis.delete(code_key)
            raise HTTPException(status_code=429, detail="Too many tries")
        await rate_limit_key(
            f"login_code_addr:{claim['email']}", limit=CODE_TRIES_PER_ADDRESS_PER_DAY, window_seconds=86400
        )
        # Every code sent for this sign-in, newest last; "code" is the single-code form
        # written before resends joined a sign-in. Compared in full, not stopping early.
        typed = hash_session_key(data.code.strip())
        sent = claim.get("codes") or [claim.get("code", "")]
        matched = False
        for hashed in sent:
            matched |= hmac.compare_digest(typed, hashed)
        if not matched:
            raise HTTPException(status_code=401, detail="Wrong code")
    else:
        raise HTTPException(status_code=400, detail="A token, or a challenge and a code")
    return await _finish_sign_in(claim["email"], claim.get("return_to"), request, response)


async def _finish_sign_in(email: str, return_to: str | None, request: Request, response: Response) -> dict:
    # Case-insensitive: addresses from before they were stored folded keep their account. Two
    # rows that differ only in case can predate that rule too; the folded one wins.
    matches = await User.objects.filter(User.email.iexact(email)).all()
    user = next((u for u in matches if u.email == email), matches[0] if matches else None)
    if user is None:
        if settings.registration_disabled:
            raise HTTPException(status_code=423, detail="Registration is closed")
        # A first sign-in: the page asks for a username, then /email/signup makes the account.
        signup = secrets.token_urlsafe(16)
        await redis.set(
            f"signup:{signup}", json.dumps({"email": email, "return_to": return_to}), ex=SIGN_IN_TTL_SECONDS
        )
        return {"signup": signup, "return_to": return_to}
    if not user.verified:
        # The link or code proves the mailbox, which is all verification ever asserted.
        user.verified = True
        user.verify_key = None
        await user.update()
        await clear_cache_for_account(user)
    if user.totp_secret is not None:
        # Somebody who turned on an authenticator before it was cut still has to use it.
        session_id = os.urandom(16).hex()
        login_session = LoginSession(
            user_id=user.id.hex, step_1=set(), step_2={StartLoginResponseTypes.TOTP}, step1_success=True
        )
        await redis.set(f"login_session:{session_id}", login_session.model_dump_json(), ex=600)
        response.status_code = 202
        return {"session_id": session_id, "step_2": ["TOTP"], "return_to": return_to}
    await log_user_in(user, request, response)
    return {"return_to": return_to}


class EmailSignupInput(BaseModel):
    signup: str
    # The register form's rule, as RouteUser has it (E17).
    username: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=20)]


@router.post("/email/signup")
async def email_signup(data: EmailSignupInput, request: Request, response: Response):
    """Make the account for a first sign-in, once the person has picked a username."""
    await rate_limit(request, "register", limit=50, window_seconds=3600)
    raw = await redis.get(f"signup:{data.signup}")
    if raw is None:
        raise HTTPException(status_code=401, detail="This sign-in has expired")
    claim = json.loads(raw)
    username = bleach.clean(data.username, tags=[], strip=True)
    if await User.objects.filter(User.username.iexact(username)).exists():
        raise HTTPException(status_code=409, detail="That username is taken")
    user = User(
        id=uuid.uuid4(),
        email=claim["email"],
        username=username,
        password=None,
        verified=True,
        avatar=gzipped_user_avatar(),
        created_at=datetime.now(),
    )
    try:
        await user.save()
    except asyncpg.exceptions.UniqueViolationError:
        # The username, or the same address finishing twice (a double click).
        raise HTTPException(status_code=409, detail="That username is taken")
    await redis.delete(f"signup:{data.signup}", "global_user_count")
    await log_user_in(user, request, response)
    return {"return_to": claim.get("return_to")}
