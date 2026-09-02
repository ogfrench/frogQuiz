<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 François & Gonçalo

SPDX-License-Identifier: MPL-2.0
-->

<a href="https://github.com/ogfrench/frogQuiz/stargazers"><img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/ogfrench/frogQuiz?style=for-the-badge"></a>
<a href="https://github.com/ogfrench/frogQuiz/graphs/contributors"><img alt="GitHub contributors" src="https://img.shields.io/github/contributors/ogfrench/frogQuiz?color=green&style=for-the-badge"></a>
<a href="https://github.com/ogfrench/frogQuiz/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc"><img alt="GitHub issues" src="https://img.shields.io/github/issues/ogfrench/frogQuiz?style=for-the-badge"></a>
<a href="https://github.com/ogfrench/frogQuiz/blob/master/LICENSE"><img alt="License" src="https://img.shields.io/github/license/ogfrench/frogQuiz?style=for-the-badge"></a>
<a href="https://github.com/ogfrench/frogQuiz/actions/workflows/pytest.yml"><img alt="PyTest" src="https://img.shields.io/github/actions/workflow/status/ogfrench/frogQuiz/pytest.yml?branch=master&label=tests&style=for-the-badge"></a>

<div align='center'>
    <h2 align='center'>frogQuiz</h2>
    <img src='logo.png' alt='frogQuiz Logo' height='100px' width='100px'>
    <p align='center'>
        The open-source quiz-platform!
        <br/>
        <a href='https://frogquiz.xyz/'><strong>Visit the website »</strong></a>
        <br />
        <br />
        <a href='https://frogquiz.xyz/docs'>Docs</a>
        ·
        <a href='https://frogquiz.xyz/account/register'>Register</a>
        ·
        <a href='DEPLOY.md'>Deploying</a>
        ·
        <a href='https://github.com/mawoka-myblock/ClassQuiz'>Upstream project</a>
    </p>
</div>

## About frogQuiz

frogQuiz is a quiz app to learn interactively for students,
but open-source which is very important if it is a product for educational
purposes.
You can create quizzes and play them remotely with other people.
It is mainly made for teachers who create a
quiz, so students can compete with their knowledge against each other.

frogQuiz is a fork of [ClassQuiz](https://github.com/mawoka-myblock/ClassQuiz) by
Marlon W (Mawoka). See [Credits](#credits) below.

## Try it

The frontend is at [frogquiz.xyz](https://frogquiz.xyz).
It is hosted on Netlify, and it talks to a backend running on a separate
container host, because socket.io cannot go through Netlify's proxy.

## Running it yourself

Everything you need is in **[DEPLOY.md](DEPLOY.md)**, which covers the two
supported shapes:

- **Option A** — the whole stack on one host, behind the bundled Caddy.
- **Option B** — frontend on Netlify, backend on a container host.

It also documents the free hosting path (Oracle Cloud Always Free), using
[Neon](https://neon.tech) instead of the local Postgres container, and the
Python version the backend needs.

Quick start for a local stack:

```bash
cp .env.example .env       # then fill in SECRET_KEY, POSTGRES_PASSWORD, mail settings
docker compose up -d
```

## Development

Bring up the backing services, then run the two halves separately:

```bash
# Postgres, Redis, Meilisearch and MinIO for local development
docker compose -f docker-compose.dev.yml up -d

# backend
pipenv sync --dev
pipenv run alembic upgrade head
pipenv run uvicorn frogquiz:app --reload

# frontend
cd frontend && pnpm install && pnpm run dev
```

### Tests

The backend suite needs the development services above. `run_tests.sh` starts
them, runs the tests and tears them down again:

```bash
CONTAINER_BIN=docker ./run_tests.sh a
```

It defaults to `podman`; set `CONTAINER_BIN=docker` if that is what you have.
CI runs exactly this command against [.env.ci](.env.ci), a throwaway config
holding no credentials.

### Search index

Meilisearch is populated from Postgres. After a fresh deployment, or if the
index name changes, rebuild it once:

```bash
docker compose exec api python import_to_meili.py
```

## Repository layout

This is a monorepo:

| Path | What lives there |
| --- | --- |
| [`frogquiz/`](frogquiz/) | The FastAPI backend, socket.io server and arq worker |
| [`frontend/`](frontend/) | The SvelteKit frontend |
| [`migrations/`](migrations/) | Alembic database migrations |
| `Pipfile` | The backend project, at the repository root |

### Tech stack

**Backend** — [FastAPI](https://fastapi.tiangolo.com/) (web framework),
[ormar](https://github.com/collerek/ormar/) (ORM),
[python-socketio](https://python-socketio.readthedocs.io/en/latest/) (realtime
communication between server and client), [arq](https://arq-docs.helpmanual.io/)
(background jobs).

**Frontend** — [SvelteKit](https://kit.svelte.dev/) (web framework) and
[TailwindCSS](https://tailwindcss.com/) (CSS framework).

**Services you host yourself**

- [Postgres](https://www.postgresql.org/) (database)
- [Redis](https://redis.io/) (cache and job queue)
- [Meilisearch](https://www.meilisearch.com/) (search server)
- [Caddy](https://caddyserver.com/) (reverse proxy)
- S3-compatible object storage, or local disk

**Closed-source third parties** (optional)

- [Mapbox](https://www.mapbox.com/) (maps)
- [hCaptcha](https://www.hcaptcha.com/) (captcha)

## Credits

frogQuiz is a fork of [ClassQuiz](https://github.com/mawoka-myblock/ClassQuiz),
written by Marlon W (Mawoka), who deserves the credit for essentially all of
the software here. The upstream project has its own hosted instance at
[classquiz.de](https://classquiz.de), its own
[docs](https://classquiz.de/docs), and welcomes support:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/K3K3CK3ES)

<a href="https://liberapay.com/Mawoka/donate"><img src="https://img.shields.io/liberapay/goal/Mawoka.svg?logo=liberapay"></a>

## License

This repository is licensed under the
[Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/). Please
review the license to understand your rights and obligations — in particular,
the MPL requires that modifications to covered files stay open source.
