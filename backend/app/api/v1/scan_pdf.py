from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database.session import get_db
from app.models.scan import Scan
from app.models.user import User


router = APIRouter(prefix="/scans", tags=["PDF Reports"])


def safe_text(value):
    if value is None:
        return ""

    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )


def risk_label(score):
    if score <= 20:
        return "LOW"
    if score <= 40:
        return "MODERATE"
    if score <= 60:
        return "MEDIUM"
    if score <= 80:
        return "HIGH"
    return "CRITICAL"


def risk_color(level):
    level = level.upper()

    if level == "LOW":
        return colors.HexColor("#22c55e")
    if level == "MODERATE":
        return colors.HexColor("#eab308")
    if level == "MEDIUM":
        return colors.HexColor("#f97316")
    if level == "HIGH":
        return colors.HexColor("#ef4444")

    return colors.HexColor("#dc2626")


@router.get("/{scan_id}/pdf")
async def export_scan_pdf(
    scan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Scan).where(
            Scan.id == scan_id,
            Scan.user_id == current_user.id,
        )
    )

    scan = result.scalar_one_or_none()

    if not scan:
        raise HTTPException(
            status_code=404,
            detail="Scan not found.",
        )

    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="CyberGuard AI Security Assessment",
        author="CyberGuard AI",
    )

    styles = getSampleStyleSheet()

    title = ParagraphStyle(
        "PremiumTitle",
        parent=styles["Title"],
        fontSize=25,
        leading=30,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=8,
    )

    subtitle = ParagraphStyle(
        "PremiumSubtitle",
        parent=styles["Normal"],
        fontSize=11,
        leading=16,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#64748b"),
    )

    section = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=14,
        spaceAfter=8,
    )

    body = ParagraphStyle(
        "PremiumBody",
        parent=styles["BodyText"],
        fontSize=9,
        leading=14,
        textColor=colors.HexColor("#334155"),
        spaceAfter=6,
    )

    small = ParagraphStyle(
        "Small",
        parent=styles["BodyText"],
        fontSize=8,
        leading=12,
        textColor=colors.HexColor("#64748b"),
    )

    score_style = ParagraphStyle(
        "Score",
        parent=styles["Normal"],
        fontSize=30,
        leading=34,
        alignment=TA_CENTER,
        textColor=risk_color(scan.risk_level),
    )

    story = []

    # Cover
    story.append(Spacer(1, 28 * mm))
    story.append(
        Paragraph(
            "CYBERGUARD AI",
            title,
        )
    )
    story.append(
        Paragraph(
            "Defensive Security Assessment",
            subtitle,
        )
    )

    story.append(Spacer(1, 18 * mm))

    score_table = Table(
        [
            [
                Paragraph(
                    f"{scan.risk_score}/100",
                    score_style,
                )
            ],
            [
                Paragraph(
                    safe_text(risk_label(scan.risk_score)),
                    ParagraphStyle(
                        "RiskLabel",
                        parent=styles["Normal"],
                        fontSize=12,
                        alignment=TA_CENTER,
                        textColor=risk_color(scan.risk_level),
                    ),
                )
            ],
        ],
        colWidths=[75 * mm],
    )

    score_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 1, risk_color(scan.risk_level)),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )

    story.append(score_table)
    story.append(Spacer(1, 20 * mm))

    cover_meta = [
        ["Scan Type", safe_text(scan.scan_type).upper()],
        ["Status", safe_text(scan.status).upper()],
        ["Scan ID", str(scan.id)],
        ["Created", safe_text(scan.created_at)],
    ]

    meta_table = Table(
        cover_meta,
        colWidths=[38 * mm, 125 * mm],
    )

    meta_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#334155")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("PADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )

    story.append(meta_table)
    story.append(Spacer(1, 25 * mm))

    story.append(
        Paragraph(
            "Generated by CyberGuard AI — AI-assisted defensive security analysis.",
            small,
        )
    )

    story.append(Spacer(1, 8 * mm))

    story.append(
        Paragraph(
            "This report is designed for authorized defensive security analysis. "
            "Important security decisions should be validated using trusted "
            "security sources and organizational procedures.",
            small,
        )
    )

    # Executive Summary
    story.append(Spacer(1, 12 * mm))
    story.append(Paragraph("Executive Risk Summary", section))

    summary_text = (
        f"The analyzed {safe_text(scan.scan_type)} received a risk score of "
        f"<b>{scan.risk_score}/100</b> and was classified as "
        f"<b>{safe_text(scan.risk_level).upper()}</b>. "
        f"The assessment combines deterministic security indicators with "
        f"available threat-intelligence and AI-assisted analysis."
    )

    story.append(Paragraph(summary_text, body))

    # Input
    story.append(Paragraph("Analyzed Indicator", section))

    input_table = Table(
        [
            [
                Paragraph(
                    safe_text(scan.input_data),
                    body,
                )
            ]
        ],
        colWidths=[163 * mm],
    )

    input_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("PADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )

    story.append(input_table)

    # Findings
    story.append(Paragraph("Security Findings", section))

    findings = scan.findings or []

    if findings:
        for index, finding in enumerate(findings, 1):
            story.append(
                Paragraph(
                    f"<b>{index}.</b> {safe_text(finding)}",
                    body,
                )
            )
    else:
        story.append(
            Paragraph(
                "No security findings were recorded.",
                body,
            )
        )

    # Recommendations
    story.append(Paragraph("Recommendations", section))

    recommendations = scan.recommendations or []

    if recommendations:
        for index, recommendation in enumerate(recommendations, 1):
            story.append(
                Paragraph(
                    f"<b>{index}.</b> {safe_text(recommendation)}",
                    body,
                )
            )
    else:
        story.append(
            Paragraph(
                "No recommendations were recorded.",
                body,
            )
        )

    # Threat Intelligence
    story.append(Paragraph("Threat Intelligence", section))

    threat_intelligence = scan.threat_intelligence or {}
    stats = threat_intelligence.get("stats", {})

    if stats:
        vt_data = [
            ["VirusTotal Metric", "Detections"],
            ["Malicious", str(stats.get("malicious", 0))],
            ["Suspicious", str(stats.get("suspicious", 0))],
            ["Harmless", str(stats.get("harmless", 0))],
            ["Undetected", str(stats.get("undetected", 0))],
        ]

        vt_table = Table(
            vt_data,
            colWidths=[105 * mm, 58 * mm],
        )

        vt_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#334155")),
                    ("PADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )

        story.append(vt_table)
    else:
        story.append(
            Paragraph(
                "No threat-intelligence statistics were stored for this scan.",
                body,
            )
        )

    # AI
    story.append(Paragraph("Gemini AI Analysis", section))

    if scan.ai_analysis:
        for block in str(scan.ai_analysis).split("\n"):
            if block.strip():
                story.append(
                    Paragraph(
                        safe_text(block.strip()),
                        body,
                    )
                )
    else:
        story.append(
            Paragraph(
                "No AI-assisted analysis was stored for this scan.",
                body,
            )
        )

    # Footer
    story.append(Spacer(1, 15 * mm))

    footer_box = Table(
        [
            [
                Paragraph(
                    "<b>CyberGuard AI</b><br/>"
                    "Defensive Security Analysis Platform<br/>"
                    "Report generated automatically from the stored scan assessment.",
                    small,
                )
            ]
        ],
        colWidths=[163 * mm],
    )

    footer_box.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("PADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )

    story.append(footer_box)

    doc.build(story)

    buffer.seek(0)

    filename = f"cyberguard-security-report-{scan.id}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )
