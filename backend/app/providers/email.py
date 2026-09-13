import resend

from app.core.config import settings


def send_verification_email(email: str, verification_url: str) -> None:
    if not settings.resend_api_key:
        raise RuntimeError("Email service is not configured.")

    resend.api_key = settings.resend_api_key

    resend.Emails.send({
        "from": settings.email_from,
        "to": [email],
        "subject": "Verify your CyberGuard AI account",
        "html": f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
            <h2>Verify your CyberGuard AI account</h2>

            <p>Thanks for creating your CyberGuard AI account.</p>

            <p>Please verify your email address to activate your account.</p>

            <p style="margin:28px 0">
                <a href="{verification_url}"
                   style="display:inline-block;padding:13px 22px;
                          background:#06b6d4;color:#001018;
                          text-decoration:none;border-radius:8px;
                          font-weight:600">
                    Verify Email
                </a>
            </p>

            <p>This verification link expires in 30 minutes.</p>

            <p style="color:#666">
                If you did not create this account, you can safely ignore this email.
            </p>
        </div>
        """,
    })
