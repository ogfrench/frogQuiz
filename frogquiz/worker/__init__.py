# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0


from arq import cron
from arq.connections import RedisSettings

from frogquiz import settings
from frogquiz.db import database
from frogquiz.worker.health import heartbeat
from frogquiz.worker.storage import (
    clean_orphaned_uploads,
    clean_expired_anonymous_quizzes,
    calculate_hash,
    quiz_update,
    release_held_images_job,
    release_held_images_sweep,
)


async def startup(ctx):
    ctx["db"] = database
    if not ctx["db"].is_connected:
        await ctx["db"].connect()


async def shutdown(ctx):
    if ctx["db"].is_connected:
        await ctx["db"].disconnect()


class WorkerSettings:
    functions = [calculate_hash, quiz_update, release_held_images_job]
    cron_jobs = [
        cron(clean_orphaned_uploads, hour={0, 6, 12, 18}, minute=0),
        cron(clean_expired_anonymous_quizzes, hour={3}, minute=0),
        cron(release_held_images_sweep, minute=30),
        # Every minute, and once at start-up so a restarted worker reads as up at once.
        cron(heartbeat, run_at_startup=True),
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(str(settings.redis))
