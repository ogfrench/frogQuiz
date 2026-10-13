# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Copy to my quizzes, and the examples (#39, D26, D33).

Anyone signed in copies their own quiz or any public one, the examples included. Someone
else's unlisted quiz is a 404, the same as no quiz. A copy's images are new files charged
to the copier, so the copy keeps them when the original goes.
"""

import copy
import json
import os
import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from frogquiz.config import settings as get_settings
from frogquiz.db.models import Quiz, StorageItem, User
from frogquiz.examples import EXAMPLES_EMAIL, EXAMPLES_USERNAME
from frogquiz.examples.seed import example_id, seed
from frogquiz.tests import test_client, example_quiz  # noqa: F401
from frogquiz.tests.test_claim_races import PASSWORD, _sign_up
from frogquiz.tests.test_storage_cleanup import PNG, _upload

pytestmark = pytest.mark.order(-1)


@pytest.fixture(scope="module")
def people(test_client: TestClient):  # noqa: F811
    made = {}
    try:
        for name in ("copy-ana", "copy-ben"):
            made[name] = _sign_up(test_client, name)
        yield made["copy-ana"]["cookies"], made["copy-ben"]["cookies"]
    finally:
        for user in made.values():
            resp = test_client.request(
                "DELETE", "/api/v1/users/me", json={"password": PASSWORD}, cookies=user["cookies"]
            )
            assert resp.status_code == 200
        test_client.cookies.clear()


def _quiz(client: TestClient, cookies, public: bool, image: str | None = None) -> str:
    quiz = copy.deepcopy(example_quiz)
    quiz["public"] = public
    if image:
        quiz["cover_image"] = image
        quiz["questions"][0]["image"] = image
    token = client.post("/api/v1/editor/start?edit=false", cookies=cookies).json()["token"]
    resp = client.post(f"/api/v1/editor/finish?edit_id={token}", json=quiz, cookies=cookies)
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _copy(client: TestClient, quiz_id: str, cookies=None):
    return client.post(f"/api/v1/quiz/copy/{quiz_id}", cookies=cookies)


def _get(client: TestClient, quiz_id: str, cookies):
    resp = client.get(f"/api/v1/quiz/get/{quiz_id}", cookies=cookies)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _on_disk(image: str) -> bool:
    return os.path.exists(os.path.join(get_settings().storage_path, uuid.UUID(image).hex))


def test_your_own_unlisted_quiz_copies_as_an_unlisted_copy(test_client: TestClient, people):  # noqa: F811
    ana, _ = people
    original = _quiz(test_client, ana, public=False)
    resp = _copy(test_client, original, ana)
    assert resp.status_code == 200, resp.text
    made = _get(test_client, resp.json()["id"], ana)
    source = _get(test_client, original, ana)
    assert made["id"] != source["id"]
    assert made["title"] == source["title"] + " (copy)"
    assert made["public"] is False
    assert made["questions"] == source["questions"]


def test_someone_elses_unlisted_quiz_is_a_404_like_no_quiz(test_client: TestClient, people):  # noqa: F811
    ana, ben = people
    unlisted = _quiz(test_client, ana, public=False)
    assert _copy(test_client, unlisted, ben).status_code == 404
    assert _copy(test_client, str(uuid.uuid4()), ben).status_code == 404


def test_a_public_non_example_copies_to_signed_in_users_only(test_client: TestClient, people):  # noqa: F811
    ana, ben = people
    public = _quiz(test_client, ana, public=True)
    assert _copy(test_client, public).status_code == 404
    assert test_client.get(f"/api/v1/quiz/get/public/{public}").json()["is_example"] is False
    resp = _copy(test_client, public, ben)
    assert resp.status_code == 200, resp.text
    me = test_client.get("/api/v1/users/me", cookies=ben).json()["id"]
    made = _get(test_client, resp.json()["id"], ben)
    assert made["user_id"] == me or made["user_id"]["id"] == me
    assert made["public"] is False


def test_copied_images_are_the_copiers_and_outlive_the_original(test_client: TestClient, people):  # noqa: F811
    from frogquiz.worker.storage import calculate_hash, clean_orphaned_uploads

    ana, ben = people
    image = _upload(test_client, ana)
    original = _quiz(test_client, ana, public=True, image=image)
    resp = _copy(test_client, original, ben)
    assert resp.status_code == 200, resp.text
    made = _get(test_client, resp.json()["id"], ben)
    copied = made["questions"][0]["image"]
    assert uuid.UUID(copied) != uuid.UUID(image)
    # One file for the two places the original used it.
    assert uuid.UUID(made["cover_image"]) == uuid.UUID(copied)
    assert _on_disk(copied)

    me = test_client.get("/api/v1/users/me", cookies=ben).json()["id"]
    before = test_client.portal.call(lambda: User.objects.get(id=uuid.UUID(me))).storage_used
    test_client.portal.call(calculate_hash, {"job_try": 1}, uuid.UUID(copied).hex)
    after = test_client.portal.call(lambda: User.objects.get(id=uuid.UUID(me))).storage_used
    assert after - before == len(PNG)

    assert test_client.delete(f"/api/v1/quiz/delete/{original}", cookies=ana).status_code == 200
    assert _on_disk(copied)

    # The orphan sweep reads the quiz JSON by string: the copy's image must read as in use.
    async def age_and_sweep():
        await StorageItem.objects.filter(id=uuid.UUID(copied)).update(uploaded_at=datetime.now() - timedelta(days=2))
        await clean_orphaned_uploads({})
        return await StorageItem.objects.get(id=uuid.UUID(copied))

    assert test_client.portal.call(age_and_sweep).deleted_at is None
    assert _on_disk(copied)


def test_a_copy_past_the_storage_limit_is_refused(test_client: TestClient, people, monkeypatch):  # noqa: F811
    ana, ben = people
    image = _upload(test_client, ana)
    original = _quiz(test_client, ana, public=True, image=image)
    monkeypatch.setattr(get_settings(), "free_storage_limit", 0)
    resp = _copy(test_client, original, ben)
    assert resp.status_code == 409
    assert "Storage limit" in resp.json()["detail"]


@pytest.fixture
def example_folder(tmp_path, test_client: TestClient):  # noqa: F811
    quiz = copy.deepcopy(example_quiz)
    quiz["title"] = "An example"
    (tmp_path / "an-example.json").write_text(json.dumps(quiz), encoding="utf-8")
    yield tmp_path

    async def clean():
        owner = await User.objects.get_or_none(email=EXAMPLES_EMAIL)
        if owner is not None:
            await Quiz.objects.filter(user_id=owner.id).delete()
            await owner.delete()

    test_client.portal.call(clean)


def test_the_seed_runs_twice_without_duplicates_and_explore_lists_it(
    test_client: TestClient, people, example_folder  # noqa: F811
):
    ana, _ = people
    assert test_client.portal.call(seed, example_folder) == [example_id("an-example")]
    assert test_client.portal.call(seed, example_folder) == [example_id("an-example")]

    listed_response = test_client.get("/api/v1/quiz/examples")
    assert listed_response.status_code == 200
    listed = listed_response.json()
    assert listed["username"] == EXAMPLES_USERNAME
    assert [(q["id"], q["title"], q["questions"]) for q in listed["quizzes"]] == [
        (str(example_id("an-example")), "An example", len(example_quiz["questions"]))
    ]
    assert test_client.get(f"/api/v1/quiz/get/public/{example_id('an-example')}").json()["is_example"] is True
    assert _copy(test_client, str(example_id("an-example")), ana).status_code == 200


def test_anonymous_template_copy_requires_the_setting(test_client: TestClient, example_folder, monkeypatch):  # noqa: F811
    test_client.portal.call(seed, example_folder)
    monkeypatch.setattr(get_settings(), "anonymous_quizzes_enabled", False)
    response = _copy(test_client, str(example_id("an-example")))
    assert response.status_code == 401
    assert "Sign in" in response.json()["detail"]


def test_anonymous_template_copy_obeys_the_active_quiz_limit(
    test_client: TestClient, example_folder, monkeypatch  # noqa: F811
):
    test_client.portal.call(seed, example_folder)
    monkeypatch.setattr(get_settings(), "anon_quiz_total_limit", 0)
    response = _copy(test_client, str(example_id("an-example")))
    assert response.status_code == 429
    assert "Sign in" in response.json()["detail"]


def test_signed_out_example_copy_is_private_editable_and_expires(test_client: TestClient, example_folder):  # noqa: F811
    test_client.portal.call(seed, example_folder)
    source_id = str(example_id("an-example"))
    response = _copy(test_client, source_id)
    assert response.status_code == 200, response.text
    secret = response.headers["X-Anon-Secret"]
    quiz_id = response.json()["id"]

    try:
        saved = test_client.get(
            f"/api/v1/quiz/get/{quiz_id}", headers={"X-Anon-Secret": secret}
        )
        assert saved.status_code == 200, saved.text
        quiz = saved.json()
        assert quiz["user_id"] is None
        assert quiz["public"] is False
        assert quiz["expire_at"] is not None
        assert "anon_secret" not in quiz
        assert quiz["title"] == "An example (copy)"

        edit = test_client.post(
            f"/api/v1/editor/start?edit=true&quiz_id={quiz_id}", headers={"X-Anon-Secret": secret}
        )
        assert edit.status_code == 200, edit.text
        edited = copy.deepcopy(example_quiz)
        edited["title"] = "An edited template"
        saved = test_client.post(
            f"/api/v1/editor/finish?edit_id={edit.json()['token']}",
            json=edited,
            headers={"X-Anon-Secret": secret},
        )
        assert saved.status_code == 200, saved.text
        hosted = test_client.post(
            f"/api/v1/quiz/start/{quiz_id}?game_mode=kahoot", headers={"X-Anon-Secret": secret}
        )
        assert hosted.status_code == 200, hosted.text
        assert hosted.json()["user_id"] is None
    finally:
        test_client.delete(f"/api/v1/quiz/delete/{quiz_id}", headers={"X-Anon-Secret": secret})


def test_the_seed_refuses_an_example_with_an_image(test_client: TestClient, example_folder):  # noqa: F811
    quiz = json.loads((example_folder / "an-example.json").read_text(encoding="utf-8"))
    quiz["questions"][0]["image"] = str(uuid.uuid4())
    (example_folder / "an-example.json").write_text(json.dumps(quiz), encoding="utf-8")
    with pytest.raises(ValueError, match="no images"):
        test_client.portal.call(seed, example_folder)
