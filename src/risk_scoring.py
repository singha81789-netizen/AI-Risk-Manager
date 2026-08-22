"""
Reusable risk scoring module.

Converts a fraud probability (0.0–1.0) from an ML model into a
0–100 risk score and a categorical risk level (LOW / MEDIUM / HIGH).

Thresholds are configurable via constructor arguments or the project-wide
defaults in src.config so they can be tuned without touching scoring logic.
"""

from dataclasses import dataclass
from typing import Union

import numpy as np

from src.config import RISK_THRESHOLD_HIGH, RISK_THRESHOLD_MEDIUM


@dataclass(frozen=True)
class RiskScoreResult:
    """Structured output returned by :func:`compute_risk_score`."""

    probability: float
    risk_score: int
    risk_level: str


def compute_risk_score(
    probability: float,
    medium_threshold: float = RISK_THRESHOLD_MEDIUM,
    high_threshold: float = RISK_THRESHOLD_HIGH,
) -> RiskScoreResult:
    """
    Convert a fraud probability into a risk score and risk level.

    Parameters
    ----------
    probability : float
        Model-predicted P(fraud) in [0, 1].
    medium_threshold : float
        Minimum probability that maps to MEDIUM risk.
        Must be in (0, high_threshold).
    high_threshold : float
        Minimum probability that maps to HIGH risk.
        Must be in (medium_threshold, 1].

    Returns
    -------
    RiskScoreResult
        dataclass with ``probability``, ``risk_score`` (0–100), and
        ``risk_level`` (LOW / MEDIUM / HIGH).

    Raises
    ------
    ValueError
        If ``probability`` is outside [0, 1] or thresholds are invalid.
    """
    prob = float(probability)

    if not 0.0 <= prob <= 1.0:
        raise ValueError(
            f"probability must be in [0, 1], got {prob}"
        )
    if not (0.0 < medium_threshold < high_threshold <= 1.0):
        raise ValueError(
            f"thresholds must satisfy 0 < medium < high <= 1, "
            f"got medium={medium_threshold}, high={high_threshold}"
        )

    risk_score = int(round(prob * 100))

    if prob >= high_threshold:
        risk_level = "HIGH"
    elif prob >= medium_threshold:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return RiskScoreResult(
        probability=round(prob, 4),
        risk_score=risk_score,
        risk_level=risk_level,
    )
