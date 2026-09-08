from typing import Any
import asyncio
import httpx

from app.core.config import settings


class VirusTotalProvider:
    BASE_URL = "https://www.virustotal.com/api/v3"

    async def _get_analysis(
        self,
        client: httpx.AsyncClient,
        analysis_id: str,
        headers: dict[str, str],
    ) -> dict[str, Any]:

        url = f"{self.BASE_URL}/analyses/{analysis_id}"

        # Poll for up to ~60 seconds
        for attempt in range(20):
            response = await client.get(url, headers=headers)

            if response.status_code == 404:
                return {
                    "status": "not_found",
                    "source": "VirusTotal",
                    "message": "VirusTotal analysis was not found.",
                }

            response.raise_for_status()

            data = response.json()
            attributes = data.get("data", {}).get("attributes", {})
            analysis_status = attributes.get("status")

            if analysis_status == "completed":
                stats = attributes.get("stats", {})

                return {
                    "status": "completed",
                    "source": "VirusTotal",
                    "analysis_status": "completed",
                    "stats": {
                        "malicious": stats.get("malicious", 0),
                        "suspicious": stats.get("suspicious", 0),
                        "harmless": stats.get("harmless", 0),
                        "undetected": stats.get("undetected", 0),
                        "timeout": stats.get("timeout", 0),
                    },
                }

            # Don't wait after the final attempt
            if attempt < 19:
                await asyncio.sleep(3)

        return {
            "status": "pending",
            "source": "VirusTotal",
            "message": "VirusTotal analysis is still processing.",
            "analysis_id": analysis_id,
        }

    async def lookup(
        self,
        indicator: str,
        indicator_type: str,
    ) -> dict[str, Any]:

        if not settings.virustotal_api_key:
            return {
                "status": "not_configured",
                "source": "VirusTotal",
                "message": "VirusTotal API key is not configured.",
            }

        headers = {
            "x-apikey": settings.virustotal_api_key,
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(
                timeout=settings.request_timeout
            ) as client:

                # URL
                if indicator_type == "url":
                    response = await client.post(
                        f"{self.BASE_URL}/urls",
                        headers=headers,
                        data={"url": indicator},
                    )

                    response.raise_for_status()

                    data = response.json()
                    analysis_id = data.get("data", {}).get("id")

                    if not analysis_id:
                        return {
                            "status": "error",
                            "source": "VirusTotal",
                            "message": "VirusTotal did not return an analysis ID.",
                        }

                    return await self._get_analysis(
                        client,
                        analysis_id,
                        headers,
                    )

                # IP
                if indicator_type == "ip":
                    response = await client.get(
                        f"{self.BASE_URL}/ip_addresses/{indicator}",
                        headers=headers,
                    )

                    if response.status_code == 404:
                        return {
                            "status": "not_found",
                            "source": "VirusTotal",
                            "message": "IP address was not found in VirusTotal.",
                        }

                    response.raise_for_status()

                    data = response.json()
                    attributes = data.get("data", {}).get("attributes", {})
                    stats = attributes.get("last_analysis_stats", {})

                    return {
                        "status": "completed",
                        "source": "VirusTotal",
                        "stats": {
                            "malicious": stats.get("malicious", 0),
                            "suspicious": stats.get("suspicious", 0),
                            "harmless": stats.get("harmless", 0),
                            "undetected": stats.get("undetected", 0),
                            "timeout": stats.get("timeout", 0),
                        },
                    }

                # File hash
                if indicator_type == "hash":
                    response = await client.get(
                        f"{self.BASE_URL}/files/{indicator}",
                        headers=headers,
                    )

                    if response.status_code == 404:
                        return {
                            "status": "not_found",
                            "source": "VirusTotal",
                            "message": "File hash was not found in VirusTotal.",
                        }

                    response.raise_for_status()

                    data = response.json()
                    attributes = data.get("data", {}).get("attributes", {})
                    stats = attributes.get("last_analysis_stats", {})

                    return {
                        "status": "completed",
                        "source": "VirusTotal",
                        "stats": {
                            "malicious": stats.get("malicious", 0),
                            "suspicious": stats.get("suspicious", 0),
                            "harmless": stats.get("harmless", 0),
                            "undetected": stats.get("undetected", 0),
                            "timeout": stats.get("timeout", 0),
                        },
                    }

                return {
                    "status": "unsupported",
                    "source": "VirusTotal",
                    "message": "VirusTotal lookup is not supported for this scan type.",
                }

        except httpx.TimeoutException:
            return {
                "status": "timeout",
                "source": "VirusTotal",
                "message": "VirusTotal request timed out.",
            }

        except httpx.HTTPError as exc:
            return {
                "status": "error",
                "source": "VirusTotal",
                "message": f"VirusTotal request failed: {exc}",
            }


virustotal = VirusTotalProvider()

