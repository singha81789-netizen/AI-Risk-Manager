"""
Pydantic schemas and prediction endpoint for the AI Risk Manager API.
"""

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.anomaly_detection import AnomalyDetector
from src.config import ANOMALY_MODEL_FILE, MODEL_FILE, MODEL_VERSION, PREPROCESSOR_FILE
from src.database import get_db_session
from src.model_inference import FraudPredictor
from src.models_db import RiskPrediction, Transaction
from src.utils import load_artifact, logger

router = APIRouter()

# ---------------------------------------------------------------------------
# Module-level singletons — loaded once at import time (cold start).
# Avoids re-loading model artifacts on every request.
# ---------------------------------------------------------------------------

_predictor: Optional[FraudPredictor] = None
_detector: Optional[AnomalyDetector] = None


def _load_models() -> None:
    """Load trained artifacts into module-level singletons.

    Called once during application startup.  If the required model files
    do not exist the API still starts but ``/predict`` will return 503.
    """
    global _predictor, _detector

    if _predictor is None:
        try:
            _predictor = FraudPredictor(
                model_path=MODEL_FILE,
                preprocessor_path=PREPROCESSOR_FILE,
            )
        except FileNotFoundError as exc:
            logger.warning(f"Could not load fraud predictor: {exc}")

    if _detector is None and ANOMALY_MODEL_FILE.exists():
        try:
            _detector = AnomalyDetector(model_path=ANOMALY_MODEL_FILE)
        except Exception as exc:
            logger.warning(f"Could not load anomaly detector: {exc}")


def _get_predictor() -> FraudPredictor:
    if _predictor is None:
        raise HTTPException(
            status_code=503,
            detail="Fraud prediction model is not loaded. Run the training pipeline first.",
        )
    return _predictor


def _get_detector() -> Optional[AnomalyDetector]:
    return _detector


# ---------------------------------------------------------------------------
# Pydantic request / response schemas
# ---------------------------------------------------------------------------

class TransactionRequest(BaseModel):
    """Validated input payload for a single transaction."""

    transaction_id: Optional[str] = Field(None, description="Unique transaction identifier")
    customer_id: Optional[str] = Field(None, description="Customer identifier")
    merchant_id: Optional[str] = Field(None, description="Merchant identifier")
    timestamp: Optional[str] = Field(None, description="Transaction timestamp (ISO-8601)")

    age: int = Field(..., ge=0, le=150, description="Customer age")
    gender: str = Field(..., description="Customer gender (M / F)")
    merchant_category: str = Field(..., description="Merchant category")
    amount: float = Field(..., gt=0, description="Transaction amount in USD")
    transaction_type: str = Field(..., description="Payment method / channel")
    card_type: str = Field(..., description="Card type (Credit / Debit / Prepaid)")
    card_present: int = Field(..., ge=0, le=1, description="1 if card physically present, 0 otherwise")
    device_type: str = Field(..., description="Device used for transaction")
    distance_from_home: float = Field(..., ge=0, description="Distance from home in km")
    distance_from_last_transaction: float = Field(..., ge=0, description="Distance from last txn in km")
    high_risk_country: int = Field(..., ge=0, le=1, description="1 if origin is high-risk country")
    velocity_last_24h: int = Field(..., ge=0, description="Number of transactions in last 24 h")

    model_config = {"json_schema_extra": {"example": {
        "transaction_id": "TXN_00001",
        "customer_id": "CUST_001",
        "merchant_id": "MERCH_042",
        "timestamp": "2026-04-10 03:30:00",
        "age": 34,
        "gender": "M",
        "merchant_category": "electronics",
        "amount": 1250.00,
        "transaction_type": "Wire_Transfer",
        "card_type": "Credit",
        "card_present": 0,
        "device_type": "Web_Browser",
        "distance_from_home": 140.5,
        "distance_from_last_transaction": 80.0,
        "high_risk_country": 1,
        "velocity_last_24h": 6,
    }}}


class AnomalyOutput(BaseModel):
    """Optional anomaly detection signal attached to the prediction."""

    is_anomaly: bool
    anomaly_score: float
    anomaly_label: str


class PredictionResponse(BaseModel):
    """Structured JSON response returned by POST /predict."""

    transaction_id: Optional[str]
    fraud_probability: float
    risk_score: int
    risk_level: str
    decision: str
    is_fraud_predicted: bool
    triggered_risk_factors: List[str]
    anomaly: Optional[AnomalyOutput] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/predict",
    response_model=PredictionResponse,
    summary="Score a transaction for fraud risk",
    tags=["Prediction"],
)
def predict_transaction(payload: TransactionRequest) -> PredictionResponse:
    """Accept a raw transaction, run it through the supervised fraud
    classifier and optional anomaly detector, and return a structured
    risk assessment.

    The response contains:
    - ``fraud_probability`` — P(fraud) from the trained model.
    - ``risk_score`` — 0–100 score derived from the probability.
    - ``risk_level`` — LOW / MEDIUM / HIGH.
    - ``decision`` — automated action: APPROVE / REVIEW / DECLINE.
    - ``triggered_risk_factors`` — human-readable rule-based triggers.
    - ``anomaly`` — optional anomaly signal when the detector is available.
    """
    predictor = _get_predictor()
    txn_dict = payload.model_dump()

    try:
        result = predictor.score_transaction(txn_dict)
    except Exception as exc:
        logger.error(f"Prediction failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}")

    response = PredictionResponse(**result)

    # Optional anomaly detection
    detector = _get_detector()
    if detector is not None:
        try:
            X = predictor._preprocess_input(txn_dict)
            anomaly_results = detector.detect(X)
            if anomaly_results:
                ar = anomaly_results[0]
                response.anomaly = AnomalyOutput(
                    is_anomaly=ar.is_anomaly,
                    anomaly_score=ar.anomaly_score,
                    anomaly_label=ar.anomaly_label,
                )
        except Exception as exc:
            logger.warning(f"Anomaly detection skipped: {exc}")

    # Persist transaction and prediction to the database
    try:
        with get_db_session() as session:
            txn_record = Transaction(
                transaction_id=payload.transaction_id,
                customer_id=payload.customer_id,
                merchant_id=payload.merchant_id,
                timestamp=payload.timestamp,
                age=payload.age,
                gender=payload.gender,
                merchant_category=payload.merchant_category,
                amount=payload.amount,
                transaction_type=payload.transaction_type,
                card_type=payload.card_type,
                card_present=payload.card_present,
                device_type=payload.device_type,
                distance_from_home=payload.distance_from_home,
                distance_from_last_transaction=payload.distance_from_last_transaction,
                high_risk_country=payload.high_risk_country,
                velocity_last_24h=payload.velocity_last_24h,
            )
            session.add(txn_record)

            prediction_record = RiskPrediction(
                transaction_id=response.transaction_id,
                fraud_probability=response.fraud_probability,
                risk_score=response.risk_score,
                risk_level=response.risk_level,
                prediction=response.decision,
                triggered_risk_factors=json.dumps(response.triggered_risk_factors),
                model_version=MODEL_VERSION,
            )
            session.add(prediction_record)
    except Exception as exc:
        logger.warning(f"Failed to persist prediction to database: {exc}")

    return response
