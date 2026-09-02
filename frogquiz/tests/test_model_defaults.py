# SPDX-FileCopyrightText: 2026 François & Gonçalo
#
# SPDX-License-Identifier: MPL-2.0

from frogquiz.db.models import User


def _user(email: str) -> User:
    return User(email=email, username=email.split("@")[0], avatar=b"")


def test_defaults_are_per_instance():
    """Defaults must be callables, else every user in a process shares one backup code / id."""
    a = _user("a@example.com")
    b = _user("b@example.com")
    assert a.backup_code != b.backup_code
    assert len(a.backup_code) == 64
    assert a.id != b.id


def test_socket_cors_allows_own_origin_and_configured_ones():
    """A configured allowlist must not lock out the origin the API itself serves."""
    from frogquiz.socket_server import cors_allowed_origin, settings

    own = {"HTTP_X_FORWARDED_PROTO": "https", "HTTP_HOST": "quiz.example.com"}
    assert cors_allowed_origin("https://quiz.example.com", own)
    assert not cors_allowed_origin("https://evil.example", own)
    for configured in settings.cors_origins:
        assert cors_allowed_origin(configured, own)
