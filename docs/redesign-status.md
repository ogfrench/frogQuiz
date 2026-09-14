<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# Redesign status, surface by surface

What has been redesigned, what has not, and why. Scope decisions are in
[`mvp-scope.md`](mvp-scope.md); this page is only about visual and interaction
work. 44 routes exist. Five are done.

The bar for "done" here is deliberately high, because the cheap version of this
table is worthless: **redesigned, then driven in a real browser at 390, 834 and
1440, in a real three-player game where that applies, with no horizontal
overflow at any width.** Anything less is in one of the other tables.

---

## Done

| Surface | Route | What changed |
| --- | --- | --- |
| Host lobby | `/admin` | One centred composition: giant join code, QR beside it, animated player chips, kick as a labelled button |
| Host question | `/admin` | Rebuilt; was the only game surface missing `fq-stage`, so it sat flush against the top of the projector with the bottom half empty |
| Per-question results | `/admin` | Horizontal bars replacing vertical ones whose 45°-rotated labels collided; correct row marked with a tick and a ring |
| Podium | `/admin` | Three-place podium building 3rd→2nd→1st, winner highlighted, confetti timed to their arrival; viewport-scaled blocks |
| Player join and answer | `/play` | Answer tiles with shape, colour and pressable body; "you're in" confirmation; locked-in and time's-up states |
| Editor | `/edit` | Canvas shows the real game tiles; question navigation in the shell at every width; measure-capped canvas |
| Dashboard | `/dashboard` | Contained list, Play as the one prominent action, public/private badge, question count, real empty state |
| Login | `/account/login` | Both steps on shadcn Label/Input/Button |

Two cross-cutting systems came out of this and now apply to every surface above:

- **Answer palette** — four pastel hues in `src/lib/play/answer_colors.ts`, derived
  in OKLCH and validated for colour-vision separation. Was the same hex array
  copy-pasted into six files.
- **Projector type** — `fq-display`, `fq-answer`, `fq-meta`, `fq-pin` in `app.css`,
  clamped vw. Replaced breakpoint ladders that stopped growing at 768px, roughly
  where a projector starts.
- **Spacing** — `fq-stage` / `fq-section` and `--fq-space-*`.

---

## In scope, not done

These are MVP surfaces. A host or player passes through them to run a quiz, and
they still look like upstream ClassQuiz.

| Surface | Route | Why it matters |
| --- | --- | --- |
| Landing page | `/` | First thing anyone sees |
| Register | `/account/register` | Open registration is the MVP decision, so this is the front door |
| Results history | `/results`, `/results/[result_id]` | Where a host goes after a game |
| Create quiz | `/create` | Entry point to the editor |
| Kahoot import | `/import` | Import is a keeper, and the importer itself was just fixed |
| Quiz preview | `/view/[quiz_id]` | Seen before playing |
| Media library | `/dashboard/files`, `/edit/files` | Reachable from the editor's Add Media |
| Password reset | `/account/password-reset`, `/account/reset-password` | Auth path, will be hit |
| Account settings | `/account/settings`, `/account/settings/avatar` | Reachable from the dashboard toolbar |

**Recommendation, not a decision:** doing all nine to the standard above is
substantial and none of it is on the critical path. `/results/*`,
`/account/register` and `/` are the highest-traffic and worst-looking; the rest
can wait until the direction has been reviewed.

---

## Skipped, because the feature is cut

All of these 404 behind a flag or a route guard. See [`mvp-scope.md`](mvp-scope.md)
for how to turn any of them back on.

| Surface | Route |
| --- | --- |
| QuizTivity | `/quiztivity/create`, `/quiztivity/edit`, `/quiztivity/play` |
| Box controller | `/controller`, `/account/controllers/*` (4 routes) |
| TOTP and backup codes | `/account/settings/security` |
| Moderation | `/moderation` — 404s in its loader; its API is separately gated on the `mods` allowlist, which is empty |

`/remote` and `/practice` are alternate play modes nobody on the team uses. They
are not flag-gated and are not redesigned. Deciding what to do with them is open.

---

## Skipped, deliberately, while still live

| Surface | Route | Why |
| --- | --- | --- |
| Explore, Search | `/explore`, `/search` | `CLAUDE.md` is explicit that removing either is a joint François/Gonçalo decision and never Claude's. Both are live and unchanged. Redesigning them would be arguing for keeping them, which is not a call to make in a frontend branch |
| Docs | `/docs` and 7 pages under it | Read rarely. `tos` and `privacy-policy` matter legally and their contact lines have been filled in, but the pages are otherwise untouched |
| Public user page | `/user/[user_id]` | Nobody links to it internally |
| OAuth error | `/account/oauth-error` | OAuth renders nothing today, by config |
| Video editor | `/edit/videos` | Reachable only from the uploader's video path |

---

## What "verified" does and does not mean here

Worth being exact, because the phrase gets stretched:

- **Verified:** driven in Chromium via Playwright, real backend, real Postgres,
  real socket.io, three player contexts joining by PIN. Screenshots at 390, 834
  and 1440. `document.documentElement.scrollWidth > clientWidth` checked at each.
- **Not verified:** anything on the deployed site. The sandbox this work was done
  in cannot reach `frogquiz.xyz` — the egress policy blocks it — so nothing here
  describes production. Somebody has to open the real site.
- **Verified in dark mode:** the editor, at 390 and 1440. Doing this found a real
  bug rather than confirming a guess: `ckeditor5.css` sets its own text colour as a
  near-black constant, so the question title in the editor rendered black on a dark
  ground and was all but invisible. It is mapped onto the theme tokens now.
- **Not verified in dark mode:** the projector surfaces and the player screens since
  the type-scale change. They were checked in both themes when first built.
- **Not covered by tests.** There are no frontend tests, and the frontend CI job
  runs eslint only. "CI passes" is a low bar on this side of the repo.
