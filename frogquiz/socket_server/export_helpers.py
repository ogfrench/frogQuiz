# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
#
# SPDX-License-Identifier: MPL-2.0


import json
import logging
from datetime import datetime

from pydantic import ValidationError

from frogquiz.config import redis
from frogquiz.db.models import PlayGame, GameResults, User

LOGGER = logging.getLogger("frogquiz.export")


async def save_quiz_to_storage(game_pin: str):
    game = PlayGame.model_validate_json(await redis.get(f"game:{game_pin}"))
    player_count = await redis.scard(f"game_session:{game_pin}:players")
    answers = []
    for i in range(len(game.questions)):
        redis_res = await redis.get(f"game_session:{game_pin}:{i}")
        try:
            answers.append(json.loads(redis_res))
        except (ValidationError, TypeError):
            answers.append([])
    player_scores = await redis.hgetall(f"game_session:{game_pin}:player_scores")
    custom_field_data = await redis.hgetall(f"game:{game_pin}:players:custom_fields")
    q_return = []
    for q in game.questions:
        q_return.append(q.model_dump())
    # The host can delete their account while the game is still running, and
    # game_results.user is a foreign key -- so saving results for a host who is no
    # longer there used to fail the whole save at podium time and lose the game.
    # The column is nullable; an ownerless result row is worth more than none.
    host_id = game.user_id
    if host_id is not None and await User.objects.filter(id=host_id).get_or_none() is None:
        LOGGER.info("Saving game results with no owner: the host's account is gone")
        host_id = None
    data = GameResults(
        id=game.game_id,
        quiz=game.quiz_id,
        user=host_id,
        timestamp=datetime.now(),
        player_count=player_count,
        answers=json.dumps(answers),
        player_scores=json.dumps(player_scores),
        custom_field_data=json.dumps(custom_field_data),
        title=game.title,
        description=game.description,
        questions=json.dumps(q_return),
    )
    try:
        await data.save()
    except Exception:
        # Never let losing the results row take the podium down with it. The game
        # itself is over and its state is still in Redis; a failed save is a missing
        # history entry, not a broken game.
        LOGGER.exception("Could not save the results for game %s", game_pin)
