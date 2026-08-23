"""
Standalone training script for the IsolationForest anomaly detector.

This script trains an unsupervised anomaly detector on preprocessed
transaction features and saves the fitted model to disk.  It can be
run independently of the supervised fraud classifier training.

Usage::

    python scripts/train_anomaly_detector.py

The trained model is saved to ``models/anomaly_detector.joblib`` and
will be automatically loaded by the FastAPI ``/predict`` endpoint.
"""

import sys
from pathlib import Path

# Ensure project root is on the path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import ANOMALY_MODEL_FILE, MODELS_DIR
from src.feature_engineering import run_preprocessing_pipeline
from src.model_training import load_processed_datasets, train_anomaly_detector
from src.utils import ensure_directory, logger


def main() -> None:
    logger.info("=== Anomaly Detector Training ===")

    # Load preprocessed features (runs preprocessing if needed)
    X_train, _y_train, X_test, _y_test = load_processed_datasets()

    # Train the anomaly detector (labels are ignored — unsupervised)
    detector = train_anomaly_detector(
        X_train,
        contamination=0.05,
        n_estimators=100,
        random_state=42,
    )

    # Save the fitted model
    ensure_directory(MODELS_DIR)
    detector.save(ANOMALY_MODEL_FILE)
    logger.info(f"Anomaly detector saved to {ANOMALY_MODEL_FILE.resolve()}")

    # Quick sanity check on test data
    results = detector.detect(X_test[:20])
    n_anomalies = sum(1 for r in results if r.is_anomaly)
    logger.info(
        f"Sanity check: {n_anomalies}/{len(results)} test samples flagged as anomalies"
    )

    logger.info("=== Anomaly Detector Training Complete ===")


if __name__ == "__main__":
    main()
