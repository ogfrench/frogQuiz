<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# V1 plan

**This is the living plan for V1.** Issue #56 holds the step checklist and links here.
- V1 ships in four releases, each its own PR from the branch `v1` (D35, 11 Oct): **v0.5** is steps 0 to 3 (PR #57), **v0.8** step 4, **v0.9** step 5, **v1.0** step 6. After each merge, `v1` restarts from master. Master before v0.5 is tagged `mvp`.
- Each step ends with a re-plan. A re-plan edits this file and adds a line to [Plan changes](#plan-changes). Read the log to see why the plan looks the way it does.

**Status: v0.5 (#57) shipped on 12 Oct; step 4 (v0.8) is built and waits for François's go. Step 5 (v0.9) starts the week of 19 Oct.** François trimmed V1 the same day (D39): #33, #34, #38 and #41 moved after V1, and #60 and #61 came in.

## What V1 means

- **Sign-in:** the team signs in with a frog.co or capgemini.com address, on a phone or a laptop.
- **Quizzes:** a signed-in user can do all of these:
  - make, edit, copy, play, host and delete quizzes
  - start a game straight from the editor
  - find, play and copy the Examples in Explore
- **Without an account:** creation, uploads and hosting are enabled by default with daily and live-total limits. Players join by PIN either way. Guests can browse Examples and use one as a private 30-day quiz.
- **Production:**
  - the VM is within its limits and backed up, with one restore tested
  - the API answers at `api.frogquiz.xyz` (since 12 Oct)
  - a health endpoint says when a part is down
- **Done:** every edge case in #45 has an outcome, and none of them blocks.

**Not in V1:**
- V2 (#4), including the five hidden question types
- Azure single sign-on
- more languages
- a public launch
- the features that stay hidden: controllers, QuizTivity, moderation, Pixabay. Step 5 lists every hidden route, and François picks which come back (12 Oct).
- moved after V1 on 12 Oct (D39): #33 profile by username, #34 Private visibility, #38 Explore filters, #41 undo and redo. Their decisions below stay for when they return.

## Decisions (François, 10 and 11 Oct)

They are also recorded in `MVP.md` §4.0, as D22 to D38.

| Issue | Decision |
| --- | --- |
| #55 | Creating, uploading and hosting work without an account by default, behind `anonymous_quizzes_enabled`; operators can turn them off. Players join by PIN either way. The two ceilings and 30-day expiry apply. D40, 13 Oct. |
| #55, the rest (11 Oct) | A cap on anonymous quizzes, built in V1: 20 new ones per address a day and 1,000 live in total, both settings. The 30-day window stays. Anonymous quizzes are unlisted only. An editor open at expiry keeps its clock, shows the reason and keeps the text. A running game continues after expiry. |
| #34 | Public, Unlisted and Private, with Unlisted as the default for a new quiz. Private is owner only, and old links to a quiz made Private give 404. A private quiz's images stay reachable by their unguessable URL. |
| #33 | A username can be changed: 3 to 20 characters, unique whatever the case, and the old URL gives 404. One name, no display name. An optional bio, up to 160 characters. |
| #39 | **A mix of examples:** about three general-knowledge quizzes and three that matter to the team.<br>- Each is a full, polished quiz of 10 to 12 questions.<br>- Together they use every question type.<br>- Facts are checked against sources, and nothing confidential goes in.<br>- François approves the text before it is seeded.<br>Explore gets Examples, and every quiz gets "Copy to my quizzes". |
| #40 | Play in the editor saves first, then opens the game in a new tab. |
| #41 | Undo and redo cover structure and fields. Question text keeps CKEditor's own undo. History lasts the session, 50 steps. |
| #50 | Claude drafts the privacy and terms pages, and François approves them. The contact is francois.prevot@frog.co. |
| #45 | No pass mark for room size. Record the number of players at which a game first breaks. |
| #35 | A 409 offers Reload or Keep mine, and typed text is never lost. A quiz with a live game keeps its images until the game ends, and its owner sees a warning. |
| #43 | A claim that puts an account over its quota still goes through. Uploads are then refused until the account is back under it. |
| #53 | High and critical findings fail the build. A finding with no fix gets an exception with a date. |
| Rule | François decides. The rule that a removal needed François and Gonçalo jointly is dropped (11 Oct). Claude proposes and never removes a feature on its own. |
| Domain | The API moves from `134-98-158-173.sslip.io` to `api.frogquiz.xyz`. |
| Merge | In releases, PR by PR (11 Oct, D35): v0.5, v0.8, v0.9, v1.0. A full review at the end of each step, and one before each merge. Master before v0.5 is tagged `mvp`. |
| Copy | Anyone signed in can copy any public quiz, as well as their own and the Examples (11 Oct, D33). A copy carries the answers, so this narrows D18 for public quizzes. |
| Scoreboard | The host's scoreboard and results cards stay white on the dark projector (11 Oct, D34). |
| Hotfix | None (11 Oct). The audit's `/live` fixes reach master with V1, not ahead of it on their own branch. |
| Use | The app is not in use yet (11 Oct): no real users and no real data. |
| Answered count | It counts only the players still in the game: a player who answered and then left drops out of both numbers (12 Oct, D37). |
| Mail | Sign-in by emailed link works in production, and mail is trusted: no emergency sign-in (11 Oct). |
| Backups | In V1 after all, "if easy and possible" (12 Oct, D39): #61, in step 6. |
| Monitoring | In V1 (12 Oct, D39): #60, in step 4. |
| Scope (12 Oct, D39) | V1 keeps #40, #39, #42, #44, #50, #60, #61 and a trimmed #45. #33, #34, #38 and #41 move after V1. Examples: three general knowledge, plus "frogQuiz onboarding" and "frog's history" (five in all). Hidden actions and hidden routes both get a check that can end in a redesign. |
| Server image | François builds the backend image from his laptop at the deploy (11 Oct). CI publishes `:master` only when `frogquiz/**` changes, so a change to the Dockerfile, the lock or a migration alone would not reach the VM. |

## How the plan adapts

The same loop runs at three levels, and each level ends by re-planning what is left.

| Level | Plan | Build | Check | Re-plan |
| --- | --- | --- | --- | --- |
| **V1** | This file: decisions, steps, and a status for each | Steps 0 to 6 | Final full review, full e2e run, full visual pass | Before the merge: what moved to post-V1, and why |
| **Step** | A mini-plan at the top of the step: issues, order, files, tests, the screens it touches | Its issues | A full review of the step's diff, the full e2e suite, a visual review of the touched screens, green CI | Rewrite the steps that remain, from what this step found |
| **Issue** | Read the issue and the code, then write the failing test | The change, with a CHANGELOG line | A cheap review, the affected specs, a capture of the affected screens | Note any change of scope in the step's mini-plan |

**Where a finding goes:**
1. Small and in scope: fixed in the current issue.
2. In scope but bigger: added to the current step.
3. Out of scope for this step: a later step.
4. Not V1: the post-V1 list, with the reason.

A question for François is asked at a step boundary, unless it blocks the work. Each re-plan updates #56's checklist and the draft PR's step list to match this file.

## Visual review

**Capture:** run `VISUAL=1 bash e2e/run.sh e2e/visual.e2e.ts`.
- It captures:
  - every visible route at 390, 834 and 1440 px, in light and dark
  - signed out and signed in
  - empty and full lists
  - the open dialogs
  - a whole game: the host at 1440 and 1920×1080, the players at 390
- Every shot is checked for:
  - the three CLAUDE.md assertions (the `.dark` class toggles, no horizontal overflow, the token background on `<html>`)
  - axe
- The PNGs and a manifest go to `e2e/.visual/`, which is git-ignored.

**Review:**
- Each step looks at the screens it touched. Step 5 looks at every screen.
- The checklist is the one in CLAUDE.md.
- Findings go in [`visual-review-v1.md`](visual-review-v1.md), and are fixed before the step's full review.
- The shots are published as a private gallery for François to look through.

## Steps

### Step 0: merge, branch and housekeeping (done)

- [x] PR #37 merged with a merge commit (`58d6241`), and #51 closed with it.
- [x] Branch `v1` cut from master.
- [x] Draft PR "V1" opened: #57.
- [x] This file and `visual-review-v1.md` written.
  - `TODO.md` points to #56.
  - The decisions are recorded in `MVP.md`.
  - The CLAUDE.md rule is changed.
- [x] GitHub:
  - the label `post-v1`, on #4. `v1-blocker` waits for #45's list (see Plan changes).
  - #3 closed into #45
  - #43 made a sub-issue of #55
  - #56 shortened to the checklist
- [x] Visual tooling, and a baseline of every screen on the merged master. The baseline missed the signed-out screens at 1440 and in dark; step 1 found and closed that gap.
- **François:** after the merge, on the VM, run `docker compose pull && docker compose up -d`, then `docker compose ps`.

### Step 1: CI and production safety (done)

**Done on the branch:**
- [x] The audit workflow, with dated exceptions, and the backend re-lock that took 124 advisories to 5 exceptions.
- [x] The secret scan. gitleaks over the history found five test fixtures, now allowed by fingerprint in `.gitleaksignore`. A planted token was caught in a throwaway local clone, in place of a throwaway branch on GitHub.
- [x] e2e in CI (`.github/workflows/e2e.yml`).
- [x] Log limits on every compose service.
- [x] The `DEPLOY.md` fixes, and the steps for `api.frogquiz.xyz`.
- [x] The host timer: François chose design C, the drain bar.
- [x] Checks: full e2e, the backend suite on the new dependencies (241 passed, 1 skipped), `pnpm test`, `svelte-check`, eslint, flake8, and a visual review of 168 shots.

- [x] CI's first run on #57 failed four checks, each diagnosed and fixed (see Plan changes): Meilisearch moved to v1.54.3, the postgres scan skips gosu, gitleaks is pinned, and `run.sh` finds a pipx pipenv.
- [x] The phone timer ring empties, as the host's bar does (François).
- [x] The host's title card wraps a long title. CI's first e2e run found it overflowing.
- [x] The cheap review's fixes:
  - the sslip.io hostname is allowed by value in `.gitleaks.toml`, not by commit
  - CI keeps Postgres's own log
  - the backend suite also runs for a lock-only or migration-only PR
  - each image scan fails if its tag is no longer the one `docker-compose.yml` runs
  - the Meilisearch rollback in `DEPLOY.md` works as written

- [x] Checks at the end of the step: every check on #57 green at `62268ff`, the full e2e suite on a fresh stack (218 passed, 0 failed, 4 skipped), and the Meilisearch rebuild tested on its own.

**Left, and whose:**
- **François:**
  - ~~the DNS record for `api.frogquiz.xyz`, then the VM's `SITE_ADDRESS`~~ Done 12 Oct by Claude, at François's request (Netlify CLI, then `.env` on the VM).
  - #22 by 25 Oct
  - the Meilisearch v1 steps in `DEPLOY.md`, with the next VM pull

**As planned:**

- **#53:**
  - an audit workflow: `pip-audit`, `pnpm audit --prod --audit-level high`, gitleaks, and a scan of the images pinned in compose
  - a file of exceptions, each with a date
  - a test secret on a throwaway branch, to show the scan catches it
- **e2e in CI:** a Playwright job on PRs, if `e2e/run.sh` runs on the GitHub runner without heavy surgery.
- **`docker-compose.yml`:** a log size limit on every service.
- **API at `api.frogquiz.xyz`:**
  - François adds the DNS A record.
  - The config follows: `netlify.toml`, `SITE_ADDRESS`, `CORS_ORIGINS` and `DEPLOY.md`.
- **#22:**
  - **François, by 25 Oct:** resize to 2 OCPU / 12 GB, back up, switch to Pay As You Go with a $1 budget alert, check the worker.
  - **On the branch:** fix `DEPLOY.md` to match.

### Step 2: decisions

Done above.

### Step 3: correctness

Split in two on 11 Oct, each with its own step-end review: **3a** is data and concurrency (#52, #35, the scoreboard, the answered count), and **3b** is accounts (#55, #43). Claims reuse 3a's conditional writes, so 3a goes first.

**Status:** done (11 Oct). 3a, then 3b: the two #43 races (`780d744`), the editor's version check (`5ebb5bf`), and the #55 setting with its ceilings, the `/create` redirect and the matrix. Trimmed on 11 Oct because the app is not in use: nothing exists yet that the screens for old anonymous quizzes would serve.

- **#52:** the server refuses to save results for a game with no signed-in host.
- **#35:**
  - `views` and `plays` become atomic increments.
  - Every whole-row write keeps to the columns it changes.
  - `base` on `/editor/finish`.
  - A 409 offers Reload or Keep mine.
  - 401 and 404 messages name the cause.
  - A live-game marker protects the quiz's images.
- **#55:**
  - the flag, `anonymous_quizzes_enabled`, default off, passed through compose
  - 401 on the anonymous write paths when it is off; the claim and a secret holder's reads keep working
  - `/create` redirects to sign-in when it is off
  - the e2e stack and CI turn it on, since the suite hosts anonymously; the off path gets its own tests
  - the matrix in `docs/anonymous-vs-account.md`, and the decisions in `MVP.md`
  - **dropped (11 Oct, app not in use):** the claim banner and "deleted on {date}" for old anonymous quizzes. None exist.
- **The anonymous cap (3b):** 20 new anonymous quizzes per address a day, and 1,000 live in total. It stops creating, never editing.
- **From the security audit (3b):** password registration gets the allowed-domain rule, for the day it is switched back on. See `docs/security-audit-2026-10-11.md`.
  - **Moved to post-V1 (11 Oct, Claude's call):** the single-use sign-in link (finding 4, low). Sign-in by link is the only way in and works; making it single-use risks a mail scanner using the link up first, for a low finding. And "sign out everywhere" revoking API keys (finding 5, low): no screen creates a key, so nobody holds one.
- **#43:** the two races found while planning are fixed with tests (the sweep deleting a quiz claimed a moment earlier, two claims at once). The other claim cases get a written outcome in the matrix; no new e2e tests, since the flag is off and no anonymous quiz exists to claim (11 Oct).
- **The live scoreboard:** it follows the server's totals, so a hide-results question's points are no longer left out.
- **The answered count:** "3 of 2 answered". The host adds one per answer, and drops a player who disconnects from the total, so a player who answers and then loses signal is counted on one side only. Found by step 1's cheap review.

### Step 4: features, health and the API move (v0.8, built 12 Oct)

Re-planned 12 Oct after D39. #34, #33, #38 and #41 left the step.

1. **Housekeeping:** the four issues labelled `post-v1`, D39, this file and #56.
2. **The API move:** `netlify.toml` points at `api.frogquiz.xyz`. DNS and Caddy were done on 12 Oct; the sslip name stays served until `DEPLOY.md` step 4.
3. **#60 health:** `GET /api/v1/health` (database, Redis, Meilisearch, worker), a worker heartbeat every minute, and compose healthchecks for the api and the worker. The uptime monitor needs an account, so it is François's.
4. **#40 Play from the editor** (a Sonnet agent in its own worktree): saves first, opens the game in a new tab (D27).
5. **#39 examples and Copy:**
   - Examples are the public quizzes of one examples account (`examples@frogquiz.invalid`, which no sign-in can reach), seeded by `python -m frogquiz.examples.seed` from JSON in the repo. No migration.
   - Copy (`POST /api/v1/quiz/copy/{id}`) works on your own quizzes, the Examples and any public quiz (D33). A copy is unlisted, and its images are copied, not shared, and count against the copier's quota.
   - Five text-only examples (D39), drafted with a source for every fact, approved by François before seeding.

### Step 5: review and consistency

- **#42:** go through every hidden menu on the live screens, with what the issue asks: `docs/ux-review-hidden-menus.md`, one row per menu, and one issue per fix. A verdict can be "redesign": the action leaves the menu for visible UI (12 Oct). Includes the lobby popover that still links to the hidden `/remote`.
- **Hidden routes (12 Oct, François):** a second table in the same doc, one row per hidden route (results history, Kahoot import, the media library, the public user page, video, avatars, `/remote`, the hidden docs pages, the flag-gated features): does the URL still reach it, does it work, what would bringing it back cost, and a recommendation. François picks; the routes he picks are redesigned in this step and leave `DISABLED_ROUTES`. Removal stays his decision, recorded in `MVP.md`.
- **#44, the consistency pass, as the issue asks (the plan had only the capture):**
  - a one-page style note in `docs/`, with the exceptions (the frog palette, the answer colours, the QR's white ground)
  - a test that fails on the banned patterns on live routes, like the radius test
  - fixes by area: the editor, the game screens, account, Explore
  - baseline on 11 Oct, all of `frontend/src` (hidden routes included): 173 hard-coded colour classes, 45 raw `<svg>`, 32 `w-screen` or `h-screen`, 25 inline colour styles
  - the full visual pass, including the four pages still on the old layout, and the host's title card before question 1
  - from 3a: the scoreboard and results cards stay white in dark mode (D34), as a recorded exception; the question card's uneven padding at 390 and 834; the conflict dialog's wording
- **#50:** the docs, and the privacy and terms pages. Also the stale notes found on 11 Oct: test counts in `HANDOVER.md` and `TODO.md`, the "still open" polish list in `e2e-findings.md` (mostly fixed), and where `DISABLED_ROUTES` lives.
- **From the security audit:** finding 6 (the page gate reads the token unsigned) and finding 7 (the server-shared "signed in" store).

### Step 6: robustness and release

- **#61 backups:** a nightly `pg_dump` of Neon and a tar of the uploads, sent off the VM to an OCI Object Storage bucket François creates (14-day lifecycle, a pre-authenticated write URL). A restore runbook in `DEPLOY.md`, and one real restore into a Neon branch, timed.
- **#45, trimmed (12 Oct):** game flow, the parts of the stack going down, a new frontend on an old backend, the room-size number (`simulate_players.py`), and one real game on an iPhone and an Android phone with François. The rest is written down as deferred, with the reason. It closes after the deploy, not at the merge.
- **Final full review**, then the V1-level re-plan.
- **Checkpoint:** François approves the merge.
- **Deploy, in this order:**
  1. a Neon snapshot of production
  2. pause Netlify
  3. merge
  4. on the VM: build the backend image from François's laptop (or the VM) and pull, since CI does not rebuild it for every change
  5. `docker compose up -d`, which also gives the worker its uploads folder
  6. smoke-test the API
  7. publish the frontend
  8. a run on a phone and a laptop, then close #45 and #56

## Post-V1

- **Results history and Save results:** stay hidden (D4).
- **python-jose → PyJWT:** in `frogquiz/auth.py`. It removes two dated exceptions (python-jose, ecdsa). Revisit by 31 Dec.
- **httpx → httpx2:** after the re-lock, authlib and Starlette's test client warn that `httpx` is deprecated in favour of `httpx2`. Only warnings for now; move when either drops `httpx`.
- **ormar 0.20 → 0.23+:** SQLAlchemy 2, without `databases`. It removes the ormar and setuptools exceptions, and unpins pydantic. Revisit by 31 Dec.

## Plan changes

- **10 Oct:**
  - The plan was made, with François's decisions.
  - #51 was folded into PR #37. The full review found that a host reload could rewind a running game, and the fix was most of #51.
- **11 Oct:**
  - Visual review added to every step.
  - The plan now adapts itself at three levels.
  - The joint-decision rule was dropped.
  - The examples are a mix of general knowledge and team quizzes.
  - The contact is francois.prevot@frog.co.
  - No room-size pass mark.
  - The API moves to `api.frogquiz.xyz`.
  - PR #37 merged.
- **11 Oct, step 1 started:**
  - **Audit findings:** the first audit found 124 advisories in 25 backend packages. By the "in scope but bigger" rule, upgrading them joined step 1.
  - **Pillow** was capped below 11 by `thumbhash-python`, so the ThumbHash encoder was vendored instead.
  - **ormar's fix** needs a database-layer migration. ormar is held, with dated exceptions, and the migration moved to post-V1, together with replacing python-jose.
  - **The `v1-blocker` label** waits for #45's blocker list rather than being applied by guess now.
  - **The API hostname** moves in three ordered steps: DNS, then Caddy serving both names, then `netlify.toml`. The `netlify.toml` edit is a deploy-checklist item, so deploy previews keep working until the DNS is in.
- **11 Oct, step 1 review:**
  - **Found by the visual review:** the step 1 timer change had frozen the phone ring on its first frame. It was fixed, and an e2e check now fails if the ring stops moving.
  - **The capture tooling had a gap:** the signed-out loop stopped at 834 px. Step 0's baseline therefore missed 1440 and dark there. It is fixed, and those 80 shots were reviewed in step 1.
  - **The secret scan:** shown on a local clone rather than a throwaway branch on GitHub, so no fake secret was pushed anywhere.
  - **The ThumbHash encoder** no longer uses Pillow's deprecated `getdata`.
  - **New question for François:** the phone ring and the host bar count time in opposite directions.
  - **Pending:** CI on #57 decides whether the Meilisearch upgrade moves into V1.
- **11 Oct, step 1 CI:** the first CI run failed four checks.
  - **Meilisearch v0.28.0** had 17 high and critical findings, so its upgrade moved from post-V1 into step 1, as planned. It needs no dump: the index is rebuilt from Postgres on start-up. e2e already ran on 1.54, but never through that rebuild, since a fresh stack has nothing to sync, so it was tested on its own.
  - **postgres:14-alpine:** every finding was in gosu's Go standard library. The scan skips that file, which is not a fix to wait for.
  - **gitleaks:** CI runs 8.24.3, not the 8.28 used locally, and 8.24's rule read a hostname list in `DEPLOY.md` as a key. It is pinned now, so local and CI agree.
  - **e2e:** `run.sh` could not find a pipenv installed with pipx. It died before any test.
  - **François's answer:** the phone ring drains, like the host bar.
- **11 Oct, step 1 cheap review:** no blockers.
  - **The DEPLOY.md hostname** was allowed by commit, so a squash, a rebase or an edit to that line would turn the scan red again. It is now allowed by value, in `.gitleaks.toml`, and the two commit fingerprints are gone.
  - **Fixed in step 1:**
    - CI did not keep `pg.log`, the file its own error message points to.
    - The backend suite skipped a PR that only touched the lock or a migration.
    - A tag bumped in compose would have left the image scan on the old one.
    - The Meilisearch rollback missed the volume declaration, so compose would have refused it.
  - **Moved to step 3:** the host's answered count can exceed the player count.
  - **One local e2e failure,** the lobby QR keyboard test. It pressed Enter before focus reached the dialog's Close button, and the test now waits for that.
- **11 Oct, CI's first e2e run:** 216 passed, 2 failed.
  - **The QR test:** the same race as locally.
  - **A real overflow, older than V1:** on the host's title card before question 1, a title with no spaces ran 757px off the projector. The test had only checked that screen by chance, so it never failed locally. The card now wraps the title, the test checks the card on purpose, and the visual capture adds this screen in step 5.
  - **Meilisearch rebuild, tested on a stack with real quizzes:** after a wipe, a signed-in search rebuilt the index from Postgres (6 of 6) and found the probe quiz, and so did an API restart. Search needs a signed-in user, which the first attempt at the test missed.
- **11 Oct, step 1 closed:**
  - **Master moved:** #58 (the shared Claude Code setup) landed on master and conflicted with V1 in `CHANGELOG.md`. While the conflict stood, GitHub ran none of #57's pull-request checks. Master was merged in with a merge commit, keeping both sections. When checks go missing, look at the PR's mergeable state first.
  - **Every check on #57 is green at `62268ff`,** CI's e2e included.
  - **Re-plan:** step 3 gains the answered count. Nothing else moved: the step 3 to 6 plan stands as written.
- **11 Oct, step 3 planned:**
  - **Split** into 3a (data and concurrency) and 3b (accounts), because one review of all six items would be too large to read.
  - **François's answers on #55:** a cap is built in V1 (Claude picked 20 a day per address and 1,000 in total); the 30-day window, unlisted-only anonymous quizzes, the expiry message and running games after expiry stand as recommended.
  - **Found while reading, joined 3b:** the expiry sweep deletes without re-checking, so a claim in between is lost; and the claim checks then writes, so two at once both succeed.
  - **The e2e suite hosts anonymously almost everywhere,** so the e2e stack and CI turn the new flag on, and the off path is tested on its own.
- **11 Oct, step 3a, the security audit:** François asked whether the gate holds. A live probe as anonymous and as two accounts found it does, with one hole.
  - **Fixed in 3a:** three `/live` routes accepted any account's API key, and `/user_count` any key, so anyone signed in could read another account's running game, right answer included. Free-text answers also went to every phone.
  - **Moved to 3b:** single-use sign-in links, API keys revoked by "sign out everywhere", and the domain rule on password registration.
  - **Moved to step 5:** the server-shared "signed in" store, and the page gate's unsigned token read (no data reaches it).
  - **Also in 3a, from François's question:** the rich-text fields were square beside rounded ones; every text field now has one shape and one focus ring. CKEditor also dropped those fields' accessible names on the first keystroke.
  - **Lesson:** a second stack started from the same tree reloads the first one's pages; run the audit and e2e one after the other.
- **11 Oct, step 3a closed:**
  - **Checks:** every check on #57 green at `311df9e`, CI's e2e included. Locally: the e2e batch for the step's specs (105 of 105), the backend suite on a fresh database, `pnpm test` (246), `svelte-check` (0 errors), and a capture of the touched screens: 154 shots, axe and overflow clean once the fixes below were in.
  - **The visual review found three bugs, all fixed:**
    - The conflict dialog's "Load the other version" was blank: the outline look was passed as a class over the default variant and kept its near-white text. Axe flagged it at every size, in both themes.
    - The title and question fields used CKEditor's Helvetica beside Inter in every other field.
    - CKEditor's hidden badge left its empty frame on a focused field as a 2px blue dot.
    - Also polish: the live-game note at full strength, plainer copy for it and for the restore offer, and "Save as a new quiz" as the primary button once a quiz is gone.
  - **The step-end review of the whole diff (main model):** the backend holds. One gap: the editor's version check reads, then writes, so two saves in the same instant can both pass it. It joins 3b, with the other conditional writes.
  - **Moved to step 5, all older than V1:**
    - The scoreboard and results cards are hard-coded white, also in dark mode. Probably deliberate, so they read over a quiz's own background colour or image; step 5 decides.
    - The question card's inner padding is uneven at 390 and 834.
    - The conflict dialog's wording.
  - **François (11 Oct):** no hotfix; the `/live` fixes reach master with V1.
  - **A default, confirmed by François on 12 Oct (D37):** the answered count counts only the players still in the game.
  - **Re-plan:** 3b as planned, plus the editor's version check. Steps 4 to 6 unchanged.
  - **Lesson:** a variant passed as a class merges over the component's own default variant, and whatever the second one does not set survives. Pass variants as props.
- **11 Oct, the V1 review (François asked what was missed):**
  - **Found and fixed:** the worker never mounted the upload folder (older than V1), so on the VM nothing was hashed or counted and freed images stayed on disk. Meilisearch in CI now matches production. Mail is documented as required.
  - **Plan gaps closed:** #44 is a consistency pass with a style note and a test, not only a capture; #42 gets its doc and table; step 5 lists what moved there from 3a and the audit; #45 closes after the deploy, as do #56's post-deploy items; #41, #39 and #38 carry what their issues ask beyond the plan.
  - **François's answers:** the app is not in use; mail works, no emergency sign-in; no backups for now (#61); monitoring later (#60); he builds the server image from his laptop; the cap stays at 20 a day and 1,000 in total; the domain move is done by Claude where it can be.
  - **Trimmed from 3b,** since nothing exists for them to serve: the screens for old anonymous quizzes, the new #43 e2e cases, and two low audit findings (single-use links, API keys and sign-out-everywhere), now post-V1.
  - **Open:** D18 against D26 (Copy and answer keys), before #39.
- **11 Oct, step 3b closed, and V1 ships in releases:**
  - **Built:** the #55 setting, off by default, with a 401 on every anonymous write path and the two ceilings; `GET /api/v1/utils/config` tells the frontend, and `/create` sends a signed-out visitor to sign-in; password registration keeps to the allowed domains (audit). The matrix and the #43 claim cases are in `docs/anonymous-vs-account.md`.
  - **François's answers:** releases PR by PR, v0.5 now (steps 0 to 3), then v0.8, v0.9 and v1.0 (D35); master tagged `mvp`; Copy on any public quiz (D33, settles the D18 and D26 conflict); the white scoreboard cards stay (D34).
  - **Re-plan:** step 4 is v0.8, from `v1` restarted on master after #57 merges. #56 stays open until v1.0.
- **12 Oct, v0.5 shipped and V1 trimmed (D39):**
  - **Shipped:** #57 merged as `27c5171`, tagged `v0.5`, deployed to the VM; Netlify published it. `v1` restarted from master.
  - **The API move, steps 1 and 2:** François asked Claude to do them. The A record went in through the Netlify CLI, and the VM's `SITE_ADDRESS` serves both names; Caddy got the certificate at once. The laptop cannot reach the name because F-Secure blocks frogquiz.xyz there; it answers from the VM, CORS preflight included.
  - **François's triage:** #33, #34, #38 and #41 after V1; #60 into step 4 and #61 into step 6; #45 trimmed; examples cut to five (three general, frogQuiz onboarding, frog's history); hidden actions and hidden routes both checked, with a redesign as a possible outcome.
  - **Re-plan:** step 4 is the API move, #60, #40 and #39. Step 5 adds the hidden-route inventory. Step 6 adds #61 and drops the API move, which is done.
- **12 Oct, step 4 built:**
  - **Done:** the API move, #60, #40 and #39, with the five examples approved by François (the frog quiz states the acronym plainly and has Utrecht for Munich). Full e2e: 256 passed, 9 skipped, 0 failed.
  - **Reviews found and fixed:** the health check refused HEAD, which uptime monitors use; Copy wrote image ids in the hex form, which the orphan sweep would have deleted after a day; the start dialog could leave a blank tab on a malformed answer or open the game into a closed tab.
  - **Found, not fixed:** the hidden `.cqa` import has the same hex-id bug (noted in #42); Newest shows 15 rather than 20 once the five examples are filtered out of it.
  - **Re-plan:** François stopped at v0.8 for the week. Steps 5 and 6 stand as written; each issue carries its status and order.
