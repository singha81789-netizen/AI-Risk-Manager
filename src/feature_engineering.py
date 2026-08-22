"""
Feature engineering and transformation pipeline for AI Risk Manager.
Creates domain-specific, time-based, monetary, frequency, and unusual risk indicators.
Ensures reproducible, leak-free preprocessing across training and real-time API inference.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, RobustScaler

from src.config import (
    BINARY_FEATURES,
    CATEGORICAL_FEATURES,
    DATETIME_COLUMN,
    DEFAULT_TEST_SIZE,
    ID_COLUMNS,
    METADATA_FILE,
    MODELS_DIR,
    NUMERICAL_FEATURES,
    PREPROCESSOR_FILE,
    PROCESSED_DATA_DIR,
    RANDOM_STATE,
    RAW_TRANSACTIONS_FILE,
    TARGET_COLUMN,
    TEST_PROCESSED_FILE,
    TRAIN_PROCESSED_FILE,
)
from src.data_loader import load_and_clean_data, split_features_and_target
from src.utils import ensure_directory, load_artifact, logger, save_artifact, save_json


class TemporalFeatureExtractor(BaseEstimator, TransformerMixin):
    """
    Extracts time-based, cyclical, and off-peak risk features from the transaction timestamp.
    """

    def __init__(self, datetime_col: str = DATETIME_COLUMN):
        self.datetime_col = datetime_col

    def fit(self, X: pd.DataFrame, y=None):
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        X_out = X.copy()
        if self.datetime_col in X_out.columns:
            ts = pd.to_datetime(X_out[self.datetime_col], errors="coerce")
            
            # Basic temporal extraction
            hours = ts.dt.hour.fillna(12).astype(int)
            days = ts.dt.dayofweek.fillna(0).astype(int)
            
            X_out["hour"] = hours
            X_out["day_of_week"] = days
            X_out["is_weekend"] = days.isin([5, 6]).astype(int)
            
            # Off-peak night risk window (01:00 AM to 05:00 AM)
            X_out["is_night"] = ((hours >= 1) & (hours <= 5)).astype(int)
            
            # Standard business hours (09:00 AM to 05:00 PM)
            X_out["is_business_hours"] = ((hours >= 9) & (hours <= 17)).astype(int)
            
            # Cyclical trigonometric encodings of hour and day of week
            X_out["sin_hour"] = np.sin(2.0 * np.pi * hours / 24.0)
            X_out["cos_hour"] = np.cos(2.0 * np.pi * hours / 24.0)
            X_out["sin_day_of_week"] = np.sin(2.0 * np.pi * days / 7.0)
            X_out["cos_day_of_week"] = np.cos(2.0 * np.pi * days / 7.0)
            
            # Drop raw datetime column
            X_out = X_out.drop(columns=[self.datetime_col])
        else:
            # Fill default values if timestamp is absent in payload
            for col in ["hour", "day_of_week", "is_weekend", "is_night", "is_business_hours", 
                        "sin_hour", "cos_hour", "sin_day_of_week", "cos_day_of_week"]:
                if col not in X_out.columns:
                    X_out[col] = 0
                    
        return X_out


class DomainFeatureExtractor(BaseEstimator, TransformerMixin):
    """
    Stateful custom transformer for domain-specific financial risk and interaction features.
    Learns statistical quantile thresholds strictly from training data during `fit()` and 
    applies them consistently during `transform()` to avoid hardcoding or data leakage.
    """

    def __init__(
        self,
        amount_high_quantile: float = 0.95,
        distance_home_quantile: float = 0.90,
        velocity_high_threshold: int = 4
    ):
        self.amount_high_quantile = amount_high_quantile
        self.distance_home_quantile = distance_home_quantile
        self.velocity_high_threshold = velocity_high_threshold
        
        # Learned state parameters (persisted with transformer)
        self.amount_threshold_: Optional[float] = None
        self.distance_home_threshold_: Optional[float] = None

    def fit(self, X: pd.DataFrame, y=None):
        X_df = X.copy()
        
        # Learn high-amount anomaly threshold (e.g., 95th percentile)
        if "amount" in X_df.columns:
            self.amount_threshold_ = float(X_df["amount"].quantile(self.amount_high_quantile))
        else:
            self.amount_threshold_ = 500.0
            
        # Learn high-distance anomaly threshold (e.g., 90th percentile)
        if "distance_from_home" in X_df.columns:
            self.distance_home_threshold_ = float(X_df["distance_from_home"].quantile(self.distance_home_quantile))
        else:
            self.distance_home_threshold_ = 50.0
            
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        X_out = X.copy()
        
        amt_thresh = self.amount_threshold_ if self.amount_threshold_ is not None else 500.0
        dist_thresh = self.distance_home_threshold_ if self.distance_home_threshold_ is not None else 50.0
        
        # -------------------------------------------------------------
        # 1. Transaction Amount Features
        # -------------------------------------------------------------
        if "amount" in X_out.columns:
            amt = pd.to_numeric(X_out["amount"], errors="coerce").fillna(0.0)
            X_out["log_amount"] = np.log1p(np.maximum(0.0, amt))
            X_out["is_high_amount"] = (amt >= amt_thresh).astype(int)
            # Round number indicator (frequent in cash-out / round wire fraud)
            X_out["is_round_amount"] = ((amt > 0) & (amt % 10.0 == 0)).astype(int)
            # Decimal cents fraction
            X_out["amount_cents"] = amt - np.floor(amt)
        else:
            X_out["log_amount"] = 0.0
            X_out["is_high_amount"] = 0
            X_out["is_round_amount"] = 0
            X_out["amount_cents"] = 0.0

        # Amount to Age Ratio
        if "amount" in X_out.columns and "age" in X_out.columns:
            age = pd.to_numeric(X_out["age"], errors="coerce").fillna(35.0)
            X_out["amount_to_age_ratio"] = X_out["log_amount"] / (age + 1.0)
        else:
            X_out["amount_to_age_ratio"] = 0.0

        # -------------------------------------------------------------
        # 2. Transaction Frequency & Velocity Features
        # -------------------------------------------------------------
        if "velocity_last_24h" in X_out.columns:
            velocity = pd.to_numeric(X_out["velocity_last_24h"], errors="coerce").fillna(1.0)
            X_out["is_high_velocity"] = (velocity >= self.velocity_high_threshold).astype(int)
            X_out["amount_velocity_ratio"] = X_out["log_amount"] / (velocity + 1.0)
            X_out["amount_x_velocity"] = X_out["log_amount"] * velocity
        else:
            X_out["is_high_velocity"] = 0
            X_out["amount_velocity_ratio"] = 0.0
            X_out["amount_x_velocity"] = 0.0

        # -------------------------------------------------------------
        # 3. Spatial & Unusual Transaction Indicators
        # -------------------------------------------------------------
        dist_home = pd.to_numeric(X_out.get("distance_from_home", 0.0), errors="coerce").fillna(0.0)
        dist_last = pd.to_numeric(X_out.get("distance_from_last_transaction", np.nan), errors="coerce")
        
        # Missing indicator for previous transaction distance
        X_out["distance_from_last_is_missing"] = dist_last.isnull().astype(int)
        dist_last_imputed = dist_last.fillna(0.0)
        
        X_out["distance_total"] = dist_home + dist_last_imputed
        X_out["distance_ratio"] = (dist_home + 1.0) / (dist_last_imputed + 1.0)
        X_out["is_far_from_home"] = (dist_home >= dist_thresh).astype(int)

        # High-risk channel flag (Card-not-present + Online/Wire Transfer)
        card_present = pd.to_numeric(X_out.get("card_present", 1), errors="coerce").fillna(1).astype(int)
        tx_type = X_out.get("transaction_type", "").astype(str)
        is_wire_or_online = tx_type.isin(["Wire_Transfer", "Online", "P2P"]).astype(int)
        X_out["is_high_risk_channel"] = ((card_present == 0) & (is_wire_or_online == 1)).astype(int)

        # Composite multi-factor risk flag (Card Not Present & Nighttime & High Risk Country)
        is_night = X_out.get("is_night", 0)
        high_risk_country = pd.to_numeric(X_out.get("high_risk_country", 0), errors="coerce").fillna(0).astype(int)
        X_out["composite_risk_flag"] = ((card_present == 0) & (is_night == 1) & (high_risk_country == 1)).astype(int)

        # Drop raw identifier columns to prevent identifier memorization
        for id_col in ID_COLUMNS:
            if id_col in X_out.columns:
                X_out = X_out.drop(columns=[id_col])

        return X_out


def build_preprocessor() -> Pipeline:
    """
    Builds the full Scikit-Learn feature engineering and transformation pipeline.
    
    Returns:
        Pipeline: Preprocessing pipeline with temporal, domain, scaling, and encoding stages.
    """
    # Continuous numerical features to be median-imputed and scaled via RobustScaler
    continuous_num_cols = [
        "log_amount",
        "age",
        "distance_from_home",
        "distance_from_last_transaction",
        "velocity_last_24h",
        "distance_total",
        "distance_ratio",
        "amount_velocity_ratio",
        "amount_x_velocity",
        "amount_to_age_ratio",
        "amount_cents",
    ]
    
    # Binary and cyclical risk indicators (passed through with zero/mode imputation)
    flag_cols = [
        "card_present",
        "high_risk_country",
        "is_weekend",
        "is_night",
        "is_business_hours",
        "is_high_amount",
        "is_round_amount",
        "is_high_velocity",
        "is_far_from_home",
        "is_high_risk_channel",
        "composite_risk_flag",
        "distance_from_last_is_missing",
        "sin_hour",
        "cos_hour",
        "sin_day_of_week",
        "cos_day_of_week",
    ]
    
    # Categorical features for one-hot encoding
    cat_cols = CATEGORICAL_FEATURES

    # Continuous transformer: Median Impute -> RobustScaler
    num_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", RobustScaler())
    ])

    # Flag/Binary transformer: Most frequent fill -> Passthrough
    flag_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent"))
    ])

    # Categorical transformer: Missing category fill -> OneHotEncoder
    cat_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="constant", fill_value="missing")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
    ])

    # ColumnTransformer combining all sub-transformers
    col_transformer = ColumnTransformer(
        transformers=[
            ("num", num_transformer, continuous_num_cols),
            ("flag", flag_transformer, flag_cols),
            ("cat", cat_transformer, cat_cols),
        ],
        remainder="drop"
    )

    # Master pipeline
    full_pipeline = Pipeline(steps=[
        ("temporal", TemporalFeatureExtractor()),
        ("domain", DomainFeatureExtractor()),
        ("col_transform", col_transformer)
    ])

    return full_pipeline


def get_feature_names_from_preprocessor(fitted_pipeline: Pipeline, sample_df: pd.DataFrame) -> List[str]:
    """
    Retrieves output feature names from the fitted preprocessor pipeline.
    """
    try:
        col_trans = fitted_pipeline.named_steps["col_transform"]
        return list(col_trans.get_feature_names_out())
    except Exception as e:
        logger.warning(f"Could not retrieve feature names via get_feature_names_out: {e}")
        transformed = fitted_pipeline.transform(sample_df.head(2))
        return [f"feature_{i}" for i in range(transformed.shape[1])]


def transform_single_transaction(
    transaction_dict: Dict[str, Any],
    preprocessor: Optional[Pipeline] = None,
    preprocessor_path: Union[str, Path] = PREPROCESSOR_FILE,
) -> np.ndarray:
    """
    Preprocesses a single transaction dictionary into a model-ready feature vector.
    Designed for zero-leakage, real-time FastAPI inference.
    
    Args:
        transaction_dict: Key-value mapping of raw transaction attributes.
        preprocessor: Optional pre-loaded fitted Pipeline.
        preprocessor_path: Path to serialized preprocessor if not passed directly.
        
    Returns:
        np.ndarray: 2D array of shape (1, num_features).
    """
    transformer = preprocessor or load_artifact(preprocessor_path)
    df_single = pd.DataFrame([transaction_dict])
    return transformer.transform(df_single)


def run_preprocessing_pipeline(
    raw_filepath: Optional[Union[str, Path]] = None,
    test_size: float = DEFAULT_TEST_SIZE,
    random_state: int = RANDOM_STATE,
) -> Dict[str, Union[pd.DataFrame, str, int]]:
    """
    Executes the end-to-end data ingestion, train-test splitting, and feature preprocessing pipeline.
    Fits the transformer strictly on the training set to prevent data leakage.
    
    Args:
        raw_filepath: Optional path to raw dataset.
        test_size: Proportion of dataset for test split (default 0.2).
        random_state: Random seed for reproducibility.
        
    Returns:
        Dict: Metadata and summary statistics of processed datasets.
    """
    logger.info("=== Starting Data Preprocessing Pipeline ===")
    
    # 1. Load and clean raw data
    clean_df = load_and_clean_data(raw_filepath)
    
    # 2. Separate features and target
    X, y = split_features_and_target(clean_df, target_column=TARGET_COLUMN)
    
    # 3. Stratified Train-Test Split to preserve fraud ratio
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )
    logger.info(f"Train split: {X_train.shape[0]:,} samples | Test split: {X_test.shape[0]:,} samples")
    logger.info(f"Train fraud count: {int(y_train.sum()):,} ({y_train.mean()*100:.2f}%) | Test fraud count: {int(y_test.sum()):,} ({y_test.mean()*100:.2f}%)")

    # 4. Build and fit pipeline strictly on training data
    preprocessor = build_preprocessor()
    logger.info("Fitting preprocessing pipeline on training dataset...")
    X_train_transformed = preprocessor.fit_transform(X_train)
    X_test_transformed = preprocessor.transform(X_test)
    
    # 5. Extract feature names
    feature_names = get_feature_names_from_preprocessor(preprocessor, X_train)
    logger.info(f"Extracted {len(feature_names)} transformed features.")

    # 6. Convert to DataFrames and attach target label
    df_train_proc = pd.DataFrame(X_train_transformed, columns=feature_names)
    df_train_proc[TARGET_COLUMN] = y_train.values

    df_test_proc = pd.DataFrame(X_test_transformed, columns=feature_names)
    df_test_proc[TARGET_COLUMN] = y_test.values

    # 7. Save processed datasets
    ensure_directory(PROCESSED_DATA_DIR)
    ensure_directory(MODELS_DIR)
    
    df_train_proc.to_csv(TRAIN_PROCESSED_FILE, index=False)
    logger.info(f"Saved processed training set to {TRAIN_PROCESSED_FILE.resolve()} ({df_train_proc.shape})")
    
    df_test_proc.to_csv(TEST_PROCESSED_FILE, index=False)
    logger.info(f"Saved processed test set to {TEST_PROCESSED_FILE.resolve()} ({df_test_proc.shape})")

    # 8. Save serialized preprocessor pipeline artifact
    save_artifact(preprocessor, PREPROCESSOR_FILE)

    # 9. Save pipeline metadata
    metadata = {
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "random_state": random_state,
        "test_size": test_size,
        "total_records_cleaned": int(len(clean_df)),
        "train_samples": int(len(df_train_proc)),
        "test_samples": int(len(df_test_proc)),
        "train_fraud_count": int(y_train.sum()),
        "test_fraud_count": int(y_test.sum()),
        "train_fraud_ratio": float(y_train.mean()),
        "test_fraud_ratio": float(y_test.mean()),
        "feature_count": len(feature_names),
        "feature_names": feature_names,
        "learned_thresholds": {
            "amount_high_threshold": preprocessor.named_steps["domain"].amount_threshold_,
            "distance_home_threshold": preprocessor.named_steps["domain"].distance_home_threshold_,
        }
    }
    save_json(metadata, METADATA_FILE)
    
    logger.info("=== Preprocessing Pipeline Completed Successfully ===")
    return {
        "train_shape": df_train_proc.shape,
        "test_shape": df_test_proc.shape,
        "features": feature_names,
        "metadata_path": str(METADATA_FILE),
        "preprocessor_path": str(PREPROCESSOR_FILE),
    }


if __name__ == "__main__":
    run_preprocessing_pipeline()
