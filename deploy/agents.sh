#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
# SPDX-License-Identifier: MPL-2.0
#
# Turns AI agents (docs/mcp.md) on or off on the production VM, fed over SSH by
# .github/workflows/production-ops.yml: `bash -s -- DEPLOY_DIR on|off`.
#
# It changes four lines of .env and recreates only the api, the worker, the proxy and the
# mcp service, with --no-deps, so Redis, search and the database are left alone. It never
# pulls the backend image: the api keeps the image it runs, which must already carry the
# agent API and its migration (the migrate mode). It pulls only the proxy and mcp images.
# If the containers do not come up healthy, .env is put back and they are recreated as
# they were. Prints no value from .env.
set -euo pipefail

usage='usage: agents.sh DEPLOY_DIR on|off'
cd -- "${1:?$usage}"
want=${2:?$usage}
[[ "$want" == on || "$want" == off ]] || { echo "$usage" >&2; exit 1; }
test -f .env && test -f docker-compose.yml || { echo 'Not a Compose directory.' >&2; exit 1; }
public=https://api.frogquiz.xyz

# The same guard as deploy-backend.sh: only the directory the running containers came from.
for service in api worker; do
  id=$(docker compose ps -q "$service" </dev/null)
  test -n "$id" || { echo "$service is not running; stop and inspect." >&2; exit 1; }
  dir=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$id" </dev/null)
  [[ "$(realpath -m -- "$dir")" == "$(pwd -P)" ]] || { echo "$service belongs to a different Compose directory; refusing." >&2; exit 1; }
done

if [[ "$want" == on ]]; then
  # The running api must already have the agent API (#83 on).
  docker compose exec -T api python3 -c 'import frogquiz.routers.agent' </dev/null >/dev/null 2>&1 ||
    { echo 'The running api has no agent API. Run the migrate mode with a revision from #83 on first. Nothing changed.' >&2; exit 1; }
  # The Compose file here must know the mcp service and pass the settings to the api, or
  # the .env lines below do nothing. A checkout older than #83 is brought forward, but only
  # if it is on master with no local edits to tracked files; anything else is left for a
  # person to look at.
  # Read into a variable first: `grep -q` in a pipe can end the writer early, which
  # pipefail would report as no match.
  has_mcp() {
    local services
    services=$(docker compose --profile mcp config --services </dev/null 2>/dev/null) || return 1
    grep -qx mcp <<<"$services"
  }
  if [[ -d .git ]] && ! has_mcp; then
    if [[ "$(git rev-parse --abbrev-ref HEAD)" == master && -z "$(git status --porcelain --untracked-files=no)" ]]; then
      before=$(git rev-parse HEAD)
      git fetch -q origin master </dev/null
      git merge -q --ff-only origin/master </dev/null
      echo "Brought the checkout from ${before:0:7} to $(git rev-parse --short HEAD). Changed here:"
      git diff --stat "$before" HEAD -- docker-compose*.yml Caddyfile* </dev/null | sed 's/^/  /'
    else
      echo 'The checkout here is not a clean master; not pulling it.' >&2
    fi
  fi
  has_mcp ||
    { echo 'docker-compose.yml here has no mcp service. Update it to one from #83 on first. .env and the containers are unchanged.' >&2; exit 1; }
  docker compose config --format json </dev/null | python3 -c '
import json, sys
env = json.load(sys.stdin)["services"]["api"].get("environment", {})
missing = [k for k in ("AGENT_API_ENABLED", "MCP_URL") if k not in env]
sys.exit("docker-compose.yml here does not pass " + ", ".join(missing) + " to the api. .env and the containers are unchanged." if missing else 0)
'
  # Before .env changes, so a failed pull leaves nothing half done.
  docker compose pull -q proxy mcp </dev/null
fi

umask 077
backup=$(mktemp .env.agents-backup.XXXXXX)
cp -p .env "$backup"
# Until the end, any exit (an error, a cancelled job, a dropped SSH session) puts .env back,
# so agents are never left half on for the next `docker compose up` to finish.
finished=0
on_exit() {
  if ((finished)); then rm -f "$backup"; else cp -p "$backup" .env && rm -f "$backup"; fi
}
trap on_exit EXIT
trap 'exit 1' HUP INT TERM

# Sets or removes KEY=value lines and keeps everything else in .env as it is.
# COMPOSE_PROFILES is a list: mcp is added to it or taken out, and other profiles stay.
python3 - "$want" "$public" <<'PY'
import re, sys
from pathlib import Path

want, public = sys.argv[1], sys.argv[2]
p = Path(".env")
lines = p.read_text().splitlines()


def key(line):
    m = re.match(r"\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=", line)
    return m.group(1) if m else None


def value(name):
    for line in lines:
        if key(line) == name:
            return line.split("=", 1)[1].strip().strip("\"'")
    return None


def put(name, val):
    global lines
    lines = [line for line in lines if key(line) != name]
    if val is not None:
        lines.append(f"{name}={val}")


profiles = [x.strip() for x in (value("COMPOSE_PROFILES") or "").split(",") if x.strip() and x.strip() != "mcp"]
if want == "on":
    put("AGENT_API_ENABLED", "true")
    put("MCP_URL", public + "/mcp")
    put("MCP_PUBLIC_URL", public)
    profiles.append("mcp")
else:
    put("AGENT_API_ENABLED", "false")
put("COMPOSE_PROFILES", ",".join(profiles) or None)
p.write_text("\n".join(lines) + "\n")
PY

restore() {
  echo 'Putting the previous .env back and recreating the services as they were.' >&2
  cp -p "$backup" .env
  docker compose up -d --no-deps --force-recreate --wait --wait-timeout 180 api worker proxy </dev/null || true
  if [[ "$want" == on ]]; then docker compose --profile mcp stop mcp </dev/null || true; fi
}

if [[ "$want" == on ]]; then
  if ! docker compose up -d --no-deps --force-recreate --wait --wait-timeout 180 api worker mcp proxy </dev/null; then
    restore
    echo 'Agents are not on: the containers did not come up healthy. Inspect `docker compose logs api mcp proxy`.' >&2
    exit 1
  fi
else
  if ! docker compose up -d --no-deps --force-recreate --wait --wait-timeout 180 api worker </dev/null; then
    restore
    echo 'The api did not come up healthy with agents off. Inspect `docker compose logs api`.' >&2
    exit 1
  fi
  docker compose --profile mcp stop mcp </dev/null || true
fi

finished=1
docker compose --profile mcp ps --format '- {{.Service}}: {{.Status}}' </dev/null || true
echo "Agents: $want."
