<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# AI agents (MCP)

Claude, or any agent that speaks the [Model Context Protocol](https://modelcontextprotocol.io),
can list your quizzes and make new ones. For example: "write me a ten-question quiz on the
Q3 launch and put it in my frogQuiz". The agent signs in with a personal key that you make
on My Account.

**It is off by default.** Turning it on for the shared deployment is a joint decision for
François and Gonçalo. The steps are in [DEPLOY.md](../DEPLOY.md#ai-agents-mcp).

## Connecting an agent

1. Go to **My Account**, then **AI agents**. Name a key ("Claude on my laptop") and press
   **Create key**. Copy it: it is shown once, because frogQuiz keeps only its sha256.
2. Connect your agent. The address is the one My Account shows. In production that is
   `https://api.frogquiz.xyz/mcp`, the API's host, not the Netlify site.

**Claude Code.** My Account gives you this command, ready to paste:

```sh
claude mcp add --scope user --transport http frogquiz https://api.frogquiz.xyz/mcp \
  --header "Authorization: Bearer fq_…"
```

`--scope user` makes it available in every folder. Without it, Claude Code saves the server
for the folder the command ran in. On Windows the VS Code extension can then miss it: it
looks the folder up as `c:\…` while the command line saved it as `C:\…`.

**Cursor**, in `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "frogquiz": {
      "url": "https://api.frogquiz.xyz/mcp",
      "headers": { "Authorization": "Bearer fq_…" }
    }
  }
}
```

**Claude Desktop** speaks only stdio to local servers, so it goes through
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) (needs Node). In
`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "frogquiz": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://api.frogquiz.xyz/mcp",
        "--header",
        "Authorization:${FROGQUIZ_AUTH}"
      ],
      "env": { "FROGQUIZ_AUTH": "Bearer fq_…" }
    }
  }
}
```

The header value goes through `env` because Claude Desktop on Windows splits arguments at
spaces.

**claude.ai and the Claude apps' custom connectors are not supported.** They sign in with
OAuth, and frogQuiz issues personal keys rather than running an OAuth server. Adding OAuth
would be its own piece of work.

## What an agent can do

| Tool              | What it does                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `list_my_quizzes` | Your quizzes, most recently changed first: id, title, number of questions, whether public, and links to the editor and the view page. |
| `get_quiz`        | One of your quizzes, with every question and its right answers.                                                                       |
| `create_quiz`     | A new **unlisted** quiz in your account: not in Discover or search, but anyone with its link can open it. Returns its id and links.   |

`create_quiz` takes a title, an optional description and 1 to 50 questions. A question is
`single` (exactly one right answer) or `multiple` (select all that apply, at least one
right). It has 2 to 10 answers and a timer of 5 to 999 seconds (default 20). Text is plain:
markup is stored escaped and shows as typed.

## What an agent cannot do, on purpose

- **Publish.** A quiz an agent makes is unlisted until you open it in the editor and
  publish it yourself. Unlisted is not private: anyone with the link can open it, as with
  any unlisted quiz (MVP.md D13; owner-only Private is #34, after V1). Nothing an agent writes reaches Discover or the search index unseen.
- **Edit or delete.** It can only add.
- **Read anyone else's quiz**, published ones included. A quiz's text reaches the agent as
  input, so a stranger's text could carry instructions to it (prompt injection). The
  server's instructions also tell the agent that quiz text is data, not instructions.
- **Use the other question types or images.** It gets the two types the editor offers
  (`docs/mvp-scope.md`). No image fields means no URL fetching and no upload-ownership
  questions.
- **Use the key for anything else.** The key works on `/api/v1/agent/*`, and on the legacy
  `/live` endpoints that keys were already good for, and nowhere else. A session cookie is
  not accepted there either.

**Limits.** Each account gets 120 agent calls a minute, 30 new quizzes an hour and 200 a
day. A limit answers 429, and the agent is told how long to wait.

## Keys

- A key is `fq_` followed by 43 random base64url characters (32 bytes). The prefix lets
  gitleaks catch one pasted into a commit (`.gitleaks.toml`).
- Only the sha256 is stored. The Redis cache is keyed by the hash too.
- Each account can have up to 10 keys. My Account lists them by name, first characters,
  when each was made and when it was last used.
- **Revoking** a key on My Account takes effect on the next request: the cache entry
  is replaced by a revoked marker that a check running at the same moment cannot overwrite. **Deleting the account** revokes every key, and so does "sign out everywhere"
  (password change or reset, when passwords are on).
- Keys made before 15 Oct were 48 hex characters, stored in plain text. The migration
  hashed them in place, so they still work on `/live`. They do not start with `fq_`, so
  they are not agent keys.

## How it is built

```
agent ──HTTPS, Bearer fq_…──▶ Caddy /mcp* ──▶ mcp-server (MCP SDK, stateless, no DB, no secrets)
                                                 │ the same Authorization header
                                                 ▼
                                   api /api/v1/agent/*  (auth, validation, limits, ownership)
```

- **`frogquiz/routers/agent.py`** is a small REST API, and every rule lives there: whose
  quizzes, which fields, the limits. It is mounted only when `AGENT_API_ENABLED` is true.
  Otherwise it answers 404 before any key is looked at.
- **`mcp-server/`** translates between MCP and that API, and nothing more. It checks a key
  against `/api/v1/agent/me`, then forwards it unchanged, one API call per tool. It cannot
  loosen a rule because it has none of its own.
- **Why it is a separate service.** The API's `ormar` pins pydantic below 2.9. Every MCP
  SDK release with no known advisory needs a newer one; the last that fits, 1.12.4, has
  three (PYSEC-2026-1617, -3482, -3483). So the SDK gets its own environment, lock and
  image.
- It is stateless and returns JSON, so any number of replicas can answer any request. It
  turns away a request that carries an `Origin` header, so a web page cannot drive it from
  someone's browser. It answers only the hosts in `MCP_ALLOWED_HOSTS` (DNS-rebinding
  protection), and caps a request body at 256 KB.
- **Licences.** `mcp` is MIT. Everything in `mcp-server/Pipfile.lock` was checked on 15 Oct:
  MIT, BSD, Apache-2.0, PSF, MIT-0, and MPL-2.0 for certifi. Nothing is copyleft. Check
  again when adding a package. `audit.yml` runs pip-audit over this lock as it does over
  the API's.

## Running it locally

`bash e2e/run.sh` starts the MCP service on 8020 when `mcp-server/.venv` exists (or
`MCP_VENV` names a venv), and points My Account's command at it. To make the venv:

```sh
cd mcp-server && PIPENV_VENV_IN_PROJECT=1 pipenv sync --dev
```

The service's own tests: `cd mcp-server && pipenv run pytest`. The API side is
`frogquiz/tests/test_agent_api.py` and `test_api_keys.py`, and the browser side is
`frontend/e2e/agent-keys.e2e.ts`.

| Variable            | Where | Default                      | What                                                                    |
| ------------------- | ----- | ---------------------------- | ----------------------------------------------------------------------- |
| `AGENT_API_ENABLED` | API   | `false`                      | The agent API and the My Account section.                               |
| `MCP_URL`           | API   | unset                        | What My Account tells people to connect to. Unset: no command is shown. |
| `FROGQUIZ_API_URL`  | MCP   | `http://api:80`              | Where the API is, from inside the network.                              |
| `MCP_PUBLIC_URL`    | MCP   | `http://localhost:8020`      | Its public origin, e.g. `https://api.frogquiz.xyz`.                     |
| `MCP_ALLOWED_HOSTS` | MCP   | the host of `MCP_PUBLIC_URL` | Comma-separated `Host` values it answers.                               |
