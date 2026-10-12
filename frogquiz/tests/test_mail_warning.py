# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The boot warning when no mail server is configured says who can still sign in."""

from frogquiz import no_mail_warning
from frogquiz.config import settings


def _with(**changes):
    return settings().model_copy(update=changes)


def test_without_mail_or_another_way_in_nobody_can_sign_in():
    s = _with(enable_password_login=False, google_client_id=None, github_client_id=None, custom_openid_provider=None)
    assert "Nobody can sign in" in no_mail_warning(s)


def test_an_oauth_provider_still_signs_people_in():
    s = _with(enable_password_login=False, google_client_id="id", github_client_id=None, custom_openid_provider=None)
    assert "Nobody" not in no_mail_warning(s)
    assert "Google" in no_mail_warning(s)


def test_with_passwords_on_only_recovery_is_lost():
    s = _with(enable_password_login=True, skip_email_verification=True)
    assert no_mail_warning(s) == "Password recovery is unavailable."
