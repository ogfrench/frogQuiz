#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
# SPDX-License-Identifier: MPL-2.0
# Run from the production frogQuiz Compose directory, after reviewing this file.
set -euo pipefail

expected_revision=b72a3e25305ff34e67012a88961bb7d8490eb7a2
image=ghcr.io/ogfrench/frogquiz-backend:master
test -f .env && test -f docker-compose.yml || {
  echo 'Run this in the production Compose directory with its existing .env.' >&2
  exit 1
}

# A matching Compose project name does not prove this is the original checkout.
# Recreating containers from a fresh clone can silently replace DB, auth and upload
# settings. Require both existing containers to belong to this directory first.
for service in api worker; do
  container=$(docker compose ps -aq "$service")
  test -n "$container" || { echo "$service is missing; stop and inspect." >&2; exit 1; }
  original_dir=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$container")
  if [[ -z "$original_dir" || "$original_dir" == '<no value>' || "$(realpath -m -- "$original_dir")" != "$(pwd -P)" ]]; then
    echo "Refusing to replace $service from a different Compose directory. Locate the original deployment first." >&2
    exit 1
  fi
done

# Download first; do not change the running application if this fails.
docker pull "$image"
actual_revision=$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")
if [[ "$actual_revision" != "$expected_revision" ]]; then
  echo "Image revision is $actual_revision; expected $expected_revision. Review before proceeding." >&2
  exit 1
fi

# Save the old container image IDs for rollback without printing environment secrets.
umask 077
backup_dir=$(mktemp -d .guest-access-backup.XXXXXX)
cp -p .env "$backup_dir/env"
for service in api worker; do
  container=$(docker compose ps -q "$service")
  test -n "$container" || { echo "$service is not running; stop and inspect." >&2; exit 1; }
  docker inspect --format '{{.Image}}' "$container" > "$backup_dir/$service.image"
done

python3 - <<'PY'
from pathlib import Path
import re
p = Path('.env')
text = p.read_text()
pattern = r'(?m)^\s*(?:export\s+)?ANONYMOUS_QUIZZES_ENABLED\s*=.*$'
text = re.sub(pattern, 'ANONYMOUS_QUIZZES_ENABLED=true', text) if re.search(pattern, text) else text.rstrip('\n') + '\nANONYMOUS_QUIZZES_ENABLED=true\n'
p.write_text(text)
PY

# Preserve the installation's existing Compose/Neon selection. Fail if an override
# still disables guests or points at a different image. Never print full config.
if ! docker compose config --format json | python3 -c '
import json, sys
c = json.load(sys.stdin)
for name in ("api", "worker"):
    s = c["services"][name]
    if str(s.get("environment", {}).get("ANONYMOUS_QUIZZES_ENABLED", "")).lower() != "true":
        sys.exit("Guest access is overridden in Compose; inspect before restarting.")
    if s.get("image") != "ghcr.io/ogfrench/frogquiz-backend:master":
        sys.exit("Unexpected backend image; inspect before restarting.")
'; then
  cp -p "$backup_dir/env" .env
  exit 1
fi

# Touch only the API and worker, preserving database, storage, and proxy services.
echo "Configuration backup and previous image IDs: $backup_dir"
docker compose up -d --no-deps --force-recreate --wait --wait-timeout 180 api worker
echo "Backend containers recreated. Previous settings and image IDs: $backup_dir"
echo 'Verify container health and run deploy/verify-guest-access.py before declaring success.'
