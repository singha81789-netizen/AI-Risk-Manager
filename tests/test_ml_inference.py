"""
Tests for ML inference (Area 5).

Covers: FraudPredictor single/batch scoring, predict_proba, predict,
triggered risk factors, decision logic. Uses mock model artifacts.
"""

import numpy as np
import pandas as pd
import pytest

from src.model_inference import FraudPredictor


class TestFraudPredictorInit:
    """Tests for predictor initialization."""

    def test_loads_from_paths(self, mock_predictor_artifacts):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        assert predictor._model is not None
        assert predictor._preprocessor is not None

    def test_missing_model_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            FraudPredictor(model_path=tmp_path / "no_model.pkl", preprocessor_path=tmp_path / "no_pp.pkl")

    def test_missing_preprocessor_raises(self, tmp_path, mock_model):
        import joblib
        model_path = tmp_path / "model.pkl"
        joblib.dump(mock_model, model_path)
        with pytest.raises(FileNotFoundError):
            FraudPredictor(model_path=model_path, preprocessor_path=tmp_path / "no_pp.pkl")


class TestPredictProba:
    """Tests for probability prediction."""

    def test_single_transaction(self, mock_predictor_artifacts, sample_low_risk_txn):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        prob = predictor.predict_proba(sample_low_risk_txn)
        assert isinstance(prob, float)
        assert 0.0 <= prob <= 1.0

    def test_batch_transactions(self, mock_predictor_artifacts, sample_transactions_batch):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        df = pd.DataFrame(sample_transactions_batch)
        probs = predictor.predict_proba(df)
        assert isinstance(probs, np.ndarray)
        assert len(probs) == len(sample_transactions_batch)
        assert all(0.0 <= p <= 1.0 for p in probs)

    def test_high_risk_has_higher_probability(self, mock_predictor_artifacts, sample_low_risk_txn, sample_high_risk_txn):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        prob_low = predictor.predict_proba(sample_low_risk_txn)
        prob_high = predictor.predict_proba(sample_high_risk_txn)
        assert prob_high >= prob_low


class TestPredict:
    """Tests for binary prediction."""

    def test_binary_output(self, mock_predictor_artifacts, sample_low_risk_txn):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        pred = predictor.predict(sample_low_risk_txn)
        assert pred in [0, 1]

    def test_batch_binary_output(self, mock_predictor_artifacts, sample_transactions_batch):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        df = pd.DataFrame(sample_transactions_batch)
        preds = predictor.predict(df)
        assert isinstance(preds, np.ndarray)
        assert all(p in [0, 1] for p in preds)


class TestScoreTransaction:
    """Tests for the full scoring pipeline."""

    def test_returns_all_fields(self, mock_predictor_artifacts, sample_low_risk_txn):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        result = predictor.score_transaction(sample_low_risk_txn)

        assert "transaction_id" in result
        assert "fraud_probability" in result
        assert "risk_score" in result
        assert "risk_level" in result
        assert "decision" in result
        assert "is_fraud_predicted" in result
        assert "triggered_risk_factors" in result

    def test_decision_in_valid_set(self, mock_predictor_artifacts, sample_low_risk_txn):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        result = predictor.score_transaction(sample_low_risk_txn)
        assert result["decision"] in ["APPROVE", "REVIEW", "DECLINE"]

    def test_risk_level_in_valid_set(self, mock_predictor_artifacts, sample_low_risk_txn):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        result = predictor.score_transaction(sample_low_risk_txn)
        assert result["risk_level"] in ["LOW", "MEDIUM", "HIGH"]

    def test_triggered_risk_factors_is_list(self, mock_predictor_artifacts, sample_high_risk_txn):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        result = predictor.score_transaction(sample_high_risk_txn)
        assert isinstance(result["triggered_risk_factors"], list)

    def test_high_risk_triggers_factors(self, mock_predictor_artifacts, sample_high_risk_txn):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        result = predictor.score_transaction(sample_high_risk_txn)
        # High-risk transaction should trigger at least some rules
        assert len(result["triggered_risk_factors"]) > 0


class TestScoreBatch:
    """Tests for batch scoring."""

    def test_batch_output_columns(self, mock_predictor_artifacts, sample_transactions_batch):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        df = pd.DataFrame(sample_transactions_batch)
        scored = predictor.score_batch(df)

        for col in ["fraud_probability", "risk_score", "risk_level", "decision", "is_fraud_predicted"]:
            assert col in scored.columns

    def test_batch_length_matches(self, mock_predictor_artifacts, sample_transactions_batch):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        df = pd.DataFrame(sample_transactions_batch)
        scored = predictor.score_batch(df)
        assert len(scored) == len(sample_transactions_batch)


class TestTriggeredRules:
    """Tests for rule-based explainability triggers."""

    def test_high_amount_trigger(self, mock_predictor_artifacts):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        txn = {
            "amount": 500.0,
            "velocity_last_24h": 1,
            "distance_from_home": 5.0,
            "high_risk_country": 0,
            "card_present": 1,
            "merchant_category": "grocery",
        }
        triggers = predictor._identify_triggered_rules(txn, 0.5)
        assert any("High transaction amount" in t for t in triggers)

    def test_high_velocity_trigger(self, mock_predictor_artifacts):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        txn = {
            "amount": 20.0,
            "velocity_last_24h": 6,
            "distance_from_home": 5.0,
            "high_risk_country": 0,
            "card_present": 1,
            "merchant_category": "grocery",
        }
        triggers = predictor._identify_triggered_rules(txn, 0.5)
        assert any("24-hour transaction frequency" in t for t in triggers)

    def test_distance_trigger(self, mock_predictor_artifacts):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        txn = {
            "amount": 20.0,
            "velocity_last_24h": 1,
            "distance_from_home": 100.0,
            "high_risk_country": 0,
            "card_present": 1,
            "merchant_category": "grocery",
        }
        triggers = predictor._identify_triggered_rules(txn, 0.5)
        assert any("distance from home" in t.lower() for t in triggers)

    def test_high_risk_country_trigger(self, mock_predictor_artifacts):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        txn = {
            "amount": 20.0,
            "velocity_last_24h": 1,
            "distance_from_home": 5.0,
            "high_risk_country": 1,
            "card_present": 1,
            "merchant_category": "grocery",
        }
        triggers = predictor._identify_triggered_rules(txn, 0.5)
        assert any("high-risk" in t.lower() for t in triggers)

    def test_cnp_trigger(self, mock_predictor_artifacts):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        txn = {
            "amount": 20.0,
            "velocity_last_24h": 1,
            "distance_from_home": 5.0,
            "high_risk_country": 0,
            "card_present": 0,
            "merchant_category": "grocery",
        }
        triggers = predictor._identify_triggered_rules(txn, 0.5)
        assert any("Card Not Present" in t for t in triggers)

    def test_no_triggers_for_low_risk(self, mock_predictor_artifacts):
        model_path, preprocessor_path = mock_predictor_artifacts
        predictor = FraudPredictor(model_path=model_path, preprocessor_path=preprocessor_path)
        txn = {
            "amount": 25.0,
            "velocity_last_24h": 1,
            "distance_from_home": 3.0,
            "high_risk_country": 0,
            "card_present": 1,
            "merchant_category": "grocery",
        }
        triggers = predictor._identify_triggered_rules(txn, 0.5)
        assert len(triggers) == 0
