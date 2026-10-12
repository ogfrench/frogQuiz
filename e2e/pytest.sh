#!/bin/bash
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

# The backend suite on the e2e stack's infrastructure, for a machine without Docker.
# Start the stack first (KEEP_UP=1 bash e2e/run.sh --list); this uses its Postgres, Redis
# and Meilisearch, in a database, Redis index and search index of its own, so the stack's
# data is left alone. E2E_PORT_OFFSET picks the same stack run.sh started with it.
#
#   bash e2e/pytest.sh fresh frogquiz/tests/test_health.py   # new database, then run
#   bash e2e/pytest.sh run frogquiz/tests                     # reuse the database
#
# The suite is order-dependent and not idempotent (CLAUDE.md), so a full run wants "fresh".
set -e
mode="${1:-}"
case "$mode" in
  fresh | run) shift ;;
  *) echo "usage: bash e2e/pytest.sh fresh|run [pytest args]" >&2; exit 2 ;;
esac
cd "$(dirname "$0")/.."
OFF="${E2E_PORT_OFFSET:-0}"
PG_PORT=$((5433 + OFF)); REDIS_PORT=$((6380 + OFF)); MEILI_PORT=$((7701 + OFF))
lad=/nonexistent
[ -n "${LOCALAPPDATA:-}" ] && lad="$(cygpath -u "$LOCALAPPDATA" 2>/dev/null || printf '%s' "$LOCALAPPDATA")"
for pg in "$lad"/pgsql*/pgsql/bin /c/Program\ Files/PostgreSQL/*/bin; do
  [ -x "$pg/psql" ] && PATH="$pg:$PATH"
done
VENV="${E2E_VENV:-$(python -m pipenv --venv)}"
PY="$(cygpath -u "$VENV" 2>/dev/null || echo "$VENV")/Scripts/python.exe"
[ -x "$PY" ] || PY="$VENV/bin/python"
set -a; . ./.env.ci; set +a
export DB_URL="postgresql://postgres@127.0.0.1:$PG_PORT/frogquiz_pytest"
export REDIS="redis://127.0.0.1:$REDIS_PORT/1?decode_responses=True"
export MEILISEARCH_URL="http://127.0.0.1:$MEILI_PORT"
export MEILISEARCH_INDEX=frogquiz_pytest
STORAGE_PATH="${TMP:-/tmp}/frogquiz_pytest_storage"
mkdir -p "$STORAGE_PATH"
export STORAGE_PATH="$(cygpath -m "$STORAGE_PATH" 2>/dev/null || echo "$STORAGE_PATH")"
[ "$(uname -o 2>/dev/null)" = Msys ] && export PYTHONPATH="$PWD/e2e/shims"
if [ "$mode" = fresh ]; then
  psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -qc "drop database if exists frogquiz_pytest;" -c "create database frogquiz_pytest;"
  "$PY" -c "import redis; redis.Redis(port=$REDIS_PORT, db=1).flushdb()"
  "$PY" -m alembic upgrade head >/dev/null
fi
"$PY" -m pytest -q --asyncio-mode=strict -p no:cacheprovider "$@"
