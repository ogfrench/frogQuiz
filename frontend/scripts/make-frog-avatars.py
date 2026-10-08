# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Cut the frog avatars out of the Adventure Frog sprite sheet.

The sheet is "Adventure Frog" by intellikat (CC BY 4.0), a 6 x 6 grid of 512 px cells.
Frames 1-26 are the character, 27-36 are loose pieces of tongue meant to be put together
in a game engine. A few open-mouth frames get a tongue built from those pieces: a length
of the straight segment with a tip on the end, at the sheet's own scale so its outline
matches the frog's, drawn over the frog from inside the mouth.

The four frames that get a tongue are also saved without one (poses 22-25), so the set
has both: the same frog with its mouth open and the same frog sticking its tongue out.

Each avatar is one frame cropped to a square around the head and shoulders, so the face
is still readable at 32 px, and saved as a 256 px WebP. Every pose is then saved again in
each of the colours in HUES, as frog-<colour>-<pose>.webp. The game hands out frogs in
file-name order, so a room uses every pose in the art's own green before the first
recoloured one appears. The tongue, the mouth and the hat band keep their colour: a
recoloured frog with a green tongue looks ill.

This script is the record of those changes, which CC BY 4.0 asks us to disclose. See
frontend/src/lib/assets/frogs/README.md.

    python -I frontend/scripts/make-frog-avatars.py SHEET.png frontend/src/lib/assets/frogs

SHEET.png is adventure_frog_spritesheet-512px.png from https://intellikat.itch.io/ .
Needs Pillow. Existing frog-*.webp in the output folder are replaced.
"""

import math
import sys
from pathlib import Path

from PIL import Image, ImageChops

CELL = 512
COLUMNS = 6
SIZE = 256

# frame number (1-based, row by row) -> (left, top, side) of the square, in the cell's pixels.
CROPS = {
    1: (170, 135, 190),
    2: (150, 120, 190),
    3: (180, 125, 245),
    4: (180, 120, 250),
    5: (205, 115, 245),
    6: (170, 140, 200),
    7: (160, 120, 250),
    9: (190, 125, 190),
    10: (235, 140, 190),
    11: (215, 155, 190),
    12: (170, 150, 190),
    13: (150, 160, 190),
    14: (160, 150, 190),
    15: (160, 155, 200),
    18: (150, 115, 200),
    19: (135, 75, 230),
    20: (170, 135, 200),
    21: (190, 150, 190),
    23: (170, 115, 190),
    25: (175, 115, 200),
    26: (165, 105, 215),
}

# The same four frames without the tongue added, cropped tighter. They come after the
# others, so poses 1-21 keep their numbers.
PLAIN = {
    3: (170, 140, 200),
    4: (170, 145, 190),
    5: (215, 135, 190),
    7: (155, 135, 190),
}

SEGMENT = 32  # the long straight piece, open at both ends
STICKY, ROUND = 34, 33  # tips

# frame -> (x, y, length, tip): the tongue's open root end goes at (x, y), inside the pink
# of the mouth, and runs `length` px of straight segment before the tip.
TONGUES = {
    3: (309, 246, 34, STICKY),
    4: (309, 246, 39, STICKY),
    5: (339, 240, 39, ROUND),
    7: (294, 242, 34, STICKY),
}

# Hue rotations in degrees, in the order the rounds come. The first is the art as drawn.
HUES = [0, 90, 150, 200, 260, 310]


def cell(sheet: Image.Image, frame: int) -> Image.Image:
    row, col = divmod(frame - 1, COLUMNS)
    return sheet.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))


def piece(sheet: Image.Image, frame: int) -> tuple[Image.Image, int]:
    """A tongue piece cut to its drawing, and the height of the centre of its left end."""
    p = cell(sheet, frame)
    alpha = p.getchannel("A").point(lambda v: 255 if v > 8 else 0)
    left, top, right, bottom = alpha.getbbox()
    edge = alpha.crop((left, top, left + 3, bottom)).getbbox()
    return p.crop((left, top, right, bottom)), (edge[1] + edge[3]) // 2


def with_tongue(sheet: Image.Image, frame: int) -> Image.Image:
    frog = cell(sheet, frame)
    if frame not in TONGUES:
        return frog
    x, y, length, tip = TONGUES[frame]
    bar, bar_mid = piece(sheet, SEGMENT)
    bar = bar.crop((0, 0, length, bar.height))
    end, end_mid = piece(sheet, tip)
    out = frog.copy()
    out.alpha_composite(bar, (x, y - bar_mid))
    # Two pixels of overlap, so no seam shows between segment and tip.
    out.alpha_composite(end, (x + length - 2, y - end_mid))
    return out


def hue_rotate(im: Image.Image, degrees: float) -> Image.Image:
    """The same matrix as CSS filter: hue-rotate()."""
    c, s = math.cos(math.radians(degrees)), math.sin(math.radians(degrees))
    matrix = (
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0,
    )  # fmt: skip
    out = im.convert("RGB").convert("RGB", matrix)
    out.putalpha(im.getchannel("A"))
    return out


def reds(im: Image.Image) -> Image.Image:
    """A soft mask of the pinks and reds (tongue, mouth, hat band), which keep their colour."""
    h, s, v = im.convert("RGB").convert("HSV").split()
    # Pillow's hue runs 0-255. Red sits at both ends; the browns of the clothes start at
    # about 18 (25 degrees), so the ramp is over by then.
    hue = h.point(lambda x: 255 if x <= 8 or x >= 238 else 128 if x <= 12 or x >= 232 else 0)
    sat = s.point(lambda x: 0 if x < 70 else 255 if x > 110 else (x - 70) * 255 // 40)
    val = v.point(lambda x: 0 if x < 70 else 255)
    return ImageChops.multiply(ImageChops.multiply(hue, sat), val)


def main(sheet_path: str, out_dir: str) -> None:
    sheet = Image.open(sheet_path).convert("RGBA")
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("frog-*.webp"):
        old.unlink()
    poses = [(frame, crop, True) for frame, crop in sorted(CROPS.items())]
    poses += [(frame, crop, False) for frame, crop in sorted(PLAIN.items())]
    for pose, (frame, (left, top, side), tongue) in enumerate(poses, start=1):
        base = with_tongue(sheet, frame) if tongue else cell(sheet, frame)
        square = base.crop((left, top, left + side, top + side))
        square = square.resize((SIZE, SIZE), Image.LANCZOS)
        keep = reds(square)
        for colour, degrees in enumerate(HUES):
            frog = Image.composite(square, hue_rotate(square, degrees), keep) if degrees else square
            frog.save(out / f"frog-{colour}-{pose:02d}.webp", quality=90, alpha_quality=100, method=6)
        print(f"frame {frame:2d}{'' if tongue else ' (no tongue)'} -> frog-*-{pose:02d}.webp")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
