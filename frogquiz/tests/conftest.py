# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Shared fixtures for the backend suite."""

import pytest


@pytest.fixture(autouse=True)
def _clear_client_cookies(request):
    """Start and end every test with an empty cookie jar.

    `TestClient` is httpx underneath, so it stores `Set-Cookie` responses into a
    jar that outlives the test that caused them. Any test which logs in silently
    authenticates every later request in the same module, including the ones that
    are meant to be anonymous: test_claimed_quiz_no_longer_usable_with_old_secret
    sends no cookies and expects a 404, but was arriving authenticated as the very
    user who had just claimed the quiz, so the endpoint found it and returned 200.
    The assertion was right; the request was not anonymous.

    Nothing depends on the jar. Every test that needs credentials captures them
    from the login response (`ValueStorage.cookies`, `AnonState.claimer_cookies`)
    and passes them explicitly as `cookies=`, so clearing it costs them nothing
    and makes "unauthenticated" mean it.
    """
    if "test_client" not in request.fixturenames:
        yield
        return
    client = request.getfixturevalue("test_client")
    client.cookies.clear()
    yield
    client.cookies.clear()
