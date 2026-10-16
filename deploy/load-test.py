# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0
"""How many players one game holds (#73, the room-size limit).

Each step is a fresh game of a throwaway guest quiz: N players join over socket.io, the
host starts it and shows a question, everyone answers, and the game ends. It records how
long joining took, how long the question took to reach the slowest phone, and how long
the slowest answer took to reach the host. The quiz is deleted at the end, even on a
failure.

It plays the protocol the e2e helpers use (frontend/e2e/sockets.ts). Every player comes
from this one machine, so it measures the server, not the players' networks.

    pipenv run python deploy/load-test.py                       # the local e2e stack
    pipenv run python deploy/load-test.py --api https://api.frogquiz.xyz --production \\
        --steps 25,50,100,200

--production is required for any API that is not on localhost: it runs real games on the
live server, so pick a time when nobody is playing.
"""

import argparse
import asyncio
import statistics
import sys
import time
from urllib.parse import urlparse

import httpx
import socketio

QUIZ = {
    "title": "Load test (delete me)",
    "description": "deploy/load-test.py",
    "public": False,
    "questions": [
        {
            "question": "Load test",
            "time": "30",
            "type": "ABCD",
            "answers": [{"answer": "Yes", "right": True}, {"answer": "No", "right": False}],
        }
    ],
}


async def connect(api: str) -> socketio.AsyncClient:
    s = socketio.AsyncClient(reconnection=False)

    # The real client answers every time_sync; without it submit_answer has no latency.
    @s.on("time_sync")
    async def _sync(data):
        await s.emit("echo_time_sync", data)

    await s.connect(api, transports=["websocket"], wait_timeout=20)
    return s


def waiter(s: socketio.AsyncClient, event: str) -> asyncio.Future:
    fut = asyncio.get_running_loop().create_future()

    def on(data=None):
        if not fut.done():
            fut.set_result((time.perf_counter(), data))

    s.on(event, on)
    return fut


async def join(api: str, pin: str, name: str):
    s = await connect(api)
    joined = waiter(s, "joined_game")
    refused = [waiter(s, e) for e in ("username_already_exists", "game_locked", "game_not_found", "error")]
    await s.emit("join_game", {"username": name, "game_pin": pin})
    done, _ = await asyncio.wait([joined, *refused], timeout=30, return_when=asyncio.FIRST_COMPLETED)
    if joined not in done:
        await s.disconnect()
        raise RuntimeError(f"{name} did not join")
    return s


async def step(api: str, http: httpx.AsyncClient, quiz_id: str, secret: str, n: int) -> dict:
    res = await http.post(
        f"/api/v1/quiz/start/{quiz_id}",
        params={"game_mode": "kahoot", "captcha_enabled": "False"},
        headers={"X-Anon-Secret": secret},
    )
    res.raise_for_status()
    game = res.json()
    pin, game_id = str(game["game_pin"]), str(game["game_id"])
    host = await connect(api)
    registered = waiter(host, "registered_as_admin")
    await host.emit("register_as_admin", {"game_pin": pin, "game_id": game_id})
    await asyncio.wait_for(registered, 20)

    players: list[socketio.AsyncClient] = []
    try:
        t0 = time.perf_counter()
        # In waves of 25, the way a room fills, rather than every socket in one instant.
        for i in range(0, n, 25):
            wave = range(i, min(i + 25, n))
            players += await asyncio.gather(*(join(api, pin, f"Load {k + 1}") for k in wave))
        join_s = time.perf_counter() - t0
        await asyncio.sleep(1)  # let echo_time_sync land before the first answer

        started = waiter(host, "start_game")
        await host.emit("start_game", {})
        await asyncio.wait_for(started, 20)

        shown = [waiter(p, "set_question_number") for p in players]
        answers: dict[str, float] = {}
        everyone = asyncio.get_running_loop().create_future()

        @host.on("player_answer")
        def _answer(data):
            answers[data["username"]] = time.perf_counter()
            if len(answers) == n and not everyone.done():
                everyone.set_result(None)

        t_show = time.perf_counter()
        await host.emit("set_question_number", "0")
        got = await asyncio.wait_for(asyncio.gather(*shown), 30)
        reach = [t - t_show for t, _ in got]

        sent: dict[str, float] = {}

        async def answer(k: int, p: socketio.AsyncClient):
            sent[f"Load {k + 1}"] = time.perf_counter()
            await p.emit("submit_answer", {"question_index": 0, "answer": "Yes"})

        await asyncio.gather(*(answer(k, p) for k, p in enumerate(players)))
        try:
            await asyncio.wait_for(everyone, 30)
        except asyncio.TimeoutError:
            pass
        lag = [answers[name] - sent[name] for name in answers if name in sent]
        return {
            "players": n,
            "joined": len(players),
            "join_s": round(join_s, 2),
            "question_reach_max_ms": round(max(reach) * 1000),
            "answers_received": len(answers),
            "answer_p50_ms": round(statistics.median(lag) * 1000) if lag else None,
            "answer_max_ms": round(max(lag) * 1000) if lag else None,
        }
    finally:
        try:
            await host.emit("end_game")
            await asyncio.sleep(1)
        finally:
            await asyncio.gather(*(p.disconnect() for p in players), return_exceptions=True)
            await host.disconnect()


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default="http://127.0.0.1:8010")
    ap.add_argument("--steps", default="25,50,100")
    ap.add_argument("--production", action="store_true", help="allow an API that is not on localhost")
    ap.add_argument("--max-answer-ms", type=int, default=1000, help="stop once the slowest answer is over this")
    args = ap.parse_args()
    if urlparse(args.api).hostname not in ("127.0.0.1", "localhost") and not args.production:
        print("Not localhost: this runs real games on that server. Add --production to go ahead.", file=sys.stderr)
        return 2
    steps = [int(x) for x in args.steps.split(",")]

    async with httpx.AsyncClient(base_url=args.api, timeout=30) as http:
        start = await http.post("/api/v1/editor/start", params={"edit": "false"})
        start.raise_for_status()
        saved = await http.post("/api/v1/editor/finish", params={"edit_id": start.json()["token"]}, json=QUIZ)
        saved.raise_for_status()
        quiz_id, secret = saved.json()["id"], saved.headers["x-anon-secret"]
        print(f"quiz {quiz_id}")
        held = 0
        try:
            for n in steps:
                try:
                    r = await step(args.api, http, quiz_id, secret, n)
                except Exception as e:  # noqa: BLE001 - any failure ends the ramp
                    print(f"{n} players: failed: {e!r}")
                    break
                print(r)
                if r["answers_received"] < n or (r["answer_max_ms"] or 0) > args.max_answer_ms:
                    print(f"{n} players: over the line, stopping")
                    break
                held = n
        finally:
            d = await http.delete(f"/api/v1/quiz/delete/{quiz_id}", headers={"X-Anon-Secret": secret})
            print(f"quiz deleted: {d.status_code}")
    print(f"held: {held} players")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
