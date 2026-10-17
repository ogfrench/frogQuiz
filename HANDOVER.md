<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# Handover

The newest section comes first. The older ones are kept below for the decisions and commands
they record.

## Outage, backups and the gaps behind them (13 to 16 Oct)

**What shipped since 12 Oct.**
- **#63, #64 and #66 (v0.8.1):** the sound kit, the round card, a faster podium, pick your
  frog, and `.cqa` image ids.
- **#67:** guests can create, import from Excel and host. This is on by default (D40 to D43),
  with Keep all after sign-in.
- **#70 and #71:** the production guest-access workflow (`docs/github-production-access.md`),
  the server-rendering socket fix, players rejoining after a lost connection, and the new
  Terms, Privacy and Attribution.
- **#76:** fixes for the CodeQL alerts on upload paths and title HTML.

The trackers were merged on 15 Oct into #72 (operations), #73 (V1 quality) and #74 (post-V1),
with #69 (incident) and #68 (MCP) kept apart.

**The outage (16 Oct).** #76 put `sanitize-html` on the server. On Netlify's function runtime
it `require()`s `htmlparser2`, which is an ES module, so every server-rendered page returned
502 from about 04:09 UTC. The API stayed healthy, and nothing alerted. Plain Node 22 and later
allows that `require()`, which is why CI and e2e stayed green. #77 carries the fix
(`ssr.noExternal` for builds) and adds `.github/workflows/netlify_ssr.yml`. That check builds
with `NETLIFY=true` and renders `/`, `/explore`, `/play` and `/create` through the generated
function under `--no-experimental-require-module`. It fails on #76's code and passes on
#77's. #77's own red e2e test clicked Discover before hydration, so the server fetched the
examples, where `page.route` cannot see them. The test now waits for `networkidle`, the
suite's convention.

**Backups (#61, D44).** The setup:
- `.github/workflows/backup.yml` runs nightly. It uses `deploy/backup.sh` on the VM,
  `deploy/backup-run.sh` on the runner and `deploy/restore.sh` for restores, with
  `deploy/test_backup_restore.sh` in CI. The runbook is in `DEPLOY.md`, "Backups".
- The age public key is committed as `deploy/backup-recipient.txt`. The private key was
  generated in the 16 Oct session and handed to François as a file. It is not on GitHub.
- No GitHub secret is needed. The nightly job uses the `production` SSH secrets that
  already exist. Cloud sessions cannot write secrets anyway: their proxy refuses the Actions
  secrets and environments endpoints by policy.

**Joining a game (#82, #84, D45).** One PIN box (`frontend/src/lib/components/PinEntry.svelte`)
serves `/` and `/play`. A wrong PIN stays on screen with the error under it, the PIN is checked
at six digits, and the player moves on with Join. The nickname step was redesigned around a
mystery frog the lobby reveals. Merged as `1f11b54` and live.

**AI agents over MCP (#83, D46).** Gonçalo's MVP merged on 16 Oct as `125c5ad`: list, read and
create quizzes from Claude Code, Cursor or Claude Desktop with a personal `fq_` key. **It is
on in production since 16 Oct, about 21:00 UTC** (#85 added the Production ops modes that
did it, #86 the arm64 build of the MCP image). The backend runs `125c5ad`, the database is
at `a7c3e5f1b9d2`, and `https://api.frogquiz.xyz/mcp` answers 401 without a key. Still to
do: a real Claude Code session with a key, recorded on #68. The steps, and how to turn it
off, are in `DEPLOY.md`, "AI agents (MCP)". What V1 adds
(edit, delete, copy, public quizzes, images, Excel, `/live` closed to agent keys) is D46 and
#68. Gonçalo started on import the same evening; it goes on its own branch from master.

**Uptime.** `.github/workflows/uptime.yml` checks the frontend pages and the API's health
every 30 minutes. It is a stopgap until #72's monitor exists.

**Open, in order.**
1. ~~The first real restore, timed and written into `DEPLOY.md`~~: done on 16 Oct
   (`DEPLOY.md`, "First real restore").
2. ~~#76's backend fix on the VM~~: done, the VM runs `125c5ad`, which carries it.
3. ~~The Oracle VM was over the free A1 limit~~: resized to 2 OCPU / 12 GB on 17 Oct
   (François, in the console). The facts run after the reboot shows 2.0 / 12, every
   container healthy and `/api/v1/health` ok. What stays a risk, idle reclamation, is in
   `DEPLOY.md`, "Staying inside Always Free".
4. ~~The v0.9 cut~~: #88 merged on 17 Oct; `frontend/package.json` is `0.9.0` and
   `CHANGELOG.md` has its `## v0.9` section. The `v0.9` tag goes on the release PR's merge
   commit, from the laptop. The plan for the rest of V1 is on #73.
5. ~~The #83 migration deploy~~: done on 16 Oct with Production ops **migrate**. Backend
   deploys without a migration go through **deploy** again.

## Game polish, PR #63 (12 Oct, evening)

François used v0.8 and asked for changes; they are in PR #63 and wait for his go to merge and
deploy: our own sound kit (C5) for every moment, the answers and the standings as one card that
animates, the start dialog as one sentence plus "Game options", a faster podium with a hit per
place, and a frog on the account (nullable `users.frog`, migration `e4a1f9c2d7b0`, flagged in
the PR). The sound recipe and how to regenerate it are in `frontend/src/lib/assets/music/README.md`.
Left over: the hidden `.cqa` import still writes image ids without dashes (noted in #42), and
the listening pages and sheets are in the session's scratch folder only. v0.9 is unchanged.

## v0.8 shipped, v0.9 next week (12 Oct)

**Shipped 12 Oct:** PR #62 merged as `aac0751`, tagged `v0.8`. The VM runs it (api and worker
healthy, Redis kept, so nobody was signed out), the five examples are seeded, and
`https://api.frogquiz.xyz/api/v1/health` answers ok for every part, GET and HEAD. Netlify
published it; its bundle calls `api.frogquiz.xyz` only. `v1` was moved up to master.

**What v0.8 is** (PR "v0.8: V1 step 4"). It
has #40 (Play beside Save, new tab), #39 (five approved example quizzes in Discover, Copy to
my quizzes) and #60 (`/api/v1/health`, a worker heartbeat, compose healthchecks), and points the
frontend at `api.frogquiz.xyz`. The DNS record, Caddy's second name and the Netlify UI's
`API_URL` and `VITE_API_ORIGIN` were changed on 12 Oct; they take effect at the next Netlify
deploy. Full e2e on a fresh stack: 256 passed, 9 skipped, 0 failed. The deploy steps are in
the PR: `docker compose up -d`, then the seed, then a health check.

**Next week, in order** (each issue has a status comment with the same order):

1. v0.9: #42 (hidden menus on the live screens, plus an inventory of hidden routes from which
   François picks what comes back), then #44 (style note, a guard test, fixes by area), and #50
   (stale docs, then the privacy and terms text for François to approve).
2. v1.0: #61 (needs François's OCI bucket first), #45 trimmed, the final review, the deploy.

**Learned on 12 Oct:** the Agent tool's worktree isolation refuses on this laptop (make the
worktree by hand, see CLAUDE.md); two stacks at once make timeouts that look like bugs; the
Netlify UI's variables, not `netlify.toml`, are what server-side rendering reads; image ids in
quiz JSON must be the dashed form, or the orphan sweep deletes them (the hidden `.cqa` import
still writes the other form, noted in #42); `e2e/pytest.sh` runs the backend suite without
Docker. The `token-efficiency` skill (claude-code-setup PR #5) holds the working habits.

**Still for François:** the uptime monitor account, #22 (VM resize by about 25 Oct), branch
protection on master, the OCI bucket for #61, deleting `C:\c`.

## v0.5 shipped (12 Oct)

The 11 Oct section below was worked through on the laptop, and v0.5 shipped from it. The
roadmap issue, #56, says V1 ships in four releases; `v1` now starts v0.8.

**Done since 11 Oct:** items A to J of "What we missed" (the copy follows the setting, a second
e2e pass with the setting off, every #43 claim case with a message for each failure and checked
on a phone, #35's last rows measured, #55's CRUD grid, the review's findings); D37 and D38;
François's pick of a title card before question 1 and a lobby that stops at the edge of the
screen with "+N more" (mockups: claude.ai artifact `FtuyMZ3oxxq6ZqacYR5iEa`); CHANGELOG cut to
`v0.5`, `frontend/package.json` at 0.5.0; the merged branches `MVP-game-polish` and
`ccr-370df3e4-c44t1l` deleted on GitHub. The VM has `TRUSTED_PROXY_HOPS=2`, rate limiting on
by default, `ANONYMOUS_QUIZZES_ENABLED` unset and every `MAIL_*` key.

**Shipped:** PR #57, "v0.5: V1 steps 0 to 3", merged on 12 Oct as merge commit `27c5171`. Tags
are `mvp` on `8e69034` and `v0.5` on `27c5171`. The `v1` branch was restarted from master for
v0.8. The VM at `/opt/frogquiz` runs `27c5171` after `git pull`, `docker compose pull && docker
compose up -d`, and `docker compose restart api`. All six containers are up. Meilisearch v1
rebuilt its index, which the API log reports as "MeiliSearch and Database got out of sync".
From outside, `/api/v1/utils/config` answers `{"anonymous_quizzes_enabled":false}` and
signed-out search answers 401. Netlify published the new frontend on its own. François chose
not to pause it, and nobody uses the app yet. frogquizxyz.netlify.app shows the v0.5 copy.
The merge closed #35, #43, #52, #53 and #55. It also closed #33, #42 and #45 by mistake, and
they were reopened with a comment. The API answers at api.frogquiz.xyz since 12 Oct (DNS
record and `SITE_ADDRESS` both done; `netlify.toml` follows in v0.8). François trimmed V1 the
same day (D39): see `docs/v1-plan.md`. Still for François: #22 (resize the VM by about
25 Oct), and branch protection on master.

**Small things left:**
- At 1280x720 the lobby shows about five names under the PIN, QR and Start. A smaller QR on
  short screens would give a second row.
- Two frontend unit tests (robots.txt, the vendored resend file) and one thumbhash backend
  case fail on Windows only, from line endings and float rounding. CI passes them.
- `C:\c\Users\...` on the laptop is a stray folder from a screenshot path; delete it by hand.
- Remove the old Meilisearch volume (`<project>_meilisearch-data`, v0.28) on the VM once a
  signed-in search works. It is the way back until then. DEPLOY.md's "Meilisearch v1" step 4
  says to remove it once search is confirmed working.
- Lesson from v0.5: in a PR body, write later releases as "takes #N", never "closes #N". The
  v0.5 body used "closes" for issues from later releases, and the merge closed #33, #42 and
  #45 by mistake.

## Picking this up on the laptop (11 Oct, evening)

The cloud session stopped here, at François's request. Nothing is uncommitted: `v1` is pushed at
the commit that carries this section. This section is meant to be read alone. **Read "What we
missed" before touching anything: it is the audit of where the plan, the issues and the code
disagree.**

### 0. Start here: paste this into the laptop Claude

```text
You are picking up frogQuiz V1 from a cloud session that has ended. Repo ogfrench/frogQuiz,
branch v1, draft PR #57. Read, in this order: the section "Picking this up on the laptop
(11 Oct, evening)" at the top of HANDOVER.md, then CLAUDE.md, then docs/v1-plan.md including
its "Plan changes" log. Then work through "Next, in order" in that section.

First action: check CI on the head of v1 and report it. Do not merge #57 before telling
François what the audit changed (the section "What we missed", items A to E): it moves what
v0.5 contains.

The rules that matter most: push only to v1; merge commits only; hide or disable, never
delete, a feature (François decides any removal, recorded in MVP.md first); claude-code-setup
is a public repo, so nothing from a private project or any real name goes in it; one e2e
stack per working tree and no edits under frontend/ while specs run; a failing test first for
every fix, a CHANGELOG line under "## Unreleased", and a fast-model review per commit.
François wants short, straight answers and real choices put to him, not long plans.
```

Optional: `claude --teleport session_01KVaWrDgi2ESR2WbZoLq4MU` from a clean checkout brings back a
summary of the cloud conversation. The documents carry the same facts. Plain git is enough:
`git fetch origin && git switch v1 && git pull`. **Only one session pushes to `v1` at a time.**

### 1. The state in one table

| | |
| --- | --- |
| **What this is** | frogQuiz: an internal Kahoot-style quiz tool, a fork of ClassQuiz (MPL-2.0). FastAPI and python-socketio, SvelteKit 2 with Svelte 5 and shadcn-svelte, Postgres (Neon in production), Redis, Meilisearch, an arq worker. Docker compose on an Oracle VM, the frontend on Netlify. |
| **Repo, branch, PR** | `ogfrench/frogQuiz`, branch `v1` (ahead of master `8e69034`, which `v1` merges cleanly into), draft PR **#57**. Checklist issue **#56**. The living plan is [`docs/v1-plan.md`](docs/v1-plan.md). |
| **How V1 ships** (D35) | In releases, PR by PR, each from `v1`: **v0.5** = steps 0 to 3 (#57, now), **v0.8** = step 4, **v0.9** = step 5, **v1.0** = step 6. After each merge `v1` restarts from master. Master before v0.5 is the `mvp` tag. |
| **Done** | Steps 0, 1, 2 and 3 (3a and 3b). See section 2. |
| **Checked locally** | Backend suite 287 passed, 1 skipped, on a fresh database. `pnpm test` 249. `svelte-check` 0 errors, 36 warnings. `flake8` clean. The e2e specs that touch `/create`, anonymous hosting, sign-in, the editor and the account flows: 68 of 68. `account-game.e2e.ts` passes with the setting on and off. With it off, `/create` answers 303 to sign-in and `/editor/start` 401, checked live. |
| **CI** | Not known. It was running on `706c427` and was restarted by the push of `91fc19b`. On `706c427` at that moment `lint`, `secrets`, `python`, `node`, the three image scans and Netlify had passed, and `e2e`, `test` and CodeQL were in progress. **Check it first.** |
| **Not done** | The full e2e suite on this head, the visual pass of the 3b screens, items A to E below. |
| **Production** | v0.5 is not deployed. The VM runs whatever it last pulled. The worker's missing uploads folder and Meilisearch v1 take effect only on `docker compose up -d` with the new image (`DEPLOY.md`). No schema change in v0.5, so no migration to run. v0.8 has one. |
| **App in use?** | No. No real users and no real data. Do not treat anything as a hotfix. |
| **People** | **François** is the owner and decides alone (D31). **Gonçalo** is the other teammate and is no longer a gate. |

### 2. What has been built (step by step, with the commit to read)

| Step | What | Commits |
| --- | --- | --- |
| 0 | Merged PR #37 (the MVP polish, `58d6241`), branched `v1`, wrote the plan and the decisions, housekeeping, visual review tooling and a baseline gallery | `e87f81a` |
| 1 | CI and production safety. The dependency audit (pip-audit with dated exceptions, pnpm audit, trivy on the compose images, gitleaks) and the backend re-lock that cleared 124 advisories. e2e in CI. Log limits on every compose service. Meilisearch moved from v0.28 to v1.54.3 (new volume, the API rebuilds the index). The host timer redesigned as a drain bar. | `f64b7a0`, `deb3c09`, `c94c78c`, `39ea0c0`, `62268ff` |
| 3a | **#52:** no results row for a game hosted without an account. **#35:** a view or a launch no longer undoes a save, every writer keeps to its columns, `base` on `/editor/finish`, a 409 offers Keep mine or Load the other version, a failed save says why and keeps the text, a live game keeps its images. The live scoreboard follows the server's totals. "N of M answered" cannot run past M. A security audit, whose one hole (`/live` accepted any account's key) is fixed. Visual review fixes. | `1a7a97d`, `6ee0db8`, `ab677df`, `06e4663`, `57a3445`, `e488d07`, `311df9e`, `0f69b96` |
| 3a/3b | **#43 races:** the claim and the expiry sweep are conditional writes; the editor's version check runs again with the row locked. | `780d744`, `8a2085a`, `5ebb5bf` |
| Review | The V1 review: the worker never mounted the upload folder; CI's Meilisearch now matches production; mail documented as required. | `92331b6` |
| 3b | **#55:** `anonymous_quizzes_enabled` (default off) gives a 401 on every anonymous write path; two ceilings (20 new quizzes per address a day, 1,000 alive at once); `GET /api/v1/utils/config`; `/create` redirects signed-out visitors to sign-in; password registration keeps to the allowed domains; `docs/anonymous-vs-account.md`; decisions D33 to D36. | `530d5dd` |

### 3. Rules that hold (from CLAUDE.md and from François)

- **Branch and merging.** Push only to `v1`. Merge commits only: no squash, no rebase, no history rewrite on a shared branch. Restarting `v1` from master after a merge is the one exception, and only when it holds merged history alone.
- **Pull requests.** François asked for PR-by-PR releases (D35), so opening each release PR is authorized. Any other PR needs an ask. Do not recreate issues #46 to #49 and #54: they were deleted on purpose.
- **Hide or disable, never delete.** Anything not needed now goes behind a flag or a route guard. Removing a feature is François's decision, proposed first and recorded in `MVP.md` before any code changes.
- **Every change:** a failing test first (a race gets a test that holds the first step in place, and it must fail on the old code); a line under `## Unreleased` in `CHANGELOG.md`; a review by a fast model per commit (CLAUDE.md says which work goes to haiku, sonnet or the main model: auth, sessions, races, deletes, migrations and the socket protocol stay with the main model).
- **Each step ends with:** a full review of its diff, the full e2e suite, a visual pass of the touched screens at 390, 834 and 1440 in both themes, the backend suite on clean infrastructure, CI green, and a re-plan written into `docs/v1-plan.md` under "Plan changes". At the end, François wants a full report: what we set out to do (the issues) against the result.
- **Upstream independence and licensing.** Nothing may point at `mawoka.eu` or other ClassQuiz-maintainer infrastructure. Never strip or alter an SPDX header; add a second line for frogQuiz contributors. Third-party art, icons, audio and fonts need a recorded open licence first.
- **`claude-code-setup` is public.** No client or project names, nothing from a private repo, no secrets, hostnames, IPs, emails or people's names. Private terms live outside git (`.private-terms`, the `PRIVATE_TERMS` secret). Run `node scripts/check-public.mjs --require-terms` before pushing; if it fails, fix the text and never loosen the check. A learning written there names its source as a public repo or "a private project", nothing else.
- **Confirm before anything hard to reverse or outward-facing:** a force push, a merge, a tag, deleting data. Approval for one does not carry to the next.
- **No model names** in commit messages, PR titles or bodies, or code comments. Follow the session's own attribution instruction for trailers.
- **How François likes it:** short and straight, US English, no flattery, no em dashes, no emojis. Get to the choices. Do not over-plan: backups (#61) and monitoring (#60) were turned into issues on purpose.

### 4. What François decided (10 to 13 Oct)

All of D22 to D41 are in `MVP.md` §4.0 and the plan's "Decisions" table. The ones people forget:

| Topic | Decision |
| --- | --- |
| Who can use it without an account | Anonymous creation, uploads and hosting are on by default; `anonymous_quizzes_enabled=false` turns them off. Players join by PIN either way. Anonymous quizzes are unlisted only and last 30 days. A running game continues after expiry. An editor open at expiry keeps its clock, shows the reason and keeps the text. |
| Guest templates (D41) | Signed-out visitors can browse curated Examples in Discover and make an editable anonymous copy. Search, profiles and sitemap still require sign-in. |
| The ceilings | 20 new quizzes per address a day, 1,000 alive in total. Both are settings. |
| Copy (#39, D33) | Anyone signed in can copy any public quiz, as well as their own and the Examples. A copy carries the answers, which narrows D18 for public quizzes. |
| Scoreboard (D34) | The host's scoreboard and results cards stay white on the dark projector. |
| Releases (D35) | v0.5, v0.8, v0.9, v1.0, PR by PR. Master before v0.5 is tagged `mvp`. |
| Mail | Sign-in by emailed link works in production. No emergency sign-in. |
| Backups and monitoring | None for now. Issues #61 and #60, label `post-v1`. |
| Server image | François builds it from his laptop at the deploy. CI publishes `:master` only when `frogquiz/**` changes, so a change to the Dockerfile, the lock or a migration alone does not reach the VM. |
| API domain (D32) | `api.frogquiz.xyz`. Claude does what it can; the DNS record is done from the laptop with the Netlify MCP. |
| `claude-code-setup` | Stays public. Its history was rewritten and force-pushed on 11 Oct to remove private names, and `frogify` stays public. |
| Hotfix | None. The `/live` security fixes reach master with V1. |

### What we missed (the audit of 11 Oct, late)

Found by reading the issues against the code, and by running the app with the setting off,
which is production. Ranked. **A to E are to do before v0.5 is cut.**

**A. The interface still promises what the setting now forbids.** With it off, a signed-out
visitor sees "No account needed. Quizzes made without one stay in this browser and are
deleted after 30 days" on the home page, "Create a quiz" buttons that go to sign-in, and a
My Quizzes page that says "Quizzes you made in this browser". Also the Explore empty state
("You can make one without an account"), the view page, and the privacy policy
("Quizzes made without an account delete themselves after 30 days"). Strings:
`frontend/src/lib/i18n/locales/en.json` keys around lines 10 to 12, 497, 687 to 702 and 719;
`frontend/src/routes/docs/privacy-policy/+page.svelte:52`. **Fix:** read `/api/v1/utils/config`
once in the root layout's server load and switch the copy: with the setting off, "Sign in to
create a quiz" and no 30-day wording, and a signed-out My Quizzes that is a sign-in prompt.
`createGate` already reads the same endpoint. Screenshots of the problem, at 1440 and 390,
were taken in the cloud session and are not kept; reproduce with
`ANONYMOUS_QUIZZES_ENABLED=False` and open `/` and `/my-quizzes` signed out.

**B. The whole e2e suite runs with the setting ON, and production runs it OFF.** Nothing
tested the real product path in a browser until `account-game.e2e.ts` (added now: a signed-in
host, players with no account; it passes with the setting on and off). Still missing:
- a spec `anon-off.e2e.ts` for a stack with the setting off: `/create` goes to sign-in and
  back, `/` and `/my-quizzes` carry no "no account" wording (it is what A fixes), the editor
  refuses to start. `e2e/e2e.env` no longer names it.
- a second pass in `.github/workflows/e2e.yml`: restart the API with
  `ANONYMOUS_QUIZZES_ENABLED=False` and run `account-game`, `anon-off` and `sign-in`.

**C. Three of the five issues #57 would close are not met by their own acceptance lines.**
Close #52 and #53 at v0.5. For the others, write the deferral on the issue, which V1's
definition of done allows, or leave them open ("Refs", not "Closes"):
- **#55:** the grid it asks for (images, game, results, secret and account cells, each with a
  result) is not in `docs/anonymous-vs-account.md`, which has the rules and the claim cases;
  question 5 (expiry in the middle of a session) is in the plan but not in `MVP.md`; the
  expiry warning has no test (`my-quizzes.e2e.ts` shows "expires in N days", nothing asserts
  it before removal; the claim banner was dropped); and "the privacy text matches the matrix"
  is #50, in v0.9. Close it at v0.9.
- **#43:** "checked on a phone, in the same browser and in a second one" was not done, and
  the claim's failure message is one generic `my_quizzes.claim_failed`, where cases 2, 3 and 6
  ask for a message that says what happened and what to do. Matrix rows 7, 8, 9, 11 and 12
  are read from the code, not run.
- **#35:** `docs/e2e-findings.md` rows 5, 11 and 12 say "not measured", row 6's lobby pointer
  is not measured, and row 13 was read, not run. Its acceptance says every row is measured.

**D. Release mechanics for v0.5:**
- `CHANGELOG.md`: rename `## Unreleased` to `## v0.5 (date)` and open a new `## Unreleased`.
- `frontend/package.json` says `0.0.1`; decide whether releases bump it.
- Tags `v0.5`, `v0.8`, `v0.9`, `v1.0` after each merge, from the laptop: the cloud git proxy
  refuses tag pushes, and no tool here creates a GitHub release.
- PR #57: still titled "V1", still describes one PR, and its Closes line lists 17 issues.
  Retitle, rewrite, and move the rest to the later PRs. #56's body also still says "All of V1
  is one PR, #57" and has the old step list.
- `docs/v1-plan.md` and `MVP.md` D33 to D36 are current.

**E. Deploy order.** Netlify publishes the frontend when #57 merges. The new frontend uses
the new API: the host's answered count now reads usernames from `registered_as_admin` and
`player_answer`, and `/create` asks `/utils/config`. A new frontend on the old API breaks a
live game's host screen, and sends every signed-out visitor of `/create` to sign-in. Nobody
uses the app yet, so it is a window, not an outage. Still: pause Netlify's auto-publish before
the merge, build and deploy the API image first, then publish (the order in step 6 of the plan).

**F. The 3b step-end checks are not all done.** Done: the diff review (a fast model: no
blocker, findings below), the backend suite (287 passed), the e2e batch for the touched specs
(68 of 68), `account-game` with the setting on and off. Not done: the **full** e2e suite on
this head, and the visual pass of the touched screens (the gallery is from 3a). **CI on the
last commit was still running when the session stopped:** at that moment `lint`, `secrets`,
`python`, `node`, the three image scans and Netlify had passed, and `e2e`, `test` and CodeQL
were in progress. Check it first.

**G. The review's findings on 3b**, still open (the list in step 2 below).

**H. Docs that are now wrong:** `MVP.md` §1 (the signed-out column of the surfaces table and
"What anonymous actually means today") and `docs/mvp-scope.md` lines 306 and 351 still say a
quiz can be made without an account. `HANDOVER.md`'s older sections mention anonymous hosting
as current; they are history. `netlify.toml` still points at the sslip.io hostname until the
domain move.

**I. To check on the VM:** `TRUSTED_PROXY_HOPS=2` (the daily cap, if the setting is ever on,
is otherwise one bucket for everybody), `RATE_LIMIT_ENABLED` on, `ANONYMOUS_QUIZZES_ENABLED`
unset. And `MAIL_*`, which works.

**J. Process.** No lesson from this session reached the learning loop. Two to write, as
`learnings/` notes in `claude-code-setup` (public: no names): *a variant passed as a class
keeps the component's default variant* (already in the plan's lesson line), and *a suite run
with a feature on never tests the production default* (A and B above). That repo's CI stays
red until the `PRIVATE_TERMS` secret exists.

**Accepted, with a place:** audit findings 4 and 5 (post-V1), 6 and 7 (step 5); backups #61
and monitoring #60 (post-V1); `GET /quiz/get/public/{id}` has no visibility check (#34, v0.8).
A real-phone game, iOS and Android, is #45 in v1.0 and needs you.

### Next, in order

1. **CI green on #57** at the head of `v1`. Fix anything red first.
2. **Fix A to C, then the review's findings on 3b** (it found no blocker; no anonymous write
   path is left ungated). Each with a test that fails first:
   - **Medium:** `test_anonymous_flag.py`'s daily-ceiling test passes only because `test_server.py` flushes Redis before it. `test_ratelimit.py::test_editor_saves_are_limited_per_edit_session` leaks a hit into `ratelimit:anon_quiz_create:testclient`. Delete that key in the `finally` of both tests.
   - `test_anonymous_flag.py`: assert `"Sign in" in detail` on the save and finish 401s, since `_persist` also answers 401 for an unknown edit id.
   - `/create`: pass `url.search` into `createGate` so `/create?title=...` (from the command palette) survives sign-in; give the config fetch `signal: AbortSignal.timeout(2000)`.
   - `docs/anonymous-vs-account.md`: a signed-in user hosts their own quizzes **and any public one**; `create_gate.test.ts` covers the gate function, not the loader (the loader was checked live, setting off); case 5's e2e asserts the API 404, not the tab's message.
   - The startup log says "Nobody can sign in" without mail, which is wrong if an OAuth provider is configured (production has none).
3. **Full e2e on the new head,** the visual pass of the touched screens, then D and E.
4. **Cut v0.5:** retitle and rewrite #57, merge with a **merge commit**.
5. **Restart `v1` from master:** `git fetch origin master && git checkout -B v1 origin/master && git push --force-with-lease -u origin v1` (it holds only merged history by then). Open the v0.8 PR for step 4.
6. **Steps 4 to 6** as `docs/v1-plan.md` says. Which issue closes in which release:
   - v0.8: #33, #34, #38, #39 (Copy on any public quiz, D33), #40, #41
   - v0.9: #42, #44, #50, and #55
   - v1.0: #45 (it takes the leftover checks of #3, which is already closed as not planned), #56, and #22 once the VM work is done
   - post-V1: #60 (monitoring), #61 (backups)
   - v0.8 has a **migration** (#34, #33): `prestart.sh` runs it when the API container starts, so take the Neon snapshot first.
7. **At the end:** the full report, what was set out (the issues) against the result.

### Only the laptop can do these

- **The `mvp` tag** (the cloud git proxy refuses tag pushes): `git tag -a mvp 8e69034 -m "MVP" && git push origin mvp`. Later `v0.5`, `v0.8`, `v0.9` and `v1.0`, each on its merge commit.
- **Pause Netlify's auto-publish** before merging #57, and publish after the API is deployed (E above).
- **The server image** after v0.5 merges: build and push it from the laptop, then on the VM `docker compose pull && docker compose up -d`. CI publishes `:master` only when `frogquiz/**` changes. The `up -d` also gives the worker its uploads folder. The new setting defaults to off, so nothing needs adding to `.env` for it.
- **The API domain** (Netlify MCP): an A record `api` → `134.98.158.173` on `frogquiz.xyz`. On the VM, in `/opt/frogquiz/.env`, `SITE_ADDRESS="api.frogquiz.xyz, 134-98-158-173.sslip.io"`, then `docker compose up -d proxy`; check `CORS_ORIGINS` and `ROOT_ADDRESS`. Then Claude points `netlify.toml` at it. `DEPLOY.md` has the runbook.
- **claude-code-setup** (its history was rewritten and force-pushed on 11 Oct):
  - save any local work, then `git fetch origin && git reset --hard origin/main`
  - `git config core.hooksPath .githooks`
  - create `.private-terms` (gitignored) and the `PRIVATE_TERMS` repo secret with the same names
  - run `sync-to-repos.sh`, then `setup-user.sh`
- **#22, the VM:** 2 OCPU / 12 GB, backed up, Pay As You Go, by about 25 Oct. Oracle reclaims it on 31 Oct.
- **Branch protection** on master.
- **Approve text** when Claude drafts it: the examples (#39) and the privacy and terms pages (#50).

### Getting it running on the laptop

Use Git Bash, from the repo root. pnpm is in `%APPDATA%\npm`. The frontend `build` script is POSIX
and fails under cmd.exe. The older 10 Oct section below has the full command table and a phone
walkthrough; its counts are stale, so use these:

| What | Command | Expect now |
| --- | --- | --- |
| Unit | `cd frontend && pnpm test` | 249 passed |
| Types | `cd frontend && pnpm exec svelte-kit sync && pnpm check` | 0 errors, 36 warnings |
| Lint | `cd frontend && pnpm lint`, and `flake8 .` | 0 errors |
| Backend, full | `./run_tests.sh` (Podman or Docker for Postgres, Redis, Meilisearch) | 287 passed, 1 skipped, on a fresh database with Redis flushed |
| e2e, full | `bash e2e/run.sh` | All green. 46 spec files. Known bugs are `test.fail(...)` markers; a test that turns red means its bug is fixed, so delete the marker |
| e2e, one spec | `bash e2e/run.sh e2e/account-game.e2e.ts` | |
| Setting off | `ANONYMOUS_QUIZZES_ENABLED=False bash e2e/run.sh e2e/anon-off.e2e.ts e2e/account-game.e2e.ts e2e/sign-in.e2e.ts`. `e2e/e2e.env` defaults it to True | `/create` 303 to sign-in, `/editor/start` 401 |
| Stack left up | `KEEP_UP=1 bash e2e/run.sh --list`, then `bash e2e/stop.sh` | App 3000, API 8010 |

The cloud session ran the backend suite against the e2e stack's own infrastructure with a
database named `frogquiz_pytest`, an index of its own in Redis and Meilisearch, and `.env.ci`
with only the three service URLs changed. Those scripts live in the cloud scratchpad and are not
in the repo. Do not source `e2e/e2e.env` for the backend suite: it flips
`VALIDATE_EMAIL_DELIVERABILITY` and gave 63 phantom failures.

### Traps that bit us

- **The suites share state.** The backend suite is order-dependent: a second run on warm infrastructure fails from `test_password_update` onward with about 40 spurious 401s (Redis) or at `test_create_test_user` with a 409 (Postgres). Flush both.
- **One e2e stack per working tree.** A second one, even on other ports, runs `svelte-kit sync` in the same `frontend/` and reloads the first one's pages mid-test. No edits under `frontend/` while specs run. Rate limits are keyed by address and every local client is `127.0.0.1`, so a probe can hand the specs 429s.
- **ormar's `update()` writes every column.** A save, a view and a claim then undo each other. Use `update(_columns=[...])` or one SQL statement. UUIDs are hex strings in raw SQL.
- **Races are proved by holding the first step in place:** monkeypatch the call that sits between the read and the write, and run the worker through `test_client.portal.call`. Timing alone proves nothing.
- **A test helper that raises inside a transaction rolls the writes back.** It made a control test fail for the wrong reason.
- **A variant passed as a class keeps the component's default variant.** The conflict dialog's button was white text on white. Pass `variant` as a prop.
- **CKEditor's stylesheet is more specific than ours.** Its radius, border, focus ring and `font-family` need `.ck.ck-editor__editable:not(.ck-editor__nested-editable)`. Its "powered by" badge leaves a dot unless hidden.
- **Meilisearch v1 cannot read v0.28 files.** It has its own volume (`meilisearch-data-v1`); `e2e/run.sh` re-downloads the binary when `--version` differs from `docker-compose.yml`.
- **The public-repo hook blocked our own fixtures** (an email, an IP, a repo name) until they were built at runtime. Expect it on any fixture that looks like a name.
- **The shadcn-svelte MCP does not exist.** Use the CLI (`CLAUDE.md`). Do not re-litigate it.
- **Known flake:** `practice.e2e.ts` failed once in each of two full runs, a different symptom each time, and passes alone. `docs/archive/TODO-2026-10.md` has both. Note a third; do not explain it in advance.

### Where to look

| What | Where |
| --- | --- |
| The plan, its decisions and its change log | `docs/v1-plan.md`, `MVP.md` §4.0 (D22 to D36) |
| What needs an account, and each claim case | `docs/anonymous-vs-account.md` |
| The security audit | `docs/security-audit-2026-10-11.md` (findings 4 to 7 are deferred, with a place) |
| The visual review | `docs/visual-review-v1.md`; the gallery is a private claude.ai artifact (`RVbfFcKLYJJN1f7VFnaNcr`), François can share it |
| Measured concurrency results | `docs/e2e-findings.md`, `docs/edge-cases-2026-10.md`, `docs/crud-audit-2026-10.md` |
| What was cut and how to turn it back on | `docs/mvp-scope.md` |
| Uploads, limits, quotas | `docs/uploads.md` |
| Deploying, the audit exceptions, the VM runbooks | `DEPLOY.md` |
| What changed, in plain terms | `CHANGELOG.md` (`## Unreleased`) |
| Open issues | #56 roadmap; #55, #53, #52, #50, #45, #44, #43, #42, #41, #40, #39, #38, #35, #34, #33; #22 (VM, by about 25 Oct); #60 and #61 and #4 after V1. #3 is already closed. |

### The answered count: confirmed

The answered count counts only players still in the game: a player who answered and then left
drops out of both numbers. François confirmed it on 12 Oct (D37).

## Picking this up on the laptop (10 Oct)

*History. Its counts and the V1 shape (one PR) are out of date; the section above is current.*

The cloud session of 8 to 10 Oct stops here. Nothing is uncommitted: PR #37's branch is
pushed at the commit that added this section.

### Where things stand

| | |
| --- | --- |
| **PR #37** (MVP polish) | **Merged on 11 Oct** as `58d6241`, with a merge commit, after the mandatory full review. Every finding it confirmed was fixed, each with a test that failed first; the PR description has the list. Suites on its last commit: e2e 218 of 218 (one full run on Chromium), unit 235, the backend socket and export tests 28, `flake8` 0, `svelte-check` 0 errors. |
| **On the VM, now** | `docker compose pull && docker compose up -d`, then `docker compose ps` to see the `worker` running. Until then the new frontend shows players a letter instead of a frog. Nothing breaks. |
| **V1** | Started on 11 Oct on the branch **`v1`**, with one draft PR. The living plan is [`docs/v1-plan.md`](docs/v1-plan.md): read it first, then its "Plan changes" log. #56 holds the checklist. |
| **Deadline** | #22: the Oracle VM must be at 2 OCPU / 12 GB, backed up, and on Pay As You Go by about 25 Oct. Oracle reclaims it on 31 Oct. |
| **Folded into #37** | #51 (the host reload restores the question), closed by the merge. |

### The V1 decisions

They are in [`docs/v1-plan.md`](docs/v1-plan.md) and in `MVP.md` §4.0 as D22 to D32. They include:
- No anonymous creation or hosting: built behind a flag.
- Three visibility levels, Unlisted by default.
- Changeable usernames.
- A mix of example quizzes.
- The contact francois.prevot@frog.co.
- `api.frogquiz.xyz` for the API.
- **From 11 Oct François decides alone (D31).** The joint-decision rule is gone from CLAUDE.md.

### Getting it onto the laptop

- **Plain git:** `git fetch origin && git switch v1 && git pull`.
- **With the conversation:** `claude --teleport session_01KVaWrDgi2ESR2WbZoLq4MU`, from a clean
  checkout, signed in with `/login`. The conversation has been compacted, so what comes back is a
  summary of the same documents.
- **One session pushes at a time.** Only one session should be on `v1` at once.

### Running everything on the laptop

Use Git Bash, from the repo root unless the table says otherwise. pnpm is in `%APPDATA%\npm`.

| What | Command | Expect |
| --- | --- | --- |
| Unit | `cd frontend && pnpm test` | 235 passed, about 10 s |
| Types | `cd frontend && pnpm exec svelte-kit sync && pnpm check` | 0 errors, about 36 warnings |
| Frontend lint | `cd frontend && pnpm lint` | 0 errors |
| Backend lint | `flake8 .` | 0 |
| Backend, full | `./run_tests.sh` (needs Podman or Docker for Postgres, Redis and Meilisearch) | Fresh database, Redis flushed first (§7) |
| Backend, no containers | `pytest frogquiz/tests/test_set_question_number_bounds.py frogquiz/tests/test_join_game_payload.py frogquiz/tests/test_results_spreadsheet.py frogquiz/tests/test_avatar_seats_outlive_the_game.py`, with `.env.ci` loaded | 28 passed |
| e2e, full | `bash e2e/run.sh` | 218 tests, about 22 min. Edge on Windows. The cloud ran Chromium, so Edge is a real second browser |
| e2e, one spec | `bash e2e/run.sh e2e/game-reload.e2e.ts` | |
| Stack left up | `KEEP_UP=1 bash e2e/run.sh --list`, then `bash e2e/stop.sh` | App on 3000, API on 8010 |
| A phone on the stack | See "A phone against the local stack" in the 4 Oct section below | |

**Known flake:** `practice.e2e.ts › practice runs a quiz end to end` failed once in each of two
full runs (4 and 10 Oct), with a different symptom each time. It passes alone. `docs/archive/TODO-2026-10.md` has
both occurrences. Note a third with its symptom; don't explain it in advance.

### What needs you or the laptop

| Item | Route |
| --- | --- |
| #22, the Oracle console | By hand: resize to 2/12, upgrade to Pay As You Go with a $1 budget alert, and take a boot volume backup. Then copy `uploads/` and `.env` off the box over `scp`. |
| VM pull after each merge | `ssh ubuntu@<ip> 'cd frogQuiz && docker compose pull && docker compose up -d && docker compose ps'` |
| Merging #37, and later V1 | On GitHub, or `gh pr merge 37 --merge`. Before the V1 merge, pause Netlify auto-publishing. Publish again once the VM has the new backend: the V1 migration changes the quiz table. |
| GitHub settings | Secret scanning with push protection, and branch protection on master (green CI, PR required) |
| Gonçalo | His agreement on #55 (anonymous creation off), and a look at the decisions table |
| Approvals | The privacy and terms text, the contact address, and the example quizzes' content |
| A phone and a laptop on the deployed site | After the V1 deploy: #45, and #3's Part A |

### Tools worth having on the laptop

- **`gh`** with `gh auth login`. A local session has no GitHub connector and no PR events, so
  CI and review comments are read with `gh pr checks 37` and `gh pr view 37 --comments`.
- **Claude in Chrome**, or the Desktop app's browser pane, for the UI walks and the deployed-site
  run.
- **Context7** (`claude mcp add`) for shadcn-svelte docs, which CLAUDE.md points to.
- **Remote Control** (`/remote-control`) to follow a laptop session from the phone.

The 4 Oct section below has the details and doc links for each.

### Next, in order

1. Pull on the VM (PR #37 is merged).
2. Do #22 on the Oracle console, whatever else is happening.
3. Follow [`docs/v1-plan.md`](docs/v1-plan.md). Its status line says which step is in progress. Each step ends with these, then a re-plan of the steps that remain:
   - a full review of the step's diff
   - a full e2e run
   - a visual review

---

Older sections, from the 2 to 6 Oct handover back, are in
[`docs/archive/handover-2026-10.md`](docs/archive/handover-2026-10.md).
