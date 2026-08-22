"""
Unit and integration tests for fraud model training, evaluation, and production inference.
"""

from pathlib import Path
import unittest

import numpy as np
import pandas as pd

from src.config import (
    MODEL_FILE,
    MODEL_METRICS_FILE,
    PREPROCESSOR_FILE,
    RAW_TRANSACTIONS_FILE,
    TEST_PROCESSED_FILE,
    TRAIN_PROCESSED_FILE,
)
from src.data_loader import load_and_clean_data
from src.model_inference import FraudPredictor
from src.model_training import (
    evaluate_classification_performance,
    extract_feature_importances,
    load_processed_datasets,
    run_training_pipeline,
    train_fraud_model,
)


class TestFraudModelPipeline(unittest.TestCase):
    """Test suite for model training and inference."""

    @classmethod
    def setUpClass(cls):
        """Ensure model and preprocessor artifacts exist for testing."""
        cls.train_result = run_training_pipeline()

    def test_load_processed_datasets(self):
        """Test loading processed train and test sets."""
        X_train, y_train, X_test, y_test = load_processed_datasets()
        
        self.assertGreater(len(X_train), 0)
        self.assertGreater(len(X_test), 0)
        self.assertEqual(len(X_train), len(y_train))
        self.assertEqual(len(X_test), len(y_test))
        self.assertEqual(X_train.shape[1], X_test.shape[1])

    def test_train_fraud_model(self):
        """Test training baseline RandomForest model."""
        X_train, y_train, _, _ = load_processed_datasets()
        model = train_fraud_model(X_train, y_train, n_estimators=20, max_depth=6)
        
        self.assertIsNotNone(model)
        self.assertTrue(hasattr(model, "predict_proba"))
        self.assertTrue(hasattr(model, "feature_importances_"))

    def test_evaluate_classification_performance(self):
        """Test multi-metric evaluation computation."""
        X_train, y_train, X_test, y_test = load_processed_datasets()
        model = train_fraud_model(X_train, y_train, n_estimators=30, max_depth=8)
        
        metrics = evaluate_classification_performance(model, X_test, y_test, dataset_name="Test")
        
        # Verify all mandatory metrics are present
        for metric_name in ["accuracy", "precision", "recall", "f1_score", "roc_auc", "pr_auc"]:
            self.assertIn(metric_name, metrics)
            self.assertIsInstance(metrics[metric_name], float)
            self.assertGreaterEqual(metrics[metric_name], 0.0)
            self.assertLessEqual(metrics[metric_name], 1.0)
            
        # Verify confusion matrix keys
        cm = metrics["confusion_matrix"]
        for key in ["true_negatives", "false_positives", "false_negatives", "true_positives"]:
            self.assertIn(key, cm)
            self.assertGreaterEqual(cm[key], 0)

    def test_model_performance_benchmarks(self):
        """Test that the trained model meets baseline quality criteria."""
        metrics = self.train_result["metrics"]
        
        # In financial fraud detection, ROC-AUC should be high and recall should capture majority fraud
        self.assertGreater(metrics["roc_auc"], 0.85, "ROC-AUC should exceed 0.85")
        self.assertGreater(metrics["recall"], 0.60, "Recall on fraud class should exceed 60%")
        self.assertGreater(metrics["f1_score"], 0.50, "F1-Score should exceed 0.50")

    def test_model_artifact_saving_and_loading(self):
        """Test that model artifacts exist on disk and can be reloaded."""
        self.assertTrue(Path(MODEL_FILE).exists())
        self.assertTrue(Path(MODEL_METRICS_FILE).exists())
        self.assertTrue(Path(PREPROCESSOR_FILE).exists())

    def test_fraud_predictor_single_transaction(self):
        """Test real-time scoring of a single raw transaction payload."""
        predictor = FraudPredictor(model_path=MODEL_FILE, preprocessor_path=PREPROCESSOR_FILE)
        
        # High risk transaction sample
        suspicious_txn = {
            "transaction_id": "TXN_TEST_HIGH_RISK",
            "timestamp": "2026-04-10 03:30:00",
            "customer_id": "CUST_0045",
            "age": 30,
            "gender": "M",
            "merchant_id": "MERCH_0012",
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
        }
        
        result = predictor.score_transaction(suspicious_txn)
        
        self.assertEqual(result["transaction_id"], "TXN_TEST_HIGH_RISK")
        self.assertIsInstance(result["fraud_probability"], float)
        self.assertGreaterEqual(result["fraud_probability"], 0.0)
        self.assertLessEqual(result["fraud_probability"], 1.0)
        self.assertIn(result["risk_level"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertIn(result["decision"], ["APPROVE", "REVIEW", "DECLINE"])
        self.assertIsInstance(result["triggered_risk_factors"], list)
        self.assertGreater(len(result["triggered_risk_factors"]), 0)

    def test_fraud_predictor_batch_scoring(self):
        """Test batch scoring of a DataFrame."""
        predictor = FraudPredictor(model_path=MODEL_FILE, preprocessor_path=PREPROCESSOR_FILE)
        raw_df = load_and_clean_data(RAW_TRANSACTIONS_FILE).head(50)
        
        scored_df = predictor.score_batch(raw_df)
        
        for col in ["fraud_probability", "risk_score", "risk_level", "decision", "is_fraud_predicted"]:
            self.assertIn(col, scored_df.columns)
            
        self.assertEqual(len(scored_df), 50)
        self.assertTrue(scored_df["risk_score"].between(0, 1000).all())

    def test_reproducibility(self):
        """Test that fixed random seed produces identical predictions."""
        X_train, y_train, X_test, _ = load_processed_datasets()
        
        m1 = train_fraud_model(X_train, y_train, n_estimators=30, random_state=42)
        m2 = train_fraud_model(X_train, y_train, n_estimators=30, random_state=42)
        
        p1 = m1.predict_proba(X_test)
        p2 = m2.predict_proba(X_test)
        
        np.testing.assert_array_almost_equal(p1, p2, decimal=6)


if __name__ == "__main__":
    unittest.main()
