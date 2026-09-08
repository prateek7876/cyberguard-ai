from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str


class MeResponse(BaseModel):

    user_id: str
    email: str
    plan: str
    monthly_scan_count: int
    monthly_scan_limit: int
    scans_remaining: int
    usage_month: str
