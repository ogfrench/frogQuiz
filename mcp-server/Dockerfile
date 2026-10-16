# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

# The MCP service (docs/mcp.md). No database, no secrets: it forwards each caller's key
# to the API. Started by `docker compose --profile mcp up -d`.

# pipenv only turns the lock into a hash-pinned requirements file; it does not ship.
FROM python:3.13-slim AS lock
RUN pip install --no-cache-dir pipenv
WORKDIR /src
COPY Pipfile Pipfile.lock ./
RUN pipenv requirements --hash > requirements.txt

FROM python:3.13-slim
WORKDIR /app
COPY --from=lock /src/requirements.txt .
# --require-hashes: what is installed is byte for byte what the lock names.
RUN pip install --no-cache-dir --require-hashes -r requirements.txt \
    && useradd --system --uid 10001 --no-create-home mcp
COPY frogquiz_mcp/ ./frogquiz_mcp/
USER mcp
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz', timeout=4)"]
# Behind Caddy, which keeps the public Host header that MCP_ALLOWED_HOSTS checks.
CMD ["uvicorn", "frogquiz_mcp.server:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
