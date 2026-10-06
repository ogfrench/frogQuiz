# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Backend halves of the edge-case pass in docs/edge-cases-2026-10.md.

Database work goes through `test_client.portal`, which runs it on the app's own event
loop; the connection pool is bound to that loop and refuses any other.
"""

import pytest
from fastapi.testclient import TestClient

from frogquiz.db.models import User
from frogquiz.tests import test_client  # noqa: F401

# Creates accounts, so it runs after test_server.py's exact global counts, and removes them.
pytestmark = pytest.mark.order(-1)


def _register(client: TestClient, email: str, username: str):
    return client.post("/api/v1/users/create", json={"email": email, "username": username, "password": "test-password"})


# E17. The API took any username: empty, a thousand characters, or "Ana " beside "Ana" and
# "ana", all of which read as the same person wherever a name is shown.
def test_usernames_are_trimmed_bounded_and_unique_whatever_the_case(test_client: TestClient):  # noqa: F811
    emails = [f"e17-{n}@byom.de" for n in range(4)]
    try:
        assert _register(test_client, emails[0], "  Spaced  ").status_code == 200
        stored = test_client.portal.call(lambda: User.objects.get(email=emails[0]))
        assert stored.username == "Spaced"
        assert _register(test_client, emails[1], "spaced").status_code == 409
        assert _register(test_client, emails[2], "ab").status_code == 422
        assert _register(test_client, emails[3], "x" * 21).status_code == 422
    finally:
        test_client.portal.call(lambda: User.objects.filter(email__in=emails).delete())
