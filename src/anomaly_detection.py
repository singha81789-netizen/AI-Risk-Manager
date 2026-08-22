"""
Unsupervised anomaly detection module using IsolationForest.

This module is a **complementary risk signal** — it does NOT replace the
main supervised fraud classifier (RandomForestClassifier in
``src.model_training``). The two approaches answer different questions:

Supervised fraud classification (RandomForest)
    "Given this transaction's features AND the historical fraud labels,
    what is the probability that this transaction is fraudulent?"
    → Requires labeled training data (is_fraud column).
    → Learns the decision boundary between fraud and legitimate classes.

Unsupervised anomaly detection (IsolationForest)
    "Is this transaction unusual relative to the overall data distribution,
    regardless of whether it has been labeled as fraud?"
    → Requires NO fraud labels — fits on features only.
    → Isolates observations by randomly selecting a feature and split value.
       Anomalies are isolated in fewer splits, yielding a lower anomaly score.
    → Flags novel fraud patterns the supervised model may never have seen.

Typical usage:
    1. Train the supervised classifier for probability-based risk scoring.
    2. Fit the anomaly detector on training features (labels are ignored).
    3. At inference time, both signals feed into the risk engine — the
       supervised score captures known fraud patterns while the anomaly
       score catches out-of-distribution or emerging attack vectors.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Union

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from src.config import (
    ANOMALY_CONTAMINATION,
    ANOMALY_SCORE_MAX,
    ANOMALY_SCORE_MIN,
    MODELS_DIR,
)
from src.utils import load_artifact, logger, save_artifact


# ---------------------------------------------------------------------------
# Structured output
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class AnomalyResult:
    """Single-record anomaly detection result."""

    is_anomaly: bool
    anomaly_score: float   # 0.0 (most normal) – 1.0 (most anomalous)
    anomaly_label: str     # "NORMAL" or "ANOMALY"


def _normalize_score(raw_score: float) -> float:
    """Map an IsolationForest raw score to a 0–1 anomalousness scale.

    IsolationForest raw scores range from -1 (most anomalous) to +1
    (most normal). After normalization a score of 1.0 means the point
    is maximally anomalous relative to the observed training range.
    """
    # Clip to theoretical bounds so extrapolation is safe.
    clipped = max(ANOMALY_SCORE_MIN, min(ANOMALY_SCORE_MAX, raw_score))
    return round((ANOMALY_SCORE_MAX - clipped) / (ANOMALY_SCORE_MAX - ANOMALY_SCORE_MIN), 4)


# ---------------------------------------------------------------------------
# Detector class
# ---------------------------------------------------------------------------

class AnomalyDetector:
    """Wraps scikit-learn's ``IsolationForest`` with a clean API that
    mirrors the project's supervised inference patterns.

    Parameters
    ----------
    contamination : float
        Expected fraction of outliers in the training set.  Passed directly
        to ``IsolationForest``.  Common values: 0.01–0.10.
    random_state : int
        Seed for reproducibility.
    n_estimators : int
        Number of isolation trees.  More trees = more stable scores but
        slower training.
    model_path : str or Path, optional
        If given and the file exists, the fitted detector is loaded from
        disk instead of training a new one.
    """

    def __init__(
        self,
        contamination: float = ANOMALY_CONTAMINATION,
        random_state: int = 42,
        n_estimators: int = 100,
        model_path: Optional[Union[str, Path]] = None,
    ):
        self.contamination = contamination
        self.random_state = random_state
        self.n_estimators = n_estimators
        self._model_path = model_path
        self._model: Optional[IsolationForest] = None

        if model_path is not None:
            self._try_load(model_path)

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    def _try_load(self, path: Union[str, Path]) -> None:
        p = Path(path)
        if p.exists():
            logger.info(f"Loading anomaly detector from {p.resolve()}")
            self._model = load_artifact(p)
        else:
            logger.warning(f"No anomaly detector found at {p.resolve()}; call fit() first.")

    def save(self, path: Union[str, Path] = MODELS_DIR / "anomaly_detector.joblib") -> Path:
        """Serialize the fitted model to disk."""
        if self._model is None:
            raise RuntimeError("No fitted model to save. Call fit() first.")
        return save_artifact(self._model, path)

    # ------------------------------------------------------------------
    # Core API
    # ------------------------------------------------------------------

    def fit(self, X: Union[pd.DataFrame, np.ndarray]) -> "AnomalyDetector":
        """Fit the IsolationForest on feature matrix *X*.

        Parameters
        ----------
        X : DataFrame or ndarray
            Prepared transaction features.  **Do NOT include the target
            column** — this is an unsupervised method.

        Returns
        -------
        self
        """
        X_arr = self._to_array(X)
        logger.info(
            f"Fitting IsolationForest on {X_arr.shape[0]} samples, "
            f"{X_arr.shape[1]} features, contamination={self.contamination}"
        )
        self._model = IsolationForest(
            contamination=self.contamination,
            n_estimators=self.n_estimators,
            random_state=self.random_state,
            n_jobs=-1,
        )
        self._model.fit(X_arr)
        logger.info("Anomaly detector fitted successfully.")
        return self

    def predict(self, X: Union[pd.DataFrame, np.ndarray]) -> np.ndarray:
        """Return raw IsolationForest predictions: +1 (normal) or -1 (anomaly).

        The model must be fitted first.
        """
        self._ensure_fitted()
        return self._model.predict(self._to_array(X))

    def score_samples(self, X: Union[pd.DataFrame, np.ndarray]) -> np.ndarray:
        """Return the raw anomaly score for each sample.

        Lower (more negative) scores indicate more anomalous observations.
        """
        self._ensure_fitted()
        return self._model.score_samples(self._to_array(X))

    def detect(self, X: Union[pd.DataFrame, np.ndarray]) -> List[AnomalyResult]:
        """Detect anomalies in *X* and return structured results.

        Parameters
        ----------
        X : DataFrame or ndarray
            Feature matrix (same shape used during ``fit``).

        Returns
        -------
        list of AnomalyResult
            One result per input row.
        """
        self._ensure_fitted()
        X_arr = self._to_array(X)
        raw_scores = self._model.score_samples(X_arr)
        predictions = self._model.predict(X_arr)

        results: List[AnomalyResult] = []
        for pred, raw in zip(predictions, raw_scores):
            norm = _normalize_score(float(raw))
            is_anomaly = pred == -1
            results.append(AnomalyResult(
                is_anomaly=is_anomaly,
                anomaly_score=norm,
                anomaly_label="ANOMALY" if is_anomaly else "NORMAL",
            ))
        return results

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_fitted(self) -> None:
        if self._model is None:
            raise RuntimeError(
                "AnomalyDetector has not been fitted. "
                "Call fit() or load a saved model first."
            )

    @staticmethod
    def _to_array(X: Union[pd.DataFrame, np.ndarray]) -> np.ndarray:
        if isinstance(X, pd.DataFrame):
            return X.values
        arr = np.asarray(X)
        if arr.ndim == 1:
            arr = arr.reshape(1, -1)
        return arr
