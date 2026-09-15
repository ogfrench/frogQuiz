# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Anonymous quiz creation

Adds the columns a quiz created without an account needs: a hashed secret
that stands in for account ownership, and an expiry so an abandoned
anonymous quiz doesn't sit in the database forever. `quiz.user_id` and
`game_results.user` were already nullable at the database level (see
17ea75679da8_init.py / 438516c09cf3_added_game_results.py) even though the
ormar models declared them required -- so no column-nullability change is
needed here, only the two new columns.

Revision ID: e131739c3a48
Revises: fd007f7bcc9f
Create Date: 2026-09-15 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "e131739c3a48"
down_revision = "fd007f7bcc9f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quiz", sa.Column("anon_secret", sa.Text(), nullable=True))
    op.add_column("quiz", sa.Column("expire_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("quiz", "expire_at")
    op.drop_column("quiz", "anon_secret")
