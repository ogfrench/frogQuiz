#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
# SPDX-License-Identifier: MPL-2.0
#
# Restores the database and uploads of one nightly backup (an unzipped artifact of .github/workflows/backup.yml) into
# a scratch database and a scratch uploads folder. The runbook is in DEPLOY.md, "Backups".
#
#   restore.sh BACKUP_DIR IDENTITY_FILE TARGET_DB_URL TARGET_UPLOADS_DIR
#
# It only ever restores into an empty database and an empty or missing folder, so it
# cannot be pointed at production by mistake: production is never empty. pg_restore must
# be at least as new as the server that was dumped (Neon is on 18); PG_BIN names a
# directory holding a newer one.
# The backup's third part, config.age (.env and the Compose files), is not restored here:
# read it with `age -d -i KEY config.age | tar -tvf -` and copy what you need by hand.
set -euo pipefail

backup=${1:?usage: restore.sh BACKUP_DIR IDENTITY_FILE TARGET_DB_URL TARGET_UPLOADS_DIR}
identity=${2:?usage: restore.sh BACKUP_DIR IDENTITY_FILE TARGET_DB_URL TARGET_UPLOADS_DIR}
target_db=${3:?usage: restore.sh BACKUP_DIR IDENTITY_FILE TARGET_DB_URL TARGET_UPLOADS_DIR}
target_uploads=${4:?usage: restore.sh BACKUP_DIR IDENTITY_FILE TARGET_DB_URL TARGET_UPLOADS_DIR}
bin=${PG_BIN:+$PG_BIN/}

for part in db uploads; do
  test -s "$backup/$part.age" || { echo "Missing $backup/$part.age" >&2; exit 1; }
done
test -s "$backup/MANIFEST.txt" || { echo "Missing $backup/MANIFEST.txt" >&2; exit 1; }
for part in db uploads; do
  want=$(grep -E "^$part\.age " "$backup/MANIFEST.txt" | sed -E 's/.*sha256=//')
  have=$(sha256sum "$backup/$part.age" | cut -d' ' -f1)
  [[ "$want" == "$have" ]] || { echo "$part.age does not match MANIFEST.txt" >&2; exit 1; }
  # Both parts must decrypt before anything is written, or a bad uploads part would leave
  # a restored database without its images.
  age --decrypt -i "$identity" "$backup/$part.age" >/dev/null ||
    { echo "$part.age does not decrypt with $identity" >&2; exit 1; }
done

tables=$("${bin}psql" "$target_db" -XAtc "select count(*) from information_schema.tables where table_schema = 'public'")
if [[ "$tables" != 0 ]]; then
  echo "The target database already has $tables tables. Restore only into an empty one." >&2
  exit 1
fi
if [[ -e "$target_uploads" ]] && [[ -n "$(ls -A -- "$target_uploads")" ]]; then
  echo "$target_uploads is not empty. Restore only into an empty folder." >&2
  exit 1
fi
mkdir -p -- "$target_uploads"

start=$(date +%s)
age --decrypt -i "$identity" "$backup/db.age" |
  "${bin}pg_restore" --no-owner --no-acl --exit-on-error -d "$target_db"
age --decrypt -i "$identity" "$backup/uploads.age" | tar -C "$target_uploads" -xf -
echo "Restored in $(( $(date +%s) - start )) s:" \
  "$("${bin}psql" "$target_db" -XAtc 'select count(*) from quiz') quizzes," \
  "$(find "$target_uploads" -type f | wc -l) files."
