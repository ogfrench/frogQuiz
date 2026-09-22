# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""In-memory Redis for local end-to-end runs, so no Redis install is needed.

State lives only in this process, so every run starts with an empty cache -- the
warm-cache 401 cascade described in CLAUDE.md cannot happen here.
"""

import sys

from fakeredis import TcpFakeServer

port = int(sys.argv[1]) if len(sys.argv) > 1 else 6379
server = TcpFakeServer(("127.0.0.1", port), server_type="redis")
print(f"fakeredis listening on 127.0.0.1:{port}", flush=True)
server.serve_forever()
