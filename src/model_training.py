"""
Model training, evaluation, and serialization pipeline for AI Risk Manager.
Trains a balanced RandomForest baseline classifier, evaluates multi-dimensional risk metrics,
and saves model artifacts for production inference.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from src.config import (
    ANOMALY_MODEL_FILE,
    FEATURE_IMPORTANCES_FILE,
    MODEL_FILE,
    MODEL_METRICS_FILE,
    MODELS_DIR,
    RANDOM_STATE,
    RF_CLASS_WEIGHT,
    RF_MAX_DEPTH,
    RF_MIN_SAMPLES_LEAF,
    RF_MIN_SAMPLES_SPLIT,
    RF_N_ESTIMATORS,
    TARGET_COLUMN,
    TEST_PROCESSED_FILE,
    TRAIN_PROCESSED_FILE,
)
from src.feature_engineering import run_preprocessing_pipeline
from src.utils import ensure_directory, logger, save_artifact, save_json


def load_processed_datasets(
    train_path: Union[str, Path] = TRAIN_PROCESSED_FILE,
    test_path: Union[str, Path] = TEST_PROCESSED_FILE,
) -> Tuple[pd.DataFrame, pd.Series, pd.DataFrame, pd.Series]:
    """
    Loads preprocessed training and test datasets.
    If not already generated, runs the preprocessing pipeline first.
    
    Returns:
        Tuple[pd.DataFrame, pd.Series, pd.DataFrame, pd.Series]: (X_train, y_train, X_test, y_test)
    """
    train_p = Path(train_path)
    test_p = Path(test_path)
    
    if not train_p.exists() or not test_p.exists():
        logger.info("Processed datasets not found. Executing preprocessing pipeline...")
        run_preprocessing_pipeline()
        
    logger.info(f"Loading processed datasets from {train_p.parent.resolve()}")
    df_train = pd.read_csv(train_p)
    df_test = pd.read_csv(test_p)
    
    if TARGET_COLUMN not in df_train.columns or TARGET_COLUMN not in df_test.columns:
        raise KeyError(f"Target column '{TARGET_COLUMN}' missing from processed datasets.")
        
    X_train = df_train.drop(columns=[TARGET_COLUMN])
    y_train = df_train[TARGET_COLUMN].astype(int)
    
    X_test = df_test.drop(columns=[TARGET_COLUMN])
    y_test = df_test[TARGET_COLUMN].astype(int)
    
    logger.info(f"Loaded X_train: {X_train.shape}, y_train: {y_train.shape} (Fraud: {int(y_train.sum()):,})")
    logger.info(f"Loaded X_test: {X_test.shape}, y_test: {y_test.shape} (Fraud: {int(y_test.sum()):,})")
    return X_train, y_train, X_test, y_test


def train_fraud_model(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    n_estimators: int = RF_N_ESTIMATORS,
    max_depth: int = RF_MAX_DEPTH,
    min_samples_split: int = RF_MIN_SAMPLES_SPLIT,
    min_samples_leaf: int = RF_MIN_SAMPLES_LEAF,
    class_weight: str = RF_CLASS_WEIGHT,
    random_state: int = RANDOM_STATE,
) -> RandomForestClassifier:
    """
    Trains a balanced RandomForestClassifier baseline model on the preprocessed training set.
    
    Args:
        X_train: Preprocessed feature matrix.
        y_train: Target labels.
        n_estimators: Number of decision trees.
        max_depth: Maximum tree depth.
        min_samples_split: Minimum samples required to split an internal node.
        min_samples_leaf: Minimum samples required to be at a leaf node.
        class_weight: Class weighting strategy to address class imbalance.
        random_state: Seed for deterministic reproducibility.
        
    Returns:
        RandomForestClassifier: Fitted baseline classifier.
    """
    logger.info(
        f"Training RandomForestClassifier with {n_estimators} trees, max_depth={max_depth}, "
        f"class_weight='{class_weight}', random_state={random_state}..."
    )
    
    model = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_split=min_samples_split,
        min_samples_leaf=min_samples_leaf,
        class_weight=class_weight,
        random_state=random_state,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    logger.info("Model training completed successfully.")
    return model


def evaluate_classification_performance(
    model: RandomForestClassifier,
    X: pd.DataFrame,
    y: pd.Series,
    dataset_name: str = "Test",
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """
    Evaluates the model across multiple risk-centric metrics, avoiding reliance on raw accuracy alone.
    
    Args:
        model: Trained classifier.
        X: Feature matrix.
        y: True labels.
        dataset_name: Identifier for logging (e.g. 'Train', 'Test').
        threshold: Decision threshold for positive classification (default 0.5).
        
    Returns:
        Dict: Comprehensive evaluation metrics dictionary.
    """
    y_prob = model.predict_proba(X)[:, 1]
    y_pred = (y_prob >= threshold).astype(int)
    
    acc = float(accuracy_score(y, y_pred))
    prec = float(precision_score(y, y_pred, zero_division=0))
    rec = float(recall_score(y, y_pred, zero_division=0))
    f1 = float(f1_score(y, y_pred, zero_division=0))
    roc_auc = float(roc_auc_score(y, y_prob))
    pr_auc = float(average_precision_score(y, y_prob))
    
    cm = confusion_matrix(y, y_pred)
    tn, fp, fn, tp = [int(v) for v in cm.ravel()]
    
    fpr = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
    fnr = float(fn / (fn + tp)) if (fn + tp) > 0 else 0.0

    metrics = {
        "dataset": dataset_name,
        "sample_count": int(len(y)),
        "fraud_count": int(y.sum()),
        "threshold": threshold,
        "accuracy": acc,
        "precision": prec,
        "recall": rec,
        "f1_score": f1,
        "roc_auc": roc_auc,
        "pr_auc": pr_auc,
        "confusion_matrix": {
            "true_negatives": tn,
            "false_positives": fp,
            "false_negatives": fn,
            "true_positives": tp,
        },
        "false_positive_rate": fpr,
        "false_negative_rate": fnr,
    }
    return metrics


def extract_feature_importances(
    model: RandomForestClassifier, feature_names: List[str], top_n: int = 25
) -> List[Dict[str, Union[str, float]]]:
    """
    Extracts, sorts, and returns top feature importances from the fitted tree ensemble.
    """
    importances = model.feature_importances_
    sorted_indices = np.argsort(importances)[::-1]
    
    feature_ranking = []
    for rank, idx in enumerate(sorted_indices[:top_n], start=1):
        feature_ranking.append({
            "rank": rank,
            "feature": feature_names[idx],
            "importance": float(round(importances[idx], 5)),
        })
    return feature_ranking


def train_anomaly_detector(
    X_train: pd.DataFrame,
    contamination: float = 0.05,
    n_estimators: int = 100,
    random_state: int = RANDOM_STATE,
) -> "AnomalyDetector":
    """Train an unsupervised IsolationForest anomaly detector.

    The anomaly detector operates on the **same preprocessed features** as
    the supervised classifier, but it does NOT use the ``is_fraud`` labels.
    This makes it a complementary signal that can flag novel fraud patterns
    the supervised model may never have seen.

    Parameters
    ----------
    X_train : DataFrame
        Preprocessed feature matrix (no target column).
    contamination : float
        Expected proportion of outliers.  Default 0.05 (5%).
    n_estimators : int
        Number of isolation trees.
    random_state : int
        Seed for reproducibility.

    Returns
    -------
    AnomalyDetector
        Fitted detector ready for ``detect()`` calls.
    """
    from src.anomaly_detection import AnomalyDetector

    logger.info(
        f"Training IsolationForest anomaly detector: "
        f"contamination={contamination}, n_estimators={n_estimators}"
    )
    detector = AnomalyDetector(
        contamination=contamination,
        random_state=random_state,
        n_estimators=n_estimators,
    )
    detector.fit(X_train)
    logger.info("Anomaly detector training completed.")
    return detector


def print_evaluation_summary(
    train_metrics: Dict[str, Any],
    test_metrics: Dict[str, Any],
    top_features: List[Dict[str, Any]],
) -> None:
    """
    Prints a clear, structured evaluation summary to the console.
    """
    separator = "=" * 70
    sub_sep = "-" * 70
    
    print("\n" + separator)
    print(" [AI RISK MANAGER] - MODEL TRAINING & EVALUATION REPORT")
    print(separator)
    print(f"{'Metric':<25} | {'Training Set':<18} | {'Test Set (Held-Out)':<18}")
    print(sub_sep)
    print(f"{'Accuracy':<25} | {train_metrics['accuracy']:<18.4f} | {test_metrics['accuracy']:<18.4f}")
    print(f"{'Precision':<25} | {train_metrics['precision']:<18.4f} | {test_metrics['precision']:<18.4f}")
    print(f"{'Recall':<25} | {train_metrics['recall']:<18.4f} | {test_metrics['recall']:<18.4f}")
    print(f"{'F1-Score':<25} | {train_metrics['f1_score']:<18.4f} | {test_metrics['f1_score']:<18.4f}")
    print(f"{'ROC-AUC':<25} | {train_metrics['roc_auc']:<18.4f} | {test_metrics['roc_auc']:<18.4f}")
    print(f"{'PR-AUC (Avg Precision)':<25} | {train_metrics['pr_auc']:<18.4f} | {test_metrics['pr_auc']:<18.4f}")
    print(sub_sep)
    
    cm = test_metrics["confusion_matrix"]
    print(" [CONFUSION MATRIX BREAKDOWN - TEST SET]:")
    print(f"   * True Negatives (Legitimate Correct) : {cm['true_negatives']:,}")
    print(f"   * False Positives (False Alarms)      : {cm['false_positives']:,} (FPR: {test_metrics['false_positive_rate']*100:.2f}%)")
    print(f"   * False Negatives (Missed Frauds)     : {cm['false_negatives']:,} (FNR: {test_metrics['false_negative_rate']*100:.2f}%)")
    print(f"   * True Positives (Detected Frauds)    : {cm['true_positives']:,}")
    print(sub_sep)
    
    print(" [TOP 10 PREDICTIVE RISK FEATURES]:")
    for f in top_features[:10]:
        print(f"   {f['rank']:>2}. {f['feature']:<40} (Importance: {f['importance']:.4f})")
    print(separator + "\n")


def run_training_pipeline(
    train_path: Union[str, Path] = TRAIN_PROCESSED_FILE,
    test_path: Union[str, Path] = TEST_PROCESSED_FILE,
    model_output_path: Union[str, Path] = MODEL_FILE,
) -> Dict[str, Any]:
    """
    Executes the end-to-end training and evaluation pipeline:
    1. Loads processed datasets.
    2. Trains the balanced RandomForest baseline model.
    3. Evaluates on training and test sets.
    4. Computes feature importances.
    5. Saves model artifact to `models/risk_model.pkl`.
    6. Saves metrics and feature importances.
    7. Displays evaluation summary report.
    
    Returns:
        Dict: Pipeline execution results, model metrics, and artifact locations.
    """
    logger.info("=== Starting Fraud Model Training Pipeline ===")
    
    # 1. Load data
    X_train, y_train, X_test, y_test = load_processed_datasets(train_path, test_path)
    
    # 2. Train model
    model = train_fraud_model(X_train, y_train)
    
    # 3. Evaluate performance
    train_metrics = evaluate_classification_performance(model, X_train, y_train, dataset_name="Train")
    test_metrics = evaluate_classification_performance(model, X_test, y_test, dataset_name="Test")
    
    # 4. Feature importances
    feature_names = list(X_train.columns)
    top_features = extract_feature_importances(model, feature_names, top_n=30)
    
    # 5. Save model and metadata artifacts
    ensure_directory(MODELS_DIR)
    save_artifact(model, model_output_path)
    
    # 5b. Train and save anomaly detector (unsupervised, labels ignored)
    anomaly_detector = train_anomaly_detector(X_train)
    anomaly_detector.save(ANOMALY_MODEL_FILE)
    logger.info(f"Anomaly detector saved to {Path(ANOMALY_MODEL_FILE).resolve()}")

    metrics_payload = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "model_type": "RandomForestClassifier",
        "hyperparameters": {
            "n_estimators": RF_N_ESTIMATORS,
            "max_depth": RF_MAX_DEPTH,
            "min_samples_split": RF_MIN_SAMPLES_SPLIT,
            "min_samples_leaf": RF_MIN_SAMPLES_LEAF,
            "class_weight": RF_CLASS_WEIGHT,
            "random_state": RANDOM_STATE,
        },
        "train_metrics": train_metrics,
        "test_metrics": test_metrics,
    }
    save_json(metrics_payload, MODEL_METRICS_FILE)
    save_json({"top_features": top_features}, FEATURE_IMPORTANCES_FILE)
    
    # 6. Display report
    print_evaluation_summary(train_metrics, test_metrics, top_features)
    
    logger.info(f"Model saved to {Path(model_output_path).resolve()}")
    logger.info(f"Metrics saved to {Path(MODEL_METRICS_FILE).resolve()}")
    logger.info("=== Fraud Model Training Pipeline Completed Successfully ===")
    
    return {
        "model_path": str(model_output_path),
        "metrics": test_metrics,
        "feature_importances": top_features,
    }


if __name__ == "__main__":
    run_training_pipeline()
