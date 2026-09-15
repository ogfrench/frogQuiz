# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
#
# SPDX-License-Identifier: MPL-2.0
import asyncio
import logging
import os
import re
import smtplib
import ssl
from email.headerregistry import Address
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid

from jinja2 import Environment, PackageLoader, select_autoescape

from frogquiz.config import settings, redis
from frogquiz.db.models import User

settings = settings()

jinja = Environment(
    loader=PackageLoader("frogquiz.emails", "templates"),
    autoescape=select_autoescape(["html", "xml"]),
    enable_async=True,
)


LOGGER = logging.getLogger("frogquiz.emails")

# smtplib is blocking, and every call here used to be made straight from an async
# request handler -- so a slow or unreachable mail server stalled the whole event
# loop, live games included, for as long as the TCP connect took to give up.
SMTP_TIMEOUT_SECONDS = 15

# Matches the wording in forgotten_password.jinja2 -- change both together.
RESET_TOKEN_TTL_SECONDS = 3600


class MailNotConfigured(RuntimeError):
    """Raised when something wants to send mail and no relay has been set up."""


_TAG_RE = re.compile(r"<[^>]+>")


def _plaintext_from(html_body: str, fallback_url: str | None) -> str:
    """A readable text/plain part.

    MIMEMultipart("alternative") promises two representations and the old code only
    ever attached one, which is a spam-filter signal and leaves plain-text clients
    with an empty message. This is not a full HTML-to-text pass -- the templates are
    a table layout around a single link -- so the link is what has to survive.
    """
    text = _TAG_RE.sub(" ", html_body)
    text = re.sub(r"\s+", " ", text).strip()
    if fallback_url:
        text = f"{text}\n\n{fallback_url}"
    return text


def _sendMail_blocking(template: str, to: str, subject: str, link: str | None) -> None:
    if not settings.mail_configured:
        raise MailNotConfigured("MAIL_SERVER and MAIL_ADDRESS are not set")
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    # A bare address in From reads as "noreply@..." in every client. The display
    # name costs nothing and makes the message recognisable in a crowded inbox.
    local, _, domain = settings.mail_address.partition("@")
    msg["From"] = str(Address(settings.mail_from_name, local, domain)) if domain else settings.mail_address
    msg["To"] = to
    msg["Date"] = formatdate(localtime=True)
    # Without a Message-ID the relay makes one up, or the message is scored as
    # machine-generated spam. Keyed to the sending domain, as receivers expect.
    msg["Message-ID"] = make_msgid(domain=domain or None)
    # text/plain first: in a multipart/alternative the last part is the preferred
    # one, so the HTML has to come second or clients will show the fallback.
    msg.attach(MIMEText(_plaintext_from(template, link), "plain", "utf-8"))
    msg.attach(MIMEText(template, "html", "utf-8"))

    context = ssl.create_default_context()
    # Closed on every path: the old code never called quit(), so a server that
    # accepted the connection and then failed on login leaked it until GC.
    if settings.mail_security == "ssl":
        server_cm = smtplib.SMTP_SSL(
            host=settings.mail_server,
            port=settings.mail_port,
            timeout=SMTP_TIMEOUT_SECONDS,
            context=context,
        )
    else:
        server_cm = smtplib.SMTP(host=settings.mail_server, port=settings.mail_port, timeout=SMTP_TIMEOUT_SECONDS)
    with server_cm as server:
        server.ehlo()
        if settings.mail_security == "starttls":
            server.starttls(context=context)
            server.ehlo()
        # Some relays (a local postfix, an internal smarthost) take no credentials
        # at all, and AUTH against them fails outright.
        if settings.mail_username and settings.mail_password:
            server.login(settings.mail_username, settings.mail_password)
        server.sendmail(settings.mail_address, to, msg.as_string())


async def _sendMail(template: str, to: str, subject: str, link: str | None = None) -> None:
    """Send mail off the event loop. Raises on failure -- callers decide what that means."""
    await asyncio.to_thread(_sendMail_blocking, template, to, subject, link)


async def send_register_email(user: User):
    if user is None:
        raise ValueError("User not found")
    link = f"{settings.root_address}/api/v1/users/verify/{user.verify_key}"
    template = jinja.get_template("register.jinja2")
    template = await template.render_async(base_url=settings.root_address, token=user.verify_key)
    await _sendMail(template=template, to=user.email, subject="Confirm your frogQuiz address", link=link)


async def send_forgotten_password_email(user: User):
    if user is None:
        raise ValueError("User not found")
    token = os.urandom(32).hex()
    link = f"{settings.root_address}/account/password-reset?token={token}"
    template = jinja.get_template("forgotten_password.jinja2")
    template = await template.render_async(base_url=settings.root_address, token=token)
    # Written before the send, not after: the alternative leaves a window in which
    # the recipient holds a link the server does not yet honour. On a failed send
    # the token is dropped again, so nothing usable is left behind.
    await redis.set(f"reset_passwd:{token}", str(user.id), ex=RESET_TOKEN_TTL_SECONDS)
    try:
        await _sendMail(template=template, to=user.email, subject="Reset your frogQuiz password", link=link)
    except Exception:
        await redis.delete(f"reset_passwd:{token}")
        raise
