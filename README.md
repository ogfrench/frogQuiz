<!--
SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
SPDX-FileCopyrightText: 2026 François & Gonçalo

SPDX-License-Identifier: MPL-2.0
-->

# [frogQuiz](https://frogquiz.xyz)

**Live quizzes for teams. Create a quiz, share the PIN, and get everyone playing.**

One person hosts on a shared screen. Everyone else joins from their phone with a PIN
and a nickname. Answer against the clock, watch the leaderboard, and see who comes
out on top. No app to install.

Build a quiz from scratch or import up to 50 questions from Excel. Guests can create,
edit, and host quizzes without an account. Sign in to keep your quizzes permanently
and explore the frog and Capgemini collection.

## Quick start

- **Play or host**: [frogquiz.xyz](https://frogquiz.xyz).
- **Create a quiz**: open **My Quizzes → Create a quiz**, then choose **Start from scratch** or **Import from Excel**.
- **Import a workbook**: download the template in the import dialog, add your questions, and review the preview before creating the quiz.
- **Keep your quizzes**: sign in, then choose **Keep all** or claim individual quizzes in **My Quizzes**.
- **Self-host**: [DEPLOY.md](DEPLOY.md) covers Docker, a single-host setup, and a Netlify frontend with a separate backend.

Guest quizzes last 30 days and belong to the browser that created them. Clearing
browser data can remove your access. Signing in offers to save them to your account;
it does not claim them automatically on a shared computer.

## What you can do

- **Create and edit** questions, answers, timers, and quiz details.
- **Import Excel** with a downloadable template, row-level validation, and a preview of every question and its correct answers.
- **Host live games** with PIN-based joining, timed answers, scores, and a podium.
- **Manage your library** in My Quizzes, including temporary browser quizzes and permanent account quizzes.
- **Explore team quizzes** from frog and Capgemini when signed in.

The interface is in English. See [MVP scope](docs/mvp-scope.md) for supported features
and the boundaries of this edition. Features described here follow this branch;
the hosted site may be on an earlier release.

## Development

Copy `.env.example` to `.env` and fill in the settings described in [DEPLOY.md](DEPLOY.md).
Start the backing services, then run the backend and frontend in separate terminals:

```bash
# Postgres, Redis, and Meilisearch
docker compose -f docker-compose.dev.yml up -d

# Backend
pipenv sync --dev
pipenv run alembic upgrade head
pipenv run uvicorn frogquiz:app --reload

# Frontend, in another terminal
cd frontend
pnpm install
pnpm run dev
```

### Tests

```bash
# Backend: starts and stops isolated test services
CONTAINER_BIN=docker ./run_tests.sh a

# Frontend unit tests
cd frontend && pnpm run test

# Browser journeys, from the repository root
bash e2e/run.sh
```

CI checks backend and frontend tests, lint, type checking, the production build,
and browser journeys. Test services use a separate configuration from production.

## Docs

| | |
|---|---|
| [DEPLOY.md](DEPLOY.md) | Hosting, configuration, and search-index setup |
| [docs/anonymous-vs-account.md](docs/anonymous-vs-account.md) | Guest access, accounts, expiry, and ownership |
| [docs/mvp-scope.md](docs/mvp-scope.md) | Features and product scope |
| [docs/redesign-status.md](docs/redesign-status.md) | UI work and remaining surfaces |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributing |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

## Built with

**SvelteKit, Svelte, Tailwind CSS, and shadcn-svelte** on the frontend.
**FastAPI, python-socketio, ormar, and arq** on the backend.
**Postgres, Redis, and Meilisearch** for storage, queues, and search.

The backend lives in [`frogquiz/`](frogquiz/), the frontend in
[`frontend/`](frontend/), and database migrations in [`migrations/`](migrations/).

## Credits

frogQuiz builds on [ClassQuiz](https://github.com/mawoka-myblock/ClassQuiz) by
Marlon W (Mawoka) and its contributors, which provides the original quiz application
and realtime game foundation.

**Work developed in frogQuiz** includes the redesigned interface and team-focused
experience, temporary guest ownership and account claiming, the Excel validation
and preview flow, and the supporting deployment documentation and browser tests.
See [CHANGELOG.md](CHANGELOG.md) for the development history.

The frog avatars use [Adventure Frog](https://intellikat.itch.io/frog-adventure-character-spritesheet)
by [intellikat](https://intellikat.itch.io/), under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
They have been cropped, recoloured, and given tongues assembled from the sheet's
pieces. The artist does not endorse frogQuiz. Details are in the
[avatar README](frontend/src/lib/assets/frogs/README.md).

## License

Code is licensed under the **Mozilla Public License 2.0** ([MPL-2.0](https://www.mozilla.org/en-US/MPL/2.0/)).
Frog avatar assets retain their **CC BY 4.0** license; see [`.reuse/dep5`](.reuse/dep5).
