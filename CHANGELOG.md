# Changelog

All notable changes made during Claude-assisted work on FrogQuiz are logged here, most recent first.

## Unreleased

- **Fixed the host screen crashing during every question.** `play/admin/question.svelte` iterated answers with `{#each ... as answer}` but referenced an index `i` four times inside the loop, throwing `ReferenceError: i is not defined` on render. The projector screen silently fell back to the quiz title, so nobody in the room could read the question or the answer options for the whole round. One missing index binding.
- Marked the answer shape images decorative (`alt=""`) so screen readers announce the answer text rather than "icon".
- Pinned `@lucide/svelte` to 1.42.0 and `bits-ui` to 2.19.0. The Docker build runs pnpm 11.6, which enforces a 24-hour minimum release age on lockfile entries; both packages had been published the day before and failed `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Pinned exactly rather than with a caret, since a range would resolve straight back to the fresh release, and the policy itself was left alone — it is there to catch compromised packages that get yanked quickly.
- Added the ambient background layer (`lib/components/AmbientBackground.svelte`): the brand rainbow as small, heavily blurred smudges scattered towards the page edges, which is how frogConvert actually spends that palette. Mounted once in the root layout.
- Made `body` transparent so that layer is visible. `html` keeps the `--background` token, so the page ground is unchanged; a `body` background would have painted over any negative-z-index element.
- Fixed `backend_lint`, which has been failing on master since b478a50: making email sending synchronous left `BackgroundTasks` imported but unused in `frogquiz/routers/users/__init__.py`, and flake8 treats F401 as a build stopper.
- Removed Sentry entirely. The backend still imported `sentry_sdk`, initialised it whenever a DSN was configured, and ran an HTTP middleware that attached the full request (URL and headers) to every captured exception before shipping it. It was dormant only because no DSN happened to be set. Gone from `frogquiz/__init__.py`, the `sentry_dsn` setting, the `sentry-sdk` dependency, `VITE_SENTRY`, and the self-host docs.
- Corrected the privacy policy, which claimed frogQuiz used a GlitchTip instance for error logging and Plausible for usage data. Neither is true: there is now no analytics and nothing is reported to a third party.
- Replaced the Marck Script cursive wordmark with a proper lockup: a rainbow-gradient mark plus "frogQuiz" set in Inter (`lib/components/Wordmark.svelte`). The `.marck-script` class is kept for its 14 call sites but no longer loads a script face.
- Replaced every hand-inlined Heroicons SVG in the navbar and landing page with Lucide icons. Several had `stroke="#000000"` hardcoded and were invisible in dark mode.
- Rebuilt the front page around what people actually come to it for: entering a game PIN. The marketing sections ("1. Get a quiz", "2. Play the quiz", "Why frogQuiz?") were upstream's public-site pitch and are gone; the page went from 316 lines to 95.
- Removed the landing page's screenshots, which showed a ClassQuiz-era UI that no longer exists.
- Quietened the landing icon chips (they were saturated `bg-lime-500`/`bg-emerald-300` squares) and fixed the type hierarchy so large headings carry less weight, not more.
- Raised the base radius to 0.875rem and added breathing room and layered shadow depth.
- Fixed a stray vertical rule on the landing cards, left over from a two-column layout that had been collapsed to one.
- Fixed the home page having two `<title>` tags, and meta descriptions still pitching frogQuiz as "like KAHOOT!, but open-source".
- Documented in `CLAUDE.md` what a full removal of Explore or Search would actually involve, including the Meilisearch write paths in quiz create/edit/import. Nothing was removed — both are kept.
- Replaced the error pages with a branded shadcn card (status, plain-language message, Home / Try again). They previously rendered a cat meme fetched from `http.cat` on every error, which was both off-brand and a third-party request telling an outside service that our users had hit an error.
- Rewrote the landing page copy for an internal tool, and dropped three claims that are simply untrue for our deployment: "German Server" (hosted by netcup), "Community-driven" (funded by its community) and "Completely Cost Free" (no paid plans, donations appreciated).
- Fixed the registration form showing every field outlined in red on first load: the check was `$errors.field !== null`, and the pristine value is `undefined`, so the error styling was always on.
- Fixed the "Changes you made may not be saved" browser prompt firing on every navigation away from `/play`, even from an untouched join screen — it is now armed only once a player has actually joined a game.
- Removed the last live `plausible()` calls (game join, game start, hashcash) and the shim in `app.html` that was swallowing them. Plausible itself was removed in PR #5; the calls would otherwise throw against an undefined global.
- Fixed three wrong flags in the language picker: English showed 🇺🇲 (US Minor Outlying Islands), Hebrew showed 🇯🇵 (Japan) and Traditional Chinese showed 🇨🇳. Language names now use endonyms throughout.
- Pointed the shared brown/gray buttons at the shadcn Button, which moves 30 call sites off the hardcoded `#B07156` brown in one step without touching them.
- Moved the page ground onto the `--background` token, removing the hardcoded `#d6edc9` / `#4e6e58` greens from the root layout.
- Tokenised the footer, the language select and the game-PIN inputs, which were hardcoded to colours that were invisible in dark mode.
- Swapped the shadcn theme from green back to neutral zinc, so `--primary` is near-black rather than the brand green.
- Set up shadcn-svelte 1.6.1 as the redesign component system: added `frontend/components.json` (style `vega`, base colour `zinc`, theme `green`, Lucide icons, Inter), the `cn` helper at `$lib/utils.ts`, and the first components (button, input, label, card, badge, separator) under `$lib/components/ui/`.
- Applied the shadcn design tokens and canonical base layer to `app.css`, replacing the pale-green `#d6edc9` page ground with `--background`; the existing SPDX header, tippy imports, `@config` link and legacy `@utility` blocks were preserved.
- Rebuilt the login page on shadcn-svelte Card/Input/Label/Button as the reference page for the redesign, replacing the hand-rolled floating-label input with a real `Label` + `Input` pair.
- Fixed the horizontal scrollbar present on every page: the navbar and footer used `w-screen` (`100vw`), which includes the vertical scrollbar's width and so overflowed by ~15px.
- Migrated the navbar chrome off hardcoded colours (`bg-white/70`, `text-black`, `btn-nav`'s `text-gray-600`) onto theme tokens, so it no longer renders as a white bar with an invisible wordmark in dark mode.
- Pinned pnpm 10 for the frontend (the repo's lockfile is v9; pnpm 12 wanted to rewrite it).
- Fixed the light/dark theme toggle, which had silently done nothing since the Tailwind v4 upgrade: `tailwind.config.cjs` (holding `darkMode: 'class'`) was no longer being loaded, so all 319 `dark:` utilities compiled against the OS `prefers-color-scheme` setting instead of the `.dark` class the app actually toggles. Re-linked the config from `app.css` with `@config`.
- Fixed the brand green, lost in the same regression: `green-600` had reverted to stock Tailwind green instead of `#009444` across the 15 places it is used.
- Added a pre-paint theme script to `app.html` so dark mode no longer flashes light on load, now that the theme depends on a class set by JS rather than a media query.
- Created `CLAUDE.md` with project scope, feature triage policy, licensing rules, and collaboration workflow.
- Created this changelog and wired automatic logging into `CLAUDE.md`.
- Fixed mobile nav GitHub link, which still pointed at the upstream ClassQuiz repo.
- Hid Ratings (like/dislike) from the public quiz view page.
- Hid the Moderation panel (route now 404s; backend untouched).
- Hid box-controller hardware pairing: removed its link from account settings, removed the "frogQuizControllers" toggle from the start-game popup (routes/backend untouched, now unreachable from the UI).
- Hid Quiztivity: removed "Create Quiztivity" from the command palette and stopped fetching/listing quiztivities on the dashboard (routes/backend untouched).
- Hid API keys management from account settings.
- Hid WebAuthn/passkeys: removed the security-key section from account security settings and the passkey option from the login method selector.
- Trimmed the docs index to only link pages relevant to kept features (Kahoot import, Features); privacy-policy/tos/self-host/roadmap/develop/attribution/pow are now unlinked but still reachable by direct URL.
- Documented that OAuth login buttons (Google/GitHub/custom OIDC) are intentionally left unconfigured in `docker-compose.yml`.
- **Removed** (not just hidden, for data-privacy reasons) the newsletter signup form on the homepage — it posted visitor emails/names to `newsletter.mawoka.eu`, the original maintainer's own service.
- Removed the Plausible analytics script and Sentry error-reporting call, both of which pointed at the original maintainer's own external infrastructure.
- Fixed `frontend/Dockerfile`'s `API_URL` default, which was `https://mawoka.eu` — a live risk if the image were ever run without an explicit override. Also removed a stale Mapbox comment and a commented-out Sentry DSN example pointing at the maintainer's own error tracker.
- Removed the quiz-report mailto link (pointed at the original maintainer's email) and the import-template download link (hosted on the original maintainer's blog subdomain) pending internal replacements.
- Replaced the transactional email footer's UTM-tracked link to the original maintainer's site with plain text.
- Updated `CONTACT.md`, `CONTRIBUTING.md`, and the ToS page's contact/abuse-report/data-deletion mentions to point at internal placeholders (marked with TODOs — need the team's actual contact channel).
- Added an "Upstream independence" principle to `CLAUDE.md` covering all of the above, going forward.
