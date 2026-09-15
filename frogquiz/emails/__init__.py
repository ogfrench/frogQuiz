# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
#
# SPDX-License-Identifier: MPL-2.0
import asyncio
import logging
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate

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


def _sendMail_blocking(template: str, to: str, subject: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.mail_address
    msg["To"] = to
    msg["Date"] = formatdate(localtime=True)
    msg.attach(MIMEText(template, "html"))
    context = ssl.SSLContext(ssl.PROTOCOL_TLS)
    # Closed on every path: the old code never called quit(), so a server that
    # accepted the connection and then failed on login leaked it until GC.
    with smtplib.SMTP(
        host=settings.mail_server, port=settings.mail_port, timeout=SMTP_TIMEOUT_SECONDS
    ) as server:
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(settings.mail_username, settings.mail_password)
        server.sendmail(settings.mail_address, to, msg.as_string())


async def _sendMail(template: str, to: str, subject: str) -> None:
    """Send mail off the event loop. Raises on failure -- callers decide what that means."""
    await asyncio.to_thread(_sendMail_blocking, template, to, subject)


async def send_register_email(user: User):
    if user is None:
        raise ValueError("User not found")
    template = jinja.get_template("register.jinja2")
    template = await template.render_async(base_url=settings.root_address, token=user.verify_key)
    await _sendMail(template=template, to=user.email, subject="Verify your email")


async def send_forgotten_password_email(email: str):
    user = await User.objects.get_or_none(email=email)
    if user is None:
        raise ValueError("User not found")
    template = jinja.get_template("forgotten_password.jinja2")
    token = os.urandom(32).hex()
    template = await template.render_async(base_url=settings.root_address, token=token)
    await redis.set(f"reset_passwd:{token}", str(user.id), ex=3600)
    await _sendMail(template=template, to=email, subject="Reset your password")
    pass
