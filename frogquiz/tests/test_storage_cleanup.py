# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The two clean-ups the e2e suite cannot reach: the orphaned-upload sweep, a cron job,
and admin account deletion, which needs an admin. C5 and C9 in docs/crud-audit-2026-10.md.

Database work goes through `test_client.portal`, which runs it on the app's own event
loop; the connection pool is bound to that loop and refuses any other.
"""

import base64
import os
from datetime import datetime, timedelta
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from frogquiz.config import settings
from frogquiz.db.models import StorageItem, User
from frogquiz.tests import test_client  # noqa: F401
from frogquiz.worker.storage import clean_orphaned_uploads

# Creates accounts and a quiz, so it runs after test_server.py's exact global counts,
# like test_logout.py, and removes what it made.
pytestmark = pytest.mark.order(-1)

PASSWORD = "test-password"
ADMIN = "cleanup-admin@byom.de"
VICTIM = "cleanup-victim@byom.de"
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)


def _upload(client: TestClient, cookies=None) -> str:
    res = client.post("/api/v1/storage/", files={"file": ("dot.png", PNG, "image/png")}, cookies=cookies)
    assert res.status_code == 200, res.text
    return res.json()["id"]


def _on_disk(image: str) -> bool:
    return os.path.exists(os.path.join(settings().storage_path, UUID(image).hex))


def _create(client: TestClient, email: str):
    username = email.split("@")[0]
    res = client.post("/api/v1/users/create", json={"email": email, "password": PASSWORD, "username": username})
    assert res.status_code == 200, res.text
    user = client.get(f"/api/v1/internal/testing/user/{email}?secret_key={settings().secret_key}")
    client.get(f"/api/v1/users/verify/{user.json()['verify_key']}")


def _log_in(client: TestClient, email: str):
    session_id = client.post("/api/v1/login/start", json={"email": email}).json()["session_id"]
    res = client.post(f"/api/v1/login/step/1?session_id={session_id}", json={"auth_type": "PASSWORD", "data": PASSWORD})
    assert res.status_code == 200, res.text
    return res.cookies


def test_an_upload_no_quiz_uses_is_swept_after_a_day(test_client: TestClient):  # noqa: F811
    orphan = _upload(test_client)
    used = _upload(test_client)
    token = test_client.post("/api/v1/editor/start?edit=false").json()["token"]
    saved = test_client.post(
        f"/api/v1/editor/finish?edit_id={token}",
        json={
            "public": False,
            "title": "Sweep",
            "description": "cleanup",
            "cover_image": used,
            "questions": [
                {
                    "question": "Q?",
                    "time": "20",
                    "type": "ABCD",
                    "answers": [{"answer": "a", "right": True}, {"answer": "b", "right": False}],
                }
            ],
        },
    )
    assert saved.status_code == 200, saved.text

    async def age_and_sweep():
        old = datetime.now() - timedelta(days=2)
        await StorageItem.objects.filter(id__in=[UUID(orphan), UUID(used)]).update(uploaded_at=old)
        await clean_orphaned_uploads({})
        return [await StorageItem.objects.get(id=UUID(i)) for i in (orphan, used)]

    swept, kept = test_client.portal.call(age_and_sweep)
    assert swept.deleted_at is not None and not _on_disk(orphan)
    assert kept.deleted_at is None and _on_disk(used)
    assert test_client.get(f"/api/v1/storage/download/{orphan}").status_code == 404

    secret = saved.headers["x-anon-secret"]
    gone = test_client.delete(f"/api/v1/quiz/delete/{saved.json()['id']}", headers={"X-Anon-Secret": secret})
    assert gone.status_code == 200


def test_an_admin_deleting_an_account_cleans_up_like_the_account_itself(test_client: TestClient):  # noqa: F811
    _create(test_client, ADMIN)
    _create(test_client, VICTIM)
    # Before either signs in, so no cached copy of the admin predates the flag.
    test_client.portal.call(lambda: User.objects.filter(email=ADMIN).update(is_admin=True))
    admin = _log_in(test_client, ADMIN)
    victim = _log_in(test_client, VICTIM)
    image = _upload(test_client, cookies=victim)

    res = test_client.delete(f"/api/v1/admin/user/email?email={VICTIM}", cookies=admin)
    assert res.json() == {"deleted": 1}
    # The bare delete this replaced left the cached user in Redis, still signing in.
    assert test_client.get("/api/v1/users/me", cookies=victim).status_code == 401
    assert not _on_disk(image)
    assert test_client.get(f"/api/v1/storage/download/{image}").status_code == 404
    assert test_client.delete(f"/api/v1/admin/user/email?email={VICTIM}", cookies=admin).json() == {"deleted": 0}

    res = test_client.request("DELETE", "/api/v1/users/me", json={"password": PASSWORD}, cookies=admin)
    assert res.status_code == 200, res.text
