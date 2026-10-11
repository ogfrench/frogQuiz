# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""A stale tab cannot overwrite a newer save, by autosave or by Save and close (#35).

`/editor/save` already refused a `base` older than the quiz (E8). `/editor/finish` took
no `base`, so a tab left open behind a newer save could still write its older copy over
it on close. The 409 now also says which version is current, so the editor can offer
"Keep mine" by sending again on top of it.
"""

import copy
import uuid

import pytest
import sqlalchemy
from fastapi.testclient import TestClient

import frogquiz.routers.editor as editor_router
from frogquiz.config import settings as get_settings
from frogquiz.tests import test_client, example_quiz  # noqa: F401

# Creates a quiz and deletes it again, so test_server.py's exact counts are taken first.
pytestmark = pytest.mark.order(-1)


@pytest.fixture
def quiz(test_client: TestClient):  # noqa: F811
    token = test_client.post("/api/v1/editor/start?edit=false").json()["token"]
    resp = test_client.post(f"/api/v1/editor/finish?edit_id={token}", json=copy.deepcopy(example_quiz))
    assert resp.status_code == 200
    quiz_id, secret = resp.json()["id"], resp.headers["X-Anon-Secret"]
    yield quiz_id, secret, resp.json()["updated_at"]
    test_client.delete(f"/api/v1/quiz/delete/{quiz_id}", headers={"X-Anon-Secret": secret})


def _tab(client, quiz_id, secret):
    resp = client.post(
        f"/api/v1/editor/start?edit=true&quiz_id={quiz_id}", headers={"X-Anon-Secret": secret}
    )
    assert resp.status_code == 200
    return resp.json()["token"]


def _titled(title):
    body = copy.deepcopy(example_quiz)
    body["title"] = title
    return body


def test_a_stale_tab_cannot_overwrite_a_newer_save_on_close(test_client, quiz):  # noqa: F811
    quiz_id, secret, first = quiz
    headers = {"X-Anon-Secret": secret}
    tab_a, tab_b = _tab(test_client, quiz_id, secret), _tab(test_client, quiz_id, secret)

    newer = test_client.post(
        f"/api/v1/editor/save?edit_id={tab_a}&base={first}", json=_titled("A's"), headers=headers
    )
    assert newer.status_code == 200

    stale = test_client.post(
        f"/api/v1/editor/finish?edit_id={tab_b}&base={first}", json=_titled("B's"), headers=headers
    )
    assert stale.status_code == 409
    # Still a sentence for anything that shows `detail`, plus the version to build on.
    assert "another tab" in stale.json()["detail"]
    assert stale.json()["updated_at"] == newer.json()["updated_at"]
    assert test_client.get(f"/api/v1/quiz/get/public/{quiz_id}").json()["title"] == "A's"


def test_keep_mine_sends_again_on_top_of_the_current_version(test_client, quiz):  # noqa: F811
    quiz_id, secret, first = quiz
    headers = {"X-Anon-Secret": secret}
    tab_a, tab_b = _tab(test_client, quiz_id, secret), _tab(test_client, quiz_id, secret)
    test_client.post(f"/api/v1/editor/save?edit_id={tab_a}&base={first}", json=_titled("A's"), headers=headers)

    refused = test_client.post(
        f"/api/v1/editor/save?edit_id={tab_b}&base={first}", json=_titled("B's"), headers=headers
    )
    assert refused.status_code == 409
    current = refused.json()["updated_at"]

    kept = test_client.post(
        f"/api/v1/editor/save?edit_id={tab_b}&base={current}", json=_titled("B's"), headers=headers
    )
    assert kept.status_code == 200
    assert test_client.get(f"/api/v1/quiz/get/public/{quiz_id}").json()["title"] == "B's"


def test_finish_without_base_still_saves(test_client, quiz):  # noqa: F811
    # API callers that never sent a base keep working: the check is opt-in, as on /save.
    quiz_id, secret, _ = quiz
    tab = _tab(test_client, quiz_id, secret)
    resp = test_client.post(
        f"/api/v1/editor/finish?edit_id={tab}", json=_titled("No base"), headers={"X-Anon-Secret": secret}
    )
    assert resp.status_code == 200


def test_two_saves_in_the_same_instant_cannot_both_pass_the_check(test_client, quiz, monkeypatch):  # noqa: F811
    """The check read the version, and the write came later: a save landing in between
    passed the same check and was overwritten. The other save is landed in that window on
    purpose, through the job the save queues between the two."""
    quiz_id, secret, first = quiz
    tab = _tab(test_client, quiz_id, secret)
    real = editor_router.arq.enqueue_job
    landed = []

    async def another_save_lands_first(*args, **kwargs):
        if not landed:
            engine = sqlalchemy.create_engine(str(get_settings().db_url))
            try:
                with engine.begin() as conn:
                    conn.execute(
                        sqlalchemy.text("UPDATE quiz SET title = 'Other tab', updated_at = now() WHERE id = :id"),
                        {"id": uuid.UUID(quiz_id).hex},
                    )
            finally:
                engine.dispose()
            landed.append(True)
        return await real(*args, **kwargs)

    monkeypatch.setattr(editor_router.arq, "enqueue_job", another_save_lands_first)
    resp = test_client.post(
        f"/api/v1/editor/save?edit_id={tab}&base={first}", json=_titled("This tab"), headers={"X-Anon-Secret": secret}
    )
    assert landed
    assert resp.status_code == 409
    assert test_client.get(f"/api/v1/quiz/get/public/{quiz_id}").json()["title"] == "Other tab"
