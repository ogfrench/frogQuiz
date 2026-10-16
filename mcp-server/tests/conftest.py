# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

import os

# Read once, when frogquiz_mcp.server is imported, so they are set before any test imports it.
os.environ["MCP_PUBLIC_URL"] = "http://mcp.test"
os.environ["MCP_ALLOWED_HOSTS"] = "mcp.test"
os.environ["FROGQUIZ_API_URL"] = "http://api.test"
