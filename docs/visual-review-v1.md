<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# V1 visual review

One section per step of [`v1-plan.md`](v1-plan.md).

## How to capture

1. Run `VISUAL=1 bash e2e/run.sh e2e/visual.e2e.ts`.
2. The shots and `manifest.json` land in `e2e/.data/visual/`, which is git-ignored.
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

_Pending._
