# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The MCP service, driven over its wire protocol with a fake API behind it.

The API's own rules are tested in frogquiz/tests/test_agent_api.py. What is tested here is
that this service adds no way round them: no key, no call; the caller's key and nothing
else is what reaches the API; and nothing it answers repeats the key.
"""

import json

import httpx
import pytest
from mcp.types.version import HANDSHAKE_PROTOCOL_VERSIONS, LATEST_HANDSHAKE_VERSION
from starlette.testclient import TestClient

from frogquiz_mcp import server

KEY = "fq_" + "k" * 43
# What clients send today: an initialize handshake, then the version in a header. The SDK
# also speaks the stateless 2026 revision, which no client in use sends yet.
VERSION = LATEST_HANDSHAKE_VERSION
HOST = "mcp.test"


class FakeApi:
    """Stands in for frogquiz/routers/agent.py and records what reached it."""

    def __init__(self):
        self.calls: list[httpx.Request] = []
        self.create_status = 201
        self.create_body: object = {"id": "5f0c1d2e-0000-4000-8000-000000000001", "public": False}

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        if request.headers.get("Authorization") != f"Bearer {KEY}":
            return httpx.Response(401, json={"detail": "A frogQuiz agent key is required."})
        if request.url.path == "/api/v1/agent/me":
            return httpx.Response(200, json={"username": "kermit"})
        if request.url.path == "/api/v1/agent/quizzes" and request.method == "POST":
            return httpx.Response(self.create_status, json=self.create_body)
        if request.url.path == "/api/v1/agent/quizzes":
            return httpx.Response(200, json={"quizzes": [], "page": 1, "has_more": False})
        return httpx.Response(404, json={"detail": "No quiz of yours has that id"})

    def tool_calls(self):
        return [c for c in self.calls if c.url.path != "/api/v1/agent/me"]


@pytest.fixture
def api(monkeypatch):
    fake = FakeApi()
    monkeypatch.setattr(server, "_transport", httpx.MockTransport(fake.handler))
    return fake


@pytest.fixture
def client():
    # conftest.py sets MCP_ALLOWED_HOSTS to this host. A fresh app per test: its session
    # manager can be started only once.
    with TestClient(server.build_app(), base_url=f"http://{HOST}") as c:
        yield c


def rpc(client, method, params=None, key=KEY, headers=None, id_=1, version=VERSION):
    h = {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
        "MCP-Protocol-Version": version,
    }
    if key is not None:
        h["Authorization"] = f"Bearer {key}"
    h.update(headers or {})
    body = {"jsonrpc": "2.0", "id": id_, "method": method}
    if params is not None:
        body["params"] = params
    return client.post("/mcp", headers=h, content=json.dumps(body))


def initialize(client, version=VERSION, **kw):
    return rpc(
        client,
        "initialize",
        {
            "protocolVersion": version,
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "0"},
        },
        version=version,
        **kw,
    )


@pytest.mark.parametrize("version", HANDSHAKE_PROTOCOL_VERSIONS)
def test_every_handshake_version_a_client_may_send_works(client, api, version):
    init = initialize(client, version=version)
    assert init.status_code == 200, init.text
    assert init.json()["result"]["protocolVersion"] == version
    listed = rpc(client, "tools/list", version=version)
    assert len(listed.json()["result"]["tools"]) == 3


def call(client, name, arguments, **kw):
    resp = rpc(client, "tools/call", {"name": name, "arguments": arguments}, **kw)
    assert resp.status_code == 200, resp.text
    return resp.json()["result"]


def test_it_speaks_mcp_and_offers_three_tools(client, api):
    init = initialize(client)
    assert init.status_code == 200, init.text
    assert init.json()["result"]["serverInfo"]["name"] == "frogQuiz"
    tools = {t["name"]: t for t in rpc(client, "tools/list").json()["result"]["tools"]}
    assert set(tools) == {"list_my_quizzes", "get_quiz", "create_quiz"}
    assert tools["list_my_quizzes"]["annotations"]["readOnlyHint"] is True
    assert tools["create_quiz"]["annotations"]["destructiveHint"] is False
    schema = json.dumps(tools["create_quiz"]["inputSchema"])
    assert '"single"' in schema and '"multiple"' in schema


@pytest.mark.parametrize("key", [None, "", "not-a-frogquiz-key", "a" * 48, "fq_" + "x" * 200])
def test_no_usable_key_is_a_401_and_reaches_nothing(client, api, key):
    assert initialize(client, key=key).status_code == 401
    # A key without the prefix, or too long, is turned away without asking the API.
    if key is None or not key.startswith("fq_") or len(key) > server.MAX_KEY_LENGTH:
        assert api.calls == []


def test_a_key_the_api_refuses_is_a_401(client, api):
    assert initialize(client, key="fq_" + "w" * 43).status_code == 401
    assert [c.url.path for c in api.calls] == ["/api/v1/agent/me"]


def test_create_forwards_the_quiz_and_the_callers_key(client, api):
    quiz = {
        "title": "Ponds",
        "questions": [
            {"question": "Wettest?", "answers": [{"text": "Pond", "right": True}, {"text": "Desert", "right": False}]}
        ],
    }
    result = call(client, "create_quiz", quiz)
    assert result.get("isError") is not True, result
    (sent,) = api.tool_calls()
    assert sent.method == "POST" and sent.url.path == "/api/v1/agent/quizzes"
    assert sent.headers["Authorization"] == f"Bearer {KEY}"
    body = json.loads(sent.content)
    assert body["title"] == "Ponds" and body["description"] == ""
    assert body["questions"][0]["type"] == "single" and body["questions"][0]["time"] == 20
    assert json.loads(result["content"][0]["text"])["id"] == api.create_body["id"]


def test_the_apis_refusal_comes_back_readable_and_without_the_key(client, api):
    api.create_status = 422
    api.create_body = {
        "detail": [{"loc": ["body", "questions", 0], "msg": "Value error, mark at least one answer right"}]
    }
    quiz = {
        "title": "Ponds",
        "questions": [
            {"question": "Wettest?", "answers": [{"text": "Pond", "right": False}, {"text": "Desert", "right": False}]}
        ],
    }
    result = call(client, "create_quiz", quiz)
    assert result["isError"] is True
    text = result["content"][0]["text"]
    assert "questions.0: Value error, mark at least one answer right" in text
    assert KEY not in json.dumps(result)


def test_a_bad_quiz_id_never_reaches_the_api(client, api):
    result = call(client, "get_quiz", {"quiz_id": "../users/me"})
    assert result["isError"] is True
    assert api.tool_calls() == []


def test_get_quiz_asks_for_exactly_that_id(client, api):
    quiz_id = "5f0c1d2e-0000-4000-8000-000000000001"
    result = call(client, "get_quiz", {"quiz_id": quiz_id})
    # The fake has no quizzes, so the API's 404 comes back as the tool's error.
    assert result["isError"] is True and "No quiz of yours" in result["content"][0]["text"]
    (sent,) = api.tool_calls()
    assert sent.url.path == f"/api/v1/agent/quizzes/{quiz_id}"


def test_list_passes_paging(client, api):
    result = call(client, "list_my_quizzes", {"page": 2, "page_size": 5})
    assert result.get("isError") is not True
    (sent,) = api.tool_calls()
    assert dict(sent.url.params) == {"page": "2", "page_size": "5"}


def test_a_browser_origin_is_turned_away(client, api):
    assert initialize(client, headers={"Origin": "https://evil.example"}).status_code == 403


def test_an_unknown_host_is_turned_away(client, api):
    # DNS rebinding: a name that resolves here but is not this server's.
    assert initialize(client, headers={"Host": "attacker.example"}).status_code in (403, 421)


def test_health_needs_no_key(client):
    assert client.get("/healthz").text == "ok"


@pytest.mark.parametrize(
    "configured, expected",
    [
        ("", ["api.frogquiz.xyz"]),
        ("  ", ["api.frogquiz.xyz"]),
        ("a.example, b.example:8443", ["a.example", "b.example:8443"]),
    ],
)
def test_allowed_hosts_fall_back_to_the_public_url(configured, expected):
    # docker-compose passes an unset MCP_ALLOWED_HOSTS through as "", which once meant
    # no host at all, and every request turned away.
    assert server.allowed_hosts("https://api.frogquiz.xyz", configured.strip()) == expected


def test_an_answer_that_is_not_the_api_is_an_error_not_a_crash(client, api):
    # A proxy's HTML error page in place of the API's JSON.
    api.create_status = 200
    api.create_body = ["not", "an", "object"]
    quiz = {
        "title": "Ponds",
        "questions": [
            {"question": "Wettest?", "answers": [{"text": "Pond", "right": True}, {"text": "Desert", "right": False}]}
        ],
    }
    result = call(client, "create_quiz", quiz)
    assert result["isError"] is True and "could not read" in result["content"][0]["text"]
