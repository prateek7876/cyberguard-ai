"""add admin flag to users

Revision ID: b7f2c9d1e4a8
Revises: create_subscriptions
"""

from alembic import op
import sqlalchemy as sa

revision = "b7f2c9d1e4a8"
down_revision = "create_subscriptions"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "is_admin",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade():
    op.drop_column("users", "is_admin")
