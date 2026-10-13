# Quiz creation and claiming plan

Planning baseline: 13 October 2026. Working branch: `feature/quiz-creation`,
based on `feature/anonymous-templates` at `f5fcea65`. The existing Excel dialog
and helper are identical on both source branches. Neither source branch is deleted.

## Product decisions

- Guests can create quizzes from scratch, import Excel files, and host games.
- An account lets users keep quizzes permanently and access frog and Capgemini
  quizzes in Explore.
- Retain the existing temporary guest behavior for this iteration: 30-day expiry,
  ownership tied to a secret in the originating browser. This is temporary storage,
  not an account library. Explain browser-data loss and expiry clearly.
- Claiming requires an explicit user action. Signing in alone does not transfer
  every quiz on a potentially shared browser.
- Proposed import behavior: each confirmation creates a new draft. Preview has no
  persistence side effects. Do not append by matching an existing quiz title.
- Confirm whether the existing public example collection remains available to guests;
  do not expose the internal Explore collection to guests.

## 1. Resume claiming verification first

Read and run the existing anonymous ownership, claim race, rate limit, and claim UI
tests on clean local test infrastructure. Record actual results separately from test
coverage already present in the repository.

Acceptance cases:
- Same-browser sign-in preserves the secret and offers Keep all / Not now.
- Individual claim and Keep all move the correct quizzes to the signed-in account.
- Not now preserves the drafts and does not repeatedly prompt during that session.
- Successful claim clears expiry and anonymous ownership, preserves questions and
  images, and keeps the quiz available after a fresh account sign-in.
- Wrong or missing secrets, another browser, expiry, another account, and simultaneous
  claims cannot transfer ownership incorrectly or duplicate image accounting.
- Claim versus expiry cleanup cannot delete a newly claimed quiz.
- Offline, ended sessions, partial batch failure, and rate limits leave recoverable
  quizzes recoverable and explain what happened.
- An open editor retains unsaved text after a claim; an active game continues.

## 2. Review current screens before changing their design

Capture actual branch UI: guest My Quizzes, creation choice, Excel upload, validation
errors, successful preview, post-sign-in claim prompt, and claimed account library.
Use desktop and phone sizes. Label fixture-backed previews. Current guest creation
still says Sign in to import; the agreed scope removes that restriction.

## 3. Complete Excel creation for guests and accounts

- Define the spreadsheet contract and serve a matching downloadable template.
- Validate without saving: file limits, malformed workbooks, questions, answers,
  correct-answer selections, timers, and empty sheets; return useful row errors.
- Explicit confirmation creates one new draft using the existing ownership paths.
- Return and retain the anonymous secret for guest imports, with the same expiry
  and creation ceilings as scratch creation.
- Handle repeated clicks, failed requests, stale previews, and dialog dismissal.
- Prove an imported guest quiz can be edited, hosted, and later claimed.

## 4. Align Explore access and account messaging

Verify backend access checks as well as visible UI. Describe account value consistently
as permanent saving and access to the frog / Capgemini collection. Review existing
account-only actions against this rule before widening scope.

## 5. Finish and review

Run focused backend and frontend tests, the complete affected user journeys, type and
lint checks, and desktop/mobile visual review. Update the decision and change records.
Prepare one reviewable PR. Merging and deployment are separate steps.

## Verification in this session

- Implemented partial-claim recovery, guest/account Excel preview and creation, and
  account messaging on this branch. Imported guest ownership is stored before navigation.
- Preview has its own `/api/v1/quiz/excel-preview` URL, preventing an old API that ignores
  `dry_run` from silently persisting a quiz. Confirmation uses `/excel-import`.
- 30 workbook validation tests passed. Targeted Python and frontend lint passed.
- Frontend type check completed with 0 errors and 36 existing warnings.
- Vitest reported 17 claim/storage tests and 10 Excel request tests passing in separate
  runs. The runner hung after reporting its results and was timed out; this is not a
  clean test-suite exit. CI must verify the complete frontend suite.
- Playwright successfully registered 14 claim/import journey tests. They have not run;
  the local browser fails to start. Database integration tests are also awaiting CI.
- GitHub installation is complete. The combined branch is pushed in draft PR #67.
- The first CI run passed all 288 frontend tests, lint, type checks, audit, and CodeQL.
  Backend tests reported 330 passed and one incorrect expectation in the new access
  test: missing credentials return 401. That expectation is corrected, with wrong
  secrets separately asserted as 404. Three inherited Python lint errors are fixed.
- Database and browser checks must rerun after those fixes. Creation screenshots now
  run before the full browser suite so they can be reviewed sooner.
- The Netlify preview build failed. Production frontend compilation is now included
  in CI to provide a reproducible failure trace.
- Follow-up CI passed 331 backend tests (one skipped), all 30 workbook tests,
  backend lint, frontend lint, all 288 frontend tests, type checks, audit, and CodeQL.
- The production build exposed a query-string read in the shared creation dialog
  during prerendering of static docs. Guarded that read to run only in the browser;
  the production Netlify build now passes locally.
- Six screenshot variants passed and produced desktop, tablet, and phone dialog
  captures. Guest capture reached the creation choice; its exact accessible-name
  selector omitted the hint in the button name. Corrected that selector in both
  screenshot and guest import journey tests before rerunning.
- No merge, deployment, or production database mutation has been performed.
