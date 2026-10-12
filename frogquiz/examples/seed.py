# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Load the example quizzes from this folder: `python -m frogquiz.examples.seed`.

Safe to run again: each file keeps the id it was first given (a uuid5 of its file name),
so a second run updates the quizzes in place. On the VM:
`docker compose run --rm --no-deps api python -m frogquiz.examples.seed`.
"""

import asyncio
import json
import uuid
from datetime import datetime
from pathlib import Path

from frogquiz.config import meilisearch, settings
from frogquiz.db import database
from frogquiz.db.models import Quiz, QuizInput, User
from frogquiz.examples import EXAMPLES_EMAIL, EXAMPLES_USERNAME, examples_owner
from frogquiz.helpers import get_meili_data
from frogquiz.helpers.avatar import gzipped_user_avatar

FOLDER = Path(__file__).parent
_NAMESPACE = uuid.UUID("5f1d3c0e-8a7b-4c2d-9e6f-0a1b2c3d4e5f")


def example_id(slug: str) -> uuid.UUID:
    return uuid.uuid5(_NAMESPACE, slug)


async def seed(folder: Path = FOLDER) -> list[uuid.UUID]:
    owner = await examples_owner()
    if owner is None:
        owner = User(
            id=uuid.uuid4(),
            email=EXAMPLES_EMAIL,
            username=EXAMPLES_USERNAME,
            password=None,
            verified=True,
            avatar=gzipped_user_avatar(),
            created_at=datetime.now(),
        )
        await owner.save()
    ids = []
    # ponytail: an example whose file is deleted stays in the app; delete it by hand if that
    # ever happens.
    for path in sorted(folder.glob("*.json")):
        data = QuizInput.model_validate(json.loads(path.read_text(encoding="utf-8")))
        images = [data.cover_image, data.background_image, *(q.image for q in data.questions)]
        if any(images):
            # Text only: an image would need a recorded open licence (CLAUDE.md).
            raise ValueError(f"{path.name}: examples carry no images")
        quiz_id = example_id(path.stem)
        fields = {**data.model_dump(), "public": True, "updated_at": datetime.now()}
        quiz = await Quiz.objects.get_or_none(id=quiz_id)
        if quiz is None:
            quiz = Quiz(**fields, id=quiz_id, user_id=owner.id, created_at=datetime.now())
            await quiz.save()
        else:
            await quiz.update(**fields)
        meilisearch.index(settings().meilisearch_index).add_documents([await get_meili_data(quiz)])
        ids.append(quiz_id)
    return ids


async def _main() -> None:
    await database.connect()
    try:
        ids = await seed()
        print(f"seeded {len(ids)} example quizzes")
    finally:
        await database.disconnect()


if __name__ == "__main__":
    asyncio.run(_main())
