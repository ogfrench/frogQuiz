<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# frogQuiz against Kahoot, step by step

Written 2026-10-05 for François, to decide what to build next. Gonçalo and François own every
cut and every reversal named below; where a gap exists because something was cut on purpose,
the decision is cited and the cost of undoing it is given instead of a verdict.

## How this was checked

**frogQuiz** was read from the code and the e2e specs, not from the docs alone, on branch
`ccr-370df3e4-c44t1l`. The edge-case pass that ran alongside this report (E1 to E27 in
`docs/edge-cases-2026-10.md`) is on the same branch; claims that rely on it cite its E number.
Nothing was run here: another session owned the local stack, and ran the suites.

**Kahoot** was checked against its own help centre and pricing pages. `support.kahoot.com`
answers every fetch with HTTP 403, so none of its articles could be read in full. Every
Kahoot claim below comes from the search-result excerpt of that article, which the link
points to. Where an excerpt came from a third-party page, or where nothing could be found,
the claim says "unverified" and says what it rests on. Kahoot changes plans often; treat
plan limits as correct for early October 2026 at best.

## Summary

At parity on the spine of a live game: PIN and QR join with no player account, nicknames,
a lobby with kick, a per-question timer with the room's answer count, an answer reveal with
a distribution chart, a scoreboard step with rank movement, a podium, a spreadsheet export,
reconnect after a drop, and autosave with drafts in the editor. On a handful of points
frogQuiz is ahead (see the section near the end), mostly in reliability work done in the last
three weeks.

It falls short in three ways. The first is what happens after the game: nothing is saved
(D4), so a result is gone two hours after the game ends unless the host downloaded the
spreadsheet. The second is reuse: there is no way to copy a quiz, pull a question from
another quiz, or share a quiz with a named teammate. The third is host control during a
game: no lock, no late join, no pause, no extra time, no autoplay.

Ten gaps most worth closing for an internal team, in order:

1. **Saved results and history.** The data is generated and then thrown away after two hours (D4).
2. **Duplicate a quiz** (your own, or a public one from Discover). Teams rebuild the same quiz otherwise.
3. **Late joiners and a lobby lock.** `join_game` refuses everyone once the host presses Start, and nothing stops a stranger with the PIN from joining before it.
4. **The score curve.** A correct answer given at the last second scores about 0 in frogQuiz and about 500 in Kahoot, which changes who wins.
5. **Question types beyond pick-one and pick-several.** Type-answer, poll, slider and puzzle are built and hidden (cut list, open decision 4).
6. **A team tier for sharing.** "Public" means published to the internet, and nobody else can edit your quiz (open decision 6, settled as is for MVP1).
7. **Import back on.** Kahoot URL, Excel and `.cqa` import exist and are hidden (D6); the Kahoot URL path calls Kahoot live and is untested.
8. **Host controls mid-question.** No extra time, no pause, no autoplay, and kick exists only in the lobby screen.
9. **Preview as a host.** Practice is solo and in the browser; nobody can see the host and phone views together before going live.
10. **Media beyond one still image per question.** No video, audio, GIF, or images as answers (uploads.md, `video_upload` flag).

## 1. Creating a quiz

### Kahoot

Question types on the free personal and school tiers are quiz (multiple choice, with
true/false) and slides; multi-select, up to six answers, type answer, slider, puzzle, poll,
pin answer, drop pin, open-ended, word cloud and brainstorm sit behind a paid plan
([question types](https://support.kahoot.com/hc/en-us/articles/115002308428-Kahoot-question-types),
[free vs EDU table](https://support.kahoot.com/hc/en-us/articles/28014204599443-School-subscription-Free-vs-EDU-Feature-Comparison),
read through excerpts). Questions run to 120 characters and answers to 75; a kahoot holds up
to 200 questions ([how to make a kahoot](https://support.kahoot.com/hc/en-us/articles/115002884788-How-to-make-a-kahoot)).
The timer runs from 5 seconds to 4 minutes (same article; the excerpt gives the range for
true/false and calls it the range for most types, so treat it as likely rather than certain).

Points per question are standard, double or none. A single-select question is worth up to
1000, a multi-select up to 500 per correct answer, and the formula halves the speed penalty:
`(1 - (response time / timer) / 2) * max points`, with the full score for any correct answer
under half a second ([how points work](https://support.kahoot.com/hc/en-us/articles/115002303908-How-points-work),
excerpt; the formula wording comes from a search summary of that page and is consistent
with Kahoot's older public statements). Answer streaks exist but, per the same page's excerpt,
no longer add points; the Confidence mode adds +50, +75 and +100 for a boosted correct answer.

Media: one image, GIF or video per question; images PNG, JPEG or GIF up to 50 MB and 5000 by
5000; video upload up to 200 MB, Vimeo embeds, and YouTube no longer for business and social
accounts; audio up to 50 MB, plus text read aloud
([images](https://support.kahoot.com/hc/en-us/articles/115002815387-Kahoot-images-How-to-use-images-and-GIFs),
[video](https://support.kahoot.com/hc/en-us/articles/115002926628-How-to-add-or-upload-a-video-to-a-kahoot),
[audio](https://support.kahoot.com/hc/en-us/articles/30572345883795-How-to-add-or-upload-audio-to-a-kahoot)).
Getty, Unsplash and Giphy libraries are built in. Themes, including custom logo and
background on paid plans, are in the creator
([themes](https://support.kahoot.com/hc/en-us/articles/4433531677715-How-to-use-themes)).

Reuse: a question bank searches public questions and your own library
([question bank](https://support.kahoot.com/hc/en-us/articles/16130620877971-How-to-use-Kahoot-question-bank)),
kahoots can be duplicated and combined
([duplicate](https://support.kahoot.com/hc/en-us/articles/115000472987-How-to-duplicate-kahoots),
[combine](https://support.kahoot.com/hc/en-us/articles/360054958114-How-to-combine-kahoots)),
and spreadsheet import takes the Excel template with quiz questions only, four answers,
time values of 5, 10, 20, 30, 60 or 120, no images
([import](https://support.kahoot.com/hc/en-us/articles/115002812547-How-to-import-questions-from-a-spreadsheet-to-your-kahoot)).
The creator autosaves and shows the save state beside the title; a draft cannot be played,
assigned or shared; Preview shows host and player views side by side and a launch-demo button
runs the whole flow
([save](https://support.kahoot.com/hc/en-us/articles/360054965254-How-to-preview-exit-and-save-your-kahoots),
[preview](https://support.kahoot.com/hc/en-us/articles/29968568026131-How-to-preview-and-test-your-kahoot-before-hosting-live)).
AI generation (topic, PDF, URL, Wikipedia, slides) is on Kahoot+ Gold and 360 Pro and above
([AI](https://support.kahoot.com/hc/en-us/articles/40803785990675-How-to-generate-a-kahoot-with-AI)).

### frogQuiz

The editor is one column of question cards (`frontend/src/lib/editor.svelte`,
`frontend/src/lib/editor/question-card.svelte`, pinned by `e2e/editor-column.e2e.ts` and
`e2e/editor.e2e.ts`). The picker offers pick-one (ABCD), pick-several (CHECK) and a True/False
preset that is ABCD with two answers, neither pre-marked
(`frontend/src/lib/editor/AddNewQuestionPopup.svelte`). Seven types exist in
`QuizQuestionType` (`frogquiz/db/models.py`); RANGE, TEXT, VOTING, ORDER and SLIDE are
hidden from the picker only and still play and score (`docs/mvp-scope.md`, D2).

Limits, with the editor and server held equal by a test (`frontend/src/lib/editor/text_limits.test.ts`):
title 100 characters, description 500, question 250, answer 100, measured on visible text;
four answers in the editor UI and ten at the API (`ABCDEditorPart.svelte:155`, 
`MAX_ANSWERS_PER_QUESTION`); 50 questions in the editor (`yupSchemas.ts`) and 1000 at the API;
timer 1 to 999 seconds as a free number field. Text limits are looser than Kahoot's; the
question count is a quarter of Kahoot's 200.

Points: there is no setting. Every question is standard. The formula is
`(timer - elapsed) / timer * 1000` (`calculate_score`, `frogquiz/socket_server/__init__.py:94`),
so the score falls to zero at the buzzer, with no half-second full-marks window and no
streak. Latency measured at join is subtracted from elapsed time, and an answer more than
1.5 seconds after the timer is refused (`ANSWER_GRACE_MS`). CHECK is all or nothing with a
1000 ceiling, reconfirmed by François on 4 Oct against Kahoot's own rule
(`docs/mvp-scope.md`). A per-question "skip the results" switch exists (Advanced settings).

Text is rich: CKEditor inline with bold and italic (`frontend/src/lib/inline-editor.svelte`),
sanitised on render. Media is one image per question plus a cover image and a background
image or color. Uploads accept PNG, JPEG, GIF and WebP, 5 MB each, 8000 px per side, 1 GiB per
account; video is behind a flag that is off; the Pixabay picker and the library are hidden
(`docs/uploads.md`, covered by `e2e/uploads.e2e.ts`). There is no audio, no GIF library, and
no images as answers.

Reorder by drag or arrows, duplicate a question, and delete behind a confirm are in the card
toolbar (`e2e/editor-column.e2e.ts`; the move-and-delete test is the one that was flaky and
then fixed on 4 Oct). Autosave fires 2.5 seconds after typing pauses once there is a title and
a question; a draft is derived from incomplete questions, shows a Draft badge and cannot be
started (`frogquiz/helpers/completeness.py`, `e2e/drafts.e2e.ts`). Validation shows red only
after the first Save, and over-length counters show at once. Since the edge-case pass
the editor also survives a lapsed edit session, a stale tab (409 on a save based on an
older copy) and going back inside the app (E2, E8, E14, E15; `e2e/edge-cases.e2e.ts`).

There is no lobby-music or theme choice per quiz. The theme is the app's own, with the
cover and background as the only per-quiz look. There is no preview other than Practice (step
9). Import is hidden (D6, step 2). There is no question bank and no question-level copy
between quizzes. No AI generation; `BACKLOG.md` lists it as out of scope for an internal tool.

### Gap

Against Kahoot's free tier the type set matches (D2: François checked the live docs on 2 Oct
and the result was "no change"). Against what a team would pay for, frogQuiz lacks type
answer, poll, slider, puzzle and word cloud in the picker. It lacks points settings, a
question bank, per-question copy, video, audio, GIFs, answer images, themes with a logo,
and a preview. It is ahead on autosave behaviour and on bounds that match end to end.

## 2. Finding and managing quizzes

### Kahoot

The library has folders, search, sorting and a trash with restore
([folders](https://support.kahoot.com/hc/en-us/articles/360010810514-How-to-use-Kahoot-folders),
[trash](https://support.kahoot.com/hc/en-us/articles/360054269454-What-is-Library-Trash-and-how-to-delete-or-restore-Kahoot-content)).
Public kahoots appear in Discover and in link previews; private ones do not, and the
excerpt says players must sign in for those
([visibility](https://support.kahoot.com/hc/en-us/articles/115002930528-How-to-make-a-kahoot-public-private-or-other)).
Anyone can duplicate a public kahoot from Discover into their own folders. Paid school and
business plans add a team space where colleagues edit and host each other's kahoots, one
editor at a time
([guide for EDU admins](https://support.kahoot.com/hc/en-us/articles/28915801960851-Kahoot-guide-for-EDU-admins),
excerpt).

### frogQuiz

My Quizzes (`/my-quizzes`, `frontend/src/routes/my-quizzes/+page.svelte`) lists the account's
quizzes with a client-side title filter, a Draft badge, a public or unlisted badge, the
question count, anonymous expiry, and Play, Edit, Download and Delete per row; signed-out
visitors see the quizzes this browser made, which are deleted after 30 days unless claimed
(`MVP.md` §1; `e2e/my-quizzes.e2e.ts`, `e2e/crud-lifecycle.e2e.ts`). Discover (`/explore`) is
browse plus Meilisearch search over public quizzes (`e2e/account.e2e.ts`, `e2e/journey-teammate.e2e.ts`).
"Private" is labelled Unlisted (D13): anyone with the link can open the view page and run
Practice, but only the owner can start it, and only the owner gets the answer key and the
Excel download (D12, D18; `e2e/practice.e2e.ts`). A signed-in teammate cannot start someone
else's unlisted quiz; the view page does not offer Play (`quiz/start` answers 404).

There are no folders, no tags or categories, no trash, no co-editing and no
named sharing. The only sharing is the link or publishing to Discover. Public quizzes are
world-visible because search has no auth dependency (open decision 6, "settled: leave it as-is
for MVP1"). There is no duplicate-a-quiz action anywhere in the frontend or in the routers;
the only duplicate is of a single question inside the editor, and anonymous "claim" moves a
quiz to an account rather than copying it.

### Gap

For a team, copy-a-quiz is the missing day-to-day action: nobody can start from last
quarter's quiz without opening the editor and retyping it, or from a colleague's public quiz.
Folders and a trash matter once a person owns more than about thirty quizzes; no one does yet.
A team-only visibility tier is the larger piece (decision 6 gives the two ways out: require
auth on search, or add a third `visibility` value). Editing rights for teammates have no
equivalent at all.

## 3. Starting a game

### Kahoot

A live game has these settings (all from the
[live game settings](https://support.kahoot.com/hc/en-us/articles/115016055107-Live-game-settings)
excerpt): show questions and answers on participants' devices, player identifier, themes,
game characters, lobby music, sound effects, language, increased contrast, unlimited time,
reactions, randomize question order (not with slides), randomize answer order, autoplay, Q&A,
team selection and Team Talk, remove players, a nickname generator, 2-step join, and a lock
on joining. The nickname generator hands out two-word names such as "kind tiger", with up to
three spins ([nicknames](https://support.kahoot.com/hc/en-us/articles/115002201267-How-to-handle-inappropriate-nicknames)).
Kahoot also filters nicknames automatically against a list of inappropriate words and swaps
in something neutral. 2-step join makes a player copy a pattern that refreshes about every
ten seconds on the host screen, which blocks anyone who is not looking at it
([2-step join](https://support.kahoot.com/hc/en-us/articles/35342050693789-How-to-use-the-2-step-Join-option-to-secure-your-game)).
Autoplay starts a game once a player has joined and 15 seconds pass with nobody new, shows
results and the leaderboard for five seconds each, and restarts at the end.
Players join at kahoot.it with a PIN, or by QR or link.
Participant caps depend on the plan: the help centre lists tiers from 40 (Go) through 800
(One), and 360 pricing shows 50, 200, 1,000, 2,000 and 5,000 across the Pro tiers
([participants](https://support.kahoot.com/hc/en-us/articles/115003072287-How-many-participants-can-play-a-kahoot),
[business pricing](https://kahoot.com/business/pricing/)). A free personal account is
reported at 10 players and a free work account at 3, but only third-party pages said so
(unverified).

### frogQuiz

Press Play on the view page or My Quizzes and a dialog opens (`frontend/src/lib/dashboard/start_game.svelte`,
`POST /api/v1/quiz/start/{id}` in `frogquiz/routers/quiz.py`). Its options:

| Option | What it does | e2e |
| --- | --- | --- |
| Custom field | One extra prompt on the join screen (a name, a team, an email), exported as a column | `join.e2e.ts` |
| Randomize answers | Shuffles each question's answers once at start, same order for everybody | API only, `test_server.py` |
| Show questions and answers on players' devices | Off by default, as in Kahoot (D16, François; Gonçalo's tick still owed) | `player-screen.e2e.ts` |

That is the whole list. There is no question randomization, nickname generator, nickname
filter, team mode, theme or game character, sound setting, autoplay, lock, 2-step join or
captcha (the captcha toggle is hard-coded off; `docs/mvp-scope.md`). The custom field
roughly covers Kahoot's player identifier. Game mode is fixed to `kahoot` unless the device
switch is on. A six-digit PIN is drawn at random and a duplicate is redrawn.

The lobby shows the PIN, a QR code that opens `/play?pin=...` (`frogquiz/routers/utils.py:26`),
and the join URL as `host/play`. There is no player cap in code; `live-socket.e2e.ts` runs
50 players at once, and the backend runs one worker on purpose (`MAX_WORKERS: "1"`).

### Gap

Three of Kahoot's options are worth having for a team that posts a PIN in a chat: a lock, a
way to stop strangers joining (2-step join or at least a lock), and question shuffle. The
nickname generator and filter matter less for adults on an internal tool, though the PIN
is guessable (900,000 values) on an internet-facing deployment, and nothing today stops a
stranger joining until the host presses Start. Autoplay and team mode are not needed for
meeting use. Reversing none of these conflicts with a recorded decision; the captcha and
physical-controller code are separate, cut for the MVP.

## 4. The lobby

### Kahoot

The lobby shows who has joined with lobby music; the host clicks a nickname to remove that
player, can lock joining, and can set a lobby background video
([nicknames](https://support.kahoot.com/hc/en-us/articles/115002201267-How-to-handle-inappropriate-nicknames),
[settings](https://support.kahoot.com/hc/en-us/articles/115016055107-Live-game-settings)).

### frogQuiz

`frontend/src/lib/play/admin/game_not_started.svelte` shows the PIN at projector size, the QR
(click for a full-screen dialog that Escape closes; `e2e/game-exits.e2e.ts`), a live count
("3 players waiting") and every nickname as a button; clicking one kicks that player. A kick
deletes the rejoin key so the player cannot return with the same session
(`live-socket.e2e.ts`). Music plays by default at 40% volume with a mute and volume control
that remember the choice (`lobby_music.svelte`, `e2e/lobby-music.e2e.ts`); the track is
upstream's 17-second loop, an accepted reuse (`TODO.md` Notes). Start is disabled until one
player has joined. The host can cancel the lobby: every phone is told and the PIN stops
working (`end_game`; `e2e/game-exits.e2e.ts`). A player on a phone sees the join confirmation
and can leave, which frees the nickname.

### Gap

No lock. No lobby background media. The waiting experience on a phone is a static "you're in"
card; Kahoot's is the same plus music and reactions in some modes (unverified for the phone
side). Kick works at any time on the server, but the button exists only in the lobby, so a
host cannot remove a troll mid-game.

## 5. Each question

### Kahoot

The host screen shows the question, a countdown, the answer options and a live count of
answers. When time is up the host chooses to show the answers or skip that step and go to
the next question; there is no pause and no extra time, and the five-second read time before
answering opens cannot be changed
([pause request](https://support.kahoot.com/hc/en-us/community/posts/37489709200659-pause-the-timer-hosting-live),
[hosting a live kahoot](https://support.kahoot.com/hc/en-us/articles/360039422694-How-to-host-a-live-kahoot);
community-post excerpts, so "no pause" reflects a feature request still open, not a spec
statement). Players tap a colored shape on their phone; the question text appears there only
if the host enabled it
([see questions on participants' screen](https://support.kahoot.com/hc/en-us/articles/115003197928-How-to-enable-See-questions-on-participant-s-screen-in-Kahoot-live-games)).
After each question the host sees an answer distribution, and players are told right or wrong
with their points. A player who drops reopens kahoot.it or the
app, taps "Tap to rejoin game" and picks "Resume as [nickname]" to keep their score
(same hosting excerpt).

### frogQuiz

Host: `frontend/src/lib/play/admin/question.svelte` shows the question at projector scale
(`fq-stage`), the image, a circular timer, "N answers submitted", and the answer tiles in the
palette by slot, wrapping past four. A multiple-answer question says "Pick every correct
answer". The host can end a question early ("Show results"), which also reveals the answers to
the phones, and the question ends by itself when every player still connected has answered
(`everyone_here_answered`, by name rather than count after E4;
`e2e/live-socket.e2e.ts`, `e2e/edge-cases.e2e.ts`). There is no pause, no extra time and no
skip-without-reveal for ordinary questions (a question with "skip the results" set does skip
the reveal). Keyboard: Enter or Space runs the next sensible action on the host screen.

Phone: `frontend/src/lib/play/question.svelte` shows shapes and colors only by default,
or the answer text when the host turned that on (`e2e/player-screen.e2e.ts`). The tiles carry
`aria-label` text so a screen reader still reads the answer. A phone that answers is told
"Answer locked in", a refused answer says why ("too late", "time is up"; `e2e/disconnect.e2e.ts`
and `lib/play/refusal.test.ts`), and a CHECK question has a Submit button.

Score: speed matters (see the formula in step 1), streaks do not exist, and a wrong answer
scores 0, never negative. There are no in-game sound effects and no question music.
Practice and the live game use one scoring rule (`frontend/src/lib/practice/score.ts`).

Reconnect: a phone that drops and comes back is re-seated from a 5-hour cookie and gets the
question that is showing, with the time left rather than the full time (E5, with E7 and E18 for a
player who had answered or slept through the end). A host whose connection blips gets the answer count and
whether the question is still open back on re-register (E11; `e2e/edge-cases.e2e.ts`).

### Gap

The mechanics match. The differences that change a room: the score curve (a late correct
answer is worth about 0 here and about half marks there), no streak (Kahoot's streaks carry
no points now, so this is cosmetic), no extra time or pause (Kahoot lacks them too), no
in-game sound, and the host's answer count is a single number during the question, not a
per-option live bar (Kahoot's excerpt shows the same count; unverified whether it also
animates per option). The distribution chart after the question exists on both sides.

## 6. Between questions

### Kahoot

After the answer reveal, a leaderboard of the top five shows the standings, with the host
advancing at each step; the Confidence and Accuracy experiences change what is shown
([confidence](https://support.kahoot.com/hc/en-us/articles/32200674639261-Confidence-experience-How-to-host-a-kahoot)).
Hiding the leaderboard in assignments is not supported
([assign](https://support.kahoot.com/hc/en-us/articles/360039411334-How-to-assign-a-kahoot-in-web-platform)).

### frogQuiz

François asked for Kahoot's round sequence exactly: answers, then scoreboard, then next
question (`TODO.md`, decisions). `frontend/src/lib/play/admin/scoreboard.svelte` shows five
rows with place, name, total, "+N" gained and an up, down or held marker with sr-only words
(`e2e/scoreboard.e2e.ts`). The phone shows a correct or incorrect icon and word (not color
alone), the points, the total and the place (`results_kahoot.svelte`,
`e2e/player-feedback.e2e.ts`). A question with "skip the results" jumps straight on.

### Gap

None that matters. No streak message because there is no streak. The scoreboard is hidden
when a question has "skip the results" set, which Kahoot's assignments cannot do and live
games can (unverified).

## 7. End of game

### Kahoot

A podium of the top three, then results. Reports are kept in the host's account and can be
downloaded as XLSX or saved to Google Drive: an Overview, Final Scores, a Kahoot Summary, one
sheet per question with each player's answer, score and time taken, and a raw data sheet
([spreadsheet reports](https://support.kahoot.com/hc/en-us/articles/360035547493-How-to-download-and-use-spreadsheet-reports)).
Reports can be archived, deleted and restored
([archive](https://support.kahoot.com/hc/en-us/articles/1500004783782-How-to-archive-delete-and-restore-reports)),
outlive a deleted kahoot, and are reachable through a reports API for 90 days after the game
([reports API](https://support.kahoot.com/hc/en-us/articles/11735948502931-Guide-to-Kahoot-reports-API)).
At the end the host can Play again with ghosts, using the earlier players as opponents.

### frogQuiz

The podium builds third, second, first, 1.4 seconds apart, in gold, silver and bronze with a
crown and confetti, and none of that under reduced motion
(`frontend/src/lib/play/admin/final_results.svelte`, `e2e/podium.e2e.ts`). Each phone gets
its own place and score (`e2e/player-medal.e2e.ts`); a phone that was asleep through the
podium gets it on return (E18).

The host presses "Download results" once; a socket token mints an `.xlsx` with a Players sheet
(username, score, custom field), a Questions sheet (question, time, image, % correct, counts)
and one sheet per question listing each player's answer and whether it was right
(`generate_spreadsheet` in `frogquiz/helpers/__init__.py`, `e2e/game-export.e2e.ts`). There is
no per-answer time and no per-player sheet.

Nothing else is stored. `SAVE_RESULTS_ENABLED` is false, `/results` and the Analytics modal
are hidden, so in practice the `GameResults` table is never written (D4,
`docs/feature-inventory.md`). The server half still works: `save_quiz` writes the row, and
`account.e2e.ts` tests it, so turning results back on is the flag plus a page to read them.
The game's Redis keys live two hours from the last change. If the host closes the tab without
downloading, the data is gone. The Save button is also hidden for anonymous hosts because the
row would be unreadable (`routes/admin/+page.svelte`).

### Gap

This is the largest functional gap for a team that runs a quiz and wants to look at it later:
who knew what, which question the room missed, how Thursday's score compares with last
month's. Reversal cost, taken from the code: set `SAVE_RESULTS_ENABLED` to true, drop `/results`
and the Analytics entry from `DISABLED_ROUTES`, and show the Save button. The `/results`
table was already rebuilt on tokens before it was hidden (`docs/redesign-status.md`), so
the likely work is a design pass on Analytics, an e2e spec (none exists), and saving
automatically at the final results so the host has no button to forget. The routes behind it
are user-scoped, so anonymous hosts still lose their results unless the data is tied to the
anonymous secret. D4 was ticked by both; reversing it needs both.

## 8. Player side, end to end

### Kahoot

A player opens kahoot.it, enters the PIN, optionally a player identifier or a 2-step pattern,
then a nickname (or spins the generator)
([join](https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game)).
Nicknames are filtered. A player can rejoin after a drop and resume with their score, in the
browser or the app. Accessibility settings include increased contrast and unlimited time
(live game settings excerpt). Whether a player can join after the first question has started
is not stated in any excerpt I could read; the existence of a "lock game joining" setting
implies that they can (inferred, unverified).

### frogQuiz

Join at `/play`, or by QR (`/play?pin=...`), or from the home page's PIN box
(`frontend/src/lib/play/join.svelte`, `e2e/join.e2e.ts`, `e2e/journey-player-phone.e2e.ts`).
The PIN box strips non-digits and cuts to six, so "123 456" works (E10). The nickname must be
at least 2 characters (`MIN_NICKNAME`); the phone input caps at 17 characters while the
server accepts up to 50 after trimming, control characters stripped and a case-folded
uniqueness check, a mismatch worth tidying. Duplicates are refused atomically, including with
extra spaces. Emoji, accents and Arabic script are accepted. There is no profanity filter.
Errors are inline: not found, already started, name taken, kicked.

Nobody can join once the host presses Start (`game_already_started`). A player who drops is
re-seated from the cookie, and a back swipe now disconnects and reconnects cleanly (E6). A
player can leave on purpose outside a live question. Accessibility: every game state, host and
phone, passes axe in both themes; answers carry shapes as well as color; focus rings are
visible; touch targets are audited at 390 px (`e2e/touch-targets.e2e.ts`,
`docs/audit-2026-10-01.md`). The answer palette's contrast and its documented limitation for
some color-vision types are unit tested (`answer_colors.test.ts`).

### Gap

Late join, as noted. No generator and no filter, which for adults is a cosmetic gap. The
native Kahoot app has no frogQuiz equivalent; the web page is the only client, which a
phone-first room may notice. Phone nickname input and server limits disagree (17 against 50).

## 9. Other modes

### Kahoot

Self-paced challenges: the host sets a deadline and shares a PIN, link or QR; participants
play in their own time with a leaderboard and the host tracks progress in real time
([assign](https://support.kahoot.com/hc/en-us/articles/360039411334-How-to-assign-a-kahoot-in-web-platform),
excerpt). Team mode runs with shared devices, a team leader and 5 seconds of Team Talk
before each timer, and is listed as unavailable for business accounts
([team mode](https://support.kahoot.com/hc/en-us/articles/4408679135891-Kahoot-game-play-in-team-mode)).
Ghost mode (the Rematch experience) replays against an earlier session's players
([rematch](https://support.kahoot.com/hc/en-us/articles/115000510968-Rematch-experience-Play-again-with-ghosts)).
Solo play on the web exists as well. Which of these need a paid plan is not clear from the
excerpts (assign and solo are likely free; unverified).

### frogQuiz

Practice (`/practice`, `frontend/src/routes/practice/+page.svelte`) is a solo run through a
public or unlisted quiz with no timer, the game's own tiles and scoring, a final score and a
Back to quiz link (D3; `e2e/practice.e2e.ts`). It runs entirely in the browser: no result is
stored, there is no leaderboard, no deadline and nothing the owner can see. It runs ABCD,
CHECK and VOTING, and shows a notice and a Next for the other types. No team mode, no ghost
mode. `BACKLOG.md` lists team and ghost as "lower priority".

### Gap

A deadline-based challenge with a shared leaderboard is what a remote team would use for a
quiz nobody can attend live; frogQuiz has nothing like it, and it depends on saved results
(step 7). Team mode is a large piece, and there is no sign anyone has asked.

## 10. Reliability and scale

### Kahoot

Capacity is a plan limit, from 3 or 10 on a free account up to 2,000 or 5,000 on the top
business tiers (sources in step 3; free-tier figures unverified). Reconnect is by "Resume as
[nickname]". What the host drop does to the game is not documented in any excerpt I could
read (unverified).

### frogQuiz

This is where the last three weeks went. Written down: a disconnect handler so a closed laptop
no longer stalls "everyone answered" (`e2e/disconnect.e2e.ts`), a refused answer that says so,
answers recorded in a Redis transaction so 50 simultaneous answers all land (H1),
`update_game` transactions so back-to-back host events cannot overwrite each other (E23), E4 (a dropped player no longer closes a question on someone still choosing),
E5 (countdown from the time left), E6 (a back swipe leaves no ghost), E11 (a host blip sees
the question end), E12 (storage races), the 15-second host-away notice with a "host is back"
message (E22, `host_left`, `host_back`; `e2e/edge-cases.e2e.ts`), and a ping cap
so holding an echo cannot buy time (E21).

Two players in one browser keep their own places (E24), and a host who closes the tab for
good is reported to the phones (E22); both have specs. The rejoin key is refreshed on every
answer (E20). No
player cap exists in code and nothing above 50 players has been run. Production runs one
worker (`docker-compose.yml`) on an Oracle VM that must be resized to 2 OCPU before
31 October or it is deleted (issue #22, `HANDOVER.md` §1 A). Registration and login rate
limits were per address, so the eleventh person registering in one room was locked out for an
hour; they were raised to office scale on 5 Oct (E16).

### Gap

For an internal team the ceiling is probably fine; the unknown is a 150-person all-hands on
one worker, which nobody has load-tested. Kahoot's free tier cap would be below anything frogQuiz
has tested. The edge-case pass was done on the local stack only and the deployed site has
not had MVP.md §4.1 run against it.

## Where frogQuiz is ahead, or does something Kahoot does not

- No fee and no player cap in code. Kahoot's participant limits and most question types are
  priced; the question-type set above is free for a team here, though the picker hides it.
- Anonymous create, host and play with no account at all, with a 30-day expiry and a claim
  step (`MVP.md` §1). Kahoot's excerpt says private kahoots require sign-in to play and
  hosts need accounts (unverified for hosts).
- Autosave that survives a lapsed session, a stale tab and a back swipe, with the server
  refusing an older copy (E2, E8, E14).
- Editor and server limits held equal by a test, and a title or answer that cannot overflow a
  projector (`hostile-text.e2e.ts`).
- A decompression-bomb guard on uploads and a per-account quota that gives space back on
  delete (`docs/uploads.md`); Kahoot's limits are file size and dimension.
- Per-player answers in the export, with a host-defined custom column.
- A true multi-answer rule that cannot be gamed by ticking everything, written down with the
  way to change it.
- Reload-proof host and player screens, with the E-series regressions pinned by tests that
  failed first.
- Open source: the host can read and change the scoring rule. Kahoot's is a statement.

## Gap table

Impact is for an internal team; effort is S under a day, M up to a week, L longer.

| Area | Gap | Impact | Effort | Conflicts with a decision |
| --- | --- | --- | --- | --- |
| Results | No saved results or history; export is a one-shot token | High | M. Flag `SAVE_RESULTS_ENABLED`, unhide `/results` and Analytics, auto-save at final results, add an e2e spec, design pass on Analytics; anonymous hosts need an ownership link | Yes, D4 (hide). Both ticked it |
| Reuse | No duplicate-a-quiz, no copy of a question across quizzes, no question bank | High | S to M. A `POST /quiz/{id}/duplicate` must copy images and update `storage_used` through `adjust_storage_used`; copy across quizzes needs a picker | No |
| Game control | Late join refused after Start; no lock; no way to stop a stranger with the PIN | High | M. `join_game` and a `locked` field on `PlayGame`; a late joiner needs score init and the current question, as `rejoin_game` already sends | No |
| Scoring | Late correct answer scores about 0, Kahoot about 500; no double or no points | Medium | S. One function plus a start-modal field for points mode; changes how every past game would have ranked | No recorded rule except CHECK being all or nothing (`mvp-scope.md`, reconfirmed 4 Oct) |
| Question types | No type answer, poll, slider, puzzle or word cloud in the picker | Medium | S to re-list a type, M to L to make TEXT matching tolerant and each screen design-reviewed | Yes, the five cut types, open decision 4 (confirm with Gonçalo); D2 matched Kahoot's free tier |
| Sharing | No team visibility tier; no co-editing; public means internet | Medium | M for auth on search, L for a `visibility` column, migration and per-quiz permissions | Yes, open decision 6 (settled as is) and D13 |
| Import | Kahoot URL, Excel and `.cqa` import hidden and untested end to end | Medium | S to unhide, M to test all three; the Kahoot URL path calls Kahoot's API and can break | Yes, D6 (hide) |
| Host controls | No extra time, no pause, no autoplay, kick only in the lobby | Medium | S for kick, M for pause and extend (the timer is client-side on the host; the server clock is separate) | No |
| Preview | No host plus phone preview or demo launch | Medium | M. A test game with the author as host and a built-in player view | No |
| Media | One image per question; no video, audio, GIF or answer images | Medium | M for audio and answer images, L for video | Partly, `docs/uploads.md` (no media library) and `video_upload` flag |
| Folders and trash | No folders, tags, sort, or restore | Low | M | No |
| Challenge mode | No assign with deadline and leaderboard | Medium | L. Depends on saved results | Conflicts with D4 indirectly |
| Team mode, ghost mode | Absent | Low | L each | No |
| Sound | No in-game effects or question music | Low | S to M. Assets must not come from Kahoot | No |
| Nickname tools | No generator or filter | Low | S | No |
| AI generation | Absent | Low | M plus an API key and a policy | `BACKLOG.md` marks it out of scope |
| Languages | English only | Low | S per language | D10 (English for MVP) |
| Native app | Web only | Low | L | No |
| Scale evidence | Nothing above 50 players tested; one worker | Medium | S to run a 200-player socket test | No |
| Hidden but built | `/remote` second-device controller | Low | S to unhide | Yes, D15 (hide) |
| Rate limits | Closed by E16 on 5 Oct (registration 50 an hour per address) | None left | Done | Auth limit raised at François's request; Gonçalo to confirm |

## Open questions for François and Gonçalo

1. Do you want results kept? If so, is automatic save at the podium acceptable, so a host
   cannot forget, and should an anonymous host's results attach to the quiz's anonymous
   secret? This reverses D4.
2. Is late joining acceptable by default with a lock to prevent it, as in Kahoot, or should
   frogQuiz keep refusing after Start? Which scoring a late joiner gets on questions already
   played (zero) needs agreeing.
3. Should a late correct answer score near zero, as now, or half marks as Kahoot does? The
   whole ranking changes, so it should be a decision rather than a patch.
4. Should type answer, poll and slider come back, and in what order? Type answer needs
   tolerant matching before it is worth showing (open decision 4).
5. What does "findable by the team" mean once the app leaves the internet-facing VM: a
   sign-in gate on Discover, or a third visibility value? Decision 6 left this open.
6. Is copying someone else's public quiz acceptable to its author, or should only the owner be
   able to copy it? Owner-only answer keys (D18) suggest the second.
7. Should the Excel and Kahoot-URL import return, and who tests the Kahoot URL path against a
   real deck?
8. Does Gonçalo agree D16 and D18? They are still listed as waiting for his tick.
9. Who runs the 150-person load test, and what is the target? Nothing above 50 has been tried.
10. Does Gonçalo agree with the raised per-address registration and login limits (E16)?

## What could not be verified

- Every Kahoot claim rests on search excerpts of `support.kahoot.com`, which refused all
  fetches (HTTP 403). The scoring formula text, the timer range, plan tables and free-tier
  participant caps are the least certain. The 10 and 3 player figures for free accounts came
  only from third-party pages.
- Whether Kahoot lets players join after a live game has started, and whether the host
  screen shows a live per-option bar, were not found in any Kahoot excerpt.
- Which of challenges, solo play and reports are free versus paid was not clear.
- On the frogQuiz side, e2e specs were read, not run. Excel import, `.cqa` import and Kahoot URL import have
  no e2e coverage (`MVP.md` §3).
