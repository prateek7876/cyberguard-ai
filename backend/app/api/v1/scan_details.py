from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database.session import get_db
from app.models.scan import Scan
from app.models.user import User

router = APIRouter(prefix="/scans", tags=["Scan Details"])


@router.get("/{scan_id}")
async def get_scan_details(
    scan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Scan).where(
            Scan.id == scan_id,
            Scan.user_id == current_user.id,
        )
    )

    scan = result.scalar_one_or_none()

    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found.")

    return {
        "scan_id": str(scan.id),
        "scan_type": scan.scan_type,
        "input_data": scan.input_data,
        "risk_score": scan.risk_score,
        "risk_level": scan.risk_level,
        "status": scan.status,
        "findings": scan.findings,
        "recommendations": scan.recommendations,
        "threat_intelligence": scan.threat_intelligence,
        "ai_analysis": scan.ai_analysis,
        "created_at": scan.created_at,
    }


@router.delete("/{scan_id}")
async def delete_scan(
    scan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Scan).where(
            Scan.id == scan_id,
            Scan.user_id == current_user.id,
        )
    )

    scan = result.scalar_one_or_none()

    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found.")

    await db.delete(scan)
    await db.commit()

    return {
        "message": "Scan deleted successfully.",
        "scan_id": scan_id,
    }
