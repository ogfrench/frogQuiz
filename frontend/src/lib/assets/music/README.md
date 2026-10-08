<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# Music

One folder per screen that plays something. Every file here is imported by exactly one
component, so a file with no importer is dead weight.

| Folder      | File                | Played by                         | Source and licence                                                                                                                                         |
| ----------- | ------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lobby/`    | `lobby.mp3`         | `lib/play/lobby_music.svelte`     | Inherited from ClassQuiz. MPL-2.0, Marlon W (Mawoka). `lobby-original.mp3` is the unreduced version; nothing imports it, kept on purpose.                   |
| `podium/`   | `podium-loop.mp3` | `lib/play/admin/podium_music.svelte`, mounted by `final_results.svelte` on the host screen only | Charpentier, Te Deum prelude, a synthesised rendering by Pracchia-78 from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Marc-Antoine_Charpentier_-_Te_Deum_H._146_prelude.ogg). Public domain, no credit required. |

## Adding a track

Put it in the folder of the screen that plays it, name it for what it is, and add a
`Files:` block to `.reuse/dep5` with its real author and licence. CC BY needs a credit on
`/docs/attribution`; CC0 does not. Check the licence on the track's own page: a pack's
licence is not always the licence of the file you took from it.

## Loudness

Every track sits at about -18 LUFS integrated, with true peak below -5 dBFS, so moving from
the lobby to the podium never jumps in volume. Measured with ffmpeg's
`ebur128` filter (`-af ebur128=peak=true:framelog=quiet -f null -`).

| File                  | Integrated | True peak |
| --------------------- | ---------- | --------- |
| `lobby.mp3`           | -18.2 LUFS | -5.6 dBFS |
| `podium-loop.mp3`     | -18.2 LUFS | -4.8 dBFS |

Measure a new track
before adding it and bring it to about -18 LUFS; the master volume the host sets is shared
by all of them, so one loud file ruins the room for the rest.

## How `podium-loop.mp3` was made

The whole piece (about 91 s), from its first note to the end of the final chord's decay,
played as a loop on the podium. The source is 96 s and opens with 3.4 s of silence; the
first note lands at 3.578 s, so the cut starts at 3.57 s. It fades in over 1 s, so each
repeat swells in rather than starting on a hit. It ends at 92.8 s, where the decay is below
-60 dB, with a 1 s fade, then 1.5 s of silence, so the loop breathes between passes.
Lowered by 4.7 dB to match the lobby track.

```
ffmpeg -i source.ogg -af "atrim=start=3.57:end=92.8,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1.0,afade=t=out:st=88.23:d=1.0,apad=pad_dur=1.5" cut.wav
ffmpeg -i cut.wav -af "volume=-4.7dB" -c:a libmp3lame -q:a 3 -map_metadata -1 podium-loop.mp3
```
