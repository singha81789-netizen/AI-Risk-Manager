"""
Unit and integration tests for data loading, schema validation, and feature engineering.
"""

from pathlib import Path
import unittest

import numpy as np
import pandas as pd

from src.config import (
    ALL_RAW_COLUMNS,
    METADATA_FILE,
    PREPROCESSOR_FILE,
    RAW_TRANSACTIONS_FILE,
    TARGET_COLUMN,
    TEST_PROCESSED_FILE,
    TRAIN_PROCESSED_FILE,
)
from src.data_loader import (
    clean_raw_data,
    load_and_clean_data,
    load_raw_data,
    split_features_and_target,
    validate_schema,
)
from src.feature_engineering import (
    build_preprocessor,
    run_preprocessing_pipeline,
    transform_single_transaction,
)


class TestDataPipeline(unittest.TestCase):
    """Test suite for data loading, validation, and feature engineering."""

    def test_load_raw_data(self):
        """Test loading the raw dataset."""
        df = load_raw_data(RAW_TRANSACTIONS_FILE)
        self.assertIsInstance(df, pd.DataFrame)
        self.assertFalse(df.empty)
        self.assertGreater(df.shape[0], 1000)
        self.assertIn(TARGET_COLUMN, df.columns)

    def test_validate_schema_success(self):
        """Test schema validation on the original dataset."""
        df = load_raw_data(RAW_TRANSACTIONS_FILE)
        self.assertTrue(validate_schema(df, ALL_RAW_COLUMNS))

    def test_validate_schema_missing_column(self):
        """Test schema validation raises ValueError if a mandatory column is missing."""
        df = load_raw_data(RAW_TRANSACTIONS_FILE)
        df_missing = df.drop(columns=["amount"])
        with self.assertRaises(ValueError):
            validate_schema(df_missing, ALL_RAW_COLUMNS)

    def test_clean_raw_data_deduplication(self):
        """Test that duplicate records and IDs are removed correctly."""
        df = load_raw_data(RAW_TRANSACTIONS_FILE)
        initial_len = len(df)
        
        dup_row = df.iloc[[0]]
        df_with_dup = pd.concat([df, dup_row], ignore_index=True)
        
        cleaned = clean_raw_data(df_with_dup, drop_duplicates=True)
        self.assertLessEqual(len(cleaned), initial_len)
        self.assertEqual(cleaned["transaction_id"].duplicated().sum(), 0)

    def test_split_features_and_target(self):
        """Test feature and target separation."""
        df = load_and_clean_data(RAW_TRANSACTIONS_FILE)
        X, y = split_features_and_target(df, target_column=TARGET_COLUMN)
        
        self.assertNotIn(TARGET_COLUMN, X.columns)
        self.assertEqual(len(X), len(y))
        self.assertEqual(y.name, TARGET_COLUMN)
        self.assertTrue(set(np.unique(y)).issubset({0, 1}))

    def test_preprocessing_pipeline_fit_transform(self):
        """Test building, fitting, and transforming data through the feature pipeline."""
        df = load_and_clean_data(RAW_TRANSACTIONS_FILE)
        X, y = split_features_and_target(df)
        
        pipeline = build_preprocessor()
        X_proc = pipeline.fit_transform(X)
        
        # Check transformed matrix
        self.assertIsInstance(X_proc, np.ndarray)
        self.assertEqual(X_proc.shape[0], len(X))
        self.assertGreaterEqual(X_proc.shape[1], 40)
        # Ensure no NaN values in processed matrix
        self.assertFalse(np.isnan(X_proc).any())

    def test_run_preprocessing_pipeline_end_to_end(self):
        """Test end-to-end execution and artifact generation."""
        result = run_preprocessing_pipeline()
        
        train_shape = result["train_shape"]
        test_shape = result["test_shape"]
        
        self.assertGreater(train_shape[0], 0)
        self.assertGreater(test_shape[0], 0)
        self.assertEqual(train_shape[1], test_shape[1])
        
        # Check that output CSV and model files exist
        self.assertTrue(Path(TRAIN_PROCESSED_FILE).exists())
        self.assertTrue(Path(TEST_PROCESSED_FILE).exists())
        self.assertTrue(Path(PREPROCESSOR_FILE).exists())
        self.assertTrue(Path(METADATA_FILE).exists())
        
        df_train = pd.read_csv(TRAIN_PROCESSED_FILE)
        df_test = pd.read_csv(TEST_PROCESSED_FILE)
        
        self.assertIn(TARGET_COLUMN, df_train.columns)
        self.assertIn(TARGET_COLUMN, df_test.columns)
        self.assertFalse(df_train.isnull().values.any())
        self.assertFalse(df_test.isnull().values.any())

    def test_transform_single_transaction_inference(self):
        """Test transforming a single raw transaction dictionary (for API inference)."""
        sample_txn = {
            "transaction_id": "TXN_999999",
            "timestamp": "2026-03-15 02:45:00",
            "customer_id": "CUST_0123",
            "age": 42,
            "gender": "M",
            "merchant_id": "MERCH_0055",
            "merchant_category": "electronics",
            "amount": 750.50,
            "transaction_type": "Online",
            "card_type": "Credit",
            "card_present": 0,
            "device_type": "Web_Browser",
            "distance_from_home": 65.4,
            "distance_from_last_transaction": 45.2,
            "high_risk_country": 1,
            "velocity_last_24h": 5,
        }
        
        vec = transform_single_transaction(sample_txn, preprocessor_path=PREPROCESSOR_FILE)
        self.assertIsInstance(vec, np.ndarray)
        self.assertEqual(vec.shape[0], 1)
        self.assertGreaterEqual(vec.shape[1], 40)
        self.assertFalse(np.isnan(vec).any())


if __name__ == "__main__":
    unittest.main()
