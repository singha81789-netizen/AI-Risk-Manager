"""
Tests for data preprocessing (Area 2).

Covers: preprocessing pipeline fit/transform, single transaction transform,
train/test split, and no data leakage.
"""

import numpy as np
import pandas as pd
import pytest

from src.feature_engineering import (
    build_preprocessor,
    get_feature_names_from_preprocessor,
    run_preprocessing_pipeline,
    transform_single_transaction,
)


class TestBuildPreprocessor:
    """Tests for building the preprocessing pipeline."""

    def test_returns_pipeline(self):
        from sklearn.pipeline import Pipeline
        pipeline = build_preprocessor()
        assert isinstance(pipeline, Pipeline)

    def test_has_expected_steps(self):
        pipeline = build_preprocessor()
        assert "temporal" in pipeline.named_steps
        assert "domain" in pipeline.named_steps
        assert "col_transform" in pipeline.named_steps

    def test_fit_transform_produces_array(self, synthetic_transactions_df):
        pipeline = build_preprocessor()
        X = synthetic_transactions_df.drop(columns=["is_fraud"])
        result = pipeline.fit_transform(X)
        assert isinstance(result, np.ndarray)

    def test_no_nan_in_output(self, synthetic_transactions_df):
        pipeline = build_preprocessor()
        X = synthetic_transactions_df.drop(columns=["is_fraud"])
        result = pipeline.fit_transform(X)
        assert not np.isnan(result).any()

    def test_output_row_count_matches_input(self, synthetic_transactions_df):
        pipeline = build_preprocessor()
        X = synthetic_transactions_df.drop(columns=["is_fraud"])
        result = pipeline.fit_transform(X)
        assert result.shape[0] == len(X)

    def test_output_has_minimum_features(self, synthetic_transactions_df):
        pipeline = build_preprocessor()
        X = synthetic_transactions_df.drop(columns=["is_fraud"])
        result = pipeline.fit_transform(X)
        assert result.shape[1] >= 40


class TestPreprocessingConsistency:
    """Tests that fit/transform is consistent and leak-free."""

    def test_fit_then_transform_same_as_fit_transform(self, synthetic_transactions_df):
        pipeline = build_preprocessor()
        X = synthetic_transactions_df.drop(columns=["is_fraud"])

        result_fit_transform = pipeline.fit_transform(X)
        result_fit_then_transform = pipeline.transform(X)
        np.testing.assert_array_almost_equal(result_fit_transform, result_fit_then_transform)

    def test_transform_on_new_data(self, synthetic_transactions_df):
        pipeline = build_preprocessor()
        X = synthetic_transactions_df.drop(columns=["is_fraud"])
        split = len(X) // 2

        pipeline.fit(X.iloc[:split])
        result = pipeline.transform(X.iloc[split:])
        assert result.shape[0] == len(X) - split
        assert not np.isnan(result).any()


class TestTransformSingleTransaction:
    """Tests for transform_single_transaction()."""

    def test_single_transaction_shape(self, sample_low_risk_txn):
        vec = transform_single_transaction(sample_low_risk_txn)
        assert isinstance(vec, np.ndarray)
        assert vec.shape[0] == 1
        assert vec.shape[1] >= 40

    def test_single_transaction_no_nan(self, sample_low_risk_txn):
        vec = transform_single_transaction(sample_low_risk_txn)
        assert not np.isnan(vec).any()

    def test_with_preloaded_preprocessor(self, sample_low_risk_txn, mock_fitted_pipeline):
        vec = transform_single_transaction(
            sample_low_risk_txn, preprocessor=mock_fitted_pipeline
        )
        assert vec.shape[0] == 1


class TestGetFeatureNames:
    """Tests for feature name extraction."""

    def test_extracts_names_from_fitted_pipeline(self, synthetic_transactions_df):
        pipeline = build_preprocessor()
        X = synthetic_transactions_df.drop(columns=["is_fraud"])
        pipeline.fit(X)
        names = get_feature_names_from_preprocessor(pipeline, X.head(5))
        assert isinstance(names, list)
        assert len(names) >= 40
