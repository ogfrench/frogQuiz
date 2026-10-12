<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# Handover

The newest section comes first. The older ones are kept below for the decisions and commands
they record.

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

### 4. What François decided (10 and 11 Oct)

All of D22 to D36 are in `MVP.md` §4.0 and the plan's "Decisions" table. The ones people forget:

| Topic | Decision |
| --- | --- |
| Who can use it without an account | Creating, uploading and hosting need a team account. Players join by PIN with none. Built behind `anonymous_quizzes_enabled`, off. Anonymous quizzes are unlisted only and last 30 days. A running game continues after expiry. An editor open at expiry keeps its clock, shows the reason and keeps the text. |
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
- **Known flake:** `practice.e2e.ts` failed once in each of two full runs, a different symptom each time, and passes alone. `TODO.md` has both. Note a third; do not explain it in advance.

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
full runs (4 and 10 Oct), with a different symptom each time. It passes alone. `TODO.md` has
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

## Earlier: the `ccr-370df3e4-c44t1l` handover (2–6 Oct)

For François and Gonçalo, 2–4 October 2026. It was PR #23.

**State: merged on 6 Oct as PR #26** (the same branch, plus the sign-in resend cooldown and
a few fixes; #23 was closed with it). What is left is not code: the production clean slate,
the real-mail check, and Gonçalo's ticks. The list is in `TODO.md` under "Open before
sharing". The text below is the review brief as it stood on 5 Oct. It was about 115 commits
and 270 files, +17900 / -4300 against `master`.

### Reviewing and merging (5 Oct)

Read the PR #26 description, and #23's for the longer account. It is grouped by theme, with dates, and each
section names the doc that holds the detail. Three things in it need the two of you:

- **Sign-in by emailed link, no passwords (D21, 5 Oct).** François asked for frogViz's
  gate: a link or six-digit code by email, frog.co and capgemini.com addresses only, and
  Discover and search for signed-in accounts only. Password login and registration are
  hidden behind `ENABLE_PASSWORD_LOGIN`, not removed. **Before deploying:** mail must
  work, since nobody can sign in without it. An account on any other domain could no
  longer sign in, so François chose a clean slate: every account, quiz and upload went
  on 6 Oct, with Gonçalo's agreement and a backup first (`TODO.md` has where it is). The
  steps are in `DEPLOY.md` ("Clean slate"), Neon commands included. The detail is in `docs/mvp-scope.md`
  ("Sign-in"). D19 (late join with a lock) and D20 (Kahoot's score curve) came the same day
  and need Gonçalo's tick too.

- **D16 and D18** (`MVP.md` §4.0) are François's calls from 2 Oct and still need Gonçalo's
  tick. D16 is the host-side "show questions and answers on players' devices" switch, off
  by default as in Kahoot. D18 makes downloading a quiz's results owner-only.
- **Registration and login rate limits** (E16 in the edge-case pass). They were per address,
  and an office shares one, so the eleventh person registering in one room was locked out
  for an hour. François asked for them to be raised on 5 Oct; the numbers are in the
  CHANGELOG. Gonçalo should see this one, since it is an auth limit.

Every other decision in the PR is already agreed and recorded in `docs/mvp-scope.md`.

**For after the review:** [`docs/kahoot-gap-analysis-2026-10.md`](docs/kahoot-gap-analysis-2026-10.md)
compares frogQuiz with Kahoot step by step (creating, hosting, playing, results) and ranks the
ten gaps most worth closing. Its top three: results are not kept after a game (D4, kept as
is: the Excel download is enough for now), there is no way to duplicate a quiz, and nobody
could join once a game had started. François answered its questions on 5 Oct, and late join
with a lock, Kahoot's score curve and sign-in by emailed link are on this branch since.

The last thing added is the edge-case pass ([`docs/edge-cases-2026-10.md`](docs/edge-cases-2026-10.md),
E1 to E27, all fixed). Read its three High findings first. E1 in particular: since 12 Sep,
everyone has been signed out 30 minutes after logging in, which is also why an editor left
open that long stopped saving.

To read code by area rather than commit by commit:
`git diff master...ccr-370df3e4-c44t1l --stat -- frogquiz/` for the backend (auth, uploads,
the worker, the socket server), the same with `frontend/src/` for the UI, and
`frontend/e2e/` for what is now tested.

Merge with **Create a merge commit**. Squash and rebase both rewrite hashes, and this file,
the PR and the docs cite them (`9c62681f`, `077f695` and others). After the merge, on the
VM: `docker compose pull && docker compose up -d`, then `docker compose ps` to confirm the
`worker` container is up. The CRUD audit's upload clean-up runs there. Then §1 C (a real
mail) and `MVP.md` §4.1 on the deployed site.

| Suite | Result |
| --- | --- |
| e2e | 201 tests on `ef1b4262` (5 Oct, evening). One full run, on battery, passed **196**; the other 5 pass on rerun, three of them load and two fixed in the specs (see the PR's Testing section). The 85 tests that make accounts were rerun green after the account helper changed. 190 on `e7ba45da` before that |
| Backend | **188 passed**, 1 skipped, on `ef1b4262`, CI settings on a fresh database |
| Unit | **157 passed**, Windows included |
| `flake8 .` | 0 |
| `eslint .` | 0 errors |
| `svelte-check` | **0 errors** (1052 on 2 Oct), 36 warnings; CI runs it since `35a5e59a` |

---

## 0. Picking this up on a laptop (4 Oct)

The cloud session that did the 2–4 Oct work stops here. Nothing is left uncommitted: the branch
is clean at the commit that added this section, CI is green on it, and PR #23 is mergeable.

### State at handoff

| | |
| --- | --- |
| Branch | `ccr-370df3e4-c44t1l`, clean, pushed; since merged through #26 |
| PR #23 | Closed on 6 Oct. The branch went in as PR #26 |
| Suites | At the cloud handoff: e2e 146/146 and backend 168 on `077f695`; unit 153. Current numbers are in the table at the top |
| Open issues | #3 (MVP 1, Part A partly done), #4 (MVP 2), #22 (Oracle VM, **31 Oct**), #24 (touch targets, fixed 4 Oct and merged; a real-phone check is left) |
| Decisions open | Gonçalo's tick on D16 and D18 (see `MVP.md` §4.0). Scoring stays all-or-nothing; sign-out revocation is done |
| Edge-case pass, 4 and 5 Oct | 27 bugs found and fixed (E1 to E27 in [`docs/edge-cases-2026-10.md`](docs/edge-cases-2026-10.md)), each with a test that failed first except E19 and E20 (a two-event race, a two-hour timer). E16 raised per-address auth limits at François's request |
| CRUD audit, 4 Oct | Done on the laptop and pushed to this PR: 14 bugs found and fixed (C1 to C18 in [`docs/crud-audit-2026-10.md`](docs/crud-audit-2026-10.md)), each with a regression test. `e2e/run.sh` now starts the arq worker, which is how three of them were found. C13: usernames do not change, decided 4 Oct and recorded in `docs/mvp-scope.md` |

### Getting it onto the laptop

Two ways in. Pick one.

- **Plain git (the default).** In your existing clone:
  `git fetch origin && git switch ccr-370df3e4-c44t1l && git pull`, then start `claude` there
  and point it at this section. Everything the next session needs is in this file, `TODO.md`,
  `CHANGELOG.md`, the PR #23 description and issue #24. The cloud conversation has been
  compacted twice, so what is left of it is a summary of those same documents.
- **Teleport, if you want the conversation itself.** From a checkout of this repository (not a
  fork): `claude --teleport session_01KVaWrDgi2ESR2WbZoLq4MU`. It needs a clean working tree
  (it offers to stash), the same claude.ai account signed in through `/login` rather than an
  API key, and the branch pushed, which it is. It checks the branch out and loads the
  conversation. The terminal gets its own copy, and nothing you do there flows back to the
  cloud session. Its fetch never waits for input, so if git would ask for a password or an
  SSH passphrase, run `git fetch` once by hand first.
  [Docs](https://code.claude.com/docs/en/claude-code-on-the-web#from-cloud-to-terminal).

Either way, only one session should push to this branch at a time. The cloud session has
cancelled its PR watch and its scheduled check-in, so it will not push behind you.

### What does not come with you

- **The PR watch.** The cloud session got PR #23's CI results and review comments pushed to it
  as GitHub events. A local session does not, so both local routes poll through the GitHub
  CLI: install `gh` and run `gh auth login` first. The Desktop app shows a CI status bar with
  Auto-fix and Auto-merge toggles and a notification when CI finishes. In the CLI,
  `/loop check PR #23's CI and review comments` runs only while that session stays open and
  expires after seven days. `/autofix-pr` on the branch hands the watch to a new cloud
  session instead.
- **GitHub access.** The cloud session reached GitHub through a connector. Locally it is your
  own git credentials and `gh`.
- **The test stack.** The cloud container's Postgres, Redis and Meilisearch went with it.
  `bash e2e/run.sh` builds its own on the laptop.
- **Nothing else.** There is no uncommitted work and no stash. Issue #24 carries the touch
  audit script, and the PR description carries the full report.

### Setting up the laptop

- **Shell:** Git Bash. `e2e/run.sh` is POSIX and the `build` script uses `NODE_ENV=production
  vite build`, which fails under cmd.exe.
- **pnpm** is not on PATH by default; it is in `%APPDATA%\npm`.
- **e2e:** `bash e2e/run.sh` drives the installed **Edge** on Windows (Chromium elsewhere;
  `E2E_BROWSER` overrides). It needs the Postgres binaries installed and a Python env
  (`pipenv sync --dev`, or `E2E_VENV=<venv>`); it fetches Meilisearch itself. API on 8010,
  because 8000 sits in a Windows reserved port range.
- **Backend suite:** fresh database and `redis-cli flushall` first, or it lies (§7).

### What to do next, and what being local changes

Everything still open needs something the cloud session did not have: your SSH key, your
inbox, a real phone, the Oracle console. This is the route for each.

| Open item | Local route |
| --- | --- |
| §1 A, Oracle shape (issue #22) | **Do the console change by hand.** It is one form on billing-sensitive infrastructure, and screen control (Desktop computer use) would be the only way for Claude to drive it. Then Claude can copy `uploads/` and `.env` off the box with `scp` from Git Bash, using your key, one approved command at a time. |
| §1 B, pull images after merge | From the local session: `ssh ubuntu@<public-ip> 'cd frogQuiz && docker compose pull && docker compose up -d'`. |
| §1 C, real mail | [Claude in Chrome](https://code.claude.com/docs/en/chrome) works with Edge and uses your signed-in browser, so Claude can open the Hotmail inbox, check spam, and follow the confirm and reset links. Allow it on that site only, in the extension's site permissions. |
| §1 D, worker container | `ssh ubuntu@<public-ip> 'cd frogQuiz && docker compose ps'`. |
| MVP.md §4.1, deployed-site run | The same browser route covers the anonymous host, register, forgot password and account deletion. The three-phone game stays a human job. |
| #24, touch targets | A real phone on the same Wi-Fi (command below). Emulation measured the sizes; only a thumb shows whether they are enough. |

**A phone against the local stack (untested).** With `KEEP_UP=1 bash e2e/run.sh --list` up,
start a second dev server that listens on the network, then open
`http://<laptop-IP>:3001` on the phone:

```bash
cd frontend
API_PROXY_TARGET=http://127.0.0.1:8010 API_URL=http://127.0.0.1:8010 \
  pnpm exec vite dev --host --port 3001   # pnpm lives in %APPDATA%\npm
```

The proxy carries `/api` and `/socket.io`, so live games work too. Windows will ask whether
to let Node through the firewall: allow private networks only. Sign-in survives plain HTTP
because `COOKIE_SECURE` is on only when `ROOT_ADDRESS` starts with `https://`. The e2e stack
does not set `ROOT_ADDRESS`, but a stray `.env` in the repo root that does would break this.

**Also new locally**, each checked against the docs on 4 Oct:

- **Remote Control.** `/remote-control` in a session, or `claude --remote-control`, puts the
  local session in the Claude app on your phone. The laptop has to stay on with `claude`
  running. It reconnects by itself after sleep.
  [Docs](https://code.claude.com/docs/en/remote-control).
- **Desktop app Browser pane.** Claude opens the running app, clicks, fills forms and takes
  screenshots, which is how this session walked the UI with Playwright. To attach it to the
  stack `run.sh` already started, give `.claude/launch.json` a `url` and no command.
  [Docs](https://code.claude.com/docs/en/desktop#preview-your-app).
- **Git Bash is the shell.** With Git for Windows installed, Claude Code's Bash tool runs in
  Git Bash, which is what `e2e/run.sh` and the `build` script need. If it is not found, set
  `CLAUDE_CODE_GIT_BASH_PATH` in `~/.claude/settings.json`.
  [Docs](https://code.claude.com/docs/en/setup#set-up-on-windows).
- **Context7.** CLAUDE.md points to it for shadcn-svelte docs, but it was not connected in
  the cloud session. Add it with `claude mcp add` (the command is in Context7's README).
  `--scope project` writes `.mcp.json` for both of you; the default scope keeps it on this
  machine only.
- **Computer use** (the Desktop app controlling your screen) is a research preview on
  Windows, for Pro and Max plans only. Nothing above needs it.

---

## 1. Do these four things, in this order

Nothing else on this list has a deadline. These do.

### A. The Oracle VM, before 31 October — 15 minutes, free

Oracle **halved** the Always Free ARM allowance, with no announcement. It is now **2 OCPU
/ 12 GB**; `DEPLOY.md` used to tell you to build 4/24 and called that "the whole
allowance". An over-allowance tenancy is not trimmed to fit — **every A1 instance in it is
disabled and then deleted**.

The site is up today, which proves nothing: the 30-day grace keeps over-limit resources
running right up to the cliff.

1. Oracle console → Compute → Instances → check the shape. If it says 4 OCPU / 24 GB,
   **Edit shape → 2 OCPU / 12 GB**. It reboots but keeps the IP and the disk. Do it when
   no game is live.
2. Copy `uploads/` and `.env` off the box. **Uploaded quiz images exist only on that
   disk** — `STORAGE_BACKEND=local`, no S3, no backup job. If the instance goes, every
   quiz image goes with it while the quiz text survives pointing at nothing.

Full analysis, verified against Oracle's own documentation, with a dated checklist:
**issue #22**.

### B. After merging, update the API on the VM — 5 minutes

Merging builds new images (`build_backend.yml` publishes `ghcr.io/ogfrench/frogquiz-backend:master`,
which the `api` and `worker` services run; `build_caddy.yml` does the same for the proxy),
but **nothing in this repo's setup pulls them onto the VM**: no Watchtower, no cron (unless
someone added one by hand on the box). Once the workflow is green:

```bash
cd frogQuiz && docker compose pull && docker compose up -d   # prestart runs the migrations
```

Until then the backend half of this PR is not live, even though Netlify ships the new
frontend within a minute of the merge: upload caps, the pixel check, text and quiz-shape
limits, the disconnect fix, owner-only Excel, the token fixes, immediate sign-out of other
devices and POST-only logout all run on the old code. (Log out itself keeps working in
that gap: the button falls back to the old GET when the API answers 404.) The same is true of PR #23's deploy preview, which
runs this branch's frontend against the production API, so test backend changes on the
local stack (`bash e2e/run.sh`), not on the preview.

### C. Prove mail works on the deployed site — 10 minutes

Set `MAIL_*` on the production API and run register → confirm → reset by hand, to
**francois.prevot@hotmail.com**. Steps are in `DEPLOY.md` under "Testing it for real".

The code path is now automated end to end (see §3), including the parts that only exist
inside the email. What automation cannot prove is that a real provider accepts and
delivers it. Check the spam folder on both messages — landing in spam is a pass for the
code and a fail for the deployment, and it is the likely outcome on a fresh sender domain.

### D. Confirm the `worker` container runs in production — 2 minutes

`docker compose ps` on the VM. Without it, the 30-day deletion that the anonymous-quiz
notice promises every user is not actually happening.

---

## 2. What changed, in one paragraph each

**Uploads got real limits.** There was no server-side cap at all: the route passed
`size=0` into storage, and the browser's cap was not applied either because `restrictions`
is an Uppy *Core* option that was being handed to the Dashboard plugin. Now 5 MB per image
and 1 GiB per account, enforced at Caddy, on `Content-Length`, and on the counted bytes.
Deleting an image gives the space back — it never did, so the quota was a lifetime counter
and enforcing it would have locked people out permanently. Deleting a quiz now frees its
images, including cover and background, which a stale regex had silently never done.
[`docs/uploads.md`](docs/uploads.md)

**Live games stopped breaking in three ways.** A closed laptop used to freeze the game for
everyone, because there was no socket `disconnect` handler and the closed tab stayed in
the count that "everyone has answered" is measured against. A refused answer told the
player "Answer locked in" because `question_not_active` had no listener anywhere. And
`captcha_enabled` defaulted to *true* on `/quiz/start`, where it raised an `AttributeError`
out of `join_game`.

**Results are the owner's** (D18, François's call). The view page hid correct answers from
a non-owner while the Download button beside it handed over a spreadsheet containing them,
so any signed-in teammate could read the answers to a quiz they were about to play.

**The host decides what players see on their phones** (D16, "make it like Kahoot"). A
switch in the start modal, off by default — shapes only, question on your screen — exactly
as Kahoot does, which ships the same setting free. Turn it on for a call. Both render
paths already existed; the modal was simply hardcoding one of them.

**The join screen** no longer pre-fills a fake PIN, states the digit count in words, shows
an inert rather than broken-looking Submit while you type, sits in the upper third on a
laptop instead of floating mid-void, and no longer lets a long quiz title swamp the "You're
in" confirmation.

**Hostile input — the app was attacked on purpose, not just exercised.** Three passes, each
a real finding closed with a test that fails against the old code:

- **Unbounded text.** `ormar.Text()` had no length limit, so a 5000-character title saved
  intact, and a 272-character word with no spaces overflowed the player's lobby by 6611 px
  and the host's screen by 7736 px. Now bounded (title 100, description 500, question 250,
  answer 100, measured on visible text), with `wrap-anywhere` at every render site because
  a quiz saved before the bounds is never revalidated.
- **A decompression bomb.** A 20000×20000 PNG of one color is under 400 KiB — inside the
  5 MB byte cap — and ~1.6 GB as a bitmap in every browser that draws it. The server never
  decodes an image, so the clients (phones, projector) are what fall over. Now rejected by
  a header-only dimension read (no decode, no dependency) at 8000 px per side.
- **Quiz shape, and editor/server drift.** Questions had no bound (5000 accepted → now a
  1000 DoS ceiling, with the tested 200/500 scale contract preserved), and the editor was
  looser than the server on answers (16 vs 10), question length (299 vs 250) and the timer
  (unbounded vs 999) — so a user could build a quiz the server then refused. The six
  correctness limits are pinned editor == server by a test that reads both.

What held up: the nickname bound (50, control chars stripped), the server's timer bounds,
and the answer/timer grids at phone and projector width. One known gap is written down in
`docs/uploads.md`: the uploader's own browser still decodes a true square bomb in Uppy's
Compressor before the server sees it, hanging only the uploader's own tab — a follow-up.

**Navigation and a UI best-practice pass** (3 Oct, from François's phone screenshots).
One **Log in** in the navbar, with registration on the login page; signed in, a circle
with your initial that opens **My Account**, where Log out now lives. On a phone, Join sits beside the menu button
instead of stranded mid-bar, and the menu is a real drawer with "Create a quiz" at its
foot. Tablets get the full bar. The review behind it ran axe on every visible route at 390
and 1440 and walked the screenshots; every route is now axe-clean. Real bugs it found:
"Log in" returned you to whichever page the app was first opened on, My Quizzes rows said
"Questions" with no number, the footer existed on four pages of ten, and the editor's
question list was a critical ARIA error.

**Answer tiles are always pastel.** Every screen used to draw a color stored on the answer
instead of the palette, so quizzes from the ClassQuiz days (the one public quiz on
frogquiz.xyz) came out brown and green, and anything written through the API could be pure
red. The palette is now the only source, by slot, and wraps past four, which also fixes
answers five to ten having no color at all on the host and phone screens.

**Keyboard, and the last hand-rolled overlays** (3 Oct, overnight). The headline: **Tab
did nothing on any page.** The command palette's key bindings sit on `window` for the life
of the app and never checked whether it was open, so Tab and the arrow keys were swallowed
everywhere and Enter could run the palette's last action after it closed. That was in the
code since the fork. With Tab working, the first real keyboard walk found the rest: the
join screen dropped focus between PIN and name, the lobby's full-screen QR could not be
closed from the keyboard, and editor answers, the timer and player answer tiles showed no
focus. Separately, every uploaded image was announced to screen readers as "��e"
(`atob(null)` decodes the string "null"). The image uploader, Advanced settings and the
image full-screen view are now the shadcn Dialog like everything else. Each bug has an
e2e test that fails on the old code.

**The live game, screen by screen** (4 Oct). axe now passes every state of a game, host
and phone, in both themes. Getting there found one real gap: **after a multiple-answer
question the projector showed an empty card**, because the results screen listed the
types it draws and left that one out. The phone side of the same question type opened
with every tile faded (looking disabled), gave no hint that several answers count, and
put Submit in a strip 5% of the screen tall. The question screen was `h-screen w-screen`,
so on a real phone the bottom tiles could sit under the browser toolbar, and with
questions shown on devices it overflowed by ~150px. Medal colors on a player's score
were under AA in one theme or the other; the scoreboard's up/down labels were never
read out.

**Signing a device out takes effect at once** (4 Oct, François agreed). Deleting a session,
"sign out everywhere", logging out, changing the password and resetting it used to remove
only the refresh record, so the other device kept working for up to 30 minutes on its
access token. Checked on the local stack before and after. Tokens now carry their session
id (`sid`), revoking a session writes it to Redis for one token lifetime, and the four
token checks in `frogquiz/auth.py` refuse a revoked one (one Redis read). Tokens minted
before the deploy have no `sid` and lapse within 30 minutes as before. No schema change.

**Walking the app as a user** (4 Oct). Every flow outside a live game, through the UI only,
at 390 with touch and at 1440, both themes. The real bugs: changing a question's timer
broke Save (422, a regression from this branch's editor rebuild); on a phone, taps inside
an open question card hit the drag grip; True / False came pre-marked True; logging back
in after a password change did nothing. Each has an e2e test that fails on the old code;
the full list is in `TODO.md` under "Done — 4 Oct". Touch-sized press areas everywhere
else were issue #24, fixed the same day; `frontend/e2e/touch-targets.e2e.ts` audits them.

Everything else is in [`CHANGELOG.md`](CHANGELOG.md).

---

## 3. The test suites, and why they are worth trusting

115 → **146 e2e tests**, and six of the new ones are *user journeys* rather than feature
tests. The distinction matters: the existing suite was organized by mechanism — sockets,
editor, uploads, exits — and was thorough at it, but a journey fails for a different
reason. Not "this control is wrong" but **"you cannot get from here to there."**

| Journey | What it walks |
| --- | --- |
| `journey-recovery` | Sign up, forget, request a reset, **read the real email**, follow the link, set a new password; old one refused, link dead the second time |
| `journey-first-game` | Land on `/`, Create with no account, write two questions, host, two phones join, play, podium, back to My Quizzes |
| `journey-teammate` | Owner publishes; a teammate finds it in Discover, cannot read which answer is right or download the sheet, but can run it |
| `journey-remote-call` | A host with nobody in the room runs a whole game on everyone's phones |
| `journey-returning-host` | Log in, find last month's quiz, change it, run it again |
| `journey-player-phone` | One phone, the whole arc: join, answer, be told, wait, answer, podium, out |

The unlock for the first one is `e2e/mailsink.py` — a 90-line SMTP server, no new
dependency — because `/forgot-password` answers 503 without a relay, so **password
recovery could not be tested at all** before today. It is the one journey `MVP.md` calls a
must-do before sharing.

**What the journeys found is the honest part: every first-run failure was the test's
assumption, not a product bug.** Nine of them. The app was right every time. That is the
useful result — a journey encodes what a *user* expects, and where that disagreed with the
app, the app won. The table of all nine is in
[`docs/session-2026-10-02.md`](docs/session-2026-10-02.md) §4.

---

## 4. Test stalls: two explained, two still open

Four intermittent live-game stalls were recorded, with a rule to root-cause the fourth
rather than note it. When it came, **two of the four turned out to be the test, not the
app**: `clearScoreboardStep` checked for the Scoreboard button once without waiting, so
when results arrived late it skipped the step and waited forever for the next button.
Reproduced on demand by delaying the results frame over the socket; the fixed helper
passes the same delay.

Still open: `editor.e2e.ts › build a quiz by hand` and `game-reload.e2e.ts › a player can
reload twice`. Both stall on the player side, a different symptom, and both pass in
isolation. They stay recorded in `TODO.md` **with an explicit instruction not to assume
one cause**. Earlier I attributed one of them to a known race, said it was fixed, then
measured it and found the unfixed code passed 10/10. The retraction is in the git history.

---

## 5. Decisions

**`MVP.md` §4.0 waits only on Gonçalo's tick for D16 and D18.** François signed D1 and
D3–D15 on 2 Oct; D2 and D16 he answered with "like Kahoot"; D8, D9, D17 and D18 are his.
Each row records what was decided and why.

One judgment call left open on purpose, not blocking:

- **SonarQube** is untouched, per François. The nearer neighbor, `svelte-check` in CI, is
  done: 0 errors since 4 Oct, and `frontend_lint` runs it.

---

## 6. Where to look

| File | What it holds |
| --- | --- |
| [`TODO.md`](TODO.md) | Running state. Start here for what is done and what is not |
| [`MVP.md`](MVP.md) | The plan and every decision, with both signatures |
| [`docs/session-2026-10-02.md`](docs/session-2026-10-02.md) | This session in full, **including what I got wrong** |
| [`CHANGELOG.md`](CHANGELOG.md) | Every change, newest first |
| [`docs/uploads.md`](docs/uploads.md) | Limits, where each is enforced, and why there is no file manager |
| [`docs/e2e-findings.md`](docs/e2e-findings.md) | Read before touching the socket server |
| [`DEPLOY.md`](DEPLOY.md) | Deployment, the corrected Oracle sizing, and the mail test |

## 7. Running it

```bash
bash e2e/run.sh                      # whole stack + 146 e2e tests, no Docker needed
KEEP_UP=1 bash e2e/run.sh --list     # leave it up at localhost:3000 to click around
bash e2e/stop.sh                     # stop it
cd frontend && pnpm test             # 153 unit tests, about a second
```

The backend suite needs a Python env (`pipenv sync --dev`, or point `E2E_VENV` at one) and
infrastructure; `run_tests.sh` wants Docker or Podman. It is order-dependent and shares
state, so always run it against a fresh database **and** a flushed Redis — a warm cache
produces about 40 spurious 401s that look exactly like broken auth.
