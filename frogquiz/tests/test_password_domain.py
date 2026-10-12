# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Password registration keeps to the allowed domains, like emailed sign-in (audit finding 8).

Passwords are off in production, so the route answers 404 there. The day they come back,
any address could have registered: only the emailed sign-in checked the domain.
"""

from fastapi.testclient import TestClient

from frogquiz.config import settings as get_settings
from frogquiz.tests import test_client  # noqa: F401


def test_an_outside_address_cannot_register_with_a_password(test_client: TestClient, monkeypatch):  # noqa: F811
    monkeypatch.setattr(get_settings(), "allowed_email_domains", ["frog.co"])
    # Not the DNS check on the address: the domain rule alone is under test.
    monkeypatch.setattr(get_settings(), "validate_email_deliverability", False)
    resp = test_client.post(
        "/api/v1/users/create",
        json={"email": "someone@outside-company.com", "password": "outside-password-1", "username": "outsider"},
    )
    assert resp.status_code == 403
    assert "allowed domain" in resp.json()["detail"]
