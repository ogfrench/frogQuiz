# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0


from uuid import UUID

from fastapi import APIRouter, Depends

from frogquiz.auth import get_admin_user
from frogquiz.db.models import User
from frogquiz.routers.users import delete_account

router = APIRouter()


async def _delete(user: User | None) -> dict:
    # Through the same clean-up as an account deleting itself. These were a bare
    # User.objects.delete(), which left the files, the search documents and the cached
    # session behind (C9 in docs/crud-audit-2026-10.md).
    if user is None:
        return {"deleted": 0}
    await delete_account(user)
    return {"deleted": 1}


@router.delete("/user/id")
async def delete_user_by_id(user_id: UUID, _: User = Depends(get_admin_user)):
    return await _delete(await User.objects.get_or_none(id=user_id))


@router.delete("/user/username")
async def delete_user_by_username(username: str, _: User = Depends(get_admin_user)):
    return await _delete(await User.objects.get_or_none(username=username))


@router.delete("/user/email")
async def delete_user_by_email(email: str, _: User = Depends(get_admin_user)):
    return await _delete(await User.objects.get_or_none(email=email))
