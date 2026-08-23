import type { TransactionStatus, AnalystDecision } from '../../types'

interface StatusBadgeProps {
  status: TransactionStatus
  analystDecision?: AnalystDecision | null
}

const LABELS: Record<TransactionStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
  under_review: 'Under Review',
}

const DECISION_LABELS: Record<AnalystDecision, string> = {
  CONFIRM_FRAUD: 'Confirmed Fraud',
  FALSE_POSITIVE: 'False Positive',
  ESCALATE: 'Escalated',
}

export default function StatusBadge({ status, analystDecision }: StatusBadgeProps) {
  if (analystDecision) {
    return (
      <span className={`status-badge reviewed-${analystDecision.toLowerCase()}`}>
        {DECISION_LABELS[analystDecision]}
      </span>
    )
  }
  return (
    <span className={`status-badge ${status}`}>
      {LABELS[status]}
    </span>
  )
}
