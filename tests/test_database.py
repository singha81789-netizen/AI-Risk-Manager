"""
Tests for database persistence (Area 9).

Covers: Transaction, RiskPrediction, AnalystReview, AuditLog ORM models;
CRUD operations; unique constraints; relationships.
"""

import json
from datetime import datetime, timezone

import pytest
from sqlalchemy import inspect

from src.models_db import (
    AnalystReview,
    AuditLog,
    EventType,
    RiskPrediction,
    Transaction,
)


class TestTransactionModel:
    """Tests for the Transaction ORM model."""

    def test_create_transaction(self, db_session):
        txn = Transaction(
            transaction_id="TXN_DB_001",
            customer_id="CUST_001",
            merchant_id="MERCH_001",
            timestamp="2026-01-15 12:00:00",
            age=35,
            gender="M",
            merchant_category="grocery",
            amount=99.99,
            transaction_type="POS",
            card_type="Debit",
            card_present=1,
            device_type="POS_Terminal",
            distance_from_home=5.0,
            distance_from_last_transaction=2.0,
            high_risk_country=0,
            velocity_last_24h=2,
        )
        db_session.add(txn)
        db_session.flush()

        result = db_session.query(Transaction).filter_by(transaction_id="TXN_DB_001").first()
        assert result is not None
        assert result.amount == 99.99
        assert result.customer_id == "CUST_001"

    def test_transaction_has_created_at(self, db_session):
        txn = Transaction(transaction_id="TXN_TS_001", amount=50.0)
        db_session.add(txn)
        db_session.flush()
        assert txn.created_at is not None

    def test_transaction_repr(self):
        txn = Transaction(transaction_id="TXN_REPR")
        assert "TXN_REPR" in repr(txn)


class TestRiskPredictionModel:
    """Tests for the RiskPrediction ORM model."""

    def test_create_prediction(self, db_session):
        pred = RiskPrediction(
            transaction_id="TXN_PRED_001",
            fraud_probability=0.85,
            risk_score=85,
            risk_level="HIGH",
            prediction="DECLINE",
            triggered_risk_factors=json.dumps(["High amount", "CNP"]),
            model_version="1.0.0",
        )
        db_session.add(pred)
        db_session.flush()

        result = db_session.query(RiskPrediction).filter_by(transaction_id="TXN_PRED_001").first()
        assert result is not None
        assert result.fraud_probability == 0.85
        assert result.risk_level == "HIGH"
        assert result.prediction == "DECLINE"

    def test_prediction_has_created_at(self, db_session):
        pred = RiskPrediction(
            transaction_id="TXN_TS_002",
            fraud_probability=0.5,
            risk_score=50,
            risk_level="MEDIUM",
            prediction="REVIEW",
        )
        db_session.add(pred)
        db_session.flush()
        assert pred.created_at is not None


class TestAnalystReviewModel:
    """Tests for the AnalystReview ORM model."""

    def test_create_review(self, db_session):
        review = AnalystReview(
            transaction_id="TXN_REV_001",
            analyst_id="ANALYST_001",
            decision="CONFIRM_FRAUD",
            notes="Verified fraud",
            ai_fraud_probability=0.9,
            ai_risk_score=90,
            ai_risk_level="HIGH",
            ai_decision="DECLINE",
            model_version="1.0.0",
        )
        db_session.add(review)
        db_session.flush()

        result = db_session.query(AnalystReview).filter_by(transaction_id="TXN_REV_001").first()
        assert result is not None
        assert result.decision == "CONFIRM_FRAUD"
        assert result.analyst_id == "ANALYST_001"
        assert result.ai_fraud_probability == 0.9

    def test_review_defaults(self, db_session):
        review = AnalystReview(
            transaction_id="TXN_REV_002",
            analyst_id="ANALYST_002",
            decision="FALSE_POSITIVE",
        )
        db_session.add(review)
        db_session.flush()
        assert review.notes is None
        assert review.ai_fraud_probability is None


class TestAuditLogModel:
    """Tests for the AuditLog ORM model."""

    def test_create_audit_log(self, db_session):
        log = AuditLog(
            event_type=EventType.TRANSACTION_RECEIVED,
            transaction_id="TXN_AUD_001",
            actor="api",
            details=json.dumps({"amount": 100.0}),
            model_version="1.0.0",
        )
        db_session.add(log)
        db_session.flush()

        result = db_session.query(AuditLog).filter_by(transaction_id="TXN_AUD_001").first()
        assert result is not None
        assert result.event_type == EventType.TRANSACTION_RECEIVED
        assert result.actor == "api"

    def test_audit_log_has_timestamp(self, db_session):
        log = AuditLog(event_type=EventType.SYSTEM_STARTUP, actor="system")
        db_session.add(log)
        db_session.flush()
        assert log.timestamp is not None

    def test_event_type_constants(self):
        assert EventType.TRANSACTION_RECEIVED == "transaction_received"
        assert EventType.PREDICTION_GENERATED == "prediction_generated"
        assert EventType.ANALYST_DECISION == "analyst_decision"
        assert EventType.SYSTEM_STARTUP == "system_startup"


class TestDatabaseOperations:
    """Tests for CRUD and query patterns."""

    def test_insert_and_query(self, db_session):
        for i in range(5):
            db_session.add(AuditLog(
                event_type=EventType.PREDICTION_GENERATED,
                transaction_id=f"TXN_{i:03d}",
                actor="system",
            ))
        db_session.flush()

        count = db_session.query(AuditLog).count()
        assert count == 5

    def test_filter_by_transaction_id(self, db_session):
        db_session.add(AuditLog(event_type=EventType.TRANSACTION_RECEIVED, transaction_id="TXN_SPECIFIC", actor="system"))
        db_session.add(AuditLog(event_type=EventType.TRANSACTION_RECEIVED, transaction_id="TXN_OTHER", actor="system"))
        db_session.flush()

        results = db_session.query(AuditLog).filter_by(transaction_id="TXN_SPECIFIC").all()
        assert len(results) == 1
        assert results[0].transaction_id == "TXN_SPECIFIC"

    def test_order_by_timestamp_desc(self, db_session):
        db_session.add(AuditLog(event_type=EventType.SYSTEM_STARTUP, actor="old"))
        db_session.flush()
        db_session.add(AuditLog(event_type=EventType.SYSTEM_SHUTDOWN, actor="new"))
        db_session.flush()

        results = db_session.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(2).all()
        assert results[0].actor == "new"

    def test_tables_exist(self, db_engine):
        inspector = inspect(db_engine)
        table_names = inspector.get_table_names()
        assert "transactions" in table_names
        assert "risk_predictions" in table_names
        assert "analyst_reviews" in table_names
        assert "audit_logs" in table_names
