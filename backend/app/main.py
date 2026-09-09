from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.api.health import router as health_router
from app.schemas.health import RootResponse

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="CyberGuard AI API",
    version="0.1.0",
    description="Defensive security analysis API.",
)

app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler,
)

allowed_origins = list(settings.cors_origin_list)

# Production frontend
if settings.environment == "production":
    allowed_origins.append("https://cyberguard-ai-amber.vercel.app")

allowed_origins = list(dict.fromkeys(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=()"
    )

    return response


app.include_router(health_router)


@app.get("/", response_model=RootResponse)
async def root():
    return RootResponse(
        message="CyberGuard AI backend is running",
        environment=settings.environment,
    )


from app.api.v1.scans import router as scans_router
from app.api.v1.scan_pdf import router as scan_pdf_router
from app.api.v1.scan_details import router as scan_details_router
from app.api.v1.history import router as history_router
from app.api.v1.auth import router as auth_router
from app.api.v1.payments import router as payments_router

app.include_router(scans_router, prefix="/api/v1")
app.include_router(scan_pdf_router, prefix="/api/v1")
app.include_router(scan_details_router, prefix="/api/v1")
app.include_router(history_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(payments_router, prefix="/api/v1")
