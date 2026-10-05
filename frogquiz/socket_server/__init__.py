# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0


import base64
import hashlib
import json
import math
import os
import random

import socketio
from cryptography.fernet import Fernet

from frogquiz.config import redis, settings
from frogquiz.db.models import (
    PlayGame,
    QuizQuestionType,
    GameSession,
    GamePlayer,
    VotingQuizAnswer,
    AnswerDataList,
    AnswerData,
)
from pydantic import BaseModel, ValidationError
from datetime import datetime

from frogquiz.socket_server.helpers import (
    check_answer,
    check_captcha,
    has_already_answered,
    record_answer_once,
    update_game,
)
from .models import (
    RejoinGameData,
    JoinGameData,
    ReturnQuestion,
    SubmitAnswerData,
    RegisterAsAdminData,
    KickPlayerInput,
    ConnectSessionIdEvent,
)

from frogquiz.socket_server.export_helpers import save_quiz_to_storage
from frogquiz.socket_server.session import get_session, save_session

settings = settings()


def cors_allowed_origin(origin: str, environ: dict | None = None) -> bool:
    """Allow the configured cross-site origins plus whatever origin serves this API.

    engineio treats a list as the complete allowlist, so a configured list would
    otherwise reject the API's own frontend: browsers send Origin on same-origin
    POSTs, and every socket.io POST would come back as 400.
    """
    if origin in settings.cors_origins:
        return True
    if not environ:
        return False
    scheme = environ.get("HTTP_X_FORWARDED_PROTO", environ.get("wsgi.url_scheme", "http"))
    host = environ.get("HTTP_X_FORWARDED_HOST", environ.get("HTTP_HOST", ""))
    scheme = scheme.split(",")[0].strip()
    host = host.split(",")[0].strip()
    return bool(host) and origin == f"{scheme}://{host}"


sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=cors_allowed_origin)


def get_fernet_key() -> bytes:
    hlib = hashlib.sha256()
    hlib.update(settings.secret_key.encode("utf-8"))
    return base64.urlsafe_b64encode(hlib.hexdigest().encode("latin-1")[:32])


fernet = Fernet(get_fernet_key())


async def generate_final_results(game_data: PlayGame, game_pin: str) -> dict:
    results = {}
    for i in range(len(game_data.questions)):
        redis_res = await redis.get(f"game_session:{game_pin}:{i}")
        if redis_res is None:
            continue
        else:
            results[str(i)] = json.loads(redis_res)
    return results


def calculate_score(z: float, t: int) -> int:
    # Kahoot's curve, François's call on 5 Oct: full marks inside half a second, then
    # falling to half marks at the buzzer. It used to fall to zero, so a right answer on
    # the last second scored about nothing. A late answer inside ANSWER_GRACE_MS keeps
    # the buzzer's 500.
    if z < 500:
        return 1000
    t = t * 1000
    return round(1000 * (1 - min(z, t) / t / 2))


# How long after a question's timer an answer is still taken. Players see the question
# after a network hop and their tap takes another; without slack, a tap on the last
# second would be refused.
ANSWER_GRACE_MS = 1500


async def verify_host(game_pin: str, game_id: str) -> PlayGame | None:
    """The game, if `game_id` is its host credential; otherwise None.

    Checked against the game itself rather than the host session, because the session
    does not exist until the host first connects -- and whoever registered first, with
    any game_id at all, used to become the host.
    """
    raw = await redis.get(f"game:{game_pin}")
    if raw is None:
        return None
    game = PlayGame.model_validate_json(raw)
    return game if str(game.game_id) == str(game_id) else None


def question_for_players(game_data: PlayGame, index: int) -> dict:
    """What players are sent for a question: the question without its solution."""
    temp_return = game_data.model_dump(include={"questions"})["questions"][index]
    question_type = game_data.questions[index].type
    if question_type == QuizQuestionType.VOTING:
        for i in range(len(temp_return["answers"])):
            temp_return["answers"][i] = VotingQuizAnswer(**temp_return["answers"][i])
    temp_return["type"] = question_type
    if question_type == QuizQuestionType.ORDER:
        random.shuffle(temp_return["answers"])
    return ReturnQuestion(**temp_return).model_dump()


@sio.event
async def rejoin_game(sid: str, data: dict):
    # Validated first: it used to index data["game_pin"] before validating, and carry
    # on after a validation error with `data` still a dict.
    try:
        data = RejoinGameData(**data)
    except ValidationError as e:
        await sio.emit("error", room=sid)
        print(e)
        return
    redis_res = await redis.get(f"game:{data.game_pin}")
    if redis_res is None:
        await sio.emit("game_not_found", room=sid)
        return
    redis_sid_key = f"game_session:{data.game_pin}:players:{data.username}"
    old_sid = await redis.get(redis_sid_key)
    if old_sid is None or old_sid != data.old_sid:
        return
    await redis.set(redis_sid_key, sid, ex=7200)
    await redis.srem(
        f"game_session:{data.game_pin}:players",
        GamePlayer(username=data.username, sid=data.old_sid).model_dump_json(),
    )
    await redis.sadd(
        f"game_session:{data.game_pin}:players",
        GamePlayer(username=data.username, sid=sid).model_dump_json(),
    )
    game_data = PlayGame.model_validate_json(redis_res)
    session = {
        "game_pin": data.game_pin,
        "username": data.username,
        "sid_custom": sid,
        "admin": False,
    }
    # The session has to exist before time_sync goes out. It used to be sent first, the
    # player's echo arrived before the save, failed with "session not available", and
    # the session never got a ping -- so every answer after a reload raised
    # KeyError('ping') and was dropped while the player's screen said it was sent.
    await save_session(sid, sio, session)
    await sio.enter_room(sid, data.game_pin)
    encrypted_datetime = fernet.encrypt(datetime.now().isoformat().encode("utf-8")).decode("utf-8")
    await sio.emit("time_sync", encrypted_datetime, room=sid)
    await sio.emit(
        "rejoined_game",
        game_data.to_player_data(),
        room=sid,
    )
    # The host filters its player list on `player_left` and only ever adds on
    # `player_joined`, so without this a player who reloaded -- or whose phone dropped
    # and came back -- was gone from the host's lobby for the rest of the game even
    # though the server still had them.
    await sio.emit(
        "player_joined",
        {"username": data.username, "sid": sid},
        room=f"admin:{data.game_pin}",
    )
    # The game is over: a phone asleep through the podium missed it (E18).
    final = await redis.get(f"game:{data.game_pin}:final_results")
    if final is not None:
        await sio.emit("final_results", json.loads(final), room=sid)
        return
    # A reload mid-question used to leave the player on a waiting screen until the next
    # question.
    await send_open_question(sid, game_data, data.username)


async def send_open_question(sid: str, game_data: PlayGame, username: str) -> None:
    """Send a player who arrives mid-question (a reload, or a late join) the question that is up."""
    index = game_data.current_question
    if (
        game_data.started
        and game_data.question_show
        and index >= 0
        and game_data.questions[index].type != QuizQuestionType.SLIDE
        # A phone woken after answering swapped "Answer locked in" for the tiles again,
        # inviting an answer the server refuses (E7 in docs/edge-cases-2026-10.md).
        and not await has_already_answered(game_data.game_pin, index, username)
    ):
        question = question_for_players(game_data, index)
        # The phone counts down from what it is sent. The full time made it show seconds
        # the server would no longer accept (E5).
        shown_at = await redis.get(f"game:{game_data.game_pin}:current_time")
        if shown_at is not None:
            elapsed = (datetime.now() - datetime.fromisoformat(shown_at)).total_seconds()
            question["time"] = str(max(1, math.ceil(float(question["time"]) - elapsed)))
        await sio.emit("set_question_number", {"question_index": index, "question": question}, room=sid)


@sio.event
async def join_game(sid: str, data: dict):
    redis_res = await redis.get(f"game:{data['game_pin']}")
    if redis_res is None:
        await sio.emit("game_not_found", room=sid)
        return
    try:
        data = JoinGameData(**data)
    except ValidationError as e:
        await sio.emit("error", room=sid)
        print(e)
        return
    game_data = PlayGame.model_validate_json(redis_res)
    # A started game used to refuse everyone. Now, as in Kahoot, a late joiner gets in with
    # no points so far, unless the host has locked the game (François, 5 Oct).
    if game_data.locked:
        await sio.emit("game_locked", room=sid)
        return
    if await redis.exists(f"game:{data.game_pin}:final_results"):
        await sio.emit("game_finished", room=sid)
        return
    # +++ START checking captcha +++
    if game_data.captcha_enabled:
        # Awaited: check_captcha is async, and the bare call returned a coroutine,
        # which is always truthy, so every captcha passed.
        captcha_res = await check_captcha(data.captcha)
        if not captcha_res:
            return
    # --- END checking captcha ---
    # Claimed with SET NX, in one step. It used to be a GET here and a SET further down,
    # and five players joining as the same name at the same moment all got in.
    claimed = await redis.set(
        f"game_session:{data.game_pin}:players:{data.username}",
        sid,
        ex=7200,
        nx=True,
    )
    if not claimed:
        await sio.emit("username_already_exists", room=sid)
        return

    session = {
        "game_pin": data.game_pin,
        "username": data.username,
        "sid_custom": sid,
        "admin": False,
    }
    await save_session(sid, sio, session)
    await sio.emit(
        "joined_game",
        game_data.to_player_data(),
        room=sid,
    )
    await GamePlayer(username=data.username, sid=sid).to_player_stack(data.game_pin)

    if data.custom_field == "":
        data.custom_field = None
    if data.custom_field is not None:
        await redis.hset(
            f"game:{data.game_pin}:players:custom_fields",
            data.username,
            data.custom_field,
        )

    await sio.emit(
        "player_joined",
        {"username": data.username, "sid": sid},
        room=f"admin:{data.game_pin}",
    )
    # +++ Time-Sync +++
    encrypted_datetime = fernet.encrypt(datetime.now().isoformat().encode("utf-8")).decode("utf-8")
    await sio.emit("time_sync", encrypted_datetime, room=sid)
    # --- Time-Sync ---
    await sio.enter_room(sid, data.game_pin)
    # Read again: the host may have moved on since the lookup above.
    current = await redis.get(f"game:{data.game_pin}")
    if game_data.started and current is not None:
        await send_open_question(sid, PlayGame.model_validate_json(current), data.username)


@sio.event
async def set_locked(sid: str, data: dict):
    session = await get_session(sid, sio)
    if not session["admin"] or not isinstance(data, dict):
        return
    locked = data.get("locked") is True
    if await update_game(session["game_pin"], lambda g: setattr(g, "locked", locked)) is not None:
        await sio.emit("locked", {"locked": locked}, room=f"admin:{session['game_pin']}")


@sio.event
async def start_game(sid: str, _data: dict):
    session = await get_session(sid, sio)
    if not session["admin"]:
        return
    game_data = await update_game(session["game_pin"], lambda g: setattr(g, "started", True))
    if game_data is None:
        return
    if game_data.user_id is not None:
        # Anonymous hosts never get a "game_in_lobby" entry in the first
        # place (no dashboard to show it on), so there's nothing to clear.
        await redis.delete(f"game_in_lobby:{game_data.user_id.hex}")
    await sio.emit("start_game", room=session["game_pin"])


@sio.event
async def register_as_admin(sid: str, data: dict):
    try:
        data = RegisterAsAdminData(**data)
    except ValidationError as e:
        await sio.emit("error", room=sid)
        print(e)
        return
    game_pin = data.game_pin
    game_id = data.game_id
    game = await verify_host(game_pin, game_id)
    if game is None:
        await sio.emit("already_registered_as_admin", room=sid)
        return
    old_session = await redis.get(f"game_session:{game_pin}")
    if old_session is None:
        await GameSession(admin=sid, game_id=game_id, answers=[]).save(game_pin)
    else:
        # Socket.io hands out a new sid on every reconnect, so the host asks to
        # register again. Hand the game back instead of locking it out -- only a
        # different game_id is somebody else trying to take the game over.
        existing_session = GameSession.model_validate_json(old_session)
        if existing_session.game_id != game_id:
            await sio.emit("already_registered_as_admin", room=sid)
            return
        existing_session.admin = sid
        await existing_session.save(game_pin)
        # Clears "the host has left" on the phones, if it went out (E22).
        await sio.emit("host_back", room=game_pin)
    players = [json.loads(player) for player in await redis.smembers(f"game_session:{game_pin}:players")]
    answer_count = 0
    if game.current_question >= 0:
        answer_count = len(await AnswerDataList.get_redis_or_empty(game_pin, game.current_question))
    await sio.emit(
        "registered_as_admin",
        {
            "game_id": game_id,
            "game": await redis.get(f"game:{game_pin}"),
            # The host rebuilds its player list from this, so a reconnect doesn't
            # lose everyone who joined while it was away.
            "players": players,
            # And where the question stands: answers and "everyone answered" sent while
            # the host was reconnecting never reached it, so its projector waited out
            # the full timer on a question that was over (E11).
            "answer_count": answer_count,
            "question_open": game.question_show,
        },
        room=sid,
    )
    session = {"game_pin": game_pin, "admin": True, "remote": False}
    await save_session(sid, sio, session)
    await sio.enter_room(sid, game_pin)
    await sio.enter_room(sid, f"admin:{data.game_pin}")


@sio.event
async def get_question_results(sid: str, data: dict):
    session = await get_session(sid, sio)
    if not session["admin"]:
        return
    game_pin = session["game_pin"]
    answer_data_list = await AnswerDataList.get_redis_or_empty(game_pin, data["question_number"])
    if await update_game(game_pin, lambda g: setattr(g, "question_show", False)) is None:
        return
    await sio.emit("question_results", answer_data_list.model_dump(), room=game_pin)


@sio.event
async def set_question_number(sid: str, data: str):
    # data is just a number (as a str) of the question
    session = await get_session(sid, sio)
    if not session["admin"]:
        return
    game_pin = session["game_pin"]
    index = int(float(data))

    def show(game: PlayGame) -> None:
        game.current_question = index
        game.question_show = True

    # The clock first: an answer that sees the new question must not time it from the last.
    await redis.set(f"game:{game_pin}:current_time", datetime.now().isoformat(), ex=7200)
    game_data = await update_game(game_pin, show)
    if game_data is None:
        return
    if game_data.questions[int(float(data))].type == QuizQuestionType.SLIDE:
        await sio.emit(
            "set_question_number",
            {
                "question_index": int(float(data)),
            },
            room=sid,
        )
        return
    await sio.emit(
        "set_question_number",
        {
            "question_index": int(float(data)),
            "question": question_for_players(game_data, int(float(data))),
        },
        room=game_pin,
    )


@sio.event
async def submit_answer(sid: str, data: dict):
    now = datetime.now()
    try:
        data = SubmitAnswerData(**data)
    except ValidationError as e:
        await sio.emit("error", room=sid)
        print(e)
        return
    data.answer = str(data.answer)
    session = await get_session(sid, sio)
    username = session.get("username")
    if username is None:
        # A host or remote socket, or one that never joined. It used to reach
        # session["username"] below and raise KeyError.
        await sio.emit("error", room=sid)
        return
    game_pin = session["game_pin"]
    question_index = int(float(data.question_index))
    game_data = await PlayGame.get_from_redis(game_pin)

    # question_show goes false when the host shows the results, which also reveal the
    # answers to every player. Only the index used to be checked, so an answer sent
    # after the reveal was accepted and scored.
    if question_index != game_data.current_question or not game_data.question_show:
        await sio.emit("question_not_active", room=sid)
        return

    # A session whose time_sync echo never arrived has no ping. That used to raise
    # KeyError and drop the answer; scoring it without a latency correction is better.
    latency = int(float(session.get("ping", 0)))
    time_q_started = datetime.fromisoformat(await redis.get(f"game:{game_pin}:current_time"))
    # Never below zero: the latency subtracted is a round trip measured once, at join.
    elapsed = max(0, abs((time_q_started - now).total_seconds() * 1000) - latency)
    question_seconds = int(float(game_data.questions[question_index].time))
    # The timer was never enforced here. Past it, calculate_score goes negative and was
    # added all the same: a correct answer 2 s late scored -988.
    if elapsed > question_seconds * 1000 + ANSWER_GRACE_MS:
        await sio.emit("question_not_active", room=sid)
        return

    answer_right, answer = check_answer(game_data, data)
    score = 0
    if answer_right:
        score = max(0, min(1000, calculate_score(elapsed, question_seconds)))
    answer_data = AnswerData(
        username=username,
        answer=answer,
        right=answer_right,
        time_taken=elapsed,
        score=score,
    )
    answers = await record_answer_once(game_pin, question_index, answer_data)
    if answers is None:
        await sio.emit("already_replied", room=sid)
        return
    # Only after the answer is recorded, so a refused duplicate never adds points.
    await redis.hincrby(f"game_session:{game_pin}:player_scores", username, score)
    # The rejoin key was set for two hours at join and never again (E20).
    await redis.expire(f"game_session:{game_pin}:players:{username}", 7200)
    # Both were emitted with no room, so to every client in every game: one game's last
    # answer ended the question in all the others.
    await sio.emit("player_answer", {}, room=f"admin:{game_pin}")
    if await everyone_here_answered(game_pin, answers) and await close_question(game_pin, question_index):
        await sio.emit("everyone_answered", {}, room=game_pin)


async def close_question(game_pin: str, index: int) -> bool:
    """Stop taking answers for question `index`, if it is still the one showing.

    Checked inside the transaction: a stale "everyone answered" used to write the whole game
    back and could close the question the host had just moved on to (E23).
    """

    def close(game: PlayGame) -> bool | None:
        if game.current_question != index or not game.question_show:
            return False
        game.question_show = False

    return await update_game(game_pin, close) is not None


@sio.event
async def get_final_results(sid: str, _data: dict):
    session: dict = await get_session(sid, sio)
    if not session["admin"]:
        return
    game_data = await PlayGame.get_from_redis(session["game_pin"])
    results = await generate_final_results(game_data, session["game_pin"])
    # Kept for a phone that was asleep when they went out: its rejoin gets the podium (E18).
    await redis.set(f"game:{session['game_pin']}:final_results", json.dumps(results), ex=7200)
    await sio.emit("final_results", results, room=session["game_pin"])


@sio.event
async def get_export_token(sid: str):
    session = await get_session(sid, sio)
    if not session["admin"]:
        return
    game_data = await PlayGame.get_from_redis(session["game_pin"])
    results = await generate_final_results(game_data, session["game_pin"])
    token = os.urandom(32).hex()
    # The PIN goes in with the results, so the token opens this game and no other.
    payload = {"game_pin": session["game_pin"], "results": results}
    await redis.set(f"export_token:{token}", json.dumps(payload), ex=7200)
    await sio.emit("export_token", token, room=sid)


@sio.event
async def show_solutions(sid: str, _data: dict):
    session: dict = await get_session(sid, sio)
    game_data = await PlayGame.get_from_redis(session["game_pin"])
    if not session["admin"]:
        return
    await sio.emit(
        "solutions",
        game_data.questions[game_data.current_question].model_dump(),
        room=session["game_pin"],
    )


@sio.event
async def echo_time_sync(sid: str, data: str):
    then_dec = fernet.decrypt(data).decode("utf-8")
    then = datetime.fromisoformat(then_dec)
    now = datetime.now()
    delta = now - then
    session = await get_session(sid, sio)
    # `.microseconds` is only the sub-second part, so a 1.4 s round trip read as 400 ms (E21
    # in docs/edge-cases-2026-10.md). Capped at the answer grace, so holding the echo back
    # cannot buy a player more time than the server already allows.
    session["ping"] = min(delta.total_seconds() * 1000, ANSWER_GRACE_MS)
    await save_session(sid, sio, session)


@sio.event
async def kick_player(sid: str, data: dict):
    try:
        data = KickPlayerInput(**data)
    except ValidationError as e:
        await sio.emit("error", room=sid)
        print(e)
        return

    session: dict = await get_session(sid, sio)
    if not session["admin"]:
        return

    player_key = f"game_session:{session['game_pin']}:players:{data.username}"
    player_sid = await redis.get(player_key)
    await redis.srem(
        f"game_session:{session['game_pin']}:players",
        GamePlayer(username=data.username, sid=player_sid).model_dump_json(),
    )
    # rejoin_game accepts whoever holds the sid stored here, so leaving it in place let
    # a kicked player reload straight back into the game.
    await redis.delete(player_key)
    await sio.leave_room(player_sid, session["game_pin"])
    await sio.emit("kick", room=player_sid)


class _RegisterAsRemoteInput(BaseModel):
    game_pin: str
    game_id: str


@sio.event
async def register_as_remote(sid: str, data: dict):
    try:
        data = _RegisterAsRemoteInput(**data)
    except ValidationError as e:
        await sio.emit("error", room=sid)
        print(e)
        return
    # This checked nothing but the PIN, which every player has: it sent the whole quiz,
    # solutions included, and made the caller an admin. The remote page is opened from
    # the host's own screen with the game_id in the link, so it can prove the same thing
    # the host does.
    if await verify_host(data.game_pin, data.game_id) is None:
        await sio.emit("error", room=sid)
        return
    await sio.emit(
        "registered_as_admin",
        {"game_id": data.game_id, "game": await redis.get(f"game:{data.game_pin}")},
        room=sid,
    )
    await sio.emit("control_visibility", {"visible": False}, room=f"admin:{data.game_pin}")
    # A fresh session rather than get_session: a remote's socket has never joined
    # anything, so there was no session to get, and this raised for every real remote.
    session = {"game_pin": data.game_pin, "admin": True, "remote": True}
    await save_session(sid, sio, session)
    await sio.enter_room(sid, data.game_pin)
    await sio.enter_room(sid, f"admin:{data.game_pin}")


class _SetControlVisibilityInput(BaseModel):
    visible: bool


@sio.event
async def set_control_visibility(sid: str, data: dict):
    try:
        data = _SetControlVisibilityInput(**data)
    except ValidationError as e:
        await sio.emit("error", room=sid)
        print(e)
        return
    session: dict = await get_session(sid, sio)
    if not session.get("admin"):
        return
    await sio.emit(
        "control_visibility",
        {"visible": data.visible},
        room=f"admin:{session['game_pin']}",
    )


@sio.event
async def save_quiz(sid: str):
    session: dict = await get_session(sid, sio)
    if not session["admin"]:
        return
    await save_quiz_to_storage(session["game_pin"])
    # No room used to mean every client: one host saving flipped every other signed-in
    # host's Save button to "saved".
    await sio.emit("results_saved_successfully", room=sid)


@sio.event
async def end_game(sid: str, _data: dict | None = None):
    """The host cancels a game that has not started yet.

    There used to be no way out of the lobby at all: the host's only exit was closing
    the tab, which left the PIN joinable for two hours and every player who had already
    joined waiting on a game that would never start. A game that has started ends
    through `get_final_results` instead, so players get the podium they played for.
    """
    session: dict = await get_session(sid, sio)
    if not session.get("admin"):
        return
    game_pin = session["game_pin"]
    raw = await redis.get(f"game:{game_pin}")
    if raw is None:
        # Already gone (expired, or a second click). Still tell the host, so it leaves.
        await sio.emit("game_ended", room=sid)
        return
    game_data = PlayGame.model_validate_json(raw)
    if game_data.started:
        return
    # Keys first, then the news: told first, a player could act on the message -- or a
    # newcomer join -- while the game still existed. Room membership lives on the
    # sockets, not in these keys, so the emit still reaches everyone after the delete.
    keys = [f"game:{game_pin}", f"game_session:{game_pin}"]
    async for key in redis.scan_iter(match=f"game:{game_pin}:*"):
        keys.append(key)
    async for key in redis.scan_iter(match=f"game_session:{game_pin}:*"):
        keys.append(key)
    await redis.delete(*keys)
    if game_data.user_id is not None:
        await redis.delete(f"game_in_lobby:{game_data.user_id.hex}")
    await sio.emit("game_ended", room=game_pin)


@sio.event
async def leave_game(sid: str, _data: dict | None = None):
    """A player leaves on purpose.

    Mirrors kick_player -- the nickname is freed and the rejoin key deleted, so a
    reload does not pull them back in -- and additionally takes them out of the count
    "everyone answered" is measured against, so the rest of the room isn't left
    waiting on somebody who has gone.
    """
    session: dict = await get_session(sid, sio)
    username = session.get("username")
    game_pin = session.get("game_pin")
    if not username or not game_pin:
        return
    player_key = f"game_session:{game_pin}:players:{username}"
    if await redis.get(player_key) != sid:
        # A stale socket for a player who has since rejoined elsewhere.
        return
    await redis.srem(
        f"game_session:{game_pin}:players",
        GamePlayer(username=username, sid=sid).model_dump_json(),
    )
    await redis.delete(player_key)
    await sio.leave_room(sid, game_pin)
    session.pop("username", None)
    session.pop("game_pin", None)
    await save_session(sid, sio, session)
    await sio.emit("player_left", {"username": username}, room=f"admin:{game_pin}")
    await sio.emit("left_game", room=sid)

    await end_question_if_everyone_answered(game_pin)


async def everyone_here_answered(game_pin: str, answers: AnswerDataList) -> bool:
    """Whether every player still in the game has answered.

    By name, not by count. An answer from somebody who has since dropped stays in the
    list, so comparing the count with the players left let one locked phone end the
    question on a player who was still choosing (E4 in docs/edge-cases-2026-10.md).
    """
    here = {
        GamePlayer.model_validate_json(p).username for p in await redis.smembers(f"game_session:{game_pin}:players")
    }
    return bool(here) and here <= {a.username for a in answers}


async def end_question_if_everyone_answered(game_pin: str) -> None:
    """Close the current question if nobody who is still here owes an answer.

    "Everyone answered" is measured against the players set, so whenever the set shrinks
    the comparison has to be made again -- otherwise the question stays open on somebody
    who has gone, and the host waits out the full timer. Called from leave_game and from
    disconnect.
    """
    raw = await redis.get(f"game:{game_pin}")
    if raw is None:
        return
    game_data = PlayGame.model_validate_json(raw)
    if not (game_data.question_show and game_data.current_question >= 0):
        return
    index = game_data.current_question
    answers = await AnswerDataList.get_redis_or_empty(game_pin, index)
    if await everyone_here_answered(game_pin, answers) and await close_question(game_pin, index):
        await sio.emit("everyone_answered", {}, room=game_pin)


# Long enough for a reload or a wifi blip, short enough that a room is not left guessing.
HOST_GRACE_SECONDS = 15


async def tell_players_if_host_stays_away(game_pin: str, sid: str) -> None:
    """Tell the players if the host has not come back after HOST_GRACE_SECONDS.

    A host who closed the tab for good left every phone waiting on a game that would never
    move, with no word why (E22 in docs/edge-cases-2026-10.md). A host who comes back
    re-registers on a new socket, which replaces `admin` in the game session.
    """
    await sio.sleep(HOST_GRACE_SECONDS)
    raw = await redis.get(f"game_session:{game_pin}")
    if raw is None or await redis.exists(f"game:{game_pin}:final_results"):
        # Canceled, expired, or over: nothing is waiting on the host.
        return
    if GameSession.model_validate_json(raw).admin == sid:
        await sio.emit("host_left", room=game_pin)


@sio.event
async def disconnect(sid: str, reason: str | None = None):
    """A socket went away without saying so: a closed tab, a sleeping phone, dead wifi.

    `reason` is taken even though it is unused: python-socketio calls disconnect handlers
    with (sid, reason) and falls back to (sid,) only by catching TypeError from the call.
    A one-argument handler therefore relies on that fallback -- and any TypeError raised
    *inside* the body would be caught the same way and the handler run a second time.

    There was no handler at all, so the player stayed in the set "everyone answered" is
    counted against and the question could never end early again -- for the rest of the
    game the host sat through every full timer because of one person who had left.

    This is deliberately *not* leave_game. A disconnect is usually temporary, and the
    rejoin path (rejoin_game) is gated on `game_session:{pin}:players:{username}` still
    holding this sid, so deleting it here would turn every backgrounded phone into a
    player who cannot get back in. The nickname stays claimed and the key stays put; only
    the membership of the count is dropped, and rejoin_game adds it back.
    """
    try:
        session: dict = await get_session(sid, sio)
    except socketio.exceptions.ConnectionRefusedError:
        # No session to read (expired, or the socket was refused at connect): nothing to
        # drop. Raised, it logged a full traceback for every such disconnect.
        return
    username = session.get("username")
    game_pin = session.get("game_pin")
    if session.get("admin") and not session.get("remote") and game_pin:
        sio.start_background_task(tell_players_if_host_stays_away, game_pin, sid)
        return
    if not username or not game_pin:
        # A remote, or a socket that never joined a game.
        return
    # If this player has already rejoined on a newer socket, that socket owns them now
    # and this late disconnect must not touch the count.
    if await redis.get(f"game_session:{game_pin}:players:{username}") != sid:
        return
    removed = await redis.srem(
        f"game_session:{game_pin}:players",
        GamePlayer(username=username, sid=sid).model_dump_json(),
    )
    if not removed:
        # The player rejoined between the check above and here; rejoin_game already swapped
        # the entry. Telling the host they left would drop somebody who is back (E19).
        return
    await sio.emit("player_left", {"username": username}, room=f"admin:{game_pin}")
    await end_question_if_everyone_answered(game_pin)


@sio.event
async def connect(sid: str, _environ, _auth):
    session_id = os.urandom(16).hex()
    print("Connection opened with handler")
    sio_session = {"session_id": session_id}
    await sio.save_session(sid, sio_session)
    await sio.emit("session_id", ConnectSessionIdEvent(session_id=session_id).dict(), room=sid)
