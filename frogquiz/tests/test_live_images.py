# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Images held for a live game are released once, never lost, and never swept (#35 review).

The review of the hold-until-the-game-ends change found three ways it could still go
wrong. Two releases at once (a game ended twice, or the job and the sweep together) both
read the held ids before either removed them, and refunded the bytes twice. A release that
failed half way had already dropped the list. And the orphan sweep, which deletes any
upload older than a day that no quiz names, knew nothing of held images, so one taken out
of a quiz mid-game could still go at the next sweep.

Runs on the suite's Redis; the quiz lookup and the file deletion are stubbed, so no upload
is needed.
"""

import asyncio
import uuid

import pytest

import frogquiz.helpers.live_images as live
import frogquiz.worker.storage as worker
from frogquiz.config import pool, redis


def run(coro):
    # Each asyncio.run is a new loop, and pooled connections stay bound to the old one.
    pool.reset()
    try:
        return asyncio.run(coro)
    finally:
        pool.reset()


class _Objects:
    def __init__(self, quiz):
        self.quiz = quiz

    async def get_or_none(self, **_kwargs):
        return self.quiz


def _quiz_model(quiz):
    return type("FakeQuiz", (), {"objects": _Objects(quiz)})


@pytest.fixture
def released(monkeypatch):
    calls = []

    async def release(ids):
        await asyncio.sleep(0)
        calls.append(sorted(str(i) for i in ids))

    monkeypatch.setattr(live, "release_quiz_images", release)
    return calls


def test_two_releases_at_once_free_each_image_once(monkeypatch, released):
    monkeypatch.setattr(live, "Quiz", _quiz_model(None))
    quiz_id = uuid.uuid4()

    async def go():
        await live.hold_images(quiz_id, ["a", "b"])
        await asyncio.gather(live.release_held_images(quiz_id), live.release_held_images(quiz_id))

    run(go())
    assert released == [["a", "b"]]


def test_a_release_that_fails_puts_the_images_back(monkeypatch):
    monkeypatch.setattr(live, "Quiz", _quiz_model(None))
    quiz_id = uuid.uuid4()

    async def boom(_ids):
        raise RuntimeError("database gone")

    monkeypatch.setattr(live, "release_quiz_images", boom)
    run(live.hold_images(quiz_id, ["a", "b"]))
    with pytest.raises(RuntimeError):
        run(live.release_held_images(quiz_id))

    async def held():
        return {str(i) for i in await redis.smembers(f"held_images:{quiz_id}")}

    assert run(held()) == {"a", "b"}


def test_an_image_back_in_the_quiz_stays_and_an_old_style_key_is_freed(monkeypatch, released):
    monkeypatch.setattr(live, "Quiz", _quiz_model(object()))
    monkeypatch.setattr(live, "extract_image_ids_from_quiz", lambda _quiz: ["back-in-the-quiz"])
    quiz_id = uuid.uuid4()

    async def go():
        await live.hold_images(quiz_id, ["back-in-the-quiz", "aaaa--bbbb", "gone"])
        await live.release_held_images(quiz_id)

    run(go())
    assert released == [["aaaa--bbbb", "gone"]]


def test_the_orphan_sweep_leaves_held_images_alone(monkeypatch):
    held, orphan = str(uuid.uuid4()), str(uuid.uuid4())

    class Old:
        def __lt__(self, _other):
            return True

    class Item:
        def __init__(self, item_id):
            self.id = item_id
            self.quizzes = []
            self.quiztivities = []

    class Query:
        def select_related(self, *_args):
            return self

        def filter(self, *_args):
            return self

        async def all(self):
            return [Item(held), Item(orphan)]

    class NoQuizzes:
        @staticmethod
        async def all():
            return []

    monkeypatch.setattr(worker, "Quiz", type("Q", (), {"objects": NoQuizzes}))
    monkeypatch.setattr(
        worker,
        "StorageItem",
        type("S", (), {"objects": Query(), "deleted_at": None, "uploaded_at": Old(), "quizzes": 0, "quiztivities": 0}),
    )
    deleted = []

    async def delete(item):
        deleted.append(item.id)

    monkeypatch.setattr(worker, "delete_storage_item_if_unreferenced", delete)
    quiz_id = uuid.uuid4()

    async def go():
        await live.hold_images(quiz_id, [held])
        try:
            await worker.clean_orphaned_uploads(None)
        finally:
            await redis.delete(f"held_images:{quiz_id}")

    run(go())
    assert deleted == [orphan]
