import hmac
import hashlib

import razorpay
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.database.session import get_db
from app.models.user import User

router = APIRouter(prefix="/payments", tags=["Payments"])

PRO_PRICE_PAISE = 49900


class OrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


def get_client():
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(
            status_code=503,
            detail="Payment gateway is not configured.",
        )

    return razorpay.Client(
        auth=(
            settings.razorpay_key_id,
            settings.razorpay_key_secret,
        )
    )


@router.post("/create-order", response_model=OrderResponse)
async def create_order(
    current_user: User = Depends(get_current_user),
):
    if current_user.plan.lower() == "pro":
        raise HTTPException(
            status_code=400,
            detail="You already have a Pro plan.",
        )

    client = get_client()

    order = client.order.create(
        {
            "amount": PRO_PRICE_PAISE,
            "currency": "INR",
            "receipt": f"cg_{current_user.id}",
            "notes": {
                "user_id": str(current_user.id),
                "plan": "pro",
            },
        }
    )

    return OrderResponse(
        order_id=order["id"],
        amount=order["amount"],
        currency=order["currency"],
        key_id=settings.razorpay_key_id,
    )


@router.post("/verify")
async def verify_payment(
    payload: VerifyPaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not settings.razorpay_key_secret:
        raise HTTPException(
            status_code=503,
            detail="Payment gateway is not configured.",
        )

    message = (
        f"{payload.razorpay_order_id}|"
        f"{payload.razorpay_payment_id}"
    )

    expected_signature = hmac.new(
        settings.razorpay_key_secret.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(
        expected_signature,
        payload.razorpay_signature,
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid payment signature.",
        )

    current_user.plan = "pro"
    await db.commit()
    await db.refresh(current_user)

    return {
        "status": "success",
        "plan": current_user.plan,
        "message": "CyberGuard AI Pro activated successfully.",
    }


@router.post("/webhook")
async def payment_webhook(request: Request):
    # Webhook verification will be enabled once the Razorpay
    # webhook secret is configured.
    return {"status": "received"}
