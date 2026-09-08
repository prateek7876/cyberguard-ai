"""add user plan and monthly usage

Revision ID: 83c9514741d5
Revises: 497af8f39157
"""

from alembic import op
import sqlalchemy as sa


revision = "83c9514741d5"
down_revision = "497af8f39157"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "plan",
            sa.String(length=20),
            nullable=False,
            server_default="free",
        ),
    )

    op.add_column(
        "users",
        sa.Column(
            "monthly_scan_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    op.add_column(
        "users",
        sa.Column(
            "usage_month",
            sa.String(length=7),
            nullable=False,
            server_default="",
        ),
    )


def downgrade():
    op.drop_column("users", "usage_month")
    op.drop_column("users", "monthly_scan_count")
    op.drop_column("users", "plan")
