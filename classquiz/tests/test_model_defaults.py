# SPDX-FileCopyrightText: 2026 ogfrench
#
# SPDX-License-Identifier: MPL-2.0

from classquiz.db.models import User


def _user(email: str) -> User:
    return User(email=email, username=email.split("@")[0], avatar=b"")


def test_defaults_are_per_instance():
    """Defaults must be callables, else every user in a process shares one backup code / id."""
    a = _user("a@example.com")
    b = _user("b@example.com")
    assert a.backup_code != b.backup_code
    assert len(a.backup_code) == 64
    assert a.id != b.id
