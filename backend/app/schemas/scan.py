from typing import Literal, Any

from pydantic import BaseModel, Field


ScanType = Literal["url", "ip", "hash", "email", "log"]


class ScanRequest(BaseModel):
    scan_type: ScanType
    input_data: str = Field(min_length=1, max_length=10000)


class ScanResponse(BaseModel):
    scan_id: str
    scan_type: ScanType
    risk_score: int
    risk_level: str
    status: str
    findings: list[str]
    recommendations: list[str]
    threat_intelligence: dict[str, Any] | None = None
    ai_analysis: str | None = None
