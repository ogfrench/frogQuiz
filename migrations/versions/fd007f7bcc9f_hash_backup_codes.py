# SPDX-FileCopyrightText: 2026 FrogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Hash backup codes at rest

Backup codes were stored in plaintext. This is the first migration to hash
them, so every existing value in the column is still plaintext at this point
-- rehashing all of them in place is lossless for any user who already knows
their real code, unlike a mixed old/new-format column would be.

Revision ID: fd007f7bcc9f
Revises: 9d7fa2e6b24c
Create Date: 2026-09-14 00:00:00.000000

"""

import hashlib

from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session

# revision identifiers, used by Alembic.
revision = "fd007f7bcc9f"
down_revision = "9d7fa2e6b24c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    session = Session(bind=conn)
    res = session.execute(sa.text("SELECT id, backup_code FROM users;"))
    for user_id, backup_code in res:
        session.execute(
            sa.text("UPDATE users SET backup_code = :backup_code WHERE users.id = :user_id"),
            {"user_id": user_id, "backup_code": hashlib.sha256(backup_code.encode()).hexdigest()},
        )
    session.commit()


def downgrade() -> None:
    # The plaintext codes are gone for good once hashed -- there's no way back
    # to the values users were actually given. The honest downgrade is the same
    # thing the original "added_backup_code" migration did: mint a fresh
    # (still plaintext) placeholder per user, which invalidates every existing
    # backup code either way.
    import os

    conn = op.get_bind()
    session = Session(bind=conn)
    res = session.execute(sa.text("SELECT id FROM users;"))
    for (user_id,) in res:
        session.execute(
            sa.text("UPDATE users SET backup_code = :backup_code WHERE users.id = :user_id"),
            {"user_id": user_id, "backup_code": os.urandom(32).hex()},
        )
    session.commit()
