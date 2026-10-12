# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

import time

from frogquiz.config import WORKER_HEARTBEAT_KEY

# Ten heartbeats' worth: a key that outlives a dead worker by this long still reads as
# stale through its age, and the key itself does not linger in Redis forever.
HEARTBEAT_TTL_SECONDS = 600


async def heartbeat(ctx):
    """Say the worker is alive (#60). Its cron jobs are not made up when it comes back,
    so a worker that stopped quietly used to mean sweeps that silently never ran."""
    await ctx["redis"].set(WORKER_HEARTBEAT_KEY, str(time.time()), ex=HEARTBEAT_TTL_SECONDS)
