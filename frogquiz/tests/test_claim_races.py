# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""A claim and the expiry sweep each win or lose whole, never both (#43, found in planning).

The claim read the quiz, checked it was unclaimed and the secret right, then wrote. A
second claim that read before the first wrote passed the same checks and wrote over it,
so the quiz moved to whoever claimed last and its images were counted twice. The sweep
read every expired anonymous quiz, then deleted each by id: a quiz claimed in between was
deleted from its new owner's account, and its images freed.

Each test lands the other side inside that window on purpose rather than by timing: the
claim calls `_quiz_expired` between its read and its write, and the sweep calls `is_live`
between its read and its delete. The wrapper does the competing write first, on a
connection of its own.
"""

import copy
import uuid

import pytest
import sqlalchemy
from fastapi.testclient import TestClient

import frogquiz.routers.quiz as quiz_router
import frogquiz.worker.storage as worker
from frogquiz.config import settings as get_settings
from frogquiz.tests import test_client, example_quiz  # noqa: F401

DB_URL = str(get_settings().db_url)
PASSWORD = "claim-race-password-1"

# Its users are deleted at the end, so test_server.py's exact counts are taken first.
pytestmark = pytest.mark.order(-1)


def _sql(statement: str, **params):
    engine = sqlalchemy.create_engine(DB_URL)
    try:
        with engine.begin() as conn:
            result = conn.execute(sqlalchemy.text(statement), params)
            return result.fetchall() if result.returns_rows else []
    finally:
        engine.dispose()


def _owner(quiz_id: str):
    rows = _sql("SELECT user_id FROM quiz WHERE id = :id", id=uuid.UUID(quiz_id).hex)
    return rows[0][0] if rows else "deleted"


def _sign_up(client: TestClient, name: str):
    email = f"{name}@byom.de"
    made = client.post("/api/v1/users/create", json={"email": email, "password": PASSWORD, "username": name})
    assert made.status_code == 200
    user = client.get(f"/api/v1/internal/testing/user/{email}?secret_key={get_settings().secret_key}")
    client.get(f"/api/v1/users/verify/{user.json()['verify_key']}")
    session_id = client.post("/api/v1/login/start", json={"email": email}).json()["session_id"]
    resp = client.post(
        f"/api/v1/login/step/1?session_id={session_id}", json={"auth_type": "PASSWORD", "data": PASSWORD}
    )
    assert resp.status_code == 200
    cookies = resp.cookies
    client.cookies.clear()
    return {"cookies": cookies, "id": uuid.UUID(client.get("/api/v1/users/me", cookies=cookies).json()["id"]).hex}


@pytest.fixture(scope="module")
def users(test_client: TestClient):  # noqa: F811
    made = {}
    try:
        for name in ("claim-ana", "claim-ben"):
            made[name] = _sign_up(test_client, name)
        yield made
    finally:
        # Deleting an account takes its quizzes with it. Whatever was made goes, even if the
        # second sign-up failed, or the next run starts with a 409.
        for user in made.values():
            resp = test_client.request(
                "DELETE", "/api/v1/users/me", json={"password": PASSWORD}, cookies=user["cookies"]
            )
            assert resp.status_code == 200
        test_client.cookies.clear()


def _anon_quiz(client: TestClient):
    token = client.post("/api/v1/editor/start?edit=false").json()["token"]
    resp = client.post(f"/api/v1/editor/finish?edit_id={token}", json=copy.deepcopy(example_quiz))
    assert resp.status_code == 200
    return resp.json()["id"], resp.headers["X-Anon-Secret"]


def _claim_in_sql(quiz_id: str, user_id: str):
    _sql(
        "UPDATE quiz SET user_id = :user, anon_secret = NULL, expire_at = NULL WHERE id = :id",
        user=user_id,
        id=uuid.UUID(quiz_id).hex,
    )


@pytest.fixture
def released(monkeypatch):
    """Image releases by the sweep, with one made-up image per quiz so there is one to see."""
    freed = []

    async def release(ids):
        freed.extend(ids)

    monkeypatch.setattr(worker, "extract_image_ids_from_quiz", lambda quiz: [f"image-of-{quiz.id.hex}"])
    monkeypatch.setattr(worker, "release_quiz_images", release)
    return freed


def test_a_claim_that_lost_the_race_takes_nothing(test_client: TestClient, users, monkeypatch):  # noqa: F811
    quiz_id, secret = _anon_quiz(test_client)
    ana, ben = users["claim-ana"], users["claim-ben"]
    real = quiz_router._quiz_expired

    def ana_claims_first(quiz):
        _claim_in_sql(quiz_id, ana["id"])
        return real(quiz)

    monkeypatch.setattr(quiz_router, "_quiz_expired", ana_claims_first)
    resp = test_client.post(f"/api/v1/quiz/claim/{quiz_id}", headers={"X-Anon-Secret": secret}, cookies=ben["cookies"])
    assert resp.status_code == 404
    assert _owner(quiz_id) == ana["id"]


def test_a_claim_on_a_quiz_that_expired_while_it_ran_takes_nothing(
    test_client: TestClient, users, monkeypatch  # noqa: F811
):
    quiz_id, secret = _anon_quiz(test_client)
    real = quiz_router._quiz_expired

    def expires_first(quiz):
        verdict = real(quiz)
        _sql("UPDATE quiz SET expire_at = now() - interval '1 day' WHERE id = :id", id=uuid.UUID(quiz_id).hex)
        return verdict

    monkeypatch.setattr(quiz_router, "_quiz_expired", expires_first)
    resp = test_client.post(
        f"/api/v1/quiz/claim/{quiz_id}", headers={"X-Anon-Secret": secret}, cookies=users["claim-ben"]["cookies"]
    )
    assert resp.status_code == 404
    assert _owner(quiz_id) is None


def test_the_sweep_spares_a_quiz_claimed_while_it_ran(
    test_client: TestClient, users, monkeypatch, released  # noqa: F811
):
    quiz_id, _ = _anon_quiz(test_client)
    ana = users["claim-ana"]
    _sql("UPDATE quiz SET expire_at = now() - interval '1 day' WHERE id = :id", id=uuid.UUID(quiz_id).hex)

    async def claimed_then_not_live(quiz):
        if uuid.UUID(str(quiz)).hex == uuid.UUID(quiz_id).hex:
            _claim_in_sql(quiz_id, ana["id"])
        return False

    monkeypatch.setattr(worker, "is_live", claimed_then_not_live)
    # On the app's own loop, where the database is connected.
    test_client.portal.call(worker.clean_expired_anonymous_quizzes, None)
    assert _owner(quiz_id) == ana["id"]
    assert f"image-of-{uuid.UUID(quiz_id).hex}" not in released


def test_the_sweep_still_deletes_what_nobody_claimed(test_client: TestClient, released):  # noqa: F811
    quiz_id, _ = _anon_quiz(test_client)
    _sql("UPDATE quiz SET expire_at = now() - interval '1 day' WHERE id = :id", id=uuid.UUID(quiz_id).hex)
    test_client.portal.call(worker.clean_expired_anonymous_quizzes, None)
    assert _owner(quiz_id) == "deleted"
    assert f"image-of-{uuid.UUID(quiz_id).hex}" in released


def test_the_sweep_holds_the_images_of_a_game_still_running(
    test_client: TestClient, monkeypatch, released  # noqa: F811
):
    # #35 row 13: a game started before its quiz expired runs to its end, with its images.
    quiz_id, _ = _anon_quiz(test_client)
    _sql("UPDATE quiz SET expire_at = now() - interval '1 day' WHERE id = :id", id=uuid.UUID(quiz_id).hex)
    held = []

    async def live(_quiz):
        return True

    async def hold(quiz, ids):
        held.append((uuid.UUID(str(quiz)).hex, list(ids)))

    monkeypatch.setattr(worker, "is_live", live)
    monkeypatch.setattr(worker, "hold_images", hold)
    test_client.portal.call(worker.clean_expired_anonymous_quizzes, None)
    hex_id = uuid.UUID(quiz_id).hex
    assert _owner(quiz_id) == "deleted"
    # Membership, not equality: an earlier test may leave another expired quiz for this sweep.
    assert (hex_id, [f"image-of-{hex_id}"]) in held
    assert f"image-of-{hex_id}" not in released



def test_failed_claim_rolls_back_and_the_same_secret_can_retry(test_client: TestClient, users, monkeypatch):  # noqa: F811
    quiz_id, secret = _anon_quiz(test_client)
    before = _sql("SELECT user_id, anon_secret, expire_at FROM quiz WHERE id = :id", id=uuid.UUID(quiz_id).hex)[0]
    real_adjust = quiz_router.adjust_storage_used

    async def fail_accounting(*args):
        raise RuntimeError("claim accounting interrupted")

    monkeypatch.setattr(quiz_router, "adjust_storage_used", fail_accounting)
    with pytest.raises(RuntimeError, match="claim accounting interrupted"):
        test_client.post(
            f"/api/v1/quiz/claim/{quiz_id}",
            headers={"X-Anon-Secret": secret},
            cookies=users["claim-ana"]["cookies"],
        )
    after = _sql("SELECT user_id, anon_secret, expire_at FROM quiz WHERE id = :id", id=uuid.UUID(quiz_id).hex)[0]
    assert tuple(after) == tuple(before)
    test_client.cookies.clear()
    assert test_client.get(f"/api/v1/quiz/get/{quiz_id}", headers={"X-Anon-Secret": secret}).status_code == 200

    monkeypatch.setattr(quiz_router, "adjust_storage_used", real_adjust)
    retry = test_client.post(
        f"/api/v1/quiz/claim/{quiz_id}",
        headers={"X-Anon-Secret": secret},
        cookies=users["claim-ana"]["cookies"],
    )
    assert retry.status_code == 200
    assert _owner(quiz_id) == users["claim-ana"]["id"]
    assert retry.json()["expire_at"] is None


def test_claim_returns_the_edit_that_finished_during_its_check(test_client: TestClient, users, monkeypatch):  # noqa: F811
    quiz_id, secret = _anon_quiz(test_client)
    real = quiz_router._quiz_expired

    def edit_first(quiz):
        _sql("UPDATE quiz SET description = :text WHERE id = :id", text="Latest saved edit", id=uuid.UUID(quiz_id).hex)
        return real(quiz)

    monkeypatch.setattr(quiz_router, "_quiz_expired", edit_first)
    response = test_client.post(
        f"/api/v1/quiz/claim/{quiz_id}",
        headers={"X-Anon-Secret": secret},
        cookies=users["claim-ana"]["cookies"],
    )
    assert response.status_code == 200
    assert response.json()["description"] == "Latest saved edit"
