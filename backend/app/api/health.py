from fastapi import APIRouter

from app.database.session import check_db_connection
from app.schemas.health import (
    LivenessResponse,
    DatabaseHealthResponse,
)


router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live", response_model=LivenessResponse)
async def liveness():
    return LivenessResponse(
        status="ok",
        service="cyberguard-ai-backend",
    )


@router.get("/db", response_model=DatabaseHealthResponse)
async def database_health():
    is_connected = await check_db_connection()

    return DatabaseHealthResponse(
        status="ok" if is_connected else "unreachable",
        database_connected=is_connected,
    )
