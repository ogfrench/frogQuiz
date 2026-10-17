<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# Edge cases for V1

The V1 robustness matrix (#73, from #45), written 16 Oct 2026. It says, case by case, what
was tested, how, and what happened, and what was deferred, by whom and why. It builds on
the 4 Oct pass in [`edge-cases-2026-10.md`](edge-cases-2026-10.md) (E1 to E27, all fixed
and each with its test) and on [`e2e-findings.md`](e2e-findings.md).

**What "tested" means here.** A row marked **passes** names the spec or test that covers
it, and that test passed in CI on 16 Oct: e2e run 38956318179 (301 passed, 1 skipped, the
code that is now master plus #83) and PyTest on `125c5ad`. No `test.fail` marker is left
in the e2e suite, so no known bug is parked there. All of it runs in Chromium. Nothing
here establishes iOS Safari, a screen reader or a real phone network; those are the rows
marked **not yet**. Production load was measured separately, on 17 Oct.

## Joining and playing

| Case | How it is tested | Outcome |
|---|---|---|
| Wrong PIN, on `/` and on `/play` | `pin-entry`: stays on the PIN, keeps the digits, says so | passes |
| A PIN pasted with spaces, too many digits, or as a full join link | `pin-entry`, E10 | passes |
| Two players race for one nickname | `live-socket`: exactly one gets it | passes |
| Taken nickname, with case or whitespace changes; blank; over 50 characters | `live-socket`, `join` | passes |
| A nickname built to break the host's list | `hostile-text` | passes |
| Join mid-question | `late-join`, `live-socket`: gets the question with the time left, can score | passes |
| Locked lobby, unlock, lock mid-game | `late-join`, `live-socket` | passes |
| Join after the game finished | `live-socket`: refused | passes |
| Player reloads in the lobby, mid-question, twice | `game-reload` | passes |
| Player closes the tab or loses the connection | `disconnect`, E4: stops blocking the question | passes |
| Back swipe mid-game | E6 | passes |
| Two players in one browser, a tab each | E24 | passes |
| Host reloads mid-game and on the podium | `game-reload` | passes |
| Host's connection drops mid-question | E11 | passes |
| Host leaves for good | E22: phones say so after 15 s | passes |
| Host cancels in the lobby, ends mid-game; a player leaves the lobby | `game-exits` | passes |
| A second host tab on the same game | `concurrency-35` row 12 | passes |
| Answer at the buzzer, after the timer, twice, to a question not showing | `live-socket` | passes |
| Host events and the last answer arriving together | E23 (WATCH transaction) | passes |
| 120 players in the lobby, at four screen sizes | `lobby-many` | passes |
| Names change width under the lobby board (late font) | `lobby-many`, added 16 Oct with the fix | passes locally 3 of 3; CI on #88 |
| A whole game on phones only, host remote | `journey-remote-call`, `journey-player-phone` | passes |
| How many players one game holds on the production VM | `deploy/load-test.py` on production, 17 Oct, every player answering at once (`DEPLOY.md`, "Staying inside Always Free") | passes for 200: all joined and answered, slowest answer 729 ms. 300 also all answered, but the slowest took 1.5 s, which costs the last players up to about 1.3 s of their score |
| iOS Safari and Android Chrome on real phones | | **not yet**: François, step 6 |

## Editing

| Case | How it is tested | Outcome |
|---|---|---|
| Two tabs save over each other | `editor-conflict` (Keep mine, load theirs, text kept), E8 | passes |
| Quiz deleted, or session signed out, in another tab while editing | `editor-conflict` | passes |
| A save that fails offline; the network comes back | `edge-cases` (E15) | passes |
| Leaving the editor within a second of typing | E14 | passes |
| An editor open for hours | E1, E2 | passes |
| A quiz claimed while its editor is open | `claim` | passes |
| A new quiz saved first in two tabs | `concurrency-35` row 5 | passes |
| Over-long title, description, question, answer | `hostile-text`, `api-edge` | passes |
| No answers, six answers, eleven answers, no correct answer | `api-edge`, `drafts` | passes |
| A draft cannot be started, from the UI or the API | `drafts`, `api-edge` | passes |
| Many people editing from one office address | E9, `test_ratelimit.py` | passes |

## Uploads and images

| Case | How it is tested | Outcome |
|---|---|---|
| Oversized file, wrong type, over the pixel cap | `uploads` (browser and server both refuse) | passes |
| Two uploads hashed at once; a claim during hashing | E12, `test_storage_cleanup.py` | passes |
| An image deleted, then listed | `crud-authz` | passes |
| The worker's memory for one large image | read, not run: it converts to RGBA before shrinking, about 256 MB for an 8000×8000 upload (`docs/uploads.md`) | **deferred** (Claude, after V1): bounded by the 8000 px cap, and one image at a time; shrinking before converting would remove it |

## Sign-in, accounts and guest quizzes

| Case | How it is tested | Outcome |
|---|---|---|
| Code from a phone used on a laptop, pasted with a space | `sign-in` | passes |
| Five wrong codes; an expired or unknown link | `sign-in` | passes |
| Only frog.co and capgemini.com addresses | `sign-in` | passes |
| Username taken in another case | `sign-in`, E17 | passes |
| Claim after a partial failure, a dropped connection, an expired session | `claim` | passes |
| Claim from a second tab, after another account took it, after 30 days | `claim` | passes |
| Guest create, import, host, then keep after sign-in | `excel-import`, `my-quizzes` | passes |
| Another account on every owner-only route; signed-out calls | `crud-authz` | passes |
| An anonymous quiz can never be public; ownership hash never leaks | `api-edge` | passes |
| Hidden routes stay hidden and nothing links to them | `hidden` | passes |
| No mail server configured | read, not run: `/login/email` answers 503 (`routers/login.py`); no test covers it | **not yet** |
| The email provider failing mid-send | | **not yet**: untested |
| Mail landing in the Capgemini spam quarantine | the sign-in dialog links the quarantine | **not yet**: real delivery to a capgemini.com inbox has not been checked (François) |

## Infrastructure

| Case | How it is tested | Outcome |
|---|---|---|
| API down while the editor is open | `service-outage`: the banner recovers, the editor keeps its text | passes |
| Examples fail to load on Discover | `service-outage` | passes |
| Redis or Postgres down | `test_health.py`: health answers 503 | passes |
| Netlify's server runtime rejects a module CI accepts | `netlify_ssr.yml` (added after the #69 outage) | passes |
| A backup restores | `deploy/test_backup_restore.sh` in CI; one real restore on 16 Oct | passes |
| The site or the API stops answering | `uptime.yml`, every 30 minutes | runs; it alerts by a failed run, not a page |
| The Oracle VM is reclaimed | Over the A1 limit: fixed, resized to 2 / 12 on 17 Oct. Idle reclamation: Oracle's rule fits our idle load (`DEPLOY.md`, "Staying inside Always Free") | **open, low**: the uptime check would catch it within 30 minutes, and the fix is Start in the console. Pay As You Go would remove it (François) |
| Meilisearch down | | **not yet**: search fails, and quiz saves write to the index (CLAUDE.md); untested |

## Deferred, with an owner

| What | Owner | Why it can wait |
|---|---|---|
| The worker's full-size decode | Claude, after V1 | bounded by the pixel cap |
| Meilisearch down | Claude, before v1.0 | decide whether a save should succeed without the index |
| Screen reader pass | after V1 (#74) | axe runs in Chromium on each visual capture (`VISUAL=1`); a manual pass needs a person |
