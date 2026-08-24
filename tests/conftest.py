"""
Shared pytest fixtures for the AI Risk Manager test suite.

Provides deterministic synthetic data, in-memory SQLite database setup,
and mock model artifacts so tests never depend on real banking systems
or real sensitive data.
"""

import json
import os
import tempfile
from pathlib import Path
from typing import Generator
from unittest.mock import MagicMock, patch

import joblib
import numpy as np
import pandas as pd
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.models_db import Base


# ---------------------------------------------------------------------------
# Deterministic synthetic transaction data
# ---------------------------------------------------------------------------

@pytest.fixture
def synthetic_transactions_df() -> pd.DataFrame:
    """Generate 200 deterministic synthetic transactions (no real data)."""
    rng = np.random.RandomState(42)
    n = 200

    records = []
    for i in range(n):
        is_fraud = int(i < 30)  # first 30 are fraud
        txn = {
            "transaction_id": f"TXN_{i:05d}",
            "customer_id": f"CUST_{i % 20:03d}",
            "merchant_id": f"MERCH_{i % 50:03d}",
            "timestamp": f"2026-01-{1 + i % 28:02d} {i % 24:02d}:{i % 60:02d}:00",
            "age": int(rng.randint(18, 75)),
            "gender": rng.choice(["M", "F"]),
            "merchant_category": rng.choice(
                ["grocery", "electronics", "travel", "online_retail", "restaurant"]
            ),
            "amount": float(rng.exponential(100) + (500 if is_fraud else 0)),
            "transaction_type": rng.choice(
                ["POS", "Online", "Wire_Transfer", "ATM", "P2P"]
            ),
            "card_type": rng.choice(["Credit", "Debit", "Prepaid"]),
            "card_present": int(rng.choice([0, 1], p=[0.7 if is_fraud else 0.3, 0.3 if is_fraud else 0.7])),
            "device_type": rng.choice(
                ["Mobile_App", "Web_Browser", "POS_Terminal", "ATM_Machine"]
            ),
            "distance_from_home": float(rng.exponential(20) + (100 if is_fraud else 0)),
            "distance_from_last_transaction": float(rng.exponential(10) + (50 if is_fraud else 0)),
            "high_risk_country": int(rng.choice([0, 1], p=[0.8 if not is_fraud else 0.3, 0.2 if not is_fraud else 0.7])),
            "velocity_last_24h": int(rng.poisson(2) + (4 if is_fraud else 0)),
            "is_fraud": is_fraud,
        }
        records.append(txn)

    return pd.DataFrame(records)


@pytest.fixture
def synthetic_raw_csv(tmp_path: Path, synthetic_transactions_df: pd.DataFrame) -> Path:
    """Write synthetic transactions to a temporary CSV file."""
    csv_path = tmp_path / "raw_transactions.csv"
    synthetic_transactions_df.to_csv(csv_path, index=False)
    return csv_path


# ---------------------------------------------------------------------------
# In-memory SQLite database
# ---------------------------------------------------------------------------

@pytest.fixture
def db_engine():
    """Create an in-memory SQLite engine for testing."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    """Yield a transactional DB session; rolls back after test."""
    SessionLocal = sessionmaker(bind=db_engine, expire_on_commit=False)
    session = SessionLocal()
    try:
        yield session
        session.rollback()
    finally:
        session.close()


@pytest.fixture
def override_get_db(db_engine):
    """Return a dependency-overriding generator for FastAPI."""
    SessionLocal = sessionmaker(bind=db_engine, expire_on_commit=False)

    def _override():
        session = SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    return _override


# ---------------------------------------------------------------------------
# Sample raw transaction dictionary (for inference tests)
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_low_risk_txn() -> dict:
    """A low-risk, legitimate-looking transaction."""
    return {
        "transaction_id": "TXN_TEST_LOW",
        "customer_id": "CUST_001",
        "merchant_id": "MERCH_001",
        "timestamp": "2026-01-15 12:00:00",
        "age": 42,
        "gender": "F",
        "merchant_category": "grocery",
        "amount": 45.99,
        "transaction_type": "POS",
        "card_type": "Debit",
        "card_present": 1,
        "device_type": "POS_Terminal",
        "distance_from_home": 2.5,
        "distance_from_last_transaction": 1.0,
        "high_risk_country": 0,
        "velocity_last_24h": 2,
    }


@pytest.fixture
def sample_high_risk_txn() -> dict:
    """A high-risk transaction with multiple fraud indicators."""
    return {
        "transaction_id": "TXN_TEST_HIGH",
        "customer_id": "CUST_999",
        "merchant_id": "MERCH_999",
        "timestamp": "2026-01-15 03:30:00",
        "age": 28,
        "gender": "M",
        "merchant_category": "electronics",
        "amount": 2500.00,
        "transaction_type": "Wire_Transfer",
        "card_type": "Credit",
        "card_present": 0,
        "device_type": "Web_Browser",
        "distance_from_home": 250.0,
        "distance_from_last_transaction": 180.0,
        "high_risk_country": 1,
        "velocity_last_24h": 8,
    }


@pytest.fixture
def sample_transactions_batch() -> list[dict]:
    """A batch of 5 deterministic test transactions."""
    return [
        {
            "transaction_id": f"TXN_BATCH_{i}",
            "customer_id": f"CUST_{i:03d}",
            "merchant_id": f"MERCH_{i:03d}",
            "timestamp": f"2026-01-10 {10 + i}:00:00",
            "age": 25 + i * 5,
            "gender": "M" if i % 2 == 0 else "F",
            "merchant_category": cat,
            "amount": amt,
            "transaction_type": tx,
            "card_type": "Credit",
            "card_present": cp,
            "device_type": "Mobile_App",
            "distance_from_home": dist,
            "distance_from_last_transaction": dist * 0.5,
            "high_risk_country": hr,
            "velocity_last_24h": vel,
        }
        for i, (cat, amt, tx, cp, dist, hr, vel) in enumerate([
            ("grocery", 35.0, "POS", 1, 3.0, 0, 1),
            ("electronics", 899.99, "Online", 0, 120.0, 0, 5),
            ("travel", 3200.00, "Wire_Transfer", 0, 500.0, 1, 7),
            ("restaurant", 65.50, "POS", 1, 5.0, 0, 2),
            ("online_retail", 199.00, "Online", 0, 80.0, 0, 3),
        ])
    ]


# ---------------------------------------------------------------------------
# Mock ML model artifacts (for tests that don't need the real model)
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_fitted_pipeline():
    """Create a minimal fitted preprocessor pipeline for testing."""
    from src.feature_engineering import build_preprocessor
    rng = np.random.RandomState(42)
    n = 100
    mini_df = pd.DataFrame({
        "transaction_id": [f"TXN_{i}" for i in range(n)],
        "customer_id": [f"CUST_{i % 5}" for i in range(n)],
        "merchant_id": [f"MERCH_{i % 10}" for i in range(n)],
        "timestamp": [f"2026-01-01 {i % 24:02d}:00:00" for i in range(n)],
        "age": rng.randint(18, 75, n),
        "gender": rng.choice(["M", "F"], n),
        "merchant_category": rng.choice(["grocery", "electronics", "travel"], n),
        "amount": rng.exponential(100, n),
        "transaction_type": rng.choice(["POS", "Online", "Wire_Transfer"], n),
        "card_type": rng.choice(["Credit", "Debit"], n),
        "card_present": rng.choice([0, 1], n),
        "device_type": rng.choice(["Mobile_App", "Web_Browser"], n),
        "distance_from_home": rng.exponential(20, n),
        "distance_from_last_transaction": rng.exponential(10, n),
        "high_risk_country": rng.choice([0, 1], n, p=[0.8, 0.2]),
        "velocity_last_24h": rng.poisson(2, n),
        "is_fraud": rng.choice([0, 1], n, p=[0.95, 0.05]),
    })
    pipeline = build_preprocessor()
    pipeline.fit(mini_df)
    return pipeline


@pytest.fixture
def mock_model(mock_fitted_pipeline):
    """Create a minimal trained RandomForest for testing."""
    from sklearn.ensemble import RandomForestClassifier
    rng = np.random.RandomState(42)
    n = 100
    mini_df = pd.DataFrame({
        "transaction_id": [f"TXN_{i}" for i in range(n)],
        "customer_id": [f"CUST_{i % 5}" for i in range(n)],
        "merchant_id": [f"MERCH_{i % 10}" for i in range(n)],
        "timestamp": [f"2026-01-01 {i % 24:02d}:00:00" for i in range(n)],
        "age": rng.randint(18, 75, n),
        "gender": rng.choice(["M", "F"], n),
        "merchant_category": rng.choice(["grocery", "electronics", "travel"], n),
        "amount": rng.exponential(100, n),
        "transaction_type": rng.choice(["POS", "Online", "Wire_Transfer"], n),
        "card_type": rng.choice(["Credit", "Debit"], n),
        "card_present": rng.choice([0, 1], n),
        "device_type": rng.choice(["Mobile_App", "Web_Browser"], n),
        "distance_from_home": rng.exponential(20, n),
        "distance_from_last_transaction": rng.exponential(10, n),
        "high_risk_country": rng.choice([0, 1], n, p=[0.8, 0.2]),
        "velocity_last_24h": rng.poisson(2, n),
        "is_fraud": rng.choice([0, 1], n, p=[0.95, 0.05]),
    })
    y = mini_df["is_fraud"]
    X = mock_fitted_pipeline.transform(mini_df.drop(columns=["is_fraud"]))
    model = RandomForestClassifier(n_estimators=10, max_depth=5, random_state=42)
    model.fit(X, y)
    return model


@pytest.fixture
def mock_predictor_artifacts(tmp_path, mock_model, mock_fitted_pipeline):
    """Save mock model and preprocessor to temp dir, return paths."""
    model_path = tmp_path / "model.pkl"
    preprocessor_path = tmp_path / "preprocessor.joblib"
    joblib.dump(mock_model, model_path)
    joblib.dump(mock_fitted_pipeline, preprocessor_path)
    return model_path, preprocessor_path


# ---------------------------------------------------------------------------
# Knowledge base fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def kb_documents_dir(tmp_path: Path) -> Path:
    """Create a temporary knowledge base with sample markdown files."""
    kb_dir = tmp_path / "knowledge_base"
    kb_dir.mkdir()

    (kb_dir / "fraud_rules.md").write_text(
        """# Fraud Risk Indicators

## Amount Thresholds
Transactions exceeding $500 are considered high-value and should be reviewed.
Round-number transactions (e.g., $1000.00) are more common in fraud.

## Velocity Rules
More than 4 transactions in 24 hours triggers a velocity alert.
Rapid successive transactions from different locations indicate potential fraud.

## Geographic Indicators
Transactions from high-risk countries require additional verification.
Distance greater than 50km from the customer's home address is suspicious.
""",
        encoding="utf-8",
    )

    (kb_dir / "review_procedures.md").write_text(
        """# Transaction Review Rules

## Decision Categories
- CONFIRM_FRAUD: The transaction is confirmed as fraudulent.
- FALSE_POSITIVE: The AI flagged incorrectly; transaction is legitimate.
- ESCALATE: Requires senior analyst or management review.

## Review Workflow
1. Triage: Initial assessment within 30 minutes.
2. Investigation: Detailed analysis within 2 hours.
3. Decision: Final determination within 4 hours.

## Escalation Triggers
- Transaction amount exceeds $5000
- Multiple related accounts flagged
- Organized fraud ring suspected
""",
        encoding="utf-8",
    )

    return kb_dir
