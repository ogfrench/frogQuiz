# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""A quiz's images stay while a live game of it still shows them (#35 rows 9 and 10).

A game runs from a snapshot of the questions taken at start, but the snapshot only holds
image ids: the files are fetched from storage as each question comes up. Replacing an
image in the editor, deleting the quiz, or the expiry sweep released the old file at
once, so the projector and the phones lost it mid-game.

Starting a game marks its quiz live (`quiz_live:{quiz_id}`, a set of PINs). While it is,
the three paths that release images hold them instead (`held_images:{quiz_id}`). The
game's end releases them, and so does the periodic sweep once the game has expired
without an end -- a host who closed the tab.
"""

import logging
import uuid

from frogquiz.config import redis
from frogquiz.db.models import Quiz, StorageItem
from frogquiz.helpers import (
    delete_storage_item_if_unreferenced,
    extract_image_ids_from_quiz,
    release_quiz_images,
)

LOGGER = logging.getLogger("frogquiz.live_images")

# A game's key lives five hours (routers/quiz.py start_quiz); the marker no longer.
GAME_TTL = 18000
# Held ids outlive a game that never ended by a day, for the sweep to find them.
HELD_TTL = GAME_TTL + 86400


def _id(quiz_id) -> str:
    # A game's quiz_id comes back from JSON as a UUID or a string; one spelling for keys.
    return str(uuid.UUID(str(quiz_id)))


def _live(quiz_id) -> str:
    return f"quiz_live:{_id(quiz_id)}"


def _held(quiz_id) -> str:
    return f"held_images:{_id(quiz_id)}"


async def mark_live(quiz_id, game_pin) -> None:
    await redis.sadd(_live(quiz_id), str(game_pin))
    await redis.expire(_live(quiz_id), GAME_TTL)


async def end_live(quiz_id, game_pin) -> None:
    await redis.srem(_live(quiz_id), str(game_pin))


async def is_live(quiz_id) -> bool:
    """Whether a game of this quiz is still running. Drops PINs whose game has gone."""
    alive = False
    for pin in await redis.smembers(_live(quiz_id)):
        if await redis.exists(f"game:{pin}"):
            alive = True
        else:
            await redis.srem(_live(quiz_id), pin)
    return alive


async def hold_images(quiz_id, image_ids) -> None:
    ids = [str(i) for i in image_ids if i]
    if not ids:
        return
    await redis.sadd(_held(quiz_id), *ids)
    await redis.expire(_held(quiz_id), HELD_TTL)


async def release_held_images(quiz_id) -> None:
    """Release what was held for this quiz, once no game of it is live."""
    if await is_live(quiz_id):
        return
    ids = set(await redis.smembers(_held(quiz_id)))
    if not ids:
        return
    await redis.delete(_held(quiz_id))
    quiz = await Quiz.objects.get_or_none(id=uuid.UUID(str(quiz_id)))
    if quiz is None:
        # Deleted, or expired and swept, while the game ran.
        await release_quiz_images(list(ids))
        return
    # An image put back into the quiz since is in use again.
    still = {str(i) for i in extract_image_ids_from_quiz(quiz)}
    for image in ids - still:
        try:
            item = await StorageItem.objects.get_or_none(id=uuid.UUID(image))
        except ValueError:
            LOGGER.warning("held image %s is not a storage id; left alone", image)
            continue
        if item is not None:
            await delete_storage_item_if_unreferenced(item)


async def release_all_held_images() -> None:
    """The sweep: every quiz with held images whose games have all gone."""
    async for key in redis.scan_iter(match="held_images:*"):
        await release_held_images(key.split(":", 1)[1])
