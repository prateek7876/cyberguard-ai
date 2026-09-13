"""add email verification fields

Revision ID: c8e4f7a1b2d3
Revises: b7f2c9d1e4a8
"""

from alembic import op
import sqlalchemy as sa


revision = "c8e4f7a1b2d3"
down_revision = "b7f2c9d1e4a8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "is_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.add_column(
        "users",
        sa.Column(
            "verification_token_hash",
            sa.String(length=128),
            nullable=True,
        ),
    )

    op.add_column(
        "users",
        sa.Column(
            "verification_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # Existing accounts are trusted so the migration does not
    # unexpectedly lock out users who already registered.
    op.execute(
        sa.text(
            "UPDATE users SET is_verified = TRUE WHERE is_verified = FALSE"
        )
    )


def downgrade():
    op.drop_column("users", "verification_expires_at")
    op.drop_column("users", "verification_token_hash")
    op.drop_column("users", "is_verified")
