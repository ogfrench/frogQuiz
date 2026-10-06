# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The arq worker, for runs on fakeredis.

fakeredis has no INFO command, and arq sends one at startup for nothing but a log line
(`log_redis_info`); the connection drops and the worker exits. Skipping that line is
the whole difference from `arq frogquiz.worker.WorkerSettings`, which run.sh uses when
a real redis-server is there.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import arq.worker  # noqa: E402
from arq.cli import cli  # noqa: E402


async def _no_info(pool, log_func):
    pass


arq.worker.log_redis_info = _no_info
cli.main(args=["frogquiz.worker.WorkerSettings"])
