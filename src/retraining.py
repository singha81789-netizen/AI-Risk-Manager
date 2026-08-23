"""
Controlled model retraining pipeline for the AI Risk Manager.

Collects confirmed analyst decisions as labeled data, builds a candidate
training dataset, retrains the fraud classifier, evaluates the candidate
against the current production model, and produces a comparison report.
The production model is **never** automatically replaced — a human must
review the comparison report and explicitly promote the candidate.

Design principles
-----------------
* **Separation from prediction API** — retraining runs offline; it
  never blocks or modifies the serving path.
* **No automatic replacement** — the candidate model is saved to a
  versioned directory; promotion requires manual approval.
* **Auditability** — every retraining run produces a comparison report
  with versioned artifact paths, metrics, and a clear recommendation.
* **Reproducibility** — random seeds, data sources, and hyperparameters
  are recorded in the report.

Usage::

    from src.retraining import ModelRetrainer

    retrainer = ModelRetrainer()
    report = retrainer.run_retraining()
    print(report.summary())
"""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from src.config import (
    ANOMALY_MODEL_FILE,
    DATETIME_COLUMN,
    DEFAULT_TEST_SIZE,
    FEATURE_IMPORTANCES_FILE,
    ID_COLUMNS,
    MODEL_FILE,
    MODEL_METRICS_FILE,
    MODEL_VERSION,
    MODELS_DIR,
    RANDOM_STATE,
    RF_CLASS_WEIGHT,
    RF_MAX_DEPTH,
    RF_MIN_SAMPLES_LEAF,
    RF_MIN_SAMPLES_SPLIT,
    RF_N_ESTIMATORS,
    RETRAINING_F1_IMPROVEMENT_THRESHOLD,
    RETRAINING_MAX_LABEL_FRACTION,
    RETRAINING_MIN_FRAUD_SAMPLES,
    RETRAINING_MIN_LABELED_SAMPLES,
    RETRAINING_REPORTS_DIR,
    RETRAINING_VERSIONS_DIR,
    TARGET_COLUMN,
    TEST_PROCESSED_FILE,
    TRAIN_PROCESSED_FILE,
)
from src.feature_engineering import (
    build_preprocessor,
    get_feature_names_from_preprocessor,
    run_preprocessing_pipeline,
)
from src.model_training import (
    evaluate_classification_performance,
    extract_feature_importances,
    load_processed_datasets,
    train_anomaly_detector,
    train_fraud_model,
)
from src.utils import ensure_directory, logger, load_artifact, save_artifact, save_json


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class LabeledDataset:
    """Confirmed labels collected from analyst reviews + transaction features.

    Attributes
    ----------
    raw_df :
        DataFrame with raw transaction columns + ``is_fraud`` target,
        ready for preprocessing.
    sample_count :
        Total number of confirmed samples.
    fraud_count :
        Number of confirmed fraud cases.
    source :
        Description of the data source (e.g. "analyst_reviews + transactions").
    """

    raw_df: pd.DataFrame
    sample_count: int = 0
    fraud_count: int = 0
    source: str = ""


@dataclass(frozen=True)
class MetricComparison:
    """Side-by-side comparison of a single metric between current and candidate."""

    metric_name: str
    current_value: float
    candidate_value: float
    difference: float
    improved: bool


@dataclass
class RetrainingReport:
    """Complete retraining comparison report.

    Attributes
    ----------
    generated_at :
        Timestamp of report generation.
    current_model_version :
        Version string of the production model.
    new_model_version :
        Version string assigned to the candidate.
    labeled_dataset_summary :
        Counts and source information for the labeled data used.
    current_metrics :
        Production model metrics (on held-out test set).
    candidate_metrics :
        Candidate model metrics (on the same held-out test set).
    metric_comparisons :
        Per-metric side-by-side comparison.
    candidate_model_path :
        Path where the candidate model artifact was saved.
    candidate_metrics_path :
        Path where the candidate metrics JSON was saved.
    overall_recommendation :
        ``"PROMOTE"`` if candidate is better, ``"HOLD"`` if not better,
        ``"REJECT"`` if candidate is worse, ``"INSUFFICIENT_DATA"`` if
        not enough labeled data.
    promotion_eligible :
        True if the candidate met all gates for promotion.
    reasons :
        Human-readable list of reasons for the recommendation.
    """

    generated_at: str = ""
    current_model_version: str = ""
    new_model_version: str = ""
    labeled_dataset_summary: Dict[str, Any] = field(default_factory=dict)
    current_metrics: Dict[str, Any] = field(default_factory=dict)
    candidate_metrics: Dict[str, Any] = field(default_factory=dict)
    metric_comparisons: List[MetricComparison] = field(default_factory=list)
    candidate_model_path: str = ""
    candidate_metrics_path: str = ""
    overall_recommendation: str = "HOLD"
    promotion_eligible: bool = False
    reasons: List[str] = field(default_factory=list)

    def summary(self) -> str:
        """Return a human-readable summary of the comparison report."""
        sep = "=" * 70
        sub = "-" * 70

        lines = [
            sep,
            " MODEL RETRAINING COMPARISON REPORT",
            f" Generated: {self.generated_at}",
            f" Current model version: {self.current_model_version}",
            f" Candidate model version: {self.new_model_version}",
            sep,
            "",
            " [LABELED DATA SUMMARY]",
            f"   Source: {self.labeled_dataset_summary.get('source', 'N/A')}",
            f"   Total confirmed samples: {self.labeled_dataset_summary.get('sample_count', 0):,}",
            f"   Fraud cases: {self.labeled_dataset_summary.get('fraud_count', 0):,}",
            "",
            " [METRIC COMPARISON]",
            f"   {'Metric':<25} {'Current':<14} {'Candidate':<14} {'Diff':<12} {'Status'}",
            f"   {sub[:70]}",
        ]

        for mc in self.metric_comparisons:
            status = "IMPROVED" if mc.improved else ("DEGRADED" if mc.difference < -0.001 else "SAME")
            lines.append(
                f"   {mc.metric_name:<25} {mc.current_value:<14.4f} "
                f"{mc.candidate_value:<14.4f} {mc.difference:<+12.4f} {status}"
            )

        lines.extend([
            "",
            f"   Candidate model saved to: {self.candidate_model_path}",
            f"   Candidate metrics saved to: {self.candidate_metrics_path}",
            "",
            sep,
            f" OVERALL RECOMMENDATION: {self.overall_recommendation}",
            f" Promotion eligible: {'YES' if self.promotion_eligible else 'NO'}",
        ])

        if self.reasons:
            lines.append("")
            lines.append(" Reasons:")
            for r in self.reasons:
                lines.append(f"   - {r}")

        lines.append(sep)
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Labeled data collection
# ---------------------------------------------------------------------------

def collect_confirmed_labels() -> LabeledDataset:
    """Collect confirmed analyst decisions from the database.

    Queries the ``analyst_reviews`` table for rows with decision
    ``CONFIRM_FRAUD`` or ``FALSE_POSITIVE``, then joins with the
    ``transactions`` table to retrieve the raw feature data needed
    for retraining.

    Returns
    -------
    LabeledDataset
        A DataFrame with raw transaction columns plus an ``is_fraud``
        target column, ready for preprocessing.

    Raises
    ------
    RuntimeError
        If the database is unavailable or returns no labeled data.
    """
    from src.database import get_db_session
    from src.models_db import AnalystReview, Transaction

    logger.info("Collecting confirmed analyst labels from database...")

    try:
        with get_db_session() as session:
            # Query confirmed reviews
            reviews = (
                session.query(AnalystReview)
                .filter(AnalystReview.decision.in_(["CONFIRM_FRAUD", "FALSE_POSITIVE"]))
                .all()
            )

            if not reviews:
                raise RuntimeError(
                    "No confirmed analyst labels found in the database. "
                    "Analysts must review transactions before retraining."
                )

            review_data = []
            txn_ids = set()
            for r in reviews:
                review_data.append({
                    "transaction_id": r.transaction_id,
                    "decision": r.decision,
                    "analyst_id": r.analyst_id,
                })
                txn_ids.add(r.transaction_id)

            logger.info(f"Found {len(reviews)} confirmed labels "
                         f"({sum(1 for r in reviews if r.decision == 'CONFIRM_FRAUD')} fraud, "
                         f"{sum(1 for r in reviews if r.decision == 'FALSE_POSITIVE')} legitimate)")

            # Query corresponding transactions
            transactions = (
                session.query(Transaction)
                .filter(Transaction.transaction_id.in_(txn_ids))
                .all()
            )

            if not transactions:
                raise RuntimeError(
                    f"No matching transactions found for {len(txn_ids)} confirmed labels."
                )

            txn_data = []
            for t in transactions:
                txn_data.append({
                    "transaction_id": t.transaction_id,
                    "customer_id": t.customer_id,
                    "merchant_id": t.merchant_id,
                    "timestamp": t.timestamp,
                    "age": t.age,
                    "gender": t.gender,
                    "merchant_category": t.merchant_category,
                    "amount": t.amount,
                    "transaction_type": t.transaction_type,
                    "card_type": t.card_type,
                    "card_present": t.card_present,
                    "device_type": t.device_type,
                    "distance_from_home": t.distance_from_home,
                    "distance_from_last_transaction": t.distance_from_last_transaction,
                    "high_risk_country": t.high_risk_country,
                    "velocity_last_24h": t.velocity_last_24h,
                })

    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(
            f"Database unavailable: {exc}. "
            "Cannot collect confirmed labels for retraining."
        ) from exc

    # Build labeled DataFrame
    df_reviews = pd.DataFrame(review_data)
    df_txns = pd.DataFrame(txn_data)

    df = df_txns.merge(df_reviews[["transaction_id", "decision"]], on="transaction_id", how="inner")

    # Map decisions to binary labels
    df[TARGET_COLUMN] = df["decision"].apply(lambda d: 1 if d == "CONFIRM_FRAUD" else 0)
    df = df.drop(columns=["decision"])

    fraud_count = int(df[TARGET_COLUMN].sum())
    logger.info(
        f"Built labeled dataset: {len(df)} samples, "
        f"{fraud_count} fraud ({fraud_count/len(df)*100:.1f}%)"
    )

    return LabeledDataset(
        raw_df=df,
        sample_count=len(df),
        fraud_count=fraud_count,
        source="analyst_reviews + transactions (CONFIRM_FRAUD / FALSE_POSITIVE)",
    )


# ---------------------------------------------------------------------------
# Candidate dataset builder
# ---------------------------------------------------------------------------

def build_candidate_dataset(
    labeled: LabeledDataset,
    original_train_path: Path = TRAIN_PROCESSED_FILE,
) -> Tuple[pd.DataFrame, pd.Series, pd.DataFrame, pd.Series]:
    """Build a candidate training dataset by combining original data with
    confirmed analyst labels.

    The confirmed labels are preprocessed using a freshly-fitted pipeline
    (to capture any new distribution patterns), then concatenated with the
    original training data.  The test set remains unchanged to provide a
    consistent evaluation baseline.

    Parameters
    ----------
    labeled :
        Confirmed analyst labels with raw features.
    original_train_path :
        Path to the original processed training CSV.

    Returns
    -------
    Tuple of (X_train_combined, y_train_combined, X_test, y_test)
        All DataFrames are in preprocessed feature space.
    """
    # Load original processed training data
    df_train_orig = pd.read_csv(original_train_path)
    y_train_orig = df_train_orig[TARGET_COLUMN].astype(int)
    X_train_orig = df_train_orig.drop(columns=[TARGET_COLUMN])

    logger.info(f"Original training set: {len(X_train_orig)} samples, "
                f"{int(y_train_orig.sum())} fraud")

    # Load test set (unchanged — consistent evaluation baseline)
    df_test = pd.read_csv(TEST_PROCESSED_FILE)
    y_test = df_test[TARGET_COLUMN].astype(int)
    X_test = df_test.drop(columns=[TARGET_COLUMN])

    # Preprocess the confirmed labels using a freshly-fitted pipeline
    labeled_df = labeled.raw_df.copy()
    if TARGET_COLUMN not in labeled_df.columns:
        raise ValueError("Labeled dataset must contain target column")

    X_labeled_raw = labeled_df.drop(columns=[TARGET_COLUMN])
    y_labeled = labeled_df[TARGET_COLUMN].astype(int)

    # Fit a fresh preprocessor on the combined raw data (original + labeled)
    # to ensure consistent feature space
    preprocessor = build_preprocessor()
    X_all_raw = pd.concat([X_train_orig, X_labeled_raw], ignore_index=True)
    # We need raw data for fitting — load original raw for the fit step
    from src.data_loader import load_and_clean_data
    original_raw = load_and_clean_data()
    # Use original raw as the fit base, but ensure labeled data fits too
    X_fit_raw = pd.concat([
        original_raw.drop(columns=[TARGET_COLUMN], errors="ignore"),
        X_labeled_raw,
    ], ignore_index=True)
    preprocessor.fit(X_fit_raw)

    # Transform the labeled data
    feature_names = get_feature_names_from_preprocessor(preprocessor, X_labeled_raw.head(1))
    X_labeled_transformed = pd.DataFrame(
        preprocessor.transform(X_labeled_raw),
        columns=feature_names,
    )

    # Combine original training + new labeled data
    X_combined = pd.concat([X_train_orig, X_labeled_transformed], ignore_index=True)
    y_combined = pd.concat([y_train_orig, y_labeled], ignore_index=True)

    logger.info(f"Combined training set: {len(X_combined)} samples, "
                f"{int(y_combined.sum())} fraud ({y_combined.mean()*100:.2f}%)")

    return X_combined, y_combined, X_test, y_test


# ---------------------------------------------------------------------------
# Model comparison
# ---------------------------------------------------------------------------

def _compare_metrics(
    current: Dict[str, Any],
    candidate: Dict[str, Any],
) -> List[MetricComparison]:
    """Compare current and candidate metrics side by side."""
    comparisons = []
    metric_keys = [
        "precision",
        "recall",
        "f1_score",
        "false_positive_rate",
        "accuracy",
        "roc_auc",
        "pr_auc",
    ]

    for key in metric_keys:
        curr_val = current.get(key, 0.0)
        cand_val = candidate.get(key, 0.0)
        diff = cand_val - curr_val

        # For FPR, lower is better; for all others, higher is better
        if key == "false_positive_rate":
            improved = diff < -0.001
        else:
            improved = diff > 0.001

        comparisons.append(MetricComparison(
            metric_name=key,
            current_value=round(curr_val, 6),
            candidate_value=round(cand_val, 6),
            difference=round(diff, 6),
            improved=improved,
        ))

    return comparisons


def _determine_recommendation(
    comparisons: List[MetricComparison],
    labeled_count: int,
    fraud_count: int,
) -> Tuple[str, bool, List[str]]:
    """Determine promotion recommendation based on metric comparisons."""
    reasons = []
    eligible = True

    # Check minimum data requirements
    if labeled_count < RETRAINING_MIN_LABELED_SAMPLES:
        reasons.append(
            f"Insufficient labeled data: {labeled_count} < "
            f"{RETRAINING_MIN_LABELED_SAMPLES} minimum"
        )
        return "INSUFFICIENT_DATA", False, reasons

    if fraud_count < RETRAINING_MIN_FRAUD_SAMPLES:
        reasons.append(
            f"Insufficient fraud cases: {fraud_count} < "
            f"{RETRAINING_MIN_FRAUD_SAMPLES} minimum"
        )
        return "INSUFFICIENT_DATA", False, reasons

    # Check if candidate is worse on any critical metric
    critical_degraded = []
    for mc in comparisons:
        if mc.metric_name in ("f1_score", "recall") and mc.difference < -0.01:
            critical_degraded.append(mc.metric_name)
            reasons.append(
                f"Critical metric '{mc.metric_name}' degraded by {abs(mc.difference):.4f}"
            )

    if critical_degraded:
        return "REJECT", False, reasons

    # Check F1 improvement threshold
    f1_comparison = next((mc for mc in comparisons if mc.metric_name == "f1_score"), None)
    if f1_comparison and f1_comparison.difference < RETRAINING_F1_IMPROVEMENT_THRESHOLD:
        reasons.append(
            f"F1 improvement ({f1_comparison.difference:+.4f}) below threshold "
            f"({RETRAINING_F1_IMPROVEMENT_THRESHOLD})"
        )
        eligible = False

    # Check if any critical metric improved
    improved = [mc for mc in comparisons if mc.improved]
    if improved:
        reasons.append(
            f"Improved metrics: {', '.join(mc.metric_name for mc in improved)}"
        )
        if eligible:
            return "PROMOTE", True, reasons
        else:
            return "HOLD", False, reasons
    else:
        reasons.append("No metrics improved over current model")
        return "HOLD", False, reasons


# ---------------------------------------------------------------------------
# Retrainer
# ---------------------------------------------------------------------------

class ModelRetrainer:
    """Controlled retraining pipeline that never auto-replaces the
    production model.

    Parameters
    ----------
    current_model_path :
        Path to the current production model.
    current_metrics_path :
        Path to the current model's metrics JSON.
    current_model_version :
        Version string of the current model.
    """

    def __init__(
        self,
        current_model_path: Path = MODEL_FILE,
        current_metrics_path: Path = MODEL_METRICS_FILE,
        current_model_version: str = MODEL_VERSION,
    ) -> None:
        self._current_model_path = current_model_path
        self._current_metrics_path = current_metrics_path
        self._current_version = current_model_version

    def _generate_new_version(self) -> str:
        """Generate a new version string by incrementing the minor version."""
        parts = self._current_version.split(".")
        if len(parts) == 3:
            major, minor, patch = parts
            return f"{major}.{int(minor) + 1}.0"
        return f"{self._current_version}.1"

    def _load_current_model(self) -> RandomForestClassifier:
        """Load the current production model."""
        if not self._current_model_path.exists():
            raise FileNotFoundError(
                f"Current model not found at {self._current_model_path}"
            )
        return load_artifact(self._current_model_path)

    def _load_current_metrics(self) -> Dict[str, Any]:
        """Load the current model's metrics."""
        if not self._current_metrics_path.exists():
            raise FileNotFoundError(
                f"Current metrics not found at {self._current_metrics_path}"
            )
        with open(self._current_metrics_path) as f:
            return json.load(f)

    def _save_candidate(
        self,
        model: RandomForestClassifier,
        metrics: Dict[str, Any],
        feature_names: List[str],
        version: str,
    ) -> Tuple[Path, Path]:
        """Save the candidate model and metrics to a versioned directory."""
        version_dir = RETRAINING_VERSIONS_DIR / version
        ensure_directory(version_dir)

        model_path = version_dir / "risk_model.pkl"
        metrics_path = version_dir / "model_metrics.json"
        importances_path = version_dir / "feature_importances.json"

        save_artifact(model, model_path)
        save_json(metrics, metrics_path)

        top_features = extract_feature_importances(model, feature_names, top_n=30)
        save_json({"top_features": top_features}, importances_path)

        logger.info(f"Candidate model saved to {version_dir}")
        return model_path, metrics_path

    def run_retraining(self) -> RetrainingReport:
        """Execute the full retraining workflow.

        Steps:
        1. Collect confirmed analyst labels from the database.
        2. Validate label quality and quantity.
        3. Build candidate training dataset (original + confirmed labels).
        4. Train a candidate model on the combined data.
        5. Evaluate the candidate on the held-out test set.
        6. Compare candidate metrics against the current production model.
        7. Save the candidate model separately (never replaces production).
        8. Generate and save a comparison report.
        """
        logger.info("=== Starting Controlled Model Retraining ===")

        new_version = self._generate_new_version()
        report = RetrainingReport(
            generated_at=datetime.now(timezone.utc).isoformat(),
            current_model_version=self._current_version,
            new_model_version=new_version,
        )

        # 1. Collect confirmed labels
        try:
            labeled = collect_confirmed_labels()
        except RuntimeError as exc:
            logger.warning(f"Cannot proceed with retraining: {exc}")
            report.overall_recommendation = "INSUFFICIENT_DATA"
            report.reasons = [str(exc)]
            return report

        report.labeled_dataset_summary = {
            "source": labeled.source,
            "sample_count": labeled.sample_count,
            "fraud_count": labeled.fraud_count,
            "fraud_ratio": round(labeled.fraud_count / max(labeled.sample_count, 1), 4),
        }

        # 2. Validate label quality
        if labeled.sample_count < RETRAINING_MIN_LABELED_SAMPLES:
            logger.warning(
                f"Only {labeled.sample_count} labeled samples "
                f"(minimum: {RETRAINING_MIN_LABELED_SAMPLES}). "
                f"Cannot retrain."
            )
            report.overall_recommendation = "INSUFFICIENT_DATA"
            report.reasons = [
                f"Insufficient labeled data: {labeled.sample_count} samples, "
                f"{RETRAINING_MIN_LABELED_SAMPLES} required"
            ]
            return report

        if labeled.fraud_count < RETRAINING_MIN_FRAUD_SAMPLES:
            logger.warning(
                f"Only {labeled.fraud_count} fraud cases "
                f"(minimum: {RETRAINING_MIN_FRAUD_SAMPLES}). "
                f"Cannot retrain."
            )
            report.overall_recommendation = "INSUFFICIENT_DATA"
            report.reasons = [
                f"Insufficient fraud cases: {labeled.fraud_count}, "
                f"{RETRAINING_MIN_FRAUD_SAMPLES} required"
            ]
            return report

        # 3. Build candidate dataset
        logger.info("Building candidate training dataset...")
        X_train, y_train, X_test, y_test = build_candidate_dataset(labeled)
        feature_names = list(X_train.columns)

        # 4. Train candidate model
        logger.info("Training candidate model...")
        candidate_model = train_fraud_model(X_train, y_train)

        # 5. Evaluate candidate
        logger.info("Evaluating candidate model...")
        candidate_test_metrics = evaluate_classification_performance(
            candidate_model, X_test, y_test, dataset_name="Candidate-Test"
        )
        candidate_train_metrics = evaluate_classification_performance(
            candidate_model, X_train, y_train, dataset_name="Candidate-Train"
        )
        report.candidate_metrics = candidate_test_metrics

        # 6. Load current metrics and compare
        current_metrics_data = self._load_current_metrics()
        current_test = current_metrics_data.get("test_metrics", {})
        report.current_metrics = current_test

        comparisons = _compare_metrics(current_test, candidate_test_metrics)
        report.metric_comparisons = comparisons

        # 7. Save candidate model (separate from production)
        candidate_model_path, candidate_metrics_path = self._save_candidate(
            candidate_model,
            {
                "trained_at": datetime.now(timezone.utc).isoformat(),
                "model_type": "RandomForestClassifier",
                "version": new_version,
                "based_on": self._current_version,
                "labeled_samples_used": labeled.sample_count,
                "hyperparameters": {
                    "n_estimators": RF_N_ESTIMATORS,
                    "max_depth": RF_MAX_DEPTH,
                    "min_samples_split": RF_MIN_SAMPLES_SPLIT,
                    "min_samples_leaf": RF_MIN_SAMPLES_LEAF,
                    "class_weight": RF_CLASS_WEIGHT,
                    "random_state": RANDOM_STATE,
                },
                "train_metrics": candidate_train_metrics,
                "test_metrics": candidate_test_metrics,
            },
            feature_names,
            new_version,
        )
        report.candidate_model_path = str(candidate_model_path)
        report.candidate_metrics_path = str(candidate_metrics_path)

        # 8. Determine recommendation
        recommendation, eligible, reasons = _determine_recommendation(
            comparisons, labeled.sample_count, labeled.fraud_count
        )
        report.overall_recommendation = recommendation
        report.promotion_eligible = eligible
        report.reasons = reasons

        # 9. Save comparison report
        self._save_report(report)

        logger.info(f"Retraining complete: {recommendation}")
        if eligible:
            logger.info(
                f"Candidate model v{new_version} is eligible for promotion. "
                f"To promote, copy {candidate_model_path} to {self._current_model_path}"
            )

        return report

    def _save_report(self, report: RetrainingReport) -> Path:
        """Save the retraining comparison report as JSON."""
        ensure_directory(RETRAINING_REPORTS_DIR)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = RETRAINING_REPORTS_DIR / f"retraining_report_{ts}.json"

        data = {
            "generated_at": report.generated_at,
            "current_model_version": report.current_model_version,
            "new_model_version": report.new_model_version,
            "labeled_dataset_summary": report.labeled_dataset_summary,
            "current_metrics": report.current_metrics,
            "candidate_metrics": report.candidate_metrics,
            "metric_comparisons": [
                {
                    "metric_name": mc.metric_name,
                    "current_value": mc.current_value,
                    "candidate_value": mc.candidate_value,
                    "difference": mc.difference,
                    "improved": mc.improved,
                }
                for mc in report.metric_comparisons
            ],
            "candidate_model_path": report.candidate_model_path,
            "candidate_metrics_path": report.candidate_metrics_path,
            "overall_recommendation": report.overall_recommendation,
            "promotion_eligible": report.promotion_eligible,
            "reasons": report.reasons,
        }

        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        logger.info(f"Retraining report saved to {path}")
        return path


def promote_candidate(
    candidate_version: str,
    current_model_path: Path = MODEL_FILE,
    current_metrics_path: Path = MODEL_METRICS_FILE,
) -> Path:
    """Promote a candidate model to production.

    This is the ONLY function that touches the production model path.
    It must be called explicitly after a human reviews the comparison
    report — it is never called automatically.

    Parameters
    ----------
    candidate_version :
        Version string of the candidate to promote (e.g. "1.1.0").
    current_model_path :
        Production model path to overwrite.
    current_metrics_path :
        Production metrics path to overwrite.

    Returns
    -------
    Path
        Path to the newly promoted model.

    Raises
    ------
    FileNotFoundError
        If the candidate version directory does not exist.
    """
    version_dir = RETRAINING_VERSIONS_DIR / candidate_version
    candidate_model = version_dir / "risk_model.pkl"
    candidate_metrics = version_dir / "model_metrics.json"

    if not candidate_model.exists():
        raise FileNotFoundError(
            f"Candidate model not found at {candidate_model}. "
            f"Cannot promote version {candidate_version}."
        )

    # Backup current model
    backup_dir = RETRAINING_VERSIONS_DIR / "backup"
    ensure_directory(backup_dir)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    if current_model_path.exists():
        backup_model = backup_dir / f"risk_model_backup_{ts}.pkl"
        shutil.copy2(current_model_path, backup_model)
        logger.info(f"Current model backed up to {backup_model}")

    if current_metrics_path.exists():
        backup_metrics = backup_dir / f"model_metrics_backup_{ts}.json"
        shutil.copy2(current_metrics_path, backup_metrics)
        logger.info(f"Current metrics backed up to {backup_metrics}")

    # Promote candidate
    shutil.copy2(candidate_model, current_model_path)
    if candidate_metrics.exists():
        shutil.copy2(candidate_metrics, current_metrics_path)

    logger.info(
        f"Candidate v{candidate_version} promoted to production. "
        f"Production model: {current_model_path}"
    )

    return current_model_path
