<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# Frog avatars

The frog each player is given in a live game. The game picks one by seat number
(`src/lib/play/avatars.svelte.ts`); which seat gets which file is explained there.

## Source and licence

|                  |                                                                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Work             | Adventure Frog — Hand Drawn Animated Character                                                                                                                                                     |
| Author           | [intellikat](https://intellikat.itch.io/)                                                                                                                                                          |
| Source           | <https://intellikat.itch.io/frog-adventure-character-spritesheet>                                                                                                                                  |
| Released         | 25 August 2023                                                                                                                                                                                     |
| Licence          | [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/) (CC BY 4.0), as stated on the itch.io page ("Asset license"); full text in `LICENSES/CC-BY-4.0.txt` |
| Page also states | "No generative AI was used"                                                                                                                                                                        |
| Downloaded       | 8 October 2026, `adventure_frog_spritesheet-512px.png`                                                                                                                                             |
| SHA-256          | `fa9c02f44ba0afd1b64e1708a4eb82262be2c13f92104700bdc09bc858b9ce1c` (PNG)                                                                                                                           |
|                  | `f414f5c7b50af9569bcb0d6ab4c63cf466dded7a41914c8981b12dc86d529635` (`adventure_frog_spritesheet.svg`, not used)                                                                                    |

These images are **not** MPL-2.0 like the rest of the repository. Their licence is
recorded for REUSE in `.reuse/dep5`. The sheet itself is not committed; the hashes are
there to confirm a re-download is the same file.

CC BY 4.0 asks for credit, a link to the licence, a note of what was changed, and no
suggestion that the author endorses us. The credit is on `/docs/attribution` (linked from
the footer) and in the repository README; the changes are below.

## What was changed

`frontend/scripts/make-frog-avatars.py` is the whole record, and regenerates this folder
from the sheet:

- 21 of the 26 character frames, each cropped to a square around the head and shoulders
  and saved as a 256 px WebP. The other frames (two near-identical idle crouches, a dead
  frog, a near-duplicate stand and a frame with the head hidden) are left out.
- On four open-mouth frames (3, 4, 5 and 7), a tongue put together from the sheet's own
  tongue pieces (the straight segment, frame 32, with the sticky tip, 34, or the round
  one, 33), at the sheet's scale and drawn from inside the mouth. Those four frames are
  also kept without it, as poses 22 to 25.
- Every pose recoloured with five hue rotations (90, 150, 200, 260 and 310 degrees), the
  same matrix as CSS `hue-rotate()`, with the pinks and reds (tongue, mouth, hat band)
  left as drawn.

Files are `frog-<colour>-<pose>.webp`: colour 0 is the art as drawn.

## History

Before 8 October 2026 this folder held 19 different frog images that had no licence on
record. They were removed rather than kept.
