# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The agent API (/api/v1/agent), which the MCP service in mcp-server/ calls.

What an agent may do is less than what the editor may, on purpose: its own quizzes only,
private ones only, the editor's two question types, no images. docs/mcp.md has the why.
"""

import copy
import uuid

import pytest
from fastapi.testclient import TestClient

import frogquiz.routers.agent as agent
from frogquiz.config import settings as get_settings
from frogquiz.tests import example_quiz, test_client  # noqa: F401
from frogquiz.tests.test_api_keys import PASSWORD, _login

pytestmark = pytest.mark.order(-1)


def _quiz(**overrides):
    body = {
        "title": "Frogs of Europe",
        "description": "A short one",
        "questions": [
            {
                "question": "Which of these is a frog?",
                "answers": [{"text": "Common frog", "right": True}, {"text": "Newt", "right": False}],
            },
            {
                "question": "Pick every amphibian",
                "type": "multiple",
                "time": 30,
                "answers": [
                    {"text": "Toad", "right": True},
                    {"text": "Salamander", "right": True},
                    {"text": "Lizard", "right": False},
                ],
            },
        ],
    }
    body.update(overrides)
    return body


@pytest.fixture(scope="module")
def accounts(test_client: TestClient):  # noqa: F811
    owner = _login(test_client, "agent-owner@byom.de", "agentowner")
    other = _login(test_client, "agent-other@byom.de", "agentother")
    owner_key = test_client.post("/api/v1/users/api_keys", json={"name": "test"}, cookies=owner).json()["key"]
    other_key = test_client.post("/api/v1/users/api_keys", json={"name": "test"}, cookies=other).json()["key"]
    yield {"owner": owner, "other": other, "owner_key": owner_key, "other_key": other_key}
    for cookies in (owner, other):
        test_client.request("DELETE", "/api/v1/users/me", json={"password": PASSWORD}, cookies=cookies)


def _auth(key: str) -> dict:
    return {"Authorization": f"Bearer {key}"}


def test_create_list_and_get_a_quiz(test_client, accounts):  # noqa: F811
    made = test_client.post("/api/v1/agent/quizzes", json=_quiz(), headers=_auth(accounts["owner_key"]))
    assert made.status_code == 201, made.text
    body = made.json()
    assert body["public"] is False and body["questions"] == 2
    assert body["edit_url"].endswith(f"/edit?quiz_id={body['id']}")

    listed = test_client.get("/api/v1/agent/quizzes", headers=_auth(accounts["owner_key"])).json()
    assert body["id"] in [q["id"] for q in listed["quizzes"]]

    got = test_client.get(f"/api/v1/agent/quizzes/{body['id']}", headers=_auth(accounts["owner_key"])).json()
    assert got["title"] == "Frogs of Europe"
    assert [q["type"] for q in got["questions"]] == ["single", "multiple"]
    assert got["questions"][0]["time"] == "20"
    assert got["questions"][1]["answers"][1] == {"text": "Salamander", "right": True}

    # It is a real quiz: the editor's own read sees it in the owner's account, private.
    editor_view = test_client.get(f"/api/v1/quiz/get/{body['id']}", cookies=accounts["owner"])
    assert editor_view.status_code == 200
    assert editor_view.json()["public"] is False


def test_markup_is_stored_as_text(test_client, accounts):  # noqa: F811
    nasty = "<img src=x onerror=alert(1)> & co"
    made = test_client.post(
        "/api/v1/agent/quizzes", json=_quiz(title=nasty), headers=_auth(accounts["owner_key"])
    ).json()
    stored = test_client.get(f"/api/v1/quiz/get/{made['id']}", cookies=accounts["owner"]).json()["title"]
    assert "<img" not in stored and "&lt;img" in stored
    got = test_client.get(f"/api/v1/agent/quizzes/{made['id']}", headers=_auth(accounts["owner_key"])).json()
    assert got["title"] == nasty


def test_another_accounts_quiz_is_a_404_and_not_listed(test_client, accounts):  # noqa: F811
    made = test_client.post("/api/v1/agent/quizzes", json=_quiz(), headers=_auth(accounts["owner_key"])).json()
    other = _auth(accounts["other_key"])
    assert test_client.get(f"/api/v1/agent/quizzes/{made['id']}", headers=other).status_code == 404
    assert test_client.get(f"/api/v1/agent/quizzes/{uuid.uuid4()}", headers=other).status_code == 404
    listed = test_client.get("/api/v1/agent/quizzes", headers=other).json()["quizzes"]
    assert made["id"] not in [q["id"] for q in listed]


def test_a_public_quiz_of_someone_else_is_still_a_404(test_client, accounts):  # noqa: F811
    # Its text would reach the agent as input, so not even a published quiz is readable.
    token = test_client.post("/api/v1/editor/start?edit=false", cookies=accounts["other"]).json()["token"]
    body = copy.deepcopy(example_quiz)
    quiz_id = test_client.post(f"/api/v1/editor/finish?edit_id={token}", json=body, cookies=accounts["other"]).json()[
        "id"
    ]
    assert test_client.get(f"/api/v1/agent/quizzes/{quiz_id}", headers=_auth(accounts["owner_key"])).status_code == 404


def test_an_editor_quiz_with_other_types_reads_back(test_client, accounts):  # noqa: F811
    token = test_client.post("/api/v1/editor/start?edit=false", cookies=accounts["owner"]).json()["token"]
    body = copy.deepcopy(example_quiz)
    body["questions"].append(
        {
            "type": "TEXT",
            "question": "Young frog?",
            "time": "10",
            "answers": [{"answer": "Tadpole", "case_sensitive": False}],
        }
    )
    quiz_id = test_client.post(f"/api/v1/editor/finish?edit_id={token}", json=body, cookies=accounts["owner"]).json()[
        "id"
    ]
    got = test_client.get(f"/api/v1/agent/quizzes/{quiz_id}", headers=_auth(accounts["owner_key"]))
    assert got.status_code == 200
    assert got.json()["questions"][-1]["type"] == "text"


@pytest.mark.parametrize(
    "change",
    [
        # Two right answers on a single-answer question: refused, not silently trimmed.
        lambda q: q["questions"][0]["answers"].__setitem__(1, {"text": "Newt", "right": True}),
        # No right answer.
        lambda q: q["questions"][0]["answers"].__setitem__(0, {"text": "Common frog", "right": False}),
        # One answer.
        lambda q: q["questions"][0].__setitem__("answers", [{"text": "Only", "right": True}]),
        # A cut question type.
        lambda q: q["questions"][0].__setitem__("type", "text"),
        # Fields an agent may not set: images, publishing, the raw type.
        lambda q: q["questions"][0].__setitem__("image", "https://example.com/x.png"),
        lambda q: q.__setitem__("public", True),
        lambda q: q.__setitem__("cover_image", "x"),
        lambda q: q["questions"][0].__setitem__("time", 4),
        lambda q: q["questions"][0].__setitem__("time", 1000),
        lambda q: q.__setitem__("title", "   "),
        lambda q: q.__setitem__("title", "x" * 101),
        lambda q: q["questions"][0].__setitem__("question", "x" * 251),
        lambda q: q["questions"][0]["answers"][0].__setitem__("text", "x" * 101),
        lambda q: q.__setitem__("questions", []),
        lambda q: q.__setitem__("questions", q["questions"][:1] * 51),
    ],
)
def test_what_an_agent_may_not_make(test_client, accounts, change):  # noqa: F811
    body = copy.deepcopy(_quiz())
    change(body)
    resp = test_client.post("/api/v1/agent/quizzes", json=body, headers=_auth(accounts["owner_key"]))
    assert resp.status_code == 422, resp.text


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Bearer "},
        {"Authorization": "Bearer fq_not-a-real-key"},
        {"Authorization": "Basic fq_whatever"},
        # A key made before 15 Oct: 48 hex characters, good for /live only.
        {"Authorization": "Bearer " + "a" * 48},
        {"Authorization": "Bearer fq_" + "x" * 500},
    ],
)
def test_no_valid_key_is_a_401(test_client, headers):  # noqa: F811
    resp = test_client.get("/api/v1/agent/quizzes", headers=headers)
    assert resp.status_code == 401
    assert resp.json()["detail"].startswith("A frogQuiz agent key is required")


def test_a_session_cookie_is_not_an_agent_key(test_client, accounts):  # noqa: F811
    assert test_client.get("/api/v1/agent/quizzes", cookies=accounts["owner"]).status_code == 401


def test_an_agent_key_is_not_a_session(test_client, accounts):  # noqa: F811
    # The other direction: a key is no way into the rest of the API.
    headers = _auth(accounts["owner_key"])
    assert test_client.get("/api/v1/quiz/list", headers=headers).status_code == 401
    assert test_client.get("/api/v1/users/me", headers=headers).status_code == 401
    assert (
        test_client.get("/api/v1/quiz/list", cookies={"access_token": f"Bearer {accounts['owner_key']}"}).status_code
        == 401
    )


def test_a_key_in_the_query_string_is_ignored(test_client, accounts):  # noqa: F811
    assert test_client.get(f"/api/v1/agent/quizzes?api_key={accounts['owner_key']}").status_code == 401


def test_off_means_404_before_the_key_is_looked_at(test_client, accounts, monkeypatch):  # noqa: F811
    monkeypatch.setattr(agent.settings, "mcp_url", "https://api.example/mcp")
    monkeypatch.setattr(agent.settings, "agent_api_enabled", False)
    assert test_client.get("/api/v1/agent/me", headers=_auth(accounts["owner_key"])).status_code == 404
    assert test_client.get("/api/v1/agent/me").status_code == 404
    config = test_client.get("/api/v1/utils/config").json()
    # Off, My Account hides the section, and nothing advertises where agents would connect.
    assert config["agent_api_enabled"] is False and config["mcp_url"] is None


def test_on_the_config_says_where_agents_connect(test_client, monkeypatch):  # noqa: F811
    monkeypatch.setattr(agent.settings, "mcp_url", "https://api.example/mcp")
    config = test_client.get("/api/v1/utils/config").json()
    assert config["agent_api_enabled"] is True and config["mcp_url"] == "https://api.example/mcp"
    # Compose passes an unset MCP_URL through as "": no command is better than a broken one.
    monkeypatch.setattr(agent.settings, "mcp_url", "")
    assert test_client.get("/api/v1/utils/config").json()["mcp_url"] is None


def test_creating_too_fast_is_a_429(test_client, accounts, monkeypatch):  # noqa: F811
    monkeypatch.setattr(get_settings(), "rate_limit_enabled", True)
    monkeypatch.setattr(agent, "CREATES_PER_HOUR", 1)
    owner = _auth(accounts["other_key"])
    first = test_client.post("/api/v1/agent/quizzes", json=_quiz(), headers=owner)
    second = test_client.post("/api/v1/agent/quizzes", json=_quiz(), headers=owner)
    assert first.status_code == 201
    assert second.status_code == 429 and "Retry-After" in second.headers


def test_checking_a_key_is_not_billed_as_a_call(test_client, accounts, monkeypatch):  # noqa: F811
    # The MCP service asks /me before every request. A key out of calls is still a valid
    # key, so the tool call is what says 429 and how long to wait, not /me as a 401.
    monkeypatch.setattr(get_settings(), "rate_limit_enabled", True)
    monkeypatch.setattr(agent, "CALLS_PER_MINUTE", 1)
    headers = _auth(accounts["other_key"])
    calls = [test_client.get("/api/v1/agent/quizzes", headers=headers).status_code for _ in range(2)]
    assert calls[-1] == 429
    assert test_client.get("/api/v1/agent/me", headers=headers).status_code == 200


def test_list_pages(test_client, accounts):  # noqa: F811
    headers = _auth(accounts["owner_key"])
    first = test_client.get("/api/v1/agent/quizzes?page_size=1", headers=headers).json()
    assert len(first["quizzes"]) == 1 and first["has_more"] is True
    assert test_client.get("/api/v1/agent/quizzes?page_size=101", headers=headers).status_code == 422
