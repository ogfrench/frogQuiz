# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0


import uuid
from datetime import datetime, timedelta

from arq.worker import Retry
import xxhash

from frogquiz.config import storage
from tempfile import SpooledTemporaryFile

from frogquiz.db.models import StorageItem, Quiz, User
from frogquiz.helpers import (
    delete_storage_item_if_unreferenced,
    extract_image_ids_from_quiz,
    release_quiz_images,
)
from thumbhash import image_to_thumbhash

# Long enough that no editor still holding an unsaved image is cut short: autosave
# sends a change within seconds.
ORPHAN_GRACE = timedelta(days=1)


# skipcq: PYL-W0613
async def clean_orphaned_uploads(ctx):
    """Delete uploads that no quiz has used for a day.

    An upload is freed through its quiz: deleting the quiz, taking the image off it, or the
    expired-anonymous sweep. One that never reached a saved quiz -- picked and abandoned,
    or posted straight to the API, which needs no account -- had no way out, and the job
    this replaces looked for them in a Redis list that nothing ever wrote (C5 in
    docs/crud-audit-2026-10.md). The quizzes' own JSON decides what is in use, not the
    many-to-many links, which are only as good as the worker that writes them (C16).
    """
    # ponytail: reads every quiz each run; fine for one team, page it if quizzes reach the tens of thousands.
    used = set()
    for quiz in await Quiz.objects.all():
        used.update(str(image) for image in extract_image_ids_from_quiz(quiz))
    cutoff = datetime.now() - ORPHAN_GRACE
    items = (
        await StorageItem.objects.select_related([StorageItem.quizzes, StorageItem.quiztivities])
        .filter(StorageItem.deleted_at == None)  # noqa: E711
        .filter(StorageItem.uploaded_at < cutoff)
        .all()
    )
    for item in items:
        if str(item.id) in used or item.quiztivities:
            continue
        # Links left behind by a quiz that no longer names the image.
        for quiz in list(item.quizzes or []):
            await item.quizzes.remove(quiz)
        await delete_storage_item_if_unreferenced(item)


async def calculate_hash(ctx, file_id_as_str: str):
    file_id = uuid.UUID(file_id_as_str)
    file_data: StorageItem = await StorageItem.objects.select_related(StorageItem.user).get(id=file_id)
    if file_data.deleted_at is not None:
        # Deleted before the job ran (with its account, say): there is nothing to hash.
        return
    file_path = file_id.hex
    if file_data.storage_path is not None:
        file_path = file_data.storage_path
    file = SpooledTemporaryFile()
    file_data.size = await storage.get_file_size(file_name=file_path)
    if file_data.size is None:
        file_data.size = 0
    file_bytes = storage.download(file_path)
    if file_bytes is None:
        print("Retry raised!")
        raise Retry(defer=ctx["job_try"] * 10)
    async for chunk in file_bytes:
        file.write(chunk)
    try:
        if 0 < file_data.size < 20_970_000:  # greater than 0 but smaller than 20mbytes
            file_data.thumbhash = image_to_thumbhash(file)
    # skipcq: PYL-W0703
    except Exception:
        pass
    hash_obj = xxhash.xxh3_128()

    # skipcq: PY-W0069
    # assert hash_obj.block_size == 64
    while chunk := file.read(6400):
        hash_obj.update(chunk)
    file_data.hash = hash_obj.digest()
    await file_data.update()
    file.close()
    # An upload made without an account has no quota to count against. This read
    # `file_data.user.id` unguarded, so the job raised on every anonymous upload (C6).
    # Claiming its quiz counts it later (routers/quiz.py claim_quiz).
    if file_data.user is None:
        return
    user: User | None = await User.objects.get_or_none(id=file_data.user.id)
    if user is None:
        return
    user.storage_used += file_data.size
    await user.update()


# skipcq: PYL-W0613
async def clean_expired_anonymous_quizzes(ctx):
    """Delete anonymous (accountless) quizzes past their expiry.

    Reads (the 404 an expired-but-not-yet-swept quiz already gets from
    `/editor/start`, `/quiz/start` and `/quiz/get/public`) enforce expiry the
    moment it happens; this job is only the eventual cleanup so the rows and
    their images don't accumulate forever.
    """
    print("Cleaning expired anonymous quizzes up")
    expired = await Quiz.objects.filter(user_id=None, expire_at__lt=datetime.now()).all()
    for quiz in expired:
        # Ids first, delete, then release: see release_quiz_images. This used to go
        # through collect_quiz_image_keys, whose regex only matched upstream's old
        # double-key form, so a modern upload was never freed and an expired anonymous
        # quiz left its images in storage for good.
        image_ids = extract_image_ids_from_quiz(quiz)
        await quiz.delete()
        await release_quiz_images(image_ids)


# skipcq: PYL-W0613
async def quiz_update(ctx, old_quiz: Quiz, quiz_id: uuid.UUID):
    # With its images loaded: ormar's remove() checks the in-memory relation, so on a quiz
    # fetched without them it raised NoMatch for every image, which was caught below and
    # skipped. Taking an image off a question never freed anything (C16).
    new_quiz: Quiz = await Quiz.objects.select_related(Quiz.storageitems).get(id=quiz_id)
    linked = {str(item.id): item for item in new_quiz.storageitems or []}
    old_images = extract_image_ids_from_quiz(old_quiz)
    new_images = extract_image_ids_from_quiz(new_quiz)

    # If images are identical, then return
    if sorted(old_images) == sorted(new_images):
        print("Nothing's changed")
        return
    print("Change detected")
    removed_images = list(set(old_images) - set(new_images))
    added_images = list(set(new_images) - set(old_images))
    change_made = False
    for image in removed_images:
        if "--" in image:
            await storage.delete([image])
        else:
            item = linked.get(image) or await StorageItem.objects.get_or_none(id=uuid.UUID(image))
            if item is None:
                continue
            if image in linked:
                await new_quiz.storageitems.remove(item)
                change_made = True
            # Unlinking was all this did, so taking an image off a question left the file
            # in storage for good and left its bytes counted against the owner's quota
            # forever -- `storage_used` is only ever incremented. The editor's own X on a
            # question image is how people "manage the file that's there", so it has to
            # be what reclaims the space, not a media library we deliberately do not have.
            # Also run for an image that was never linked, which is every image added by
            # an edit while no worker was running.
            await delete_storage_item_if_unreferenced(item)
    for image in added_images:
        if "--" not in image and image not in linked:
            item = await StorageItem.objects.get_or_none(id=uuid.UUID(image))
            if item is None:
                continue
            await new_quiz.storageitems.add(item)
            change_made = True
    if change_made:
        await new_quiz.update()
