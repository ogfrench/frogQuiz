# SPDX-FileCopyrightText: 2026 frogQuiz contributors
# SPDX-License-Identifier: MPL-2.0

"""Preview never persists; imported guest quizzes follow the existing claim contract."""
import uuid
from io import BytesIO

import pytest
from openpyxl import load_workbook

import frogquiz.routers.quiz as quiz_router
from frogquiz.config import settings as get_settings
from frogquiz.helpers.excel_workbook import excel_template, parse_excel
from frogquiz.tests import test_client  # noqa: F401
from frogquiz.tests.test_claim_races import PASSWORD, _sign_up, _sql

pytestmark = pytest.mark.order(-1)


@pytest.fixture(scope="module")
def importer(test_client):  # noqa: F811
    user = _sign_up(test_client, "excel-ana")
    test_client.cookies.clear()
    yield user
    assert (
        test_client.request(
            "DELETE", "/api/v1/users/me", json={"password": PASSWORD}, cookies=user["cookies"]
        ).status_code
        == 200
    )
    test_client.cookies.clear()


def workbook(title, broken=False):
    book = load_workbook(BytesIO(excel_template()))
    book.active["C5"] = title
    if broken:
        book.active["G14"] = 0
    result = BytesIO()
    book.save(result)
    book.close()
    return result.getvalue()


def upload(client, data, query="", cookies=None):
    return client.post(
        f"/api/v1/quiz/excel-import{query}",
        files={"file": ("quiz.xlsx", data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        cookies=cookies,
    )


def count(title):
    return _sql("SELECT count(*) FROM quiz WHERE title = :title", title=title)[0][0]


def test_guests_can_download_a_template(test_client):  # noqa: F811
    response = test_client.get("/api/v1/quiz/excel-template")
    assert response.status_code == 200
    assert "attachment" in response.headers["Content-Disposition"]
    assert parse_excel(response.content)["errors"] == []


def test_preview_never_creates_a_quiz_or_spends_guest_creation_quota(test_client, monkeypatch):  # noqa: F811
    async def no_creation(*args):
        pytest.fail("Preview must not enforce/spend the creation quota")

    monkeypatch.setattr(quiz_router, "enforce_anonymous_quiz_ceilings", no_creation)
    title = f"Preview {uuid.uuid4().hex[:12]}"
    response = upload(test_client, workbook(title), "?dry_run=true")
    assert response.status_code == 200
    assert response.json()["errors"] == []
    assert len(response.json()["questions"]) == 2
    assert "X-Anon-Secret" not in response.headers
    assert count(title) == 0
    separate = test_client.post(
        "/api/v1/quiz/excel-preview?dry_run=false",
        files={
            "file": ("quiz.xlsx", workbook(title), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        },
    )
    assert separate.status_code == 200
    assert separate.json()["errors"] == []
    assert count(title) == 0


def test_guest_import_can_be_claimed_and_kept_on_the_account(test_client, importer):  # noqa: F811
    title = f"Guest import {uuid.uuid4().hex[:12]}"
    response = upload(test_client, workbook(title))
    assert response.status_code == 200, response.text
    quiz_id = response.json()["id"]
    secret = response.headers["X-Anon-Secret"]
    assert response.json()["anonymous"] is True
    headers = {"X-Anon-Secret": secret}
    try:
        guest = test_client.get(f"/api/v1/quiz/get/{quiz_id}", headers=headers)
        assert guest.status_code == 200
        assert guest.json()["expire_at"] is not None
        assert guest.json()["public"] is False
        assert guest.json()["questions"][1]["type"] == "CHECK"
        assert test_client.get(f"/api/v1/quiz/get/{quiz_id}").status_code == 401
        assert test_client.get(f"/api/v1/quiz/get/{quiz_id}", headers={"X-Anon-Secret": "wrong"}).status_code == 404
        claim = test_client.post(f"/api/v1/quiz/claim/{quiz_id}", headers=headers, cookies=importer["cookies"])
        assert claim.status_code == 200, claim.text
        owned = test_client.get(f"/api/v1/quiz/get/{quiz_id}", cookies=importer["cookies"])
        assert owned.status_code == 200
        assert owned.json()["expire_at"] is None
        assert owned.json()["questions"] == guest.json()["questions"]
        test_client.cookies.clear()
        assert test_client.get(f"/api/v1/quiz/get/{quiz_id}", headers=headers).status_code == 404
    finally:
        test_client.delete(f"/api/v1/quiz/delete/{quiz_id}", headers=headers, cookies=importer["cookies"])


def test_each_account_confirmation_is_a_new_quiz_even_with_the_same_title(test_client, importer):  # noqa: F811
    title = f"Duplicate {uuid.uuid4().hex[:12]}"
    first = upload(test_client, workbook(title), "?require_account=true", importer["cookies"])
    second = upload(test_client, workbook(title), "?require_account=true", importer["cookies"])
    assert first.status_code == second.status_code == 200
    assert first.json()["id"] != second.json()["id"]
    assert "X-Anon-Secret" not in first.headers
    assert count(title) == 2
    for response in (first, second):
        quiz = test_client.get(f'/api/v1/quiz/get/{response.json()["id"]}', cookies=importer["cookies"])
        assert len(quiz.json()["questions"]) == 2
        assert quiz.json()["expire_at"] is None


def test_invalid_workbooks_never_create_partial_quizzes(test_client):  # noqa: F811
    title = f"Invalid {uuid.uuid4().hex[:12]}"
    data = workbook(title, broken=True)
    preview = upload(test_client, data, "?dry_run=true")
    confirm = upload(test_client, data)
    assert preview.status_code == 200
    assert confirm.status_code == 400
    assert preview.json() == confirm.json()
    assert preview.json()["errors"][0]["row"] == 14
    assert count(title) == 0


def test_account_expectation_and_disabled_guest_flag_are_enforced(test_client, monkeypatch):  # noqa: F811
    data = excel_template()
    assert upload(test_client, data, "?require_account=true").status_code == 401
    monkeypatch.setattr(get_settings(), "anonymous_quizzes_enabled", False)
    assert upload(test_client, data, "?dry_run=true").status_code == 401
    assert upload(test_client, data).status_code == 401


def test_import_refuses_oversize_and_non_workbook_files(test_client):  # noqa: F811
    assert upload(test_client, b"x" * (2 * 1024 * 1024 + 1)).status_code == 413
    assert upload(test_client, b"not excel").status_code == 400
