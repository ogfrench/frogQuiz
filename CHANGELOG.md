# Changelog

All notable changes made during Claude-assisted work on FrogQuiz are logged here, most recent first.

## Unreleased

- **Security:** added the missing authentication check to `POST /api/v1/editor/finish`. It had no auth dependency at all, so knowing the 32-bit `edit_id` was enough to write a quiz into its owner's account — reproduced against a live stack before the fix.
- **Security:** enforced the 8-character password minimum server-side on registration and password change. It had only ever existed in the register form, so the API accepted a one-character password.
- **Security:** logging out now actually ends the session. Token validation only checked signature and expiry, so a copied token stayed valid after logout; revoked tokens are now held in a Redis denylist for the remainder of their lifetime.
- **Security:** fixed a units bug that made "remember me" mint a token 60x longer-lived than a normal login (30 minutes became 30 hours).
- **Security:** auth cookies are now marked `Secure` on HTTPS deployments, derived from `ROOT_ADDRESS` so there is no extra setting to forget.
- **Security:** remember-me session keys are stored hashed rather than in plaintext, so a database read no longer hands over live sessions.
- **Security:** added Redis-backed rate limiting to login and registration, which previously had none. Controlled by `RATE_LIMIT_ENABLED` (on by default; off for test runs).
- Made an unreachable MeiliSearch non-fatal at startup. It previously aborted boot, so a search outage took the live game loop down with it.
- Fixed `CORS_ORIGINS` so the documented comma-separated form works. It raised before the validator ran, leaving only the JSON-list form functional — the setting the Netlify split-hosting depends on.
- Added `validate_email_deliverability` so deployments on internal-only mail domains can skip registration's live DNS/MX lookup. Default unchanged.
- Declared `databases` in the `Pipfile`; it is imported directly but only resolved via the lockfile.
- Wrapped raw SQL strings in two migrations in `sa.text()`, which SQLAlchemy 2.x requires — they would break on the next dependency refresh.
- Gave the dashboard's icon-only buttons accessible names, using existing translation keys. Five of eight buttons, including delete, were announced as unlabelled.
- Labelled the join screen's inputs and gave the PIN field autofocus and `autocomplete="one-time-code"`.
- Finished removing passkeys: setup was already gone, but the login path remained, so a passkey could be used to sign in while none could be registered.
- Removed a stray `console.log` shipping in the OAuth login block.
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
