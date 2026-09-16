# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""What the mail sender will and will not retry.

The distinction is the whole point of the retry loop: a 4xx from a relay means
"not now" and a 5xx means "not ever". Retrying a permanent failure turns one
clear error into the same error three times over, and makes a registration --
which blocks on this send -- take three timeouts to fail.

The case that motivated it is real: sending from an unverified domain returns
550, and retrying that would have made every registration attempt during the
Resend setup take 2 x SMTP_TIMEOUT_SECONDS plus backoff before reporting the
failure it already knew about on the first try.
"""

import smtplib

from frogquiz.emails import MailNotConfigured, _is_retryable


class TestRetryClassification:
    def test_permanent_smtp_failures_are_not_retried(self):
        # The exact error Resend returns for a domain that has not been verified.
        unverified_domain = smtplib.SMTPDataError(550, b"The send.frogquiz.xyz domain is not verified.")
        assert _is_retryable(unverified_domain) is False

        assert _is_retryable(smtplib.SMTPSenderRefused(553, b"Sender rejected", "noreply@example.com")) is False
        assert _is_retryable(smtplib.SMTPRecipientsRefused({"a@example.com": (550, b"No such user")})) is False

    def test_bad_credentials_are_not_retried(self):
        """Hammering a relay with a credential it has already rejected is how an
        account gets rate-limited or locked, and the second attempt cannot succeed."""
        assert _is_retryable(smtplib.SMTPAuthenticationError(535, b"Invalid credentials")) is False

    def test_missing_configuration_is_not_retried(self):
        assert _is_retryable(MailNotConfigured("MAIL_SERVER and MAIL_ADDRESS are not set")) is False

    def test_transient_smtp_failures_are_retried(self):
        # 4xx is the relay saying "try again later" -- greylisting, or a full queue.
        assert _is_retryable(smtplib.SMTPDataError(451, b"Temporary local problem")) is True
        assert _is_retryable(smtplib.SMTPResponseException(421, b"Service not available")) is True

    def test_network_failures_are_retried(self):
        """The case that costs a user their confirmation link: the relay was briefly
        unreachable, the single attempt failed, and the endpoint reported success
        anyway because it swallows send failures by design."""
        assert _is_retryable(smtplib.SMTPServerDisconnected("connection closed")) is True
        assert _is_retryable(smtplib.SMTPConnectError(421, b"Cannot connect")) is True
        assert _is_retryable(TimeoutError("timed out")) is True
        assert _is_retryable(ConnectionResetError("reset by peer")) is True

    def test_an_unrecognised_error_is_not_retried(self):
        """Anything not positively identified as transient is treated as permanent.
        Failing once and saying so beats failing three times slowly."""
        assert _is_retryable(ValueError("something else entirely")) is False
