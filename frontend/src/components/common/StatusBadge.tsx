import type { TransactionStatus } from '../../types'

interface StatusBadgeProps {
  status: TransactionStatus
}

const LABELS: Record<TransactionStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
  under_review: 'Under Review',
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${status}`}>
      {LABELS[status]}
    </span>
  )
}
