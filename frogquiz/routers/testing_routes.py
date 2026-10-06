# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0


import hmac

from fastapi import APIRouter
from frogquiz.db.models import User
from frogquiz.config import settings

settings = settings()

router = APIRouter()


@router.get("/user/{email}")
async def get_user_by_email(email: str, secret_key: str) -> User:
    # Mounted only with ENABLE_TESTING_ROUTES (on in .env.ci, off by default). Constant-time
    # all the same: `==` returns at the first differing character.
    if hmac.compare_digest(secret_key.encode(), settings.secret_key.encode()):
        return await User.objects.filter(email=email).get()
