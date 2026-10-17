<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# V1 visual review

One section per step of [`v1-plan.md`](v1-plan.md).

## How to capture

1. Run `VISUAL=1 bash e2e/run.sh e2e/visual.e2e.ts`.
2. The shots and `manifest.jsonl` land in `e2e/.visual/`, which is git-ignored.
3. Each shot is also checked by the spec:
   - the `.dark` class toggles
   - no horizontal overflow
   - a token background on `<html>`
   - no axe violations

## Checklist

Each item is a bug that has shipped before. See CLAUDE.md.

- No horizontal overflow at 390, 834 or 1440. Watch for `w-screen`, a grid item missing `min-w-0`, and `w-full` on a flex child.
- Nothing disappears in one theme: no hardcoded `text-black` or `bg-white`, and no fixed icon stroke.
- Full-height layouts use `h-dvh`, so nothing is pushed below the fold on a phone.
- Drawers below `lg` are solid, with a scrim and a close control inside the panel.
- Every game screen sits inside `fq-stage`, so nothing hugs the top of the projector.
- Reading and editing pages cap the measure at `max-w-2xl`.
- One accent: zinc neutrals plus `--primary`. The rainbow appears only in the mark and the answer series.
- Lucide icons, shadcn buttons and Inter, at the tiered radius.
- Touch targets are 44 px, and field text is 16 px on a phone.
- Generous whitespace, and one loud element per screen.
- No red error ring on a field nobody has touched yet.

## Findings

Columns: screen, size, theme, finding, outcome. An outcome is a fix commit, or "kept", with the reason.

### Step 0: baseline on master

The first capture covered 113 screens:
- every visible route at 390, 834 and 1440, light and dark, signed out and in
- the Start game and Download dialogs
- the mobile menu
- a three-player game, host at 1440 and 1920, phones at 390

| Screen | Size | Theme | Finding | Outcome |
| --- | --- | --- | --- | --- |
| Host question | 1440, 1920 | both | The timer ring and "N answers submitted" were squeezed into one small row between the question and the answers, with the rest of the projector empty (François, 11 Oct) | Fixed. Four designs were mocked up live, and François chose C: one wide bar above the answers that empties as time runs out, with "N of M answered" at its start and the seconds at its end. The thin rule under the controls bar stays on slides only. |
| Timer ring, phones | 390 | dark | Hardcoded white disc, gainsboro track and black number, so it read as a white sticker on the dark theme | Fixed. It now uses the `--background`, `--muted` and `--foreground` tokens, with the red its callers pass (`#ef4444`) for the arc. |
| `/account/oauth-error` | all | both | axe violation (no document title). The page is one of the four still on the old layout (`docs/redesign-status.md`). Step 0 listed only 390 and 834 in light, because of the capture gap found in step 1 | Step 5 (#44), with the other three |

**Gap found later:** this baseline missed the signed-out screens at 1440 and in dark. The capture waited at 834 for a phone menu button that is hidden from 768 up, so the rest of that loop never ran. Step 1 fixed the spec and looked at those 80 shots.

### Step 1: CI and production safety

The capture covered 168 screens: the full signed-out set (80, with the gap closed), the signed-in set, and a whole game in both themes. The gallery is a private claude.ai artifact, "frogQuiz V1 visual review", updated in place each step.

| Screen | Size | Theme | Finding | Outcome |
| --- | --- | --- | --- | --- |
| Timer ring, phones | 390 | both | The ring froze on its first frame while the number kept counting. The step 0 fix had moved the ring's background into a `style:` directive with a trailing `;`. The first value went in through the attribute, which ignores it. Every later one went through `setProperty`, which rejects the whole value | Fixed. `journey-player-phone.e2e.ts` now checks that the ring's painted background changes; it failed on the bug and passes on the fix. The ring's black frame became the page color. |
| Timer ring and host bar | 390, 1440 | both | The phone ring fills red as time is spent, while the host's drain bar empties as time runs out. The two halves of one game count in opposite directions | Fixed. François chose to make the ring drain: the red arc is the time left. `journey-player-phone.e2e.ts` checks that it shrinks |
| Every signed-out screen | 834, 1440 | both | The capture gap above | Fixed in `visual.e2e.ts` |
| `/account/oauth-error` | 390 | both | Besides the axe finding, the heading runs to the screen edge with no gutter | Step 5 (#44) |
| Host question | 1440, 1920 | both | Drain bar checked: "N of M answered", the bar and the seconds sit on one line above the answers, and no shot overflows | Kept |
| Host title card, before question 1 | 1280 | light | Found by CI's first e2e run, not by the capture, which has no shot of this screen. A title or description with no spaces ran 757 to 764px off the projector: `admin.svelte` set it at `text-7xl` with no word breaking. It predates V1. The test only caught it when CI was slow, because the long word it waited for is on this screen too | Fixed with `wrap-anywhere`, as on the question screen. `hostile-text.e2e.ts` now checks this screen on purpose, and failed before the fix. Capturing it is added to step 5 |

### Step 3a: data and concurrency

The editor's four new states were added to the capture (`editor states` in `visual.e2e.ts`): the conflict dialog, the restore offer, the deleted-quiz banner and the live-game note. The signed-in screens and the whole game were taken again, 154 shots in all. A first-pass triage by a cheaper model was checked against the shots and the code before acting on it.

| Screen | Size | Theme | Finding | Outcome |
| --- | --- | --- | --- | --- |
| Editor, conflict dialog | 390, 834, 1440 | both | "Load the other version" was blank: near-white text on a white button. The outline look was passed as a class over the default variant, which kept its text colour. Axe found it | Fixed: an outline variant proper. Axe is clean on all 24 editor-state shots |
| Editor, title and question | all | both | They used CKEditor's Helvetica stack beside Inter in every other field. Missed by the 11 Oct field-shape fix, which matched corners, border and ring but not the face | Fixed: the editable inherits the page's face |
| Editor, focused title | 834, 1440 | both | A 2px blue dot: the empty balloon of CKEditor's badge, which was hidden without its frame | Fixed: the balloon is hidden too, by a rule that wins on specificity |
| Editor, live-game note and restore offer | all | light | Read as quiet header chrome. The triage measured the note at 4.4:1, but the token test pins muted text on muted at 4.5:1 or more; the pixel reading was anti-aliasing | Kept the tokens; the note is now full-strength text, and both have plainer copy |
| Editor, quiz deleted elsewhere | all | both | The header's Save stayed the strong button, though it can only fail while the quiz is gone; "Save as a new quiz" was an outline button | Fixed: "Save as a new quiz" is the primary button |
| Host scoreboard and answers | 1440, 1920 | dark | A white card on the dark projector. Older than V1: both cards are hard-coded white with dark text, probably so they read over a quiz's own background colour or image | Step 5 decides |
| Editor, question card | 390, 834 | both | The card's inner padding is uneven, and its fields do not line up with the ones above it. Older than V1 | Step 5 |


### Step 5 (v0.9): the full capture, 16 Oct

Every screen at 390, 834 and 1440 (and the host's 1920), both themes: 192 shots
(`VISUAL_LABEL=v09`). The automated checks were clean on all of them (no horizontal
overflow, the theme class matches, the ground is a token) except axe on one page. A
first-pass triage by a cheaper model listed 25 items; each was checked against the shots,
the code or a live page before acting on it.

| Screen | Size | Theme | Finding | Outcome |
| --- | --- | --- | --- | --- |
| OAuth error | all | both | No `<title>` (axe, serious) | Fixed, and the rerun is clean |
| OAuth error | all | both | Still upstream's page: no gutter at 390, a display heading under the navbar, a raw grey "Back to login" chip with a blue tint in dark | Deferred: reached only after a failed OAuth sign-in, and V1 signs in by email. Redesign if OAuth comes back |
| Host results and scoreboard, player feedback | 390 to 1920 | dark | White cards on the dark ground | Kept: D34 |
| Privacy, Attribution | 834, 1440 | both | Blank space under the footer | Not a bug: the live page ends at its footer (scroll height 1534, footer bottom 1534 at 834). A full-page capture artifact |
| Start game, Download dialogs | all | both | The backdrop stops at the fold | Same artifact: a fixed overlay in a full-page shot |
| My Quizzes | all | both | The Ctrl+K notice covers the footer, and shows on a phone | Not on a phone: the notice skips `pointer: coarse`; the capture runs a desktop pointer at 390. On a laptop it is a one-time, dismissible toast |
| Editor | 390 | both | Play and Save about 34px | The capture's desktop pointer; `touch-targets.e2e.ts` passes with touch emulation |
| Editor, question card | 390 | both | About 40px of the card goes to the drag-handle column, so content gets about 300px | Open, low. Same as the 11 Oct row above |
| Login, settings | all | both | Two disabled styles: a mid-grey block (sign-in, Create key) and a pale chip (Join) | Fixed 17 Oct (François: the pale chip): the filled `Button` variants take the muted chip when disabled |
| Host question | 1440, 1920 | both | The timer bar is red from the start | Fixed 17 Oct (François): the host bar and the phone ring are neutral until the last 5 seconds, then red, when the music speeds up (`lib/play/last_seconds.ts`) |
| Podium | all | light | 2nd and 3rd blocks are near-white on white; gold appears in several places | Fixed 17 Oct (François): 2nd and 3rd are a neutral step off the ground with a visible edge and the same ink; the points pill is neutral, gold stays on the block and the crown |
| Player answer tiles | 390 | both | A vertical gradient on the phone where host and view pages are flat; the selected ring is faint in light | Sheen kept (François, 17 Oct: it looks more integrated). The selected ring is the foreground ink, 5px |
| Discover, settings, view page | various | both | Gutters vary from 16 to 48px between pages | Fixed 17 Oct (François): one `fq-gutter` utility, 16 / 24 / 32px, on the navbar, footer and every visible page |

The "Open, low" rows are polish, not V1 blockers. François made the five design calls on 17 Oct.
