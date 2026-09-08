"""create subscriptions table

Revision ID: create_subscriptions
Revises: 83c9514741d5
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "create_subscriptions"
down_revision = "83c9514741d5"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "subscriptions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column(
            "provider_subscription_id",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column("plan", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column(
            "current_period_end",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_subscriptions_user_id",
        "subscriptions",
        ["user_id"],
    )

    op.create_index(
        "ix_subscriptions_provider_subscription_id",
        "subscriptions",
        ["provider_subscription_id"],
    )


def downgrade():
    op.drop_index(
        "ix_subscriptions_provider_subscription_id",
        table_name="subscriptions",
    )
    op.drop_index(
        "ix_subscriptions_user_id",
        table_name="subscriptions",
    )
    op.drop_table("subscriptions")
