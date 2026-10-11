<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# TODO — live tracker

Where the work actually stands. [`MVP.md`](MVP.md) is the plan and holds the decisions;
this file is the running state, updated as things land.
Audit that produced most of it: [`docs/audit-2026-10-01.md`](docs/audit-2026-10-01.md).

**Branch:** merged to `master` on 6 Oct as PR #26 (was `ccr-370df3e4-c44t1l`, PR #23) · **Suites:** 153 unit · 146 e2e · 168 backend (1 skipped)
· **Last full green run:** 4 Oct on `077f695` — e2e **146/146** in 10.0m on a clean stack,
unit 153 passed, `pnpm build` OK, `eslint .` 0 errors; backend **168 passed** (1 skipped) and
`flake8 .` 0, with the sign-out revocation change

---

## Done — 1 Oct

| # | What | Where |
| - | --- | --- |
| 1 | **Editor rebuilt as one column of question cards** (D7). Open card edits in place, the rest stay as question text plus answer chips; add between cards, duplicate, drag or arrow to reorder, delete behind a confirm; a new quiz shows two fields and "Add your first question"; True / False preset | `lib/editor/question-card.svelte`, `lib/editor.svelte`, `e2e/editor-column.e2e.ts` |
| 2 | **Editor no longer drops an edit** typed in the first half-second after it opens | `lib/editor.svelte`, regression test in `e2e/editor.e2e.ts` |
| 3 | **Hidden routes get the real 404** with the navbar and a Home button, instead of SvelteKit's bare fallback | `lib/hidden_routes.ts`, `hooks.ts`, `e2e/hidden.e2e.ts` |
| 4 | **Players are told whether they were right** — icon, word, points, total and place | `lib/play/results_kahoot.svelte`, `e2e/player-feedback.e2e.ts` |
| 5 | **Host results scale for a projector**; podium side buttons outlined; export anchor out of the a11y tree | `lib/play/admin/`, `routes/admin` |
| 6 | **Play is not offered on somebody else's unlisted quiz**, which the server refuses | `routes/view/[quiz_id]`, `e2e/account.e2e.ts` |
| 7 | **Join screen rebuilt** on the landing page's PIN card | `lib/play/join.svelte` |
| 8 | **Copy, nav and hygiene**: inverted Register link, Explore→Discover, "Forgot password?" off the register form, the empty My Quizzes banner, "This session?", the empty color input, upstream's false landing copy and its dead component | several |
| 9 | **Docs match reality**: D7 closed with its deviation, D16 and D17 added, the six missing lines in, `CLAUDE.md` no longer claims `--primary` is green | `MVP.md`, `CLAUDE.md`, `docs/audit-2026-10-01.md` |
| 10 | **Podium**: builds up third → second → first, 1.4s apart, crown and confetti, nothing under reduced motion. Flat gold winner, 2nd and 3rd on theme surfaces — the medal gradients are gone | `lib/play/admin/final_results.svelte`, `e2e/podium.e2e.ts` |
| 11 | **`e2e/run.sh` runs on Linux and macOS** as well as Windows: finds Postgres wherever it lives, drops to the `postgres` user when run as root, uses the real `redis-server` when there is one, fetches the right Meilisearch build, and picks Edge or Chromium per platform | `e2e/run.sh`, `e2e/stop.sh`, `frontend/playwright.config.ts` |
| 12 | **Game surfaces fit a phone.** The podium's action panel covered the podium at 390px; it is a bottom row below `sm`. Lobby → question → results → podium asserted at phone width | `lib/play/admin/`, `routes/admin`, `e2e/podium.e2e.ts` |
| 13 | **Corners come off one scale.** Four sites rendered a 4px corner because a bare `rounded` resolves to Tailwind's own `--radius`, not ours; cards disagreed by 5.6px; the view page nested equal radii; the host's answer row drew itself two ways | `src/app.css`, 10 components, `src/lib/a11y/radius-scale.test.ts` |
| 14 | **One motion scale.** Fifteen ad-hoc durations and almost no easing became five durations and four curves, declared once in `app.css` and mirrored in `lib/motion.ts` for Svelte's JS transitions, which never see a CSS variable. Three bars animated `width`, which lays the page out every frame; they animate `transform` now. Reduced motion clamps the whole scale to 1ms | `src/app.css`, `lib/motion.ts`, `lib/a11y/motion.test.ts`, `e2e/motion.e2e.ts` |
| 15 | **Uploads have limits, and there is still no file manager.** There was no server-side size cap at all (`size = 0` went into storage, the only limit was Uppy's in the browser, and the endpoint takes anonymous uploads) — and the browser's cap was not applied either, because `restrictions` is an Uppy *Core* option and was passed to the Dashboard plugin. 5MB per image and 1GiB per account, enforced at Caddy, on `Content-Length`, and on the counted bytes; the quota counts the file in hand; `/raw` aborts mid-stream; `video/mp4` behind a flag | `frogquiz/config.py`, `routers/storage.py`, `frogquiz/__init__.py`, `Caddyfile*`, `lib/editor/uploader.svelte`, [`docs/uploads.md`](docs/uploads.md) |
| 16 | **A game survives someone closing their laptop.** There was no socket `disconnect` handler, so a closed tab stayed in the count "everyone answered" is measured against and the host sat through every full timer for the rest of the game. Disconnect drops the player from the count but keeps the rejoin key, so a backgrounded phone can still return; `rejoin_game` re-announces them, which it never did | `socket_server/__init__.py`, `e2e/disconnect.e2e.ts` |
| 17 | **A refused answer says so.** `question_not_active` had no listener anywhere, so an answer the server threw away still read "Answer locked in". Fixed with the listener leak beside it — the component is recreated per question and never released its subscription | `lib/play/question.svelte`, `lib/play/refusal.test.ts` |
| 18 | **Two over-wide permissions closed.** `captcha_enabled` defaulted to *true* on `/quiz/start`, where `check_captcha` then raised `AttributeError` out of `join_game` because `settings` was config.py's uncalled `lru_cache` wrapper — fixed, defaults off, refused without a provider key. The Excel export was open to any signed-in user while the view page hid the answers from a non-owner; **owner-only since 2 Oct** on François's call (D18). I had narrowed it on 1 Oct on a misreading of the markup and reverted it — this time it is the decision | `routers/quiz.py`, `socket_server/helpers.py`, `routers/eximport.py` |
| 19 | **Deleting an image gives the space back.** `storage_used` was only ever incremented — by the worker, once per upload — and nothing anywhere subtracted it, so it was a lifetime upload counter and the quota a lifetime cap. Enforcing the quota turned that into a real lockout. The delete endpoint releases the bytes, and taking an image off a question now deletes the orphan once nothing references it instead of merely unlinking it | `routers/storage.py`, `worker/storage.py`, [`docs/uploads.md`](docs/uploads.md) |
| 20 | **Deleting a quiz frees its images.** Both delete paths matched image keys with a regex that only described upstream's old double-key form, so for every modern upload it matched nothing: a deleted quiz, and every expired anonymous quiz, left its images in storage permanently and still charged to the owner. One reference-counted helper now serves all three paths | `frogquiz/helpers/__init__.py`, `routers/quiz.py`, `worker/storage.py` |

## Done — 3 Oct, overnight

| What | Where |
| --- | --- |
| **Tab worked on no page.** The command palette's key bindings live on `window` for the life of the app and never checked whether it was open, so Tab and the arrows were swallowed everywhere (focus could not leave `<body>`, the skip link included) and Enter ran the palette's last selected action after it was closed | `lib/components/commandpalette.svelte`, `e2e/command-palette.e2e.ts` |
| **Every uploaded image was announced as "��e".** No alt text means no `X-Alt-Text` header, and `atob(null)` decodes the string "null" | `lib/editor/MediaComponent.svelte`, `e2e/uploads.e2e.ts` |
| **The lobby's full-screen QR could not be closed from the keyboard** (its Enter handler returned a function, no Escape); now a Dialog with a quiet zone | `lib/play/admin/game_not_started.svelte`, `e2e/game-exits.e2e.ts` |
| **Joining dropped focus between PIN and name**, closing a phone's keyboard mid-join | `lib/play/join.svelte`, `e2e/join.e2e.ts` |
| **Hand-rolled overlays moved to the shadcn Dialog**: image uploader (also Uppy themed, "Powered by Uppy" actually hidden), Advanced settings (a Switch, "Skip the results", replacing "Hide question resuluts?"), the image full-screen view | `lib/editor/uploader.svelte`, `lib/editor/question-card.svelte`, `lib/editor/MediaComponent.svelte` |
| **Focus you can see**: editor answer fields and timer, player answer tiles (were a white ring on a white page) | `lib/editor/`, `lib/play/question.svelte`, `lib/play/questions/check.svelte` |
| **Sentence case** across live labels; `docs/redesign-status.md` corrected on which routes are hidden | `en.json`, `docs/redesign-status.md` |
| **Multiple-answer results were an empty card on the projector**; now drawn, and `scoreboard.e2e` plays one through the UI | `lib/play/admin/results.svelte` |
| **Every game state passes axe**, host and phone, both themes: `<h1>`s, scoreboard labels read out, medal inks per theme held to AA (`medal-contrast.test.ts`) | `lib/play/`, `lib/a11y/medal-contrast.test.ts` |
| **The phone question screen fits a phone**: `h-dvh` flex column, equal answer columns, images that fit, a real Submit, no faded start, "Pick every correct answer" | `lib/play/question.svelte`, `lib/play/questions/check.svelte`, `lib/play/admin/question.svelte` |

## Done — 4 Oct, walking the app as a user

Every flow outside a live game, driven through the UI in a real browser at 390 and 1440 in
both themes, with axe, console and overflow checked at each step. Each fix has a test that
failed first.

| What | Where |
| --- | --- |
| **Editing a question's timer broke Save** (422): a number input bound to a string field. Regression from this branch's editor rebuild | `lib/editor/question-card.svelte`, `e2e/editor.e2e.ts` |
| **On a phone, taps inside an open question card hit the drag grip**: its touch hit area had no positioned parent and covered the card. No spec had run with a touch screen | `lib/editor/question-card.svelte`, `e2e/editor-column.e2e.ts` |
| **True / False pre-marked True**, so a false statement shipped with the wrong answer, and clicking True un-marked it | `lib/editor/AddNewQuestionPopup.svelte` |
| **Logging in again after a password change did nothing**: the reload kept `password_changed=true`, which suppresses the signed-in redirect | `routes/account/login/`, `e2e/account.e2e.ts` |
| **The editor header status was one letter wide on a phone**, and "can't save" named the wrong missing piece | `lib/editor.svelte` |
| **Signing up to keep a quiz** came back to a banner still saying "not saved", Claim folded away | `routes/view/[quiz_id]/+page.svelte` |
| **My Account**: Delete on your own session (did nothing visible), name and email cut off on a phone | `routes/account/settings/+page.svelte` |
| **Register** left the form live after success; **login** showed two pages at once on the way out | `routes/account/register/`, `routes/account/login/` |
| **Copy**: "Custom field" explained, Delete names the quiz, "3 questions", no promise of a hidden import, practice headings, one contrast miss | `en.json`, `lib/dashboard/start_game.svelte`, `routes/practice/` |
| **Deleting a session or changing the password left the other device signed in up to 30 minutes**; revoked at once now (François agreed) | `auth.py`, `routers/users/`, `tests/test_server.py` |

## Open — before sharing

- [ ] **Run `MVP.md` §4.1 on the deployed site.** Nobody has. It is the only part that can still reorder the rest
- [ ] **Real mail end to end**: since 5 Oct it is how everybody signs in, so it is no
      longer optional. Sign in with a frog.co address by the link, then by the code on a
      second device, with `MAIL_*` set on the production API. The hotmail address chosen on
      2 Oct can no longer sign in (team domains only). Steps in
      [`DEPLOY.md`](DEPLOY.md#testing-it-for-real); check spam and quarantine
- [x] **Clean slate when the sign-in change (D21) deploys.** Done 6 Oct, Gonçalo agreed:
      Neon was emptied (6 users, 5 quizzes, 1 image, 2 game results), uploads, Redis and the
      search index too, after the new backend image was pulled. The backup is off the VM, in
      `~/frogquiz-backups` on François's laptop. Steps, and what the VM looked like, in
      [`DEPLOY.md`](DEPLOY.md#clean-slate-when-the-sign-in-change-ships)
- [ ] **Confirm the `worker` container runs in production**, or the 30-day deletion the anonymous copy promises is not kept
- [ ] **Gonçalo's tick on D16 and D18.** François signed D1 and D3–D15 on 2 Oct after
      asking for each to be explained; D2 and D16 are his "like Kahoot", D8, D9 and D18 are
      his, D17 was already his. The `MVP.md` table still has Gonçalo's column empty for D16
      (questions on players' phones) and D18 (results owner-only). Not blocking, but it
      is not "both" until he ticks them. **D19 to D21 (5 Oct) too**: late join with a lock,
      Kahoot's score curve, and sign-in by emailed link for team addresses with no
      passwords. D21 is an auth change, so read it first
- [ ] **#3 Part A** — two more boxes are now true: *Player disconnect / rejoin* (row 16) and
      *Image upload* (row 15). The rest of Part A is either a hidden feature (video,
      `/import`, `/remote`, `/quiztivity`, `/moderation`, `/results`) or needs the deployed
      site. Part B's keep/cut decisions are recorded in [`docs/mvp-scope.md`](docs/mvp-scope.md)
- [x] **Revoke access on session delete and password change** (François agreed, 4 Oct).
      Deleting a session, logging out, "sign out everywhere", a password change and a
      password reset now stop the other devices' access tokens at once, not up to 30
      minutes later. Tokens carry their session id (`sid`) and `get_current_user` refuses a
      revoked one (one Redis read). Checked on the local stack before and after; pinned by
      `test_delete_session`, `test_password_update` and `test_signout_everywhere`. Tokens
      minted before the deploy carry no `sid` and lapse within 30 minutes as before

## Open — GitHub issues (8 Oct)

Every open issue, so none lives only on GitHub. Closed with PR #23: #24 (touch targets).

- [ ] **#3 MVP 1: full end-to-end run, fix the bugs, cut what we do not need.** Part B is
      done ([`docs/mvp-scope.md`](docs/mvp-scope.md)). Part A is not: the issue's own list
      of unwalked rows (passkeys, video, `/remote` and controllers, QuizTivity, OAuth,
      multi-player load, host reconnect, `/practice`) is from 15 Sep and partly stale, since
      the e2e suite now covers reconnect, rejoin and practice; passwords and registration
      are replaced by D21. What is certainly owed is the deployed-site run with a real
      inbox (`MVP.md` §4.1). Re-tick the issue's boxes against the suite before the next
      run-through
- [ ] **#4 MVP 2: close the Kahoot and Mentimeter gap.** Word cloud first, then open-ended
      with grouping, then a non-competitive mode. Also tracks bringing back the five hidden
      question types. Not started; one question type per PR
- [ ] **#22 Oracle VM: 4 OCPU / 24 GB is over the new Always Free limit (2 / 12).**
      **Deadline 31 Oct.** Checked on the VM on 6 Oct: still 4 / 24, Postgres is Neon (so
      only `uploads/` lived on the disk), and a backup of both was copied to François's
      laptop before the clean slate. **Still open:** resize to 2 OCPU / 12 GB in the
      Oracle console (by hand, when no game is live), upgrade to pay-as-you-go with a $1
      budget alert, the recovery drill, and checking the Netlify variables against
      `netlify.toml`. `uploads/` is empty now, so there is little left to back up
- [ ] **#33 Let users change their name; decide how name, username and email relate.**
      Needs a decision first (what the "name" is, which of the three a user may edit). Note
      C13 (4 Oct) decided usernames do not change, so this reopens that. Touches auth, so
      call it out in the PR
- [ ] **#34 Decide whether quizzes need a real "Private" setting.** Today "Unlisted" is
      link-only (D13). Decide first; if yes, the read endpoints and both exports must 404
      for non-owners, which touches auth. Closing the export owner-filter gap is wanted
      either way
- [ ] **#35 Concurrency edge cases: same quiz in several tabs or devices, launched twice,
      edited or deleted while live.** Master already answers a stale editor save with a 409
      (E8). Still open: `start_quiz` and `get_public_quiz` write the whole quiz row back
      from a stale copy, so a launch or a page view during an autosave may revert it
      (predicted, needs a repro); `/editor/finish` takes no `base`; images and results of a
      live game when its quiz is edited or deleted. First step is a spec per row

## Found in the feature sweep — all cleared

The five findings from [`docs/feature-inventory.md`](docs/feature-inventory.md) are fixed:
the silent refused answer, the missing socket `disconnect` handler, the unfiltered Excel
export (owner-only since 2 Oct, D18), `check_captcha`, and the route that lived inside a
string literal. Rows 16–18 above. That doc is still the map of the whole surface.

## Decided — 2 and 4 Oct

- [x] **4 Oct: multiple-answer scoring stays all or nothing** (François), after comparing Kahoot; the reasoning and the way to change it are in [`docs/mvp-scope.md`](docs/mvp-scope.md).

- [x] **Non-owner answer key: locked to the owner** (D18). The view page hid the correct
      answers from a non-owner while the Download button beside it handed over a
      spreadsheet containing them, so any signed-in teammate could read the answers to a
      quiz they were about to play. `GET /eximport/excel/{id}` is now scoped to
      `user_id` (404, not 403, so it leaks nothing about the id), and the button sits
      behind `{#if is_owner}`. Pinned by `test_excel_export_is_owner_only` and a new
      `practice.e2e.ts` case that asserts both halves: the button is absent for a
      non-owner **and** the endpoint refuses them.
      I narrowed this endpoint once before on a misreading of the markup and reverted it;
      this time it is the decision, not a guess.

- [x] **#16, #17 and #19 closed** on François's say-so (2 Oct), each with a comment
      recording the evidence rather than a bare close. #18 was already closed.
- [x] **D8 contact address**: the `francois.prevot@frog.co` placeholder stands. Revisit
      only if frogQuiz goes outside the team.
- [x] **D9 login architecture**: an account is what makes a quiz permanent; no SSO yet.
      `frogquiz/oauth/` stays config-gated and unwired.
- [x] **Mail test recipient**: `francois.prevot@hotmail.com`. Steps in `DEPLOY.md`.

## Open — two unexplained e2e failures

A fourth live-game stall came on 2 Oct, so per the rule this section used to carry it was
root-caused rather than noted. **Two of the four were the test, not the app**, and are
closed below. The other two have a different symptom and stay open; do not fold them into
the explanation.

- [x] **`journey-remote-call` and `journey-returning-host` stalled in
      `advanceToFinalResults`** (both on 2 Oct), each waiting 60 s for "final results".
      Cause: `clearScoreboardStep` in `frontend/e2e/helpers.ts` read `isVisible()` once,
      which does not wait. Between "Show results" and the results arriving, the host bar
      shows neither "Scoreboard" nor "final results", so under load it read "no standings
      step", skipped it, and the next button never came. The remote-call failure snapshot
      shows "Scoreboard" on screen at timeout. **Reproduced on demand** by holding the
      `question_results` frame back 3 s with `page.routeWebSocket`: the old helper stalled
      identically, the fixed one (waits for whichever button arrives) passed. Older specs
      never hit it because they `waitForTimeout(1200)` after "Show results"; the journeys
      do not. returning-host's snapshot was not kept, so it is attributed on the matching
      call site and symptom, not on its own evidence.

- [ ] **`game-reload.e2e.ts › a player can reload twice and still be in the game`** failed
      once, in the 127-test run on 2 Oct (124 passed). It waits for an answer button after
      two reloads and did not get one. It passed in the three full runs before that, and
      the spec is untouched this session. **Re-run straight after: 3/3 clean in isolation**
      (12/12 counting the rest of that file), so it is not reproducible on demand — the
      same profile as the `editor.e2e.ts` item below. Not the helper race above: it stalls
      on the player side, waiting for a question to arrive.

- [ ] **`editor.e2e.ts › build a quiz by hand, save it, and play it` failed once**, in the
      first of four full-suite runs on 2 Oct (118/119; the second was 119/119). `final_results`
      came back with no key for question `0`.
      I attributed it to the fire-and-forget `start_game` race and said the fix closed it.
      **That was wrong**: measured afterwards, the *unfixed* spec passed 10/10 in isolation.
      So: 1 occurrence in 2 full runs, cause unknown, and the opposite profile to the
      earlier flake (which failed 2 in 10 *in isolation*) — do not assume one cause.
      The spec now asserts which question keys came back, and prints the payload, so a
      recurrence is readable rather than an opaque `TypeError`. Leave this open until it
      either recurs with that message or goes twenty full runs without appearing.
      On the harness: `next()` in `e2e/sockets.ts` maps a missing payload to `{}`, so
      `finalResults`' `not.toBeNull()` guard cannot catch an empty result. This is not
      fixable in `next()`: python-socketio sends `emit(event, None)` with no arguments, so
      the client cannot tell a `None` result from a payload-less event like `start_game`,
      and a `{}` result arrives as `{}` either way (checked 4 Oct). The spec's own key
      assertion above is the guard that works.

- [ ] **Two more one-off failures on 4 Oct**, in the first full run with the arq worker
      started by `run.sh` (163/166, branch `crud-audit`): `editor-column.e2e.ts › a question
      can be moved and deleted` (the second card was still the moved one's old text;
      **explained and fixed 4 Oct, later**: it recurred, and a probe showed the moved card's
      rich-text field takes 11ms to 1s to show its text again after re-mounting, while the
      test read it once, straight away. The text was never lost. The test now waits) and
      `practice.e2e.ts › practice runs a quiz end to end` (the page stayed on its loading
      spinner). No 5xx in `api.log` for either. Both passed straight after in isolation,
      with the worker running. Same rule: note a recurrence, do not explain it in advance.

- [ ] **`practice.e2e.ts › practice runs a quiz end to end` failed again on 10 Oct**, in the
      full run on PR #37's head (215/216), with a different symptom from 4 Oct: the last
      question was answered and revealed, "See my score" was on screen and clicked, and the
      page stayed on the question (`getByText('2 / 3')` not found). Re-run straight after:
      3/3 clean in isolation. The PR touched nothing on the practice page but its navbar
      store import. Two occurrences, two symptoms: still no cause.

## Open — CRUD audit (4 Oct)

- [x] **C1 to C18** in [`docs/crud-audit-2026-10.md`](docs/crud-audit-2026-10.md): every bug
      fixed on branch `crud-audit` the same day, each with a regression test.
- [ ] **Is the worker running on the VM?** `docker compose ps`. Without it no upload counts
      against the quota, edited quizzes are never linked to their images, and neither sweep
      (orphaned uploads, expired anonymous quizzes) ever runs.
- [x] **Username change** (C13): decided 4 Oct, usernames do not change. Recorded in `docs/mvp-scope.md`.

## Open — edge-case pass (4 Oct, late)

- [x] **E1 to E27** in [`docs/edge-cases-2026-10.md`](docs/edge-cases-2026-10.md): every bug
      fixed (E1 to E15 on 4 Oct, E16 to E27 on 5 Oct), each with a test that failed first. The three High ones: everyone
      was signed out 30 minutes after logging in (E1), a phone that dropped after answering
      could end the question for somebody else (E4), and a back swipe mid-game left a ghost
      that held every question to its full timer (E6).
- [x] **Registration and login rate limits were per address** (E16), and an office shares
      one: the eleventh person registering in one room was locked out for an hour. Raised to
      office scale on 5 Oct at François's request (numbers in the CHANGELOG); Gonçalo to see
      it in the review, since it is an auth limit

## Open — quality

- [x] **`eslint` did not run on a fresh local install** (E27, fixed 5 Oct). `eslint.config.cjs`
      required `globals` and `@eslint/js`, which `package.json` did not declare. Both are
      declared now; CI had passed regardless

- [x] `svelte-check` in CI. **Done 4 Oct: 0 errors, and CI runs it.** The 825 under
      `node_modules` were `.d.ts` files, gone with `skipLibCheck`. The 227 of ours were
      fixed rather than excluded, gated question types included. A few were real bugs: the
      ORDER editor gave each answer `id: [i]` (an array), `/edit/videos` read ffmpeg.wasm
      0.11's `ratio` so its progress bar sat at 0, `?verified=<anything>` showed the login
      page's "confirmed" badge, and a stray `<!--{/if}-->` at the end of `/import` made
      svelte-check read that page as JavaScript, which hid a `File[]` bound to a `FileList`.
      The original measurement follows.
      Measured in a single run, 2 Oct: **1054 errors, 229 in our own
      code and 825 under `node_modules`** (mostly `bits-ui`). Reproduce with
      `npx svelte-check --output machine > out.txt`, then count `^[0-9]* ERROR` lines in
      that one file, with and without `node_modules` — the first attempt at this used two
      separate `svelte-check` runs and reported 339/331, which made our share look like
      half the problem instead of a fifth. The original note here (~300 ours, ~820 in
      `bits-ui`) was right.
      Ours cluster hard, so this is less open-ended than 229 suggests: `play/question.svelte`
      (20), `editor/RangeSelectorEditorPart` (18), `editor/OrderEditorPart` (16),
      `account/login` (15), `editor/ABCDEditorPart` (12) — the top five are 81 of them, and
      three of those five are editor parts for question types the MVP does not offer
      (RANGE, ORDER, VOTING are not in the editor's allowlist), so they are gated code that
      could be excluded rather than fixed
- [ ] The input tier on hidden routes (`/quiztivity`, `/edit/files`, controllers, Pixabay) still draws form fields at three different radii. An `fq-field` utility would fold in the un-themed `bg-gray-500` / `focus:ring-blue-500` drift at the same time
- [x] `lib/components/ui/button/button.svelte` has two off-ladder steps (8px and 10px) from upstream. Defensible, but they are the last two
- [x] `/create` still renders upstream's "quiz created" modal, which nothing can open: `responseData.open` is a plain object never set to true. It carries `bg-white`, `text-gray-900` and a raw Heroicon `<svg>`. Deleted on 4 Oct: unreachable, so no feature went with it
- [x] **Touch-sized press areas on phones (issue #24).** Measured 4 Oct at 390 with touch
      emulation: the editor's timer input (40x20, under the 24px floor), "Mark as correct"
      (28px), "Delete answer" (24px, and invisible on touch until the row has focus), answer
      fields (28px tall), the 36px search and password inputs, 26px quiz title links. Fixed
      the same day, with the issue's mix: fields grow, icon buttons in tight rows get
      `fq-touch-target` and wider gaps. `touch-targets.e2e.ts` keeps it that way. Still
      wanted: a thumb on a real phone (HANDOVER.md)
- [x] Tailwind scanned `radius-scale.test.ts`, whose list of banned classes emitted dead `.rounded`, `.rounded-t` and `.rounded-b` rules. Not Markdown, as this entry first said. `app.css` now excludes `*.test.ts`

## After V1

- [ ] Azure single sign-on (`frogquiz/oauth/` is config-gated and kept)
- [ ] Internal wiki: tools, alternatives, pros and cons
- [ ] MVP2 — avatars, rank position, word cloud (issue #4, `BACKLOG.md`)
- [ ] More languages (D10): i18next and every `$t(...)` are in place; it is a translated `locales/<lang>.json` plus a picker
- [ ] Submit frogQuiz to the internal Use Case Hub

## Notes

**Lobby music.** The track is `frontend/src/lib/assets/music/1-128.mp3`, a 17-second loop
that has been in the tree since the fork. Its REUSE header credits *Marlon W (Mawoka)*
under MPL-2.0, so we are reusing upstream's asset, not one of ours — decided on 1 Oct:
fine for now. It is a static file, not a call to upstream's servers, so the
"upstream independence" rule in `CLAUDE.md` is not in play. Worth revisiting only if
frogQuiz is ever shown outside the team, where somebody may want a track the project
actually owns. Kahoot's own music is copyrighted and is not an option.

## Decisions taken this session

| | Decision | Who |
| - | --- | --- |
| D17 | `--primary` stays zinc; `CLAUDE.md` corrected rather than the palette | François |
| — | Only the podium's colors were wrong; the answer tiles, ambient background and neutral scheme stay | François |
| — | Player feedback shows correct/wrong, points **and** place | François |
| — | The editor needs no drawer below `lg`: the column of cards is the navigation, as in Forms and Kahoot | François |
| — | True / False added as a preset over ABCD | François |
| — | `card.svelte`, `sidebar.svelte` and `question-strip.svelte` deleted rather than left dead | François |
| — | The ToS keeps its placeholder address for now (D8 stays open) | François |
| — | Reuse upstream's lobby track rather than sourcing or synthesising one | François |
| — | Kahoot's round sequence exactly: answers → scoreboard → next question | François |
