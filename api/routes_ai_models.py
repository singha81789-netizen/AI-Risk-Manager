"""
AI Models management endpoints for the AI Risk Manager API.
"""

from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel


router = APIRouter(prefix="/ai-models", tags=["AI Models"])


# ---------------------------------------------------------------------------
# In-memory model store (seeded with defaults)
# ---------------------------------------------------------------------------

_MODELS = [
    {"id": "if", "name": "Isolation Forest", "description": "Detects anomalies by isolating unusual patterns.", "accuracy": 95.6, "status": "active", "type": "primary", "last_updated": "2h ago"},
    {"id": "lof", "name": "Local Outlier Factor", "description": "Finds local outliers based on density deviation.", "accuracy": 92.1, "status": "active", "type": "standard", "last_updated": "1d ago"},
    {"id": "dbscan", "name": "DBSCAN", "description": "Cluster-based detection for noise and outliers.", "accuracy": 89.3, "status": "active", "type": "standard", "last_updated": "3d ago"},
    {"id": "rf", "name": "Random Forest Classifier", "description": "Supervised model for risk classification.", "accuracy": 94.8, "status": "active", "type": "secondary", "last_updated": "5h ago"},
    {"id": "nn", "name": "Neural Network Model", "description": "Deep learning model for complex patterns.", "accuracy": 89.2, "status": "training", "type": "standard", "last_updated": "Just now"},
]

_THRESHOLDS = {"overall_risk_sensitivity": 35, "high_risk_threshold": 70}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ThresholdUpdate(BaseModel):
    overall_risk_sensitivity: int
    high_risk_threshold: int


class ModelToggle(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
def list_models() -> List[dict]:
    """Return all registered AI models."""
    return _MODELS


@router.get("/performance")
def model_performance() -> List[dict]:
    """Return model accuracy over the last few days."""
    return [
        {"date": "24 May", "isolationForest": 95.2, "lof": 91.8, "dbscan": 89.0, "randomForest": 94.5},
        {"date": "25 May", "isolationForest": 95.4, "lof": 91.5, "dbscan": 88.8, "randomForest": 94.6},
        {"date": "26 May", "isolationForest": 95.1, "lof": 92.0, "dbscan": 89.2, "randomForest": 94.7},
        {"date": "27 May", "isolationForest": 95.3, "lof": 91.9, "dbscan": 89.1, "randomForest": 94.5},
        {"date": "28 May", "isolationForest": 95.5, "lof": 92.1, "dbscan": 89.3, "randomForest": 94.8},
        {"date": "29 May", "isolationForest": 95.6, "lof": 92.1, "dbscan": 89.3, "randomForest": 94.8},
    ]


@router.get("/thresholds")
def get_thresholds() -> dict:
    """Return current risk thresholds."""
    return _THRESHOLDS


@router.post("/thresholds")
def update_thresholds(body: ThresholdUpdate) -> dict:
    """Update risk thresholds."""
    _THRESHOLDS["overall_risk_sensitivity"] = body.overall_risk_sensitivity
    _THRESHOLDS["high_risk_threshold"] = body.high_risk_threshold
    return {"message": "Thresholds updated successfully"}


@router.post("/{model_id}/toggle")
def toggle_model(model_id: str, body: ModelToggle) -> dict:
    """Toggle a model's active/inactive status."""
    for m in _MODELS:
        if m["id"] == model_id:
            m["status"] = body.status
            return {"message": f"Model {model_id} set to {body.status}"}
    return {"message": "Model not found"}
