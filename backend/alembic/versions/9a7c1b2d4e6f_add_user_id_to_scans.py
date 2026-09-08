"""add user_id to scans

Revision ID: 9a7c1b2d4e6f
Revises: eb342c1d7535
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "9a7c1b2d4e6f"
down_revision = "eb342c1d7535"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "scans",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    # Attach existing scans to the earliest registered user.
    op.execute(
        """
        UPDATE scans
        SET user_id = (
            SELECT id
            FROM users
            ORDER BY created_at ASC
            LIMIT 1
        )
        WHERE user_id IS NULL
        """
    )

    op.alter_column(
        "scans",
        "user_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )

    op.create_foreign_key(
        "fk_scans_user_id_users",
        "scans",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_index(
        "ix_scans_user_id",
        "scans",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_scans_user_id", table_name="scans")
    op.drop_constraint(
        "fk_scans_user_id_users",
        "scans",
        type_="foreignkey",
    )
    op.drop_column("scans", "user_id")
