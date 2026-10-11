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
| Host a game (`/quiz/start`) | 401 | With the quiz's secret | Own quizzes |
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
ceilings, a signed-in user with the setting off) and `frontend/src/lib/create_gate.test.ts`
(the `/create` redirect).

## Claim cases (#43)

A claim is a button, on My Quizzes or the quiz's page, for a signed-in user whose browser
holds the quiz's secret. It is one conditional write: it takes the quiz only while it is
unclaimed, unexpired and holds that secret. Every failure is the same 404, so a claim
cannot be used to learn which quizzes exist.

With the setting off in production, and the app not in use yet, no anonymous quiz exists
to claim. So the cases below with no new test have a written outcome instead (11 Oct).

| # | Case | Outcome | Evidence |
| - | --- | --- | --- |
| 1 | Claim in the browser that made it | Moves to the account, with its images and their bytes | `account.e2e.ts` "an anonymous quiz can be claimed after signing up"; `crud-lifecycle.e2e.ts` "claiming a quiz brings its images into the account" |
| 2 | Another browser | No claim button: the secret is only in the browser that made the quiz | `my-quizzes/+page.svelte` returns before the request with no secret |
| 3 | Site data cleared | Same as 2. A request with a wrong secret is a 404 and changes nothing | `test_anonymous_quiz.py::test_claim_wrong_secret` |
| 4 | Claimed by A, then tried by B | 404, A keeps it | `test_anonymous_quiz.py::test_claimed_quiz_no_longer_usable_with_old_secret` |
| 5 | Two tabs, the second claims after the first | 404; the tab shows "couldn't claim" | `account.e2e.ts`, "claiming twice" is 404 |
| 6 | After 30 days | 404, and the sweep deletes it | `test_claim_races.py`: a claim on a quiz that expired while it ran takes nothing; the sweep still deletes what nobody claimed |
| 7 | A mail scanner opens the sign-in link | No effect on any quiz: claiming is a button pressed after sign-in, never a link. The sign-in link is not single-use, so a scanner does not use it up (finding 4 of the security audit, post-V1) | Written outcome |
| 8 | Signing in between making and claiming | The secret survives sign-in in the same browser, so the button appears once signed in. Nothing is claimed by itself | Written outcome |
| 9 | First sign-in, before a username is picked | No account exists until the username is picked (D21), so there is nothing to claim into yet; the button appears after | Written outcome |
| 10 | The claim puts the account over its quota | Goes through (decided, #43); uploads are refused until the account is back under | `claim_quiz` does not check the quota; written outcome |
| 11 | An anonymous editor is open on the quiz when it is claimed | That editor's next save gets 404 and keeps the typed text, with Save as a new quiz. The claimed quiz is untouched | `_persist` looks the quiz up as unclaimed; `test_counter_writes.py` covers the opposite order (a save does not revert a claim) |
| 12 | A game of the quiz is running during the claim | The game goes on: it runs from Redis, not the quiz row. Its results are not saved, because its host had no account (#52) | Written outcome |
| 13 | Two claims at once | One wins; the other is a 404 and takes nothing; the images are counted once | `test_claim_races.py::test_a_claim_that_lost_the_race_takes_nothing` |
| 14 | The secret after a claim | Removed from the browser, and cleared on the server | `my-quizzes/+page.svelte` and `view/[quiz_id]/+page.svelte` call `clearAnonSecret`; the claim sets `anon_secret = NULL` |
| 15 | Visibility after a claim | Stays unlisted until the owner changes it | Anonymous quizzes are always saved unlisted (`_persist`) |
| 16 | Where the secret travels | Only in the `X-Anon-Secret` header, never in a URL; stored hashed | `anon_quiz.ts`, `claim_quiz` |
| — | The sweep runs while a claim lands | The claim wins; the sweep deletes only what is still unclaimed and expired, in one statement | `test_claim_races.py::test_the_sweep_spares_a_quiz_claimed_while_it_ran` |
