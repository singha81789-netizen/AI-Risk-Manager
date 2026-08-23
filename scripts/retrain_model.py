"""
Standalone model retraining script for the AI Risk Manager.

Collects confirmed analyst decisions from the database, builds a
candidate training dataset, retrains the fraud classifier, evaluates
the candidate against the current production model, and produces a
comparison report.

Usage::

    python scripts/retrain_model.py

The production model is NEVER automatically replaced.  The candidate
model is saved to ``models/versions/<version>/``.  To promote a
candidate after reviewing the comparison report, run::

    python scripts/retrain_model.py --promote <version>

or call ``src.retraining.promote_candidate()`` programmatically.
"""

import sys
from pathlib import Path

# Ensure project root is on the path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import argparse

from src.retraining import ModelRetrainer, promote_candidate
from src.utils import logger


def main() -> None:
    parser = argparse.ArgumentParser(
        description="AI Risk Manager — Model Retraining Pipeline"
    )
    parser.add_argument(
        "--promote",
        type=str,
        default=None,
        metavar="VERSION",
        help="Promote a candidate model version to production (e.g. 1.1.0)",
    )
    args = parser.parse_args()

    if args.promote:
        # Promote a previously trained candidate
        logger.info(f"=== Promoting candidate model v{args.promote} to production ===")
        try:
            promote_candidate(args.promote)
            logger.info("Promotion complete. Restart the API to use the new model.")
        except FileNotFoundError as exc:
            logger.error(f"Promotion failed: {exc}")
            sys.exit(1)
        return

    # Run the full retraining pipeline
    logger.info("=== AI Risk Manager — Controlled Model Retraining ===")

    retrainer = ModelRetrainer()
    report = retrainer.run_retraining()

    # Print the comparison report
    print(report.summary())

    # Exit with appropriate code
    if report.overall_recommendation == "INSUFFICIENT_DATA":
        logger.warning("Insufficient data for retraining.")
        sys.exit(2)
    elif report.promotion_eligible:
        logger.info(
            f"Candidate v{report.new_model_version} is eligible for promotion. "
            f"Review the report, then run: "
            f"python scripts/retrain_model.py --promote {report.new_model_version}"
        )
        sys.exit(0)
    else:
        logger.info("Candidate model did not meet promotion criteria.")
        sys.exit(0)


if __name__ == "__main__":
    main()
