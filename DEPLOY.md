<!--
SPDX-FileCopyrightText: 2026 ogfrench

SPDX-License-Identifier: MPL-2.0
-->

# Deploying frogQuiz

## What can and cannot go on Netlify

Netlify hosts the **SvelteKit frontend only**. The backend cannot run there: it is a
long-lived FastAPI + socket.io process with an arq worker, Postgres, Redis and
Meilisearch behind it. Netlify Functions are ephemeral and have no WebSocket support,
so gameplay traffic (`/socket.io/*`) cannot pass through Netlify at all.

Two supported layouts:

| Layout | Frontend | Backend |
| --- | --- | --- |
| Single host (simplest) | container from `docker-compose.yml` | same compose stack |
| Split | Netlify | container host (VPS, Fly, Railway) running the same compose stack |

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
4. Set `ROOT_ADDRESS` to the Netlify site URL (it is what appears in emails and links).

`NETLIFY=true` is set by Netlify during builds, which is what switches
`svelte.config.js` from `adapter-node` to `adapter-netlify`. Local and Docker builds
are unaffected.

Trade-off: this splits the deployment across two providers and puts the socket on a
different origin than the page. Option A is cheaper and has fewer moving parts.

## Python version

The Docker image and `Pipfile.lock` are both on Python 3.13. Bumping means changing
`Dockerfile`, `Pipfile`, regenerating `Pipfile.lock` and running the test suite —
`ormar`/`databases`/`sqlalchemy` are the likely breakage.

Backend and frontend lint now run on pull requests. The pytest workflow still does not:
it decodes a base64 `.env` from the `DOTENV` repository secret, which this fork does not
have. Add that secret and uncomment the `pull_request` trigger in
`.github/workflows/pytest.yml` to gate merges on the test suite.
