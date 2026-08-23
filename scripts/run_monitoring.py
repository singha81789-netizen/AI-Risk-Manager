"""
Standalone model monitoring script for the AI Risk Manager.

Loads reference data from training artifacts, collects recent production
data from the database, and generates a monitoring report that indicates
whether the model's performance has degraded or data has drifted.

Usage::

    python scripts/run_monitoring.py

The report is printed to the console and saved to ``reports/monitoring/``.
"""

import sys
from pathlib import Path

# Ensure project root is on the path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.model_monitoring import ModelMonitor
from src.utils import logger


def main() -> None:
    logger.info("=== AI Risk Manager — Model Monitoring ===")

    monitor = ModelMonitor()
    report = monitor.run_full_monitoring()

    # Print the report to console
    print(report.summary())

    # Save the report to disk
    report_path = monitor.save_report(report)
    logger.info(f"Report saved to {report_path}")

    # Exit with non-zero code if retraining is recommended
    if report.retrain_recommended:
        logger.warning(
            "RETRAINING RECOMMENDED — review the report for details."
        )
        sys.exit(1)
    else:
        logger.info("Model is within acceptable performance bounds.")


if __name__ == "__main__":
    main()
