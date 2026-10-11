# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The vendored ThumbHash encoder gives the hashes the thumbhash-python package gave.

thumbhash-python 1.0.1 capped Pillow below 11, which kept the worker on Pillow 10.4 with
17 known advisories while it decoded every uploaded image (V1 audit, 11 Oct). The
encoder now lives in frogquiz/helpers/thumbhash.py, so Pillow can move. The expected
strings were produced by thumbhash-python 1.0.1 on Pillow 10.4.0 from these exact
images; a stored hash must not change meaning because the library did.
"""

from io import BytesIO

import pytest
from PIL import Image

from frogquiz.helpers.thumbhash import image_to_thumbhash


def _rgb() -> Image.Image:
    im = Image.new("RGB", (64, 48))
    im.putdata([((x * 4) % 256, (y * 5) % 256, (x * y) % 256) for y in range(48) for x in range(64)])
    return im


def _rgba() -> Image.Image:
    im = Image.new("RGBA", (40, 60))
    im.putdata(
        [((x * 6) % 256, 120, (y * 4) % 256, 0 if (x + y) % 7 == 0 else 200) for y in range(60) for x in range(40)]
    )
    return im


def _big() -> Image.Image:
    im = Image.new("RGB", (300, 200))
    im.putdata([((x // 3) % 256, (y // 2) % 256, 90) for y in range(200) for x in range(300)])
    return im


@pytest.mark.parametrize(
    "make, expected",
    [
        (_rgb, "HhgKLZpwdndwd3d3h2iHd6CRCveH"),
        (_rgba, "HfiFQxAKcHB3d3iEfweHiOj4WFiOjuU="),
        (_big, "kAYGHYqAh4eAh4d4iHiId3CACPh4"),
    ],
)
def test_the_hash_matches_the_package_it_replaces(make, expected):
    buf = BytesIO()
    make().save(buf, "PNG")
    buf.seek(0)
    assert image_to_thumbhash(buf) == expected
