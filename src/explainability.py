"""
Model explainability layer for the AI Risk Manager fraud classifier.

Generates per-prediction explanations using SHAP (TreeExplainer) for the
trained RandomForest model.  Maps one-hot encoded features back to
human-readable names and returns ranked risk factors with direction and
magnitude.

This module is strictly for **model-based explanations**.  RAG-based
policy explanations are handled separately by ``rag.rag_pipeline``.

Usage::

    from src.explainability import ModelExplainer

    explainer = ModelExplainer()
    explanation = explainer.explain(raw_transaction)
    for factor in explanation.factors:
        print(f"{factor.direction:>+)  {factor.feature} ({factor.contribution:.3f})")
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from src.config import (
    BINARY_FEATURES,
    CATEGORICAL_FEATURES,
    FEATURE_IMPORTANCES_FILE,
    MODEL_FILE,
    NUMERICAL_FEATURES,
    PREPROCESSOR_FILE,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Feature name mapping helpers
# ---------------------------------------------------------------------------

# Friendly display names for raw input features
_FEATURE_DISPLAY_NAMES: Dict[str, str] = {
    "amount": "Transaction Amount",
    "age": "Customer Age",
    "distance_from_home": "Distance from Home",
    "distance_from_last_transaction": "Distance from Last Transaction",
    "velocity_last_24h": "24h Transaction Velocity",
    "card_present": "Card Present",
    "high_risk_country": "High-Risk Country",
    "gender": "Gender",
    "merchant_category": "Merchant Category",
    "transaction_type": "Transaction Type",
    "card_type": "Card Type",
    "device_type": "Device Type",
    # Derived / engineered features
    "hour": "Transaction Hour",
    "day_of_week": "Day of Week",
    "is_weekend": "Weekend Transaction",
    "is_night": "Night Transaction",
    "is_business_hours": "Business Hours",
    "log_amount": "Log Amount",
    "is_high_amount": "High Amount Flag",
    "is_round_amount": "Round Amount Flag",
    "amount_cents": "Amount Cents",
    "amount_to_age_ratio": "Amount-to-Age Ratio",
    "is_high_velocity": "High Velocity Flag",
    "amount_velocity_ratio": "Amount-Velocity Ratio",
    "amount_x_velocity": "Amount x Velocity",
    "distance_from_last_is_missing": "Missing Last Distance",
    "distance_total": "Total Distance",
    "distance_ratio": "Distance Ratio",
    "is_far_from_home": "Far from Home Flag",
    "is_high_risk_channel": "High-Risk Channel",
    "composite_risk_flag": "Composite Risk Flag",
}


def _humanize_feature_name(raw_name: str) -> str:
    """Convert a model feature name to a human-readable label.

    Handles one-hot encoded names like ``cat__merchant_category_electronics``
    by stripping the prefix and title-casing the value.
    """
    # Strip sklearn column-transformer prefixes (e.g. "num__", "cat__", "flag__")
    name = raw_name
    for prefix in ("num__", "cat__", "flag__", "remainder__"):
        if name.startswith(prefix):
            name = name[len(prefix):]
            break

    # Check if it's a one-hot encoded categorical
    # Pattern: feature_name_value  (e.g. merchant_category_electronics)
    for cat_col in CATEGORICAL_FEATURES:
        if name.startswith(cat_col + "_"):
            value = name[len(cat_col) + 1:].replace("_", " ").title()
            display = _FEATURE_DISPLAY_NAMES.get(cat_col, cat_col.replace("_", " ").title())
            return f"{display}: {value}"

    # Direct lookup
    if name in _FEATURE_DISPLAY_NAMES:
        return _FEATURE_DISPLAY_NAMES[name]

    # Fallback: title-case the snake_case name
    return name.replace("_", " ").title()


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class FeatureFactor:
    """A single feature's contribution to the prediction.

    Attributes
    ----------
    feature:
        Human-readable feature name.
    raw_feature:
        Original model feature name (one-hot encoded).
    contribution:
        SHAP value — positive means increases fraud risk, negative means
        decreases it.  Units are in log-odds space.
    feature_value:
        The actual value of this feature for the transaction.
    direction:
        ``"increases_risk"`` or ``"decreases_risk"``.
    """

    feature: str
    raw_feature: str
    contribution: float
    feature_value: Any
    direction: str


@dataclass(frozen=True)
class ModelExplanation:
    """Complete explanation for a single transaction prediction.

    Attributes
    ----------
    transaction_id:
        Identifier of the explained transaction.
    fraud_probability:
        The model's P(fraud) for this transaction.
    risk_score:
        0–100 risk score.
    factors:
        Ranked list of contributing features (most impactful first).
    base_value:
        SHAP base value (average model output).
    model_version:
        Version string of the model being explained.
    """

    transaction_id: str
    fraud_probability: float
    risk_score: int
    factors: List[FeatureFactor]
    base_value: float
    model_version: str


# ---------------------------------------------------------------------------
# Explainer
# ---------------------------------------------------------------------------

class ModelExplainer:
    """SHAP-based per-prediction explainer for the fraud RandomForest.

    Parameters
    ----------
    model_path:
        Path to the trained ``RandomForestClassifier`` pickle.
    preprocessor_path:
        Path to the fitted ``ColumnTransformer`` pipeline.
    feature_importances_path:
        Path to the pre-extracted global feature importances JSON.
    top_k:
        Number of top factors to return in each explanation.
    """

    def __init__(
        self,
        model_path: Path | str = MODEL_FILE,
        preprocessor_path: Path | str = PREPROCESSOR_FILE,
        feature_importances_path: Path | str = FEATURE_IMPORTANCES_FILE,
        top_k: int = 10,
    ) -> None:
        from src.utils import load_artifact

        self._model_path = Path(model_path)
        self._preprocessor_path = Path(preprocessor_path)
        self._feature_importances_path = Path(feature_importances_path)
        self._top_k = top_k

        self._model = None
        self._preprocessor = None
        self._feature_names: Optional[List[str]] = None
        self._shap_explainer = None
        self._global_importances: Optional[Dict[str, float]] = None

        self._load_artifacts()

    def _load_artifacts(self) -> None:
        """Load model, preprocessor, feature names, and SHAP explainer."""
        from src.utils import load_artifact

        if not self._model_path.exists():
            raise FileNotFoundError(
                f"Model not found at {self._model_path}. "
                "Run the training pipeline first."
            )
        if not self._preprocessor_path.exists():
            raise FileNotFoundError(
                f"Preprocessor not found at {self._preprocessor_path}."
            )

        self._model = load_artifact(self._model_path)
        self._preprocessor = load_artifact(self._preprocessor_path)

        # Extract feature names from the ColumnTransformer
        try:
            self._feature_names = list(
                self._preprocessor.named_steps["col_transform"].get_feature_names_out()
            )
        except Exception:
            self._feature_names = None

        # Load global feature importances (if available)
        if self._feature_importances_path.exists():
            try:
                with open(self._feature_importances_path) as f:
                    data = json.load(f)
                # Handle both list-of-dicts and dict formats
                if isinstance(data, list):
                    self._global_importances = {
                        item["feature"]: item["importance"] for item in data
                    }
                elif isinstance(data, dict):
                    self._global_importances = data
            except Exception:
                self._global_importances = None

        # Lazy-init SHAP explainer
        try:
            import shap
            self._shap_explainer = shap.TreeExplainer(self._model)
            logger.info("SHAP TreeExplainer initialised")
        except ImportError:
            logger.warning(
                "shap not installed — falling back to feature importances. "
                "Install with: pip install shap"
            )
        except Exception as exc:
            logger.warning(f"SHAP TreeExplainer init failed: {exc}")

        logger.info("ModelExplainer initialised")

    def _preprocess(self, raw_txn: Dict[str, Any]) -> pd.DataFrame:
        """Preprocess a single raw transaction through the pipeline."""
        df = pd.DataFrame([raw_txn])
        transformed = self._preprocessor.transform(df)
        if self._feature_names and transformed.shape[1] == len(self._feature_names):
            return pd.DataFrame(transformed, columns=self._feature_names)
        return pd.DataFrame(transformed)

    def _get_shap_factors(self, X: pd.DataFrame) -> List[FeatureFactor]:
        """Compute SHAP values and return top contributing factors."""
        shap_values = self._shap_explainer.shap_values(X)

        # For binary classifiers, shap_values may be a list [class_0, class_1]
        if isinstance(shap_values, list):
            values = shap_values[1]  # fraud class (class 1)
        else:
            values = shap_values

        # values shape: (n_samples, n_features) — we have 1 sample
        row_values = values[0]
        feature_names = list(X.columns)

        # Build factor list
        factors: List[FeatureFactor] = []
        for fname, shap_val, feat_val in zip(feature_names, row_values, X.iloc[0]):
            direction = "increases_risk" if shap_val > 0 else "decreases_risk"
            factors.append(FeatureFactor(
                feature=_humanize_feature_name(fname),
                raw_feature=fname,
                contribution=round(float(shap_val), 6),
                feature_value=_safe_value(feat_val),
                direction=direction,
            ))

        # Sort by absolute contribution (most impactful first)
        factors.sort(key=lambda f: abs(f.contribution), reverse=True)
        return factors[: self._top_k]

    def _get_fallback_factors(self, X: pd.DataFrame) -> List[FeatureFactor]:
        """Use global feature importances + feature values as fallback.

        When SHAP is unavailable, this provides a best-effort explanation
        by combining the global importance ranking with the actual feature
        values for this transaction.
        """
        if self._global_importances is None:
            return []

        feature_names = list(X.columns)
        row_values = X.iloc[0]

        factors: List[FeatureFactor] = []
        for fname, feat_val in zip(feature_names, row_values):
            importance = self._global_importances.get(fname, 0.0)
            # Heuristic: positive feature value in a high-importance feature
            # suggests it contributes to fraud risk
            numeric_val = _safe_numeric(feat_val)
            direction = "increases_risk" if numeric_val > 0 else "decreases_risk"
            factors.append(FeatureFactor(
                feature=_humanize_feature_name(fname),
                raw_feature=fname,
                contribution=round(importance * numeric_val, 6),
                feature_value=_safe_value(feat_val),
                direction=direction,
            ))

        factors.sort(key=lambda f: abs(f.contribution), reverse=True)
        return factors[: self._top_k]

    def explain(
        self,
        raw_transaction: Dict[str, Any],
        transaction_id: Optional[str] = None,
        fraud_probability: Optional[float] = None,
        risk_score: Optional[int] = None,
        model_version: str = "1.0.0",
    ) -> ModelExplanation:
        """Generate a human-readable explanation for a single prediction.

        Parameters
        ----------
        raw_transaction:
            Original raw transaction dict (before preprocessing).
        transaction_id:
            Transaction identifier.  Extracted from the dict if not provided.
        fraud_probability:
            Pre-computed P(fraud).  Computed if not provided.
        risk_score:
            Pre-computed 0–100 risk score.  Computed if not provided.
        model_version:
            Version string for the model being explained.

        Returns
        -------
        ModelExplanation
            Explanation with ranked factors, contribution scores, and
            human-readable labels.
        """
        txn_id = transaction_id or raw_transaction.get("transaction_id", "UNKNOWN")
        X = self._preprocess(raw_transaction)

        # Get probability and score if not provided
        if fraud_probability is None:
            fraud_probability = float(self._model.predict_proba(X)[:, 1][0])
        if risk_score is None:
            risk_score = int(round(fraud_probability * 100))

        # Compute factors via SHAP or fallback
        if self._shap_explainer is not None:
            factors = self._get_shap_factors(X)
        else:
            factors = self._get_fallback_factors(X)

        # Base value (average model output)
        base_value = 0.0
        if self._shap_explainer is not None:
            try:
                bv = self._shap_explainer.expected_value
                if isinstance(bv, (list, np.ndarray)):
                    base_value = float(bv[1]) if len(bv) > 1 else float(bv[0])
                else:
                    base_value = float(bv)
            except Exception:
                pass

        explanation = ModelExplanation(
            transaction_id=txn_id,
            fraud_probability=round(fraud_probability, 4),
            risk_score=risk_score,
            factors=factors,
            base_value=round(base_value, 6),
            model_version=model_version,
        )

        logger.info(
            f"Explanation for {txn_id}: {len(factors)} factors, "
            f"P(fraud)={fraud_probability:.4f}"
        )
        return explanation


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_value(val: Any) -> Any:
    """Convert numpy types to JSON-safe Python types."""
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return round(float(val), 4)
    if isinstance(val, np.ndarray):
        return val.tolist()
    return val


def _safe_numeric(val: Any) -> float:
    """Convert a value to float, returning 0.0 on failure."""
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0
