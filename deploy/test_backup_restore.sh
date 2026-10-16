#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
# SPDX-License-Identifier: MPL-2.0
#
# A whole backup and restore, on a throwaway Postgres cluster and a throwaway key:
# backup-run.sh with REMOTE running backup.sh locally (BACKUP_LOCAL=1), then restore.sh into
# a second database and folder, then a check that the quiz row and the image bytes came
# back. Also checks the three ways it must refuse. Needs initdb, pg_ctl and age.
#   bash deploy/test_backup_restore.sh        (PG_BIN names the Postgres bin directory)
set -euo pipefail

here=$(cd -- "$(dirname -- "$0")" && pwd)
PG_BIN=${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -n1)}
export PG_BIN PATH="$PG_BIN:$PATH"
work=$(mktemp -d)
port=$((20000 + RANDOM % 20000))
cleanup() { pg_ctl -D "$work/pg" -m immediate stop >/dev/null 2>&1 || true; rm -rf -- "$work"; }
trap cleanup EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

initdb -D "$work/pg" -U postgres --auth=trust >/dev/null
pg_ctl -D "$work/pg" -o "-p $port -k $work -c listen_addresses=''" -w start >/dev/null
url() { echo "postgresql://postgres@/$1?host=$work&port=$port"; }
for db in source target; do createdb -h "$work" -p "$port" -U postgres "$db"; done

# A deployment directory shaped like /opt/frogquiz, with one quiz and its image.
mkdir -p "$work/deploy/uploads"
touch "$work/deploy/.env" "$work/deploy/docker-compose.yml"
image_id=0b8c1f2e-6a51-4d2e-9a3c-5e4f7d6c8b9a
head -c 50000 /dev/urandom >"$work/deploy/uploads/$image_id"
psql -q "$(url source)" -v ON_ERROR_STOP=1 <<SQL
create table quiz (id uuid primary key, title text not null, questions jsonb not null);
insert into quiz values ('6f1d2c3b-4a59-4e8d-b7c6-a5f4e3d2c1b0', 'Capitals',
  '[{"question": "Capital of Portugal?", "image": "$image_id"}]');
SQL

age-keygen -o "$work/key" 2>/dev/null
age-keygen -y "$work/key" >"$work/recipient"
export BACKUP_RECIPIENTS="$work/recipient" BACKUP_LOCAL=1 REMOTE="bash -s --"

# 1. A backup, encrypted. pg_dump's custom format is compressed, so a grep for the
#    quiz's title would pass on plaintext too: check for age's header instead.
DB_URL=$(url source) bash "$here/backup-run.sh" "$work/out" "$work/deploy" >/dev/null
for part in db uploads; do
  [[ "$(head -c 21 "$work/out/$part.age")" == age-encryption.org/v1 ]] ||
    fail "the $part backup is not encrypted"
done

# 2. The restore brings back the quiz and the image, byte for byte.
bash "$here/restore.sh" "$work/out" "$work/key" "$(url target)" "$work/restored" >/dev/null
title=$(psql "$(url target)" -XAtc "select title from quiz where questions->0->>'image' = '$image_id'")
[[ "$title" == Capitals ]] || fail "restored quiz title is '$title'"
cmp -s "$work/deploy/uploads/$image_id" "$work/restored/$image_id" || fail 'the image differs'

# 3. It refuses a database that is not empty, which is what keeps it off production.
#    An unrelated table, so that only the guard can stop it, not a clash of names.
createdb -h "$work" -p "$port" -U postgres busy
psql -q "$(url busy)" -c 'create table unrelated (id int)'
if bash "$here/restore.sh" "$work/out" "$work/key" "$(url busy)" "$work/other" 2>/dev/null; then
  fail 'restored over a database that already had tables'
fi

# 4. It refuses a backup that does not match its manifest.
printf x >>"$work/out/uploads.age"
createdb -h "$work" -p "$port" -U postgres fresh
if bash "$here/restore.sh" "$work/out" "$work/key" "$(url fresh)" "$work/third" 2>/dev/null; then
  fail 'restored a backup whose checksum does not match'
fi

# 5. A dump that fails leaves no file behind, and the run fails.
if DB_URL="postgresql://postgres@/missing?host=$work&port=$port" \
  bash "$here/backup-run.sh" "$work/broken" "$work/deploy" >/dev/null 2>&1; then
  fail 'a failed dump was reported as a backup'
fi
[[ -e "$work/broken/db.age" ]] && fail 'a failed dump left a file behind'

# 6. Anything else on the stream, such as a login banner, fails the run.
printf '#!/usr/bin/env bash\necho "Welcome to the VM"\nexec bash -s -- "$@"\n' >"$work/banner"
if DB_URL=$(url source) REMOTE="bash $work/banner" \
  bash "$here/backup-run.sh" "$work/bannered" "$work/deploy" >/dev/null 2>&1; then
  fail 'a stream with a banner in front of the dump was kept as a backup'
fi
[[ -e "$work/bannered/db.age" ]] && fail 'a stream with a banner left a file behind'

# 7. A deployment with no uploads folder fails rather than backing up nothing. Locally tar
#    would fail on its own; on the VM it is backup.sh's `test -d uploads` that stops docker
#    from creating an empty folder and backing that up, which this cannot reproduce.
mkdir -p "$work/bare" && touch "$work/bare/.env" "$work/bare/docker-compose.yml"
if DB_URL=$(url source) bash "$here/backup-run.sh" "$work/bare-out" "$work/bare" >/dev/null 2>&1; then
  fail 'a deployment without ./uploads was backed up'
fi

# 8. Connection errors reach the public log masked: no URL, password, host or role.
log=$(DB_URL="postgresql://secretrole:hunter2@ep-test-123.eu-central-1.aws.neon.tech:1/db?connect_timeout=2" \
  bash "$here/backup-run.sh" "$work/masked" "$work/deploy" 2>&1 >/dev/null || true)
for leak in hunter2 secretrole ep-test-123; do
  grep -q "$leak" <<<"$log" && fail "the log shows $leak: $log"
done

echo 'backup and restore: all checks passed'
