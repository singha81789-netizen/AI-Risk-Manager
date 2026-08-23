# Financial Fraud Risk Indicators

## Overview

This document defines the primary risk indicators used by the AI Risk Manager to identify potentially fraudulent transactions. These indicators form the basis of both the automated scoring model and the analyst review process.

## Transaction-Level Risk Indicators

### Amount-Based Indicators

- **High transaction amount**: Transactions exceeding $350 are flagged for additional scrutiny. Amounts above $1,000 receive elevated risk scores.
- **Amount deviation**: Transactions significantly above the customer's historical average (2x or more) indicate potential account compromise.
- **Round amount transactions**: Unusually round amounts (e.g., $500.00, $1,000.00) may indicate test transactions used by fraudsters to validate stolen card details.
- **Rapid amount escalation**: A sequence of transactions with rapidly increasing amounts can indicate a fraudster testing card limits.

### Velocity Indicators

- **High transaction frequency**: More than 3 transactions within 1 hour, or more than 10 transactions within 24 hours, triggers velocity alerts.
- **Multiple merchant categories**: Transactions across unrelated merchant categories in a short window (e.g., electronics purchase followed by grocery store) suggest card theft.
- **Geographic velocity**: Transactions from geographically distant locations within timeframes inconsistent with travel (e.g., New York and London within 2 hours).

### Geographic Indicators

- **Distance from home**: Transactions more than 50 km from the customer's registered address receive elevated risk scores.
- **High-risk country origin**: Transactions originating from or routed through countries with elevated fraud rates receive automatic flagging.
- **First-time geography**: First transaction from a new country or region, especially combined with high amounts.
- **IP geolocation mismatch**: IP address location inconsistent with the billing address or recent transaction locations.

### Device and Channel Indicators

- **New device fingerprint**: First transaction from a previously unseen device or browser fingerprint.
- **Card-not-present transactions**: Online or phone transactions where the physical card is not present carry inherently higher risk.
- **Unusual device type**: Transaction from a device type not previously associated with the account.

### Behavioral Indicators

- **Off-peak hours**: Transactions between 1:00 AM and 5:00 AM local time, especially for retail categories.
- **First-time merchant category**: Customer's first-ever transaction in a high-risk category (jewelry, electronics, luxury goods, travel).
- **Session anomalies**: Multiple failed authentication attempts followed by a successful transaction.

## Composite Risk Signals

The following combinations of indicators produce compounding risk elevations:

1. **Card theft pattern**: High ATM velocity + increasing distances from home + card-present transactions
2. **Account takeover**: New device + unusual geography + high amount + card-not-present
3. **Card testing**: Multiple small transactions at different merchants followed by a large purchase
4. **Synthetic identity**: Consistent but artificial-looking behavioral patterns with no deviation

## Risk Score Interpretation

| Score Range | Risk Level | Typical Action |
|-------------|-----------|----------------|
| 0-34 | LOW | Auto-approve, log for monitoring |
| 35-69 | MEDIUM | Flag for analyst review |
| 70-100 | HIGH | Block transaction, escalate to senior fraud team |

## References

- Payment Card Industry Data Security Standard (PCI DSS)
- Federal Reserve guidance on electronic fund transfers
- Internal fraud loss data and historical case analysis
