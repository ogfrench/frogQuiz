# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Shared fixtures for the backend suite."""

import pytest


@pytest.fixture(autouse=True)
def _clear_client_cookies(request):
    """Start and end every test with an empty cookie jar.

    `test_client` is session-scoped, so a single httpx client -- and a single
    cookie jar -- is shared by the whole run, and httpx stores `Set-Cookie`
    responses into it automatically. Without this, a login in one module
    silently authenticates every request that follows it, including the ones
    that are supposed to be anonymous: `test_anonymous_quiz` would create its
    quiz as a signed-in user and never get an `X-Anon-Secret` back.

    Nothing depends on the jar. Every test that needs credentials captures them
    from the login response and passes them explicitly as `cookies=`, so
    clearing it costs those tests nothing and makes "unauthenticated" mean it.
    """
    if "test_client" not in request.fixturenames:
        yield
        return
    client = request.getfixturevalue("test_client")
    client.cookies.clear()
    yield
    client.cookies.clear()
