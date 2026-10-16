# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

import hashlib
import hmac
import secrets
import uuid
from datetime import timedelta
from typing import Dict
from typing import Optional
from typing import Union

from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request
from fastapi import status
from fastapi.openapi.models import OAuthFlows as OAuthFlowsModel
from fastapi.security import OAuth2
from fastapi.security.utils import get_authorization_scheme_param
from jose import JWTError, jwt
from passlib.hash import argon2

from frogquiz.cache import get_cache
from frogquiz.config import settings, redis
from datetime import datetime
from frogquiz.db.models import User, TokenData, ApiKey

settings = settings()

pwd_context = argon2
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes


class OAuth2PasswordBearerWithCookie(OAuth2):
    def __init__(
        self,
        tokenUrl: str,
        scheme_name: Optional[str] = None,
        scopes: Optional[Dict[str, str]] = None,
        auto_error: bool = True,
    ):
        if not scopes:
            scopes = {}
        flows = OAuthFlowsModel(password={"tokenUrl": tokenUrl, "scopes": scopes})
        super().__init__(flows=flows, scheme_name=scheme_name, auto_error=auto_error)

    async def __call__(self, request: Request) -> Optional[str]:
        try:
            authorization = request.state.access_token
        except AttributeError:
            authorization: str = request.cookies.get(
                "access_token"
            )  # changed to accept access token from httpOnly Cookie
        scheme, param = get_authorization_scheme_param(authorization)
        if not authorization or scheme.lower() != "bearer":
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            else:
                return None
        return param


oauth2_scheme = OAuth2PasswordBearerWithCookie(tokenUrl="/api/v1/users/token/cookie")
# Same scheme, but doesn't 401 on its own when no cookie/header is present at
# all -- get_current_user_optional needs to actually reach its body and
# return None for a fully anonymous caller, not have the dependency itself
# raise first.
oauth2_scheme_optional = OAuth2PasswordBearerWithCookie(tokenUrl="/api/v1/users/token/cookie", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


async def get_user_from_mail(email: str) -> Union[User, None]:
    return await get_cache(criteria="email", content=email)


async def get_user_from_username(username: str) -> Union[User, None]:
    return await get_cache(criteria="username", content=username)


async def get_user_from_id(id: str) -> Union[User, None]:
    return await get_cache(criteria="id", content=id)


async def authenticate_user(email: str, password: str) -> Union[User, bool]:
    user = await get_user_from_mail(email)
    if not user:
        return False
    if not verify_password(password, user.password):
        return False
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    # jti makes every token unique. Without it a token was {sub, exp} with exp in whole
    # seconds, so two logins by one user in the same second got the identical string,
    # and the denylist is keyed on that string: logging out on one device revoked a
    # session another device had just been given, and logging straight back in after
    # logging out handed you a token that was already revoked.
    to_encode.update({"exp": expire, "jti": uuid.uuid4().hex})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)
    return encoded_jwt


def hash_anon_secret(secret: str) -> str:
    """Hash the ownership secret for a quiz created without an account.

    Only this hash is ever persisted; the raw secret lives in the creator's
    browser and is returned exactly once, at creation.
    """
    return hashlib.sha256(secret.encode()).hexdigest()


def require_anonymous_quizzes() -> None:
    """401 unless quizzes may be made, edited and hosted without an account (#55).

    Called on the write paths only. Reading a quiz with its secret, deleting it and claiming
    it into an account keep working whatever the setting, so nothing made while it was on
    is stranded.
    """
    if not settings.anonymous_quizzes_enabled:
        raise HTTPException(
            status_code=401, detail="Sign in to make, edit or host a quiz. Players join with the game PIN."
        )


def verify_anon_secret(secret: str | None, expected_hash: str | None) -> bool:
    """Constant-time check of a caller-supplied secret against a stored hash.

    Both a missing secret and a quiz with none set return False rather than
    raising, so callers can use this directly in an `if` without needing to
    special-case "no secret was ever issued".
    """
    if not secret or not expected_hash:
        return False
    return hmac.compare_digest(hash_anon_secret(secret), expected_hash)


def hash_session_key(session_key: str) -> str:
    """Hash a remember-me session key for storage.

    The key is 32 random bytes, so a fast hash is enough here -- this protects
    against a database read handing over live sessions, not against guessing.
    """
    return hashlib.sha256(session_key.encode()).hexdigest()


def _revocation_key(token: str) -> str:
    # Keyed by hash so live tokens are not themselves stored as Redis keys.
    return f"revoked_token:{hashlib.sha256(token.encode()).hexdigest()}"


async def revoke_token(token: str) -> None:
    """Deny a token for whatever remains of its lifetime.

    A denylist rather than an allowlist: tokens stay valid by default, so no
    issuing path has to remember to register them, and the entry expires with
    the token itself rather than accumulating.
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM], options={"verify_exp": False})
    except JWTError:
        return
    expires_at = payload.get("exp")
    if expires_at is None:
        return
    remaining = int(expires_at - datetime.utcnow().timestamp())
    if remaining > 0:
        await redis.set(_revocation_key(token), "1", ex=remaining)


async def token_is_revoked(token: str) -> bool:
    """True once the token has been explicitly revoked, e.g. by logging out."""
    return await redis.get(_revocation_key(token)) is not None


def _revoked_session_key(session_id) -> str:
    return f"revoked_session:{session_id}"


async def revoke_sessions(session_ids) -> None:
    """Deny every access token minted from these sessions.

    Deleting a session only removed its refresh record. The access token a device
    already held is a JWT, so after "delete this session", "sign out everywhere" or a
    password change it went on working until it expired, up to 30 minutes later. Tokens
    carry their session id (`sid`) now, and a session marked here is refused for as long
    as any token minted from it can live.
    """
    ttl = ACCESS_TOKEN_EXPIRE_MINUTES * 60 + 60
    for session_id in session_ids:
        await redis.set(_revoked_session_key(session_id), "1", ex=ttl)


async def _is_revoked(token: str, payload: dict) -> bool:
    if await token_is_revoked(token):
        return True
    session_id = payload.get("sid")
    return session_id is not None and await redis.get(_revoked_session_key(session_id)) is not None


credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    if await _is_revoked(token, payload):
        raise credentials_exception
    user = await get_user_from_mail(email=token_data.email)
    if user is None:
        raise credentials_exception
    return user


async def get_current_moderator(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    if await _is_revoked(token, payload):
        raise credentials_exception
    user = await get_user_from_mail(email=token_data.email)
    if user is None:
        raise credentials_exception
    if user.username not in settings.mods:
        raise credentials_exception
    return user


async def get_admin_user(token: str = Depends(oauth2_scheme)) -> User:
    user = await get_current_user(token)
    # Was "the account with the oldest created_at", which meant deleting the admin
    # account quietly promoted whoever registered next -- with no record that it had
    # happened and no way to hand the role over deliberately. Migration b5e91c7a2d38
    # set the flag on whichever account that rule was pointing at, so nothing changed
    # hands when it shipped.
    if user.is_admin:
        return user
    raise credentials_exception


async def get_current_user_optional(token: str | None = Depends(oauth2_scheme_optional)) -> User | None:
    if token is None:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
        token_data = TokenData(email=email)
    except JWTError:
        return None
    if await _is_revoked(token, payload):
        return None
    user = await get_user_from_mail(email=token_data.email)
    if user is None:
        return None
    return user


async def check_token(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    if await _is_revoked(token, payload):
        raise credentials_exception
    return token_data.email


# What a key made today starts with. It lets a secret scanner (.gitleaks.toml, GitHub's)
# recognise one pasted into a repository, and lets the agent API refuse anything else
# before it touches Redis or the database. Keys made before 15 Oct are 48 hex characters
# with no prefix; they still work on /live, never on /agent.
API_KEY_PREFIX = "fq_"
# Longer than any key ever issued. A caller's string is hashed, so this only bounds the
# work an absurd header can cause.
MAX_API_KEY_LENGTH = 128


def new_api_key() -> str:
    """A fresh key: the prefix and 32 random bytes, 46 characters in all."""
    return API_KEY_PREFIX + secrets.token_urlsafe(32)


def hash_api_key(key: str) -> str:
    """The form a key is stored and cached in.

    A fast hash is enough for the same reason as hash_session_key: the key is 32 random
    bytes, so this protects against a database or Redis read handing over working keys,
    not against guessing. The migration that hashed the old keys (a7c3e5f1b9d2) does the
    same sha256 in SQL, so the two must not drift.
    """
    return hashlib.sha256(key.encode()).hexdigest()


def api_key_cache_key(key_hash: str) -> str:
    # By hash, so a key is never itself a Redis key name.
    return f"apikey:{key_hash}"


API_KEY_CACHE_SECONDS = 3600
_REVOKED = "revoked"


async def forget_api_key(key_hash: str) -> None:
    """Called once a key's row is deleted. Writes a marker rather than deleting the cache
    entry: a check that read the row just before the delete would otherwise cache the owner
    again a moment later, and the revoked key would work for another hour."""
    await redis.set(api_key_cache_key(key_hash), _REVOKED, ex=API_KEY_CACHE_SECONDS)


async def check_api_key(key: str | None) -> uuid.UUID | None:
    """The owner of a key, or None. A revoked key stops working on the next request, not
    when its cache entry runs out (forget_api_key)."""
    if not key or len(key) > MAX_API_KEY_LENGTH:
        return None
    key_hash = hash_api_key(key)
    cached = await redis.get(api_key_cache_key(key_hash))
    if cached == _REVOKED:
        return None
    if cached is not None:
        return uuid.UUID(cached)
    row = await ApiKey.objects.get_or_none(key_hash=key_hash)
    if row is None or row.user is None:
        return None
    # nx: never over a revocation marker written since the row was read.
    await redis.set(api_key_cache_key(key_hash), row.user.id.hex, ex=API_KEY_CACHE_SECONDS, nx=True)
    return row.user.id


agent_credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="A frogQuiz agent key is required. Make one under My Account, AI agents.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_agent_user(request: Request) -> User:
    """The account behind `Authorization: Bearer fq_...`, for the agent API only.

    Reads that header and nothing else: never the session cookie, so a browser cannot be
    walked into an agent call, and never a query string, where a key ends up in access
    logs. The reverse holds too: the session routes read only the cookie, so a key sent
    to them is not a login. Every failure is the same 401, so it does not say whether a
    key exists, was revoked, or belongs to an account that is gone.
    """
    scheme, key = get_authorization_scheme_param(request.headers.get("Authorization"))
    if scheme.lower() != "bearer" or not key.startswith(API_KEY_PREFIX):
        raise agent_credentials_exception
    user_id = await check_api_key(key)
    if user_id is None:
        raise agent_credentials_exception
    user = await get_user_from_id(str(user_id))
    if user is None:
        raise agent_credentials_exception
    key_hash = hash_api_key(key)
    # At most one write a minute per key: an agent making a quiz calls several times.
    if await redis.set(f"apikey_used:{key_hash}", "1", ex=60, nx=True):
        await ApiKey.objects.filter(key_hash=key_hash).update(last_used_at=datetime.now())
    return user
