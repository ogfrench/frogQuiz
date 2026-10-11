# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""A page view or a game launch never undoes a save that landed while it ran (#35 row 7).

`get_public_quiz` and `start_quiz` loaded the quiz, added one to `views` or `plays`, and
wrote the whole row back. A save that landed between the load and the write was reverted,
`updated_at` included, so the editor's next save then met a 409 it had not earned. The
view runs on every visit to a quiz page, so this needed no second editor, only a viewer.

The save is landed inside that window on purpose rather than by timing: both routes call
`_quiz_expired` after loading the row and before writing it, and the test wraps it to
write a new title first, on a connection of its own. A race left to chance proves nothing
either way.
"""

import copy
import uuid

import pytest
import sqlalchemy
from fastapi.testclient import TestClient

import frogquiz.routers.quiz as quiz_router
from frogquiz.config import settings as get_settings
from frogquiz.tests import test_client, example_quiz  # noqa: F401

DB_URL = str(get_settings().db_url)

# ormar stores a UUID as 32 hex characters, so the raw SQL here matches on `.hex`.
# Creates a quiz and deletes it again, so test_server.py's exact counts are taken first.
pytestmark = pytest.mark.order(-1)


def _row(quiz_id: str):
    engine = sqlalchemy.create_engine(DB_URL)
    try:
        with engine.begin() as conn:
            return conn.execute(
                sqlalchemy.text("SELECT title, views, plays FROM quiz WHERE id = :id"), {"id": uuid.UUID(quiz_id).hex}
            ).one()
    finally:
        engine.dispose()


def _save_lands_mid_request(monkeypatch, quiz_id: str):
    """Make the next `_quiz_expired` call land a save of the title "After" first."""
    real = quiz_router._quiz_expired
    landed = []

    def expired_after_a_save(quiz):
        if not landed:
            engine = sqlalchemy.create_engine(DB_URL)
            try:
                with engine.begin() as conn:
                    conn.execute(
                        sqlalchemy.text("UPDATE quiz SET title = 'After' WHERE id = :id"),
                        {"id": uuid.UUID(quiz_id).hex},
                    )
            finally:
                engine.dispose()
            landed.append(True)
        return real(quiz)

    monkeypatch.setattr(quiz_router, "_quiz_expired", expired_after_a_save)
    return landed


@pytest.fixture
def quiz(test_client: TestClient):  # noqa: F811
    token = test_client.post("/api/v1/editor/start?edit=false").json()["token"]
    body = copy.deepcopy(example_quiz)
    body["title"] = "Before"
    resp = test_client.post(f"/api/v1/editor/finish?edit_id={token}", json=body)
    assert resp.status_code == 200
    quiz_id, secret = resp.json()["id"], resp.headers["X-Anon-Secret"]
    yield quiz_id, secret
    test_client.delete(f"/api/v1/quiz/delete/{quiz_id}", headers={"X-Anon-Secret": secret})


def test_a_view_does_not_revert_a_save_that_landed_during_it(test_client, quiz, monkeypatch):  # noqa: F811
    quiz_id, _ = quiz
    landed = _save_lands_mid_request(monkeypatch, quiz_id)
    assert test_client.get(f"/api/v1/quiz/get/public/{quiz_id}").status_code == 200
    assert landed, "the save never landed inside the request"
    title, views, _ = _row(quiz_id)
    assert title == "After"
    assert views == 1


def test_a_launch_does_not_revert_a_save_that_landed_during_it(test_client, quiz, monkeypatch):  # noqa: F811
    quiz_id, secret = quiz
    landed = _save_lands_mid_request(monkeypatch, quiz_id)
    resp = test_client.post(f"/api/v1/quiz/start/{quiz_id}?game_mode=kahoot", headers={"X-Anon-Secret": secret})
    assert resp.status_code == 200
    assert landed, "the save never landed inside the request"
    title, _, plays = _row(quiz_id)
    assert title == "After"
    assert plays == 1


def test_views_add_up(test_client, quiz):  # noqa: F811
    quiz_id, _ = quiz
    for _ in range(3):
        assert test_client.get(f"/api/v1/quiz/get/public/{quiz_id}").status_code == 200
    assert _row(quiz_id)[1] == 3


def test_a_save_does_not_revert_a_view_that_landed_during_it(test_client, quiz, monkeypatch):  # noqa: F811
    # The other direction: the editor's save loaded the row, awaited the image job, then
    # wrote every column back, views included. It writes only what an edit sets now.
    import frogquiz.routers.editor as editor_router

    quiz_id, secret = quiz
    real = editor_router.arq.enqueue_job

    async def a_view_lands_first(*args, **kwargs):
        engine = sqlalchemy.create_engine(DB_URL)
        try:
            with engine.begin() as conn:
                conn.execute(
                    sqlalchemy.text("UPDATE quiz SET views = views + 1 WHERE id = :id"),
                    {"id": uuid.UUID(quiz_id).hex},
                )
        finally:
            engine.dispose()
        return await real(*args, **kwargs)

    monkeypatch.setattr(editor_router.arq, "enqueue_job", a_view_lands_first)
    headers = {"X-Anon-Secret": secret}
    token = test_client.post(f"/api/v1/editor/start?edit=true&quiz_id={quiz_id}", headers=headers).json()["token"]
    body = copy.deepcopy(example_quiz)
    body["title"] = "Saved"
    assert test_client.post(f"/api/v1/editor/save?edit_id={token}", json=body, headers=headers).status_code == 200
    title, views, _ = _row(quiz_id)
    assert title == "Saved"
    assert views == 1


def test_a_save_does_not_revert_a_claim_that_landed_during_it(test_client, quiz, monkeypatch):  # noqa: F811
    # A claim clears the secret and the expiry. Written whole, the editor's save put both
    # back from its stale row, and the quiz was anonymous again with its old secret.
    import frogquiz.routers.editor as editor_router

    quiz_id, secret = quiz
    real = editor_router.arq.enqueue_job

    async def a_claim_lands_first(*args, **kwargs):
        engine = sqlalchemy.create_engine(DB_URL)
        try:
            with engine.begin() as conn:
                conn.execute(
                    sqlalchemy.text("UPDATE quiz SET anon_secret = NULL, expire_at = NULL WHERE id = :id"),
                    {"id": uuid.UUID(quiz_id).hex},
                )
        finally:
            engine.dispose()
        return await real(*args, **kwargs)

    monkeypatch.setattr(editor_router.arq, "enqueue_job", a_claim_lands_first)
    headers = {"X-Anon-Secret": secret}
    token = test_client.post(f"/api/v1/editor/start?edit=true&quiz_id={quiz_id}", headers=headers).json()["token"]
    body = copy.deepcopy(example_quiz)
    body["title"] = "Saved"
    assert test_client.post(f"/api/v1/editor/save?edit_id={token}", json=body, headers=headers).status_code == 200
    engine = sqlalchemy.create_engine(DB_URL)
    try:
        with engine.begin() as conn:
            row = conn.execute(
                sqlalchemy.text("SELECT title, anon_secret, expire_at FROM quiz WHERE id = :id"),
                {"id": uuid.UUID(quiz_id).hex},
            ).one()
    finally:
        engine.dispose()
    assert row.title == "Saved"
    assert row.anon_secret is None
    assert row.expire_at is None
