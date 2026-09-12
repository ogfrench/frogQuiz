# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
#
# SPDX-License-Identifier: MPL-2.0

import re
from functools import lru_cache

from redis import asyncio as redis_lib
import redis as redis_base_lib
from pydantic import field_validator, RedisDsn, PostgresDsn, BaseModel
import json
from typing import Annotated

from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
import meilisearch as MeiliSearch
from arq import create_pool
from arq.connections import RedisSettings, ArqRedis
import logging

from frogquiz.storage import Storage

LOGGER = logging.getLogger(f"uvicorn.{__name__}")


class CustomOpenIDProvider(BaseModel):
    scopes: str | None = "openid email profile"
    server_metadata_url: str
    client_id: str
    client_secret: str


class Settings(BaseSettings):
    """
    Settings class for the shop app.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        env_nested_delimiter="__",
        env_file_encoding="utf-8",
    )
    root_address: str = "http://127.0.0.1:8000"
    redis: RedisDsn = "redis://localhost:6379/0?decode_responses=True"
    skip_email_verification: bool = False
    # Registration does a live DNS/MX lookup on the address's domain. Turn this off
    # for deployments on internal-only mail domains, or without outbound DNS.
    validate_email_deliverability: bool = True
    db_url: PostgresDsn | str = "postgresql://postgres:mysecretpassword@localhost:5432/frogquiz"
    hcaptcha_key: str | None = None
    recaptcha_key: str | None = None
    mail_address: str
    mail_password: str
    mail_username: str
    mail_server: str
    mail_port: int
    secret_key: str
    access_token_expire_minutes: int = 30
    # Off only for test runs, which log in far more often than a real client.
    rate_limit_enabled: bool = True
    cache_expiry: int = 86400
    meilisearch_url: str = "http://127.0.0.1:7700"
    meilisearch_index: str = "frogquiz"
    google_client_id: str | None = None
    google_client_secret: str | None = None
    github_client_id: str | None = None
    github_client_secret: str | None = None
    custom_openid_provider: CustomOpenIDProvider | None = None
    telemetry_enabled: bool = True
    free_storage_limit: int = 1074000000
    pixabay_api_key: str | None = None
    mods: list[str] = []
    registration_disabled: bool = False
    # Origins allowed to call the API / socket.io cross-site (e.g. a Netlify-hosted frontend).
    # Empty means same-origin only, which is what the bundled Caddy setup uses.
    # Accepts a JSON list or a plain comma-separated string.
    # NoDecode keeps pydantic-settings from JSON-parsing this first, which is what
    # made the documented comma-separated form raise before the validator below ran.
    cors_origins: Annotated[list[str], NoDecode] = []

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, v):
        # NoDecode means this sees the raw environment string, so both documented
        # forms are parsed here: a JSON list, or a plain comma-separated list.
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            if v.startswith("["):
                v = json.loads(v)
            else:
                return [origin.strip().rstrip("/") for origin in v.split(",") if origin.strip()]
        if isinstance(v, list):
            return [str(origin).strip().rstrip("/") for origin in v if str(origin).strip()]
        return v

    # storage_backend
    storage_backend: str  # either "local" or "s3"

    # if storage_backend == "local":
    storage_path: str | None = None

    # if storage_backend == "s3":
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    s3_bucket_name: str = "frogquiz"
    s3_base_url: str | None = None


async def initialize_arq():
    # skipcq: PYL-W0603
    global arq
    arq = await create_pool(RedisSettings.from_dsn(settings.redis))


@lru_cache()
def settings() -> Settings:
    return Settings()


pool = redis_lib.ConnectionPool().from_url(str(settings().redis))

redis: redis_base_lib.client.Redis = redis_lib.Redis(connection_pool=pool)
arq: ArqRedis = ArqRedis(pool_or_conn=pool)
storage: Storage = Storage(
    backend=settings().storage_backend,
    storage_path=settings().storage_path,
    access_key=settings().s3_access_key,
    secret_key=settings().s3_secret_key,
    bucket_name=settings().s3_bucket_name,
    base_url=settings().s3_base_url,
)

meilisearch = MeiliSearch.Client(settings().meilisearch_url)

ALLOWED_TAGS_FOR_QUIZ = ["b", "strong", "i", "em", "small", "mark", "del", "sub", "sup"]

ALLOWED_MIME_TYPES = ["image/png", "video/mp4", "image/jpeg", "image/gif", "image/webp"]

server_regex = rf"^{re.escape(settings().root_address)}/api/v1/storage/download/.{{36}}--.{{36}}$"
