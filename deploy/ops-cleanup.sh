#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
# SPDX-License-Identifier: MPL-2.0
#
# Frees disk on the production VM (#72), fed over SSH by .github/workflows/production-ops.yml:
# `bash -s -- DEPLOY_DIR`. It removes the unused frontend container (Netlify serves the site;
# Caddy's catch-all on the VM's own address then answers 502 instead of an outdated copy),
# images no container uses, and the build cache. Never volumes: Redis and search keep their
# data there. It also removes frogquiz-backend:rollback, so run it before a deploy, not
# straight after one.
set -euo pipefail

cd -- "${1:?usage: ops-cleanup.sh DEPLOY_DIR}"
test -f .env && test -f docker-compose.yml || { echo 'Not a Compose directory.' >&2; exit 1; }
df -hP / | awk 'NR==2 {printf "Before: %s used of %s (%s)\n", $3, $2, $5}'

if [[ -n "$(docker compose ps -aq frontend </dev/null)" ]]; then
  docker compose rm -sf frontend </dev/null
  echo 'Removed the frontend container. `docker compose up -d frontend` would bring it back.'
fi

docker image prune -af </dev/null | tail -n1
docker builder prune -af </dev/null | tail -n1

df -hP / | awk 'NR==2 {printf "After: %s used of %s (%s)\n", $3, $2, $5}'
docker compose ps --format '- {{.Service}}: {{.Status}}' </dev/null
