<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# V1 plan

**This is the living plan for V1.** Issue #56 holds the step checklist and links here.
- Everything lands in one PR from the branch `v1`.
- Each step ends with a re-plan. A re-plan edits this file and adds a line to [Plan changes](#plan-changes). Read the log to see why the plan looks the way it does.

**Status: step 1's CI fixes built, waiting on green CI on #57** (11 Oct). Step 3 is next.

## What V1 means

- **Sign-in:** the team signs in with a frog.co or capgemini.com address, on a phone or a laptop.
- **Quizzes:** a signed-in user can do all of these:
  - make, edit, copy, play, host and delete quizzes
  - set Private, Unlisted or Public on each
  - have a profile
  - search Explore with filters
- **Without an account:** creating, uploading and hosting need a team account. Players join by PIN with no account.
- **Production:**
  - the VM is within its limits and backed up
  - the API answers at `api.frogquiz.xyz`
- **Done:** every edge case in #45 has an outcome, and none of them blocks.

**Not in V1:**
- V2 (#4), including the five hidden question types
- Azure single sign-on
- more languages
- a public launch
- the features that stay hidden: controllers, QuizTivity, moderation, Pixabay, results history

## Decisions (François, 10 and 11 Oct)

They are also recorded in `MVP.md` §4.0, as D22 to D32.

| Issue | Decision |
| --- | --- |
| #55 | Creating, uploading and hosting need a team account. Players join by PIN without one. It is built behind the flag `anonymous_quizzes_enabled`, default off. Old anonymous quizzes can be claimed until they expire, with a banner. |
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
| Merge | One V1 PR, with a full review at the end of each step and one before the merge. |

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

### Step 1: CI and production safety (built; CI on #57 pending)

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
- [x] The cheap review's fixes:
  - the sslip.io hostname is allowed by value in `.gitleaks.toml`, not by commit
  - CI keeps Postgres's own log
  - the backend suite also runs for a lock-only or migration-only PR
  - each image scan fails if its tag is no longer the one `docker-compose.yml` runs
  - the Meilisearch rollback in `DEPLOY.md` works as written

**Left, and whose:**
- CI on #57 goes green.
- **François:**
  - the DNS record for `api.frogquiz.xyz`, then the VM's `SITE_ADDRESS`
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

- **#52:** the server refuses to save results for a game with no signed-in host.
- **#35:**
  - `views` and `plays` become atomic increments.
  - Every whole-row write keeps to the columns it changes.
  - `base` on `/editor/finish`.
  - A 409 offers Reload or Keep mine.
  - 401 and 404 messages name the cause.
  - A live-game marker protects the quiz's images.
- **#55:**
  - the matrix in `docs/anonymous-vs-account.md`
  - the flag
  - 401 on the anonymous write paths
  - `/create` redirects to sign-in
  - the claim banner
- **#43:** the claim cases that still apply.
- **The live scoreboard:** it follows the server's totals, so a hide-results question's points are no longer left out.
- **The answered count:** "3 of 2 answered". The host adds one per answer, and drops a player who disconnects from the total, so a player who answers and then loses signal is counted on one side only. Found by step 1's cheap review.

### Step 4: features

1. **#34 visibility.** A schema change, flagged in the PR.
2. **#33 profile.** `/user/[username]`, username change, bio. An account change, flagged in the PR.
3. **#38 Explore filters.**
4. **#39 examples and Copy.**

**In parallel:**
- **#40:** Play from the editor.
- **#41:** undo and redo.

### Step 5: review and consistency

- **#42:** go through every hidden menu.
- **#44:** the full visual pass, including the four pages still on the old layout.
- **#50:** the docs, and the privacy and terms pages.

### Step 6: robustness and release

- **#45:** the edge-case matrix, and the room-size number.
- **Final full review**, then the V1-level re-plan.
- **Checkpoint:** François approves the merge.
- **Deploy, in this order:**
  1. a Neon snapshot of production
  2. pause Netlify
  3. merge
  4. pull on the VM
  5. smoke-test the API
  6. publish the frontend
  7. seed the examples
  8. a run on a phone and a laptop

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
