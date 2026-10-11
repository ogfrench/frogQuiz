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

import uuid

from frogquiz.config import redis
from frogquiz.db.models import Quiz
from frogquiz.helpers import extract_image_ids_from_quiz, release_quiz_images

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
    # As long as anything held: a busy game's key is renewed on every move and can outlive
    # five hours, and `is_live` prunes PINs whose game has gone anyway.
    await redis.expire(_live(quiz_id), HELD_TTL)


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
    # Claimed in one transaction: a game ended twice, or the job and the sweep together,
    # both read the same ids before either deleted the key, and the owner got the bytes
    # back twice.
    async with redis.pipeline(transaction=True) as pipe:
        pipe.smembers(_held(quiz_id))
        pipe.delete(_held(quiz_id))
        ids, _ = await pipe.execute()
    ids = {str(i) for i in ids}
    if not ids:
        return
    try:
        quiz = await Quiz.objects.get_or_none(id=uuid.UUID(_id(quiz_id)))
        # An image put back into the quiz since is in use again. A deleted quiz uses none.
        still = set() if quiz is None else {str(i) for i in extract_image_ids_from_quiz(quiz)}
        # release_quiz_images counts every other reference first, and frees an old
        # `uuid--uuid` key too, which a bare StorageItem lookup could not.
        await release_quiz_images(list(ids - still))
    except Exception:
        # Back on the list for the next sweep rather than lost. Anything already freed is
        # skipped then: a soft-deleted upload is not freed twice.
        await hold_images(quiz_id, ids)
        raise


async def held_image_ids() -> set[str]:
    """Every image held for any quiz, so the orphan sweep leaves them alone."""
    ids: set[str] = set()
    async for key in redis.scan_iter(match="held_images:*"):
        ids.update(str(i) for i in await redis.smembers(key))
    return ids


async def release_all_held_images() -> None:
    """The sweep: every quiz with held images whose games have all gone."""
    async for key in redis.scan_iter(match="held_images:*"):
        await release_held_images(key.split(":", 1)[1])
