"""
Tests for feature engineering (Area 3).

Covers: TemporalFeatureExtractor, DomainFeatureExtractor, cyclical encodings,
domain features (log_amount, velocity, spatial), composite risk flags.
"""

import numpy as np
import pandas as pd
import pytest

from src.feature_engineering import DomainFeatureExtractor, TemporalFeatureExtractor


# ---------------------------------------------------------------------------
# TemporalFeatureExtractor
# ---------------------------------------------------------------------------

class TestTemporalFeatureExtractor:
    """Tests for time-based feature extraction."""

    def test_fit_returns_self(self):
        ext = TemporalFeatureExtractor()
        result = ext.fit(pd.DataFrame())
        assert result is ext

    def test_extracts_hour(self):
        df = pd.DataFrame({"timestamp": ["2026-01-15 14:30:00"]})
        ext = TemporalFeatureExtractor()
        result = ext.transform(df)
        assert "hour" in result.columns
        assert result["hour"].iloc[0] == 14

    def test_extracts_day_of_week(self):
        # 2026-01-15 is a Thursday (day_of_week=3)
        df = pd.DataFrame({"timestamp": ["2026-01-15 12:00:00"]})
        ext = TemporalFeatureExtractor()
        result = ext.transform(df)
        assert "day_of_week" in result.columns
        assert result["day_of_week"].iloc[0] == 3

    def test_weekend_detection(self):
        # 2026-01-17 is a Saturday
        df = pd.DataFrame({"timestamp": ["2026-01-17 12:00:00"]})
        ext = TemporalFeatureExtractor()
        result = ext.transform(df)
        assert result["is_weekend"].iloc[0] == 1

    def test_night_detection(self):
        df = pd.DataFrame({"timestamp": ["2026-01-15 03:00:00"]})
        ext = TemporalFeatureExtractor()
        result = ext.transform(df)
        assert result["is_night"].iloc[0] == 1

    def test_not_night_during_day(self):
        df = pd.DataFrame({"timestamp": ["2026-01-15 14:00:00"]})
        ext = TemporalFeatureExtractor()
        result = ext.transform(df)
        assert result["is_night"].iloc[0] == 0

    def test_business_hours_detection(self):
        df = pd.DataFrame({"timestamp": ["2026-01-15 10:00:00"]})
        ext = TemporalFeatureExtractor()
        result = ext.transform(df)
        assert result["is_business_hours"].iloc[0] == 1

    def test_not_business_hours_at_night(self):
        df = pd.DataFrame({"timestamp": ["2026-01-15 22:00:00"]})
        ext = TemporalFeatureExtractor()
        result = ext.transform(df)
        assert result["is_business_hours"].iloc[0] == 0

    def test_cyclical_sin_hour_range(self):
        df = pd.DataFrame({"timestamp": [f"2026-01-15 {h:02d}:00:00" for h in range(24)]})
        ext = TemporalFeatureExtractor()
        result = ext.transform(df)
        assert result["sin_hour"].between(-1, 1).all()

    def test_cyclical_cos_hour_range(self):
        df = pd.DataFrame({"timestamp": [f"2026-01-15 {h:02d}:00:00" for h in range(24)]})
        ext = TemporalFeatureExtractor()
        result = ext.transform(df)
        assert result["cos_hour"].between(-1, 1).all()

    def test_cyclical_day_of_week_range(self):
        df = pd.DataFrame({"timestamp": [f"2026-01-{d + 12:02d} 12:00:00" for d in range(7)]})
        ext = TemporalFeatureExtractor()
        result = ext.transform(df)
        assert result["sin_day_of_week"].between(-1, 1).all()
        assert result["cos_day_of_week"].between(-1, 1).all()

    def test_drops_timestamp_column(self):
        df = pd.DataFrame({"timestamp": ["2026-01-15 12:00:00"]})
        ext = TemporalFeatureExtractor()
        result = ext.transform(df)
        assert "timestamp" not in result.columns

    def test_missing_timestamp_defaults(self):
        df = pd.DataFrame({"amount": [100.0]})
        ext = TemporalFeatureExtractor()
        result = ext.transform(df)
        for col in ["hour", "day_of_week", "is_weekend", "is_night", "is_business_hours"]:
            assert col in result.columns

    def test_multiple_rows(self):
        df = pd.DataFrame({"timestamp": ["2026-01-15 03:00:00", "2026-01-15 14:00:00"]})
        ext = TemporalFeatureExtractor()
        result = ext.transform(df)
        assert len(result) == 2
        assert result["is_night"].iloc[0] == 1
        assert result["is_night"].iloc[1] == 0


# ---------------------------------------------------------------------------
# DomainFeatureExtractor
# ---------------------------------------------------------------------------

class TestDomainFeatureExtractor:
    """Tests for domain-specific financial feature extraction."""

    def test_fit_learns_thresholds(self):
        df = pd.DataFrame({
            "amount": np.arange(1, 101, dtype=float),
            "distance_from_home": np.arange(1, 101, dtype=float),
        })
        ext = DomainFeatureExtractor()
        ext.fit(df)
        assert ext.amount_threshold_ is not None
        assert ext.distance_home_threshold_ is not None

    def test_fit_returns_self(self):
        ext = DomainFeatureExtractor()
        result = ext.fit(pd.DataFrame({"amount": [100.0]}))
        assert result is ext

    def _base_df(self, n=1, **overrides):
        """Build a minimal DataFrame with all columns DomainFeatureExtractor needs."""
        import numpy as np
        rng = np.random.RandomState(42)
        defaults = {
            "amount": rng.exponential(100, n).tolist(),
            "age": rng.randint(18, 75, n).tolist(),
            "distance_from_home": rng.exponential(20, n).tolist(),
            "distance_from_last_transaction": rng.exponential(10, n).tolist(),
            "velocity_last_24h": rng.poisson(2, n).tolist(),
            "card_present": [1] * n,
            "transaction_type": ["POS"] * n,
            "high_risk_country": [0] * n,
            "is_night": [0] * n,
        }
        defaults.update(overrides)
        return pd.DataFrame(defaults)

    def test_log_amount(self):
        df = self._base_df(amount=[100.0])
        ext = DomainFeatureExtractor()
        ext.fit(df)
        result = ext.transform(df)
        assert "log_amount" in result.columns
        expected = np.log1p(100.0)
        assert abs(result["log_amount"].iloc[0] - expected) < 1e-10

    def test_is_high_amount(self):
        df = pd.DataFrame({
            "amount": [1000.0, 10.0, 500.0],
            "age": [30, 40, 50],
            "distance_from_home": [10.0, 5.0, 20.0],
            "distance_from_last_transaction": [5.0, 2.0, 10.0],
            "velocity_last_24h": [2, 1, 3],
            "card_present": [1, 1, 1],
            "transaction_type": ["POS", "POS", "POS"],
            "high_risk_country": [0, 0, 0],
            "is_night": [0, 0, 0],
        })
        ext = DomainFeatureExtractor(amount_high_quantile=0.5)
        ext.fit(df)
        result = ext.transform(df)
        assert "is_high_amount" in result.columns
        assert result["is_high_amount"].iloc[0] == 1  # 1000 >= median

    def test_is_round_amount(self):
        df = pd.DataFrame({
            "amount": [1000.0, 999.50, 500.0],
            "age": [30, 40, 50],
            "distance_from_home": [10.0, 5.0, 20.0],
            "distance_from_last_transaction": [5.0, 2.0, 10.0],
            "velocity_last_24h": [2, 1, 3],
            "card_present": [1, 1, 1],
            "transaction_type": ["POS", "POS", "POS"],
            "high_risk_country": [0, 0, 0],
            "is_night": [0, 0, 0],
        })
        ext = DomainFeatureExtractor()
        ext.fit(df)
        result = ext.transform(df)
        assert "is_round_amount" in result.columns
        assert result["is_round_amount"].iloc[0] == 1
        assert result["is_round_amount"].iloc[1] == 0
        assert result["is_round_amount"].iloc[2] == 1

    def test_amount_cents(self):
        df = self._base_df(amount=[100.75])
        ext = DomainFeatureExtractor()
        ext.fit(df)
        result = ext.transform(df)
        assert "amount_cents" in result.columns
        assert abs(result["amount_cents"].iloc[0] - 0.75) < 1e-10

    def test_amount_to_age_ratio(self):
        df = self._base_df(amount=[100.0], age=[49])
        ext = DomainFeatureExtractor()
        ext.fit(df)
        result = ext.transform(df)
        assert "amount_to_age_ratio" in result.columns
        expected = np.log1p(100.0) / (49.0 + 1.0)
        assert abs(result["amount_to_age_ratio"].iloc[0] - expected) < 1e-10

    def test_velocity_features(self):
        df = self._base_df(amount=[50.0], velocity_last_24h=[6])
        ext = DomainFeatureExtractor()
        ext.fit(df)
        result = ext.transform(df)
        assert "is_high_velocity" in result.columns
        assert result["is_high_velocity"].iloc[0] == 1

    def test_spatial_features(self):
        df = self._base_df(distance_from_home=[100.0], distance_from_last_transaction=[50.0])
        ext = DomainFeatureExtractor()
        ext.fit(df)
        result = ext.transform(df)
        assert "distance_total" in result.columns
        assert abs(result["distance_total"].iloc[0] - 150.0) < 1e-10
        assert "distance_ratio" in result.columns
        assert "is_far_from_home" in result.columns

    def test_missing_distance_from_last(self):
        df = self._base_df(distance_from_home=[10.0], distance_from_last_transaction=[np.nan])
        ext = DomainFeatureExtractor()
        ext.fit(df)
        result = ext.transform(df)
        assert result["distance_from_last_is_missing"].iloc[0] == 1

    def test_high_risk_channel(self):
        df = self._base_df(card_present=[0], transaction_type=["Online"])
        ext = DomainFeatureExtractor()
        ext.fit(df)
        result = ext.transform(df)
        assert "is_high_risk_channel" in result.columns
        assert result["is_high_risk_channel"].iloc[0] == 1

    def test_composite_risk_flag(self):
        df = self._base_df(card_present=[0], is_night=[1], high_risk_country=[1])
        ext = DomainFeatureExtractor()
        ext.fit(df)
        result = ext.transform(df)
        assert "composite_risk_flag" in result.columns
        assert result["composite_risk_flag"].iloc[0] == 1

    def test_composite_risk_not_triggered_when_card_present(self):
        df = self._base_df(card_present=[1], is_night=[1], high_risk_country=[1])
        ext = DomainFeatureExtractor()
        ext.fit(df)
        result = ext.transform(df)
        assert result["composite_risk_flag"].iloc[0] == 0

    def test_drops_id_columns(self):
        df = pd.DataFrame({
            "transaction_id": ["TXN_001"],
            "customer_id": ["CUST_001"],
            "merchant_id": ["MERCH_001"],
            "amount": [100.0],
            "age": [35],
            "distance_from_home": [10.0],
            "distance_from_last_transaction": [5.0],
            "velocity_last_24h": [2],
            "card_present": [1],
            "transaction_type": ["POS"],
            "high_risk_country": [0],
        })
        ext = DomainFeatureExtractor()
        ext.fit(df)
        result = ext.transform(df)
        assert "transaction_id" not in result.columns
        assert "customer_id" not in result.columns
        assert "merchant_id" not in result.columns

    def test_defaults_when_columns_missing(self):
        df = pd.DataFrame({
            "age": [30], "amount": [50.0],
            "distance_from_home": [5.0], "distance_from_last_transaction": [2.0],
            "velocity_last_24h": [1], "card_present": [1],
            "transaction_type": ["POS"], "high_risk_country": [0],
            "is_night": [0],
        })
        ext = DomainFeatureExtractor()
        ext.fit(df)
        result = ext.transform(df)
        assert "log_amount" in result.columns
        assert "is_high_velocity" in result.columns
