"""
Tests for audit logging (Area 11).

Covers: audit event creation, event types, log persistence,
convenience wrappers, and the /audit/logs endpoint.
"""

import json
import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.models_db import AuditLog, Base, EventType


@pytest.fixture
def test_db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def test_app(test_db_engine, mock_predictor_artifacts):
    from src.database import reset_engine
    import src.database as db_module

    reset_engine()
    db_module._engine = test_db_engine
    db_module._SessionFactory = sessionmaker(bind=test_db_engine, expire_on_commit=False)

    from api.main import app
    import api.routes as routes_module
    from src.model_inference import FraudPredictor

    model_path, preprocessor_path = mock_predictor_artifacts
    routes_module._predictor = FraudPredictor(
        model_path=model_path, preprocessor_path=preprocessor_path
    )
    routes_module._detector = None
    routes_module._explainer = None

    yield app

    routes_module._predictor = None
    reset_engine()


@pytest.fixture
def client(test_app):
    return TestClient(test_app, raise_server_exceptions=False)


class TestAuditEventTypes:
    """Tests for EventType constants."""

    def test_all_event_types_defined(self):
        expected = [
            "transaction_received",
            "prediction_generated",
            "risk_score_generated",
            "transaction_flagged",
            "analyst_review",
            "analyst_decision",
            "analyst_review_persisted",
            "system_startup",
            "system_shutdown",
        ]
        for et in expected:
            assert hasattr(EventType, et.upper())
            assert getattr(EventType, et.upper()) == et


class TestAuditLogPersistence:
    """Tests that audit logs are correctly persisted."""

    def test_direct_insert(self, db_session):
        log = AuditLog(
            event_type=EventType.TRANSACTION_RECEIVED,
            transaction_id="TXN_AUD_DIRECT",
            actor="test",
            details=json.dumps({"test": True}),
        )
        db_session.add(log)
        db_session.flush()

        result = db_session.query(AuditLog).filter_by(transaction_id="TXN_AUD_DIRECT").first()
        assert result is not None
        assert result.event_type == EventType.TRANSACTION_RECEIVED

    def test_multiple_events_same_transaction(self, db_session):
        txn_id = "TXN_AUD_MULTI"
        events = [
            EventType.TRANSACTION_RECEIVED,
            EventType.PREDICTION_GENERATED,
            EventType.RISK_SCORE_GENERATED,
        ]
        for event in events:
            db_session.add(AuditLog(event_type=event, transaction_id=txn_id, actor="system"))
        db_session.flush()

        results = db_session.query(AuditLog).filter_by(transaction_id=txn_id).all()
        assert len(results) == 3

    def test_details_json_roundtrip(self, db_session):
        details = {"fraud_probability": 0.85, "risk_score": 85}
        log = AuditLog(
            event_type=EventType.PREDICTION_GENERATED,
            transaction_id="TXN_AUD_JSON",
            actor="system",
            details=json.dumps(details),
        )
        db_session.add(log)
        db_session.flush()

        result = db_session.query(AuditLog).filter_by(transaction_id="TXN_AUD_JSON").first()
        parsed = json.loads(result.details)
        assert parsed["fraud_probability"] == 0.85
        assert parsed["risk_score"] == 85

    def test_model_version_stored(self, db_session):
        log = AuditLog(
            event_type=EventType.PREDICTION_GENERATED,
            transaction_id="TXN_AUD_VER",
            actor="system",
            model_version="2.0.0",
        )
        db_session.add(log)
        db_session.flush()

        result = db_session.query(AuditLog).filter_by(transaction_id="TXN_AUD_VER").first()
        assert result.model_version == "2.0.0"


class TestAuditLogsEndpoint:
    """Tests for GET /audit/logs."""

    def test_get_audit_logs_empty(self, client):
        response = client.get("/audit/logs")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_audit_logs_after_prediction(self, client, sample_low_risk_txn):
        client.post("/predict", json=sample_low_risk_txn)
        response = client.get("/audit/logs")
        assert response.status_code == 200
        logs = response.json()
        assert len(logs) > 0
        event_types = [log["event_type"] for log in logs]
        assert EventType.TRANSACTION_RECEIVED in event_types

    def test_filter_audit_logs_by_transaction_id(self, client, sample_low_risk_txn):
        client.post("/predict", json=sample_low_risk_txn)
        txn_id = sample_low_risk_txn["transaction_id"]
        response = client.get(f"/audit/logs?transaction_id={txn_id}")
        assert response.status_code == 200
        for log in response.json():
            assert log["transaction_id"] == txn_id

    def test_audit_log_entry_structure(self, client, sample_low_risk_txn):
        client.post("/predict", json=sample_low_risk_txn)
        response = client.get("/audit/logs?limit=1")
        assert response.status_code == 200
        logs = response.json()
        if logs:
            log = logs[0]
            assert "id" in log
            assert "event_type" in log
            assert "transaction_id" in log
            assert "actor" in log
            assert "timestamp" in log

    def test_audit_logs_limit(self, client, sample_low_risk_txn):
        client.post("/predict", json=sample_low_risk_txn)
        response = client.get("/audit/logs?limit=2")
        assert response.status_code == 200
        assert len(response.json()) <= 2
