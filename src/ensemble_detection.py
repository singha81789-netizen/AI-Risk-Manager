"""
Ensemble anomaly detection module combining IsolationForest, LOF, and DBSCAN.

Each model produces a binary signal (normal/anomaly) and a continuous anomaly
score. The ensemble combines these into a single unified risk signal per
transaction.
"""

from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler

from src.utils import logger


@dataclass(frozen=True)
class EnsembleResult:
    """Single-record ensemble anomaly detection result."""

    is_anomaly: bool
    ensemble_score: float  # 0.0 (safe) – 1.0 (most anomalous)
    iforest_score: float
    lof_score: float
    dbscan_score: float
    anomaly_reasons: List[str]


class EnsembleAnomalyDetector:
    """Combines IsolationForest, LOF, and DBSCAN for ensemble anomaly detection.

    Parameters
    ----------
    contamination : float
        Expected fraction of outliers (used by IsolationForest and LOF).
    lof_neighbors : int
        Number of neighbors for LocalOutlierFactor.
    dbscan_eps : float
        Epsilon parameter for DBSCAN clustering.
    dbscan_min_samples : int
        Minimum samples parameter for DBSCAN.
    random_state : int
        Seed for reproducibility.
    """

    def __init__(
        self,
        contamination: float = 0.05,
        lof_neighbors: int = 20,
        dbscan_eps: float = 1.5,
        dbscan_min_samples: int = 5,
        random_state: int = 42,
    ):
        self.contamination = contamination
        self.lof_neighbors = lof_neighbors
        self.dbscan_eps = dbscan_eps
        self.dbscan_min_samples = dbscan_min_samples
        self.random_state = random_state

        self._scaler = StandardScaler()
        self._iforest: Optional[IsolationForest] = None
        self._fitted = False

    def fit(self, X: pd.DataFrame) -> "EnsembleAnomalyDetector":
        """Fit the ensemble on feature matrix X.

        Parameters
        ----------
        X : DataFrame
            Prepared transaction features (numeric only).
        """
        X_arr = X.values if isinstance(X, pd.DataFrame) else np.asarray(X)
        X_scaled = self._scaler.fit_transform(X_arr)

        logger.info(
            f"Fitting ensemble anomaly detector on {X_scaled.shape[0]} samples, "
            f"{X_scaled.shape[1]} features"
        )

        self._iforest = IsolationForest(
            contamination=self.contamination,
            n_estimators=100,
            random_state=self.random_state,
            n_jobs=-1,
        )
        self._iforest.fit(X_scaled)
        self._fitted = True
        logger.info("Ensemble anomaly detector fitted successfully.")
        return self

    def detect(
        self, X: pd.DataFrame, thresholds: Optional[Tuple[float, float, float]] = None
    ) -> List[EnsembleResult]:
        """Run ensemble detection on X.

        Parameters
        ----------
        X : DataFrame
            Feature matrix (same shape used during fit).
        thresholds : tuple, optional
            (iforest_thresh, lof_thresh, dbscan_thresh) for score normalization.
            If None, auto-computed from the data.

        Returns
        -------
        list of EnsembleResult
        """
        self._ensure_fitted()
        X_arr = X.values if isinstance(X, pd.DataFrame) else np.asarray(X)
        X_scaled = self._scaler.transform(X_arr)

        # --- IsolationForest ---
        if_scores_raw = self._iforest.score_samples(X_scaled)
        if_preds = self._iforest.predict(X_scaled)
        # Normalize: -1 (anomaly) -> 1.0, +1 (normal) -> 0.0
        if_scores = np.clip((-if_scores_raw - 1.0) / 2.0, 0.0, 1.0)

        # --- LOF ---
        try:
            lof = LocalOutlierFactor(
                n_neighbors=min(self.lof_neighbors, max(2, len(X_scaled) - 1)),
                contamination=self.contamination,
                novelty=False,
            )
            lof_preds = lof.fit_predict(X_scaled)
            lof_scores_raw = -lof.negative_outlier_factor_
            lof_scores = np.clip(lof_scores_raw / (lof_scores_raw.max() + 1e-8), 0.0, 1.0)
        except Exception as exc:
            logger.warning(f"LOF detection failed, using zero scores: {exc}")
            lof_preds = np.ones(len(X_scaled), dtype=int)
            lof_scores = np.zeros(len(X_scaled))

        # --- DBSCAN ---
        try:
            dbscan = DBSCAN(
                eps=self.dbscan_eps,
                min_samples=self.dbscan_min_samples,
            )
            db_labels = dbscan.fit_predict(X_scaled)
            # Noise points (label == -1) are anomalies
            # Score: distance to nearest cluster center
            db_scores = np.zeros(len(X_scaled))
            unique_labels = set(db_labels)
            unique_labels.discard(-1)
            if unique_labels:
                for label in unique_labels:
                    mask = db_labels == label
                    center = X_scaled[mask].mean(axis=0)
                    dists = np.linalg.norm(X_scaled[mask] - center, axis=1)
                    db_scores[mask] = dists / (dists.max() + 1e-8)
            noise_mask = db_labels == -1
            db_scores[noise_mask] = 1.0
        except Exception as exc:
            logger.warning(f"DBSCAN detection failed, using zero scores: {exc}")
            db_scores = np.zeros(len(X_scaled))

        # --- Ensemble combination ---
        # Weighted average: IF=0.5, LOF=0.3, DBSCAN=0.2
        ensemble_scores = 0.5 * if_scores + 0.3 * lof_scores + 0.2 * db_scores

        results: List[EnsembleResult] = []
        for i in range(len(X_scaled)):
            reasons: List[str] = []
            is_anomaly = False

            if if_preds[i] == -1:
                reasons.append("IsolationForest flagged as outlier")
                is_anomaly = True
            if lof_preds[i] == -1:
                reasons.append("Local Outlier Factor flagged as density-based outlier")
                is_anomaly = True
            if db_labels[i] == -1:
                reasons.append("DBSCAN classified as noise (no cluster)")
                is_anomaly = True

            # Also flag if ensemble score is very high even if no single model flagged
            if ensemble_scores[i] > 0.8 and not is_anomaly:
                reasons.append(f"High ensemble anomaly score ({ensemble_scores[i]:.2f})")
                is_anomaly = True

            results.append(
                EnsembleResult(
                    is_anomaly=is_anomaly,
                    ensemble_score=round(float(ensemble_scores[i]), 4),
                    iforest_score=round(float(if_scores[i]), 4),
                    lof_score=round(float(lof_scores[i]), 4),
                    dbscan_score=round(float(db_scores[i]), 4),
                    anomaly_reasons=reasons,
                )
            )

        return results

    def _ensure_fitted(self) -> None:
        if not self._fitted:
            raise RuntimeError(
                "EnsembleAnomalyDetector has not been fitted. "
                "Call fit() first."
            )
