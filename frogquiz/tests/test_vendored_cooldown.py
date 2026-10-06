# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The server's minute is the same minute as the shared countdown's.

The browser half of the sign-in email cooldown is copied from frogViz into
frontend/src/lib/vendor/resend-cooldown.ts. The server half is Python and cannot share
it, so this reads the number out of that file: if one side changes, this fails instead
of the page counting down a wait the server no longer holds.
"""

import re
from pathlib import Path

from frogquiz.helpers.ratelimit import RESEND_COOLDOWN_SECONDS

VENDORED = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "vendor" / "resend-cooldown.ts"


def test_the_server_waits_as_long_as_the_page_counts():
    shared = re.search(r"export const RESEND_COOLDOWN_SECONDS = (\d+);", VENDORED.read_text())
    assert shared, f"no RESEND_COOLDOWN_SECONDS in {VENDORED}"
    assert RESEND_COOLDOWN_SECONDS == int(shared.group(1))
