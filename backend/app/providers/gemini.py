from typing import Any
import asyncio
import httpx

from app.core.config import settings


class GeminiProvider:
    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    MODELS = [
        "gemini-3.6-flash",
        "gemini-3.7-flash",
    ]

    async def analyze(
        self,
        scan_type: str,
        input_data: str,
        findings: list[str],
        risk_score: int,
        threat_intelligence: dict[str, Any] | None = None,
    ) -> dict[str, Any]:

        if not settings.gemini_api_key:
            return {
                "status": "not_configured",
                "source": "Gemini",
                "message": "Gemini API key is not configured.",
            }

        vt = threat_intelligence or {}
        stats = vt.get("stats", {})

        prompt = f"""
You are CyberGuard AI, a defensive cybersecurity analysis assistant.

Analyze the supplied security scan evidence.

Rules:
- Use only the evidence provided.
- Do not invent threat intelligence.
- Clearly distinguish heuristic findings from VirusTotal evidence.
- If evidence is unavailable, say so.
- Do not provide exploitation, credential theft, malware deployment,
  persistence, evasion, or destructive instructions.
- Give practical defensive recommendations.

SCAN INFORMATION
Scan type: {scan_type}
Risk score: {risk_score}/100

INITIAL FINDINGS
{findings}

VIRUSTOTAL EVIDENCE
Status: {vt.get("status", "unavailable")}
Analysis status: {vt.get("analysis_status", "unavailable")}
Malicious detections: {stats.get("malicious", 0)}
Suspicious detections: {stats.get("suspicious", 0)}
Harmless detections: {stats.get("harmless", 0)}
Undetected engines: {stats.get("undetected", 0)}
Timeouts: {stats.get("timeout", 0)}

INPUT
{input_data}

Write the report using exactly these sections:

### 1. Risk Explanation
Explain why the current risk score was assigned.

### 2. Threat Intelligence
Explain the supplied VirusTotal results.

### 3. Key Security Indicators
List the strongest observable indicators.

### 4. Defensive Recommendations
Give practical defensive recommendations.

### 5. Analyst Verdict
Give a short final verdict.
"""

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ]
        }

        last_error = "Gemini request failed."

        for model in self.MODELS:

            url = (
                f"{self.BASE_URL}/{model}:generateContent"
                f"?key={settings.gemini_api_key}"
            )

            for attempt in range(2):

                try:
                    async with httpx.AsyncClient(
                        timeout=settings.request_timeout
                    ) as client:

                        response = await client.post(
                            url,
                            json=payload,
                        )

                        # Rate limit
                        if response.status_code == 429:
                            try:
                                error_body = response.json()
                            except Exception:
                                error_body = response.text

                            last_error = (
                                f"Gemini model {model} rate limited "
                                f"(HTTP 429)."
                            )

                            # Do not hammer the API.
                            # Only wait briefly before trying fallback.
                            if attempt == 0:
                                await asyncio.sleep(5)
                                continue

                            break

                        # Temporary Google service issue
                        if response.status_code == 503:
                            last_error = (
                                f"Gemini model {model} temporarily unavailable."
                            )

                            if attempt == 0:
                                await asyncio.sleep(5)
                                continue

                            break

                        # Other HTTP errors
                        if response.status_code >= 400:

                            try:
                                error_body = response.json()
                            except Exception:
                                error_body = response.text

                            last_error = (
                                f"Gemini model {model} returned "
                                f"HTTP {response.status_code}: "
                                f"{error_body}"
                            )

                            break

                        data = response.json()

                        candidates = data.get("candidates", [])

                        if not candidates:
                            last_error = (
                                f"Gemini model {model} returned no candidates."
                            )
                            break

                        content = candidates[0].get("content", {})
                        parts = content.get("parts", [])

                        if not parts:
                            last_error = (
                                f"Gemini model {model} returned no content."
                            )
                            break

                        text = parts[0].get("text", "")

                        if text:
                            return {
                                "status": "success",
                                "source": "Gemini",
                                "model": model,
                                "analysis": text,
                            }

                        last_error = (
                            f"Gemini model {model} returned no analysis text."
                        )
                        break

                except httpx.TimeoutException:

                    last_error = (
                        f"Gemini model {model} request timed out."
                    )

                    if attempt == 0:
                        await asyncio.sleep(5)
                        continue

                    break

                except httpx.HTTPError as exc:

                    last_error = (
                        f"Gemini request failed: {exc}"
                    )
                    break

                except Exception as exc:

                    last_error = (
                        f"Gemini unexpected error: {exc}"
                    )
                    break

        return {
            "status": "unavailable",
            "source": "Gemini",
            "message": last_error,
            "analysis": None,
        }


gemini = GeminiProvider()
