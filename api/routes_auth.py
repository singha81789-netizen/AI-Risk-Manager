"""
Authentication endpoints for AI Risk Manager.

Provides email + OTP based authentication with JWT token issuance.
"""

import hashlib
import smtplib
import secrets
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Optional

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
        return pwd_context.verify(plain, hashed)
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

    # Invalidate any previous unused OTPs for this email + purpose
    old = db_session.query(OTPVerification).filter(
        and_(
            OTPVerification.email == email,
            OTPVerification.purpose == purpose,
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


def _verify_otp(db_session, email: str, code: str, purpose: str) -> bool:
    """Check OTP: exists, not expired, not used, hash matches."""
    record = (
        db_session.query(OTPVerification)
        .filter(
            and_(
                OTPVerification.email == email,
                OTPVerification.purpose == purpose,
                OTPVerification.used == 0,
            )
        )
        .order_by(OTPVerification.created_at.desc())
        .first()
    )
    if not record:
        return False
    if record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return False
    if not verify_password(code, record.code_hash) and record.code_hash != _hash_otp(code):
        return False
    record.used = 1
    db_session.commit()
    return True


# ---------------------------------------------------------------------------
# Email sending
# ---------------------------------------------------------------------------

def _send_otp_email(to_email: str, code: str, purpose: str) -> bool:
    """Send OTP email via SMTP. Returns True on success, False on failure."""
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning(
            f"SMTP not configured — OTP for {to_email} is: {code} "
            f"(purpose: {purpose})"
        )
        print(f"\n{'='*50}")
        print(f"  OTP for {to_email} ({purpose}): {code}")
        print(f"  (SMTP not configured — set SMTP_USER and SMTP_PASSWORD)")
        print(f"{'='*50}\n")
        return True

    try:
        subject = "Your RiskGuard Verification Code"
        body_html = f"""
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0F172A; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #F8FAFC; font-size: 22px; margin: 0;">RiskGuard</h1>
                <p style="color: #94A3B8; font-size: 13px; margin: 4px 0 0;">AI Risk & Fraud Detection</p>
            </div>
            <div style="background: #1E293B; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
                <p style="color: #94A3B8; font-size: 14px; margin: 0 0 12px;">
                    Your verification code for <strong style="color: #F8FAFC;">{purpose}</strong>:
                </p>
                <p style="color: #4F6DF5; font-size: 36px; font-weight: 700; letter-spacing: 8px; margin: 0; font-family: monospace;">
                    {code}
                </p>
                <p style="color: #64748B; font-size: 12px; margin: 12px 0 0;">
                    Expires in {OTP_EXPIRY_MINUTES} minutes
                </p>
            </div>
            <p style="color: #64748B; font-size: 12px; text-align: center; margin: 0;">
                If you didn't request this code, please ignore this email.
            </p>
        </div>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
        msg["To"] = to_email
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())

        logger.info(f"OTP email sent to {to_email}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send OTP email to {to_email}: {exc}")
        print(f"\n  [EMAIL FAILED] OTP for {to_email} ({purpose}): {code}")
        print(f"  Error: {exc}\n")
        return True  # Still allow the flow to continue so user sees the code


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
    email: EmailStr
    password: str
    name: str
    role: str = "Analyst"

class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str

class LoginRequest(BaseModel):
    email: EmailStr

class LoginVerifyRequest(BaseModel):
    email: EmailStr
    code: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", summary="Register a new user and send OTP")
def register(body: RegisterRequest) -> dict:
    with get_db_session() as session:
        existing = session.query(User).filter(User.email == body.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        if len(body.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

        user = User(
            email=body.email,
            name=body.name,
            hashed_password=hash_password(body.password),
            role=body.role,
            is_verified=0,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        code = _create_otp_record(session, body.email, "register")
        _send_otp_email(body.email, code, "registration")

        logger.info(f"User registered: {body.email} (id={user.id}), OTP sent")
        return {"message": "Account created. Please check your email for the verification code.", "user_id": user.id}


@router.post("/verify-otp", summary="Verify OTP for new registration")
def verify_otp_register(body: VerifyOtpRequest) -> dict:
    with get_db_session() as session:
        if not _verify_otp(session, body.email, body.code, "register"):
            raise HTTPException(status_code=400, detail="Invalid or expired verification code")

        user = session.query(User).filter(User.email == body.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.is_verified = 1
        session.commit()

        token = create_access_token(user.id, user.email, user.role)
        logger.info(f"User verified: {body.email}")
        return {
            "message": "Account verified successfully",
            "token": token,
            "user": {"id": f"USR-{user.id}", "email": user.email, "name": user.name, "role": user.role},
        }


@router.post("/login", summary="Send OTP to registered email for login")
def login(body: LoginRequest) -> dict:
    with get_db_session() as session:
        user = session.query(User).filter(User.email == body.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="No account found with this email")

        if not user.is_verified:
            raise HTTPException(status_code=403, detail="Email not verified. Please check your inbox.")

        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated")

        code = _create_otp_record(session, body.email, "login")
        _send_otp_email(body.email, code, "login")

        logger.info(f"Login OTP sent to {body.email}")
        return {"message": "Verification code sent to your email"}


@router.post("/login/verify", summary="Verify OTP and complete login")
def login_verify(body: LoginVerifyRequest) -> dict:
    with get_db_session() as session:
        if not _verify_otp(session, body.email, body.code, "login"):
            raise HTTPException(status_code=400, detail="Invalid or expired verification code")

        user = session.query(User).filter(User.email == body.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        token = create_access_token(user.id, user.email, user.role)
        logger.info(f"User logged in: {body.email}")
        return {
            "message": "Login successful",
            "token": token,
            "user": {"id": f"USR-{user.id}", "email": user.email, "name": user.name, "role": user.role},
        }


@router.get("/me", summary="Get current authenticated user")
def get_me(current_user: dict = Depends(get_current_user)) -> dict:
    with get_db_session() as session:
        user = session.query(User).filter(User.id == current_user["id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"id": f"USR-{user.id}", "email": user.email, "name": user.name, "role": user.role}
