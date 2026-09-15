# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
#
# SPDX-License-Identifier: MPL-2.0
import asyncio
import logging
import os
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


def _sendMail_blocking(html_body: str, text_body: str, to: str, subject: str) -> None:
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
    # The plain part is written by hand in its own template rather than derived
    # from the HTML -- stripping tags out of a table layout with a <style> block
    # yields the CSS as prose.
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

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


async def _sendMail(html_body: str, text_body: str, to: str, subject: str) -> None:
    """Send mail off the event loop. Raises on failure -- callers decide what that means."""
    await asyncio.to_thread(_sendMail_blocking, html_body, text_body, to, subject)


async def _render(name: str, **ctx) -> tuple[str, str]:
    """Render one message's HTML and plain-text bodies from its two templates."""
    html_body = await jinja.get_template(f"{name}.jinja2").render_async(**ctx)
    text_body = await jinja.get_template(f"{name}.txt.jinja2").render_async(**ctx)
    return html_body, text_body.strip() + "\n"


async def send_register_email(user: User):
    if user is None:
        raise ValueError("User not found")
    html_body, text_body = await _render("register", base_url=settings.root_address, token=user.verify_key)
    await _sendMail(
        html_body=html_body,
        text_body=text_body,
        to=user.email,
        subject="Confirm your frogQuiz address",
    )


async def send_forgotten_password_email(user: User):
    if user is None:
        raise ValueError("User not found")
    token = os.urandom(32).hex()
    html_body, text_body = await _render("forgotten_password", base_url=settings.root_address, token=token)
    # One live link per account. Asking again used to leave every earlier token
    # valid for its full hour, so a run of requests -- a user clicking twice, or
    # someone probing the endpoint -- left a handful of usable links in as many
    # inboxes and copies of them.
    previous = await redis.getset(f"reset_passwd_current:{user.id}", token)
    if previous is not None and previous != token:
        await redis.delete(f"reset_passwd:{previous}")
    await redis.expire(f"reset_passwd_current:{user.id}", RESET_TOKEN_TTL_SECONDS)
    # Written before the send, not after: the alternative leaves a window in which
    # the recipient holds a link the server does not yet honour. On a failed send
    # the token is dropped again, so nothing usable is left behind.
    await redis.set(f"reset_passwd:{token}", str(user.id), ex=RESET_TOKEN_TTL_SECONDS)
    try:
        await _sendMail(
            html_body=html_body,
            text_body=text_body,
            to=user.email,
            subject="Reset your frogQuiz password",
        )
    except Exception:
        await redis.delete(f"reset_passwd:{token}", f"reset_passwd_current:{user.id}")
        raise
