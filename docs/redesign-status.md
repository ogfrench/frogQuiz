<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# Redesign status, surface by surface

What has been redesigned, what has not, and why. Scope decisions are in
[`mvp-scope.md`](mvp-scope.md); this page is only about visual and interaction
work. 44 routes exist.

The bar for "done" here is deliberately high, because the cheap version of this
table is worthless: **redesigned, then driven in a real browser at 390, 834 and
1440, in a real three-player game where that applies, with no horizontal
overflow at any width.** Anything less is in one of the other tables.

---

## Done

| Surface                | Route            | What changed                                                                                                                       |
| ---------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Host lobby             | `/admin`         | One centered composition: giant join code, QR beside it, animated player chips, kick as a labeled button. 2026-10-03: the full-screen QR is the shadcn `Dialog` with a white quiet zone; it was a `role="button"` div that Enter could not close (its handler returned a function instead of calling it) and Escape did nothing to. `game-exits` covers it |
| Host question          | `/admin`         | Rebuilt; was the only game surface missing `fq-stage`, so it sat flush against the top of the projector with the bottom half empty |
| Per-question results   | `/admin`         | Horizontal bars replacing vertical ones whose 45°-rotated labels collided; correct row marked with a tick and a ring               |
| Podium                 | `/admin`         | Three-place podium building 3rd→2nd→1st, winner highlighted, confetti timed to their arrival; viewport-scaled blocks               |
| Player join and answer | `/play`          | Answer tiles with shape, color and pressable body; "you're in" confirmation; locked-in and time's-up states                       |
| Editor                 | `/edit`          | Canvas shows the real game tiles; question navigation in the shell at every width; measure-capped canvas. 2026-10-03: Advanced settings is the shadcn `Dialog` with a `Switch` ("Skip the results", with what it does underneath), driven at 390/834/1440 in both themes; it was a fixed div with no Escape around a bare checkbox labeled "Hide question resuluts?" |
| My Quizzes             | `/my-quizzes`    | The old dashboard list, merged with the signed-out browser list 2026-09-29 (D1): one page for both states, "On this browser" with Claim when signed in, the 30-day notice and account CTA when signed out, Delete in a dialog. `/dashboard` redirects here. Verified 2026-09-29 at 390/834/1440 in both themes, signed in and out |
| Login                  | `/account/login` | Both steps on shadcn Label/Input/Button                                                                                            |
| Quiz view page         | `/view/[quiz_id]` | Header card with Start as the one primary action, owner-only Edit/Delete and answer key, expandable anonymous-quiz banner, questions drawn as read-only editor canvases. Verified 2026-09-29 at 390/834/1440 in both themes as anonymous owner, account owner and visitor. Its Download dialog has been the shadcn `Dialog` since 2026-09-29 (Excel only, MVP.md D5); driven at all six on 2026-10-03 and it fits |

| Landing | `/` | Verified clean at both widths and themes |
| Register | `/account/register` | Rebuilt on the same Card/Label/Input/Button primitives as login |
| Results history | `/results`, `/results/[result_id]` | Table rebuilt on theme tokens in an `fq-scroll-x` container; real empty state with a way out of it. Hidden since 2026-10-01 (`DISABLED_ROUTES`); the redesign predates that |
| Create | `/create` | Verified clean |
| Kahoot import | `/import` | Rebuilt as two stacking cards; styled file picker; no invalid ring on an untouched field. Hidden since 2026-10-01 (`DISABLED_ROUTES`); the redesign predates that |
| Media library | `/dashboard/files` | Verified clean. Hidden since 2026-10-01 (`DISABLED_ROUTES`); the redesign predates that |
| Password reset | `/account/password-reset`, `/account/reset-password` | Swept with import |
| Account settings | `/account/settings` | Rebuilt from `grid-cols-6` to a single column of section cards; sessions table in a scroll container, and a list below `sm` so each Delete is on screen (2026-10-03); the picture is the first letter of the username, in place of the generated cartoon face (2026-10-03) |
| Discover | `/explore` (and `/search`, a 302 into it) | Shadcn `Card` on theme tokens since Explore and Search merged. 2026-10-03: driven in a browser at 390/834/1440 in both themes across all four modes (browse, results with highlights, too short, no results), no overflow in any of the 24. Dropped upstream's verified-seal icon that every original quiz wore with a hover-only explanation; an import now says "Imported from Kahoot" in words. Search highlights are a butter tint held to AA in both themes instead of the browser's #ffff00 |
| Navbar and layout | every page with the navbar | 2026-10-03: one Log in (registration on the login page), an initial-letter avatar that opens My Account (Log out lives there), Join beside the menu button on phones, a Sheet drawer below `md`, the full bar from 768 px. Layout owns `<main>`, a skip link and the footer, which four pages used to paste in. axe reports nothing on any visible route at 390 and 1440, signed in and out. Screenshots walked: every route in light at 390 and 1440, the changed routes in dark at 390, the navbar and drawer in both themes |
| Add-question picker | `/create`, `/edit` | The type picker is the shadcn `Dialog`, opened from the button after the last card and from the empty state. 2026-10-03: driven at 390/834/1440 in both themes; it fits at all six. Type names in sentence case ("Multiple choice", "Check choice") |
| Start-game dialog | Play on `/view/[quiz_id]` and `/my-quizzes` (one component, `lib/dashboard/start_game.svelte`) | Rebuilt on shadcn `Dialog`/`Button`/`Card`/`Input`/`Label`/`Switch`; the Old-School mode picker and the (already-inert) captcha toggle were dropped, see [ogfrench/frogQuiz#16](https://github.com/ogfrench/frogQuiz/issues/16). 2026-10-03: driven from `/view` at 390/834/1440 in both themes; it fits at all six. `/my-quizzes` opens the same component. Title and button read "Start game" |
| Image uploader | the image button on a question card and on quiz setup | 2026-10-03: the hand-rolled overlay (a `role="button"` around the whole uploader, focus left on the page behind, the size rule floating on the scrim over page content) is the shadcn `Dialog`, titled "Add an image" with the size rule as its description. Uppy gets its dark theme when the app is dark, its green upload button and blue links are `--primary` and foreground, "browse" is underlined so it reads as the action, a phone is offered "Choose an image" rather than a drop zone it cannot use, and "Powered by Uppy" is off through Uppy's own option (the CSS that was meant to hide it lost on specificity). Driven at 390/834/1440 in both themes, empty and with a file added, then closed and reopened: no overflow, focus inside, no page errors |

Two cross-cutting systems came out of this and now apply to every surface above:

- **Answer palette** — four pastel hues in `src/lib/play/answer_colors.ts`, derived
  in OKLCH. Was the same hex array copy-pasted into six files. This page previously
  said the palette was "validated for color-vision separation". It is not, and an
  earlier commit in this branch corrected the same claim in the source: under
  deuteranopia coral and green differ by 4 of 255. Four hues at one lightness cannot
  be separated by a dichromat. Accessibility here rests on the shape channel, which
  `answer_colors.test.ts` now pins deliberately.
- **Projector type** — `fq-display`, `fq-answer`, `fq-meta`, `fq-pin` in `app.css`,
  clamped vw. Replaced breakpoint ladders that stopped growing at 768px, roughly
  where a projector starts.
- **Spacing** — `fq-stage` / `fq-section` and `--fq-space-*`.

---

## In scope, not done

Nothing is open here today.

`/edit/files` was reviewed and needed no change. `/view/[quiz_id]` was once listed here
as reviewed and needing no change; that was wrong. It has since been redesigned and
verified (see Done).

## Skipped, because the feature is cut

All of these 404 behind a flag or a route guard. See [`mvp-scope.md`](mvp-scope.md)
for how to turn any of them back on.

| Surface               | Route                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| QuizTivity            | `/quiztivity/create`, `/quiztivity/edit`, `/quiztivity/play`                                            |
| Box controller        | `/controller`, `/account/controllers/*` (4 routes)                                                      |
| TOTP and backup codes | `/account/settings/security`                                                                            |
| Moderation            | `/moderation` — 404s in its loader; its API is separately gated on the `mods` allowlist, which is empty |
| Public user page      | `/user/[user_id]` — hidden through `DISABLED_ROUTES` since 2026-10-01; nothing linked to it               |
| Video upload          | `/edit/videos` — hidden the same day; the uploader is always given `video_upload={false}`              |
| Custom avatars        | `/account/settings/avatar` — hidden; My Account shows the first letter of the username instead          |

`/remote` is hidden (MVP.md D15) and 404s through `DISABLED_ROUTES`. `/practice` was
kept (D3) and rebuilt on 2026-09-29: the game's answer tiles, no timer, a score at the
end. It was checked at 390, 834 and 1440 in both themes, and `e2e/practice.e2e.ts`
covers it.

---

## Skipped, deliberately, while still live

| Surface          | Route                        | Why                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs             | `/docs/attribution`, `/docs/privacy-policy`, `/docs/tos` (the index and the other pages are hidden) | Layout untouched, but the copy was not left alone: all eight carried upstream's "the open-source quiz-application" description and two described a different page entirely, two told you to `git clone mawoka-myblock/ClassQuiz`, and the attribution page credited nine named people for work on frogQuiz they never did. See the identity section below |
| OAuth error      | `/account/oauth-error`       | Layout untouched — OAuth renders nothing today, by config. Its "open an issue" link pointed at upstream's tracker and now points at ours                                                                                                                                                                                                                  |

---

## Hosting with and without an account

Both are supported end to end. The differences below are deliberate, and each was
checked against the endpoint rather than assumed — so if one of them ever looks like a
bug, this is the reason it is not.

| Capability | Signed in | Anonymous | Why |
| --- | --- | --- | --- |
| Start a game | yes | yes | `start_quiz` takes an optional user and accepts `X-Anon-Secret` in its place |
| Run the game over the socket | yes | yes | `register_as_admin` checks no user at all — admin rights come from holding the right `game_pin` + `game_id` |
| Join QR code | yes | yes | `GET /utils/qr/{pin}` has no auth dependency |
| Spreadsheet export of answers | yes | yes | `export_quiz_answers(export_token, game_pin)` has no auth dependency |
| **Save results** | yes | **no, hidden** | Every route in `routers/results.py` requires `get_current_user`, and `GameResults.user` is nullable — so an anonymous save succeeds and writes a row nobody can ever read |
| **Analytics** | yes | **no** | Same: reads go through the user-scoped results routes |

Two notes on the Save-results case. The socket handler itself only checks
`session["admin"]`, so the backend still accepts the emit — hiding the button is a
frontend decision about not writing unreachable rows, not an authorisation boundary.
And an anonymous host still gets the podium and the export, which is most of what the
save was for.

**A difference that turned out not to exist.** Planning assumed anonymous hosts would
lack a "resume lobby" card that signed-in hosts had. There is no such card for anyone —
`grep` for it across `routes/dashboard/` and `lib/dashboard/` returns nothing. Recorded
so the assumption does not come back.

---

## Identity and metadata

Not visual design, but the same class of problem: what the app says it is. All of
this was inherited from upstream and had been through a global ClassQuiz→frogQuiz
find-replace, which in two places turned other people's work into claims about this
project.

| Thing                                               | Was                                                                                                                                     | Now                                                                                                                                                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open Graph card                                     | Upstream's image: says "ClassQuiz", carries "By Mawoka" and his avatar                                                                  | Regenerated from the app's own mark. `og:image` was also _root-relative_, which crawlers will not resolve, so the card rendered imageless even after the image was right — both image tags are built from the request origin now |
| Favicon set                                         | "CQ" in upstream's chevrons                                                                                                             | Regenerated. `favicon.ico` was a PNG under an `.ico` extension; it is a real ICO wrapping the PNG                                                                                                                                |
| `twitter:image`                                     | Pointed at `opengraph-home.webp`, which was a PNG                                                                                       | Deleted the mislabelled file; both tags use the 1200×630 JPEG                                                                                                                                                                    |
| Font                                                | Never loaded — seven `@font-face` rules, seven 404s                                                                                     | All seven Inter subsets emit; `document.fonts.check` passes                                                                                                                                                                      |
| Tagline                                             | Two different ones at once: "Live quizzes for the room you are standing in" and "an internal quiz tool for running interactive quizzes" | One line in `app.html`, the manifest and `en.json`: "The free Kahoot alternative. Host interactive quizzes right from your browser."                                                                                             |
| `testimonials.svelte`                               | A real person, a real tweet URL, and quote text edited so an endorsement of ClassQuiz read as one of frogQuiz                           | Deleted. Nothing imported it, but it was one line from rendering                                                                                                                                                                 |
| `/docs/attribution`                                 | Upstream's contributor list with the same find-replace, so nine named people were credited for contributing to and translating frogQuiz | Rewritten to say the truth: frogQuiz is a fork, these people built the thing it is a fork of, their translations live upstream                                                                                                   |
| Clone URLs in `/docs/self-host` and `/docs/develop` | `git clone mawoka-myblock/ClassQuiz`                                                                                                    | `ogfrench/frogQuiz`                                                                                                                                                                                                              |

One upstream URL is deliberately kept: the box controller fetching its firmware
releases from `mawoka-myblock/ClassQuizController`. That is upstream's hardware and
upstream's firmware, so the link is correct; the feature is flag-gated off anyway.

---

## Languages

The app ships English only. See [`mvp-scope.md`](mvp-scope.md#languages) — this is a
scope decision, not a visual one, and it is **open** pending Gonçalo.

---

## What "verified" does and does not mean here

Worth being exact, because the phrase gets stretched:

- **Verified:** driven in Chromium via Playwright, real backend, real Postgres,
  real socket.io, three player contexts joining by PIN. Screenshots at 390, 834
  and 1440. `document.documentElement.scrollWidth > clientWidth` checked at each.
- **Not verified:** anything on the deployed site. The sandbox this work was done
  in cannot reach `frogquiz.xyz` — the egress policy blocks it — so nothing here
  describes production. Somebody has to open the real site.
- **Verified:** eight routes x two themes x two widths report no horizontal overflow,
  no touch target below the minimum (44px on coarse pointers, 24px otherwise) and no
  text below WCAG AA. Chasing the last of those to its cause was worth it: the
  remaining overflow was never layout, it was paint -- filters expanding an element's
  painted region past its box, and a wide table contributing paint through a scroll
  container that was itself working correctly.
- **Verified in dark mode:** the editor, at 390 and 1440. Doing this found a real
  bug rather than confirming a guess: `ckeditor5.css` sets its own text color as a
  near-black constant, so the question title in the editor rendered black on a dark
  ground and was all but invisible. It is mapped onto the theme tokens now.
- **Verified with the keyboard, from 3 Oct only.** Before then Tab did nothing on any
  page (the command palette swallowed it), so no keyboard check before that date meant
  anything. Since: Tab order on `/`, Discover, My Quizzes, `/play`, login, register, the
  quiz page and the editor; the skip link landing in `<main>`; the phone drawer trapping
  focus and returning it on Escape; joining and answering a live game with the keyboard
  alone; every rebuilt dialog closing on Escape with focus inside. The probe that flags
  "no focus ring" reads outline and box-shadow, so a tile with a decorative shadow passes
  it falsely -- the player tiles did. Check a screenshot, not just the probe.
- **Verified with axe, 4 Oct: every state of a live game.** Host lobby, question,
  results (single and multiple answer), scoreboard and podium; phone PIN step, name
  step, lobby, both question types, locked in, feedback right and wrong, and the end
  screen at first, second and third. Light and dark, no violations. The phone question
  screen was also measured at 390x664 (a phone with its toolbars) and 390x844, with and
  without questions shown on devices, with and without an image: no overflow.
- **Verified in dark mode, 4 Oct:** every host projector screen (lobby, both question
  types, both results screens, scoreboard, podium) walked by eye at 1440x900 and
  1920x1080, no overflow; the phone question screens too. axe passes every game state in
  dark as well.
- **Covered by tests now.** This line used to read "there are no frontend tests,
  and the frontend CI job runs eslint only". There are 57 under vitest and the CI
  job runs them, alongside eslint. They cover the answer palette, question
  completeness, the theme tokens, reordering and the multiple-answer wire format —
  the things with real invariants, not the things that are easy to assert.
- **Not verified: anything rendered before the font was fixed.** Inter never loaded
  in any build until late in this branch — Tailwind v4 inlines an `@import`'s text
  but leaves its relative `url(files/...)` alone, so Vite emitted no `.woff2` at all
  and every `@font-face` 404'd. Every screenshot taken for this table before that
  fix was rendered in whatever `sans-serif` aliases to, which differs per OS. The
  surfaces were re-checked at 390 and 1440 afterwards and the layouts held, but that
  is a re-check, not the original verification.
