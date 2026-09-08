"""add threat intelligence and ai analysis

Revision ID: 497af8f39157
Revises: 9a7c1b2d4e6f
Create Date: 2026-09-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "497af8f39157"
down_revision: Union[str, Sequence[str], None] = "9a7c1b2d4e6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scans",
        sa.Column(
            "threat_intelligence",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.add_column(
        "scans",
        sa.Column(
            "ai_analysis",
            sa.Text(),
            nullable=False,
            server_default="",
        ),
    )


def downgrade() -> None:
    op.drop_column("scans", "ai_analysis")
    op.drop_column("scans", "threat_intelligence")
