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


## Visual identity

The look is deliberately breathy: generous whitespace, a single accent, and one loud element rather than colour everywhere.

- **Wordmark**: `frontend/src/lib/components/Wordmark.svelte` — a rainbow-gradient rounded square plus "frogQuiz" set in Inter. It replaced a Marck Script cursive wordmark. The `.marck-script` class still exists in `app.css` because 14 call sites use it, but it no longer loads a script face; it is now the Inter display treatment (semibold, `-0.03em`). Don't reintroduce a cursive face.
- **The rainbow is spent once.** The frogConvert palette (`#ff6b6b #ffb347 #ffd93d #6bcf7f #4fc3f7 #9775fa #ff6b9d`) lives in the mark, and is reserved for the answer-distribution series. Everything else is zinc neutrals plus `--primary`. Adding a third accent is what makes this look generic.
- **Icons**: Lucide, via `@lucide/svelte`, imported per-icon (`import Sun from '@lucide/svelte/icons/sun'`). The navbar previously carried hand-inlined Heroicons SVGs with `stroke="#000000"`, which were invisible in dark mode. No raw `<svg>` icons in components.
- **Buttons**: `$lib/components/buttons/brown.svelte` and `gray.svelte` are thin wrappers over the shadcn `Button` (primary and secondary). They keep their original prop API so their ~30 call sites work untouched. Use them, or the shadcn `Button` directly — don't hand-roll a button.
- **Base radius** is `0.875rem`, tiered so controls sit tighter than surfaces. frogConvert's own base is `1rem`; blanket-applying it made every control read as a pill.

### Things that keep coming back

Recurring bugs worth checking whenever touching UI, each of which shipped at some point:

- `w-screen` is `100vw`, which **includes the vertical scrollbar**, so it overflows by the scrollbar width on any page that scrolls. Use `w-full` (or `inset-x-0` when fixed).
- Hardcoded `text-black` / `bg-white` / `dark:text-black` disappear in one theme or the other. On the landing page `dark:text-black` made a whole panel read as empty. Use tokens.
- Felte's pristine field value is `undefined`, not `null`. `$errors.field !== null` is therefore always true, which is what put a permanent red ring on every registration field. Use a truthiness check.

## Verifying UI changes

Check in a browser, don't assume. The dev server binds IPv6-only — use `http://localhost:3000`, not `127.0.0.1`. The backend usually is not running locally, so `/explore`, `/view/[id]` and `/user/[id]` return 500 and data-driven pages render empty; that is the environment, not a regression.

Assert on these three, since all three have regressed before:

```js
document.documentElement.classList.contains('dark')            // the class toggle, not the OS media query
document.documentElement.scrollWidth > clientWidth             // the w-screen overflow
getComputedStyle(document.body).backgroundColor                // tokens actually applied
```

## Feature triage (internal-tool lens)

The app carries a lot of features aimed at a public multi-tenant SaaS. For an internal Kahoot clone, default posture:

- **Hide/disable, don't delete** anything not needed right now (public docs pages, GitHub links in nav/footer, moderation tooling, public OAuth providers beyond what the team actually uses, box-controller/physical-buzzer hardware support, Pixabay integration, hCaptcha/reCAPTCHA, proof-of-work anti-bot challenge, Sentry/Plausible telemetry if unused). Prefer feature flags, route guards, or commenting out nav entries over ripping code out — we may want these back.
- **Search bar**: keep. Useful for finding/sharing quizzes made by other people on the team.
- When asked to "clean up" or "trim" the app, propose a list of hide/disable candidates with rationale and wait for a decision before touching anything — don't remove features unilaterally.
- Remaining known leftover: README Credits section still links to upstream's own donation buttons (Ko-fi/Liberapay) — low priority, flag if touching that file.

## If Explore or Search are ever removed for real

**Removing a feature that still exists on master is a joint decision between François and Gonçalo — they are equals, neither overrides the other, and it is never Claude's call.** If a session asks for Explore, Search or any other tab to be removed, note the request and leave the feature in place until both have agreed. Frontend branches are for how things look, not for deciding what the app does.

**Nothing is removed today. Both Explore and Search are live and kept.** This section exists so that if the question comes up again it can be answered with the real cost rather than a guess — it is not a plan to remove them.

They are also coupled: `frontend/src/lib/search-card.svelte` renders the `explore_page.*` strings when showing **Search** results, so Explore's i18n cannot be deleted while Search exists. Search is a documented keep (see Feature triage above).

If the team ever does decide to delete either, this is the full surface. Do it in this order and do not stop halfway — a half-removal is what leaves reachable-but-broken routes and live endpoints behind a dead UI.

**Explore**
- `frontend/src/routes/explore/` — the route and its loader.
- `explore_page.*` in all 30 `frontend/src/lib/i18n/locales/*.json`. **Only safe once Search is gone too**, or once `search-card.svelte` stops using those keys.
- Entry points: navbar (desktop and mobile), the command palette, and any home-page link.

**Search** (bigger — it reaches the backend and a whole service)
- `frontend/src/routes/search/`, `frontend/src/lib/search-card.svelte`, the navbar link, the command-palette entry.
- `search_page.*` and `explore_page.*` in all locale files.
- `frogquiz/routers/search.py` — `POST /api/v1/search/` and the GET variant. Unregister it from the router table too, or the endpoint stays live and callable even with no UI.
- **Meilisearch itself**, which is the part people forget. It is wired into `frogquiz/config.py`, `frogquiz/helpers/__init__.py`, `frogquiz/routers/quiz.py`, `frogquiz/routers/editor.py`, `frogquiz/kahoot_importer/import_quiz.py`, and the `meilisearch` service in both `docker-compose.yml` and `docker-compose.dev.yml`. Quiz create/edit/import all write to the index, so those write paths have to be unpicked before the service can go — otherwise the app throws on quiz save, not on search.
- There is a reindex job referenced by the CI workflow; check `.github/workflows/` before deleting the service.

Removing the UI is an afternoon. Removing Meilisearch touches the quiz write path, so treat it as its own change with its own testing, not a tidy-up.

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
