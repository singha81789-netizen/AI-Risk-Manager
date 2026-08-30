"""
CSV upload and batch processing endpoints for AI Risk Manager.

Accepts CSV files of transactions, runs them through the ML pipeline,
and returns results with risk scores and explanations.
"""

import io
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func

from src.config import (
    ANOMALY_MODEL_FILE,
    CATEGORICAL_FEATURES,
    MODEL_FILE,
    MODEL_VERSION,
    NUMERICAL_FEATURES,
    PREPROCESSOR_FILE,
    RISK_THRESHOLD_HIGH,
    RISK_THRESHOLD_MEDIUM,
)
from src.database import get_db_session
from src.ensemble_detection import EnsembleAnomalyDetector
from src.model_inference import FraudPredictor
from src.models_db import Alert, RiskPrediction, Transaction
from src.utils import logger

router = APIRouter()

# ---------------------------------------------------------------------------
# Module-level singletons (lazy-loaded)
# ---------------------------------------------------------------------------

_predictor: Optional[FraudPredictor] = None
_ensemble: Optional[EnsembleAnomalyDetector] = None
_training_features: Optional[pd.DataFrame] = None


def _get_predictor() -> FraudPredictor:
    global _predictor
    if _predictor is None:
        try:
            _predictor = FraudPredictor(
                model_path=MODEL_FILE,
                preprocessor_path=PREPROCESSOR_FILE,
            )
        except FileNotFoundError as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Model not loaded: {exc}. Run the training pipeline first.",
            )
    return _predictor


def _get_ensemble() -> Optional[EnsembleAnomalyDetector]:
    """Return ensemble detector, fitting on cached training features if needed."""
    global _ensemble, _training_features
    if _ensemble is not None:
        return _ensemble

    try:
        _ensemble = EnsembleAnomalyDetector(contamination=0.05)
        # Try to load training data for fitting the ensemble
        from src.data_loader import load_and_clean_data
        from src.feature_engineering import build_feature_pipeline

        df = load_and_clean_data()
        pipeline = build_feature_pipeline()
        X = pipeline.fit_transform(df)
        _training_features = X
        _ensemble.fit(X)
        logger.info("Ensemble anomaly detector fitted on training data.")
    except Exception as exc:
        logger.warning(f"Could not fit ensemble detector: {exc}")
        _ensemble = None

    return _ensemble


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class BatchResult(BaseModel):
    """Result for a single transaction in a batch upload."""
    transaction_id: Optional[str]
    amount: Optional[float]
    merchant_category: Optional[str]
    fraud_probability: float
    risk_score: int
    risk_level: str
    decision: str
    triggered_risk_factors: List[str]
    is_anomaly: bool = False
    anomaly_score: float = 0.0


class BatchUploadResponse(BaseModel):
    """Response from POST /upload/csv."""
    filename: str
    total_rows: int
    processed_rows: int
    errors: List[str]
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    alerts_created: int
    results: List[BatchResult]


class PreviewResponse(BaseModel):
    """Preview of CSV contents before running analysis."""
    filename: str
    total_rows: int
    columns: List[str]
    preview_rows: List[Dict[str, Any]]
    detected_schema: Dict[str, str]


# ---------------------------------------------------------------------------
# Column mapping helper
# ---------------------------------------------------------------------------

# Map common alternative column names to our expected schema
COLUMN_ALIASES = {
    # transaction_id
    "txn_id": "transaction_id",
    "txn_number": "transaction_id",
    "id": "transaction_id",
    "transactionid": "transaction_id",
    "transaction_id": "transaction_id",
    # customer_id
    "cust_id": "customer_id",
    "customerid": "customer_id",
    "user_id": "customer_id",
    "userid": "customer_id",
    # merchant_id
    "merchantid": "merchant_id",
    "store_id": "merchant_id",
    # timestamp
    "date": "timestamp",
    "datetime": "timestamp",
    "time": "timestamp",
    "transaction_date": "timestamp",
    "transaction_time": "timestamp",
    # amount
    "txn_amount": "amount",
    "value": "amount",
    "total": "amount",
    "price": "amount",
    # merchant_category
    "category": "merchant_category",
    "mcc": "merchant_category",
    "merchant_type": "merchant_category",
    # transaction_type
    "payment_method": "transaction_type",
    "payment_type": "transaction_type",
    "channel": "transaction_type",
    "type": "transaction_type",
    # card_type
    "card": "card_type",
    # card_present
    "cardpresent": "card_present",
    "present": "card_present",
    # device_type
    "device": "device_type",
    # distance_from_home
    "distancehome": "distance_from_home",
    "dist_home": "distance_from_home",
    # distance_from_last_transaction
    "distancelast": "distance_from_last_transaction",
    "dist_last": "distance_from_last_transaction",
    # high_risk_country
    "highriskcountry": "high_risk_country",
    "high_risk": "high_risk_country",
    # velocity_last_24h
    "velocity": "velocity_last_24h",
    "txns_last_24h": "velocity_last_24h",
    "frequency": "velocity_last_24h",
}


def _auto_map_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Attempt to auto-detect and rename columns to the expected schema."""
    renamed = {}
    for col in df.columns:
        normalized = col.strip().lower().replace(" ", "_").replace("-", "_")
        if normalized in COLUMN_ALIASES:
            renamed[col] = COLUMN_ALIASES[normalized]
        elif normalized in [
            "transaction_id", "customer_id", "merchant_id", "timestamp",
            "age", "gender", "merchant_category", "amount", "transaction_type",
            "card_type", "card_present", "device_type", "distance_from_home",
            "distance_from_last_transaction", "high_risk_country",
            "velocity_last_24h",
        ]:
            renamed[col] = normalized
    return df.rename(columns=renamed)


def _detect_schema(df: pd.DataFrame) -> Dict[str, str]:
    """Detect the data type of each column for the preview."""
    schema = {}
    for col in df.columns:
        dtype = str(df[col].dtype)
        if "int" in dtype:
            schema[col] = "integer"
        elif "float" in dtype:
            schema[col] = "float"
        elif "datetime" in dtype:
            schema[col] = "datetime"
        else:
            schema[col] = "string"
    return schema


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/upload/preview",
    response_model=PreviewResponse,
    summary="Preview CSV file contents before analysis",
    tags=["Upload"],
)
async def preview_csv(file: UploadFile = File(...)) -> PreviewResponse:
    """Upload a CSV and get a preview of its contents and detected schema.

    This does NOT run the ML pipeline — it only validates and previews.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV file")

    try:
        content = await file.read()
        if len(content) > 500 * 1024 * 1024:  # 500MB limit
            raise HTTPException(status_code=400, detail="File size exceeds 500MB limit")

        df = pd.read_csv(io.BytesIO(content))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {exc}")

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    # Auto-map columns
    df = _auto_map_columns(df)
    schema = _detect_schema(df)

    preview = df.head(20).where(df.head(20).notna(), None).to_dict(orient="records")

    return PreviewResponse(
        filename=file.filename,
        total_rows=len(df),
        columns=list(df.columns),
        preview_rows=preview,
        detected_schema=schema,
    )


CHUNK_SIZE = 5000  # rows per chunk for large files

def _prepare_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Prepare a dataframe chunk for ML scoring: map columns, fill defaults, cast types."""
    df = _auto_map_columns(df)

    # transaction_id defaults
    if "transaction_id" not in df.columns:
        df["transaction_id"] = [f"BATCH_{i:06d}" for i in range(len(df))]
    else:
        missing_mask = df["transaction_id"].isna() | (df["transaction_id"].astype(str).str.strip() == "")
        if missing_mask.any():
            batch_ids = [f"BATCH_{i:06d}" for i in range(missing_mask.sum())]
            df.loc[missing_mask, "transaction_id"] = batch_ids

    scalar_defaults = {
        "age": 35, "gender": "M", "merchant_category": "unknown",
        "transaction_type": "POS", "card_type": "Credit",
        "card_present": 1, "device_type": "Unknown",
        "distance_from_home": 0.0, "distance_from_last_transaction": 0.0,
        "high_risk_country": 0, "velocity_last_24h": 1,
    }
    for col, default_val in scalar_defaults.items():
        if col not in df.columns:
            df[col] = default_val
        else:
            df[col] = df[col].fillna(default_val)

    for col in ["amount", "distance_from_home", "distance_from_last_transaction"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    for col in ["age", "card_present", "high_risk_country", "velocity_last_24h"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)

    return df


@router.post(
    "/upload/csv",
    response_model=BatchUploadResponse,
    summary="Upload CSV and run batch fraud analysis",
    tags=["Upload"],
)
async def upload_csv(
    file: UploadFile = File(...),
    medium_threshold: float = RISK_THRESHOLD_MEDIUM,
    high_threshold: float = RISK_THRESHOLD_HIGH,
) -> BatchUploadResponse:
    """Upload a CSV of transactions and run the full ML pipeline.

    Each row is scored using the supervised fraud classifier and the
    ensemble anomaly detector. Results are persisted to the database
    and alerts are auto-generated for high-risk transactions.
    """
    predictor = _get_predictor()

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV file")

    # Stream the file to a temp path so we don't load 470MB into RAM
    import tempfile, os
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
            total_bytes = 0
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > 500 * 1024 * 1024:
                    os.unlink(tmp.name)
                    raise HTTPException(status_code=400, detail="File size exceeds 500MB limit")
                tmp.write(chunk)
            tmp_path = tmp.name

        # Read CSV in chunks to handle large files
        results: List[BatchResult] = []
        errors: List[str] = []
        high_count = 0
        medium_count = 0
        low_count = 0
        alerts_created = 0
        total_rows = 0
        ensemble = _get_ensemble()
        csv_chunks = pd.read_csv(tmp_path, chunksize=CHUNK_SIZE)

        for chunk_idx, chunk_df in enumerate(csv_chunks):
            if chunk_df.empty:
                continue

            chunk_df = _prepare_dataframe(chunk_df)

            if "amount" not in chunk_df.columns:
                errors.append(f"Chunk {chunk_idx}: missing 'amount' column")
                continue

            for idx, row in chunk_df.iterrows():
                txn_dict = row.to_dict()
                global_idx = chunk_idx * CHUNK_SIZE + idx
                txn_id = txn_dict.get("transaction_id", f"BATCH_{global_idx:06d}")

                try:
                    result = predictor.score_transaction(txn_dict)
                    result["transaction_id"] = txn_id

                    is_anomaly = False
                    anomaly_score = 0.0
                    if ensemble is not None:
                        try:
                            row_df = pd.DataFrame([txn_dict])
                            for col in ["amount", "distance_from_home", "distance_from_last_transaction"]:
                                if col in row_df.columns:
                                    row_df[col] = pd.to_numeric(row_df[col], errors="coerce").fillna(0.0)
                            for col in ["age", "card_present", "high_risk_country", "velocity_last_24h"]:
                                if col in row_df.columns:
                                    row_df[col] = pd.to_numeric(row_df[col], errors="coerce").fillna(0).astype(int)
                            numeric_cols = row_df.select_dtypes(include=["number"]).columns.tolist()
                            if numeric_cols:
                                ensemble_results = ensemble.detect(row_df[numeric_cols])
                                if ensemble_results:
                                    er = ensemble_results[0]
                                    is_anomaly = er.is_anomaly
                                    anomaly_score = er.ensemble_score
                                    if is_anomaly:
                                        result["risk_score"] = min(100, int(result["risk_score"] + anomaly_score * 15))
                                        if result["risk_level"] == "LOW" and result["risk_score"] >= 35:
                                            result["risk_level"] = "MEDIUM"
                                        elif result["risk_level"] == "MEDIUM" and result["risk_score"] >= 70:
                                            result["risk_level"] = "HIGH"
                        except Exception:
                            pass

                    batch_result = BatchResult(
                        transaction_id=txn_id,
                        amount=float(txn_dict.get("amount", 0)),
                        merchant_category=str(txn_dict.get("merchant_category", "unknown")),
                        fraud_probability=result["fraud_probability"],
                        risk_score=result["risk_score"],
                        risk_level=result["risk_level"],
                        decision=result["decision"],
                        triggered_risk_factors=result["triggered_risk_factors"],
                        is_anomaly=is_anomaly,
                        anomaly_score=anomaly_score,
                    )
                    results.append(batch_result)

                    if result["risk_level"] == "HIGH":
                        high_count += 1
                    elif result["risk_level"] == "MEDIUM":
                        medium_count += 1
                    else:
                        low_count += 1

                    # Persist to database
                    try:
                        with get_db_session() as session:
                            txn_record = Transaction(
                                transaction_id=txn_id,
                                customer_id=str(txn_dict.get("customer_id", "")),
                                merchant_id=str(txn_dict.get("merchant_id", "")),
                                timestamp=str(txn_dict.get("timestamp", "")),
                                age=int(txn_dict.get("age", 0)),
                                gender=str(txn_dict.get("gender", "")),
                                merchant_category=str(txn_dict.get("merchant_category", "")),
                                amount=float(txn_dict.get("amount", 0)),
                                transaction_type=str(txn_dict.get("transaction_type", "")),
                                card_type=str(txn_dict.get("card_type", "")),
                                card_present=int(txn_dict.get("card_present", 0)),
                                device_type=str(txn_dict.get("device_type", "")),
                                distance_from_home=float(txn_dict.get("distance_from_home", 0)),
                                distance_from_last_transaction=float(txn_dict.get("distance_from_last_transaction", 0)),
                                high_risk_country=int(txn_dict.get("high_risk_country", 0)),
                                velocity_last_24h=int(txn_dict.get("velocity_last_24h", 0)),
                            )
                            session.add(txn_record)

                            pred_record = RiskPrediction(
                                transaction_id=txn_id,
                                fraud_probability=result["fraud_probability"],
                                risk_score=result["risk_score"],
                                risk_level=result["risk_level"],
                                prediction=result["decision"],
                                triggered_risk_factors=json.dumps(result["triggered_risk_factors"]),
                                model_version=MODEL_VERSION,
                            )
                            session.add(pred_record)

                            if result["risk_level"] == "HIGH":
                                reasons = result["triggered_risk_factors"]
                                if is_anomaly:
                                    reasons = reasons + ["Ensemble anomaly detector flagged this transaction"]
                                alert = Alert(
                                    transaction_id=txn_id,
                                    risk_score=result["risk_score"],
                                    risk_level=result["risk_level"],
                                    reason=json.dumps(reasons),
                                    status="OPEN",
                                )
                                session.add(alert)
                                alerts_created += 1
                    except Exception as exc:
                        logger.warning(f"Failed to persist {txn_id}: {exc}")

                except Exception as exc:
                    errors.append(f"Row {global_idx}: {str(exc)}")

            total_rows += len(chunk_df)
            if chunk_idx % 10 == 0:
                logger.info(f"Upload progress: {total_rows} rows processed ({high_count} high, {medium_count} medium)")

        logger.info(f"Upload complete: {total_rows} rows, {high_count} high-risk, {alerts_created} alerts")
        return BatchUploadResponse(
            filename=file.filename,
            total_rows=total_rows,
            processed_rows=len(results),
            errors=errors[:50],
            high_risk_count=high_count,
            medium_risk_count=medium_count,
            low_risk_count=low_count,
            alerts_created=alerts_created,
            results=results[-100:],
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Upload failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post(
    "/thresholds",
    summary="Reclassify all transactions with new risk thresholds",
    tags=["Upload"],
)
def update_thresholds(
    medium_threshold: float = RISK_THRESHOLD_MEDIUM,
    high_threshold: float = RISK_THRESHOLD_HIGH,
) -> Dict[str, Any]:
    """Re-score all existing transactions using updated thresholds.

    This does NOT re-run the ML model — it reclassifies based on
    existing fraud_probability values and the new thresholds.
    """
    if not (0.0 < medium_threshold < high_threshold <= 1.0):
        raise HTTPException(
            status_code=400,
            detail="Thresholds must satisfy 0 < medium < high <= 1.0",
        )

    updated = 0
    alerts_created = 0

    try:
        with get_db_session() as session:
            predictions = session.query(RiskPrediction).all()
            for pred in predictions:
                prob = pred.fraud_probability
                old_level = pred.risk_level

                # Recompute risk level
                if prob >= high_threshold:
                    new_level = "HIGH"
                    new_decision = "DECLINE"
                elif prob >= medium_threshold:
                    new_level = "MEDIUM"
                    new_decision = "REVIEW"
                else:
                    new_level = "LOW"
                    new_decision = "APPROVE"

                pred.risk_level = new_level
                pred.prediction = new_decision
                pred.risk_score = int(round(prob * 100))
                updated += 1

                # Create alert if newly HIGH
                if new_level == "HIGH" and old_level != "HIGH":
                    existing_alert = (
                        session.query(Alert)
                        .filter(Alert.transaction_id == pred.transaction_id)
                        .first()
                    )
                    if not existing_alert:
                        alert = Alert(
                            transaction_id=pred.transaction_id,
                            risk_score=pred.risk_score,
                            risk_level="HIGH",
                            reason=json.dumps(["Threshold adjustment reclassified to HIGH"]),
                            status="OPEN",
                        )
                        session.add(alert)
                        alerts_created += 1

    except Exception as exc:
        logger.error(f"Failed to update thresholds: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to update thresholds: {exc}")

    return {
        "updated": updated,
        "alerts_created": alerts_created,
        "medium_threshold": medium_threshold,
        "high_threshold": high_threshold,
    }
