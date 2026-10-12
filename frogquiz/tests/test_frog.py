# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""A person picks the frog on their account pages (François, 12 Oct).

None means the frontend picks one from the username. Only the shape of the name is
checked; a name with no file behind it falls back on the page.
"""

import pytest
from fastapi.testclient import TestClient

from frogquiz.tests import test_client  # noqa: F401
from frogquiz.tests.test_claim_races import PASSWORD, _sign_up

pytestmark = pytest.mark.order(-1)


@pytest.fixture(scope="module")
def frog_fan(test_client: TestClient):  # noqa: F811
    made = _sign_up(test_client, "frog-fan")
    yield made["cookies"]
    resp = test_client.request("DELETE", "/api/v1/users/me", json={"password": PASSWORD}, cookies=made["cookies"])
    assert resp.status_code == 200
    test_client.cookies.clear()


def _me(client: TestClient, cookies):
    return client.get("/api/v1/users/me", cookies=cookies).json()


def test_an_account_starts_with_no_frog_picked(test_client: TestClient, frog_fan):  # noqa: F811
    assert _me(test_client, frog_fan)["frog"] is None


def test_a_picked_frog_is_kept_and_shown_at_once(test_client: TestClient, frog_fan):  # noqa: F811
    resp = test_client.put("/api/v1/users/me/frog", json={"frog": "2-14"}, cookies=frog_fan)
    assert resp.status_code == 200
    assert resp.json() == {"frog": "2-14"}
    # Read through the cached account: /me must not answer with the frog from before.
    assert _me(test_client, frog_fan)["frog"] == "2-14"
    test_client.put("/api/v1/users/me/frog", json={"frog": None}, cookies=frog_fan)
    assert _me(test_client, frog_fan)["frog"] is None


@pytest.mark.parametrize("bad", ["frog-2-14", "2-1", "22-14", "", "2-14; drop", "../x"])
def test_a_name_of_the_wrong_shape_is_refused(test_client: TestClient, frog_fan, bad):  # noqa: F811
    assert test_client.put("/api/v1/users/me/frog", json={"frog": bad}, cookies=frog_fan).status_code == 422


def test_signed_out_cannot_pick(test_client: TestClient):  # noqa: F811
    assert test_client.put("/api/v1/users/me/frog", json={"frog": "1-01"}).status_code == 401
