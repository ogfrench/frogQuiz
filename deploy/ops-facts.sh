#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
# SPDX-License-Identifier: MPL-2.0
#
# Read-only facts about the production VM for #72, fed over SSH by
# .github/workflows/production-ops.yml: `bash -s -- DEPLOY_DIR`. Changes nothing.
# Its output lands in a public Actions log, so it prints sizes, counts, shapes and yes/no
# answers, never a value from .env, an address or a key.
set -euo pipefail

cd -- "${1:?usage: ops-facts.sh DEPLOY_DIR}"
test -f .env && test -f docker-compose.yml || { echo 'Not a Compose directory.' >&2; exit 1; }

echo '## Instance (Oracle metadata service)'
# Shape, region and allocation as Oracle sees them. Billing and trial status are not in the
# metadata: those need the console.
curl -sf -m 5 -H 'Authorization: Bearer Oracle' http://169.254.169.254/opc/v2/instance/ |
  python3 -c '
import json, sys
i = json.load(sys.stdin)
c = i.get("shapeConfig", {})
for k, v in [("shape", i.get("shape")), ("region", i.get("canonicalRegionName") or i.get("region")),
             ("created", __import__("datetime").datetime.utcfromtimestamp(int(i["timeCreated"]) / 1000).date()
              if str(i.get("timeCreated", "")).isdigit() else i.get("timeCreated")),
             ("OCPUs", c.get("ocpus")), ("memory GB", c.get("memoryInGBs")),
             ("network Gbps", c.get("networkingBandwidthInGbps"))]:
    print(f"- {k}: {v}")
' || echo '- metadata service did not answer'

echo '## Resources'
echo "- CPUs: $(nproc)"
free -m | awk '/^Mem:/ {printf "- memory: %s MB total, %s MB used, %s MB available\n", $2, $3, $7}
                /^Swap:/ {printf "- swap: %s MB total, %s MB used\n", $2, $3}'
df -hP / | awk 'NR==2 {printf "- disk /: %s total, %s used (%s), %s free\n", $2, $3, $5, $4}'
echo "- uploads: $(du -sh uploads 2>/dev/null | cut -f1) in $(find uploads -type f 2>/dev/null | wc -l) files"
echo "- uptime: $(uptime -p)"
docker system df --format '- docker {{.Type}}: {{.Size}} ({{.Reclaimable}} reclaimable)' </dev/null

echo '## Containers'
docker compose ps --format '- {{.Service}}: {{.Status}}' </dev/null
for service in api worker; do
  id=$(docker compose ps -q "$service" </dev/null)
  [[ -n "$id" ]] && docker inspect --format "- $service image revision: {{index .Config.Labels \"org.opencontainers.image.revision\"}}" "$id" </dev/null
done

echo '## Signing key'
# Compared by hash against every SECRET_KEY value ever committed to this repo (from git
# history on 16 Oct, including the upstream defaults), and checked for length. Only yes
# or no is printed. Read from the running api, which is what actually signs.
docker compose exec -T api python3 -c '
import hashlib, os
known = {
    "eb3940071b90b6ce41dc96f959f2fe22ed0b236e711e85373f46f974624e736e",
    "bdd74fda423e62a5affe6e3a61d73a95fffb04db929401409c33f016ca5d1b1a",
    "823d0d14d49ca9fd3d38fddf08c75ecb58382a5d1781b728c58ecefe40955362",
    "a38aab511111154f53ec68c17044007df80f7cb3aeeab64b04eadf720fee68fd",
    "a8ae6e6ee929abea3afcfc5258c8ccd6f85273e0d4626d26c7279f3250f77c8e",
    "e2186dbdb1bb4193608605e84f33208765b5693b55edd4f730a719a100eeea6f",
    "b2b234cef91fadb70dd73386529831adb408fb3790265ec6d129eccae669aa00",
}
key = os.environ.get("SECRET_KEY", "")
print("- set:", "yes" if key else "NO")
print("- at least 32 characters:", "yes" if len(key) >= 32 else "NO")
print("- matches a value ever committed to the repo:", "YES, rotate it" if hashlib.sha256(key.encode()).hexdigest() in known else "no")
' </dev/null || echo '- api not running; signing key not checked'

echo '## Configuration files (names only)'
ls -1d .env docker-compose*.yml Caddyfile* 2>/dev/null | sed 's/^/- /' || true
echo "- COMPOSE_FILE selects: $(grep -E '^COMPOSE_FILE=' .env | cut -d= -f2- | tr -cd 'A-Za-z0-9._:/-' || echo 'default')"
