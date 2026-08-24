"""
Tests for risk scoring (Area 4).

Covers: probability-to-score conversion, boundary conditions, risk levels,
custom thresholds, frozen dataclass, and numpy compatibility.
"""

import numpy as np
import pytest

from src.risk_scoring import RiskScoreResult, compute_risk_score


class TestRiskScoreBoundaries:
    """Boundary tests with default thresholds (medium=0.35, high=0.70)."""

    def test_zero_is_low(self):
        r = compute_risk_score(0.0)
        assert r.risk_level == "LOW"
        assert r.risk_score == 0

    def test_one_is_high(self):
        r = compute_risk_score(1.0)
        assert r.risk_level == "HIGH"
        assert r.risk_score == 100

    def test_exactly_medium_threshold(self):
        r = compute_risk_score(0.35)
        assert r.risk_level == "MEDIUM"
        assert r.risk_score == 35

    def test_one_below_medium_threshold(self):
        r = compute_risk_score(0.34)
        assert r.risk_level == "LOW"

    def test_exactly_high_threshold(self):
        r = compute_risk_score(0.70)
        assert r.risk_level == "HIGH"
        assert r.risk_score == 70

    def test_one_below_high_threshold(self):
        r = compute_risk_score(0.69)
        assert r.risk_level == "MEDIUM"

    def test_mid_low(self):
        assert compute_risk_score(0.20).risk_level == "LOW"

    def test_mid_medium(self):
        assert compute_risk_score(0.55).risk_level == "MEDIUM"

    def test_mid_high(self):
        assert compute_risk_score(0.85).risk_level == "HIGH"


class TestRiskScoreOutput:
    """Output format and type tests."""

    def test_returns_dataclass(self):
        r = compute_risk_score(0.5)
        assert isinstance(r, RiskScoreResult)

    def test_probability_is_float(self):
        r = compute_risk_score(0.5)
        assert isinstance(r.probability, float)

    def test_risk_score_is_int(self):
        r = compute_risk_score(0.5)
        assert isinstance(r.risk_score, int)

    def test_risk_level_is_str(self):
        r = compute_risk_score(0.5)
        assert isinstance(r.risk_level, str)

    def test_probability_rounded_to_four(self):
        r = compute_risk_score(0.12345678)
        assert r.probability == 0.1235

    def test_risk_score_rounds_correctly(self):
        r = compute_risk_score(0.556)
        assert r.risk_score == 56

    def test_frozen_dataclass(self):
        r = compute_risk_score(0.5)
        with pytest.raises(AttributeError):
            r.risk_level = "BOGUS"


class TestCustomThresholds:
    """Tests with non-default threshold values."""

    def test_shifted_boundaries(self):
        r = compute_risk_score(0.50, medium_threshold=0.60, high_threshold=0.90)
        assert r.risk_level == "LOW"

    def test_tight_medium(self):
        r = compute_risk_score(0.20, medium_threshold=0.10, high_threshold=0.50)
        assert r.risk_level == "MEDIUM"

    def test_high_at_boundary(self):
        r = compute_risk_score(0.90, medium_threshold=0.10, high_threshold=0.90)
        assert r.risk_level == "HIGH"

    def test_medium_at_1_0(self):
        r = compute_risk_score(0.5, medium_threshold=0.30, high_threshold=1.0)
        assert r.risk_level == "MEDIUM"


class TestRiskScoreValidation:
    """Input validation tests."""

    def test_negative_probability(self):
        with pytest.raises(ValueError):
            compute_risk_score(-0.01)

    def test_probability_above_one(self):
        with pytest.raises(ValueError):
            compute_risk_score(1.01)

    def test_inverted_thresholds(self):
        with pytest.raises(ValueError):
            compute_risk_score(0.5, medium_threshold=0.70, high_threshold=0.35)

    def test_equal_thresholds(self):
        with pytest.raises(ValueError):
            compute_risk_score(0.5, medium_threshold=0.50, high_threshold=0.50)

    def test_medium_at_zero(self):
        with pytest.raises(ValueError):
            compute_risk_score(0.5, medium_threshold=0.0, high_threshold=0.50)

    def test_both_at_one(self):
        with pytest.raises(ValueError):
            compute_risk_score(0.5, medium_threshold=1.0, high_threshold=1.0)


class TestRiskScoreNumpy:
    """Numpy type compatibility."""

    def test_numpy_float64(self):
        r = compute_risk_score(np.float64(0.60))
        assert r.risk_level == "MEDIUM"
        assert r.risk_score == 60

    def test_numpy_int(self):
        r = compute_risk_score(int(1))
        assert r.risk_level == "HIGH"

    def test_very_small_positive(self):
        r = compute_risk_score(0.001)
        assert r.risk_level == "LOW"
        assert r.risk_score == 0
