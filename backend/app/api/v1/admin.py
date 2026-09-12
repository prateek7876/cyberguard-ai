from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from app.core.security import verify_password, create_access_token
from app.models.user import User
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database.session import get_db

router = APIRouter(prefix="/admin", tags=["admin"])

class AdminLoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def admin_login(
    payload: AdminLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.email == payload.email.lower().strip())
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )

    admin_result = await db.execute(
        text("SELECT is_admin FROM users WHERE id = :id"),
        {"id": str(user.id)},
    )

    if not admin_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return {
        "access_token": create_access_token(str(user.id)),
        "token_type": "bearer",
        "is_admin": True,
    }



async def require_admin(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("SELECT is_admin FROM users WHERE id = :id"),
        {"id": str(current_user.id)},
    )
    is_admin = result.scalar_one_or_none()

    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user


@router.get("/stats")
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
):
    users = await db.execute(text("""
        SELECT
            COUNT(*) AS total_users,
            COUNT(*) FILTER (WHERE plan = 'pro') AS pro_users,
            COUNT(*) FILTER (WHERE plan = 'free') AS free_users,
            COUNT(*) FILTER (WHERE is_admin = true) AS admin_users
        FROM users
    """))

    scans = await db.execute(text("""
        SELECT
            COUNT(*) AS total_scans,
            COUNT(*) FILTER (WHERE risk_level = 'High') AS high_risk,
            COUNT(*) FILTER (WHERE risk_level = 'Critical') AS critical_risk
        FROM scans
    """))

    u = users.mappings().one()
    s = scans.mappings().one()

    return {
        "users": dict(u),
        "scans": dict(s),
    }


@router.get("/users")
async def admin_users(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
):
    result = await db.execute(text("""
        SELECT
            id,
            email,
            plan,
            monthly_scan_count,
            usage_month,
            is_admin,
            created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 500
    """))

    return {"users": [dict(row) for row in result.mappings().all()]}


@router.get("/users/{user_id}/scans")
async def admin_user_scans(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
):
    result = await db.execute(text("""
        SELECT
            id,
            scan_type,
            risk_score,
            risk_level,
            status,
            created_at
        FROM scans
        WHERE user_id = :user_id
        ORDER BY created_at DESC
        LIMIT 100
    """), {"user_id": user_id})

    return {"scans": [dict(row) for row in result.mappings().all()]}


@router.post("/users/{user_id}/plan")
async def admin_change_plan(
    user_id: str,
    plan: str,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin),
):
    if plan not in ("free", "pro"):
        raise HTTPException(400, "Plan must be free or pro")

    result = await db.execute(
        text("UPDATE users SET plan = :plan WHERE id = :id"),
        {"plan": plan, "id": user_id},
    )

    if result.rowcount == 0:
        raise HTTPException(404, "User not found")

    await db.commit()

    return {"status": "updated", "user_id": user_id, "plan": plan}


@router.post("/users/{user_id}/admin")
async def admin_change_admin_status(
    user_id: str,
    enabled: bool,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    if str(current_user.id) == user_id and not enabled:
        raise HTTPException(400, "You cannot remove your own admin access")

    result = await db.execute(
        text("UPDATE users SET is_admin = :enabled WHERE id = :id"),
        {"enabled": enabled, "id": user_id},
    )

    if result.rowcount == 0:
        raise HTTPException(404, "User not found")

    await db.commit()

    return {
        "status": "updated",
        "user_id": user_id,
        "is_admin": enabled,
    }
