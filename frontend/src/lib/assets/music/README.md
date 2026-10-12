<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# Music

Every sound in a game is generated, not sampled: `kit/make-kit.py` builds them from sines,
plucked and struck partials and filtered noise, so the recipe is the source and no third-party
audio is in the repo (MPL-2.0, `.reuse/dep5`). François picked kit C5 on 12 Oct: lo-fi keys,
a soft swing, the melody an octave lower than the first kit C, from five kits (A to E) and
three refinements of C.

| File | Played by | When |
| --- | --- | --- |
| `kit/lobby.wav` | `play/lobby_music.svelte` | while players join, looped |
| `kit/question.wav`, `kit/question-fast.wav` | `play/admin/tick_loop.svelte` | under a question, looped; the fast render (1.5x the tempo) takes over for the last 5 seconds |
| `kit/drumroll.wav`, `kit/fanfare.wav`, `kit/calm.wav` | `play/admin/podium_music.svelte` | the build under the places (2.6 s, ending where the winner lands), the winner, then a loop under the list |
| `kit/sfx/*.wav` | `play/sfx.ts` | one shots: `getready`, `timesup`, `reveal`, `scoreboard`, `place3`, `place2`, `place1` (host); `locked`, `correct`, `incorrect` (phone) |

All of it follows the game's one mute and volume (`play/music_pref.svelte.ts`).

## Regenerating

`python make-kit.py --kit <dir>` writes every sound of every kit as raw WAV (44.1 kHz,
deterministic: the same code gives the same bytes). The shipped files are the C5 ones, levelled
and converted with ffmpeg:

- loops to about -18 LUFS and short sounds to about -16 LUFS, peaks under -1.5 dBFS;
- mono, 24 kHz, 16-bit WAV (`-ac 1 -ar 24000 -sample_fmt s16`).

WAV rather than mp3 because a loop must repeat without a gap, and a decoder pads an mp3.
Every loop is an exact number of bars, so the wrap point is clean; check a new one by
comparing the level and the sharpest step across the seam with the rest of the loop.

## Changing a sound

Edit the recipe in `make-kit.py`, render, level and convert as above, replace the file, and
listen to the whole game once. A new sound for a new moment goes in `kit/sfx/` and into the
`Sfx` type in `play/sfx.ts`.
