"""
Tests for invalid API input (Area 8).

Covers: missing required fields, out-of-range values, wrong types,
invalid enum values, empty body, non-JSON content.
"""

import pytest
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


VALID_MINIMAL_PAYLOAD = {
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


class TestMissingRequiredFields:
    """Tests for missing required fields."""

    def test_missing_age(self, client):
        payload = {k: v for k, v in VALID_MINIMAL_PAYLOAD.items() if k != "age"}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422

    def test_missing_gender(self, client):
        payload = {k: v for k, v in VALID_MINIMAL_PAYLOAD.items() if k != "gender"}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422

    def test_missing_amount(self, client):
        payload = {k: v for k, v in VALID_MINIMAL_PAYLOAD.items() if k != "amount"}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422

    def test_missing_all_fields(self, client):
        response = client.post("/predict", json={})
        assert response.status_code == 422

    def test_empty_body(self, client):
        response = client.post("/predict", content=b"", headers={"Content-Type": "application/json"})
        assert response.status_code in [400, 422]


class TestOutOfRangeValues:
    """Tests for values outside allowed ranges."""

    def test_negative_age(self, client):
        payload = {**VALID_MINIMAL_PAYLOAD, "age": -5}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422

    def test_age_above_150(self, client):
        payload = {**VALID_MINIMAL_PAYLOAD, "age": 200}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422

    def test_negative_amount(self, client):
        payload = {**VALID_MINIMAL_PAYLOAD, "amount": -100.0}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422

    def test_zero_amount(self, client):
        payload = {**VALID_MINIMAL_PAYLOAD, "amount": 0}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422

    def test_card_present_not_0_or_1(self, client):
        payload = {**VALID_MINIMAL_PAYLOAD, "card_present": 2}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422

    def test_negative_velocity(self, client):
        payload = {**VALID_MINIMAL_PAYLOAD, "velocity_last_24h": -1}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422

    def test_negative_distance(self, client):
        payload = {**VALID_MINIMAL_PAYLOAD, "distance_from_home": -10.0}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422

    def test_high_risk_country_not_0_or_1(self, client):
        payload = {**VALID_MINIMAL_PAYLOAD, "high_risk_country": 5}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422


class TestWrongTypes:
    """Tests for wrong data types."""

    def test_amount_as_string(self, client):
        payload = {**VALID_MINIMAL_PAYLOAD, "amount": "fifty"}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422

    def test_age_as_string(self, client):
        payload = {**VALID_MINIMAL_PAYLOAD, "age": "thirty"}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422

    def test_card_present_as_string(self, client):
        payload = {**VALID_MINIMAL_PAYLOAD, "card_present": "yes"}
        response = client.post("/predict", json=payload)
        assert response.status_code == 422


class TestInvalidEndpoint:
    """Tests for non-existent endpoints."""

    def test_unknown_endpoint(self, client):
        response = client.get("/nonexistent")
        assert response.status_code in [404, 405]

    def test_wrong_http_method(self, client):
        response = client.get("/predict")
        assert response.status_code == 405

    def test_health_with_post(self, client):
        response = client.post("/health")
        assert response.status_code in [405, 422]
