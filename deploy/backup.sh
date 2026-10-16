#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
# SPDX-License-Identifier: MPL-2.0
#
# Runs on the VM, fed over SSH by deploy/backup-run.sh: `bash -s -- DEPLOY_DIR PART`.
# Writes one part of the backup to stdout and nothing else there. The runner encrypts it
# before it touches a disk; this script never writes a copy on the VM.
#   PART=db       pg_dump in custom format (pg_restore reads it)
#   PART=uploads  a tar of ./uploads, the images every quiz points at
#
# BACKUP_LOCAL=1 uses the pg_dump and tar on PATH instead of throwaway containers, and
# reads DB_URL from the environment. Only deploy/test_backup_restore.sh sets it.
set -euo pipefail

deploy_dir=${1:?usage: backup.sh DEPLOY_DIR db|uploads}
part=${2:?usage: backup.sh DEPLOY_DIR db|uploads}
cd -- "$deploy_dir"
test -f .env && test -f docker-compose.yml || {
  echo "No .env and docker-compose.yml in $deploy_dir: not the production directory." >&2
  exit 1
}
# Without this, docker's bind mount below would create an empty folder and back that up.
test -d uploads || { echo "No uploads folder in $deploy_dir." >&2; exit 1; }

# This script's stderr ends up in a public Actions log. Connection errors name the database
# host and role, and a malformed URL is echoed whole, password included: mask both.
scrub() { sed -E 's#postgres(ql)?(\+[a-z]+)?://[^[:space:]"]*#<url>#g; s#[[:alnum:].-]+\.neon\.tech#<host>#g; s#user "[^"]*"#user "<role>"#g' >&2; }

if [[ "${BACKUP_LOCAL:-}" == 1 ]]; then
  case "$part" in
    db) exec pg_dump --format=custom --no-owner --no-acl "${DB_URL:?}" 2> >(scrub) ;;
    uploads) exec tar -C uploads -cf - . ;;
  esac
  echo "Unknown part: $part" >&2
  exit 1
fi

# The same guard as enable-guests.sh: a fresh clone elsewhere on the VM has example
# settings, and backing up its empty database would look like a working backup.
container=$(docker compose ps -aq api </dev/null)
test -n "$container" || { echo 'The api container is missing here; wrong directory?' >&2; exit 1; }
original_dir=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$container" </dev/null)
if [[ "$(realpath -m -- "$original_dir")" != "$(pwd -P)" ]]; then
  echo 'The running api belongs to a different Compose directory; refusing.' >&2
  exit 1
fi

case "$part" in
  db)
    # Production is Neon (DB_URL_OVERRIDE, docker-compose.neon.yml). Without it, the
    # local db container. The URL is never echoed.
    url=$(grep -E '^DB_URL_OVERRIDE=' .env | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" || true)
    if [[ -n "$url" && ! "$url" =~ ^postgres(ql)?:// ]]; then
      echo 'DB_URL_OVERRIDE is not a postgresql:// URL; refusing to pass it to pg_dump.' >&2
      exit 1
    fi
    if [[ -n "$url" ]]; then
      # The client must be at least as new as the server (DEPLOY.md: a 17 client refuses
      # to dump Neon's 18). Ask the server, then dump with its own major version.
      major=$(docker run --rm postgres:18-alpine psql "$url" -XAtc 'show server_version_num' </dev/null 2> >(scrub))
      major=$((major / 10000))
      exec docker run --rm "postgres:${major}-alpine" \
        pg_dump --format=custom --no-owner --no-acl "$url" </dev/null 2> >(scrub)
    fi
    exec docker compose exec -T db pg_dump --format=custom --no-owner --no-acl -U postgres frogquiz </dev/null 2> >(scrub)
    ;;
  uploads)
    # Through a container, because the API writes these files as its own user.
    exec docker run --rm -v "$(pwd -P)/uploads:/data:ro" alpine:3 tar -C /data -cf - . </dev/null
    ;;
esac
echo "Unknown part: $part" >&2
exit 1
