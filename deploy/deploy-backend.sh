#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
# SPDX-License-Identifier: MPL-2.0
#
# Rolls the production api and worker forward to one reviewed backend revision, fed over SSH
# by .github/workflows/production-ops.yml: `bash -s -- DEPLOY_DIR REVISION`. Nothing else
# changes: not .env, not the database, Redis, search, proxy or the uploads. If the new
# containers do not come up healthy, the previous image is put back the same way.
# The image's start script runs `alembic upgrade head`, and putting an old image back does
# not undo a migration. So by default this refuses any image whose migration head differs
# from the database's. With a third argument, `migrate`, it takes an image whose head is
# ahead of the database on the same line, and nothing else; the workflow only passes it
# after checking that a backup ran within the last few hours (DEPLOY.md). Once a migration
# has run, it never puts the old image back.
set -euo pipefail

usage='usage: deploy-backend.sh DEPLOY_DIR REVISION [migrate]'
cd -- "${1:?$usage}"
want=${2:?$usage}
mode=${3:-}
[[ "$want" =~ ^[0-9a-f]{40}$ ]] || { echo 'REVISION must be a full 40-character commit.' >&2; exit 1; }
[[ -z "$mode" || "$mode" == migrate ]] || { echo "$usage" >&2; exit 1; }
image=ghcr.io/ogfrench/frogquiz-backend:master
test -f .env && test -f docker-compose.yml || { echo 'Not a Compose directory.' >&2; exit 1; }

# Same guard as enable-guests.sh: only the directory the running containers came from.
# Both must also run the same image, or one rollback tag cannot put both back.
images=()
for service in api worker; do
  id=$(docker compose ps -q "$service" </dev/null)
  test -n "$id" || { echo "$service is not running; stop and inspect." >&2; exit 1; }
  dir=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$id" </dev/null)
  [[ "$(realpath -m -- "$dir")" == "$(pwd -P)" ]] || {
    echo "$service belongs to a different Compose directory; refusing." >&2
    exit 1
  }
  images+=("$(docker inspect --format '{{.Image}}' "$id" </dev/null)")
done
[[ "${images[0]}" == "${images[1]}" ]] || { echo 'api and worker run different images; deploy by hand.' >&2; exit 1; }

# Both services must use the image this script pulls, or recreating them changes nothing.
docker compose config --format json </dev/null | python3 -c '
import json, sys
c = json.load(sys.stdin)
for name in ("api", "worker"):
    if c["services"][name].get("image") != sys.argv[1]:
        sys.exit(f"{name} does not use {sys.argv[1]}; inspect before deploying.")
' "$image"

previous=${images[0]}
old_revision=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$previous" </dev/null)
echo "Running: $old_revision"
if [[ "$old_revision" == "$want" ]]; then
  echo 'Already on that revision. Nothing changed.'
  exit 0
fi

# From here until the new containers are healthy, any exit (an error, a dropped SSH session,
# a cancelled job) puts :master back on the running image. Otherwise a later, unrelated
# `docker compose up` would deploy the pulled image without any of the checks below.
docker tag "$previous" frogquiz-backend:rollback
done_ok=0
restore_tag() { ((done_ok)) || docker tag frogquiz-backend:rollback "$image" 2>/dev/null || true; }
trap restore_tag EXIT
trap 'exit 1' HUP INT TERM

docker pull -q "$image" </dev/null
got=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" </dev/null)
[[ "$got" == "$want" ]] || { echo "The registry's :master is $got, not $want. Nothing changed." >&2; exit 1; }

# Migration head of the new image against the database's current revision. Each must be
# exactly one 12-hex revision id, or the check fails closed. The script also says whether
# the database's revision is an ancestor of that head in the image's own migrations, which
# is what makes an upgrade a plain step forward.
# Read from the migration files rather than `alembic heads`, which loads migrations/env.py
# and with it the app's settings, which need production's environment to import.
heads_py='
import glob, re, sys
revs, downs, parents = set(), set(), {}
for path in glob.glob("/app/migrations/versions/*.py"):
    text = open(path, encoding="utf-8").read()
    rev = re.search(r"^revision\s*(?::[^=]*)?=\s*[\x27\x22]([0-9a-f]+)[\x27\x22]", text, re.M)
    if not rev:
        continue
    revs.add(rev.group(1))
    down = re.search(r"^down_revision\s*(?::[^=]*)?=\s*(.+)$", text, re.M)
    found = re.findall(r"[\x27\x22]([0-9a-f]+)[\x27\x22]", down.group(1)) if down else []
    downs.update(found)
    parents[rev.group(1)] = found
heads = sorted(revs - downs)
print("\n".join(heads))
if len(heads) == 1 and len(sys.argv) > 1:
    seen, todo = set(), list(parents.get(heads[0], []))
    while todo:
        r = todo.pop()
        if r not in seen:
            seen.add(r)
            todo.extend(parents.get(r, []))
    print("forward" if sys.argv[1] in seen else "not-forward")
'
current=$(docker compose exec -T api sh -c 'cd /app && alembic current 2>/dev/null' </dev/null || true)
current=$(awk 'NF {print $1}' <<<"$current")
heads_out=$(docker run --rm --entrypoint python3 "$image" -c "$heads_py" "${current:-none}" </dev/null || true)
new_head=$(awk 'NF && $1 != "forward" && $1 != "not-forward" {print $1}' <<<"$heads_out")
direction=$(grep -xE 'forward|not-forward' <<<"$heads_out" || true)
migrating=0
if [[ "$new_head" =~ ^[0-9a-f]{12}$ && "$current" =~ ^[0-9a-f]{12}$ && "$new_head" == "$current" ]]; then
  echo "Migrations: none to run (head $current)."
elif [[ "$mode" == migrate && "$new_head" =~ ^[0-9a-f]{12}$ && "$current" =~ ^[0-9a-f]{12}$ && "$direction" == forward ]]; then
  migrating=1
  echo "Migrations: $current to $new_head, run by the api as it starts."
else
  echo "Migration heads do not match one to one (image: ${new_head:-none}; database: ${current:-none}; ${direction:-no path})." >&2
  if [[ "$mode" == migrate ]]; then
    echo 'Refusing: migrate takes only one head that is ahead of the database on the same line. Nothing changed.' >&2
  else
    echo 'Refusing: a deploy with a migration uses the migrate mode, after a backup. Nothing changed.' >&2
  fi
  exit 1
fi

# The revision the database is at now, read through the image being deployed, which knows
# every revision. Used after a failed start, when the api may be restarting.
db_revision() {
  docker compose run --rm --no-deps -T --entrypoint sh api -c 'cd /app && alembic current 2>/dev/null' </dev/null |
    awk 'NF {print $1; exit}' || true
}

if docker compose up -d --no-deps --force-recreate --wait --wait-timeout 180 api worker </dev/null; then
  done_ok=1
  if ((migrating)); then
    now=$(docker compose exec -T api sh -c 'cd /app && alembic current 2>/dev/null' </dev/null | awk 'NF {print $1; exit}' || true)
    if [[ "$now" != "$new_head" ]]; then
      echo "Healthy, but the database is at ${now:-unknown}, not $new_head. Inspect before anything else." >&2
      exit 1
    fi
    echo "Deployed $want (was $old_revision) and migrated the database to $new_head."
    echo 'Do not put the old image back: it does not know this schema. Restore the backup with it, or roll forward.'
    exit 0
  fi
  echo "Deployed $want (was $old_revision). Rollback image kept as frogquiz-backend:rollback."
  exit 0
fi

if ((migrating)); then
  now=$(db_revision)
  if [[ "$now" != "$current" ]]; then
    # The migration ran, or ran part way. The old image would start against a schema it
    # does not know, so it is not put back: the new one stays, restarting, for a fix
    # forward or a restore of the backup.
    done_ok=1
    echo "The new containers did not become healthy, and the database is now at ${now:-unknown} (was $current)." >&2
    echo 'Not rolling back the image. Read `docker compose logs api`, then fix forward or restore the backup (DEPLOY.md, "Backups").' >&2
    exit 1
  fi
  echo "The database is still at $current: the migration did not run, so the old image is safe to put back." >&2
fi

echo "The new containers did not become healthy; rolling back to $old_revision." >&2
docker tag frogquiz-backend:rollback "$image"
if docker compose up -d --no-deps --force-recreate --wait --wait-timeout 180 api worker </dev/null; then
  echo 'Rolled back. Inspect `docker compose logs api worker` before trying again.' >&2
else
  echo 'Rollback did not come up healthy either. Inspect `docker compose ps` and the logs now.' >&2
fi
exit 1
