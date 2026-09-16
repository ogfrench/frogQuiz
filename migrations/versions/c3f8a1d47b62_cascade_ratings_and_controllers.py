# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Cascade ratings and controllers on delete

`2ed6823c69b2_added_proper_delete_actions.py` swept the foreign keys that
existed at the time and gave them ON DELETE CASCADE. Three were missed:
`rating.user`, `rating.quiz` and `controller.user` still carry Postgres's
default NO ACTION, which makes them blockers rather than cascades.

That matters now that account deletion is reachable from the UI. The handler
deletes sessions, then quizzes, then the user, and a single row in `rating`
aborts it partway: `rating.quiz` stops the quiz delete, `rating.user` stops
the user delete one step later -- by which point the account's sessions and
every one of its quizzes are already gone and committed. The user ends up
signed out everywhere with their content destroyed and their account intact.

`delete_quiz` (frogquiz/routers/quiz.py) hits the same wall today on any quiz
someone has rated, independently of account deletion.

`controller` is the same shape, latent only because ENABLE_BOX_CONTROLLER is
off; any row left from before the flag would block a delete permanently.

Constraint names are the ones Postgres actually reports for these tables, not
guesses at ormar's naming: fk_rating_users_id_user, fk_rating_quiz_id_quiz,
fk_controller_users_id_user.

Revision ID: c3f8a1d47b62
Revises: e131739c3a48
Create Date: 2026-09-16 07:10:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "c3f8a1d47b62"
down_revision = "e131739c3a48"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE rating DROP CONSTRAINT IF EXISTS fk_rating_users_id_user")
    op.create_foreign_key("fk_rating_users_id_user", "rating", "users", ["user"], ["id"], ondelete="CASCADE")

    op.execute("ALTER TABLE rating DROP CONSTRAINT IF EXISTS fk_rating_quiz_id_quiz")
    op.create_foreign_key("fk_rating_quiz_id_quiz", "rating", "quiz", ["quiz"], ["id"], ondelete="CASCADE")

    op.execute("ALTER TABLE controller DROP CONSTRAINT IF EXISTS fk_controller_users_id_user")
    op.create_foreign_key("fk_controller_users_id_user", "controller", "users", ["user"], ["id"], ondelete="CASCADE")


def downgrade() -> None:
    # Back to NO ACTION, which is what these three had before. Rows already
    # removed by a cascade are not coming back, but the constraints themselves
    # restore cleanly.
    op.execute("ALTER TABLE rating DROP CONSTRAINT IF EXISTS fk_rating_users_id_user")
    op.create_foreign_key("fk_rating_users_id_user", "rating", "users", ["user"], ["id"])

    op.execute("ALTER TABLE rating DROP CONSTRAINT IF EXISTS fk_rating_quiz_id_quiz")
    op.create_foreign_key("fk_rating_quiz_id_quiz", "rating", "quiz", ["quiz"], ["id"])

    op.execute("ALTER TABLE controller DROP CONSTRAINT IF EXISTS fk_controller_users_id_user")
    op.create_foreign_key("fk_controller_users_id_user", "controller", "users", ["user"], ["id"])
