<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# Security audit: does the account gate hold? (11 Oct)

François asked whether things are truly unreachable without an account, and whether what
belongs to one account is visible only to it. This is the answer, from probing a local
stack as an anonymous visitor and as two signed-in accounts (A against B's things), plus a
read of every route and Socket.IO event. Run on `v1` at `ab677df`.

**Verdict:** the gate holds for every per-account REST route and for the game host's
role. One cross-account hole was found, in the live-game API, and is fixed. Free-text
answers went to the players' phones, and that is fixed too. The rest are low, and each
has a place in the plan below.

"Confirmed" means reproduced against the running stack; "read" means from the code only.

## Findings

| # | Severity | What | Status |
| --- | --- | --- | --- |
| 1 | High | `/live/scores`, `/live/get_question/now` and `/live/voting` checked that an API key existed, never that it was the game host's. Any account can mint a key, so anyone signed in could read a running game of somebody else's by its PIN: the scores, the vote, and the question on screen with its right answer. Confirmed. Nothing rate-limits `/live/*`, so all PINs could be swept (read). | **Fixed** in step 3a. One check, `_hosts_game` in `routers/live.py`, for all of them. `tests/test_live_owner.py` failed first. |
| 2 | Medium | The accepted answers to a free-text question went to every phone with the question (`question_for_players`). Confirmed. | **Fixed** in step 3a. The phone never used them. `tests/test_player_payload.py` failed first. |
| 3 | Low | `/live/user_count` needed no valid key at all: any PIN gave its player count. Confirmed. | **Fixed** with 1. |
| 4 | Low | The emailed sign-in link works more than once for its 15 minutes, and still works after "sign out everywhere". Confirmed. | **Post-V1** (moved 11 Oct). Making the link single-use is the fix, but a mail scanner that opens the link first (Outlook Safe Links) would then use it up, and the link is the only way in. The page only signs in on a POST its script sends, so a scanner that doesn't run scripts is safe; that has to be checked before the change. |
| 5 | Low | API keys survive "sign out everywhere", and `GET /users/api_keys` always answers `[]`, so an owner cannot find a key to revoke it. Deleting the key or the account does kill it. Confirmed. | **Fixed** 15 Oct on `feature/mcp-server`, which gives people keys to hold (AI agents, `docs/mcp.md`). Sign-out-everywhere revokes keys and clears their cache. The list shows them, without the key. Keys are stored as sha256 only, with the plain-text column migrated away. `frogquiz/tests/test_api_keys.py`. |
| 6 | Low | `hooks.server.ts` reads the session token without checking its signature, to decide which pages need a sign-in. A forged token gets the page shell; every data call still gets 401, and nothing leaks. Confirmed. | **Accepted for now**, recorded. The API is the gate. Step 5 can move the page gate to the API's own check. |
| 7 | Low | Server-side loaders set a module-level "signed in" store, which the server shares between visitors, so two page loads at once can show each other's navbar state. One true or false, no account data. Read. | **Step 5** (consistency): set it only in the browser. |
| 8 | Low | Password registration has no allowed-domain check. It is switched off today (404). If `ENABLE_PASSWORD_LOGIN` came back, any address could register. Read. | **Step 3b**: the same domain rule as emailed sign-in, as a guard for that day. |
| known | | `GET /quiz/get/public/{id}` has no visibility check, so a private quiz reads by its id, and the server-rendered `/view/{id}` puts its answers into the HTML. | **Step 4**, #34 (Public, Unlisted, Private). |

## Checked and correct

| Area | Result |
| --- | --- |
| The host's credential | `register_as_admin` with a zero UUID, with the PIN, or empty is refused. `register_as_remote` with a wrong id is refused. Only the game's own `game_id` works. |
| A player sending host events | `set_locked`, `start_game`, `set_question_number`, `get_question_results`, `show_solutions`, `get_final_results`, `get_export_token`, `save_quiz`, `set_control_visibility`, `kick_player` and `end_game` change nothing and send nothing back. |
| What players receive | The join payload has no `game_id`, questions, `user_id` or `quiz_id`. Multiple-choice questions come without `right`. Answers are not broadcast before the reveal. |
| Across games | A's `game_id` on B's PIN is refused. A guessed `rejoin_game` is ignored. A player in one game gets none of another's events. |
| `/live` routes that checked already | `/`, `/players` and `/set_question` with another account's key give 404. The results export needs a token sent only to the host's socket, and tied to the PIN. |
| REST, signed out | 401 on every per-account route. Search, Explore and community need sign-in. |
| REST, B against A | 404 or 403 on quiz get, start, delete and claim; both exports; editor start, save and finish (with `base`); storage meta and delete; results. B can't end A's session, delete A's key, or delete A's account with A's email. Moderation and admin give 401. A's private quiz is not in search. |
| Sessions | After sign-out, a copied access token and a copied remember-me token get 401. Sign out everywhere ends other devices. A deleted account's cookies get 401. A forged or badly signed token gets 401. An API key is not accepted as a cookie or header. |
| Identities sent by the client | No route acts on a user id or username the client sends, outside admin. |
| Frontend server code | No loader fetches one account's data on the server. Only `hooks.server.ts` forwards the visitor's own cookie, to `/users/check`. `/view` sends no cookie. |
| Hidden routes | `/quiztivity`, `/controller` and `/account/controllers` have no API mounted. The rest are hidden in the interface over APIs scoped to the caller's own account. None exposes another account. |
