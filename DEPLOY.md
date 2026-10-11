<!--
SPDX-FileCopyrightText: 2026 François & Gonçalo

SPDX-License-Identifier: MPL-2.0
-->

# Deploying frogQuiz

## What can and cannot go on Netlify

Netlify hosts the **SvelteKit frontend only**. The backend cannot run there: it is a
long-lived FastAPI + socket.io process with an arq worker, Postgres, Redis and
Meilisearch behind it. Netlify Functions are ephemeral and have no WebSocket support,
so gameplay traffic (`/socket.io/*`) cannot pass through Netlify at all.

Two supported layouts:

| Layout                 | Frontend                            | Backend                                                           |
| ---------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| Single host (simplest) | container from `docker-compose.yml` | same compose stack                                                |
| Split                  | Netlify                             | container host (VPS, Fly, Railway) running the same compose stack |

## Option A — everything on one host

1. Copy `.env.example` to `.env` and fill it in. `SITE_ADDRESS` should be your bare
   domain (e.g. `quiz.example.com`) so Caddy provisions a Let's Encrypt certificate;
   point that domain's A record at the host first.
2. `docker compose up -d`. Caddy listens on 80/443, routes `/api/*` and `/socket.io/*`
   to the API and everything else to the frontend. `prestart.sh` runs `alembic upgrade head`.

The `api`, `worker` and `proxy` services pull `ghcr.io/ogfrench/frogquiz-*:master`,
built by this repo's workflows. Push to `master` to publish new images.

## Option B — frontend on Netlify, backend on a container host

Backend first: run Option A on your container host, with `SITE_ADDRESS` set to an
API-only domain (`api.example.com`). Then:

1. In `netlify.toml`, replace `https://api.example.com` in both redirects with that
   domain. REST calls are proxied so the auth cookies stay first-party.
2. In Netlify's environment variables, set:
   - `API_URL` — the same backend base URL. Used server-side by `hooks.server.ts`.
   - `VITE_API_ORIGIN` — the same URL. The browser opens the socket.io connection
     straight to it, bypassing Netlify, because Netlify cannot proxy WebSockets.
3. On the backend, set `CORS_ORIGINS` in `.env` to a JSON list containing the Netlify
   site URL, e.g. `["https://frogquiz.netlify.app"]`. Without it the socket.io server
   rejects the cross-origin handshake.
   Also set `TRUSTED_PROXY_HOPS=2`. There are two proxies in front of the app in this
   setup (Netlify, then Caddy), and the rate limiter keys on the last entry of
   `X-Forwarded-For` -- which with two hops is Netlify's egress address, the same for
   every visitor. Left at 1, the whole user base shares one bucket, and
   `/forgot-password`'s five an hour is five for everyone. The trade-off is that the
   entry it then reads is one the caller could forge by reaching Caddy directly, so
   close the backend to everything but Netlify if you rely on the limiter (the
   per-address limits on the mail endpoints hold either way).
4. Set `ROOT_ADDRESS` to the Netlify site URL (it is what appears in emails and links).

`NETLIFY=true` is set by Netlify during builds, which is what switches
`svelte.config.js` from `adapter-node` to `adapter-netlify`. Local and Docker builds
are unaffected.

Trade-off: this splits the deployment across two providers and puts the socket on a
different origin than the page. Option A is cheaper and has fewer moving parts.

## Free hosting

The stack needs always-on containers, WebSockets and a disk for Meilisearch, which rules
out most free tiers: Railway and Fly have no free plan for persistent services, and
Render's free web services sleep after inactivity, which drops live game sockets.

What is actually free:

| Piece                              | Free option                 | Limit                                  |
| ---------------------------------- | --------------------------- | -------------------------------------- |
| Frontend                           | Netlify                     | 100 GB bandwidth/month                 |
| Postgres                           | Neon                        | 0.5 GB storage, autosuspend            |
| API + worker + Redis + Meilisearch | Oracle Cloud Always Free VM | 2 ARM cores / 12 GB RAM, no time limit |

Oracle's Always Free ARM instance runs this whole compose stack with room to spare, and
the images are all multi-arch. Signup needs a card for verification (not charged) and ARM
capacity is often unavailable in busy regions -- retry or pick another region. If that
fails, a Hetzner CX23 is EUR 5.49/month plus EUR 0.50 for the IPv4 and takes ten minutes.

**The Always Free ARM allowance was halved.** It is now 1,500 OCPU hours and 9,000 GB
hours a month, which Oracle states as **2 OCPUs and 12 GB** for an Always Free tenancy --
this file said 4 OCPU / 24 GB until 2026-10-02, which was right when it was written and is
now double the limit. That is not a soft cap: if a tenancy has more A1 provisioned than the
allowance permits, **every** A1 instance in it is disabled and then deleted after 30 days,
not trimmed to fit. Oracle gave no notice of the change. Check the current figure on
[Oracle's own page](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
before you create anything, rather than trusting this paragraph either.

Also worth knowing before you rely on it: Oracle reclaims *idle* Always Free instances,
and for ARM shapes the test is all three of CPU p95, network and memory under 20% over
seven days. A quiz tool used once a week meets all three. See issue #22.

### Oracle Cloud Always Free, step by step

1. Create the instance: Compute > Instances > Create.
   - Image: **Ubuntu 24.04**. Shape: **VM.Standard.A1.Flex**, 2 OCPUs / 12 GB (the whole
     Always Free ARM allowance -- confirm it against Oracle's page above, it has changed
     once already). It must be in your tenancy's **home region**, or neither the instance
     nor its volumes are Always Free; `eu-frankfurt-1` is next to the Neon project.
   - Paste your public SSH key.
   - Show advanced options > Cloud-init script: paste `deploy/oracle-cloud-init.yaml`.
   - "Out of capacity" is the usual failure. Retry, or try another availability domain.
2. Open the ports: Networking > Virtual Cloud Networks > your VCN > the public subnet >
   its security list > Add ingress rules. Source `0.0.0.0/0`, TCP, destination ports 80
   and 443. The cloud-init script has already opened them in the instance firewall.
3. No domain? Use sslip.io: it resolves `134-98-158-173.sslip.io` to `134.98.158.173`,
   and Let's Encrypt issues certificates for it, so `SITE_ADDRESS` can be
   `<dashed-ip>.sslip.io` and Caddy gets real HTTPS with nothing to buy. Otherwise
   point DNS at the instance's public IP (an A record for e.g. `api.yourdomain.com`), then
   set `SITE_ADDRESS` to that name so Caddy can issue a certificate.
4. SSH in and configure:

```bash
ssh ubuntu@<public-ip>
cd /opt/frogquiz
cp .env.example .env && nano .env      # SECRET_KEY, SITE_ADDRESS, ROOT_ADDRESS, mail, CORS_ORIGINS
# using Neon: add DB_URL_OVERRIDE=<neon uri>, then
docker compose -f docker-compose.yml -f docker-compose.neon.yml up -d   api worker redis meilisearch proxy
docker compose logs -f api
```

### Deploying to any Linux VM

```bash
# on the VM (Ubuntu 24.04)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

git clone https://github.com/ogfrench/frogQuiz && cd frogQuiz
cp .env.example .env && nano .env          # SECRET_KEY, SITE_ADDRESS, ROOT_ADDRESS, mail
docker compose up -d                       # builds the images on first run

# with Neon instead of the local db container:
#   put the Neon URI in DB_URL_OVERRIDE in .env, then
#   docker compose -f docker-compose.yml -f docker-compose.neon.yml up -d #     api worker redis meilisearch proxy
```

Open ports 80 and 443 in the provider's firewall as well as the OS one -- Oracle's
security list blocks them by default, and Caddy cannot get a certificate without 80.

When the frontend is hosted elsewhere, `CORS_ORIGINS` must list its origin. The
API's own origin is always allowed on top of that, so a browser can talk to the
UI that the API itself serves as well as the remote one.

Keep `MAX_WORKERS: "1"`. The socket.io server holds per-game state in one process; a
second gunicorn worker or a second API replica breaks live games.

## Email

Since 5 Oct mail is how everybody signs in: an emailed link or six-digit code, for the
domains on `ALLOWED_EMAIL_DOMAINS` (`frog.co,capgemini.com` by default), with no passwords.
Without a relay nobody can sign in at all, and the sign-in page says so with a 503. The
registration and password-recovery mails below are only sent with `ENABLE_PASSWORD_LOGIN`
on, which it is not.

Set the `MAIL_*` block in `.env` and restart `api` and `worker`:

```
MAIL_SERVER=smtp.resend.com
MAIL_PORT=587
MAIL_SECURITY=starttls        # or ssl for port 465, none for a local relay
MAIL_ADDRESS=noreply@yourdomain
MAIL_FROM_NAME=frogQuiz
MAIL_USERNAME=resend
MAIL_PASSWORD=<api key>
SKIP_EMAIL_VERIFICATION=False
```

`ROOT_ADDRESS` is what goes into the links, so it has to be the public URL people
browse to -- the Netlify site on a split deploy, not the API host. The confirmation
link is `/api/v1/users/verify/...`, which reaches the backend through the Netlify
proxy in `netlify.toml`.

Two things go wrong more often than anything else:

- **`MAIL_ADDRESS` is not a sender the relay will send for.** Every provider checks
  this. Use a verified sender, or an address on a domain with SPF and DKIM set up.
  The symptom is a message the app reports as sent and the provider silently drops
  or bounces.
- **`SKIP_EMAIL_VERIFICATION` is on.** Accounts are then created already verified and
  no confirmation is ever sent. That is a reasonable setting for an internal
  deployment; it is not a mail configuration, and password recovery still needs one.

**Mail is required.** Signing in is by an emailed link or code only (passwords are off,
`ENABLE_PASSWORD_LOGIN` defaults to false), so without a working relay nobody can sign in
on a new device. A failed send answers 502 after the retries. Players joining by PIN need
no account and no mail.

### Testing it for real

The suite reads every sign-in mail back from a local sink (`e2e/mailsink.py`), so the
templates and the links are tested. Whether a real provider delivers to a frog or
Capgemini inbox is not, and somebody has to check it once against the live relay.

The hotmail address chosen on 2026-10-02 can no longer sign in, since only team domains
can. Use a frog.co address, which is also the filter that matters: frogViz's own sender
was held back by frog's mail filter until its domain was a month old, and sends from
frogQuiz's for now.

Three things to check, in this order:

1. Sign in with that address. The mail should arrive with the code in its subject, and
   the link in it should open the real site (`ROOT_ADDRESS`, not the API host) and sign
   in. A first sign-in asks for a username.
2. Sign in again from a second device by typing the code instead.
3. Check the spam and quarantine folders. Landing there is a pass for the code and a
   fail for the deployment.

## Clean slate when the sign-in change ships

François's call on 5 Oct: start production from empty rather than carry accounts over,
since the sign-in change (D21) locks out every account not on frog.co or capgemini.com
anyway. **It deletes Gonçalo's account and quizzes too, so agree it with him first.**
There is no way to bring a single quiz back except from the backup below: Excel and
`.cqa` import are hidden (D6).

On the VM, in the directory that holds `docker-compose.yml`. First `git pull --ff-only`:
the checkout there was 150 commits behind on 6 Oct, and the compose file it ran was
missing the sign-in settings. Then check where Postgres lives, since issue #22 found the
repo cannot say: `docker compose exec api printenv DB_URL | sed -E 's#//[^@]*@#//***@#'`.
A host of `db:5432` means the `db` container, and the steps below work as written.

**Production is Neon** (found on 6 Oct, `COMPOSE_FILE=docker-compose.yml:docker-compose.neon.yml`
in the VM's `.env`, so plain `docker compose` picks both files up). There is no `db`
container and the VM has no Postgres client, so run the Postgres steps through a throwaway
container, with a client at least as new as the server (Neon was on 18, so `postgres:18-alpine`;
a 17 client refuses to dump it). `URL` is `DB_URL_OVERRIDE` from `.env`; never echo it.

```bash
URL=$(grep '^DB_URL_OVERRIDE=' .env | cut -d= -f2- | tr -d '"')
docker run --rm postgres:18-alpine pg_dump "$URL" | gzip > ~/frogquiz-before-wipe-$(date +%F).sql.gz
tar czf ~/frogquiz-uploads-before-wipe-$(date +%F).tgz uploads
# copy both files off the VM now, before the TRUNCATE below
docker run --rm postgres:18-alpine psql "$URL" -v ON_ERROR_STOP=1 -c "TRUNCATE users, quiz, storage_items CASCADE;"
```

Over `ssh host 'bash -s' < script`, give `docker compose exec -T` a `</dev/null`, or it
swallows the rest of the script as its stdin. These two blocks stand in for steps 1 and 2
below, tarball included, so do steps 3 to 5 as written after them.

```bash
docker compose pull && docker compose up -d      # the sign-in change goes live first
docker compose stop api worker                    # nothing writes while this runs

# 1. A backup, in case a quiz turns out to be wanted. Kept outside the app's volumes, but
#    on the VM's disk, which has no backup (#22): copy both files off the box before step 2.
docker compose exec -T db pg_dump -U postgres frogquiz | gzip > ~/frogquiz-before-wipe-$(date +%F).sql.gz
tar czf ~/frogquiz-uploads-before-wipe-$(date +%F).tgz uploads

# 2. Every account, quiz, upload record, game result, session and API key. One statement,
#    so it is all or nothing. The schema, the migration record and instance_data stay.
docker compose exec -T db psql -U postgres -d frogquiz -c "TRUNCATE users, quiz, storage_items CASCADE;"

# 3. The uploaded files (./uploads is mounted at /app/data).
sudo find uploads -mindepth 1 -delete

# 4. Sessions, cached users, live games, sign-in links and rate limits.
docker compose exec redis valkey-cli FLUSHALL

# 5. The search index, which still lists the public quizzes.
docker compose run --rm --no-deps api python -c "from frogquiz.config import settings, meilisearch; meilisearch.index(settings().meilisearch_index).delete_all_documents()"

docker compose start api worker
```

Then check: `docker compose exec -T db psql -U postgres -d frogquiz -c "select count(*) from users;"`
says 0, and signing in with a frog.co address makes a new account.

Rehearsed on the local stack on 5 Oct, after seeding it with the e2e specs: the TRUNCATE
reached every table that points at an account or a quiz (sessions, API keys, passkeys,
results, ratings, controllers, QuizTivity and both image link tables) and left
`alembic_version` alone; clearing Redis and the search index worked the same way; and 22
specs then passed on the empty database, signing up, building quizzes, hosting and
searching. Steps 1 and 3 are standard and were not rehearsed.

Rehearsed again on 6 Oct on the real thing: `docker-compose.yml` with the published
`ghcr.io/ogfrench/frogquiz-backend:master` image (the merged code), Postgres 14, valkey and
Meilisearch 0.28 (since moved to v1, see [Meilisearch v1](#meilisearch-v1)), seeded with two accounts, four quizzes, an uploaded image and an
anonymous quiz. This section's block ran as written, bar the compose flags and no `sudo`
on Windows. Backup first (the dump holds the seeded address, the tarball its files), then
users, quizzes and storage items at 0, `alembic_version` kept, uploads empty. Afterwards the
old session got a 401, the old quizzes and image a 404, a hotmail address a 403, and a
frog.co address made a new account that saved, indexed and found a public quiz. A failing
backup stopped the script before anything was deleted. Not rehearsed: a real relay, Neon,
and the Caddy and frontend containers.

## Managed Postgres (Neon)

The `db` container can be swapped for Neon when the app host has no persistent disk.
Verified working: `alembic upgrade head` and the running API both accept a Neon URI with
`?sslmode=require` -- psycopg2 and asyncpg each parse it without changes.

```bash
# point api + worker at Neon, keep the rest of the stack local
export DB_URL_OVERRIDE="postgresql://USER:PASSWORD@HOST.eu-central-1.aws.neon.tech/neondb?sslmode=require"
docker compose -f docker-compose.yml -f docker-compose.neon.yml up -d
```

For a real deployment, put the same URI in `DB_URL` and drop the `db` service and its
`depends_on` entries. Pick a Neon region next to the app host -- every query crosses the
network, so a Frankfurt app with a US database pays the round trip on each one.

Neon does not replace the rest: Redis, Meilisearch, the API and the arq worker still need
a host that runs long-lived containers.

## Python version

The Docker image and `Pipfile.lock` are both on Python 3.13. Bumping means changing
`Dockerfile`, `Pipfile`, regenerating `Pipfile.lock` and running the test suite —
`ormar`/`databases`/`sqlalchemy` are the likely breakage.

Backend lint, frontend lint and the backend test suite run on every pull request that
touches their files. The backend suite counts the lock and the migrations as its files,
so a Dependabot PR runs it. The audit runs on every pull request. The pytest workflow
copies `.env.ci`, a throwaway configuration with no credentials in it, so it needs no
repository secret.

## Security audit (#53)

`.github/workflows/audit.yml` runs on every pull request, on pushes to `master` and on
Monday mornings. Any one of these fails it:

- **Python:** any advisory in the locked production dependencies, unless it has a dated
  entry in `.github/audit/pip-audit-ignore.txt`. An entry past its revisit date fails the
  run too, so an exception never becomes permanent by accident.
- **Frontend:** a high or critical advisory in the production dependencies.
- **Images:** a high or critical finding with a fix in a third-party image pinned in
  `docker-compose.yml`. Dependabot does not track those.
- **Secrets:** a secret in a pull request's or a push's new commits, or, on the Monday
  run, anywhere in the history (gitleaks).

**First run, 11 Oct 2026 (V1 audit):**

- **Backend:** 124 advisories in 25 locked packages. The worst were in starlette,
  python-multipart, aiohttp, PyJWT, Pillow (which decodes every upload) and
  cryptography. Nothing had been failing on them.
  - The lock was regenerated with the fixed versions. That moved FastAPI to 0.135 with
    starlette 1.7.
  - Pillow was held below 11 by `thumbhash-python`, so its encoder is now vendored in
    `frogquiz/helpers/thumbhash.py`. A golden test checks it gives the same hashes.
  - Five advisories remain, each with a dated exception (2026-12-31):
    - python-jose and ecdsa, which have no fix and do not apply to HS256 tokens
    - ormar, held at 0.20.2 because 0.21 drops `databases`
    - two in setuptools, held there by ormar
  - Both holds go away with two post-V1 changes: replacing python-jose with PyJWT, and
    migrating ormar to SQLAlchemy 2.
- **Frontend:** `pnpm audit --prod --audit-level high` found nothing.
- **Images (first run in CI, on PR #57):**
  - `getmeili/meilisearch:v0.28.0`: 17 high and critical findings in its Alpine 3.14
    base (curl, OpenSSL 1.1, zlib). Meilisearch moved to v1.54.3, which scans clean. See
    [Meilisearch v1](#meilisearch-v1) for the deploy.
  - `postgres:14-alpine`: 25 findings, all in Go's standard library inside `gosu`. The
    image's own packages scan clean. gosu runs once at start to drop root and exec
    postgres, and parses no input, so the scan skips that one file.
  - `valkey/valkey:alpine`: clean.
- **Secrets:** gitleaks 8.28 over all 256 commits found five hits, and none is a
  credential to anything: the token-signing placeholders in `.env.ci` and `e2e/e2e.env`,
  and MinIO's public playground keys in a test inherited from ClassQuiz. They are allowed
  by fingerprint in `.gitleaksignore`, so a new secret in the same files still fails.
  A GitHub token planted in a throwaway local clone was caught. This was checked locally
  rather than with a throwaway branch on GitHub, so no fake secret was ever pushed.
  - CI's first run used gitleaks 8.24.3, the action's default, whose generic rule also
    flagged a hostname list in this file's `api.frogquiz.xyz` steps. `.gitleaks.toml`
    allows that one hostname by value, which holds however the line is later edited.
    The workflow now pins 8.24.3, which finds nothing else in the whole history. An
    unpinned version could turn the check red with no change here.
- **GitHub's own scanning:** the repository is public, so GitHub's secret scanning and
  push protection can also be switched on, under Settings → Code security. That is a
  settings change for the owner.

## Meilisearch v1

V1 moves the search server from v0.28.0 to v1.54.3, because the old image failed the
audit (above). The Python client, 0.37.1, already worked with v1: the e2e suite has run
against Meilisearch 1.54 since the first Linux runs. v1 cannot read v0.28's data, so it
gets a new volume, `meilisearch-data-v1`, and starts empty. Nothing is lost: the index
is a copy of the public quizzes in Postgres, and the API rebuilds it on start-up when
the counts differ. A search that finds no index rebuilds it too.

On the VM, with the V1 deploy or before it:

1. `git pull && docker compose pull && docker compose up -d`
2. `docker compose restart api`, so the rebuild runs once Meilisearch is up. The API
   does not wait for it, and a start that finds it down only logs a warning.
3. Search Explore for a known public quiz. `docker compose logs api | grep -i meili`
   shows the rebuild as a warning, "MeiliSearch and Database got out of sync".
4. Once search works, remove the old volume: `docker volume ls | grep meilisearch`,
   then `docker volume rm <project>_meilisearch-data`.

To go back, in `docker-compose.yml` put back `getmeili/meilisearch:v0.28.0`, the mount
`meilisearch-data:/data.ms`, and `meilisearch-data:` under the top-level `volumes:`
(compose refuses a mount of an undeclared volume). Until step 4, the old volume is still
there.

## API hostname: `api.frogquiz.xyz`

The API was reached at `134-98-158-173.sslip.io`, a name sslip.io derives from the VM's IP,
so any new IP broke every link. It moves to `api.frogquiz.xyz` (D32). Do it in this order,
so nothing is ever unreachable:

1. **DNS (François, in Netlify).** `frogquiz.xyz` is served by Netlify DNS (its
   nameservers are `dns1` to `dns4.p05.nsone.net`, checked 11 Oct). In the Netlify UI:
   Domains, `frogquiz.xyz`, DNS settings, Add new record: type `A`, name `api`, value
   `134.98.158.173` (the VM's public IP), TTL default. Then
   `dig +short api.frogquiz.xyz` (or `nslookup api.frogquiz.xyz`) prints the IP.
2. **Caddy serves both names (François, on the VM).** In `/opt/frogquiz/.env` set
   `SITE_ADDRESS=api.frogquiz.xyz, 134-98-158-173.sslip.io`, then
   `docker compose up -d proxy`. `COMPOSE_FILE` in the same `.env` already selects the
   Neon override, so no `-f` flags. Caddy fetches a certificate for each name on its
   first request. `curl -sI https://api.frogquiz.xyz/openapi.json` returns 200.
   While there, check two values that the browser depends on and that the move does not
   change: `CORS_ORIGINS` lists `https://frogquiz.xyz` and `https://www.frogquiz.xyz`
   (live games open their socket straight to the API, and it refuses any other origin),
   and `ROOT_ADDRESS` is `https://frogquiz.xyz` (the address in every sign-in email).
3. **Point the frontend at it (Claude, on the `v1` branch, once step 2 answers).** In
   `netlify.toml`, the host in `VITE_API_ORIGIN`, `API_URL` and the two `[[redirects]]`
   targets. Check the Netlify UI does not override them (Site configuration,
   Environment variables). It ships with the V1 deploy.
4. **Later:** drop the sslip.io name from `SITE_ADDRESS` once no shared link uses it.

Deploy previews build with the same `netlify.toml`, so they call the production API too.
Their sockets are refused (their origin is not in `CORS_ORIGINS`), and a sign-in link from
one goes to `ROOT_ADDRESS`, not to the preview. Use the local stack for anything that needs
a live game.
