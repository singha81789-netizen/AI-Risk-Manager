"""
Tests for FastAPI endpoints (Areas 6 & 7).

Covers: GET /health, POST /predict with valid payloads.
Uses mock model artifacts and in-memory SQLite database.
"""

import joblib
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.models_db import Base


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
    """Create a FastAPI test app with mock models and in-memory DB."""
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


class TestHealthEndpoint:
    """Tests for GET /health."""

    def test_health_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_status_healthy(self, client):
        response = client.get("/health")
        data = response.json()
        assert data["status"] == "healthy"

    def test_health_service_name(self, client):
        response = client.get("/health")
        data = response.json()
        assert data["service"] == "ai-risk-manager"

    def test_health_has_timestamp(self, client):
        response = client.get("/health")
        data = response.json()
        assert "timestamp" in data

    def test_health_returns_json(self, client):
        response = client.get("/health")
        assert "application/json" in response.headers["content-type"]


class TestPredictEndpoint:
    """Tests for POST /predict."""

    def test_predict_returns_200(self, client, sample_low_risk_txn):
        response = client.post("/predict", json=sample_low_risk_txn)
        assert response.status_code == 200

    def test_predict_response_fields(self, client, sample_low_risk_txn):
        response = client.post("/predict", json=sample_low_risk_txn)
        data = response.json()
        assert "transaction_id" in data
        assert "fraud_probability" in data
        assert "risk_score" in data
        assert "risk_level" in data
        assert "decision" in data
        assert "is_fraud_predicted" in data
        assert "triggered_risk_factors" in data

    def test_predict_fraud_probability_range(self, client, sample_low_risk_txn):
        response = client.post("/predict", json=sample_low_risk_txn)
        data = response.json()
        assert 0.0 <= data["fraud_probability"] <= 1.0

    def test_predict_risk_score_range(self, client, sample_low_risk_txn):
        response = client.post("/predict", json=sample_low_risk_txn)
        data = response.json()
        assert 0 <= data["risk_score"] <= 100

    def test_predict_decision_valid(self, client, sample_low_risk_txn):
        response = client.post("/predict", json=sample_low_risk_txn)
        data = response.json()
        assert data["decision"] in ["APPROVE", "REVIEW", "DECLINE"]

    def test_predict_risk_level_valid(self, client, sample_low_risk_txn):
        response = client.post("/predict", json=sample_low_risk_txn)
        data = response.json()
        assert data["risk_level"] in ["LOW", "MEDIUM", "HIGH"]

    def test_predict_transaction_id_echoed(self, client, sample_low_risk_txn):
        response = client.post("/predict", json=sample_low_risk_txn)
        data = response.json()
        assert data["transaction_id"] == sample_low_risk_txn["transaction_id"]

    def test_predict_high_risk_transaction(self, client, sample_high_risk_txn):
        response = client.post("/predict", json=sample_high_risk_txn)
        assert response.status_code == 200
        data = response.json()
        assert data["risk_level"] in ["MEDIUM", "HIGH"]

    def test_predict_with_minimal_payload(self, client):
        """Minimal valid payload with only required fields."""
        payload = {
            "age": 30,
            "gender": "M",
            "merchant_category": "grocery",
            "amount": 50.0,
            "transaction_type": "POS",
            "card_type": "Debit",
            "card_present": 1,
            "device_type": "POS_Terminal",
            "distance_from_home": 5.0,
            "distance_from_last_transaction": 2.0,
            "high_risk_country": 0,
            "velocity_last_24h": 1,
        }
        response = client.post("/predict", json=payload)
        assert response.status_code == 200

    def test_predict_returns_json(self, client, sample_low_risk_txn):
        response = client.post("/predict", json=sample_low_risk_txn)
        assert "application/json" in response.headers["content-type"]
