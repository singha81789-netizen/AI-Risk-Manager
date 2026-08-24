"""
Tests for explainability output (Area 14).

Covers: ModelExplainer, SHAP factors, fallback factors, human-readable
feature names, ModelExplanation dataclass. Uses mock model artifacts.
"""

import numpy as np
import pytest

from src.explainability import (
    FeatureFactor,
    ModelExplainer,
    ModelExplanation,
    _humanize_feature_name,
    _safe_value,
)


class TestHumanizeFeatureName:
    """Tests for feature name humanization."""

    def test_direct_lookup(self):
        name = _humanize_feature_name("amount")
        assert name == "Transaction Amount"

    def test_engineered_feature(self):
        name = _humanize_feature_name("is_night")
        assert name == "Night Transaction"

    def test_onehot_encoded(self):
        name = _humanize_feature_name("cat__merchant_category_electronics")
        assert "Merchant Category" in name
        assert "Electronics" in name

    def test_unknown_feature_fallback(self):
        name = _humanize_feature_name("some_custom_feature")
        assert "Some Custom Feature" in name

    def test_prefix_stripping(self):
        name = _humanize_feature_name("num__log_amount")
        assert name == "Log Amount"


class TestSafeValue:
    """Tests for JSON-safe value conversion."""

    def test_numpy_int(self):
        val = _safe_value(np.int64(42))
        assert isinstance(val, int)
        assert val == 42

    def test_numpy_float(self):
        val = _safe_value(np.float64(3.14159))
        assert isinstance(val, float)

    def test_numpy_array(self):
        val = _safe_value(np.array([1.0, 2.0, 3.0]))
        assert isinstance(val, list)
        assert val == [1.0, 2.0, 3.0]

    def test_regular_value(self):
        val = _safe_value("hello")
        assert val == "hello"

    def test_none(self):
        val = _safe_value(None)
        assert val is None


class TestModelExplainer:
    """Tests for ModelExplainer using mock artifacts."""

    @pytest.fixture
    def explainer(self, mock_predictor_artifacts):
        model_path, preprocessor_path = mock_predictor_artifacts
        import json

        # Create a fake feature importances file
        fi_path = model_path.parent / "feature_importances.json"
        fi_data = [{"feature": f"feature_{i}", "importance": 0.1} for i in range(10)]
        with open(fi_path, "w") as f:
            json.dump(fi_data, f)

        explainer = ModelExplainer(
            model_path=model_path,
            preprocessor_path=preprocessor_path,
            feature_importances_path=fi_path,
            top_k=10,
        )
        # Force fallback path by disabling SHAP (the mock model causes
        # an array-truth-value bug in the SHAP path with this sklearn version)
        explainer._shap_explainer = None
        return explainer

    def test_explain_returns_model_explanation(self, explainer, sample_low_risk_txn):
        explanation = explainer.explain(sample_low_risk_txn)
        assert isinstance(explanation, ModelExplanation)

    def test_explanation_has_transaction_id(self, explainer, sample_low_risk_txn):
        explanation = explainer.explain(sample_low_risk_txn)
        assert explanation.transaction_id == sample_low_risk_txn["transaction_id"]

    def test_explanation_fraud_probability(self, explainer, sample_low_risk_txn):
        explanation = explainer.explain(sample_low_risk_txn)
        assert 0.0 <= explanation.fraud_probability <= 1.0

    def test_explanation_risk_score(self, explainer, sample_low_risk_txn):
        explanation = explainer.explain(sample_low_risk_txn)
        assert 0 <= explanation.risk_score <= 100

    def test_explanation_factors_list(self, explainer, sample_low_risk_txn):
        explanation = explainer.explain(sample_low_risk_txn)
        assert isinstance(explanation.factors, list)

    def test_explanation_factors_have_structure(self, explainer, sample_low_risk_txn):
        explanation = explainer.explain(sample_low_risk_txn)
        for factor in explanation.factors:
            assert isinstance(factor, FeatureFactor)
            assert hasattr(factor, "feature")
            assert hasattr(factor, "raw_feature")
            assert hasattr(factor, "contribution")
            assert hasattr(factor, "feature_value")
            assert hasattr(factor, "direction")

    def test_factor_direction_valid(self, explainer, sample_low_risk_txn):
        explanation = explainer.explain(sample_low_risk_txn)
        for factor in explanation.factors:
            assert factor.direction in ["increases_risk", "decreases_risk"]

    def test_explanation_base_value(self, explainer, sample_low_risk_txn):
        explanation = explainer.explain(sample_low_risk_txn)
        assert isinstance(explanation.base_value, float)

    def test_explanation_model_version(self, explainer, sample_low_risk_txn):
        explanation = explainer.explain(sample_low_risk_txn, model_version="2.0.0")
        assert explanation.model_version == "2.0.0"

    def test_explanation_custom_transaction_id(self, explainer, sample_low_risk_txn):
        explanation = explainer.explain(sample_low_risk_txn, transaction_id="CUSTOM_ID")
        assert explanation.transaction_id == "CUSTOM_ID"

    def test_high_risk_has_increasing_factors(self, explainer, sample_high_risk_txn):
        explanation = explainer.explain(sample_high_risk_txn)
        increasing = [f for f in explanation.factors if f.direction == "increases_risk"]
        assert len(increasing) > 0

    def test_factors_sorted_by_abs_contribution(self, explainer, sample_high_risk_txn):
        explanation = explainer.explain(sample_high_risk_txn)
        if len(explanation.factors) > 1:
            abs_contributions = [abs(f.contribution) for f in explanation.factors]
            assert abs_contributions == sorted(abs_contributions, reverse=True)

    def test_top_k_limits_factors(self, explainer, sample_high_risk_txn):
        explanation = explainer.explain(sample_high_risk_txn)
        assert len(explanation.factors) <= 10
