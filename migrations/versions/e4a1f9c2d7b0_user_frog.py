# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""The frog a person picks for their account

Revision ID: e4a1f9c2d7b0
Revises: b5e91c7a2d38
Create Date: 2026-10-12 18:00:00

"""

from alembic import op
import sqlalchemy as sa

revision = "e4a1f9c2d7b0"
down_revision = "b5e91c7a2d38"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nullable with no default: every existing account keeps the frog its username picks.
    op.add_column("users", sa.Column("frog", sa.String(length=5), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "frog")
