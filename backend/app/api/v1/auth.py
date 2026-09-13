import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.database.session import get_db
from app.models.user import User
from app.providers.email import send_verification_email
from app.schemas.auth import AuthResponse, LoginRequest, MeResponse, SignupRequest

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _verification_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _new_verification_token() -> tuple[str, str, datetime]:
    token = secrets.token_urlsafe(32)
    token_hash = _verification_hash(token)
    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(minutes=settings.verification_expiry_minutes)
    )
    return token, token_hash, expires_at


def _verification_url(email: str, token: str) -> str:
    return (
        f"{settings.frontend_url.rstrip('/')}"
        f"/verify-email?token={token}"
        f"&email={email}"
    )


async def _send_verification(user: User) -> None:
    token, token_hash, expires_at = _new_verification_token()

    user.verification_token_hash = token_hash
    user.verification_expires_at = expires_at

    send_verification_email(
        user.email,
        _verification_url(user.email, token),
    )


@router.post(
    "/signup",
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
    existing = result.scalar_one_or_none()

    if existing:
        if existing.is_verified:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists.",
            )

        # Allow an unverified account to request a fresh email.
        existing.password_hash = hash_password(request.password)

        try:
            await _send_verification(existing)
            await db.commit()
        except Exception as exc:
            await db.rollback()
            raise HTTPException(
                status_code=503,
                detail="Unable to send verification email. Please try again later.",
            ) from exc

        return {
            "message": "Verification email sent. Please check your inbox."
        }

    user = User(
        email=email,
        password_hash=hash_password(request.password),
        is_verified=False,
    )

    db.add(user)

    try:
        await db.flush()
        await _send_verification(user)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Unable to send verification email. Please try again later.",
        ) from exc

    return {
        "message": "Account created. Please check your email to verify your account."
    }


@router.post(
    "/resend-verification",
)
async def resend_verification(
    request: SignupRequest,
    db: AsyncSession = Depends(get_db),
):
    email = request.email.lower().strip()

    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()

    # Do not reveal whether an email exists.
    if not user:
        return {
            "message": "If the account exists and is unverified, a verification email has been sent."
        }

    if user.is_verified:
        return {
            "message": "This email is already verified. You can sign in."
        }

    try:
        await _send_verification(user)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Unable to send verification email. Please try again later.",
        ) from exc

    return {
        "message": "Verification email sent. Please check your inbox."
    }


@router.get("/verify-email")
async def verify_email(
    token: str,
    email: str,
    db: AsyncSession = Depends(get_db),
):
    normalized_email = email.lower().strip()

    result = await db.execute(
        select(User).where(User.email == normalized_email)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid verification link.",
        )

    if user.is_verified:
        return {
            "message": "Email is already verified."
        }

    if (
        not user.verification_token_hash
        or not user.verification_expires_at
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired verification link.",
        )

    now = datetime.now(timezone.utc)

    if user.verification_expires_at < now:
        raise HTTPException(
            status_code=400,
            detail="Verification link has expired. Please request a new verification email.",
        )

    supplied_hash = _verification_hash(token)

    if not secrets.compare_digest(
        supplied_hash,
        user.verification_token_hash,
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid verification link.",
        )

    user.is_verified = True
    user.verification_token_hash = None
    user.verification_expires_at = None

    await db.commit()

    return {
        "message": "Email verified successfully. You can now sign in."
    }


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

    if not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Please verify your email before signing in.",
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
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")

    if current_user.usage_month != current_month:
        usage_count = 0
        usage_month = current_month
    else:
        usage_count = current_user.monthly_scan_count
        usage_month = current_user.usage_month

    limit = 500 if current_user.plan.lower() == "pro" else 999999

    return MeResponse(
        user_id=str(current_user.id),
        email=current_user.email,
        plan=current_user.plan,
        monthly_scan_count=usage_count,
        monthly_scan_limit=limit,
        scans_remaining=max(limit - usage_count, 0),
        usage_month=usage_month,
    )
