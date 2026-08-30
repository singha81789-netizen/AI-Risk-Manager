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

# ---------------------------------------------------------------------------
# Model Monitoring Configuration
# ---------------------------------------------------------------------------

# Reference data for baseline comparison
REFERENCE_DATA_FILE = TEST_PROCESSED_FILE  # held-out test set as reference
REFERENCE_METRICS_FILE = MODEL_METRICS_FILE
REFERENCE_FEATURE_IMPORTANCES_FILE = FEATURE_IMPORTANCES_FILE
MONITORING_REPORT_DIR = PROJECT_ROOT / "reports" / "monitoring"

# Minimum number of production predictions required before monitoring runs.
# Prevents drift analysis on statistically insignificant samples.
MONITORING_MIN_SAMPLES = 50

# Performance drift thresholds — alert when metric degrades beyond these.
MONITOR_PRECISION_THRESHOLD = 0.05   # absolute drop from reference
MONITOR_RECALL_THRESHOLD = 0.05
MONITOR_F1_THRESHOLD = 0.05
MONITOR_FPR_THRESHOLD = 0.03         # absolute increase from reference

# Prediction distribution drift thresholds
MONITOR_PROBABILITY_DRIFT_THRESHOLD = 0.10   # PSI threshold for prediction distribution
MONITOR_RISK_LEVEL_DRIFT_THRESHOLD = 0.05    # absolute shift in HIGH-risk proportion

# Feature distribution drift thresholds (Population Stability Index)
MONITOR_FEATURE_PSI_WARN = 0.10     # PSI > this => WARNING
MONITOR_FEATURE_PSI_ALERT = 0.20    # PSI > this => ALERT (retrain recommended)

# KS test p-value below which a feature distribution is considered shifted
MONITOR_KS_SIGNIFICANCE = 0.05

# Monitoring window — how far back to look in production data (in hours)
MONITORING_WINDOW_HOURS = int(os.getenv("MONITORING_WINDOW_HOURS", "168"))  # 7 days

# ---------------------------------------------------------------------------
# Model Retraining Configuration
# ---------------------------------------------------------------------------

# Minimum confirmed analyst labels required before retraining can proceed.
# Ensures statistical significance of the new training signal.
RETRAINING_MIN_LABELED_SAMPLES = int(os.getenv("RETRAINING_MIN_LABELED_SAMPLES", "50"))

# Minimum fraud cases required in the labeled dataset.
RETRAINING_MIN_FRAUD_SAMPLES = int(os.getenv("RETRAINING_MIN_FRAUD_SAMPLES", "10"))

# Maximum fraction of original training data that confirmed labels can
# represent.  Prevents overwriting the original distribution with a
# small, potentially biased set of analyst-confirmed cases.
RETRAINING_MAX_LABEL_FRACTION = float(os.getenv("RETRAINING_MAX_LABEL_FRACTION", "0.5"))

# Minimum improvement in F1-score required to promote a candidate model.
# Set to 0.0 to allow any non-degrading model.
RETRAINING_F1_IMPROVEMENT_THRESHOLD = float(
    os.getenv("RETRAINING_F1_IMPROVEMENT_THRESHOLD", "0.0")
)

# Directories for versioned model storage
RETRAINING_VERSIONS_DIR = MODELS_DIR / "versions"
RETRAINING_REPORTS_DIR = PROJECT_ROOT / "reports" / "retraining"

# Database Configuration (PostgreSQL via environment variables)
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "ai_risk_manager")

# Model version identifier persisted with each prediction
MODEL_VERSION = os.getenv("MODEL_VERSION", "1.0.0")

# ---------------------------------------------------------------------------
# Knowledge Base Configuration
# ---------------------------------------------------------------------------

# Minimum number of documents required in the knowledge base at startup.
# Set to 0 to disable the check (useful for development).
KB_MIN_DOCUMENTS = int(os.getenv("KB_MIN_DOCUMENTS", "1"))

# Supported file extensions for knowledge base documents.
KB_SUPPORTED_EXTENSIONS = {".md", ".txt", ".csv"}

# RAG chunking defaults (overridden at chunk time via ChunkConfig).
KB_CHUNK_MAX_CHARS = int(os.getenv("KB_CHUNK_MAX_CHARS", "1000"))
KB_CHUNK_OVERLAP_CHARS = int(os.getenv("KB_CHUNK_OVERLAP_CHARS", "200"))

# ---------------------------------------------------------------------------
# Embedding Pipeline Configuration
# ---------------------------------------------------------------------------

# Embedding provider: "sentence-transformers" (local) or "openai" (API).
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "sentence-transformers")

# Model name — default depends on provider.
# sentence-transformers: "all-MiniLM-L6-v2" (384-dim, 22 M params)
# openai: "text-embedding-3-small" (1536-dim)
EMBEDDING_MODEL_NAME = os.getenv(
    "EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2"
)

# Batch size for embedding inference.
EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "32"))

# Torch device for local embeddings ("cpu", "cuda", "mps").
EMBEDDING_DEVICE = os.getenv("EMBEDDING_DEVICE", "cpu")

# ---------------------------------------------------------------------------
# Vector Store (ChromaDB) Configuration
# ---------------------------------------------------------------------------

# ChromaDB collection name for knowledge-base chunks.
VECTOR_STORE_COLLECTION = os.getenv(
    "VECTOR_STORE_COLLECTION", "knowledge_base"
)

# On-disk persistence directory for ChromaDB.
VECTOR_STORE_PERSIST_DIR = os.getenv(
    "VECTOR_STORE_PERSIST_DIR", "data/chroma_db"
)

# Distance metric: "cosine", "l2", or "ip" (inner product).
VECTOR_STORE_DISTANCE = os.getenv("VECTOR_STORE_DISTANCE", "cosine")

# ---------------------------------------------------------------------------
# RAG Question-Answering Pipeline Configuration
# ---------------------------------------------------------------------------

# LLM provider for answer generation: "openai" or "null" (offline fallback).
RAG_LLM_PROVIDER = os.getenv("RAG_LLM_PROVIDER", "null")

# LLM model identifier (provider-dependent).
# OpenAI examples: "gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"
RAG_LLM_MODEL = os.getenv("RAG_LLM_MODEL", "gpt-4o-mini")

# Sampling temperature for the LLM (lower = more deterministic).
RAG_LLM_TEMPERATURE = float(os.getenv("RAG_LLM_TEMPERATURE", "0.1"))

# Maximum tokens in the generated answer.
RAG_LLM_MAX_TOKENS = int(os.getenv("RAG_LLM_MAX_TOKENS", "512"))

# Number of context chunks to retrieve for each question.
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "5"))

# Minimum similarity score (0–1) for a chunk to be included as context.
RAG_MIN_RELEVANCE = float(os.getenv("RAG_MIN_RELEVANCE", "0.25"))

# ---------------------------------------------------------------------------
# Authentication Configuration
# ---------------------------------------------------------------------------

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "riskguard-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
