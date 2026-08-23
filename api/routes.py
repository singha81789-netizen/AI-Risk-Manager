"""
Pydantic schemas, prediction endpoint, and analyst workflow for the AI Risk Manager API.
"""

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.anomaly_detection import AnomalyDetector
from src.audit import (
    log_analyst_decision,
    log_analyst_review,
    log_analyst_review_persisted,
    log_prediction_generated,
    log_risk_score_generated,
    log_transaction_flagged,
    log_transaction_received,
)
from src.config import ANOMALY_MODEL_FILE, MODEL_FILE, MODEL_VERSION, PREPROCESSOR_FILE
from src.database import get_db_session
from src.explainability import ModelExplainer
from src.model_inference import FraudPredictor
from src.models_db import AnalystReview, AuditLog, RiskPrediction, Transaction
from src.utils import load_artifact, logger

router = APIRouter()

# ---------------------------------------------------------------------------
# Module-level singletons — loaded once at import time (cold start).
# Avoids re-loading model artifacts on every request.
# ---------------------------------------------------------------------------

_predictor: Optional[FraudPredictor] = None
_detector: Optional[AnomalyDetector] = None
_explainer: Optional[ModelExplainer] = None


def _load_models() -> None:
    """Load trained artifacts into module-level singletons.

    Called once during application startup.  If the required model files
    do not exist the API still starts but ``/predict`` will return 503.
    """
    global _predictor, _detector, _explainer

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

    if _explainer is None:
        try:
            _explainer = ModelExplainer(
                model_path=MODEL_FILE,
                preprocessor_path=PREPROCESSOR_FILE,
            )
        except Exception as exc:
            logger.warning(f"Could not load model explainer: {exc}")


def _get_predictor() -> FraudPredictor:
    if _predictor is None:
        raise HTTPException(
            status_code=503,
            detail="Fraud prediction model is not loaded. Run the training pipeline first.",
        )
    return _predictor


def _get_detector() -> Optional[AnomalyDetector]:
    return _detector


def _get_explainer() -> Optional[ModelExplainer]:
    return _explainer


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

    # Audit: transaction received
    log_transaction_received(
        transaction_id=payload.transaction_id,
        actor="api",
        details={"amount": payload.amount, "merchant_category": payload.merchant_category},
    )

    try:
        result = predictor.score_transaction(txn_dict)
    except Exception as exc:
        logger.error(f"Prediction failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}")

    response = PredictionResponse(**result)

    # Audit: prediction generated
    log_prediction_generated(
        transaction_id=response.transaction_id,
        fraud_probability=response.fraud_probability,
        risk_score=response.risk_score,
        risk_level=response.risk_level,
        decision=response.decision,
    )

    # Audit: risk score generated
    log_risk_score_generated(
        transaction_id=response.transaction_id,
        risk_score=response.risk_score,
        risk_level=response.risk_level,
    )

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

    # Audit: transaction flagged (when risk level is HIGH)
    if response.risk_level == "HIGH":
        log_transaction_flagged(
            transaction_id=response.transaction_id,
            risk_level=response.risk_level,
            triggered_risk_factors=response.triggered_risk_factors,
        )

    return response


# ---------------------------------------------------------------------------
# Model explainability endpoint
# ---------------------------------------------------------------------------

class FeatureFactorOutput(BaseModel):
    """Single feature contribution in the explanation."""

    feature: str
    raw_feature: str
    contribution: float
    feature_value: Any
    direction: str


class ModelExplanationResponse(BaseModel):
    """Structured response from POST /explain."""

    transaction_id: str
    fraud_probability: float
    risk_score: int
    factors: List[FeatureFactorOutput]
    base_value: float
    model_version: str
    source: str = "model"


class ExplanationRequest(BaseModel):
    """Request payload for generating a model explanation.

    Accepts the same raw transaction fields as the prediction endpoint.
    """

    transaction_id: Optional[str] = Field(None, description="Transaction identifier")
    age: int = Field(..., ge=0, le=150)
    gender: str = Field(...)
    merchant_category: str = Field(...)
    amount: float = Field(..., gt=0)
    transaction_type: str = Field(...)
    card_type: str = Field(...)
    card_present: int = Field(..., ge=0, le=1)
    device_type: str = Field(...)
    distance_from_home: float = Field(..., ge=0)
    distance_from_last_transaction: float = Field(..., ge=0)
    high_risk_country: int = Field(..., ge=0, le=1)
    velocity_last_24h: int = Field(..., ge=0)
    timestamp: Optional[str] = Field(None)


@router.post(
    "/explain",
    response_model=ModelExplanationResponse,
    summary="Generate a human-readable model explanation for a transaction",
    tags=["Explainability"],
)
def explain_transaction(payload: ExplanationRequest) -> ModelExplanationResponse:
    """Generate per-prediction feature contributions using SHAP.

    The response contains:
    - ``factors`` — ranked list of features that contributed to the prediction,
      each with a human-readable name, contribution score, and direction.
    - ``source`` — always ``"model"`` to distinguish from RAG policy explanations.

    This endpoint is isolated from the RAG system.  Model-based explanations
    and policy-based RAG evidence are kept separate by design.
    """
    explainer = _get_explainer()
    if explainer is None:
        raise HTTPException(
            status_code=503,
            detail="Model explainer is not loaded. Run the training pipeline first.",
        )

    txn_dict = payload.model_dump()
    try:
        explanation = explainer.explain(
            raw_transaction=txn_dict,
            transaction_id=payload.transaction_id,
            model_version=MODEL_VERSION,
        )
    except Exception as exc:
        logger.error(f"Explanation failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Explanation failed: {exc}")

    factors = [
        FeatureFactorOutput(
            feature=f.feature,
            raw_feature=f.raw_feature,
            contribution=f.contribution,
            feature_value=f.feature_value,
            direction=f.direction,
        )
        for f in explanation.factors
    ]

    return ModelExplanationResponse(
        transaction_id=explanation.transaction_id,
        fraud_probability=explanation.fraud_probability,
        risk_score=explanation.risk_score,
        factors=factors,
        base_value=explanation.base_value,
        model_version=explanation.model_version,
        source="model",
    )


# ---------------------------------------------------------------------------
# Analyst review / decision schemas
# ---------------------------------------------------------------------------

class AnalystReviewRequest(BaseModel):
    """Payload submitted by an analyst when reviewing a flagged transaction."""

    transaction_id: str = Field(..., description="Transaction being reviewed")
    analyst_id: str = Field(..., description="Unique identifier of the analyst")
    notes: Optional[str] = Field(None, description="Free-text review notes")


class AnalystDecisionRequest(BaseModel):
    """Final decision submitted by an analyst after review."""

    transaction_id: str = Field(..., description="Transaction being decided on")
    analyst_id: str = Field(..., description="Unique identifier of the analyst")
    decision: str = Field(
        ...,
        description="Final decision: CONFIRM_FRAUD, FALSE_POSITIVE, or ESCALATE",
    )
    notes: Optional[str] = Field(None, description="Free-text decision notes")


class AnalystReviewResponse(BaseModel):
    """Response returned after an analyst review or decision is recorded."""

    transaction_id: str
    event_type: str
    actor: str
    status: str


# ---------------------------------------------------------------------------
# Analyst endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/analyst/review",
    response_model=AnalystReviewResponse,
    summary="Record an analyst review of a flagged transaction",
    tags=["Analyst"],
)
def analyst_review(payload: AnalystReviewRequest) -> AnalystReviewResponse:
    """An analyst signals they are reviewing a flagged transaction.

    This is an audit-trail event -- it does not modify the prediction,
    only records that a human review has begun.
    """
    log_analyst_review(
        transaction_id=payload.transaction_id,
        analyst_id=payload.analyst_id,
        notes=payload.notes,
    )
    return AnalystReviewResponse(
        transaction_id=payload.transaction_id,
        event_type="analyst_review",
        actor=payload.analyst_id,
        status="recorded",
    )


@router.post(
    "/analyst/decision",
    response_model=AnalystReviewResponse,
    summary="Record the final analyst decision on a transaction",
    tags=["Analyst"],
)
def analyst_decision(payload: AnalystDecisionRequest) -> AnalystReviewResponse:
    """An analyst submits a final decision for a reviewed transaction.

    Valid decisions: CONFIRM_FRAUD, FALSE_POSITIVE, ESCALATE.

    The decision is persisted to ``analyst_reviews`` alongside the original
    AI prediction values, creating a labelled record suitable for future
    model retraining.
    """
    valid_decisions = {"CONFIRM_FRAUD", "FALSE_POSITIVE", "ESCALATE"}
    if payload.decision not in valid_decisions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid decision '{payload.decision}'. Must be one of: {sorted(valid_decisions)}",
        )

    log_analyst_decision(
        transaction_id=payload.transaction_id,
        analyst_id=payload.analyst_id,
        decision=payload.decision,
        notes=payload.notes,
    )

    # Fetch the AI prediction for this transaction to store alongside the review
    ai_fraud_probability = None
    ai_risk_score = None
    ai_risk_level = None
    ai_decision = None
    try:
        with get_db_session() as session:
            prediction = (
                session.query(RiskPrediction)
                .filter(RiskPrediction.transaction_id == payload.transaction_id)
                .order_by(RiskPrediction.created_at.desc())
                .first()
            )
            if prediction:
                ai_fraud_probability = prediction.fraud_probability
                ai_risk_score = prediction.risk_score
                ai_risk_level = prediction.risk_level
                ai_decision = prediction.prediction
    except Exception as exc:
        logger.warning(f"Could not fetch AI prediction for review: {exc}")

    # Persist the analyst review record
    try:
        with get_db_session() as session:
            review_record = AnalystReview(
                transaction_id=payload.transaction_id,
                analyst_id=payload.analyst_id,
                decision=payload.decision,
                notes=payload.notes,
                ai_fraud_probability=ai_fraud_probability,
                ai_risk_score=ai_risk_score,
                ai_risk_level=ai_risk_level,
                ai_decision=ai_decision,
                model_version=MODEL_VERSION,
            )
            session.add(review_record)
    except Exception as exc:
        logger.warning(f"Failed to persist analyst review: {exc}")

    log_analyst_review_persisted(
        transaction_id=payload.transaction_id,
        analyst_id=payload.analyst_id,
        decision=payload.decision,
        ai_fraud_probability=ai_fraud_probability,
        ai_risk_score=ai_risk_score,
        ai_risk_level=ai_risk_level,
        ai_decision=ai_decision,
    )

    return AnalystReviewResponse(
        transaction_id=payload.transaction_id,
        event_type="analyst_decision",
        actor=payload.analyst_id,
        status="recorded",
    )


@router.get(
    "/audit/logs",
    summary="Retrieve audit logs (optionally filtered by transaction_id)",
    tags=["Audit"],
)
def get_audit_logs(
    transaction_id: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """Return recent audit log entries.

    Pass ``transaction_id`` to filter logs for a specific transaction.
    ``limit`` caps the number of rows returned (default 50, max 500).
    """
    limit = min(limit, 500)
    try:
        with get_db_session() as session:
            query = session.query(AuditLog)
            if transaction_id:
                query = query.filter(AuditLog.transaction_id == transaction_id)
            rows = (
                query.order_by(AuditLog.timestamp.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "id": r.id,
                    "event_type": r.event_type,
                    "transaction_id": r.transaction_id,
                    "actor": r.actor,
                    "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                    "details": json.loads(r.details) if r.details else None,
                    "model_version": r.model_version,
                }
                for r in rows
            ]
    except Exception as exc:
        logger.error(f"Failed to fetch audit logs: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve audit logs")


# ---------------------------------------------------------------------------
# Analyst review retrieval
# ---------------------------------------------------------------------------

@router.get(
    "/analyst/reviews",
    summary="Retrieve analyst reviews (optionally filtered by transaction_id)",
    tags=["Analyst"],
)
def get_analyst_reviews(
    transaction_id: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """Return persisted analyst review records.

    Pass ``transaction_id`` to filter reviews for a specific transaction.
    ``limit`` caps the number of rows returned (default 50, max 500).
    """
    limit = min(limit, 500)
    try:
        with get_db_session() as session:
            query = session.query(AnalystReview)
            if transaction_id:
                query = query.filter(AnalystReview.transaction_id == transaction_id)
            rows = (
                query.order_by(AnalystReview.created_at.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "id": r.id,
                    "transaction_id": r.transaction_id,
                    "analyst_id": r.analyst_id,
                    "decision": r.decision,
                    "notes": r.notes,
                    "ai_fraud_probability": r.ai_fraud_probability,
                    "ai_risk_score": r.ai_risk_score,
                    "ai_risk_level": r.ai_risk_level,
                    "ai_decision": r.ai_decision,
                    "model_version": r.model_version,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ]
    except Exception as exc:
        logger.error(f"Failed to fetch analyst reviews: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analyst reviews")
