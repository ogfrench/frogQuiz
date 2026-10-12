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


def test_the_api_and_the_worker_report_their_health():
    # #60: nothing said when either one stopped. The worker's check reads the key the
    # worker writes, so a rename on one side only would mark a live worker unhealthy.
    from frogquiz.config import WORKER_HEARTBEAT_KEY
    from frogquiz.routers.health import WORKER_STALE_AFTER_SECONDS

    services = _services()
    assert "'http://localhost/api/v1/health'" in " ".join(services["api"]["healthcheck"]["test"])
    worker = " ".join(services["worker"]["healthcheck"]["test"])
    assert f"'{WORKER_HEARTBEAT_KEY}'" in worker
    # The container and the endpoint call the same beat stale.
    assert f"< {WORKER_STALE_AFTER_SECONDS} " in worker


class _ComposeLoader(yaml.SafeLoader):
    """Reads compose's `!override` tag, which safe_load refuses."""


def _override(loader, node):
    if isinstance(node, yaml.MappingNode):
        return loader.construct_mapping(node, deep=True)
    return loader.construct_sequence(node, deep=True)


_ComposeLoader.add_constructor("!override", _override)


def test_the_api_and_the_worker_wait_for_healthy_dependencies():
    # In both files: production runs docker-compose.neon.yml on top, whose `!override`
    # replaces the base file's list rather than merging into it.
    neon = yaml.load((COMPOSE.parent / "docker-compose.neon.yml").read_text(), Loader=_ComposeLoader)["services"]
    for services in (_services(), neon):
        for name in ("api", "worker"):
            depends = services[name]["depends_on"]
            assert isinstance(depends, dict), f"{name} waits for containers, not for health"
            assert all(d["condition"] == "service_healthy" for d in depends.values()), name


def test_ci_runs_the_search_production_runs():
    # The backend suite's compose ran Meilisearch v1.7 while production ran v1.54.3.
    dev = yaml.safe_load((COMPOSE.parent / "docker-compose.dev.yml").read_text())["services"]
    assert dev["meilisearch"]["image"] == _services()["meilisearch"]["image"]
