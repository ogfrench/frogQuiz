# SPDX-FileCopyrightText: 2023 Yohann MARTIN
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MIT

"""ThumbHash encoding, vendored from thumbhash-python 1.0.1.

Source: https://github.com/Astropilot/thumbhash-python (MIT, Yohann MARTIN), files
`thumbhash/encode.py` and the encoding half of `thumbhash/hash.py`, downloaded from
PyPI on 11 Oct 2026. The package capped Pillow below 11, which held the worker on
Pillow 10.4 with 17 known advisories while it decoded every uploaded image.

Changed from the original: only `image_to_thumbhash` and what it needs are kept (the
decoder, the CLI and `Hash.decode`/`size`/`coefficients` are dropped), `Hash` keeps
only `encode`, the pixels are read with `tobytes()` rather than the deprecated
`getdata(band=n)`, and the code is reformatted to this repo's line length. The output is
unchanged: `frogquiz/tests/test_thumbhash.py` checks it against hashes the package made.
"""

import math
from base64 import b64encode
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, List, Sequence, Tuple, Union

from PIL import Image
from PIL.ImageOps import exif_transpose


@dataclass
class _Hash:
    l_dc: float
    p_dc: float
    q_dc: float
    l_scale: float
    has_alpha: bool
    lx: int
    ly: int
    l_count: int
    p_scale: float
    q_scale: float
    is_landscape: bool
    a_dc: float
    a_scale: float
    l_ac: List[float]
    p_ac: List[float]
    q_ac: List[float]
    a_ac: List[float]

    def encode(self) -> bytes:
        nb_ac = len(self.l_ac) + len(self.p_ac) + len(self.q_ac)
        if self.has_alpha:
            nb_ac += len(self.a_ac)
        hash_size = 3 + 2 + (nb_ac + 1) / 2
        if self.has_alpha:
            hash_size += 1

        out = bytearray(int(hash_size))

        header24 = round(63.0 * self.l_dc)
        header24 |= round(31.5 + 31.5 * self.p_dc) << 6
        header24 |= round(31.5 + 31.5 * self.q_dc) << 12
        header24 |= round(31.0 * self.l_scale) << 18
        if self.has_alpha:
            header24 |= 1 << 23
        out[0] = header24 & 255
        out[1] = (header24 >> 8) & 255
        out[2] = header24 >> 16

        self.l_count = self.ly if self.is_landscape else self.lx
        header16 = self.l_count
        header16 |= round(63.0 * self.p_scale) << 3
        header16 |= round(63.0 * self.q_scale) << 9
        if self.is_landscape:
            header16 |= 1 << 15
        out[3] = header16 & 255
        out[4] = header16 >> 8

        if self.has_alpha:
            out[5] = round(15.0 * self.a_dc) | (round(15.0 * self.a_scale) << 4)

        acs: List[List[float]] = [self.l_ac, self.p_ac, self.q_ac]
        if self.has_alpha:
            acs.append(self.a_ac)

        start = 6 if self.has_alpha else 5
        idx = 0
        for ac in acs:
            for f in ac:
                out[start + math.floor(idx / 2)] |= round(15.0 * f) << ((idx & 1) * 4)
                idx += 1

        return bytes(out)


def image_to_thumbhash(image: Union[str, bytes, Path, BinaryIO, Image.Image]) -> str:
    if not isinstance(image, Image.Image):
        image = Image.open(image)

    m_image = exif_transpose(image).convert("RGBA")
    m_image.thumbnail((100, 100))

    # RGBA pixels, interleaved, which is what the original assembled band by band through
    # `getdata(band=n)`. Pillow deprecates `getdata` and removes it in Pillow 14.
    rgb_data = list(m_image.tobytes())
    width, height = m_image.size
    m_image.close()

    return b64encode(rgba_to_thumbhash(width, height, rgb_data)).decode("utf-8")


def rgba_to_thumbhash(w: int, h: int, rgba: Sequence[int]) -> bytes:
    if w > 100 or h > 100:
        raise ValueError(f"{w}x{h} doesn't fit in 100x100")
    if len(rgba) != w * h * 4:
        raise ValueError("Image data does not fit the given size")

    nb_pixels = w * h
    is_landscape = w > h
    avg_r = 0.0
    avg_g = 0.0
    avg_b = 0.0
    avg_a = 0.0

    for i in range(nb_pixels):
        alpha = float(rgba[i * 4 + 3]) / 255.0
        avg_r += alpha / 255.0 * float(rgba[i * 4])
        avg_g += alpha / 255.0 * float(rgba[i * 4 + 1])
        avg_b += alpha / 255.0 * float(rgba[i * 4 + 2])
        avg_a += alpha

    if avg_a > 0.0:
        avg_r /= avg_a
        avg_g /= avg_a
        avg_b /= avg_a

    has_alpha = avg_a < float(nb_pixels)
    l_limit = 5.0 if has_alpha else 7.0
    max_wh = max(w, h)
    lx = max(1, round((l_limit * w) / max_wh))
    ly = max(1, round((l_limit * h) / max_wh))
    l_channel: List[float] = [0.0] * nb_pixels
    p_channel: List[float] = [0.0] * nb_pixels
    q_channel: List[float] = [0.0] * nb_pixels
    a_channel: List[float] = [0.0] * nb_pixels

    for i in range(nb_pixels):
        alpha = float(rgba[i * 4 + 3]) / 255.0
        r = avg_r * (1.0 - alpha) + alpha / 255.0 * float(rgba[i * 4])
        g = avg_g * (1.0 - alpha) + alpha / 255.0 * float(rgba[i * 4 + 1])
        b = avg_b * (1.0 - alpha) + alpha / 255.0 * float(rgba[i * 4 + 2])
        l_channel[i] = (r + g + b) / 3.0
        p_channel[i] = (r + g) / 2.0 - b
        q_channel[i] = r - g
        a_channel[i] = alpha

    def encode_channel(channel: List[float], nx: int, ny: int) -> Tuple[float, List[float], float]:
        dc = 0.0
        ac: List[float] = []
        scale = 0.0
        fx: List[float] = [0.0] * w

        for cy in range(ny):
            cyf = float(cy)
            cx = 0
            while cx * ny < nx * (ny - cy):
                cxf = float(cx)
                f = 0.0
                for x in range(w):
                    fx[x] = math.cos(math.pi / w * cxf * (float(x) + 0.5))
                for y in range(h):
                    fy = math.cos(math.pi / h * cyf * (float(y) + 0.5))
                    for x in range(w):
                        f += channel[x + y * w] * fx[x] * fy
                f /= float(nb_pixels)
                if cx > 0 or cy > 0:
                    ac.append(f)
                    scale = max(scale, abs(f))
                else:
                    dc = f
                cx += 1

        if scale > 0.0:
            for i in range(len(ac)):
                ac[i] = 0.5 + 0.5 / scale * ac[i]

        return (dc, ac, scale)

    l_dc, l_ac, l_scale = encode_channel(l_channel, max(lx, 3), max(ly, 3))
    p_dc, p_ac, p_scale = encode_channel(p_channel, 3, 3)
    q_dc, q_ac, q_scale = encode_channel(q_channel, 3, 3)
    a_dc, a_ac, a_scale = encode_channel(a_channel, 5, 5) if has_alpha else (1.0, [], 1.0)

    return _Hash(
        l_dc=l_dc,
        p_dc=p_dc,
        q_dc=q_dc,
        l_scale=l_scale,
        has_alpha=has_alpha,
        lx=lx,
        ly=ly,
        l_count=0,
        p_scale=p_scale,
        q_scale=q_scale,
        is_landscape=is_landscape,
        a_dc=a_dc,
        a_scale=a_scale,
        l_ac=l_ac,
        p_ac=p_ac,
        q_ac=q_ac,
        a_ac=a_ac,
    ).encode()
