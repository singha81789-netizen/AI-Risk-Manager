"""
Model monitoring module for the AI Risk Manager.

Compares reference (training) data against recent production data to
detect performance degradation, prediction distribution shifts, and
feature distribution drift.  Generates structured reports that
clearly indicate when retraining may be required.

Design principles
-----------------
* **Separation from prediction API** — monitoring runs independently;
  it never blocks or modifies the serving path.
* **No automatic model replacement** — drift detections produce
  reports with severity levels; human review decides on retraining.
* **Reference vs production comparison** — baseline comes from the
  held-out test set; production data comes from the database of
  analyst-labeled predictions.

Usage::

    from src.model_monitoring import ModelMonitor

    monitor = ModelMonitor()
    report = monitor.run_full_monitoring()
    print(report.summary())
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy import stats

from src.config import (
    MONITORING_MIN_SAMPLES,
    MONITORING_REPORT_DIR,
    MONITORING_WINDOW_HOURS,
    MONITOR_F1_THRESHOLD,
    MONITOR_FEATURE_PSI_ALERT,
    MONITOR_FEATURE_PSI_WARN,
    MONITOR_FPR_THRESHOLD,
    MONITOR_KS_SIGNIFICANCE,
    MONITOR_PRECISION_THRESHOLD,
    MONITOR_PROBABILITY_DRIFT_THRESHOLD,
    MONITOR_RECALL_THRESHOLD,
    MONITOR_RISK_LEVEL_DRIFT_THRESHOLD,
    MODEL_VERSION,
    REFERENCE_DATA_FILE,
    REFERENCE_FEATURE_IMPORTANCES_FILE,
    REFERENCE_METRICS_FILE,
    TARGET_COLUMN,
)
from src.utils import ensure_directory, logger

# Type for analyst decisions that count as ground-truth fraud labels
_FRAUD_DECISIONS = {"CONFIRM_FRAUD"}
_LEGITIMATE_DECISIONS = {"FALSE_POSITIVE"}


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class DriftIndicator:
    """A single drift检测 result for one metric or feature.

    Attributes
    ----------
    name:
        Metric or feature name.
    reference_value:
        Baseline (training/test) value.
    production_value:
        Current production value.
    difference:
        ``production_value - reference_value``.
    severity:
        ``"OK"``, ``"WARNING"``, or ``"ALERT"``.
    message:
        Human-readable explanation.
    """

    name: str
    reference_value: float
    production_value: float
    difference: float
    severity: str
    message: str


@dataclass
class MonitoringReport:
    """Complete monitoring report comparing reference vs production.

    Attributes
    ----------
    generated_at:
        Timestamp of report generation.
    model_version:
        Version string of the monitored model.
    reference_sample_count:
        Number of samples in the reference dataset.
    production_sample_count:
        Number of production samples analysed.
    performance_metrics:
        Current production precision, recall, F1, FPR.
    reference_metrics:
        Baseline training/test metrics.
    performance_drifts:
        Drift indicators for each performance metric.
    prediction_distribution:
        Summary of production prediction probability distribution.
    prediction_distribution_drift:
        PSI-based drift indicator for prediction distribution.
    feature_drifts:
        Per-feature drift indicators (PSI + KS test).
    risk_level_distribution:
        Production risk level breakdown.
    risk_level_drift:
        Drift indicator for HIGH-risk proportion.
    overall_severity:
        Worst severity across all checks.
    retrain_recommended:
        True if any ALERT-level drift detected.
    retrain_reasons:
        List of human-readable reasons why retraining is recommended.
    """

    generated_at: str = ""
    model_version: str = ""
    reference_sample_count: int = 0
    production_sample_count: int = 0
    performance_metrics: Dict[str, float] = field(default_factory=dict)
    reference_metrics: Dict[str, float] = field(default_factory=dict)
    performance_drifts: List[DriftIndicator] = field(default_factory=list)
    prediction_distribution: Dict[str, float] = field(default_factory=dict)
    prediction_distribution_drift: Optional[DriftIndicator] = None
    feature_drifts: List[DriftIndicator] = field(default_factory=list)
    risk_level_distribution: Dict[str, int] = field(default_factory=dict)
    risk_level_drift: Optional[DriftIndicator] = None
    overall_severity: str = "OK"
    retrain_recommended: bool = False
    retrain_reasons: List[str] = field(default_factory=list)

    def summary(self) -> str:
        """Return a human-readable summary of the report."""
        lines = [
            "=" * 70,
            " MODEL MONITORING REPORT",
            f" Generated: {self.generated_at}",
            f" Model version: {self.model_version}",
            f" Reference samples: {self.reference_sample_count:,}",
            f" Production samples: {self.production_sample_count:,}",
            "=" * 70,
            "",
            " [PERFORMANCE METRICS]",
        ]
        for name, val in self.performance_metrics.items():
            ref = self.reference_metrics.get(name, 0.0)
            diff = val - ref
            lines.append(f"   {name:<20} ref={ref:.4f}  prod={val:.4f}  diff={diff:+.4f}")

        lines.append("")
        lines.append(" [PERFORMANCE DRIFTS]")
        for d in self.performance_drifts:
            lines.append(f"   [{d.severity:<7}] {d.message}")

        lines.append("")
        lines.append(" [PREDICTION DISTRIBUTION]")
        pd_dist = self.prediction_distribution
        lines.append(f"   mean={pd_dist.get('mean', 0):.4f}  "
                      f"std={pd_dist.get('std', 0):.4f}  "
                      f"min={pd_dist.get('min', 0):.4f}  "
                      f"max={pd_dist.get('max', 0):.4f}")
        if self.prediction_distribution_drift:
            d = self.prediction_distribution_drift
            lines.append(f"   [{d.severity}] {d.message}")

        lines.append("")
        lines.append(" [RISK LEVEL DISTRIBUTION]")
        for level, count in sorted(self.risk_level_distribution.items()):
            pct = count / max(self.production_sample_count, 1) * 100
            lines.append(f"   {level:<10} {count:>6} ({pct:.1f}%)")
        if self.risk_level_drift:
            d = self.risk_level_drift
            lines.append(f"   [{d.severity}] {d.message}")

        lines.append("")
        lines.append(" [FEATURE DRIFT]")
        alerts = [d for d in self.feature_drifts if d.severity == "ALERT"]
        warnings = [d for d in self.feature_drifts if d.severity == "WARNING"]
        if alerts:
            lines.append(f"   {len(alerts)} features with ALERT-level drift:")
            for d in alerts:
                lines.append(f"     [{d.severity}] {d.message}")
        if warnings:
            lines.append(f"   {len(warnings)} features with WARNING-level drift:")
            for d in warnings[:5]:
                lines.append(f"     [{d.severity}] {d.message}")
            if len(warnings) > 5:
                lines.append(f"     ... and {len(warnings) - 5} more")
        if not alerts and not warnings:
            lines.append("   No significant feature distribution shifts detected.")

        lines.append("")
        lines.append("=" * 70)
        lines.append(f" OVERALL SEVERITY: {self.overall_severity}")
        if self.retrain_recommended:
            lines.append(" *** RETRAINING RECOMMENDED ***")
            for reason in self.retrain_reasons:
                lines.append(f"   - {reason}")
        else:
            lines.append(" Model performance is within acceptable bounds.")
        lines.append("=" * 70)
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Statistical helpers
# ---------------------------------------------------------------------------

def _population_stability_index(
    reference: np.ndarray,
    production: np.ndarray,
    n_bins: int = 10,
    eps: float = 1e-6,
) -> float:
    """Compute the Population Stability Index (PSI) between two distributions.

    PSI < 0.10  => no significant shift
    PSI 0.10–0.20 => moderate shift (warning)
    PSI > 0.20 => significant shift (alert)

    Parameters
    ----------
    reference :
        Baseline feature values.
    production :
        Current production feature values.
    n_bins :
        Number of bins for discretisation.
    eps :
        Small constant to avoid division by zero.
    """
    ref = np.asarray(reference, dtype=float)
    prod = np.asarray(production, dtype=float)

    # Use combined range for bin edges
    combined = np.concatenate([ref, prod])
    bins = np.linspace(combined.min(), combined.max(), n_bins + 1)

    ref_counts, _ = np.histogram(ref, bins=bins)
    prod_counts, _ = np.histogram(prod, bins=bins)

    ref_pct = ref_counts / ref_counts.sum() + eps
    prod_pct = prod_counts / prod_counts.sum() + eps

    psi = float(np.sum((prod_pct - ref_pct) * np.log(prod_pct / ref_pct)))
    return psi


def _ks_test(reference: np.ndarray, production: np.ndarray) -> Tuple[float, float]:
    """Two-sample Kolmogorov-Smirnov test.

    Returns (statistic, p-value).
    """
    result = stats.ks_2samp(reference, production)
    return float(result.statistic), float(result.pvalue)


def _severity_from_psi(psi: float) -> str:
    if psi >= MONITOR_FEATURE_PSI_ALERT:
        return "ALERT"
    if psi >= MONITOR_FEATURE_PSI_WARN:
        return "WARNING"
    return "OK"


# ---------------------------------------------------------------------------
# Reference data loader
# ---------------------------------------------------------------------------

@dataclass
class ReferenceData:
    """Baseline data loaded from training artifacts."""

    metrics: Dict[str, Any] = field(default_factory=dict)
    feature_importances: List[Dict[str, Any]] = field(default_factory=list)
    feature_names: List[str] = field(default_factory=list)
    features_df: Optional[pd.DataFrame] = None
    sample_count: int = 0

    @classmethod
    def load(
        cls,
        metrics_path: Path = REFERENCE_METRICS_FILE,
        importances_path: Path = REFERENCE_FEATURE_IMPORTANCES_FILE,
        features_path: Path = REFERENCE_DATA_FILE,
    ) -> "ReferenceData":
        """Load reference data from disk."""
        ref = cls()

        # Load training metrics
        if metrics_path.exists():
            with open(metrics_path) as f:
                all_metrics = json.load(f)
            ref.metrics = all_metrics.get("test_metrics", all_metrics.get("train_metrics", {}))
            logger.info(f"Loaded reference metrics from {metrics_path}")

        # Load feature importances
        if importances_path.exists():
            with open(importances_path) as f:
                data = json.load(f)
            ref.feature_importances = data.get("top_features", [])
            logger.info(f"Loaded {len(ref.feature_importances)} feature importances")

        # Load reference feature distributions (test set)
        if features_path.exists():
            df = pd.read_csv(features_path)
            if TARGET_COLUMN in df.columns:
                df = df.drop(columns=[TARGET_COLUMN])
            ref.features_df = df
            ref.feature_names = list(df.columns)
            ref.sample_count = len(df)
            logger.info(f"Loaded reference features: {df.shape}")

        return ref


# ---------------------------------------------------------------------------
# Production data collector
# ---------------------------------------------------------------------------

@dataclass
class ProductionData:
    """Data collected from production predictions and analyst reviews."""

    predictions: Optional[pd.DataFrame] = None
    reviews: Optional[pd.DataFrame] = None
    labeled: Optional[pd.DataFrame] = None  # predictions joined with analyst labels
    sample_count: int = 0

    @classmethod
    def collect(cls, window_hours: int = MONITORING_WINDOW_HOURS) -> "ProductionData":
        """Collect recent production data from the database.

        Falls back to empty DataFrames if the database is unavailable.
        """
        prod = cls()

        try:
            from src.database import get_db_session
            from src.models_db import AnalystReview, RiskPrediction

            cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)

            with get_db_session() as session:
                # Pull recent predictions
                pred_rows = (
                    session.query(RiskPrediction)
                    .filter(RiskPrediction.created_at >= cutoff)
                    .all()
                )
                if pred_rows:
                    prod.predictions = pd.DataFrame([
                        {
                            "transaction_id": r.transaction_id,
                            "fraud_probability": r.fraud_probability,
                            "risk_score": r.risk_score,
                            "risk_level": r.risk_level,
                            "prediction": r.prediction,
                            "model_version": r.model_version,
                            "created_at": r.created_at,
                        }
                        for r in pred_rows
                    ])

                # Pull recent analyst reviews
                review_rows = (
                    session.query(AnalystReview)
                    .filter(AnalystReview.created_at >= cutoff)
                    .all()
                )
                if review_rows:
                    prod.reviews = pd.DataFrame([
                        {
                            "transaction_id": r.transaction_id,
                            "analyst_id": r.analyst_id,
                            "decision": r.decision,
                            "ai_fraud_probability": r.ai_fraud_probability,
                            "ai_risk_score": r.ai_risk_score,
                            "ai_risk_level": r.ai_risk_level,
                            "ai_decision": r.ai_decision,
                            "model_version": r.model_version,
                            "created_at": r.created_at,
                        }
                        for r in review_rows
                    ])

            # Join predictions with reviews on transaction_id
            if prod.predictions is not None and prod.reviews is not None:
                prod.labeled = prod.predictions.merge(
                    prod.reviews[["transaction_id", "decision"]],
                    on="transaction_id",
                    how="inner",
                )
                # Map analyst decisions to binary labels
                prod.labeled["true_label"] = prod.labeled["decision"].apply(
                    lambda d: 1 if d in _FRAUD_DECISIONS else 0
                )

            prod.sample_count = len(prod.predictions) if prod.predictions is not None else 0
            logger.info(
                f"Collected {prod.sample_count} production predictions, "
                f"{len(prod.reviews) if prod.reviews is not None else 0} analyst reviews, "
                f"{len(prod.labeled) if prod.labeled is not None else 0} labeled samples"
            )

        except Exception as exc:
            logger.warning(f"Could not collect production data from DB: {exc}")
            logger.info("Monitoring will run with empty production data.")

        return prod


# ---------------------------------------------------------------------------
# Performance evaluator
# ---------------------------------------------------------------------------

def _compute_performance_metrics(labeled_df: pd.DataFrame) -> Dict[str, float]:
    """Compute precision, recall, F1, and FPR from labeled production data.

    Expects columns: ``fraud_probability`` and ``true_label`` (0 or 1).
    Uses threshold 0.5 for binary classification (consistent with training).
    """
    if labeled_df is None or len(labeled_df) == 0:
        return {}

    y_true = labeled_df["true_label"].values
    y_prob = labeled_df["fraud_probability"].values
    y_pred = (y_prob >= 0.5).astype(int)

    tp = int(np.sum((y_pred == 1) & (y_true == 1)))
    fp = int(np.sum((y_pred == 1) & (y_true == 0)))
    fn = int(np.sum((y_pred == 0) & (y_true == 1)))
    tn = int(np.sum((y_pred == 0) & (y_true == 0)))

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    return {
        "precision": round(precision, 6),
        "recall": round(recall, 6),
        "f1_score": round(f1, 6),
        "false_positive_rate": round(fpr, 6),
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "true_negatives": tn,
        "labeled_samples": len(labeled_df),
    }


# ---------------------------------------------------------------------------
# Main monitor class
# ---------------------------------------------------------------------------

class ModelMonitor:
    """Orchestrates model monitoring: reference loading, production
    collection, drift detection, and report generation.

    Parameters
    ----------
    reference :
        Pre-loaded reference data.  Loaded from disk if not provided.
    """

    def __init__(self, reference: Optional[ReferenceData] = None) -> None:
        self._reference = reference or ReferenceData.load()

    def _check_performance_drift(
        self, prod_metrics: Dict[str, float]
    ) -> List[DriftIndicator]:
        """Compare production performance against reference thresholds."""
        ref = self._reference.metrics
        indicators = []

        metric_checks = [
            ("precision", MONITOR_PRECISION_THRESHOLD, "drop"),
            ("recall", MONITOR_RECALL_THRESHOLD, "drop"),
            ("f1_score", MONITOR_F1_THRESHOLD, "drop"),
            ("false_positive_rate", MONITOR_FPR_THRESHOLD, "increase"),
        ]

        for metric_name, threshold, direction in metric_checks:
            ref_val = ref.get(metric_name, 0.0)
            prod_val = prod_metrics.get(metric_name, 0.0)
            diff = prod_val - ref_val

            if direction == "drop":
                is_drift = diff < -threshold
                msg = (
                    f"{metric_name}: ref={ref_val:.4f}, prod={prod_val:.4f}, "
                    f"drop={abs(diff):.4f} (threshold={threshold})"
                )
            else:  # increase
                is_drift = diff > threshold
                msg = (
                    f"{metric_name}: ref={ref_val:.4f}, prod={prod_val:.4f}, "
                    f"increase={diff:.4f} (threshold={threshold})"
                )

            severity = "ALERT" if is_drift else "OK"
            indicators.append(DriftIndicator(
                name=metric_name,
                reference_value=ref_val,
                production_value=prod_val,
                difference=diff,
                severity=severity,
                message=msg,
            ))

        return indicators

    def _check_prediction_distribution(
        self, predictions: pd.DataFrame
    ) -> Tuple[Dict[str, float], Optional[DriftIndicator]]:
        """Analyse the distribution of prediction probabilities."""
        if predictions is None or len(predictions) == 0:
            return {}, None

        probs = predictions["fraud_probability"].values
        dist = {
            "mean": round(float(np.mean(probs)), 4),
            "std": round(float(np.std(probs)), 4),
            "min": round(float(np.min(probs)), 4),
            "max": round(float(np.max(probs)), 4),
            "median": round(float(np.median(probs)), 4),
            "p25": round(float(np.percentile(probs, 25)), 4),
            "p75": round(float(np.percentile(probs, 75)), 4),
        }

        # Compare against reference metrics if available
        ref_fpr = self._reference.metrics.get("false_positive_rate", 0.0)
        ref_fnr = self._reference.metrics.get("false_negative_rate", 0.0)
        # Expected fraud rate from reference = FP rate + TP rate (approx)
        # Use reference confusion matrix to estimate expected prediction mean
        ref_cm = self._reference.metrics.get("confusion_matrix", {})
        ref_tp = ref_cm.get("true_positives", 0)
        ref_fp = ref_cm.get("false_positives", 0)
        ref_total = self._reference.metrics.get("sample_count", 1)
        expected_fraud_rate = (ref_tp + ref_fp) / max(ref_total, 1)

        prod_fraud_rate = float(np.mean(probs))
        psi = _population_stability_index(
            np.full(1000, expected_fraud_rate),
            probs,
            n_bins=10,
        )

        severity = _severity_from_psi(psi)
        msg = (
            f"Prediction distribution PSI={psi:.4f} "
            f"(ref fraud_rate≈{expected_fraud_rate:.4f}, "
            f"prod mean={prod_fraud_rate:.4f})"
        )
        drift = DriftIndicator(
            name="prediction_distribution",
            reference_value=expected_fraud_rate,
            production_value=prod_fraud_rate,
            difference=prod_fraud_rate - expected_fraud_rate,
            severity=severity,
            message=msg,
        )

        return dist, drift

    def _check_risk_level_distribution(
        self, predictions: pd.DataFrame
    ) -> Tuple[Dict[str, int], Optional[DriftIndicator]]:
        """Check if the proportion of HIGH-risk predictions has shifted."""
        if predictions is None or len(predictions) == 0:
            return {}, None

        level_counts = predictions["risk_level"].value_counts().to_dict()
        total = len(predictions)
        high_count = level_counts.get("HIGH", 0)
        high_pct = high_count / total

        # Reference: from training confusion matrix, estimate expected HIGH proportion
        ref_cm = self._reference.metrics.get("confusion_matrix", {})
        ref_tp = ref_cm.get("true_positives", 0)
        ref_fn = ref_cm.get("false_negatives", 0)
        ref_total = self._reference.metrics.get("sample_count", 1)
        ref_high_rate = (ref_tp + ref_fn) / max(ref_total, 1)

        diff = high_pct - ref_high_rate
        is_drift = abs(diff) > MONITOR_RISK_LEVEL_DRIFT_THRESHOLD
        severity = "WARNING" if is_drift else "OK"
        msg = (
            f"HIGH-risk proportion: ref≈{ref_high_rate:.4f}, "
            f"prod={high_pct:.4f}, diff={diff:+.4f}"
        )

        return level_counts, DriftIndicator(
            name="high_risk_proportion",
            reference_value=ref_high_rate,
            production_value=high_pct,
            difference=diff,
            severity=severity,
            message=msg,
        )

    def _check_feature_drift(self, prod_features: Optional[pd.DataFrame]) -> List[DriftIndicator]:
        """Compare feature distributions between reference and production.

        Uses PSI and KS test on the top important features.
        """
        if prod_features is None or len(prod_features) == 0:
            return []

        if self._reference.features_df is None:
            return []

        indicators = []

        # Monitor top features by importance (up to 15)
        important_features = [
            fi["feature"] for fi in self._reference.feature_importances[:15]
        ]

        for feat_name in important_features:
            if feat_name not in self._reference.features_df.columns:
                continue
            if feat_name not in prod_features.columns:
                continue

            ref_vals = self._reference.features_df[feat_name].dropna().values
            prod_vals = prod_features[feat_name].dropna().values

            if len(ref_vals) == 0 or len(prod_vals) == 0:
                continue

            psi = _population_stability_index(ref_vals, prod_vals, n_bins=10)
            ks_stat, ks_pval = _ks_test(ref_vals, prod_vals)

            severity = _severity_from_psi(psi)
            if severity == "OK" and ks_pval < MONITOR_KS_SIGNIFICANCE:
                severity = "WARNING"

            drifted = ks_pval < MONITOR_KS_SIGNIFICANCE
            msg = (
                f"{feat_name}: PSI={psi:.4f}, KS_stat={ks_stat:.4f}, "
                f"KS_p={ks_pval:.4f}"
            )

            indicators.append(DriftIndicator(
                name=feat_name,
                reference_value=round(float(np.mean(ref_vals)), 4),
                production_value=round(float(np.mean(prod_vals)), 4),
                difference=round(float(np.mean(prod_vals) - np.mean(ref_vals)), 4),
                severity=severity,
                message=msg,
            ))

        return indicators

    def run_full_monitoring(self) -> MonitoringReport:
        """Execute the full monitoring workflow and return a report.

        Steps:
        1. Load reference data (training baseline).
        2. Collect recent production data from the database.
        3. Compute production performance metrics (if labeled data available).
        4. Check performance drift against thresholds.
        5. Analyse prediction distribution.
        6. Analyse risk level distribution.
        7. Check feature distribution drift.
        8. Determine overall severity and retraining recommendation.
        """
        logger.info("=== Starting Model Monitoring ===")

        report = MonitoringReport(
            generated_at=datetime.now(timezone.utc).isoformat(),
            model_version=MODEL_VERSION,
            reference_sample_count=self._reference.sample_count,
        )

        # 1. Collect production data
        prod = ProductionData.collect()
        report.production_sample_count = prod.sample_count

        if prod.sample_count < MONITORING_MIN_SAMPLES:
            logger.warning(
                f"Only {prod.sample_count} production samples "
                f"(minimum {MONITORING_MIN_SAMPLES} required). "
                f"Monitoring report will be limited."
            )

        # 2. Performance metrics (requires labeled data)
        if prod.labeled is not None and len(prod.labeled) > 0:
            prod_metrics = _compute_performance_metrics(prod.labeled)
            report.performance_metrics = prod_metrics
            report.reference_metrics = {
                "precision": self._reference.metrics.get("precision", 0.0),
                "recall": self._reference.metrics.get("recall", 0.0),
                "f1_score": self._reference.metrics.get("f1_score", 0.0),
                "false_positive_rate": self._reference.metrics.get("false_positive_rate", 0.0),
            }
            report.performance_drifts = self._check_performance_drift(prod_metrics)
        else:
            logger.info("No labeled production data available — skipping performance drift check.")

        # 3. Prediction distribution
        if prod.predictions is not None and len(prod.predictions) > 0:
            dist, drift = self._check_prediction_distribution(prod.predictions)
            report.prediction_distribution = dist
            report.prediction_distribution_drift = drift

            # 4. Risk level distribution
            levels, level_drift = self._check_risk_level_distribution(prod.predictions)
            report.risk_level_distribution = levels
            report.risk_level_drift = level_drift

        # 5. Feature drift (if production features are available)
        # Note: production features require raw transaction data to be
        # stored alongside predictions.  If only DB-stored predictions
        # are available, this step is skipped.
        if prod.predictions is not None and len(prod.predictions) > 0:
            report.feature_drifts = self._check_feature_drift(None)

        # 6. Determine overall severity
        all_severities = (
            [d.severity for d in report.performance_drifts]
            + ([report.prediction_distribution_drift.severity]
               if report.prediction_distribution_drift else [])
            + ([report.risk_level_drift.severity]
               if report.risk_level_drift else [])
            + [d.severity for d in report.feature_drifts]
        )

        if "ALERT" in all_severities:
            report.overall_severity = "ALERT"
        elif "WARNING" in all_severities:
            report.overall_severity = "WARNING"
        else:
            report.overall_severity = "OK"

        # 7. Retraining recommendation
        retrain_reasons = []
        for d in report.performance_drifts:
            if d.severity == "ALERT":
                retrain_reasons.append(
                    f"Performance metric '{d.name}' has degraded beyond threshold"
                )
        if report.prediction_distribution_drift and report.predification_distribution_drift.severity == "ALERT":
            retrain_reasons.append("Prediction distribution has shifted significantly (PSI > 0.20)")
        if report.risk_level_drift and report.risk_level_drift.severity == "ALERT":
            retrain_reasons.append("HIGH-risk prediction proportion has shifted significantly")
        for d in report.feature_drifts:
            if d.severity == "ALERT":
                retrain_reasons.append(f"Feature '{d.name}' distribution has drifted (PSI > 0.20)")

        report.retrain_recommended = len(retrain_reasons) > 0
        report.retrain_reasons = retrain_reasons

        logger.info(
            f"Monitoring complete: severity={report.overall_severity}, "
            f"retrain={'YES' if report.retrain_recommended else 'NO'}"
        )

        return report

    def save_report(self, report: MonitoringReport, path: Optional[Path] = None) -> Path:
        """Save the monitoring report as JSON."""
        if path is None:
            ensure_directory(MONITORING_REPORT_DIR)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            path = MONITORING_REPORT_DIR / f"monitoring_report_{ts}.json"

        data = {
            "generated_at": report.generated_at,
            "model_version": report.model_version,
            "reference_sample_count": report.reference_sample_count,
            "production_sample_count": report.production_sample_count,
            "performance_metrics": report.performance_metrics,
            "reference_metrics": report.reference_metrics,
            "performance_drifts": [
                {
                    "name": d.name,
                    "reference_value": d.reference_value,
                    "production_value": d.production_value,
                    "difference": d.difference,
                    "severity": d.severity,
                    "message": d.message,
                }
                for d in report.performance_drifts
            ],
            "prediction_distribution": report.prediction_distribution,
            "prediction_distribution_drift": (
                {
                    "name": report.prediction_distribution_drift.name,
                    "severity": report.prediction_distribution_drift.severity,
                    "message": report.prediction_distribution_drift.message,
                }
                if report.prediction_distribution_drift else None
            ),
            "feature_drifts": [
                {
                    "name": d.name,
                    "reference_value": d.reference_value,
                    "production_value": d.production_value,
                    "difference": d.difference,
                    "severity": d.severity,
                    "message": d.message,
                }
                for d in report.feature_drifts
            ],
            "risk_level_distribution": report.risk_level_distribution,
            "risk_level_drift": (
                {
                    "name": report.risk_level_drift.name,
                    "severity": report.risk_level_drift.severity,
                    "message": report.risk_level_drift.message,
                }
                if report.risk_level_drift else None
            ),
            "overall_severity": report.overall_severity,
            "retrain_recommended": report.retrain_recommended,
            "retrain_reasons": report.retrain_reasons,
        }

        ensure_directory(path.parent)
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        logger.info(f"Monitoring report saved to {path}")
        return path
