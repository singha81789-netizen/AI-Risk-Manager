"""
Test script to verify Gmail SMTP email sending for RiskGuard OTPs.
Usage:
    python scripts/test_email.py [recipient_email]
"""

import os
import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

def test_smtp_send(recipient: str = None):
    # Load .env variables
    load_dotenv(override=True)

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_from_name = os.getenv("SMTP_FROM_NAME", "RiskGuard")

    print("\n" + "="*60)
    print("  RiskGuard Gmail SMTP Connection & OTP Delivery Test")
    print("="*60)
    print(f"  SMTP Host     : {smtp_host}")
    print(f"  SMTP Port     : {smtp_port}")
    print(f"  Sender Email  : {smtp_user if smtp_user else '[NOT SET IN .env]'}")
    print(f"  Password/AppPW: {'*' * len(smtp_password) if smtp_password else '[NOT SET IN .env]'}")
    
    if not smtp_user or not smtp_password:
        print("\n  [ERROR] SMTP_USER and SMTP_PASSWORD are not set in your .env file!")
        print("  Please open your .env file and set:")
        print("    SMTP_USER=your_email@gmail.com")
        print("    SMTP_PASSWORD=your_16_character_app_password")
        print("\n  To generate an App Password:")
        print("    1. Go to https://myaccount.google.com/apppasswords")
        print("    2. Create a new App Password named 'RiskGuard'")
        print("    3. Paste the 16-character code into .env as SMTP_PASSWORD")
        print("="*60 + "\n")
        return False

    to_email = recipient or smtp_user
    print(f"  Recipient     : {to_email}")
    print("-" * 60)
    print("  Attempting connection to Gmail SMTP server...")

    test_otp = "849201"
    subject = f"Your RiskGuard Verification Code: {test_otp}"
    body_text = f"Your test verification code is: {test_otp}\n\nThis confirms that your Gmail SMTP is configured properly."
    body_html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0F172A; border-radius: 16px; color: #F8FAFC;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #6366F1; font-size: 24px; margin: 0; font-weight: 700;">RiskGuard</h1>
            <p style="color: #94A3B8; font-size: 13px; margin: 4px 0 0;">AI Risk & Fraud Detection</p>
        </div>
        <div style="background: #1E293B; border-radius: 12px; padding: 28px; text-align: center; margin-bottom: 20px; border: 1px solid #334155;">
            <p style="color: #94A3B8; font-size: 14px; margin: 0 0 16px;">
                Your test verification code:
            </p>
            <div style="background: #0F172A; border-radius: 8px; padding: 16px; margin: 0 auto 16px; border: 1px dashed #4F46E5;">
                <p style="color: #818CF8; font-size: 36px; font-weight: 700; letter-spacing: 10px; margin: 0; font-family: 'Consolas', 'Courier New', monospace;">
                    {test_otp}
                </p>
            </div>
            <p style="color: #10B981; font-size: 13px; margin: 0; font-weight: 600;">
                SMTP Email Service is working properly!
            </p>
        </div>
        <p style="color: #64748B; font-size: 12px; text-align: center; margin: 0;">
            This is an automated test from your RiskGuard system.
        </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{smtp_from_name} <{smtp_user}>"
    msg["To"] = to_email
    msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    try:
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_user, to_email, msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_user, to_email, msg.as_string())

        print(f"  >>> [SUCCESS] Test OTP email sent successfully to: {to_email}")
        print("  Please check your Gmail inbox (and Spam folder if not found)!")
        print("="*60 + "\n")
        return True
    except smtplib.SMTPAuthenticationError as err:
        print(f"\n  [AUTHENTICATION FAILED] {err}")
        print("  Common causes:")
        print("    1. You used your regular Gmail password instead of a 16-character App Password.")
        print("    2. 2-Step Verification is not enabled on your Google Account.")
        print("    3. The App Password had typos or extra spaces.")
        print("\n  Steps to fix:")
        print("    - Enable 2-Step Verification on your Google Account.")
        print("    - Go to https://myaccount.google.com/apppasswords and create an App Password.")
        print("    - Update SMTP_PASSWORD in .env with the generated 16-character code.")
        print("="*60 + "\n")
        return False
    except Exception as err:
        print(f"\n  [ERROR] Failed to send email: {err}")
        print("="*60 + "\n")
        return False

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    test_smtp_send(target)
