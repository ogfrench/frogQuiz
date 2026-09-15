# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0


import re
import uuid
from datetime import datetime

import ormar.exceptions
from arq.worker import Retry
import xxhash

from frogquiz.config import redis, storage
from tempfile import SpooledTemporaryFile

from frogquiz.db.models import StorageItem, Quiz, User
from frogquiz.helpers import extract_image_ids_from_quiz
from frogquiz.storage.errors import DeletionFailedError
from thumbhash import image_to_thumbhash


# skipcq: PYL-W0613
async def clean_editor_images_up(ctx):
    print("Cleaning images up")
    edit_sessions = await redis.smembers("edit_sessions")
    for session_id in edit_sessions:
        session = await redis.get(f"edit_session:{session_id}")
        if session is None:
            images = await redis.lrange(f"edit_session:{session_id}:images", 0, 3000)
            if len(images) != 0:
                try:
                    await storage.delete(images)
                except DeletionFailedError:
                    print("Deletion Error", images)
            await redis.srem("edit_sessions", session_id)
            await redis.delete(f"edit_session:{session_id}:images")


async def calculate_hash(ctx, file_id_as_str: str):
    file_id = uuid.UUID(file_id_as_str)
    file_data: StorageItem = await StorageItem.objects.select_related(StorageItem.user).get(id=file_id)
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
    user: User | None = await User.objects.get_or_none(id=file_data.user.id)
    if user is None:
        return
    user.storage_used += file_data.size
    await user.update()


_PIC_NAME_REGEX = re.compile("^.*/(.{36}--.{36})$")


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
        pics_to_delete = []
        for question in quiz.questions:
            image = question.get("image")
            if image is None or str(image).startswith("https://i.imgur.com/"):
                continue
            match = _PIC_NAME_REGEX.match(image)
            if match is not None:
                pics_to_delete.append(match.group(1))
        if pics_to_delete:
            try:
                await storage.delete(pics_to_delete)
            except DeletionFailedError:
                print("Deletion Error", pics_to_delete)
        await quiz.delete()


# skipcq: PYL-W0613
async def quiz_update(ctx, old_quiz: Quiz, quiz_id: uuid.UUID):
    new_quiz: Quiz = await Quiz.objects.get(id=quiz_id)
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
            item = await StorageItem.objects.get_or_none(id=uuid.UUID(image))
            if item is None:
                continue
            try:
                await new_quiz.storageitems.remove(item)
            except ormar.exceptions.NoMatch:
                continue
            change_made = True
    for image in added_images:
        if "--" not in image:
            item = await StorageItem.objects.get_or_none(id=uuid.UUID(image))
            if item is None:
                continue
            await new_quiz.storageitems.add(item)
            change_made = True
    if change_made:
        await new_quiz.update()
