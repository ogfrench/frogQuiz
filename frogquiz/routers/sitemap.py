# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0


import datetime
import uuid

from fastapi import APIRouter, Depends, Response
from jinja2 import Template
from pydantic import BaseModel
from frogquiz.auth import get_current_user
from frogquiz.config import redis, settings
from frogquiz.db import database

settings = settings()
# Signed in only, like search: it lists every public quiz's title and description, and
# public means the team since 5 Oct. No crawler gets past it, which an internal tool wants.
router = APIRouter(dependencies=[Depends(get_current_user)])


sitemap_template = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{% for entry in pages -%}
  <url>
    <loc>{{ root_address}}/view/{{ entry.id.hex }}</loc>
    {%- if entry.updated_at != None -%}
    <lastmod>{{ entry.updated_at.strftime("%Y-%m-%d") }}</lastmod>
    {% endif %}
  </url>
  {%- endfor %}
</urlset>"""


sql_statement_metadata = """
SELECT id, title, description, updated_at from quiz where public ='t'
"""

sql_statement_id_and_modified_only = """
SELECT id, updated_at from quiz where public ='t'
"""

template = Template(sitemap_template, enable_async=True)


class SitemapQuiz(BaseModel):
    id: uuid.UUID
    updated_at: datetime.datetime

    class Config:
        from_attributes = True


@router.get("/get")
async def get_sitemap():
    redis_cache_resp = await redis.get("sitemap")
    if redis_cache_resp is None:
        res = await database.fetch_all(sql_statement_id_and_modified_only)
        entries = []
        for i in res:
            entries.append(SitemapQuiz.from_orm(i))
        rendered_sitemap = await template.render_async({"pages": entries, "root_address": settings.root_address})
        await redis.set("sitemap", rendered_sitemap, ex=86400)
        return Response(content=rendered_sitemap, media_type="application/xml")
    else:
        return Response(content=redis_cache_resp, media_type="application/xml")
