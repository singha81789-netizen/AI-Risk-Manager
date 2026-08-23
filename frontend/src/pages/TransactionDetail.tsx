import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTransactionById, getReviewsByTransactionId } from '../services/mockData'
import { getAnalystReviews } from '../services/api'
import RiskBadge from '../components/common/RiskBadge'
import StatusBadge from '../components/common/StatusBadge'
import AnalystReviewForm from '../components/common/AnalystReviewForm'
import { format } from 'date-fns'
import type { AnalystDecision, ApiAnalystReview } from '../types'

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const txn = id ? getTransactionById(id) : undefined
  const mockReviews = id ? getReviewsByTransactionId(id) : []

  const [apiReviews, setApiReviews] = useState<ApiAnalystReview[]>([])
  const [localDecision, setLocalDecision] = useState<AnalystDecision | null>(null)

  const loadReviews = useCallback(async () => {
    if (!id) return
    try {
      const reviews = await getAnalystReviews(id)
      setApiReviews(reviews)
      if (reviews.length > 0) {
        setLocalDecision(reviews[0].decision)
      }
    } catch {
      // API may be unavailable -- fall back to mock data silently
    }
  }, [id])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  const effectiveDecision = localDecision || txn?.analystDecision || null

  if (!txn) {
    return (
      <div>
        <button className="back-button" onClick={() => navigate('/transactions')}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Transactions
        </button>
        <div className="empty-state">
          <p>Transaction not found.</p>
        </div>
      </div>
    )
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: txn.currency }).format(n)

  function handleReviewSubmitted(decision: AnalystDecision, _notes: string) {
    setLocalDecision(decision)
  }

  return (
    <div>
      <button className="back-button" onClick={() => navigate('/transactions')}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to Transactions
      </button>

      <div className="page-header">
        <h2>Transaction Detail</h2>
        <p>{txn.id}</p>
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-header">
            <h3>Transaction Information</h3>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-field">
                <label>Amount</label>
                <span className="value" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  {formatCurrency(txn.amount)}
                </span>
              </div>
              <div className="detail-field">
                <label>Timestamp</label>
                <span className="value">{format(new Date(txn.timestamp), 'MMM d, yyyy HH:mm:ss')}</span>
              </div>
              <div className="detail-field">
                <label>Merchant</label>
                <span className="value">{txn.merchant}</span>
              </div>
              <div className="detail-field">
                <label>Category</label>
                <span className="value">{txn.merchantCategory}</span>
              </div>
              <div className="detail-field">
                <label>Location</label>
                <span className="value">{txn.city}, {txn.country}</span>
              </div>
              <div className="detail-field">
                <label>IP Address</label>
                <span className="value" style={{ fontFamily: 'monospace' }}>{txn.ipAddress}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Risk Assessment</h3>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-field">
                <label>Risk Score</label>
                <span className="value" style={{ fontSize: '2rem', fontWeight: 700 }}>
                  {txn.riskScore}
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                    {' '}/ 100
                  </span>
                </span>
              </div>
              <div className="detail-field">
                <label>Risk Level</label>
                <RiskBadge level={txn.riskLevel} />
              </div>
              <div className="detail-field">
                <label>Status</label>
                <StatusBadge status={txn.status} analystDecision={effectiveDecision} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>Cardholder Information</h3>
        </div>
        <div className="card-body">
          <div className="detail-grid">
            <div className="detail-field">
              <label>Name</label>
              <span className="value">{txn.cardholderName}</span>
            </div>
            <div className="detail-field">
              <label>Email</label>
              <span className="value">{txn.cardholderEmail}</span>
            </div>
            <div className="detail-field">
              <label>Card (Last 4)</label>
              <span className="value" style={{ fontFamily: 'monospace' }}>**** {txn.cardLast4}</span>
            </div>
            <div className="detail-field">
              <label>Device Fingerprint</label>
              <span className="value" style={{ fontFamily: 'monospace' }}>{txn.deviceFingerprint}</span>
            </div>
          </div>
        </div>
      </div>

      {txn.riskFactors.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3>Risk Factors</h3>
          </div>
          <div className="card-body">
            <ul className="risk-factors-list">
              {txn.riskFactors.map((factor, i) => (
                <li key={i}>{factor}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="ai-analysis-box">
        <div className="label">AI Analysis</div>
        <p>{txn.aiAnalysis}</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>Velocity Checks</h3>
        </div>
        <div className="card-body">
          <div className="velocity-checks">
            {txn.velocityChecks.map((check, i) => (
              <div
                key={i}
                className={`velocity-check ${check.passed ? 'passed' : 'failed'}`}
              >
                <span className="check-label">{check.label}</span>
                <span className="check-detail">
                  {check.label.includes('Amount')
                    ? `$${check.count.toLocaleString()} / $${check.threshold.toLocaleString()}`
                    : `${check.count} / ${check.threshold}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>Analyst Review</h3>
        </div>
        <div className="card-body">
          <AnalystReviewForm
            transactionId={txn.id}
            existingDecision={effectiveDecision}
            onReviewSubmitted={handleReviewSubmitted}
          />
        </div>
      </div>

      {(apiReviews.length > 0 || mockReviews.length > 0) && (
        <div className="card">
          <div className="card-header">
            <h3>Review History</h3>
          </div>
          <div className="card-body">
            {apiReviews.map((review) => (
              <div key={review.id} className="review-card">
                <div className="review-header">
                  <span className="analyst">{review.analyst_id}</span>
                  <span className="time">
                    {format(new Date(review.created_at), 'MMM d, HH:mm')}
                  </span>
                </div>
                <span className={`review-decision ${review.decision.toLowerCase()}`}>
                  {review.decision.replace('_', ' ')}
                </span>
                {review.notes && <p className="review-notes">{review.notes}</p>}
                {review.ai_fraud_probability != null && (
                  <div className="review-confidence">
                    AI probability: {(review.ai_fraud_probability * 100).toFixed(1)}%
                    {review.ai_risk_level && <> | AI level: {review.ai_risk_level}</>}
                  </div>
                )}
              </div>
            ))}
            {apiReviews.length === 0 && mockReviews.map((review) => (
              <div key={review.id} className="review-card">
                <div className="review-header">
                  <span className="analyst">{review.analystName}</span>
                  <span className="time">
                    {format(new Date(review.timestamp), 'MMM d, HH:mm')}
                  </span>
                </div>
                <span className={`review-decision ${review.decision}`}>
                  {review.decision}
                </span>
                <p className="review-notes">{review.notes}</p>
                <div className="review-confidence">
                  Confidence: {Math.round(review.confidence * 100)}%
                </div>
              </div>
            ))}
            {apiReviews.length === 0 && mockReviews.length === 0 && (
              <div className="empty-state">
                <p>No analyst reviews yet.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
