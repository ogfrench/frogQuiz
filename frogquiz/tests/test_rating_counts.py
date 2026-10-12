# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""A rating changes the counts by exactly what it changed (#35 row 7 review).

Rating used to add to the counts on the quiz row loaded at the start of the request and
write the whole row back, so it could undo a save that landed in between, and two at once
lost one. It is one statement with deltas now; switching a like to a dislike moves one
from each side.
"""

import copy
import uuid

import pytest
import sqlalchemy
from fastapi.testclient import TestClient

from frogquiz.config import settings as get_settings
from frogquiz.tests import test_client, example_quiz  # noqa: F401

DB_URL = str(get_settings().db_url)
EMAIL = "rating-counts@byom.de"
PASSWORD = "test-password"

# Makes a user and a quiz and removes both, so test_server.py's exact counts come first.
pytestmark = pytest.mark.order(-1)


def _counts(quiz_id: str):
    engine = sqlalchemy.create_engine(DB_URL)
    try:
        with engine.begin() as conn:
            return tuple(
                conn.execute(
                    sqlalchemy.text("SELECT likes, dislikes FROM quiz WHERE id = :id"), {"id": uuid.UUID(quiz_id).hex}
                ).one()
            )
    finally:
        engine.dispose()


@pytest.fixture
def signed_in(test_client: TestClient):  # noqa: F811
    secret_key = get_settings().secret_key
    resp = test_client.post("/api/v1/users/create", json={"email": EMAIL, "password": PASSWORD, "username": "rater"})
    assert resp.status_code == 200
    user = test_client.get(f"/api/v1/internal/testing/user/{EMAIL}?secret_key={secret_key}")
    test_client.get(f"/api/v1/users/verify/{user.json()['verify_key']}")
    session_id = test_client.post("/api/v1/login/start", json={"email": EMAIL}).json()["session_id"]
    resp = test_client.post(
        f"/api/v1/login/step/1?session_id={session_id}", json={"auth_type": "PASSWORD", "data": PASSWORD}
    )
    assert resp.status_code == 200
    cookies = resp.cookies
    yield cookies
    test_client.request("DELETE", "/api/v1/users/me", json={"password": PASSWORD}, cookies=cookies)


def test_switching_a_like_to_a_dislike_moves_one_each_way(test_client, signed_in):  # noqa: F811
    token = test_client.post("/api/v1/editor/start?edit=false", cookies=signed_in).json()["token"]
    body = copy.deepcopy(example_quiz)
    body["public"] = True
    quiz_id = test_client.post(f"/api/v1/editor/finish?edit_id={token}", json=body, cookies=signed_in).json()["id"]
    assert _counts(quiz_id) == (0, 0)

    rate = f"/api/v1/community/rate/{quiz_id}"
    assert test_client.post(rate, json={"type": "LIKE"}, cookies=signed_in).status_code == 200
    assert _counts(quiz_id) == (1, 0)
    assert test_client.post(rate, json={"type": "LIKE"}, cookies=signed_in).status_code == 409
    assert _counts(quiz_id) == (1, 0)
    assert test_client.post(rate, json={"type": "DISLIKE"}, cookies=signed_in).status_code == 200
    assert _counts(quiz_id) == (0, 1)
