# Transaction Review Rules

## Overview

This document defines the rules and procedures that analysts must follow when reviewing flagged transactions. These rules ensure consistent, auditable decisions across the fraud operations team.

## Decision Categories

### CONFIRM_FRAUD

Use this decision when evidence strongly indicates the transaction is fraudulent.

**Criteria:**
- Multiple high-severity risk indicators triggered
- Customer confirms they did not authorize the transaction
- Card has been reported lost or stolen
- Device fingerprint is associated with known fraud patterns
- Geographic indicators are inconsistent with any plausible travel

**Required actions:**
1. Record detailed notes explaining the evidence
2. Flag the card for immediate freeze if not already done
3. Notify the cardholder via their preferred contact method
4. Create a case file for potential law enforcement referral

### FALSE_POSITIVE

Use this decision when the transaction is determined to be legitimate despite triggering risk rules.

**Criteria:**
- Customer confirms the transaction is theirs
- Travel pattern is explainable (business trip, vacation, relocation)
- New device is a recent legitimate purchase
- Merchant category misclassification (e.g., hotel coded as "jewelry")
- Unusual but legitimate spending pattern (holiday shopping, emergency purchase)

**Required actions:**
1. Document the explanation provided by the customer or discovered during investigation
2. Update the customer's risk profile if the pattern represents a permanent change
3. Note any rule adjustments that could prevent similar false positives

### ESCALATE

Use this decision when the case requires senior analyst or specialist review.

**Criteria:**
- Evidence is ambiguous and cannot be resolved with available information
- Potential organized fraud ring activity
- Transaction involves amounts or patterns outside normal fraud cases
- Potential internal fraud or employee compromise
- Cross-border cases requiring international coordination

**Required actions:**
1. Summarize the current state of the investigation
2. List specific questions or information needed for resolution
3. Tag the case with relevant escalation categories

## Review Workflow

### Step 1: Initial Assessment

1. Review the AI risk score and triggered risk factors
2. Examine the transaction details (amount, merchant, time, location)
3. Check velocity and velocity breach details
4. Review the customer's historical transaction pattern

### Step 2: Customer Contact (if applicable)

1. Attempt contact via registered phone number
2. Verify identity using security questions
3. Ask about the specific transaction
4. Document the customer's response verbatim

### Step 3: Investigation

1. Cross-reference with known fraud patterns
2. Check for关联 transactions (same card, device, or IP)
3. Review the full audit trail for the transaction
4. Check external threat intelligence if available

### Step 4: Decision

1. Select the appropriate decision category
2. Write detailed notes explaining the reasoning
3. Include supporting evidence references
4. Submit the decision for audit trail recording

## Time SLAs

| Risk Level | Initial Review | Final Decision |
|-----------|---------------|----------------|
| HIGH | 15 minutes | 2 hours |
| MEDIUM | 1 hour | 8 hours |
| LOW | 4 hours | 24 hours |

## Escalation Procedures

- **Immediate escalation**: Transaction amount > $10,000 AND risk level HIGH
- **Manager escalation**: Customer dispute unresolved after 24 hours
- **Legal escalation**: Suspected money laundering or terrorism financing indicators
- **Executive escalation**: Systemic fraud affecting multiple accounts

## Quality Assurance

- 10% of all decisions are randomly audited weekly
- False positive rate should not exceed 15% for HIGH risk decisions
- All escalations must be reviewed by a senior analyst within 4 hours
- Decision consistency is measured monthly across analysts
