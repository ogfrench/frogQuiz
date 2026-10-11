# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The worker sees the same files as the API (V1 readiness review, 11 Oct).

The worker runs the API's code with the API's settings, so with the local storage backend
it reads and deletes the same upload folder. Only `api` mounted it. The worker's
`/app/data` was an empty folder inside its own container, so on the VM every upload's hash,
size and thumbnail failed (the bytes were never counted against the owner), and every image
the worker freed lost its row but kept its file. The e2e stack runs both processes on one
machine with one STORAGE_PATH, which is why nothing caught it.
"""

from pathlib import Path

import yaml

COMPOSE = Path(__file__).resolve().parents[2] / "docker-compose.yml"


def _services():
    return yaml.safe_load(COMPOSE.read_text())["services"]


def test_the_worker_mounts_every_volume_the_api_does():
    services = _services()
    api = set(services["api"].get("volumes", []))
    worker = set(services["worker"].get("volumes", []))
    assert api, "the api service mounts nothing; this test no longer checks anything"
    assert api <= worker, f"mounted by the api but not the worker: {sorted(api - worker)}"


def test_the_worker_runs_with_the_api_settings():
    services = _services()
    assert services["worker"]["environment"] == services["api"]["environment"]


def test_ci_runs_the_search_production_runs():
    # The backend suite's compose ran Meilisearch v1.7 while production ran v1.54.3.
    dev = yaml.safe_load((COMPOSE.parent / "docker-compose.dev.yml").read_text())["services"]
    assert dev["meilisearch"]["image"] == _services()["meilisearch"]["image"]
