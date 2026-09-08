# Changelog

All notable changes made during Claude-assisted work on FrogQuiz are logged here, most recent first.

## Unreleased

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
