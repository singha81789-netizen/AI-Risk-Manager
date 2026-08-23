# Risk Management Guidelines

## Overview

This document establishes the risk management framework for the AI Risk Manager system, covering governance, thresholds, model management, and operational procedures.

## Risk Governance

### Risk Appetite Statement

The organization maintains a low risk appetite for financial fraud. The target is to:
- Detect and prevent >95% of fraudulent transactions
- Maintain false positive rate below 15% for automated decisions
- Process all HIGH-risk flagged transactions within 2-hour SLA
- Achieve <0.1% fraud loss rate on total transaction volume

### Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| Fraud Analyst | Day-to-day transaction review, initial decisions |
| Senior Analyst | Complex case investigation, escalation handling |
| Fraud Manager | Policy oversight, threshold tuning, team management |
| Risk Committee | Strategic risk appetite, model approval, audit review |
| Compliance Officer | Regulatory reporting, suspicious activity filings |

## Risk Thresholds

### Automated Decision Thresholds

These thresholds are enforced by the ML model and rule engine:

- **P(fraud) < 0.35**: AUTO-APPROVE — Transaction passes through with logging
- **0.35 <= P(fraud) < 0.70**: REVIEW — Transaction flagged for analyst review
- **P(fraud) >= 0.70**: DECLINE — Transaction blocked, cardholder notified

### Risk Score Calibration

The 0-100 risk score is derived from the fraud probability via linear mapping:
```
risk_score = round(fraud_probability * 100)
```

Risk levels are classified as:
- **LOW**: risk_score < 35
- **MEDIUM**: 35 <= risk_score < 70
- **HIGH**: risk_score >= 70

### Threshold Tuning

Thresholds are reviewed quarterly by the Risk Committee. Factors considered:
- Historical false positive and false negative rates
- Changes in fraud attack patterns
- Regulatory requirements
- Customer experience impact

## Model Management

### Model Versioning

Each model version is tracked with:
- Training data snapshot hash
- Performance metrics (precision, recall, F1, AUC)
- Feature importance ranking
- Anomaly detection parameters

### Retraining Schedule

- **Standard retraining**: Quarterly with rolling 12-month window
- **Emergency retraining**: When fraud pattern shifts exceed 20% in detection rate
- **Validation**: Champion-challenger testing before production deployment

### Model Monitoring

| Metric | Threshold | Action |
|--------|-----------|--------|
| Precision drop | > 5% from baseline | Investigate feature drift |
| Recall drop | > 3% from baseline | Review training data quality |
| False positive increase | > 10% month-over-month | Tune thresholds |
| Prediction latency | > 200ms p99 | Optimize inference pipeline |

## Loss Prevention

### Transaction Limits

- Single transaction limit: $25,000 (hard block above)
- Daily cumulative limit: $50,000 (velocity check)
- Weekly international limit: $15,000 (flag for review above)

### Card Controls

- Automatic card freeze after 3 consecutive HIGH-risk transactions
- Temporary holds on cards with failed authentication attempts
- Geographic restriction capability for known travel patterns

### Customer Notification

- Real-time SMS/push for all HIGH-risk flagged transactions
- Daily summary of all blocked transactions
- Proactive outreach for accounts with multiple fraud attempts

## Regulatory Compliance

### Suspicious Activity Reporting

- SAR filing required for confirmed fraud > $2,000
- CTR filing for cash transactions > $10,000
- FinCEN reporting within 30 days of detection

### Record Retention

- Transaction data: 7 years
- Analyst decisions and notes: 7 years
- Audit logs: 10 years
- Model training data: 5 years

### Data Protection

- Customer PII encrypted at rest and in transit
- Analyst access logged and audited
- Data retention policies enforced automatically
- Cross-border data transfer compliance with local regulations

## Incident Response

### Fraud Incident Classification

| Severity | Criteria | Response Time |
|----------|----------|--------------|
| Critical | > $100K loss or systemic vulnerability | Immediate |
| High | > $10K loss or organized fraud ring | 1 hour |
| Medium | > $1K loss or individual account compromise | 4 hours |
| Low | < $1K loss or isolated incident | 24 hours |

### Post-Incident Review

All incidents classified Medium or above trigger:
1. Root cause analysis within 5 business days
2. Remediation plan with assigned owners
3. Lessons learned documentation
4. Update to fraud rules and detection models as needed
