"""
Unit tests for the reusable risk scoring module (src.risk_scoring).
"""

import unittest

from src.risk_scoring import RiskScoreResult, compute_risk_score


class TestComputeRiskScore(unittest.TestCase):
    """Boundary and behavior tests for compute_risk_score."""

    # --- Default thresholds (medium=0.35, high=0.70) ---

    def test_zero_probability_is_low(self):
        result = compute_risk_score(0.0)
        self.assertEqual(result.risk_level, "LOW")
        self.assertEqual(result.risk_score, 0)
        self.assertEqual(result.probability, 0.0)

    def test_one_probability_is_high(self):
        result = compute_risk_score(1.0)
        self.assertEqual(result.risk_level, "HIGH")
        self.assertEqual(result.risk_score, 100)
        self.assertEqual(result.probability, 1.0)

    def test_exactly_medium_threshold(self):
        result = compute_risk_score(0.35)
        self.assertEqual(result.risk_level, "MEDIUM")
        self.assertEqual(result.risk_score, 35)

    def test_one_below_medium_threshold(self):
        result = compute_risk_score(0.34)
        self.assertEqual(result.risk_level, "LOW")
        self.assertEqual(result.risk_score, 34)

    def test_exactly_high_threshold(self):
        result = compute_risk_score(0.70)
        self.assertEqual(result.risk_level, "HIGH")
        self.assertEqual(result.risk_score, 70)

    def test_one_below_high_threshold(self):
        result = compute_risk_score(0.69)
        self.assertEqual(result.risk_level, "MEDIUM")
        self.assertEqual(result.risk_score, 69)

    def test_midpoint_low(self):
        result = compute_risk_score(0.20)
        self.assertEqual(result.risk_level, "LOW")
        self.assertEqual(result.risk_score, 20)

    def test_midpoint_medium(self):
        result = compute_risk_score(0.55)
        self.assertEqual(result.risk_level, "MEDIUM")
        self.assertEqual(result.risk_score, 55)

    def test_midpoint_high(self):
        result = compute_risk_score(0.85)
        self.assertEqual(result.risk_level, "HIGH")
        self.assertEqual(result.risk_score, 85)

    # --- Rounding behavior ---

    def test_probability_rounding_to_four_decimals(self):
        result = compute_risk_score(0.12345678)
        self.assertEqual(result.probability, 0.1235)

    def test_risk_score_rounds_correctly(self):
        result = compute_risk_score(0.556)
        self.assertEqual(result.risk_score, 56)

    # --- Return type ---

    def test_returns_dataclass(self):
        result = compute_risk_score(0.5)
        self.assertIsInstance(result, RiskScoreResult)
        self.assertIsInstance(result.probability, float)
        self.assertIsInstance(result.risk_score, int)
        self.assertIsInstance(result.risk_level, str)

    def test_result_is_frozen(self):
        result = compute_risk_score(0.5)
        with self.assertRaises(AttributeError):
            result.risk_level = "BOGUS"

    # --- Custom thresholds ---

    def test_custom_thresholds_shift_boundaries(self):
        result = compute_risk_score(
            0.50,
            medium_threshold=0.60,
            high_threshold=0.90,
        )
        self.assertEqual(result.risk_level, "LOW")
        self.assertEqual(result.risk_score, 50)

    def test_custom_thresholds_tight_medium(self):
        result = compute_risk_score(
            0.20,
            medium_threshold=0.10,
            high_threshold=0.50,
        )
        self.assertEqual(result.risk_level, "MEDIUM")
        self.assertEqual(result.risk_score, 20)

    def test_custom_thresholds_all_boundary(self):
        result = compute_risk_score(
            0.90,
            medium_threshold=0.10,
            high_threshold=0.90,
        )
        self.assertEqual(result.risk_level, "HIGH")
        self.assertEqual(result.risk_score, 90)

    # --- Input validation ---

    def test_negative_probability_raises(self):
        with self.assertRaises(ValueError):
            compute_risk_score(-0.01)

    def test_probability_above_one_raises(self):
        with self.assertRaises(ValueError):
            compute_risk_score(1.01)

    def test_invalid_threshold_order_raises(self):
        with self.assertRaises(ValueError):
            compute_risk_score(0.5, medium_threshold=0.70, high_threshold=0.35)

    def test_equal_thresholds_raise(self):
        with self.assertRaises(ValueError):
            compute_risk_score(0.5, medium_threshold=0.50, high_threshold=0.50)

    def test_threshold_at_zero_raises(self):
        with self.assertRaises(ValueError):
            compute_risk_score(0.5, medium_threshold=0.0, high_threshold=0.50)

    def test_threshold_at_one_is_valid(self):
        result = compute_risk_score(0.5, medium_threshold=0.30, high_threshold=1.0)
        self.assertEqual(result.risk_level, "MEDIUM")

    def test_both_thresholds_at_one_raises(self):
        with self.assertRaises(ValueError):
            compute_risk_score(0.5, medium_threshold=1.0, high_threshold=1.0)

    # --- Edge cases ---

    def test_halfway_between_medium_and_high(self):
        result = compute_risk_score(0.525)
        self.assertEqual(result.risk_level, "MEDIUM")

    def test_very_small_positive(self):
        result = compute_risk_score(0.001)
        self.assertEqual(result.risk_level, "LOW")
        self.assertEqual(result.risk_score, 0)

    def test_numpy_float_input(self):
        import numpy as np
        result = compute_risk_score(np.float64(0.60))
        self.assertEqual(result.risk_level, "MEDIUM")
        self.assertEqual(result.risk_score, 60)


if __name__ == "__main__":
    unittest.main()
