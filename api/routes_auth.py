"""
Authentication endpoints for AI Risk Manager.

Provides password-based login, user registration, real Gmail SMTP OTP verification,
and JWT token issuance.
"""

import hashlib
import os
import smtplib
import secrets
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr
from sqlalchemy import and_

from src.config import (
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    OTP_EXPIRY_MINUTES,
    OTP_LENGTH,
    SMTP_FROM_NAME,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
)
from src.database import get_db_session
from src.models_db import OTPVerification, User
from src.utils import logger

try:
    from jose import JWTError, jwt
except Exception:
    try:
        import jwt as _jwt  # type: ignore

        class JWTError(Exception):  # type: ignore
            pass

        jwt = _jwt  # type: ignore
    except ImportError:
        import hmac as _hmac
        import hashlib as _hashlib

        class JWTError(Exception):  # type: ignore
            pass

        class _FakeJWT:
            @staticmethod
            def encode(payload, key, algorithm="HS256"):
                import json as _json
                return _hmac.new(
                    key.encode(), _json.dumps(payload).encode(), _hashlib.sha256
                ).hexdigest()

            @staticmethod
            def decode(token, key, algorithms=None):
                raise JWTError("JWT library not available — install python-jose or PyJWT")

        jwt = _FakeJWT()  # type: ignore

try:
    from passlib.context import CryptContext
except Exception:
    CryptContext = None  # type: ignore

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

if CryptContext:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
else:
    pwd_context = None  # type: ignore


def hash_password(password: str) -> str:
    if pwd_context:
        return pwd_context.hash(password)
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    if pwd_context:
        try:
            return pwd_context.verify(plain, hashed)
        except Exception:
            pass
    return hashlib.sha256(plain.encode()).hexdigest() == hashed


# ---------------------------------------------------------------------------
# OTP helpers
# ---------------------------------------------------------------------------

def _generate_otp() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(OTP_LENGTH))


def _hash_otp(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _create_otp_record(db_session, email: str, purpose: str) -> str:
    """Generate OTP, hash it, store in DB, return the plaintext code."""
    code = _generate_otp()
    code_hash = _hash_otp(code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

    # Invalidate any previous unused OTPs for this email
    old = db_session.query(OTPVerification).filter(
        and_(
            OTPVerification.email == email,
            OTPVerification.used == 0,
        )
    ).all()
    for o in old:
        o.used = 1

    otp_record = OTPVerification(
        email=email,
        code_hash=code_hash,
        purpose=purpose,
        expires_at=expires_at,
    )
    db_session.add(otp_record)
    db_session.commit()
    return code


# ---------------------------------------------------------------------------
# Email sending
# ---------------------------------------------------------------------------

def _send_otp_email(to_email: str, code: str, purpose: str) -> bool:
    """Send OTP verification email via SMTP. Raises HTTPException on failure."""
    load_dotenv(override=True)

    smtp_host = os.getenv("SMTP_HOST", SMTP_HOST)
    smtp_port = int(os.getenv("SMTP_PORT", str(SMTP_PORT)))
    smtp_user = os.getenv("SMTP_USER", SMTP_USER).strip()
    smtp_password = os.getenv("SMTP_PASSWORD", os.getenv("SMTP_PASS", SMTP_PASSWORD)).strip()
    smtp_from_name = os.getenv("SMTP_FROM_NAME", os.getenv("SMTP_FROM", SMTP_FROM_NAME))
    otp_expiry = int(os.getenv("OTP_EXPIRY_MINUTES", str(OTP_EXPIRY_MINUTES)))

    logger.info(f"Sending OTP for {to_email} ({purpose}) via {smtp_host}:{smtp_port}")

    if not smtp_user or not smtp_password:
        print(f"\n{'='*60}")
        print(f"  [SMTP NOT CONFIGURED] Cannot send email to {to_email}")
        print(f"  Please set SMTP_USER and SMTP_PASSWORD in .env for real Gmail delivery.")
        print(f"  Development backup OTP: {code}")
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=500,
            detail="Email service is not configured. Please set SMTP_USER and SMTP_PASSWORD in .env file.",
        )

    try:
        subject = "Your RiskGuard Email Verification Code"
        body_text = (
            f"Your RiskGuard verification code is:\n\n"
            f"{code}\n\n"
            f"This code will expire in {otp_expiry} minutes.\n\n"
            f"If you did not request this code, you can safely ignore this email."
        )

        body_html = f"""
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0F172A; border-radius: 16px; color: #F8FAFC;">
            <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #6366F1; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: -0.5px;">RiskGuard</h1>
                <p style="color: #94A3B8; font-size: 13px; margin: 4px 0 0;">AI Risk & Fraud Detection</p>
            </div>
            <div style="background: #1E293B; border-radius: 12px; padding: 28px; text-align: center; margin-bottom: 20px; border: 1px solid #334155;">
                <p style="color: #94A3B8; font-size: 14px; margin: 0 0 16px;">
                    Your verification code for <strong style="color: #F8FAFC;">{purpose}</strong>:
                </p>
                <div style="background: #0F172A; border-radius: 8px; padding: 16px; margin: 0 auto 16px; border: 1px dashed #4F46E5;">
                    <p style="color: #818CF8; font-size: 36px; font-weight: 700; letter-spacing: 10px; margin: 0; font-family: 'Consolas', 'Courier New', monospace;">
                        {code}
                    </p>
                </div>
                <p style="color: #64748B; font-size: 12px; margin: 0;">
                    Code expires in {otp_expiry} minutes
                </p>
            </div>
            <p style="color: #64748B; font-size: 12px; text-align: center; margin: 0; line-height: 1.5;">
                If you did not request this code, you can safely ignore this email.
            </p>
        </div>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{smtp_from_name} <{smtp_user}>"
        msg["To"] = to_email
        msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))

        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_user, to_email, msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_user, to_email, msg.as_string())

        logger.info(f"Verification OTP email delivered to {to_email}")
        return True
    except smtplib.SMTPAuthenticationError as auth_err:
        logger.error(f"Gmail SMTP Authentication failed for {smtp_user}: {auth_err}")
        raise HTTPException(
            status_code=500,
            detail="Gmail SMTP authentication failed. Please check your 16-character Google App Password in .env.",
        )
    except Exception as exc:
        logger.error(f"Failed to send OTP email to {to_email}: {exc}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to deliver verification email to {to_email}: {str(exc)}",
        )


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(user_id: int, email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": expire,
    }
    if hasattr(jwt, "encode"):
        return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return jwt.encode(JWT_SECRET_KEY, payload, algorithm=JWT_ALGORITHM)  # type: ignore


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """FastAPI dependency: extract and validate JWT from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        if hasattr(jwt, "decode"):
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        else:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])  # type: ignore
    except (JWTError, Exception):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = payload.get("sub")
    email = payload.get("email")
    role = payload.get("role")
    if not user_id or not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return {"id": int(user_id), "email": email, "role": role}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "Analyst"

class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ResendOtpRequest(BaseModel):
    email: EmailStr


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", summary="Register a new user and send OTP")
@router.post("/signup", summary="Register a new user and send OTP (alias)")
def register(body: RegisterRequest) -> dict:
    email = body.email.strip().lower()
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    role = body.role if body.role in ["Admin", "Analyst", "Viewer"] else "Analyst"

    with get_db_session() as session:
        existing = session.query(User).filter(User.email == email).first()
        if existing:
            if existing.is_verified:
                raise HTTPException(status_code=400, detail="Email already registered. Please sign in.")
            existing.name = body.name.strip()
            existing.hashed_password = hash_password(body.password)
            existing.role = role
            session.commit()
            session.refresh(existing)
            user_id = existing.id
        else:
            user = User(
                email=email,
                name=body.name.strip(),
                hashed_password=hash_password(body.password),
                role=role,
                is_verified=0,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            user_id = user.id

        code = _create_otp_record(session, email, "register")
        _send_otp_email(email, code, "registration")

        logger.info(f"User registered/updated: {email} (id={user_id}), OTP sent")
        return {
            "message": "Account created. Please check your email for the verification code.",
            "email": email,
            "user_id": user_id,
        }


@router.post("/verify-otp", summary="Verify OTP for registration")
@router.post("/verify-email", summary="Verify OTP for registration (alias)")
def verify_otp_register(body: VerifyOtpRequest) -> dict:
    email = body.email.strip().lower()
    code = body.code.strip()

    with get_db_session() as session:
        record = (
            session.query(OTPVerification)
            .filter(
                and_(
                    OTPVerification.email == email,
                    OTPVerification.used == 0,
                )
            )
            .order_by(OTPVerification.created_at.desc())
            .first()
        )
        if not record:
            raise HTTPException(status_code=400, detail="Invalid verification code")

        # Check expiration
        expires_at = record.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=400,
                detail="Verification code expired. Please request a new code.",
            )

        # Check code matching
        if not verify_password(code, record.code_hash) and record.code_hash != _hash_otp(code):
            raise HTTPException(status_code=400, detail="Invalid verification code")

        record.used = 1

        user = session.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.is_verified = 1
        session.commit()

        logger.info(f"User email verified: {email}")
        return {
            "message": "Email verified successfully.",
            "email": user.email,
        }


@router.post("/resend-otp", summary="Resend verification OTP to email")
@router.post("/send-otp", summary="Send verification OTP to email (alias)")
def resend_otp(body: ResendOtpRequest) -> dict:
    email = body.email.strip().lower()
    with get_db_session() as session:
        user = session.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="Account not found. Please sign up first.")

        if user.is_verified:
            raise HTTPException(status_code=400, detail="Email is already verified. Please sign in.")

        # Rate limit check: 60 seconds cooldown
        recent = (
            session.query(OTPVerification)
            .filter(OTPVerification.email == email)
            .order_by(OTPVerification.created_at.desc())
            .first()
        )
        if recent:
            created_at = recent.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            elapsed = (datetime.now(timezone.utc) - created_at).total_seconds()
            if elapsed < 60:
                seconds_left = max(1, int(60 - elapsed))
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait {seconds_left} seconds before requesting another code.",
                )

        code = _create_otp_record(session, email, "register")
        _send_otp_email(email, code, "verification")

        logger.info(f"Resent OTP to {email}")
        return {
            "message": "Verification code resent successfully.",
            "email": email,
        }


@router.post("/login", summary="Sign in with email and password")
def login(body: LoginRequest) -> dict:
    email = body.email.strip().lower()
    with get_db_session() as session:
        user = session.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="Account not found. Please sign up first.")

        if not user.is_verified:
            # Trigger OTP resend for unverified user
            try:
                code = _create_otp_record(session, email, "register")
                _send_otp_email(email, code, "verification")
            except Exception:
                pass
            raise HTTPException(
                status_code=403,
                detail="Please verify your email first. We have sent a verification code to your email.",
            )

        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated. Please contact support.")

        if not verify_password(body.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid email or password.")

        token = create_access_token(user.id, user.email, user.role)
        logger.info(f"User logged in: {user.email}")
        return {
            "message": "Login successful",
            "token": token,
            "user": {
                "id": f"USR-{user.id}",
                "email": user.email,
                "name": user.name,
                "role": user.role,
            },
        }


@router.get("/me", summary="Get current authenticated user")
def get_me(current_user: dict = Depends(get_current_user)) -> dict:
    with get_db_session() as session:
        user = session.query(User).filter(User.id == current_user["id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"id": f"USR-{user.id}", "email": user.email, "name": user.name, "role": user.role}

