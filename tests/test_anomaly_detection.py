"""
Unit tests for the anomaly detection module (src.anomaly_detection).

These tests validate the module in isolation — no model training or data
loading is required.  Synthetic data is generated so tests are fast and
deterministic.
"""

import unittest

import numpy as np
import pandas as pd

from src.anomaly_detection import AnomalyDetector, AnomalyResult, _normalize_score
from src.config import ANOMALY_SCORE_MAX, ANOMALY_SCORE_MIN


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_normal_data(n: int = 200, seed: int = 0) -> np.ndarray:
    """Cluster of points centred around the origin."""
    rng = np.random.RandomState(seed)
    return rng.randn(n, 4)


def _make_anomaly_data(n: int = 10, seed: int = 1) -> np.ndarray:
    """Points far from the origin — clearly anomalous relative to normal."""
    rng = np.random.RandomState(seed)
    return rng.uniform(low=10.0, high=20.0, size=(n, 4))


def _make_mixed_data(n_normal: int = 200, n_anomaly: int = 10) -> np.ndarray:
    return np.vstack([
        _make_normal_data(n_normal),
        _make_anomaly_data(n_anomaly),
    ])


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestNormalizeScore(unittest.TestCase):
    """Tests for the raw-score → 0–1 normalizer."""

    def test_most_anomalous_raw_score(self):
        self.assertAlmostEqual(_normalize_score(ANOMALY_SCORE_MIN), 1.0)

    def test_most_normal_raw_score(self):
        self.assertAlmostEqual(_normalize_score(ANOMALY_SCORE_MAX), 0.0)

    def test_midpoint(self):
        mid = (ANOMALY_SCORE_MIN + ANOMALY_SCORE_MAX) / 2.0
        self.assertAlmostEqual(_normalize_score(mid), 0.5)

    def test_clipping_above_max(self):
        self.assertAlmostEqual(_normalize_score(5.0), 0.0)

    def test_clipping_below_min(self):
        self.assertAlmostEqual(_normalize_score(-5.0), 1.0)

    def test_returns_float(self):
        result = _normalize_score(0.3)
        self.assertIsInstance(result, float)


class TestAnomalyDetectorFit(unittest.TestCase):
    """Tests for model fitting."""

    def test_fit_returns_self(self):
        det = AnomalyDetector(random_state=42)
        result = det.fit(_make_normal_data())
        self.assertIs(result, det)

    def test_fit_with_dataframe(self):
        df = pd.DataFrame(_make_normal_data(), columns=["a", "b", "c", "d"])
        det = AnomalyDetector(random_state=42).fit(df)
        self.assertIsNotNone(det._model)

    def test_fit_with_numpy(self):
        X = _make_normal_data()
        det = AnomalyDetector(random_state=42).fit(X)
        self.assertIsNotNone(det._model)


class TestAnomalyDetectorPredict(unittest.TestCase):
    """Tests for raw IsolationForest predictions (+1 / -1)."""

    def setUp(self):
        self.detector = AnomalyDetector(random_state=42, contamination=0.1)
        self.detector.fit(_make_normal_data())

    def test_normal_data_mostly_positive(self):
        preds = self.detector.predict(_make_normal_data(100, seed=99))
        # With contamination=0.1, most normal points should be +1
        self.assertGreater(np.sum(preds == 1), len(preds) * 0.8)

    def test_anomaly_data_predictions_negative(self):
        preds = self.detector.predict(_make_anomaly_data(20, seed=42))
        self.assertTrue(np.all(preds == -1))

    def test_output_shape(self):
        X = _make_normal_data(30)
        preds = self.detector.predict(X)
        self.assertEqual(preds.shape, (30,))


class TestAnomalyDetectorScoreSamples(unittest.TestCase):
    """Tests for raw score output."""

    def setUp(self):
        self.detector = AnomalyDetector(random_state=42, contamination=0.1)
        self.detector.fit(_make_normal_data())

    def test_normal_scores_higher_than_anomaly_scores(self):
        normal_scores = self.detector.score_samples(_make_normal_data(50, seed=7))
        anomaly_scores = self.detector.score_samples(_make_anomaly_data(50, seed=8))
        self.assertGreater(np.mean(normal_scores), np.mean(anomaly_scores))

    def test_score_shape(self):
        X = _make_normal_data(20)
        scores = self.detector.score_samples(X)
        self.assertEqual(scores.shape, (20,))


class TestAnomalyDetectorDetect(unittest.TestCase):
    """Tests for the structured detect() API."""

    def setUp(self):
        self.detector = AnomalyDetector(random_state=42, contamination=0.1)
        self.detector.fit(_make_normal_data())

    def test_returns_list_of_anomaly_result(self):
        results = self.detector.detect(_make_normal_data(10))
        self.assertEqual(len(results), 10)
        for r in results:
            self.assertIsInstance(r, AnomalyResult)

    def test_normal_data_mostly_not_flagged(self):
        results = self.detector.detect(_make_normal_data(100, seed=99))
        flagged = sum(1 for r in results if r.is_anomaly)
        # With contamination=0.1, <20% of truly normal data should be flagged
        self.assertLess(flagged, len(results) * 0.2)
        for r in results:
            self.assertGreaterEqual(r.anomaly_score, 0.0)
            self.assertLessEqual(r.anomaly_score, 1.0)

    def test_anomaly_data_flagged(self):
        results = self.detector.detect(_make_anomaly_data(50, seed=99))
        flagged = sum(1 for r in results if r.is_anomaly)
        self.assertGreater(flagged, 0, "At least some anomalies should be flagged")

    def test_anomaly_scores_higher_for_anomalies(self):
        normal_results = self.detector.detect(_make_normal_data(100, seed=10))
        anomaly_results = self.detector.detect(_make_anomaly_data(100, seed=11))
        avg_normal = np.mean([r.anomaly_score for r in normal_results])
        avg_anomaly = np.mean([r.anomaly_score for r in anomaly_results])
        self.assertGreater(avg_anomaly, avg_normal)

    def test_mixed_data_detect_length(self):
        X = _make_mixed_data(200, 10)
        results = self.detector.detect(X)
        self.assertEqual(len(results), 210)

    def test_result_fields_are_immutable(self):
        result = self.detector.detect(_make_normal_data(1))[0]
        with self.assertRaises(AttributeError):
            result.is_anomaly = True
        with self.assertRaises(AttributeError):
            result.anomaly_score = 0.99
        with self.assertRaises(AttributeError):
            result.anomaly_label = "BOGUS"


class TestAnomalyDetectorEdgeCases(unittest.TestCase):
    """Edge cases and error handling."""

    def test_predict_before_fit_raises(self):
        det = AnomalyDetector()
        with self.assertRaises(RuntimeError):
            det.predict(_make_normal_data(5))

    def test_score_before_fit_raises(self):
        det = AnomalyDetector()
        with self.assertRaises(RuntimeError):
            det.score_samples(_make_normal_data(5))

    def test_detect_before_fit_raises(self):
        det = AnomalyDetector()
        with self.assertRaises(RuntimeError):
            det.detect(_make_normal_data(5))

    def test_single_row_input(self):
        det = AnomalyDetector(random_state=42).fit(_make_normal_data())
        result = det.detect(_make_normal_data(1))
        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0], AnomalyResult)

    def test_single_row_1d_array(self):
        det = AnomalyDetector(random_state=42).fit(_make_normal_data())
        single = _make_normal_data(1)[0]  # 1-D array of shape (4,)
        results = det.detect(single)
        self.assertEqual(len(results), 1)

    def test_unequal_contamination(self):
        det_low = AnomalyDetector(random_state=42, contamination=0.01).fit(_make_normal_data())
        det_high = AnomalyDetector(random_state=42, contamination=0.20).fit(_make_normal_data())
        X_test = _make_mixed_data(200, 10)

        flagged_low = sum(1 for r in det_low.detect(X_test) if r.is_anomaly)
        flagged_high = sum(1 for r in det_high.detect(X_test) if r.is_anomaly)
        self.assertLessEqual(flagged_low, flagged_high)

    def test_random_state_reproducibility(self):
        d1 = AnomalyDetector(random_state=7).fit(_make_normal_data(100))
        d2 = AnomalyDetector(random_state=7).fit(_make_normal_data(100))
        scores1 = d1.score_samples(_make_normal_data(20, seed=3))
        scores2 = d2.score_samples(_make_normal_data(20, seed=3))
        np.testing.assert_array_almost_equal(scores1, scores2, decimal=10)


class TestAnomalyDetectorSaveLoad(unittest.TestCase):
    """Serialization round-trip (save → load)."""

    def test_save_and_load(self):
        import tempfile, os
        det = AnomalyDetector(random_state=42).fit(_make_normal_data())
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "model.joblib")
            det.save(path)

            loaded = AnomalyDetector(model_path=path)
            self.assertIsNotNone(loaded._model)

            X_test = _make_normal_data(20, seed=5)
            orig_results = det.detect(X_test)
            loaded_results = loaded.detect(X_test)
            self.assertEqual(
                [r.anomaly_label for r in orig_results],
                [r.anomaly_label for r in loaded_results],
            )

    def test_save_without_fit_raises(self):
        det = AnomalyDetector()
        with self.assertRaises(RuntimeError):
            det.save("/tmp/no_model.joblib")


class TestAnomalyDetectorWithDataFrame(unittest.TestCase):
    """Ensure DataFrame input works end-to-end."""

    def test_detect_with_dataframe(self):
        cols = ["feat_a", "feat_b", "feat_c", "feat_d"]
        df_train = pd.DataFrame(_make_normal_data(200), columns=cols)
        df_test = pd.DataFrame(_make_anomaly_data(10), columns=cols)

        det = AnomalyDetector(random_state=42).fit(df_train)
        results = det.detect(df_test)

        self.assertEqual(len(results), 10)
        self.assertTrue(all(isinstance(r, AnomalyResult) for r in results))


if __name__ == "__main__":
    unittest.main()
