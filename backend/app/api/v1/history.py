from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database.session import get_db
from app.models.scan import Scan
from app.models.user import User

router = APIRouter(prefix="/history", tags=["Scan History"])


@router.get("")
async def get_scan_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Scan)
        .where(Scan.user_id == current_user.id)
        .order_by(Scan.created_at.desc())
        .limit(50)
    )

    scans = result.scalars().all()

    return [
        {
            "scan_id": str(scan.id),
            "scan_type": scan.scan_type,
            "risk_score": scan.risk_score,
            "risk_level": scan.risk_level,
            "status": scan.status,
            "created_at": scan.created_at,
        }
        for scan in scans
    ]
