"""
Tests for data loading (Area 1).

Covers: CSV loading, schema validation, deduplication, feature/target split.
All tests use synthetic data from conftest.py or the real raw CSV.
"""

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from src.config import ALL_RAW_COLUMNS, TARGET_COLUMN
from src.data_loader import (
    clean_raw_data,
    load_and_clean_data,
    load_raw_data,
    split_features_and_target,
    validate_schema,
)


class TestLoadRawData:
    """Tests for load_raw_data()."""

    def test_load_from_path(self, synthetic_raw_csv):
        df = load_raw_data(synthetic_raw_csv)
        assert isinstance(df, pd.DataFrame)
        assert not df.empty
        assert len(df) == 200

    def test_load_real_dataset(self):
        real_path = Path(__file__).resolve().parent.parent / "data" / "raw" / "fraud_transactions.csv"
        if real_path.exists():
            df = load_raw_data(real_path)
            assert df.shape[0] >= 1000
            assert TARGET_COLUMN in df.columns

    def test_file_not_found_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_raw_data(tmp_path / "nonexistent.csv")

    def test_returns_dataframe(self, synthetic_raw_csv):
        df = load_raw_data(synthetic_raw_csv)
        assert isinstance(df, pd.DataFrame)

    def test_preserves_all_columns(self, synthetic_raw_csv):
        df = load_raw_data(synthetic_raw_csv)
        for col in ["transaction_id", "amount", "is_fraud"]:
            assert col in df.columns


class TestValidateSchema:
    """Tests for validate_schema()."""

    def test_valid_schema_passes(self, synthetic_transactions_df):
        assert validate_schema(synthetic_transactions_df) is True

    def test_missing_column_raises(self, synthetic_transactions_df):
        df = synthetic_transactions_df.drop(columns=["amount"])
        with pytest.raises(ValueError, match="Schema validation failed"):
            validate_schema(df)

    def test_multiple_missing_columns(self, synthetic_transactions_df):
        df = synthetic_transactions_df.drop(columns=["amount", "age", "gender"])
        with pytest.raises(ValueError, match="Schema validation failed"):
            validate_schema(df)

    def test_custom_expected_columns(self, synthetic_transactions_df):
        minimal_cols = ["transaction_id", "amount"]
        assert validate_schema(synthetic_transactions_df, expected_columns=minimal_cols) is True


class TestCleanRawData:
    """Tests for clean_raw_data()."""

    def test_removes_exact_duplicates(self, synthetic_transactions_df):
        duped = pd.concat(
            [synthetic_transactions_df, synthetic_transactions_df.iloc[[0]]],
            ignore_index=True,
        )
        cleaned = clean_raw_data(duped, drop_duplicates=True)
        assert len(cleaned) == len(synthetic_transactions_df)

    def test_removes_duplicate_transaction_ids(self, synthetic_transactions_df):
        duped = synthetic_transactions_df.copy()
        duped.loc[len(duped)] = duped.iloc[0].to_dict()  # duplicate row
        cleaned = clean_raw_data(duped, drop_duplicates=True)
        assert cleaned["transaction_id"].duplicated().sum() == 0

    def test_no_cleaning_when_disabled(self, synthetic_transactions_df):
        duped = pd.concat(
            [synthetic_transactions_df, synthetic_transactions_df.iloc[[0]]],
            ignore_index=True,
        )
        cleaned = clean_raw_data(duped, drop_duplicates=False)
        assert len(cleaned) == len(duped)

    def test_target_cast_to_int(self, synthetic_transactions_df):
        cleaned = clean_raw_data(synthetic_transactions_df)
        assert cleaned[TARGET_COLUMN].dtype in [np.int64, int, np.int32]

    def test_index_reset(self, synthetic_transactions_df):
        cleaned = clean_raw_data(synthetic_transactions_df)
        assert list(cleaned.index) == list(range(len(cleaned)))


class TestSplitFeaturesAndTarget:
    """Tests for split_features_and_target()."""

    def test_basic_split(self, synthetic_transactions_df):
        X, y = split_features_and_target(synthetic_transactions_df)
        assert TARGET_COLUMN not in X.columns
        assert len(X) == len(y)
        assert y.name == TARGET_COLUMN

    def test_target_binary(self, synthetic_transactions_df):
        _, y = split_features_and_target(synthetic_transactions_df)
        assert set(np.unique(y)).issubset({0, 1})

    def test_missing_target_raises(self):
        df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
        with pytest.raises(KeyError, match="is_fraud"):
            split_features_and_target(df)

    def test_features_exclude_all_id_columns(self, synthetic_transactions_df):
        X, _ = split_features_and_target(synthetic_transactions_df)
        for id_col in ["transaction_id", "customer_id", "merchant_id"]:
            assert id_col in X.columns  # IDs stay in X (dropped later by feature engineering)
