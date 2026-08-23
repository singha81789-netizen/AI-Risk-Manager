# Analyst Investigation Procedures

## Overview

This document provides step-by-step procedures for fraud analysts conducting transaction investigations. It covers the complete investigation lifecycle from initial alert triage through case resolution.

## Investigation Lifecycle

### Phase 1: Alert Triage (5-15 minutes)

**Objective**: Quickly assess whether an alert requires full investigation.

1. Review AI assessment
   - Check the fraud probability and risk score
   - Read the triggered risk factors
   - Note the automated decision (APPROVE/REVIEW/DECLINE)

2. Quick visual scan
   - Transaction amount relative to customer profile
   - Merchant category consistency
   - Time of day and geography
   - Any obvious red flags

3. Classification
   - **Auto-resolvable**: Clear false positive (e.g., known travel pattern) - resolve immediately
   - **Standard review**: Normal investigation required
   - **Complex case**: Multiple indicators, escalate to senior analyst

### Phase 2: Detailed Investigation (15-60 minutes)

**Objective**: Gather evidence to support a decision.

1. Transaction deep dive
   - Review all fields in the transaction record
   - Compare against historical patterns for this customer
   - Check the velocity breach details
   - Examine device and IP information

2. Customer profile review
   - Account age and history
   - Previous fraud events
   - Typical spending patterns
   - Registered devices and locations

3.关联 analysis
   - Other transactions from the same device/IP in the last 24 hours
   - Other accounts potentially linked
   - Merchant-level fraud history

4. External checks
   - Known fraud databases (if available)
   - Address verification
   - Phone number verification

### Phase 3: Decision and Documentation (5-15 minutes)

**Objective**: Make a decision and record it for audit and retraining.

1. Decision selection
   - CONFIRM_FRAUD: Strong evidence of fraud
   - FALSE_POSITIVE: Transaction is legitimate
   - ESCALATE: Needs senior review

2. Notes documentation
   - Write a clear summary of findings
   - Reference specific evidence
   - Explain reasoning for the decision
   - Note any follow-up actions required

3. Action execution
   - Apply appropriate card/account controls
   - Initiate customer contact if needed
   - File required reports (SAR, CTR) if applicable

## Investigation Checklists

### Standard Review Checklist

- [ ] AI risk score and factors reviewed
- [ ] Transaction details examined
- [ ] Customer history checked
- [ ] Velocity and pattern analysis completed
- [ ] Device and IP information reviewed
- [ ] Customer contacted (if applicable)
- [ ] Decision documented with evidence
- [ ] Required actions executed

### Escalation Checklist

- [ ] All standard review items completed
- [ ] Escalation reason clearly stated
- [ ] Specific questions for senior analyst documented
- [ ] Case tagged with appropriate categories
- [ ] Manager notified (if required)

### Fraud Confirmation Checklist

- [ ] Evidence of unauthorized transaction confirmed
- [ ] Customer notified and card frozen
- [ ] All关联 transactions identified
- [ ] SAR filing initiated (if threshold met)
- [ ] Case file created for potential law enforcement referral
- [ ] Account security review scheduled

## Common Investigation Patterns

### Pattern 1: Account Takeover

**Indicators**: New device + unusual location + high amount + card-not-present

**Investigation steps**:
1. Check for password reset or credential changes
2. Review login history and session data
3. Verify the customer has not traveled
4. Check for phishing or social engineering indicators
5. Assess scope - are other accounts compromised?

### Pattern 2: Card Testing

**Indicators**: Multiple small transactions at different merchants + rapid succession

**Investigation steps**:
1. Map the sequence of transactions
2. Identify the common factor (device, IP, location)
3. Check if the small transactions were successful
4. Assess whether a large follow-up transaction occurred
5. Identify the card data source if possible

### Pattern 3: Card Theft (ATM)

**Indicators**: Multiple ATM withdrawals + increasing distance + high amounts

**Investigation steps**:
1. Map ATM locations and timestamps
2. Calculate travel speed between locations
3. Check for skimming device indicators
4. Verify customer location at time of transactions
5. Assess card cloning vs. physical theft

### Pattern 4: Merchant Fraud

**Indicators**: Legitimate-looking transactions at a specific merchant + chargebacks

**Investigation steps**:
1. Review all transactions at the merchant
2. Check for transaction amount manipulation
3. Review merchant history and risk profile
4. Coordinate with merchant risk team if applicable
5. Assess whether to add merchant to restricted list

## Quality Standards

### Documentation Requirements

- Every investigation must have at minimum: risk factors reviewed, decision rationale, evidence referenced
- Customer contact attempts must include: date/time, method, outcome
- Escalations must include: specific questions, current theory, information gaps

### Time Standards

- Initial triage: Complete within SLA for the risk level
- Detailed investigation: Proportional to case complexity
- Documentation: Complete at time of decision (no retrospective edits)

### Peer Review

- Weekly calibration sessions to review decision consistency
- Monthly case audits by senior analysts
- Quarterly accuracy reviews against confirmed fraud/non-fraud outcomes
