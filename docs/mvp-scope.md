<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# What the MVP includes, and what was cut

frogQuiz is a fork of ClassQuiz, which was built as a public multi-tenant product.
We are building an internal Kahoot-style tool for one team. That gap is the reason
for everything on this page: most of what was cut is not broken, it is simply
surface we would have to design, test and support for no one.

Two rules govern every cut here.

1. **Nothing is deleted** — with one exception, called out rather than buried.
   Every cut is a flag, a route guard, or an entry removed from a picker. The code
   stays in the tree, the database columns stay, and content created before the cut
   still opens and still plays. Each section below says exactly how to turn the
   thing back on. **The exception is [Languages](#languages): 33 locale files were
   actually removed from the tree.** They are recoverable from git history and from
   upstream, and restoring one is a JSON file plus a line, but that cut does not
   follow the same rule as the others and should not be read as if it does.
2. **Cuts are a joint decision.** `CLAUDE.md` is explicit that removing a feature
   that exists on master is François and Gonçalo's call together, never Claude's.
   This document exists so that decision can be made against the real cost rather
   than a guess. Anything below marked **open** has not been agreed by both.

---

## Question types

The data model has seven question types. The editor offers two.

| Type | In the picker | Renderer | Scoring | Existing quizzes |
| --- | --- | --- | --- | --- |
| `ABCD` | **yes** | kept | kept | play |
| `CHECK` (select several) | **yes** | kept | kept | play |
| `RANGE` (guess a number on a slider) | no | kept | kept | play |
| `TEXT` (type the answer) | no | kept | kept | play |
| `VOTING` (poll, no right answer) | no | kept | kept | play |
| `ORDER` (put in sequence) | no | kept | kept | play |
| `SLIDE` (content, not a question) | no | kept | n/a | play |

**The cut is the picker only.** `QuizQuestionType` still has all seven members,
every renderer and every scoring branch is still there, and nothing validates a
stored quiz against the shortened list. A quiz containing a `RANGE` question opens
in the editor and plays in a live game exactly as before. What changed is that
`frontend/src/lib/editor/AddNewQuestionPopup.svelte` offers two entries instead of
seven, and the "add slide" button — `SLIDE`'s only entry point — is gone.

### Why these five

Each cut type is not one feature but four: an editor panel, a player screen, a host
screen, and a scoring branch, each of which has to be designed, made accessible,
tested on a phone and supported. None of them is what a team runs a live quiz for.
Concretely:

- `VOTING` has no right answer, so it scores nothing and produces no movement on
  the leaderboard. It is a poll wearing a quiz's clothes.
- `ORDER` and `RANGE` need drag and slider interactions that have to work under
  time pressure on a phone. That is real interaction design, not a renderer.
- `TEXT` needs answer matching. The current implementation is exact string
  comparison with an optional case flag, which fails every near-miss a real room
  produces ("H2O" vs "water", a trailing space, a typo).
- `SLIDE` is a content page in the middle of a scored game. It is the feature that
  makes a quiz tool into a presentation tool.

**True/false needs no type of its own.** It is an `ABCD` question with two answers.
The seed quiz in `shots/review/seed.mjs` includes one.

### What is still reachable

`CHECK` stayed, so the MVP has two ways to ask a question. The interview that drove
this scope recorded `CHECK` as optional rather than required — **this is open**, and
it is the one type where reasonable people disagree. The argument for keeping it is
that "select all that apply" is a genuinely different question, and it reuses the
`ABCD` editor and renderers almost entirely. The argument for cutting it is that it
is a second thing to test for one extra question shape.

`CHECK` scoring is **all or nothing**, which was implemented and documented nowhere
until now. A player submits the indices of every option they ticked, concatenated in
ascending order, so ticking the first and third of four options sends `"02"`. The
backend builds the same string from the options marked right and compares the two
whole. A partly correct set scores zero, and so does a correct set with one extra
tick. There is no partial credit, deliberately: a room cannot reason about a score
it cannot predict, and half marks make "select all that apply" pay off for ticking
everything. See the docstring on `check_check_question` in
`frogquiz/socket_server/helpers.py` and the test that pins it.

The format stays unambiguous only while a question has fewer than ten options, which
the editor enforces by capping a question at four answers.

### The Kahoot importer is not a back door

`frogquiz/kahoot_importer/import_quiz.py` was worth checking, because it writes
questions straight to the database without going through the editor. It only ever
produced `ABCD`, by relying on the model default. It now says so explicitly
(`type=QuizQuestionType.ABCD`) and a test asserts it, so the guarantee survives
somebody changing that default later.

Two things were fixed there at the same time. It used to stamp a hardcoded
four-colour palette — the old green and brown one — onto every imported answer,
which meant imported quizzes kept looking like the pre-redesign app no matter what
the design did, and raised `IndexError` on any question with more than four
choices. And a Kahoot deck mixes scored questions with surveys and polls, which
have choices but mark none of them correct; imported as `ABCD` those became rounds
nobody can score, so they are now skipped.

### Turning a type back on

Add an entry to `question_types` in `AddNewQuestionPopup.svelte`. Nothing else is
required for it to be creatable, because nothing else was removed. Before doing so,
check the type's play and results screens against the current design: they were
written for the old visual language and have not been reviewed since the redesign.

---

## Two-factor authentication (TOTP)

`ENABLE_TOTP`, default `False`.

The team signs in with a password. Company SSO is the route to a second factor, not
an authenticator app, so building out TOTP now is work that SSO would replace.

**What the flag gates is only turning TOTP on.** The login flow still honours a
secret that is already set. If the whole `/2fa` router were switched off, anyone who
had enabled TOTP before the cut would keep being asked for a code with no way to
remove it — a lockout we would have created ourselves. So:

- `POST /api/v1/users/2fa/totp`, `POST .../backup_code` and `POST .../require_password`
  return 404 while the flag is off.
- `GET .../totp` (read the status) and `DELETE .../totp` (switch it off) work
  regardless of the flag. Both already require the account password.

The UI half is gone: `/account/settings/security` 404s in `hooks.server.ts`, because
TOTP and backup codes were the only things on that page, and the "use a backup code"
button is gone from the login password step. **So the escape hatch is API-only.**
Someone stuck behind a stale TOTP prompt needs either a `DELETE` against that
endpoint with their password, or an admin to set `ENABLE_TOTP=True` long enough for
them to remove it in the UI. That is acceptable while the number of such users is
believed to be zero; if it turns out not to be, the fix is to keep the security page
reachable in a reduced form rather than to re-enable setup.

A test covers exactly this split: setup 404s, status and disable do not.

---

## QuizTivity and the box controller

`ENABLE_QUIZTIVITY` and `ENABLE_BOX_CONTROLLER`, both default `False`.

QuizTivity is a self-paced worksheet builder; the box controller pairs physical
buzzer hardware. Neither is used, and neither is part of running a live quiz.

PR #5 removed their entry points from the UI but left the API routers registered, so
every endpoint stayed live and callable by anyone who typed the URL — obscurity
rather than access control. Both routers are now conditionally mounted in
`frogquiz/__init__.py` and disappear from the OpenAPI schema too. The matching
frontend half is `DISABLED_ROUTES` in `frontend/src/hooks.server.ts`, which 404s
`/quiztivity`, `/controller` and `/account/controllers`.

**Existing QuizTivity data is unreachable while the flag is off, but not orphaned.**
The rows stay in the database, and `QuizTivity.user` is a `CASCADE` foreign key, so
deleting a user still deletes their QuizTivities — account deletion and the GDPR
route behind it are unaffected. To read or export the data, set
`ENABLE_QUIZTIVITY=True` and restart the backend.

`.env.ci` turns `ENABLE_QUIZTIVITY` on, so the eleven QuizTivity tests keep covering
that code while the feature is off in production, and so the flag itself is
exercised.

---

## Features hidden by PR #5, and where each one actually stands

Gonçalo's PR #5 hid a set of features from the UI. Hiding a link is not the same as
closing an endpoint, so each was re-checked. The picture is better than "routes left
live" suggests:

| Feature | UI | API | Verdict |
| --- | --- | --- | --- |
| Moderation | `/moderation` 404s in its loader | live, but every endpoint requires `get_current_moderator`, which checks `settings.mods` — **empty by default, so nobody passes it** | real authorisation, nothing to do |
| API keys | settings section removed | live, requires the calling user; `DELETE` was scoped to the caller in PR #9 (it used to look a key up by value alone) | user-scoped, safe |
| QuizTivity | route 404s | router unmounted behind flag | closed |
| Box controller | route 404s | router unmounted behind flag | closed |
| WebAuthn / passkeys | removed from the login method chooser and settings | router still mounted; `login.py` still offers `PASSKEY` to a user who has a credential | **open** — nobody can register a new passkey through the UI, and password login still works, so there is no lockout; but the surface is live and undesigned |
| Ratings | removed from the quiz view page | rating endpoints still live | **open** — low risk, user-scoped |
| Docs pages | index trimmed (tos, privacy, self-host, roadmap, develop) | n/a | the pages still exist at their URLs; the ToS in particular is linked from registration |

The two **open** rows are not urgent and not security holes. They are surface that
exists, is reachable by URL, and has not been designed or tested since the redesign.
Decide whether to flag-gate them the way QuizTivity was, or to accept them.

---

## OAuth is deliberately untouched

578 lines across `frogquiz/oauth/` render nothing today, because each provider is
gated behind a config value that is unset. It looks like dead code and it is not:
it is the thing company SSO would be built on, and it costs nothing to leave in
place because it is already config-gated. **Do not "clean it up".**

---

## What the MVP actually is

One sentence, so scope arguments have something to test against:

> A host creates a multiple-choice quiz, starts a game, players join on their phones
> with a PIN and a nickname, everyone answers under a timer, the room sees the answer
> distribution and the standings after each question, and a podium at the end.

Everything in that sentence is built, redesigned and has been driven end to end with
real browsers. Anything not in that sentence is a candidate for a flag.

---

## Languages

frogQuiz ships in **English only**. 33 of the 34 locale files are removed.

**Status: open.** Under rule 2 this needs François and Gonçalo to agree. It is the
one cut on this page that deleted files, so it deserves the fuller argument.

### What was there

| | |
| --- | --- |
| Locale files on disk | 34 (`frontend/src/lib/i18n/locales/*.json`), 14,266 lines |
| Actually registered in `i18n-service.ts` | 23 |
| Loaded by nothing at all | 11 |
| Language picker | A flag-and-name `<select>` in the footer, offering 22 |
| Detection | `i18next-browser-languagedetector`, ordered querystring → cookie → localStorage → **navigator** |

### Why it was cut

- **It had stopped being translation.** New keys were only ever written in English.
  Every other locale resolved them through `fallbackLng: 'en'`, so the files were a
  promise of translation the project was not keeping. Earlier in this very branch a
  new key was copied verbatim in English into 26 of them, which is the failure mode
  they invite.
- **The detector was a live hazard, not just dead weight.** It read `navigator` and
  `Accept-Language` before anything else, so a browser configured for Tamil got a
  Tamil UI — half-translated, against whichever keys happened to exist — off a
  header nobody set deliberately. The RTL branch in the root layout flipped document
  direction on the same evidence.
- **It hid a hydration mismatch.** The server rendered `'en'` while the client read
  `localStorage`, so the first client render could disagree with the server's.

### What was kept

The `$t()` indirection stays. Collapsing it means inlining several hundred call
sites across 44 routes for no user-visible gain. Keeping it means every string is
still in one file, and the cut stays cheap to reverse.

### How to turn a language back on

1. Restore the locale file: `git show <commit>^:frontend/src/lib/i18n/locales/nl.json > frontend/src/lib/i18n/locales/nl.json`
   (or take a fresh one from upstream, which still has all of them).
2. Import it in `frontend/src/lib/i18n/i18n-service.ts` and add one
   `addResourceBundle` line.
3. Remove the pinned `lng: 'en'` so the language can vary at all.
4. Only if you want automatic detection back: re-add `i18next-browser-languagedetector`
   to `package.json` and `.use()` it. Consider dropping `navigator` from the
   detection order — that is the part that produced a surprise UI.
5. If the language is RTL, restore the `rtl_languages` branch in
   `frontend/src/routes/+layout.svelte`.

A picker would also need rebuilding; `frontend/src/lib/language-toggle.svelte` is in
git history.

### What this does not affect

Nothing is lost for users: no stored content is in a locale, quiz text is whatever
the author typed, and the backend has no language coupling at all — the only hits
are an unused `locale` field on the Google OAuth payload and Kahoot's own API
schema, which has to keep matching Kahoot.

The upstream translators keep their credit on `/docs/attribution`, which now says
plainly that their work is in ClassQuiz rather than implying they translated this.

---

## Open decisions

Collected so they can be settled in one pass rather than rediscovered:

1. **`CHECK`** — keep the second question type, or go to `ABCD` only? Currently kept
   and now working correctly.
2. **WebAuthn and ratings** — flag-gate like QuizTivity, or accept the live surface?
3. **The published contact address.** The terms of service, `CONTACT.md` and
   `CONTRIBUTING.md` all publish `francois.prevot@frog.co` as the abuse-report and
   GDPR data-deletion route. That is a personal mailbox standing in for a team
   channel, and a GDPR deletion route that depends on one person reading their mail
   is a commitment the team is making without a rota behind it. Each site carries a
   TODO. Replace with a shared channel before anyone outside the team uses this.
4. **The five cut question types** — confirm with Gonçalo, per `CLAUDE.md`.
5. **English only, and the 33 deleted locale files** — same rule, and the one cut on
   this page that removed files from the tree rather than gating them. See
   [Languages](#languages) for the argument and for how to restore any one of them.
