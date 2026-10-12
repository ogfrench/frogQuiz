#!/bin/bash
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

# The backend suite on the e2e stack's infrastructure, for a machine without Docker.
# Start the stack first (KEEP_UP=1 bash e2e/run.sh --list); this uses its Postgres, Redis
# and Meilisearch, in a database, Redis index and search index of its own, so the stack's
# data is left alone.
#
#   bash e2e/pytest.sh fresh frogquiz/tests/test_health.py   # new database, then run
#   bash e2e/pytest.sh run frogquiz/tests                     # reuse the database
#
# The suite is order-dependent and not idempotent (CLAUDE.md), so a full run wants "fresh".
set -e
cd "$(dirname "$0")/.."
for pg in ${LOCALAPPDATA:+$(cygpath -u "$LOCALAPPDATA")/pgsql*/pgsql/bin} /c/Program\ Files/PostgreSQL/*/bin; do
  [ -x "$pg/psql" ] && PATH="$pg:$PATH"
done
VENV="${E2E_VENV:-$(python -m pipenv --venv)}"
PY="$(cygpath -u "$VENV" 2>/dev/null || echo "$VENV")/Scripts/python.exe"
[ -x "$PY" ] || PY="$VENV/bin/python"
set -a; . ./.env.ci; set +a
export DB_URL=postgresql://postgres@127.0.0.1:5433/frogquiz_pytest
export REDIS="redis://127.0.0.1:6380/1?decode_responses=True"
export MEILISEARCH_URL=http://127.0.0.1:7701
export MEILISEARCH_INDEX=frogquiz_pytest
STORAGE_PATH="${TMP:-/tmp}/frogquiz_pytest_storage"
mkdir -p "$STORAGE_PATH"
export STORAGE_PATH="$(cygpath -m "$STORAGE_PATH" 2>/dev/null || echo "$STORAGE_PATH")"
[ "$(uname -o 2>/dev/null)" = Msys ] && export PYTHONPATH="$PWD/e2e/shims"
mode=$1; shift
if [ "$mode" = fresh ]; then
  psql -h 127.0.0.1 -p 5433 -U postgres -qc "drop database if exists frogquiz_pytest;" -c "create database frogquiz_pytest;"
  "$PY" -c "import redis; redis.Redis(port=6380, db=1).flushdb()"
  "$PY" -m alembic upgrade head >/dev/null
fi
"$PY" -m pytest -q --asyncio-mode=strict -p no:cacheprovider "$@"
