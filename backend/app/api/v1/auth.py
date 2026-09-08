from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.database.session import get_db
from app.models.user import User
from app.schemas.auth import AuthResponse, LoginRequest, MeResponse, SignupRequest

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
async def signup(
    request: SignupRequest,
    db: AsyncSession = Depends(get_db),
):
    email = request.email.lower().strip()

    result = await db.execute(
        select(User).where(User.email == email)
    )

    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    user = User(
        email=email,
        password_hash=hash_password(request.password),
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return AuthResponse(
        access_token=create_access_token(str(user.id)),
        user_id=str(user.id),
        email=user.email,
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    email = request.email.lower().strip()

    result = await db.execute(
        select(User).where(User.email == email)
    )

    user = result.scalar_one_or_none()

    if not user or not verify_password(
        request.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    return AuthResponse(
        access_token=create_access_token(str(user.id)),
        user_id=str(user.id),
        email=user.email,
    )


@router.get("/me", response_model=MeResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone

    current_month = datetime.now(timezone.utc).strftime("%Y-%m")

    if current_user.usage_month != current_month:
        usage_count = 0
        usage_month = current_month
    else:
        usage_count = current_user.monthly_scan_count
        usage_month = current_user.usage_month

    limit = 500 if current_user.plan.lower() == "pro" else 25

    return MeResponse(
        user_id=str(current_user.id),
        email=current_user.email,
        plan=current_user.plan,
        monthly_scan_count=usage_count,
        monthly_scan_limit=limit,
        scans_remaining=max(limit - usage_count, 0),
        usage_month=usage_month,
    )
