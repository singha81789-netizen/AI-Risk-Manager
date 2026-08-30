"""
Authentication endpoints for AI Risk Manager.

Provides password-based login, user registration, and JWT token issuance.
"""

import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr

from src.config import (
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
)
from src.database import get_db_session
from src.models_db import User
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
        try:
            return pwd_context.hash(password)
        except Exception:
            pass
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    if pwd_context:
        try:
            return pwd_context.verify(plain, hashed)
        except Exception:
            pass
    return hashlib.sha256(plain.encode()).hexdigest() == hashed


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


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", summary="Register a new user account")
@router.post("/signup", summary="Register a new user account (alias)")
def register(body: RegisterRequest) -> dict:
    email = body.email.strip().lower()
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    role = body.role if body.role in ["Admin", "Analyst", "Viewer"] else "Analyst"

    with get_db_session() as session:
        existing = session.query(User).filter(User.email == email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered. Please sign in.")

        user = User(
            email=email,
            name=body.name.strip(),
            hashed_password=hash_password(body.password),
            role=role,
            is_verified=1,
            is_active=1,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        token = create_access_token(user.id, user.email, user.role)
        logger.info(f"User registered successfully: {email} (id={user.id})")

        return {
            "message": "User registered successfully",
            "token": token,
            "user": {
                "id": f"USR-{user.id}",
                "email": user.email,
                "name": user.name,
                "role": user.role,
            },
        }


@router.post("/login", summary="Sign in with email and password")
def login(body: LoginRequest) -> dict:
    email = body.email.strip().lower()
    with get_db_session() as session:
        user = session.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password.")

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
