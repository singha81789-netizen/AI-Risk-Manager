import { useState } from 'react'
import type { AnalystDecision } from '../../types'
import { submitReview, getAnalystId } from '../../services/api'

interface AnalystReviewFormProps {
  transactionId: string
  existingDecision?: AnalystDecision | null
  onReviewSubmitted: (decision: AnalystDecision, notes: string) => void
}

const DECISIONS: { value: AnalystDecision; label: string; description: string }[] = [
  { value: 'CONFIRM_FRAUD', label: 'Confirm Fraud', description: 'Transaction is fraudulent' },
  { value: 'FALSE_POSITIVE', label: 'False Positive', description: 'Transaction is legitimate' },
  { value: 'ESCALATE', label: 'Escalate', description: 'Needs senior review' },
]

export default function AnalystReviewForm({
  transactionId,
  existingDecision,
  onReviewSubmitted,
}: AnalystReviewFormProps) {
  const [decision, setDecision] = useState<AnalystDecision | ''>('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const analystId = getAnalystId()
  const alreadyReviewed = existingDecision != null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!decision) {
      setError('Select a decision before submitting.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await submitReview(transactionId, decision, notes)
      setSuccess(true)
      onReviewSubmitted(decision, notes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (alreadyReviewed) {
    const decLabel = DECISIONS.find((d) => d.value === existingDecision)?.label || existingDecision
    return (
      <div className="review-form-already">
        <div className="reviewed-indicator">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Reviewed
        </div>
        <p className="reviewed-detail">
          Decision: <strong>{decLabel}</strong>
        </p>
      </div>
    )
  }

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      <h3 className="review-form-title">Analyst Review</h3>
      <p className="review-form-subtitle">
        Analyst ID: <code>{analystId}</code>
      </p>

      <div className="decision-options">
        {DECISIONS.map((opt) => (
          <label
            key={opt.value}
            className={`decision-option ${decision === opt.value ? 'selected' : ''} ${opt.value.toLowerCase()}`}
          >
            <input
              type="radio"
              name="decision"
              value={opt.value}
              checked={decision === opt.value}
              onChange={() => setDecision(opt.value)}
              disabled={submitting || success}
            />
            <span className="decision-label">{opt.label}</span>
            <span className="decision-desc">{opt.description}</span>
          </label>
        ))}
      </div>

      <textarea
        className="review-notes-input"
        placeholder="Add review notes (optional)..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        disabled={submitting || success}
      />

      {error && <div className="review-error">{error}</div>}
      {success && (
        <div className="review-success">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Decision recorded successfully
        </div>
      )}

      <button
        type="submit"
        className="review-submit-btn"
        disabled={submitting || success || !decision}
      >
        {submitting ? 'Submitting...' : 'Submit Decision'}
      </button>
    </form>
  )
}
