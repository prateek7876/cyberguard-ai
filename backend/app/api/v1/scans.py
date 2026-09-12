from datetime import datetime, timezone
from uuid import uuid4
import ipaddress
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database.session import get_db
from app.models.scan import Scan
from app.models.user import User
from app.providers.gemini import gemini
from app.providers.virustotal import virustotal
from app.schemas.scan import ScanRequest, ScanResponse

router = APIRouter(prefix="/scans", tags=["Scans"])

limiter = Limiter(key_func=get_remote_address)


def get_risk_level(score: int) -> str:
    if score <= 20:
        return "Low"
    if score <= 40:
        return "Moderate"
    if score <= 60:
        return "Medium"
    if score <= 80:
        return "High"
    return "Critical"


def calculate_initial_risk(scan_type: str, input_data: str) -> tuple[int, list[str]]:
    score = 10
    findings: list[str] = []
    lowered = input_data.lower()

    if scan_type == "url":
        if lowered.startswith("http://"):
            score += 15
            findings.append("The URL uses unencrypted HTTP.")

        if "@" in lowered:
            score += 30
            findings.append(
                "The URL contains an @ character, which can obscure the actual destination."
            )

        suspicious_words = [
            "login", "verify", "secure", "account",
            "password", "signin", "update", "confirm"
        ]

        matches = [word for word in suspicious_words if word in lowered]

        if matches:
            score += min(len(matches) * 8, 24)
            findings.append(
                f"Suspicious URL keywords detected: {', '.join(matches)}."
            )

        if len(input_data) > 150:
            score += 10
            findings.append("The URL is unusually long.")

        if not lowered.startswith(("http://", "https://")):
            score += 15
            findings.append(
                "The URL does not use a standard HTTP or HTTPS scheme."
            )

    elif scan_type == "ip":
        try:
            ipaddress.ip_address(input_data)
        except ValueError:
            score += 25
            findings.append("The supplied value is not a valid IP address.")

        if input_data.startswith(("10.", "192.168.", "127.")):
            findings.append(
                "The IP appears to belong to a commonly used private or loopback range."
            )

    elif scan_type == "hash":
        hash_patterns = {
            32: "MD5",
            40: "SHA-1",
            64: "SHA-256",
        }

        if (
            len(input_data) not in hash_patterns
            or not re.fullmatch(r"[a-fA-F0-9]+", input_data)
        ):
            score += 25
            findings.append(
                "The supplied value does not match a standard MD5, SHA-1, or SHA-256 format."
            )
        else:
            findings.append(
                f"The supplied value matches a {hash_patterns[len(input_data)]} hash format."
            )

    elif scan_type == "email":
        indicators = {
            "urgent": 10,
            "immediately": 10,
            "verify": 10,
            "password": 10,
            "account": 8,
            "click": 8,
            "suspended": 12,
            "payment": 10,
            "invoice": 8,
            "wire transfer": 15,
        }

        matched = []

        for word, points in indicators.items():
            if word in lowered:
                score += points
                matched.append(word)

        if matched:
            findings.append(
                f"Potential phishing indicators detected: {', '.join(matched)}."
            )

        if re.search(r"https?://", input_data):
            score += 10
            findings.append("The email contains one or more URLs.")

    elif scan_type == "log":
        indicators = {
            "failed": 8,
            "unauthorized": 15,
            "denied": 10,
            "attack": 20,
            "malware": 25,
            "bruteforce": 20,
            "brute force": 20,
            "suspicious": 12,
            "privilege": 10,
            "authentication failure": 12,
        }

        matched = []

        for word, points in indicators.items():
            if word in lowered:
                score += points
                matched.append(word)

        if matched:
            findings.append(
                f"Security event indicators detected: {', '.join(matched)}."
            )

    return min(score, 100), findings


def apply_virustotal_risk(
    score: int,
    threat_intelligence: dict | None,
) -> tuple[int, list[str]]:
    if not threat_intelligence:
        return score, []

    stats = threat_intelligence.get("stats", {})
    malicious = int(stats.get("malicious", 0))
    suspicious = int(stats.get("suspicious", 0))

    score = min(score + (malicious * 5) + (suspicious * 3), 100)

    findings = []

    if malicious > 0:
        findings.append(
            f"VirusTotal reported {malicious} malicious detection(s)."
        )

    if suspicious > 0:
        findings.append(
            f"VirusTotal reported {suspicious} suspicious detection(s)."
        )

    if malicious == 0 and suspicious == 0:
        findings.append(
            "VirusTotal reported no malicious or suspicious detections."
        )

    return score, findings


def build_recommendations(
    score: int,
    scan_type: str,
    threat_intelligence: dict | None,
) -> list[str]:
    recommendations = []

    if score >= 81:
        recommendations.extend([
            "Treat this indicator as potentially malicious.",
            "Avoid interacting with the indicator until further investigation is completed.",
            "Validate the indicator using trusted security sources.",
        ])
    elif score >= 61:
        recommendations.extend([
            "Perform additional defensive investigation before trusting this indicator.",
            "Avoid unnecessary interaction with the suspicious content.",
        ])
    elif score >= 41:
        recommendations.extend([
            "Review the available evidence before taking security-sensitive action.",
            "Correlate the result with additional trusted security sources.",
        ])
    elif score >= 21:
        recommendations.append(
            "Perform additional defensive analysis before trusting this indicator."
        )
    else:
        recommendations.append(
            "Continue monitoring and validate important security decisions with trusted sources."
        )

    if scan_type == "email" and score >= 21:
        recommendations.append(
            "Verify the sender and destination independently before clicking links or sharing information."
        )

    if scan_type == "log" and score >= 41:
        recommendations.append(
            "Correlate the event with authentication, endpoint, and network logs."
        )

    if threat_intelligence:
        stats = threat_intelligence.get("stats", {})
        if int(stats.get("malicious", 0)) > 0:
            recommendations.append(
                "Consider containment and incident-response procedures according to your organization's security policy."
            )

    return list(dict.fromkeys(recommendations))



FREE_SCAN_LIMIT = 999999
PRO_SCAN_LIMIT = 500


def get_month_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


async def enforce_scan_quota(
    db: AsyncSession,
    current_user: User,
) -> int:
    result = await db.execute(
        select(User)
        .where(User.id == current_user.id)
        .with_for_update()
    )
    user = result.scalar_one()

    current_month = get_month_key()

    if user.usage_month != current_month:
        user.usage_month = current_month
        user.monthly_scan_count = 0

    limit = PRO_SCAN_LIMIT if user.plan.lower() == "pro" else FREE_SCAN_LIMIT

    if user.monthly_scan_count >= limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Monthly scan limit reached for the {user.plan.lower()} plan. "
                f"Your limit is {limit} scans per month."
            ),
        )

    return limit


@limiter.limit("20/minute")
@router.post("", response_model=ScanResponse)
async def create_scan(
    http_request: Request,
    request: ScanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    input_data = request.input_data.strip()

    if not input_data:
        raise HTTPException(
            status_code=400,
            detail="Input cannot be empty",
        )

    monthly_limit = await enforce_scan_quota(db, current_user)

    score, findings = calculate_initial_risk(
        request.scan_type,
        input_data,
    )

    threat_intelligence = None

    if request.scan_type in {"url", "ip", "hash"}:
        threat_intelligence = await virustotal.lookup(
            input_data,
            request.scan_type,
        )

        score, vt_findings = apply_virustotal_risk(
            score,
            threat_intelligence,
        )

        findings.extend(vt_findings)

    score = min(score, 100)
    risk_level = get_risk_level(score)

    if not findings:
        findings.append(
            "No obvious high-risk indicators were detected by the initial analysis."
        )

    recommendations = build_recommendations(
        score,
        request.scan_type,
        threat_intelligence,
    )

    ai_result = await gemini.analyze(
        request.scan_type,
        input_data,
        findings,
        score,
        threat_intelligence,
    )

    ai_analysis = None

    if ai_result.get("status") == "success":
        ai_analysis = ai_result.get("analysis")

    scan_id = uuid4()

    scan = Scan(
        id=scan_id,
        user_id=current_user.id,
        scan_type=request.scan_type,
        input_data=input_data,
        risk_score=score,
        risk_level=risk_level,
        status="completed",
        findings=findings,
        recommendations=recommendations,
        threat_intelligence=threat_intelligence or {},
        ai_analysis=ai_analysis or "",
    )

    db.add(scan)

    # Count only successfully persisted scans.
    current_user.monthly_scan_count += 1
    current_user.usage_month = get_month_key()

    await db.commit()

    return ScanResponse(
        scan_id=str(scan_id),
        scan_type=request.scan_type,
        risk_score=score,
        risk_level=risk_level,
        status="completed",
        findings=findings,
        recommendations=recommendations,
        threat_intelligence=threat_intelligence,
        ai_analysis=ai_analysis,
    )
