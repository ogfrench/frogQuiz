# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
#
# SPDX-License-Identifier: MPL-2.0

CONTAINER_BIN=${CONTAINER_BIN:-podman}

run_tests() {
  pipenv run coverage run -m pytest -s -v --asyncio-mode=strict frogquiz/tests
}

stop() {
  $CONTAINER_BIN compose -f docker-compose.dev.yml down --volumes
}

# Wait for Postgres to actually accept connections. "sleep 2" was a race: the
# container is up long before the server is listening, and when it lost, every
# database-backed test failed with connection refused and nothing said why.
wait_for_db() {
  for i in $(seq 1 60); do
    if $CONTAINER_BIN compose -f docker-compose.dev.yml exec -T db \
        pg_isready -U postgres -d frogquiz >/dev/null 2>&1; then
      echo "Postgres ready after ${i}s"
      return 0
    fi
    sleep 1
  done
  echo "Postgres did not become ready within 60s" >&2
  $CONTAINER_BIN compose -f docker-compose.dev.yml ps >&2
  $CONTAINER_BIN compose -f docker-compose.dev.yml logs --tail 50 db >&2
  return 1
}

init() {
  if [ ! -d /tmp/storage ]; then
    mkdir /tmp/storage
  fi
  if ! $CONTAINER_BIN compose -f docker-compose.dev.yml up -d; then
    echo "compose up failed" >&2
    $CONTAINER_BIN compose -f docker-compose.dev.yml ps >&2
    return 1
  fi
  wait_for_db || return 1
  pipenv run alembic upgrade head
}

case $1 in
+) init ;;
-) stop ;;
a)
  $CONTAINER_BIN volume rm frogquiz_db 2>/dev/null || true
  if ! init; then
    echo "environment failed to start; not running tests" >&2
    stop
    exit 1
  fi
  run_tests
  # Keep the test exit code: "stop" would otherwise mask a failing suite
  rc=$?
  stop
  exit $rc
  ;;
prepare)
  stop
  $CONTAINER_BIN volume rm frogquiz_db
  init
  ;;
*)
  echo "Invalid option: -$OPTARG" >&2
  exit 1
  ;;
esac
