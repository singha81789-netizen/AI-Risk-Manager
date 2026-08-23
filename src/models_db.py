"""
SQLAlchemy ORM models for persistent storage of transactions, risk predictions, and audit logs.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all ORM models."""


class Transaction(Base):
    """Raw transaction data received from the API."""

    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(128), unique=True, nullable=True, index=True)
    customer_id = Column(String(128), nullable=True)
    merchant_id = Column(String(128), nullable=True)
    timestamp = Column(String(64), nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(8), nullable=True)
    merchant_category = Column(String(128), nullable=True)
    amount = Column(Float, nullable=True)
    transaction_type = Column(String(64), nullable=True)
    card_type = Column(String(32), nullable=True)
    card_present = Column(Integer, nullable=True)
    device_type = Column(String(64), nullable=True)
    distance_from_home = Column(Float, nullable=True)
    distance_from_last_transaction = Column(Float, nullable=True)
    high_risk_country = Column(Integer, nullable=True)
    velocity_last_24h = Column(Integer, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Transaction(id={self.id}, transaction_id={self.transaction_id})>"


class RiskPrediction(Base):
    """Model output: fraud probability, risk score, and decision."""

    __tablename__ = "risk_predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(128), nullable=True, index=True)
    fraud_probability = Column(Float, nullable=False)
    risk_score = Column(Integer, nullable=False)
    risk_level = Column(String(16), nullable=False)
    prediction = Column(String(16), nullable=False)
    triggered_risk_factors = Column(Text, nullable=True)
    model_version = Column(String(64), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<RiskPrediction(id={self.id}, transaction_id={self.transaction_id}, "
            f"risk_level={self.risk_level})>"
        )


# ---------------------------------------------------------------------------
# Event type constants for audit logging
# ---------------------------------------------------------------------------

class EventType:
    """Canonical event type identifiers stored in audit_logs.event_type."""

    TRANSACTION_RECEIVED = "transaction_received"
    PREDICTION_GENERATED = "prediction_generated"
    RISK_SCORE_GENERATED = "risk_score_generated"
    TRANSACTION_FLAGGED = "transaction_flagged"
    ANALYST_REVIEW = "analyst_review"
    ANALYST_DECISION = "analyst_decision"
    SYSTEM_STARTUP = "system_startup"
    SYSTEM_SHUTDOWN = "system_shutdown"


class AuditLog(Base):
    """Immutable audit trail of important system and analyst actions."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String(64), nullable=False, index=True)
    transaction_id = Column(String(128), nullable=True, index=True)
    actor = Column(String(128), nullable=False)
    timestamp = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    details = Column(Text, nullable=True)
    model_version = Column(String(64), nullable=True)

    def __repr__(self) -> str:
        return (
            f"<AuditLog(id={self.id}, event_type={self.event_type}, "
            f"transaction_id={self.transaction_id}, actor={self.actor})>"
        )
