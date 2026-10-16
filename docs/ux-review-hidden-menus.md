<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# UX review: menus, dialogs and drawers

16 Oct 2026. Issue #73, item "an inventory of menus, dialogs and drawers, with keyboard,
touch and focus checks".

This is a list of every overlay a person can open today, how they get to it, and what was
checked. The checks are in `frontend/e2e/overlays.e2e.ts`. Where an older spec already
proved something, the table names it and the new spec does not repeat it.

## What ran

`E2E_CHROME=... bash e2e/run.sh e2e/overlays.e2e.ts --reporter=list`, twice, on Chromium
at the default 1280x720 and, where the table says 390, at 390x844 with a touch screen.
Both runs: 35 passed, 0 failed, 0 flaky, about 2.4 minutes each. Three of the 35 are
`test.fail(...)` markers for the findings below, so they count as passed while the bug is
there. Prettier and ESLint are clean on the file.

Not run: Firefox and WebKit (the suite drives Chromium only), a screen reader, and any
real phone. "Touch" below means Chromium with touch emulation, not a finger.

## The contract

Each overlay is opened from its real trigger, with the keyboard (focus the trigger, press
Enter), and held to this:

1. It is a `dialog` or `alertdialog` with an accessible name.
2. Focus moves into it. For a destructive confirmation, the confirm button is not the
   element that holds the focus.
3. Twelve presses of Tab and twelve of Shift+Tab never leave it.
4. Escape closes it.
5. Focus goes back to the trigger. Where nothing opened it, the spec records where focus
   went instead.

The spec also has four small fake dialogs, each built wrong in one way (no trap, no
focus return, confirm focused first, and one built right). The contract has to fail on the
three and pass on the one. Without that, a green check proves little.

## The table

Keyboard column: the checks are the five points above, in order (role and name, focus in,
Tab trap, Escape, focus back). "all" means all five passed. Touch column: "trigger" is the
trigger's own size, "inside" is the size of every control in the open dialog, measured at
390 with the fq-touch-target expansion counted, the same way `touch-targets.e2e.ts` does.

| Overlay | File | How a user reaches it | Keyboard | Touch | Verdict |
| --- | --- | --- | --- | --- | --- |
| Navbar menu (Sheet) | `lib/navbar.svelte:171` | Below 768px: "Open menu" button in the navbar, on any page with the navbar | all. Opens on "frogQuiz home" link. `overlays` > navbar menu | trigger and drawer: `touch-targets.e2e.ts` ("menu drawer") | ok |
| Command palette | `lib/components/commandpalette.svelte` | Ctrl/Cmd+K on any page. No visible button. My Quizzes shows a one-time notice, with a fine pointer only | Escape closes. Tab stays (it is bound to autocomplete). No dialog role, no name, field not focused when something else has focus. See findings 1 and 2 | Not reachable on a phone | finding |
| Create a quiz | `lib/components/CreateQuizDialog.svelte` | Navbar "Create a quiz" (desktop); Menu > "Create a quiz" (phone); the same link on Home and My Quizzes | all, on the desktop link. Opens on "Start from scratch". Import step: all, focus goes back to the link. Phone path: opens with focus inside and Escape closes; where focus lands afterwards is not asserted (the menu item that opened it is gone) | inside: clean | ok |
| Download | `lib/components/DownloadQuiz.svelte` | View page "Download" (owner); My Quizzes row, icon button "Download" | all, from both triggers. Opens on Cancel | trigger: `touch-targets.e2e.ts` (view page, My Quizzes). inside: clean | ok |
| Start game | `lib/dashboard/start_game.svelte` | View page "Play". Same component on My Quizzes and in the editor, not repeated | all. Opens on "Start game". Role, name and Escape were already in `start-dialog.e2e.ts` | trigger: `touch-targets.e2e.ts`. inside: "Game options" row 36px, three switches about 54x32. Finding 4 | finding |
| Claim prompt | `lib/components/ClaimPrompt.svelte` | Opens by itself after sign-in, when this browser holds quizzes made without an account | Role, name, trap, Escape: pass. Opens on "Not now" (also in `claim.e2e.ts`). No trigger: focus goes to the page body after Escape, by design | taps in `claim.e2e.ts`; sizes not measured | ok |
| ConfirmAction: My Quizzes delete | `lib/components/ConfirmAction.svelte`, used in `routes/my-quizzes/+page.svelte:335` | My Quizzes row, trash icon (name "Delete") | all. Opens on the panel, not on Delete. Quiz still exists after Escape | trigger: `touch-targets.e2e.ts` (My Quizzes). inside: clean | ok |
| ConfirmAction: Leave game (player) | same, `routes/play/+page.svelte:325` | Player phone, in the lobby: "Leave game" | all. Opens on the panel | trigger: `touch-targets.e2e.ts` (lobby). inside: clean | ok |
| ConfirmAction: Cancel game (host lobby) | same, `lib/play/admin/game_not_started.svelte:106` | Host lobby, top left: "Cancel game" | all. Opens on the panel | Not measured. The host screen is a laptop or projector | ok |
| ConfirmAction: End game (host) | same, `lib/play/admin/controls.svelte:94` | Host, during a game: "End game" | all. Opens on the panel | Not measured, same reason | ok |
| View page delete | `routes/view/[quiz_id]/+page.svelte:512` | View page, owner: "Delete" | all. Opens on the panel. Quiz still exists after Escape | trigger: `touch-targets.e2e.ts`. inside: clean | ok |
| Editor: Add new question | `lib/editor/AddNewQuestionPopup.svelte` | Editor: "Add new question" | all. Opens on Close | trigger: `touch-targets.e2e.ts` (editor). inside: clean | ok |
| Editor: uploader | `lib/editor/uploader.svelte:256` | Editor, open card: "Add an image". Only the Image type is enabled, so the type picker is skipped | all. Opens on Uppy's "choose a file". The Tab trap holds with Uppy's own inside it | Not measured. Uppy draws it | ok |
| Editor: delete question | `lib/editor/question-card.svelte:413` | Editor, open card footer: trash icon "Delete question" | all. Opens on the panel. Both questions still there after Escape | trigger: `touch-targets.e2e.ts`. inside: clean | ok |
| Editor: Advanced settings | `lib/editor/question-card.svelte:456` | Editor, open card: gear icon "Advanced settings" | all. Opens on the switch. Role, name and Escape were already in `editor.e2e.ts` | trigger: `touch-targets.e2e.ts`. inside: the switch is about 54x32. Finding 4 | finding |
| Editor: full-screen image | `lib/editor/MediaComponent.svelte:118` | Click the question image. Same component on the host's question and the player's | With a mouse: all but focus return (the image cannot hold focus; it lands on `main`). With the keyboard: cannot be opened. Finding 3 | Opens on tap in principle (it is a click handler); not tapped in a test | finding |
| Editor: save conflict | `lib/editor.svelte:863` | Appears by itself when another tab or device saved first | Role, name, trap: pass. Escape does nothing, by design, so it was checked to stay open. Opens on the panel, so "Keep mine" (which overwrites) does not hold the focus. The two buttons are in `editor-conflict.e2e.ts` | Not measured | ok |
| Account: revoke an agent key | `routes/account/settings/agent-keys.svelte:280` | My Account > AI agents: "Revoke <key name>" | all. Opens on the panel | inside: clean | ok |
| Account: delete account | `routes/account/settings/delete-account.svelte:106` | My Account, last card: "Delete account" | all. Opens on the panel. The destructive button stays off until the email is typed | trigger: `touch-targets.e2e.ts`. inside: clean | ok |
| Lobby: full-screen QR | `lib/play/admin/game_not_started.svelte:250` | Host lobby: tap or press the QR code | all. Opens on Close. Escape and focus return were already in `game-exits.e2e.ts` | Not measured. Projector | ok |
| Command palette notice | `lib/components/popover/smalltop.svelte`, from `commandpalettenotice.svelte` | My Quizzes, first visit, only with a fine pointer, once per 30 days | Not checked. It is a non-modal `role="alert"` toast with a Close button named "Close", not a dialog, so the contract does not apply | Not shown on touch devices | deferred |

Reading the "Opens on the panel" entries: for an alertdialog, the library puts focus on
the dialog panel itself, not on a button. A screen reader reads the title and text, and the
first Tab lands on Cancel. The destructive button is never first. That is the safe order,
and it is why the "confirm is not focused" check passes everywhere it was asked.

## Findings

1. **The command palette is not a dialog.** `lib/components/commandpalette.svelte:217-221`
   wraps the whole panel in a `div` with `role="button"` and `aria-label="Close"`. A screen
   reader announces one button named Close with a text field inside it. The field
   (`:233-239`) has no label, and the result rows (`:251-252`) are `role="button"` with
   `tabindex="-2"`, so Tab never reaches them (arrow keys do, which works). Marked
   `test.fail`: "it is a named dialog". Fix: a `Dialog` like the others, with a labeled field.
2. **Ctrl+K leaves the field unfocused when anything else has focus.**
   `commandpalette.svelte:238` relies on `autofocus`. Svelte only focuses an `autofocus`
   element if `document.body` is the active element (`svelte/src/internal/client/dom/elements/misc.js`,
   `autofocus`). After a Tab or a click on a button, the palette opens and typing goes to the
   page behind it. Marked `test.fail`: "Ctrl+K from a focused element puts the cursor in the
   search field". Fix: call `focus()` on the field in an effect when `open` becomes true.
3. **The full-screen image cannot be opened from the keyboard.**
   `lib/editor/MediaComponent.svelte:90-95` is an `<img onclick>` with no role, no
   `tabindex` and no key handler. The dialog it opens is fine; the way in is mouse and touch
   only. Marked `test.fail`: "the image can be opened from the keyboard". It is the same
   component for the host's question image and the player's. Fix: wrap it in a button.
4. **Switches and one fold row are under 44px on a phone.** Measured at 390 with touch
   emulation: "Game options" (`start_game.svelte:241`) is 310x36, and every `Switch`
   (`ui/switch/switch.svelte:22`, expansion `after:-inset-y-2` on an 18.4px track) is about
   54x32. That is the three in Start game and the one in Advanced settings. They are
   written down in `KNOWN` in the touch test, which stays green while they exist and goes
   red when one is fixed. Issue #24's bar is 44x44. Fix: `after:-inset-y-3.5` or similar on
   the switch, and `fq-touch-target relative` on the fold row.

No finding on the other overlays: all the dialogs built on the shadcn `Dialog`,
`AlertDialog` and `Sheet` hold focus, close on Escape and give focus back, including the
ones that have no `Trigger` component and open from an `onclick` (Download, Start game,
Create a quiz, Advanced settings, the QR code). The library restores focus to whatever had
it before.

## Out of scope

- **Tippy tooltips.** `svelte-tippy` and `@felte/reporter-tippy` are imported in
  `lib/view_quiz/RatingComponent.svelte`, `lib/view_quiz/imported_or_not.svelte`,
  `lib/editor/TextEditorPart.svelte`, `routes/user/[user_id]/+page.svelte` and
  `routes/account/register/+page.svelte`. None is reachable: the register page redirects to
  login in its load function, and `/user` is in the hidden list. I did not trace the other
  three imports to the end, so "unreachable" for them rests on that list and on the earlier
  grep, not on a run.
- **Hidden routes** in `frontend/src/lib/hidden_routes.ts`: `/quiztivity`, `/controller`,
  `/account/controllers`, `/account/settings/security`, `/account/settings/avatar`, the
  docs pages other than the legal ones, `/import`, `/results`, `/edit/files`,
  `/dashboard/files`, `/edit/videos`, `/remote`, `/user`. Any overlay on them was not looked at.
- **The uploader's Library and Pixabay panes.** Both are off (`library_enabled` and
  `pixabay_enabled` are false in `question-card.svelte`), so only the Image pane is reachable.
- **Uppy's own internals.** Its Dashboard is a third-party widget. Focus inside it was only
  checked to stay inside the frogQuiz dialog.
- **Dialogs behind states the suite cannot reach cheaply:** the error states inside Start
  game, Download and the claim prompt (a failed request), and the "some quizzes were kept"
  summary of the claim prompt.
- **Dark mode, reduced motion and screen readers.** Nothing here was run with a screen
  reader or checked for contrast inside the dialogs; `pnpm test` covers token contrast.
