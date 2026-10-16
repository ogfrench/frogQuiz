# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""API keys are stored as a hash, with a name, a prefix and when they were last used

The key was the primary key, in plaintext, so a read of the database handed over every
key that works. Each row keeps working: its key is hashed in place, so a caller holding
one is not locked out, and only the hash is left behind.

Revision ID: a7c3e5f1b9d2
Revises: e4a1f9c2d7b0
Create Date: 2026-10-15 12:00:00

"""

from alembic import op
import sqlalchemy as sa

revision = "a7c3e5f1b9d2"
down_revision = "e4a1f9c2d7b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("api_keys", sa.Column("id", sa.CHAR(32), nullable=True))
    op.add_column("api_keys", sa.Column("key_hash", sa.String(length=64), nullable=True))
    op.add_column("api_keys", sa.Column("prefix", sa.String(length=12), nullable=True))
    op.add_column("api_keys", sa.Column("name", sa.String(length=60), nullable=True))
    op.add_column("api_keys", sa.Column("created_at", sa.DateTime(), nullable=True))
    op.add_column("api_keys", sa.Column("last_used_at", sa.DateTime(), nullable=True))
    # sha256 of the key's text, which is what frogquiz.auth.hash_api_key computes, so a key
    # made before this migration still verifies afterwards. The id is a UUID in the 32-hex
    # form ormar stores.
    op.execute("""
        UPDATE api_keys SET
            id = replace(gen_random_uuid()::text, '-', ''),
            key_hash = encode(sha256(convert_to(key, 'UTF8')), 'hex'),
            prefix = left(key, 6),
            name = 'Key made before 15 Oct',
            created_at = now()
        """)
    for column in ("id", "key_hash", "prefix", "name", "created_at"):
        op.alter_column("api_keys", column, nullable=False)
    op.execute("ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_pkey")
    op.drop_column("api_keys", "key")
    op.create_primary_key("api_keys_pkey", "api_keys", ["id"])
    op.create_unique_constraint("uq_api_keys_key_hash", "api_keys", ["key_hash"])


def downgrade() -> None:
    # A hash cannot be turned back into the key it came from, so the old plaintext column
    # cannot be refilled. The keys are deleted instead: anybody holding one makes a new one.
    op.execute("DELETE FROM api_keys")
    op.drop_constraint("uq_api_keys_key_hash", "api_keys", type_="unique")
    op.drop_constraint("api_keys_pkey", "api_keys", type_="primary")
    op.add_column("api_keys", sa.Column("key", sa.String(length=48), nullable=False))
    op.create_primary_key("api_keys_pkey", "api_keys", ["key"])
    for column in ("last_used_at", "created_at", "name", "prefix", "key_hash", "id"):
        op.drop_column("api_keys", column)
