<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# Without an account, and with one

What somebody can do with no account, and what needs one (#55), with each claim case from
#43 and its outcome. Decided by François on 10 and 11 Oct (`MVP.md` D23 and D36).

**The rule:** making, editing, uploading and hosting need a team account. Players join a
game by PIN with none. It is the setting `anonymous_quizzes_enabled`, **off by default**:
the old behaviour is hidden behind it, not deleted. CI and the e2e stack turn it on,
because most specs host without an account.

## The matrix

"Off" is production. "On" is the setting turned on, with its two ceilings.

| What | No account, setting off | No account, setting on | Signed in |
| --- | --- | --- | --- |
| Join a game by PIN and play | Yes | Yes | Yes |
| Open `/create` | Sent to sign-in, back to `/create` after | Yes | Yes |
| Start a new quiz in the editor (`/editor/start`) | 401 "Sign in to make, edit or host a quiz" | Yes | Yes |
| Save or finish a quiz | 401, also for an editor opened while the setting was on | Yes; a new quiz is refused with 429 past either ceiling | Yes |
| Edit an existing quiz | 401 | With the quiz's secret, until it expires; the ceilings never apply | Own quizzes |
| Upload an image | 401 | Yes, within the anonymous size limits (`docs/uploads.md`) | Yes, within the account quota |
| Host a game (`/quiz/start`) | 401 | With the quiz's secret | Own quizzes and any public one |
| Read a quiz back with its secret | Yes, until it expires | Yes, until it expires | — |
| Claim a quiz into an account | — (needs an account) | — (needs an account) | Yes, with the secret, until it expires |
| Delete a quiz | With its secret | With its secret | Own quizzes |
| Save a game's results | No: refused for a host with no account (#52) | No (#52) | Own games |
| Public, or listed in Explore | Never | Never: always saved unlisted | Owner's choice |
| Explore, search, profiles | Sign-in needed (D21) | Sign-in needed | Yes |
| Lifetime | 30 days from when it was made, then swept | 30 days | Kept |

**The two ceilings**, both settings in `config.py` and `docker-compose.yml`:

- **20 new quizzes per address a day** (`anon_quiz_daily_limit`): 429 "You have reached
  today's limit for quizzes without an account. Sign in to keep going."
- **1,000 quizzes without an account alive at once** (`anon_quiz_total_limit`): 429 "Too
  many quizzes without an account right now. Sign in to keep going." The count is
  approximate under concurrent saves, which is fine for a ceiling against abuse.

They stop creating, never editing: a quiz that exists can always be saved again.

**Tests:** `frogquiz/tests/test_anonymous_flag.py` (every 401, the config endpoint, both
ceilings, a signed-in user with the setting off), `frontend/src/lib/create_gate.test.ts`
(where the gate sends a visitor), and `frontend/e2e/anon-off.e2e.ts` (the `/create` redirect
through the real loader, and the signed-out copy, on a stack with the setting off; the e2e
workflow runs it in a second pass).

## Claim cases (#43)

A claim is a button, on My Quizzes or the quiz's page, for a signed-in user whose browser
holds the quiz's secret. It is one conditional write: it takes the quiz only while it is
unclaimed, unexpired and holds that secret. Every failure is the same 404, so a claim
cannot be used to learn which quizzes exist.

With the setting off in production, and the app not in use yet, no anonymous quiz exists
to claim. The cases were run with the setting on. Every case has a test except 7 and 10,
which have a written outcome. `claim.e2e.ts` runs on a phone (390 wide, touch), in the
browser that made the quiz and in a second one (12 Oct).

A failed claim says what happened and what to do (`claimFailure` in
`frontend/src/lib/anon_quiz.ts`, unit-tested in `anon_quiz.test.ts`). The server's 404 is the
same for every reason, so the page tells an expired quiz from one claimed or deleted
elsewhere by the expiry date it already holds.

| # | Case | Outcome | Evidence |
| - | --- | --- | --- |
| 1 | Claim in the browser that made it | Moves to the account, with its images and their bytes | `claim.e2e.ts` "on a phone, the browser that made a quiz claims it from My Quizzes"; `account.e2e.ts` "an anonymous quiz can be claimed after signing up"; `crud-lifecycle.e2e.ts` "claiming a quiz brings its images into the account" |
| 2 | Another browser | No Claim button: the secret is only in the browser that made the quiz. Signed in, the quiz's page says only that browser can claim it, and when the quiz is deleted | `claim.e2e.ts` "another browser has no Claim, and is told which browser can" |
| 3 | Site data cleared | Same as 2, and the same note says that if that browser's data was cleared, nobody can claim it. A request with a wrong secret is a 404 and changes nothing | `claim.e2e.ts` (as 2); `test_anonymous_quiz.py::test_claim_wrong_secret` |
| 4 | Claimed by A, then tried by B | 404, A keeps it. B's page says it was claimed in another tab or account, or deleted, and to reload | `test_anonymous_quiz.py::test_claimed_quiz_no_longer_usable_with_old_secret`; `claim.e2e.ts` "a claim after another account took the quiz says so" |
| 5 | Two tabs, the second claims after the first | The second tab says it was claimed in another tab or account, and to reload. Until 12 Oct it did nothing at all: the first tab's claim took the secret out of the localStorage both tabs share, and the button returned without a word | `claim.e2e.ts` "a second tab that claims after the first is told it was claimed elsewhere" |
| 6 | After 30 days | 404, and the page says the quiz passed its 30 days and was deleted. The sweep deletes it | `claim.e2e.ts` "a claim after the 30 days says the quiz expired"; `test_claim_races.py`: a claim on a quiz that expired while it ran takes nothing; the sweep still deletes what nobody claimed |
| 7 | A mail scanner opens the sign-in link | No effect on any quiz: claiming is a button pressed after sign-in, never a link. The sign-in link is not single-use, so a scanner does not use it up (finding 4 of the security audit, post-V1) | Written outcome |
| 8 | Signing in between making and claiming | The secret survives sign-in in the same browser, so the button appears once signed in. Nothing is claimed by itself | `sign-in.e2e.ts` "keep this quiz", which signs up from the quiz's page and then claims it |
| 9 | First sign-in, before a username is picked | No account exists until the username is picked (D21), so there is nothing to claim into yet; the button appears after | `sign-in.e2e.ts` "keep this quiz" (as 8) |
| 10 | The claim puts the account over its quota | Goes through (decided, #43); uploads are refused until the account is back under | `claim_quiz` does not check the quota; written outcome |
| 11 | An anonymous editor is open on the quiz when it is claimed | That editor's next save says the quiz was deleted or moved into an account, keeps the typed text, and offers Save as a new quiz. The claimed quiz is untouched | `claim.e2e.ts` "an editor left open when the quiz is claimed says so and keeps the text"; `test_counter_writes.py` covers the opposite order (a save does not revert a claim) |
| 12 | A game of the quiz is running during the claim | The game goes on to the podium: it runs from Redis, not the quiz row. Its results are not saved, because its host had no account (#52) | `claim.e2e.ts` "a game running when its quiz is claimed goes on to the podium" |
| 13 | Two claims at once | One wins; the other is a 404 and takes nothing; the images are counted once | `test_claim_races.py::test_a_claim_that_lost_the_race_takes_nothing` |
| 14 | The secret after a claim | Removed from the browser, and cleared on the server | `my-quizzes/+page.svelte` and `view/[quiz_id]/+page.svelte` call `clearAnonSecret`; the claim sets `anon_secret = NULL` |
| 15 | Visibility after a claim | Stays unlisted until the owner changes it | Anonymous quizzes are always saved unlisted (`_persist`) |
| 16 | Where the secret travels | Only in the `X-Anon-Secret` header, never in a URL; stored hashed | `anon_quiz.ts`, `claim_quiz` |
| — | The sweep runs while a claim lands | The claim wins; the sweep deletes only what is still unclaimed and expired, in one statement | `test_claim_races.py::test_the_sweep_spares_a_quiz_claimed_while_it_ran` |

## The CRUD grid (#55)

What happens to each thing in each mode, with the test or decision behind it. "Signed out"
means the setting turned on; with it off (production) every signed-out write is a 401 (the
matrix above). No cell is unknown, and none is an open bug.

### Quiz

| Operation | Signed out | Signed in | The claim between them |
| --- | --- | --- | --- |
| Create | Saved unlisted, for 30 days, with the secret kept in this browser (`test_anonymous_quiz.py::test_create_anonymous_quiz`, `test_anonymous_quiz_is_never_public`) | Saved to the account (`account.e2e.ts`) | — |
| Read | Anyone with the id, until it expires. `/quiz/get/public` has no visibility check: decision, #34 in v0.8 | The owner, and any signed-in user for a public quiz. The same `/quiz/get/public` gap (#34) | The same URL keeps working (`account.e2e.ts`) |
| Update | With the secret (`test_edit_anonymous_quiz_requires_correct_secret`; `editor.e2e.ts` "an existing anonymous quiz can be reopened, edited and saved") | The owner (`account.e2e.ts`) | An editor open during the claim is told, and keeps its text (`claim.e2e.ts`) |
| Delete | With the secret (`test_delete_anonymous_quiz_requires_correct_secret`, `my-quizzes.e2e.ts`) | The owner (`crud-lifecycle.e2e.ts`) | After the claim, the secret deletes nothing (`account.e2e.ts`) |
| Expire | Swept after 30 days (`test_the_sweep_still_deletes_what_nobody_claimed`), with a warning first on My Quizzes and the quiz's page (`claim.e2e.ts`, the expiry warning test) | Never | A claim clears the expiry; a claim after it is a 404 that says so (`claim.e2e.ts`, `test_claim_races.py`) |
| Claim | — | — | The 16 cases above |

### Quiz images

| Operation | Signed out | Signed in | The claim between them |
| --- | --- | --- | --- |
| Attach | Within the limits for uploads without an account, rate limited (`test_anonymous_uploads_are_rate_limited`, `docs/uploads.md`), and hashed by the worker (`crud-lifecycle.e2e.ts` "the worker processes an anonymous upload without an error") | Within the account's quota (`crud-lifecycle.e2e.ts` "a new quiz with an image saves cleanly") | The images and their bytes move to the account (`crud-lifecycle.e2e.ts` "claiming a quiz brings its images into the account") |
| Replace or remove | The image job deletes the file (`crud-lifecycle.e2e.ts` "taking an image off a question deletes the file and gives the bytes back", run without an account) | The same job, and the bytes go back to the quota | — |
| Delete with the quiz | Freed (`crud-lifecycle.e2e.ts` "deleting a quiz deletes its images and gives the bytes back") | Freed, the same way | — |
| Expire with the quiz | Freed by the sweep, or held until a running game ends (`test_the_sweep_holds_the_images_of_a_game_still_running`) | — | A claim that beats the sweep keeps them (`test_the_sweep_spares_a_quiz_claimed_while_it_ran`) |
| Quota | No account quota: per-file limits, and an upload never saved into a quiz is swept after a day (`docs/uploads.md`, C5) | The account's quota (`docs/uploads.md`) | Counted to the new owner, even over the quota: decided in #43 (`test_claim_during_hashing_keeps_owner_and_counts`) |

### Game

| Operation | Signed out | Signed in | The claim between them |
| --- | --- | --- | --- |
| Start | With the secret (`test_start_anonymous_quiz_requires_correct_secret`, `anon-game.e2e.ts`) | Own quizzes and any public one (`account-game.e2e.ts`, `concurrency-35.e2e.ts` row 11) | A running game goes on to the podium (`claim.e2e.ts`) |
| Play | Players never need an account (`anon-game.e2e.ts`) | The same (`account-game.e2e.ts`) | — |
| Host reload | Comes back on the question (`game-reload.e2e.ts`) | The same code path: the game lives in Redis | — |
| End | The podium, with Download results (`anon-game.e2e.ts`) | The same (`account-game.e2e.ts`) | — |
| Expire | A game started before the quiz expired runs to its end, with its images (`test_the_sweep_holds_the_images_of_a_game_still_running`) | — | — |

### Game results

| Operation | Signed out | Signed in | The claim between them |
| --- | --- | --- | --- |
| Save | Refused with a reason, and nothing written (#52, `test_an_anonymous_host_is_refused_with_a_reason_and_nothing_is_written`) | Saved (`account.e2e.ts` "saving results still works, but the results page is hidden") | A game hosted before the claim keeps no results (#52) |
| Read | None are saved | The results page is hidden for now: decision, `MVP.md` D4 | — |
| Delete | None are saved | With the account (`crud-account.e2e.ts`) | — |
| Export | Download results on the podium, through a token tied to that game (`game-export.e2e.ts`; `crud-authz.e2e.ts` "an export token only opens the game it was made for") | The same | — |

### Secret

| Operation | Result |
| --- | --- |
| Created | On the first save, returned once in `X-Anon-Secret` and kept in this browser's localStorage (`test_create_anonymous_quiz`) |
| Lost (data cleared, another browser) | The quiz is stranded until it expires; a signed-in visitor is told which browser can claim it (`claim.e2e.ts`) |
| Stale after a claim | Spent on the server and removed from the browser (`test_claimed_quiz_no_longer_usable_with_old_secret`); a second tab is told (`claim.e2e.ts`) |
| Stale after expiry | My Quizzes drops it at the next load (`claim.e2e.ts`, the expiry warning test) |
| Leaked | Only ever in a request header, never in a URL, and stored hashed (claim case 16) |

### Account

| Operation | Result |
| --- | --- |
| Created on first sign-in | A username first, then the account (`test_a_first_sign_in_asks_for_a_username_and_makes_a_passwordless_account`) |
| Deleted, with quizzes | Takes its quizzes, their files and its sessions (`crud-lifecycle.e2e.ts` "deleting an account takes its quizzes, its files and its session with it", `crud-account.e2e.ts`) |
| Deleted, without quizzes | Asks for its address, then goes (`test_deleting_a_passwordless_account_asks_for_its_address`) |
| Deleted after a claim | The claimed quiz and its images go with it, since they are the account's |

## #55's five questions

All five are François's, in `MVP.md`. 1, who may use it without an account: D23 (10 Oct).
2, whether 30 days in one browser is acceptable: D36 (11 Oct), the window stays, with the
warning tested above. 3, a cap: D36. 4, a visibility level: D36, always unlisted. 5, expiry
in the middle of a session: D38 (11 Oct).
