# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Ready-made quizzes everyone can look at, play and copy (#39, D26, D33).

An example is a public quiz owned by one account that nobody can sign in to: its address is
on `.invalid`, a domain reserved never to exist, so no sign-in link or OAuth login can reach
it. Only `python -m frogquiz.examples.seed` changes its quizzes, from the JSON files in this
folder, which are reviewed in git like code. No column marks an example, so no migration.
"""

from frogquiz.db.models import User

EXAMPLES_EMAIL = "examples@frogquiz.invalid"
EXAMPLES_USERNAME = "frogQuiz"


async def examples_owner() -> User | None:
    return await User.objects.get_or_none(email=EXAMPLES_EMAIL)
