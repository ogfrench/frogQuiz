# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0


import os
import urllib.parse

import pyotp
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from frogquiz.auth import get_current_user, hash_session_key, verify_password
from frogquiz.config import settings
from frogquiz.db.models import User

router = APIRouter()

settings = settings()


async def totp_setup_enabled():
    """Gate for the endpoints that *turn TOTP on*.

    TOTP is cut from the MVP (see docs/mvp-scope.md), but the login flow still honours
    a secret that is already set, so anyone who enabled it before the cut keeps being
    asked for a code. Gating the whole router would leave them behind a factor they can
    no longer remove, which is a lockout we would have created ourselves. So only the
    setup endpoints are gated; reading the status and switching it off stay available
    whatever the flag says, and both already require the account password.
    """
    if not settings.enable_totp:
        raise HTTPException(status_code=404, detail="Not found")


class GetBackupCodeResponse(BaseModel):
    code: str


class RequirePasswordForAction(BaseModel):
    password: str


@router.post("/backup_code", response_model=GetBackupCodeResponse, dependencies=[Depends(totp_setup_enabled)])
async def get_backup_code(data: RequirePasswordForAction, user: User = Depends(get_current_user)):
    backup_code = os.urandom(32).hex()
    user = await User.objects.get(id=user.id)
    if not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid")
    # Only the hash is stored, matching remember-me session keys: the code is
    # only ever compared for equality, so it never needs to be read back.
    user.backup_code = hash_session_key(backup_code)
    await user.update()
    return GetBackupCodeResponse(code=backup_code)


class SetRequirePassword(BaseModel):
    require_password: bool
    password: str


@router.post("/require_password", response_model=SetRequirePassword, dependencies=[Depends(totp_setup_enabled)])
async def set_require_password(data: SetRequirePassword, user: User = Depends(get_current_user)):
    user = await User.objects.get(id=user.id)
    if not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid")
    user.require_password = data.require_password
    await user.update()
    return data


class SetTotpUpResponse(BaseModel):
    url: str
    secret: str


@router.post("/totp", response_model=SetTotpUpResponse, dependencies=[Depends(totp_setup_enabled)])
async def set_totp_up(data: RequirePasswordForAction, user: User = Depends(get_current_user)):
    user = await User.objects.get(id=user.id)
    if not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid")
    user.totp_secret = pyotp.random_base32()
    url = pyotp.totp.TOTP(user.totp_secret).provisioning_uri(
        name=urllib.parse.quote(user.username), issuer_name="frogQuiz"
    )
    await user.update()
    return SetTotpUpResponse(url=url, secret=user.totp_secret)


class GetTotpStatusResponse(BaseModel):
    activated: bool


@router.get("/totp", response_model=GetTotpStatusResponse)
async def get_totp_status(user: User = Depends(get_current_user)):
    user = await User.objects.get(id=user.id)
    if user.totp_secret is None:
        return GetTotpStatusResponse(activated=False)
    else:
        return GetTotpStatusResponse(activated=True)


@router.delete("/totp")
async def disable_totp(data: RequirePasswordForAction, user: User = Depends(get_current_user)):
    user = await User.objects.get(id=user.id)
    if not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid")
    user.totp_secret = None
    await user.update()
