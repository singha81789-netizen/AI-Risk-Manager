"""
Tests for analyst review workflow (Area 10).

Covers: POST /analyst/review, POST /analyst/decision with valid/invalid
decisions, and retrieval endpoints. Uses mock DB.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.models_db import AnalystReview, Base, RiskPrediction


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

    # Pre-populate a prediction so analyst/decision can find it
    SessionLocal = sessionmaker(bind=test_db_engine, expire_on_commit=False)
    session = SessionLocal()
    try:
        session.execute(
            RiskPrediction.__table__.insert(),
            {
                "transaction_id": "TXN_EXISTING_001",
                "fraud_probability": 0.85,
                "risk_score": 85,
                "risk_level": "HIGH",
                "prediction": "DECLINE",
                "model_version": "1.0.0",
            },
        )
        session.commit()
    finally:
        session.close()

    yield app

    routes_module._predictor = None
    reset_engine()


@pytest.fixture
def client(test_app):
    return TestClient(test_app, raise_server_exceptions=False)


class TestAnalystReviewEndpoint:
    """Tests for POST /analyst/review."""

    def test_review_returns_200(self, client):
        response = client.post("/analyst/review", json={
            "transaction_id": "TXN_REVIEW_001",
            "analyst_id": "ANALYST_A",
            "notes": "Reviewing this transaction",
        })
        assert response.status_code == 200

    def test_review_response_fields(self, client):
        response = client.post("/analyst/review", json={
            "transaction_id": "TXN_REVIEW_002",
            "analyst_id": "ANALYST_B",
        })
        data = response.json()
        assert data["transaction_id"] == "TXN_REVIEW_002"
        assert data["event_type"] == "analyst_review"
        assert data["actor"] == "ANALYST_B"
        assert data["status"] == "recorded"

    def test_review_without_notes(self, client):
        response = client.post("/analyst/review", json={
            "transaction_id": "TXN_REVIEW_003",
            "analyst_id": "ANALYST_C",
        })
        assert response.status_code == 200

    def test_review_missing_transaction_id(self, client):
        response = client.post("/analyst/review", json={
            "analyst_id": "ANALYST_D",
        })
        assert response.status_code == 422

    def test_review_missing_analyst_id(self, client):
        response = client.post("/analyst/review", json={
            "transaction_id": "TXN_REVIEW_004",
        })
        assert response.status_code == 422


class TestAnalystDecisionEndpoint:
    """Tests for POST /analyst/decision."""

    def test_confirm_fraud_decision(self, client):
        response = client.post("/analyst/decision", json={
            "transaction_id": "TXN_EXISTING_001",
            "analyst_id": "ANALYST_A",
            "decision": "CONFIRM_FRAUD",
            "notes": "Confirmed fraud after investigation",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["event_type"] == "analyst_decision"
        assert data["status"] == "recorded"

    def test_false_positive_decision(self, client):
        response = client.post("/analyst/decision", json={
            "transaction_id": "TXN_EXISTING_001",
            "analyst_id": "ANALYST_B",
            "decision": "FALSE_POSITIVE",
        })
        assert response.status_code == 200

    def test_escalate_decision(self, client):
        response = client.post("/analyst/decision", json={
            "transaction_id": "TXN_EXISTING_001",
            "analyst_id": "ANALYST_C",
            "decision": "ESCALATE",
        })
        assert response.status_code == 200

    def test_invalid_decision_rejected(self, client):
        response = client.post("/analyst/decision", json={
            "transaction_id": "TXN_EXISTING_001",
            "analyst_id": "ANALYST_D",
            "decision": "INVALID_DECISION",
        })
        assert response.status_code == 400
        assert "Invalid decision" in response.json()["detail"]

    def test_review_persisted_in_db(self, client):
        client.post("/analyst/decision", json={
            "transaction_id": "TXN_EXISTING_001",
            "analyst_id": "ANALYST_E",
            "decision": "CONFIRM_FRAUD",
        })
        # Check via retrieval endpoint
        response = client.get("/analyst/reviews?transaction_id=TXN_EXISTING_001")
        assert response.status_code == 200
        reviews = response.json()
        assert len(reviews) >= 1
        assert any(r["decision"] == "CONFIRM_FRAUD" for r in reviews)


class TestGetAnalystReviews:
    """Tests for GET /analyst/reviews."""

    def test_get_reviews_empty(self, client):
        response = client.get("/analyst/reviews")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_reviews_after_decision(self, client):
        client.post("/analyst/decision", json={
            "transaction_id": "TXN_EXISTING_001",
            "analyst_id": "ANALYST_F",
            "decision": "FALSE_POSITIVE",
        })
        response = client.get("/analyst/reviews")
        assert response.status_code == 200
        assert len(response.json()) >= 1

    def test_filter_by_transaction_id(self, client):
        client.post("/analyst/decision", json={
            "transaction_id": "TXN_EXISTING_001",
            "analyst_id": "ANALYST_G",
            "decision": "ESCALATE",
        })
        response = client.get("/analyst/reviews?transaction_id=TXN_EXISTING_001")
        assert response.status_code == 200
        for r in response.json():
            assert r["transaction_id"] == "TXN_EXISTING_001"
