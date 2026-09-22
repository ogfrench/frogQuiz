# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Stand-in for python-magic on Windows, used only by the local e2e harness.

python-magic's libmagic DLL crashes with an access violation on import under
Windows, which takes the whole app down at startup. The app only calls
`from_buffer(..., mime=True)` to sniff image uploads, so signature matching on the
common image formats is enough. Production (Linux, real libmagic) never sees this.
"""

_SIGNATURES = [
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"%PDF-", "application/pdf"),
]


def from_buffer(buffer: bytes, mime: bool = False) -> str:
    if buffer[:4] == b"RIFF" and buffer[8:12] == b"WEBP":
        return "image/webp"
    for signature, mime_type in _SIGNATURES:
        if buffer.startswith(signature):
            return mime_type
    head = buffer[:256].lstrip().lower()
    if head.startswith(b"<svg") or (head.startswith(b"<?xml") and b"<svg" in buffer[:1024].lower()):
        return "image/svg+xml"
    return "application/octet-stream"
