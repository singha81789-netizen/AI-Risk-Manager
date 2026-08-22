"""
Decoupled real-time model inference engine for AI Risk Manager.
Provides fraud probability scoring, risk tier assignment, and automated decision rules.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import numpy as np
import pandas as pd

from src.config import MODEL_FILE, PREPROCESSOR_FILE, RISK_THRESHOLD_HIGH, RISK_THRESHOLD_MEDIUM
from src.risk_scoring import compute_risk_score
from src.utils import load_artifact, logger


class FraudPredictor:
    """
    Production inference engine for real-time and batch fraud prediction.
    Decoupled from model training logic.
    """

    def __init__(
        self,
        model_path: Union[str, Path] = MODEL_FILE,
        preprocessor_path: Union[str, Path] = PREPROCESSOR_FILE,
    ):
        self.model_path = Path(model_path)
        self.preprocessor_path = Path(preprocessor_path)
        self._model = None
        self._preprocessor = None
        self._load_artifacts()

    def _load_artifacts(self) -> None:
        """Loads serialized model and preprocessing pipeline."""
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Trained model not found at {self.model_path.resolve()}. "
                f"Please run the training pipeline first (src.model_training.run_training_pipeline)."
            )
        if not self.preprocessor_path.exists():
            raise FileNotFoundError(
                f"Preprocessor pipeline not found at {self.preprocessor_path.resolve()}."
            )
            
        logger.info(f"Loading inference model from {self.model_path.resolve()}...")
        self._model = load_artifact(self.model_path)
        self._preprocessor = load_artifact(self.preprocessor_path)
        
        # Store feature names for clean DataFrame handoff to model
        try:
            self._feature_names = list(self._preprocessor.named_steps["col_transform"].get_feature_names_out())
        except Exception:
            self._feature_names = None
            
        logger.info("FraudPredictor initialized successfully.")

    def _preprocess_input(self, data: Union[Dict[str, Any], pd.DataFrame]) -> pd.DataFrame:
        """Converts raw input dictionary or DataFrame into transformed feature DataFrame."""
        if isinstance(data, dict):
            df = pd.DataFrame([data])
        elif isinstance(data, pd.DataFrame):
            df = data.copy()
        else:
            raise TypeError(f"Expected dict or DataFrame, received {type(data)}")
            
        transformed = self._preprocessor.transform(df)
        if self._feature_names is not None and transformed.shape[1] == len(self._feature_names):
            return pd.DataFrame(transformed, columns=self._feature_names)
        return pd.DataFrame(transformed)

    def predict_proba(self, data: Union[Dict[str, Any], pd.DataFrame]) -> Union[float, np.ndarray]:
        """
        Calculates the probability of fraud P(is_fraud = 1).
        
        Args:
            data: Raw transaction dict or DataFrame.
            
        Returns:
            float for single transaction, or np.ndarray of probabilities for batch.
        """
        X_proc = self._preprocess_input(data)
        probabilities = self._model.predict_proba(X_proc)[:, 1]
        
        if isinstance(data, dict) or (isinstance(data, pd.DataFrame) and len(data) == 1):
            return float(probabilities[0])
        return probabilities

    def predict(
        self, data: Union[Dict[str, Any], pd.DataFrame], threshold: float = 0.5
    ) -> Union[int, np.ndarray]:
        """
        Predicts binary fraud classification (0 = Legitimate, 1 = Fraud) based on decision threshold.
        """
        probas = self.predict_proba(data)
        if isinstance(probas, (float, np.floating)):
            return int(probas >= threshold)
        return (probas >= threshold).astype(int)

    def score_transaction(
        self,
        raw_transaction: Dict[str, Any],
        review_threshold: float = RISK_THRESHOLD_MEDIUM,
        decline_threshold: float = RISK_THRESHOLD_HIGH,
    ) -> Dict[str, Any]:
        """
        Evaluates a single raw transaction and generates a comprehensive risk assessment.
        
        Args:
            raw_transaction: Key-value dictionary of transaction attributes.
            review_threshold: Lower probability bound for manual review tier.
            decline_threshold: Upper probability bound for automatic decline tier.
            
        Returns:
            Dict: Comprehensive risk assessment payload.
        """
        prob = self.predict_proba(raw_transaction)
        risk = compute_risk_score(
            prob,
            medium_threshold=review_threshold,
            high_threshold=decline_threshold,
        )

        # Determine automated action decision
        if prob >= decline_threshold:
            decision = "DECLINE"
        elif prob >= review_threshold:
            decision = "REVIEW"
        else:
            decision = "APPROVE"
            
        # Identify prominent rule and behavior triggers
        triggered_rules = self._identify_triggered_rules(raw_transaction, prob)
        
        txn_id = raw_transaction.get("transaction_id", "UNKNOWN_TXN")
        return {
            "transaction_id": txn_id,
            "fraud_probability": risk.probability,
            "risk_score": risk.risk_score,
            "risk_level": risk.risk_level,
            "decision": decision,
            "is_fraud_predicted": bool(prob >= 0.5),
            "triggered_risk_factors": triggered_rules,
        }

    def score_batch(
        self,
        df: pd.DataFrame,
        review_threshold: float = RISK_THRESHOLD_MEDIUM,
        decline_threshold: float = RISK_THRESHOLD_HIGH,
    ) -> pd.DataFrame:
        """
        Scores a batch of transactions in a DataFrame, returning enriched risk metrics.
        """
        probas = self.predict_proba(df)
        df_out = df.copy()
        df_out["fraud_probability"] = np.round(probas, 4)
        df_out["risk_score"] = np.round(probas * 100).astype(int)
        
        # Vectorized decisions
        conditions = [
            probas >= decline_threshold,
            (probas >= review_threshold) & (probas < decline_threshold),
            probas < review_threshold,
        ]
        decisions = ["DECLINE", "REVIEW", "APPROVE"]
        risk_levels = [
            "HIGH",
            "MEDIUM",
            "LOW",
        ]
        
        df_out["decision"] = np.select(conditions, decisions, default="REVIEW")
        df_out["risk_level"] = np.select(conditions, risk_levels, default="MEDIUM")
        df_out["is_fraud_predicted"] = (probas >= 0.5).astype(int)
        return df_out

    def _identify_triggered_rules(self, txn: Dict[str, Any], prob: float) -> List[str]:
        """Identifies contextual transaction triggers for explainability."""
        triggers = []
        
        amt = float(txn.get("amount", 0.0))
        if amt >= 350.0:
            triggers.append(f"High transaction amount (${amt:,.2f})")
            
        velocity = int(txn.get("velocity_last_24h", 0))
        if velocity >= 4:
            triggers.append(f"High 24-hour transaction frequency ({velocity} transactions)")
            
        dist_home = float(txn.get("distance_from_home", 0.0))
        if dist_home >= 50.0:
            triggers.append(f"Significant distance from home address ({dist_home:.1f} km)")
            
        if int(txn.get("high_risk_country", 0)) == 1:
            triggers.append("Transaction originated in high-risk foreign jurisdiction")
            
        if int(txn.get("card_present", 1)) == 0:
            triggers.append("Card Not Present (CNP) transaction channel")
            
        mcat = str(txn.get("merchant_category", "")).lower()
        if mcat in ["electronics", "travel", "online_retail"]:
            triggers.append(f"High-risk merchant category: {mcat}")
            
        # Parse timestamp if available
        ts_val = txn.get("timestamp")
        if ts_val:
            try:
                dt = pd.to_datetime(ts_val)
                if 1 <= dt.hour <= 5:
                    triggers.append(f"Off-peak night transaction window ({dt.hour:02d}:00)")
            except Exception:
                pass
                
        return triggers
