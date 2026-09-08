# FrogQuiz

Internal Kahoot-style quiz tool, forked from the open-source **ClassQuiz** project (MPL-2.0, original author Marlon W / "Mawoka"). Currently rebranding to a frog-themed identity for internal team use, with room to expand to a wider audience later if it proves useful.

## Project status

- **Scope**: internal tool for now. Don't over-invest in things only public/multi-tenant products need (billing, heavy scalability, public docs) unless asked — but don't actively break the ability to widen scope later either.
- **Stack** (inherited from ClassQuiz, see repo root for details): FastAPI + python-socketio backend (`frogquiz/`), SvelteKit 2/Svelte 5 + TypeScript frontend (`frontend/`), Postgres, Redis, Meilisearch, Alembic migrations.
- **Redesign direction**: moving to a frog-themed visual identity built with **shadcn-svelte** (see below). In progress — the foundation and the login reference page are done, the remaining routes are not.

## Redesign: shadcn-svelte

Config lives in `frontend/components.json`: style `vega`, base colour `zinc`, theme `green` (this is what makes `--primary` the frog green), Lucide icons, Inter. Components land in `frontend/src/lib/components/ui/`, the `cn` helper in `frontend/src/lib/utils.ts`.

- **Adding components**: `node ./node_modules/shadcn-svelte/dist/index.mjs add <name> -y -o` from `frontend/`. The `-y -o` flags matter — without them the CLI opens a TUI that cannot be driven from a piped stdin, and it will hang.
- **There is no shadcn-svelte MCP server.** The `shadcn-svelte` CLI has no `mcp` command, and the generic shadcn (React) MCP cannot read this registry: it requests an index at `/registry/registry.json` (shadcn-svelte serves `index.json`), and its item schema requires `files[].path` where shadcn-svelte emits `target`. Don't re-litigate this — use the CLI. For docs and usage examples, the Context7 MCP covers shadcn-svelte.
- **Reproducing the config**: preset code `bJNGQT2` encodes all of the above. `node ./node_modules/shadcn-svelte/dist/index.mjs apply --preset bJNGQT2 -y` re-applies tokens and font to `app.css`. Presets are generated with `encodePreset` from `shadcn-svelte/dist/preset/index.mjs` if the choices need to change.
- **`app.css` is merged, not owned.** The CLI preserved the SPDX header, the tippy imports, the `@config '../tailwind.config.cjs'` line (which still supplies the `green-600` brand override) and the legacy `@utility` blocks. Re-running `apply` keeps them; don't hand-replace the file.
- **The canonical base layer is live** — `body` takes `bg-background` and `*` takes `border-border`. Unmigrated routes therefore sit on the token background rather than the old `#d6edc9` green. That was a deliberate call: a grep found zero bare `border` classes, so the only visible effect is the page ground the redesign was replacing anyway.
- **Node toolchain**: pnpm 10 (lockfile is v9). pnpm is not on PATH by default; it is at `%APPDATA%
pm`. The `build` script uses `NODE_ENV=production vite build`, POSIX syntax that fails under cmd.exe — run builds from a POSIX shell.

## Frontend verification

Changes to UI should be checked in a browser, not assumed. The dev server binds IPv6-only, so use `http://localhost:3000`, not `127.0.0.1`. Worth asserting on each check, since all three have regressed before: `document.documentElement.classList.contains('dark')` (proves the class toggle works rather than the OS media query), `scrollWidth > clientWidth` (the `w-screen`/`100vw` overflow), and `getComputedStyle(document.body).backgroundColor` (proves tokens are applied).

## Feature triage (internal-tool lens)

The app carries a lot of features aimed at a public multi-tenant SaaS. For an internal Kahoot clone, default posture:

- **Hide/disable, don't delete** anything not needed right now (public docs pages, GitHub links in nav/footer, moderation tooling, public OAuth providers beyond what the team actually uses, box-controller/physical-buzzer hardware support, Pixabay integration, hCaptcha/reCAPTCHA, proof-of-work anti-bot challenge, Sentry/Plausible telemetry if unused). Prefer feature flags, route guards, or commenting out nav entries over ripping code out — we may want these back.
- **Search bar**: keep. Useful for finding/sharing quizzes made by other people on the team.
- When asked to "clean up" or "trim" the app, propose a list of hide/disable candidates with rationale and wait for a decision before touching anything — don't remove features unilaterally.
- Remaining known leftover: README Credits section still links to upstream's own donation buttons (Ko-fi/Liberapay) — low priority, flag if touching that file.

## Upstream independence

FrogQuiz should not send data to, or depend at runtime on, servers controlled by the original ClassQuiz maintainer ("Mawoka"). This is separate from MPL-2.0/SPDX attribution (below), which is static legal text, not a network call or data flow.

- Before adding any third-party script, API call, downloadable asset, or contact link, check it isn't pointing at `mawoka.eu` or other upstream-controlled infrastructure.
- Already fixed: `frontend/Dockerfile`'s `API_URL` default (was `https://mawoka.eu`, now points at the internal `api` service), the Plausible analytics script and Sentry error reporting (both removed, were pointing at Mawoka's own instances), the newsletter signup form (removed — it posted visitor emails to `newsletter.mawoka.eu`), the quiz-report mailto, the import-template download link, the email footer link, and `CONTACT.md`/`CONTRIBUTING.md`/ToS contact info (repointed to internal placeholders — see TODOs in those files for the team's real contact channel).
- `docs/attribution`'s credits to real individual upstream contributors and translators were kept — that's legitimate attribution to people, not a data-flow or infrastructure dependency.

## Licensing (MPL-2.0 / REUSE)

- Source files carry `SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)` + `SPDX-License-Identifier: MPL-2.0` headers under the REUSE spec.
- **Never strip or alter existing copyright/license headers.** When substantially modifying a file, add a second `SPDX-FileCopyrightText` line for FrogQuiz contributors rather than replacing the original (see `README.md` for the existing dual-header pattern).
- If a request would require removing/altering these headers, flag it and check with the team rather than doing it silently — MPL-2.0 has real attribution obligations even for internal-only use, and getting this wrong could matter if the tool ever gets shared more widely.

## Changelog

Every time you make a code/config change in this repo (not for pure Q&A or research), append an entry to `CHANGELOG.md` under an `## Unreleased` section at the top, one line per change, in plain past-tense terms a teammate can scan (e.g. "Removed GitHub link from footer nav"). Do this automatically as part of the change, without being asked each time.

## Collaboration workflow

- Both teammates work on a **shared branch** — no heavy PR/branching ceremony for this internal project.
- Quality/safety gate: commits should go through a **Claude review pass using a cheap/fast model** before being considered done, checking for correctness and safety issues (not a full design review). Treat this as the equivalent of a lightweight teammate review, not a blocker for experimentation.
- Since there's no formal PR review, be more conservative by default on risky operations (schema changes, deleting code, touching auth/session logic) — surface them clearly rather than assuming shared context.
