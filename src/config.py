"""
Configuration settings, column schemas, and file path definitions for the AI Risk Manager project.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Base Paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
KNOWLEDGE_BASE_DIR = DATA_DIR / "knowledge_base"
MODELS_DIR = PROJECT_ROOT / "models"

# Default File Paths
RAW_TRANSACTIONS_FILE = RAW_DATA_DIR / "fraud_transactions.csv"
TRAIN_PROCESSED_FILE = PROCESSED_DATA_DIR / "train_processed.csv"
TEST_PROCESSED_FILE = PROCESSED_DATA_DIR / "test_processed.csv"
METADATA_FILE = PROCESSED_DATA_DIR / "metadata.json"
PREPROCESSOR_FILE = MODELS_DIR / "preprocessor.joblib"
MODEL_FILE = MODELS_DIR / "risk_model.pkl"
MODEL_METRICS_FILE = MODELS_DIR / "model_metrics.json"
FEATURE_IMPORTANCES_FILE = MODELS_DIR / "feature_importances.json"

# Pipeline Parameters
RANDOM_STATE = 42
DEFAULT_TEST_SIZE = 0.2

# Baseline Model Hyperparameters
RF_N_ESTIMATORS = 150
RF_MAX_DEPTH = 14
RF_MIN_SAMPLES_SPLIT = 5
RF_MIN_SAMPLES_LEAF = 2
RF_CLASS_WEIGHT = "balanced_subsample"

# Column Schema Definitions
ID_COLUMNS = ["transaction_id", "customer_id", "merchant_id"]
DATETIME_COLUMN = "timestamp"
TARGET_COLUMN = "is_fraud"

NUMERICAL_FEATURES = [
    "amount",
    "age",
    "distance_from_home",
    "distance_from_last_transaction",
    "velocity_last_24h"
]

CATEGORICAL_FEATURES = [
    "gender",
    "merchant_category",
    "transaction_type",
    "card_type",
    "device_type"
]

BINARY_FEATURES = [
    "card_present",
    "high_risk_country"
]

ALL_RAW_COLUMNS = (
    ID_COLUMNS + 
    [DATETIME_COLUMN] + 
    ["age", "gender", "merchant_category", "amount", "transaction_type", "card_type", "card_present", "device_type", "distance_from_home", "distance_from_last_transaction", "high_risk_country", "velocity_last_24h", TARGET_COLUMN]
)

# Risk Scoring Thresholds (probability thresholds for risk level classification)
# Adjust these to tune sensitivity without touching scoring logic.
RISK_THRESHOLD_MEDIUM = 0.35   # P(fraud) >= this => MEDIUM
RISK_THRESHOLD_HIGH   = 0.70   # P(fraud) >= this => HIGH

# Anomaly Detection (IsolationForest) Defaults
ANOMALY_CONTAMINATION = 0.05   # Expected proportion of outliers in training data
ANOMALY_SCORE_MIN = -1.0       # Raw score lower bound (most anomalous)
ANOMALY_SCORE_MAX =  1.0       # Raw score upper bound (most normal)
ANOMALY_MODEL_FILE = MODELS_DIR / "anomaly_detector.joblib"

# Database Configuration (PostgreSQL via environment variables)
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "ai_risk_manager")

# Model version identifier persisted with each prediction
MODEL_VERSION = os.getenv("MODEL_VERSION", "1.0.0")
