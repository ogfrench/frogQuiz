<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# Handover

The newest section comes first. The older ones are kept below for the decisions and commands
they record.

## Picking this up on the laptop (10 Oct)

The cloud session of 8 to 10 Oct stops here. Nothing is uncommitted: PR #37's branch is
pushed at the commit that added this section.

### Where things stand

| | |
| --- | --- |
| **PR #37** (MVP polish) | Branch `ccr-370df3e4-c44t1l`. The mandatory full review ran on 10 Oct. Every finding it confirmed is fixed, each with a test that failed first; the PR description has the list. Suites: e2e 218 of 218 (one full run on Chromium), unit 235, the backend socket and export tests 28, `flake8` 0, `svelte-check` 0 errors. **Waiting for your go to merge**, with "Create a merge commit". |
| **After #37 merges** | On the VM: `docker compose pull && docker compose up -d`, then `docker compose ps` to see the `worker` running. Until then, the new frontend shows players a letter instead of a frog. Nothing breaks. |
| **V1** | One PR from a branch called **`v1`**, cut from master once #37 is in. The order is issue #56 (the V1 roadmap). Not started. |
| **Deadline** | #22: the Oracle VM must be at 2 OCPU / 12 GB, backed up, and on Pay As You Go by about 25 Oct. Oracle reclaims it on 31 Oct. |
| **Folded into #37** | #51 (the host reload restores the question). It can close when #37 merges. |

### The V1 decisions (François, 10 Oct, in chat)

Record these in `MVP.md` §4.0 when V1 starts. Gonçalo has not seen them yet.

| Issue | Decision |
| --- | --- |
| #55 | Creating, uploading and hosting need a team account. Players still join by PIN without one. It is built as a flag, `anonymous_quizzes_enabled`, default off. Existing anonymous quizzes can be claimed until they expire. **This turns off a live feature, so CLAUDE.md needs Gonçalo's agreement before the V1 merge.** |
| #34 | Three levels (Public, Unlisted and Private), and new quizzes are Unlisted by default. Private is owner only, and old links to a quiz made Private give 404. This is a schema change. |
| #33 | Usernames can be changed: 3 to 20 characters, unique whatever the case, and the old URL gives 404. There is one name, no separate display name. An optional bio, up to 160 characters. |
| #39 | Examples in Explore, plus a server-side "Copy to my quizzes". About six examples, written fresh. |
| #40 | Play saves pending edits first, then opens the game in a new tab. |
| #41 | Undo and redo cover structure and fields. Question text keeps CKEditor's own undo. History lasts for the session, 50 steps. |
| #50 | Claude drafts the privacy and terms text, and François approves it. The contact address is still needed. |

These follow each issue's own recommendation, unless you say otherwise:

| Issue | Rule |
| --- | --- |
| #35 | A 409 offers Reload or Keep mine, and never loses typed text. A live game keeps its images until it ends. |
| #43 | A claim that puts an account over its quota still goes through. |
| #53 | High and critical audit findings fail the build. |

**Also added to V1 on 10 Oct:**

- A Neon snapshot before the V1 migration.
- Log rotation in `docker-compose.yml`.
- A scan of the compose images, which nothing tracks today: Meilisearch is pinned at `v0.28.0` (2022) and Valkey floats on `alpine`.
- Branch protection on master.
- A real hostname for the API instead of the sslip.io one.
- The live scoreboard leaves out hide-results points, though the podium counts them.

### Getting it onto the laptop

- **Plain git:** `git fetch origin && git switch ccr-370df3e4-c44t1l && git pull`. After #37
  merges: `git switch master && git pull && git switch -c v1`.
- **With the conversation:** `claude --teleport session_01KVaWrDgi2ESR2WbZoLq4MU`, from a clean
  checkout, signed in with `/login`. The conversation has been compacted, so what comes back is a
  summary of the same documents.
- **One session pushes at a time.** The cloud session is not watching PR #37 and will not push
  behind you.

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

1. Read PR #37's description. Merge it with a merge commit, then pull on the VM.
2. Do #22 on the Oracle console, whatever else is happening.
3. Cut `v1` from master. Open a draft PR straight away, so CI runs on every push. Do #56's
   step 0 housekeeping, and record the decisions in `MVP.md`.
4. Work #56's steps 1 to 6. Each step ends with a full review of its diff and a full e2e run.

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
