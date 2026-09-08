import uuid

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    scan_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    input_data: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    risk_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    risk_level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    findings: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
    )

    recommendations: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
    )

    threat_intelligence: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )

    ai_analysis: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
