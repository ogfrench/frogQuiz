# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

from datetime import datetime

from fastapi import HTTPException, Request

from frogquiz.config import settings
from frogquiz.db import database
from frogquiz.helpers.ratelimit import rate_limit

ANON_QUIZ_EXPIRE_DAYS = 30


async def enforce_anonymous_quiz_ceilings(request: Request) -> None:
    config = settings()
    alive = await database.fetch_val(
        "SELECT count(*) FROM quiz WHERE user_id IS NULL AND (expire_at IS NULL OR expire_at >= :now)",
        {"now": datetime.now()},
    )
    if alive >= config.anon_quiz_total_limit:
        raise HTTPException(
            status_code=429,
            detail="Too many quizzes without an account right now. Sign in to keep going.",
        )
    try:
        await rate_limit(request, "anon_quiz_create", limit=config.anon_quiz_daily_limit, window_seconds=86400)
    except HTTPException as limited:
        limited.detail = "You have reached today's limit for quizzes without an account. Sign in to keep going."
        raise