<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# Edge-case pass, October 2026

Run on the evening of 2026-10-04 on PR #23's branch, against the local e2e stack. Production
was not touched. The CRUD audit ([`crud-audit-2026-10.md`](crud-audit-2026-10.md)) asked
who may do what to each entity. This pass asked what goes wrong when time passes, the
network drops, or somebody does an ordinary thing in an unusual order: leaving the editor
open over lunch, a phone locking mid-game, a back swipe, a capital letter in an address.

Findings are numbered **E1 to E27**, after the H/M/L list in
[`e2e-findings.md`](e2e-findings.md) and C1 to C18. **Every bug below is fixed: E1 to E15
the same evening, E16 to E27 the morning after, when François asked for everything left
open to be fixed too.** Each has a test that was run against the unfixed code first and
failed on the assertion it names, except E19 and E20 (see below). E2 and E6 were checked a second time by stashing just the fixed file
and running their tests again.

| Test file | What it covers |
|---|---|
| `frontend/e2e/edge-cases.e2e.ts` | E1 to E8, E10, E11, E14, E15, E18, E21 to E24, and two guards for things that held up |
| `frogquiz/tests/test_ratelimit.py` | E9 and E16 (rate limiting is off in the e2e stack, so they cannot live there) |
| `frogquiz/tests/test_storage_cleanup.py` | E12 (a race with the worker, staged by hand) |
| `frontend/src/hooks.server.test.ts` | the page-load half of E1 |
| `frontend/src/lib/practice/score.test.ts` | E13 |
| `frogquiz/tests/test_edge_cases.py` | E17 |

Severity follows `e2e-findings.md`. **High** means a real game gives wrong scores or loses
answers, or a core flow breaks for everyone. **Medium** breaks a flow that has a workaround.
**Low** is an edge nobody hits by accident, or cosmetic.

## Findings

| # | Sev | Finding | Fix |
|---|---|---|---|
| E1 | High | Everyone is signed out 30 minutes after logging in, and an editor open past that fails every save with a 403 | `oauth/authenticate_user.py`: the access cookie lives a year again; the token inside still expires in 30 minutes |
| E4 | High | A player who answered and then dropped can end the question on a player who is still choosing | `socket_server`: "everyone answered" compares names, not counts |
| E6 | High | A back swipe mid-game leaves a ghost player that holds every later question to its full timer, and the real player cannot get back in | `routes/play/+page.svelte`: leaving the page in the app disconnects; coming back reconnects and rejoins |
| E2 | Medium | An editor left open an hour without a save fails every save with "401: Edit ID not found!" until a reload, which throws away what was typed | `lib/editor.svelte`: on that 401, start a new edit session and send again |
| E3 | Medium | An address registered with capitals cannot log in as typed | `routers/login.py`: the lookup folds case, as password reset already did |
| E5 | Medium | A player who reconnects mid-question gets a countdown from the full time, and taps their phone still allows are refused | `socket_server`: the resent question carries the time left |
| E8 | Medium | An editor tab left open behind a newer save writes its older copy over it as soon as somebody types in it | `routers/editor.py`, `lib/editor.svelte`: saves carry the version they were based on; a stale one gets a 409 and says so |
| E9 | Medium | Editor saves were limited per address, and an office shares one: a handful of people editing at once ran into 429s | `routers/editor.py`: 60 a minute per edit session, 600 per address |
| E7 | Low | A phone woken after answering swaps "Answer locked in" for the tiles again | `socket_server`: no resend to a player who already answered |
| E10 | Low | A PIN pasted as "123 456" is cut to five digits | `lib/play/join.svelte`, `routes/+page.svelte`: no `maxlength`; digits are stripped, then cut to six |
| E11 | Low | A host whose connection drops mid-question misses the answers and the question's end, so the projector waits out the timer | `socket_server`, `routes/admin/+page.svelte`: re-registering hands back the answer count and whether the question is still open |
| E14 | Medium | Going back from the editor inside the app dropped whatever was typed in the last couple of seconds | `lib/editor.svelte`: the pending save is sent when the editor unmounts |
| E15 | Low | A save that failed offline was not retried when the network came back, so the header stayed red until the next keystroke | `lib/editor.svelte`: save again on the browser's `online` event |
| E13 | Low | Practice on a draft marked every pick "Not quite" on a question with no right answer yet, and counted it | `lib/practice/score.ts`: such a question is not scored, like a poll |
| E16 | Medium | Registration, login, password-reset and editor-start limits were per address too: the eleventh person registering in one room was locked out for an hour | Per-address limits sized for an office (registration 50 an hour); the per-account and per-recipient limits are unchanged |
| E18 | Medium | A phone's podium added up scores itself, so a phone that reloaded mid-game showed a total from after the reload, and one asleep through the end never got the podium | The server keeps the final results and sends them on rejoin; the phone rebuilds totals from them, as the host already did (H3) |
| E22 | Medium | A host who closed the tab for good left every phone waiting with no word | After 15 s without the host, phones say so; a host who comes back clears it |
| E23 | Medium | Host events and the last answer each rewrote the whole stored game, so two arriving together undid each other | `update_game`: every change to the game goes through a WATCH transaction |
| E17 | Low | The API took any username: empty, 1,000 characters, "Ana " beside "Ana" or "ana" | 3 to 20 characters, trimmed, unique whatever the case, as the register form already said |
| E19 | Low | A disconnect processed after the same player's rejoin told the host they had left | The host is only told if the disconnect removed the player itself |
| E20 | Low | A player's rejoin key expired two hours after joining, whatever happened since | Refreshed with each answer |
| E21 | Low | Latency was read from the sub-second part of the round trip, so 1.4 s counted as 400 ms | The whole round trip, capped at the 1.5 s answer grace; time taken never below zero |
| E24 | Low | Two players in one browser (a tab each) shared one record, so a reload, or a new tab, took over the other player | Per tab first; the shared cookie only when no other tab is in a game |
| E25 | Low | `/play` never removed its socket listeners, so coming back stacked a second set | Removed when the page goes |
| E26 | Low | At 390 px the editor's settings button wrapped onto a line of its own | It shares the first line with the question number on a phone |
| E27 | Low | `eslint` could not start on a fresh install: its config needs `globals` and `@eslint/js`, which `package.json` did not declare | Both declared; the lockfile only gains their two importer entries |
| E12 | Low | Storage accounting raced: a claim during hashing lost the image's owner, and two uploads hashed at once lost one of the two counts | `helpers.adjust_storage_used` (one `UPDATE`), and single-statement owner and hash writes in `claim_quiz` and `calculate_hash` |

### E1. Signed out after 30 minutes (High)

The access token is a JWT that expires after `ACCESS_TOKEN_EXPIRE_MINUTES` (30). It is
meant to be renewed silently: `rememberme_middleware` (API calls) and `hooks.server.ts`
(page loads) both see an *expired* token in the `access_token` cookie, check the
year-long `rememberme_token`, and issue a new one. Both only act on a token that is sent.

On 12 Sep, commit 658249ad cut the cookie's own lifetime from a year to 30 minutes while
fixing the token's lifetime. From then on the browser deleted the cookie at the moment the
token expired, so there was nothing to renew. Probed on the local stack: drop the access
cookie, keep `rememberme_token`, and `/users/me` answers 401 and every page renders signed
out. Nothing in e2e noticed, because every test logs in fresh.

The consequence beyond "log in again": the editor's autosave runs in the browser, so an
editor open more than 30 minutes after logging in started answering
`403: This edit session belongs to another user` on every save.

Accounts logged in before this ships still hold a 30-minute cookie and will be signed out
once more. Every login after it gets the long one.

Restoring the cookie brought back a path the short cookie had hidden. When renewal fails,
`hooks.server.ts` falls through and trusts the expired token's email, which is right for a
backend that is down and wrong for one that answered 401: a session signed out from another
device rendered as signed in, with every API call failing. A 401 now means signed out
(`hooks.server.test.ts`).

### E4. A dropped phone ends the question for somebody else (High)

`submit_answer` and the disconnect path closed the question when
`len(answers) >= scard(players)`. A player who answers and then drops (a phone locked on
the table) is taken out of the players set, but their answer stays in the list. Three
players: A answers, A's phone locks, B answers, and the question ends with C still
choosing. C scores nothing for a question they were never allowed to finish. Found by the
host-blip probe, where the second player's tiles vanished mid-question.

### E6. A back swipe leaves a ghost (High)

The socket is a module (`$lib/socket.ts`), so it outlives the page. Most players reach
`/play` through the home page's PIN box, which navigates inside the app, so a back swipe
mid-game also stays inside the app. `/play` unmounted, the socket stayed connected, and
the server kept counting the player. Nobody can answer for a ghost, so every later question
ran its full timer. That is the failure `disconnect.e2e.ts` calls the worst thing that can
happen to a live game in a room. Coming forward again showed an empty join form, because
the rejoin only runs on the socket's `connect` event, and joining with the same nickname
was refused because the ghost still held it.

Leaving `/play` now disconnects, which the server treats like a closed tab. Coming back
connects again, and the existing handler rejoins from the `joined_game` cookie.

### E2. An editor open over lunch stops saving (Medium)

An edit session lives in Redis for an hour from its last save. Come back after that and
type, and every autosave answered `401: Edit ID not found!`. The editor kept the text, but
the only way out was a reload, and the leave prompt was right that it would lose what had
been typed since. The editor now starts a fresh session for the same quiz and sends again.
The version check from E8 still applies to the resend, so this cannot be used to write a
stale copy.

### E3. Login is case-sensitive (Medium)

`create_user` stores the address folded to lower case. `login/start` compared it exactly.
Register as `Ana@Frog.co` and log in typing it the same way: "wrong credentials". Password
reset already used `find_user_by_email`, which folds. A person who hit this would reset
their password, still type the capital, and still be refused.

### E5. The countdown restarts after a reconnect (Medium)

`rejoin_game` resends the question that is showing (L1 in `e2e-findings.md`). The phone
counts down from the question's `time`, so a player who reloaded 10 seconds into a 20-second
question saw 20 while the projector showed 9. The server keeps the real clock and refuses
an answer after the timer plus 1.5 seconds, so the last half of the phone's countdown was
dead. The resend now carries the seconds left.

### E8. A stale tab overwrites a newer save (Medium)

Every save sends the whole quiz. Open the editor on a laptop, edit the same quiz on a
phone, then type one character on the laptop: the laptop's older copy replaced the phone's
work, silently. The editor now sends `base`, the `updated_at` it last saw, with each save.
If the stored quiz has moved on, the save is refused with a 409 and the header says
"this quiz was changed in another tab or device. Reload to get that version". Saves without
`base` are not checked, so nothing else that calls the endpoint changes behaviour.

### E9. One office, one rate limit (Medium)

Rate limits key on the client address. Behind an office NAT everybody has the same one.
`editor_save` allowed 60 a minute per address, and autosave fires a few seconds after each
pause in typing, so a workshop of half a dozen people building quizzes would start seeing
"429" in the editor header. It is now 60 a minute per edit session, plus 600 a minute per
address against scripts.

The same reasoning applied to registration and login, which E16 fixed the next morning.

### E7, E10, E11 (Low)

- **E7.** After E5's resend, a player who had already answered got the tiles back. Tapping
  one was refused (`already_replied`) and the screen went back to "locked in", but the
  player could believe they had changed their answer. No resend now.
- **E10.** `maxlength={6}` applied before the digits-only filter, so "123 456" became
  "123 45". The same was true of the home page's box.
- **E11.** While the host's socket was reconnecting, `player_answer` and
  `everyone_answered` went to a room it was not in. It came back with the wrong answer
  count and waited out the timer on a question that was over. `registered_as_admin` now
  carries `answer_count` and `question_open`, and the host applies them only if it is
  mid-game (not after a reload, which starts from the lobby view).

### E14. Going back from the editor dropped the last edit (Medium)

The editor saves 2.5 seconds after typing stops, and its leave prompt covers closing the tab.
It had nothing for leaving inside the app. Open the editor from the view page's Edit link,
type, swipe back, and the editor unmounted, cleared the pending save and the text was gone,
with no prompt. It now sends the pending save as it unmounts. The page is not unloading, so
the request completes. A new quiz's first save no longer rewrites the address bar if it
lands after the editor has gone.

### E12. Storage accounting raced with itself (Low)

Found because the full e2e run failed `crud-lifecycle` › claiming a quiz brings its images
into the account, once, under load. `calculate_hash` read the upload's row, hashed the file,
and saved the whole row back. A claim that gave the image an owner in between was undone by
that save: the image went back to nobody, the claim had not counted it (it was not hashed
yet), and the job did not either (its copy said nobody). So the bytes were never counted and
the file outlived the account.

The same read-change-write pattern was in all four places that move `storage_used`: the
hash job, the claim, and the two release paths. Uppy sends several files at once and arq
runs their jobs side by side, so one of two increments could be lost. Writing the whole user
row back could also undo another change made to the account in the same moment.

All four now go through `adjust_storage_used`, one `UPDATE ... SET storage_used =
GREATEST(0, storage_used + :delta)`. The claim sets the owner with one `UPDATE ... WHERE
"user" IS NULL RETURNING hash, size`, and the job writes only the columns it computes and
reads the owner back with `RETURNING "user"`. Postgres runs the two one after the other, so
whichever lands second sees the other's write, and exactly one of them counts the image.

### E16 to E27

- **E16 (Medium).** Changed on François's say-so on 5 Oct; Gonçalo has not seen it yet.
  Per address: registration 10 to 50 an hour, `login/start` 20 to 100 and `login/step` 10 to
  50 per five minutes, password reset and resend-verification 5 to 20 an hour, editor start
  and finish 30 to 120 a minute. Untouched, because they are what actually stops abuse: 10
  password tries per account per five minutes, 3 reset or verification mails per address an
  hour, 5 registrations per address an hour, and the anonymous upload limit (C5).
- **E18 (Medium).** `get_final_results` keeps the results for two hours and `rejoin_game`
  sends them to a player who comes back after the end. The phone used to build the podium
  from scores it had added up question by question, which start from nothing after a
  reload; it now rebuilds them from the final results, with `totalsFromResults`, the helper
  the host's podium has used since H3.
- **E22 (Medium).** When the host's socket goes, the server waits 15 s (a reload or a wifi
  blip takes a few) and, if no new host socket has registered for the game and it is not
  over, sends `host_left` to the room. The phone shows a line saying so, with Leave in the
  usual place. A host who registers again sends `host_back`, which clears it.
- **E23 (Medium).** Listed under "Found, not fixed" in `e2e-findings.md` since 29 Sep.
  `start_game`, `set_question_number`, `get_question_results` and both "everyone answered"
  paths read `game:{pin}`, changed one field and wrote the whole game back. They now go
  through `update_game`, a WATCH/MULTI transaction like `record_answer_once`. Closing a
  question also checks, inside the transaction, that it is still the question showing, so a
  late "everyone answered" cannot close the next one. The host UI already waited between
  events, so this was reachable mostly under load; the test sends `start_game` and the first
  question back to back five times, and failed on the old code.
- **E21 (Low).** The ping fix needed a cap, or a player could hold the echo back to buy
  time: it is capped at the 1.5 s the server already allows past the timer.
- **E24 (Low).** A tab in a game writes a heartbeat to local storage every 3 s, and clears it
  when the tab closes. A new tab uses the shared cookie to rejoin only when it hears no
  heartbeat, so it no longer takes over a player another tab is using, and a tab closed by
  accident and reopened still gets back in.
- **E19, E20, E25.** No test for E19 (it needs two events inside one Redis round trip) or E20
  (it needs two hours); both are a line each and are in the code with their reasons.

## What held up

- **A player whose connection drops and comes back without a reload** is rejoined from the
  cookie and can answer (guard: `edge-cases` › a player whose connection drops mid-question
  can still answer). Probed in the lobby too: back on the host's list.
- **Password reset** already finds an address regardless of case. Its link works once
  (`GETDEL`), and using it signs every device out.
- **Two games cannot share a PIN**: `quiz/start` draws again while the PIN is taken. A game's
  key lives two hours from its last change, not from its start.
- **An address with a trailing space** is refused at registration with a clear message,
  and browsers trim `type="email"` fields anyway.
- **`MAX_WORKERS: "1"`** in `docker-compose.yml` keeps the socket server in one process, so
  rooms and per-game state are not split across workers.
