"""
Audit logging helpers for the AI Risk Manager.

Provides a thin wrapper around the AuditLog ORM model so that callers can
record events with a single function call without managing sessions directly.
"""

import json
from typing import Any, Dict, Optional

from src.config import MODEL_VERSION
from src.database import get_db_session
from src.models_db import AuditLog, EventType
from src.utils import logger


def log_event(
    event_type: str,
    transaction_id: Optional[str] = None,
    actor: str = "system",
    details: Optional[Dict[str, Any]] = None,
    model_version: Optional[str] = None,
) -> None:
    """Persist an audit event to the ``audit_logs`` table.

    Parameters
    ----------
    event_type:
        One of the ``EventType`` constants (e.g. ``EventType.TRANSACTION_RECEIVED``).
    transaction_id:
        Optional transaction identifier to correlate related events.
    actor:
        Identifier of the entity performing the action (e.g. ``"system"``,
        ``"analyst"``, ``"api"``).
    details:
        Arbitrary JSON-serialisable metadata about the event.  Sensitive
        secrets (passwords, tokens) must **never** be included.
    model_version:
        Model version string when the event relates to a prediction.
    """
    details_json = json.dumps(details) if details else None

    try:
        with get_db_session() as session:
            record = AuditLog(
                event_type=event_type,
                transaction_id=transaction_id,
                actor=actor,
                details=details_json,
                model_version=model_version or MODEL_VERSION,
            )
            session.add(record)
        logger.debug(
            f"Audit event: {event_type} | txn={transaction_id} | actor={actor}"
        )
    except Exception as exc:
        logger.warning(f"Failed to write audit log ({event_type}): {exc}")


def log_transaction_received(
    transaction_id: Optional[str],
    actor: str = "api",
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Convenience wrapper for *transaction_received* events."""
    log_event(
        event_type=EventType.TRANSACTION_RECEIVED,
        transaction_id=transaction_id,
        actor=actor,
        details=details,
    )


def log_prediction_generated(
    transaction_id: Optional[str],
    fraud_probability: float,
    risk_score: int,
    risk_level: str,
    decision: str,
    actor: str = "system",
) -> None:
    """Convenience wrapper for *prediction_generated* events."""
    log_event(
        event_type=EventType.PREDICTION_GENERATED,
        transaction_id=transaction_id,
        actor=actor,
        details={
            "fraud_probability": fraud_probability,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "decision": decision,
        },
    )


def log_risk_score_generated(
    transaction_id: Optional[str],
    risk_score: int,
    risk_level: str,
    actor: str = "system",
) -> None:
    """Convenience wrapper for *risk_score_generated* events."""
    log_event(
        event_type=EventType.RISK_SCORE_GENERATED,
        transaction_id=transaction_id,
        actor=actor,
        details={
            "risk_score": risk_score,
            "risk_level": risk_level,
        },
    )


def log_transaction_flagged(
    transaction_id: Optional[str],
    risk_level: str,
    triggered_risk_factors: list,
    actor: str = "system",
) -> None:
    """Convenience wrapper for *transaction_flagged* events."""
    log_event(
        event_type=EventType.TRANSACTION_FLAGGED,
        transaction_id=transaction_id,
        actor=actor,
        details={
            "risk_level": risk_level,
            "triggered_risk_factors": triggered_risk_factors,
        },
    )


def log_analyst_review(
    transaction_id: Optional[str],
    analyst_id: str,
    notes: Optional[str] = None,
) -> None:
    """Convenience wrapper for *analyst_review* events."""
    log_event(
        event_type=EventType.ANALYST_REVIEW,
        transaction_id=transaction_id,
        actor=analyst_id,
        details={"notes": notes} if notes else None,
    )


def log_analyst_decision(
    transaction_id: Optional[str],
    analyst_id: str,
    decision: str,
    notes: Optional[str] = None,
) -> None:
    """Convenience wrapper for *analyst_decision* events."""
    log_event(
        event_type=EventType.ANALYST_DECISION,
        transaction_id=transaction_id,
        actor=analyst_id,
        details={
            "decision": decision,
            "notes": notes,
        },
    )
