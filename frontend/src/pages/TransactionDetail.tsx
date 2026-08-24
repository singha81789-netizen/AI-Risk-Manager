import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTransactionById, getAnalystReviews, getModelExplanation } from '../services/api'
import RiskBadge from '../components/common/RiskBadge'
import AnalystReviewForm from '../components/common/AnalystReviewForm'
import { format } from 'date-fns'
import type { ApiTransaction, ApiAnalystReview, ModelExplanation, AnalystDecision } from '../types'

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [txn, setTxn] = useState<ApiTransaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [apiReviews, setApiReviews] = useState<ApiAnalystReview[]>([])
  const [localDecision, setLocalDecision] = useState<AnalystDecision | null>(null)
  const [explanation, setExplanation] = useState<ModelExplanation | null>(null)
  const [explanationError, setExplanationError] = useState<string | null>(null)

  // Load transaction
  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      try {
        const data = await getTransactionById(id!)
        if (!cancelled) {
          setTxn(data)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Transaction not found')
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  // Load reviews
  const loadReviews = useCallback(async () => {
    if (!id) return
    try {
      const reviews = await getAnalystReviews(id)
      setApiReviews(reviews)
      if (reviews.length > 0) {
        setLocalDecision(reviews[0].decision)
      }
    } catch {
      // API may be unavailable
    }
  }, [id])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  // Load explanation when transaction data is available
  const loadExplanation = useCallback(async () => {
    if (!txn || !txn.transaction_id) return
    try {
      const result = await getModelExplanation({
        transaction_id: txn.transaction_id,
        age: txn.age ?? 30,
        gender: txn.gender ?? 'M',
        merchant_category: txn.merchant_category ?? 'unknown',
        amount: txn.amount ?? 0,
        transaction_type: txn.transaction_type ?? 'Online',
        card_type: txn.card_type ?? 'Credit',
        card_present: txn.card_present ?? 0,
        device_type: txn.device_type ?? 'Web_Browser',
        distance_from_home: txn.distance_from_home ?? 0,
        distance_from_last_transaction: txn.distance_from_last_transaction ?? 0,
        high_risk_country: txn.high_risk_country ?? 0,
        velocity_last_24h: txn.velocity_last_24h ?? 1,
        timestamp: txn.timestamp ?? undefined,
      })
      setExplanation(result)
    } catch {
      setExplanationError('Model explanation unavailable')
    }
  }, [txn])

  useEffect(() => {
    loadExplanation()
  }, [loadExplanation])

  const effectiveDecision = localDecision || (txn?.analyst_decision as AnalystDecision) || null

  if (loading) {
    return (
      <div>
        <button className="back-button" onClick={() => navigate('/transactions')}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Transactions
        </button>
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading transaction...</p>
        </div>
      </div>
    )
  }

  if (error || !txn) {
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
          <p>{error || 'Transaction not found.'}</p>
        </div>
      </div>
    )
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  function handleReviewSubmitted(decision: AnalystDecision, _notes: string) {
    setLocalDecision(decision)
  }

  const riskFactors = txn.triggered_risk_factors || []

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
        <div className="page-header-text">
          <h2>Transaction Detail</h2>
          <p>{txn.transaction_id}</p>
        </div>
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
                  {txn.amount != null ? formatCurrency(txn.amount) : '—'}
                </span>
              </div>
              <div className="detail-field">
                <label>Timestamp</label>
                <span className="value">
                  {txn.timestamp
                    ? format(new Date(txn.timestamp), 'MMM d, yyyy HH:mm:ss')
                    : txn.created_at
                      ? format(new Date(txn.created_at), 'MMM d, yyyy HH:mm:ss')
                      : '—'}
                </span>
              </div>
              <div className="detail-field">
                <label>Category</label>
                <span className="value">{txn.merchant_category || '—'}</span>
              </div>
              <div className="detail-field">
                <label>Transaction Type</label>
                <span className="value">{txn.transaction_type || '—'}</span>
              </div>
              <div className="detail-field">
                <label>Card Type</label>
                <span className="value">{txn.card_type || '—'}</span>
              </div>
              <div className="detail-field">
                <label>Device</label>
                <span className="value">{txn.device_type || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Risk Assessment</h3>
            {txn.model_version && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 8 }}>
                model v{txn.model_version}
              </span>
            )}
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-field">
                <label>Fraud Probability</label>
                <span className="value" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {txn.fraud_probability != null
                    ? `${(txn.fraud_probability * 100).toFixed(1)}%`
                    : '—'}
                </span>
              </div>
              <div className="detail-field">
                <label>Risk Score</label>
                <span className="value" style={{ fontSize: '2rem', fontWeight: 700 }}>
                  {txn.risk_score ?? '—'}
                  {txn.risk_score != null && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                      {' '}/ 100
                    </span>
                  )}
                </span>
              </div>
              <div className="detail-field">
                <label>Risk Level</label>
                {txn.risk_level ? (
                  <RiskBadge level={txn.risk_level} />
                ) : (
                  <span className="value">—</span>
                )}
              </div>
              <div className="detail-field">
                <label>Decision</label>
                <span className="value" style={{ fontWeight: 600 }}>
                  {txn.prediction || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>Transaction Details</h3>
        </div>
        <div className="card-body">
          <div className="detail-grid">
            <div className="detail-field">
              <label>Age</label>
              <span className="value">{txn.age ?? '—'}</span>
            </div>
            <div className="detail-field">
              <label>Gender</label>
              <span className="value">{txn.gender || '—'}</span>
            </div>
            <div className="detail-field">
              <label>Card Present</label>
              <span className="value">{txn.card_present === 1 ? 'Yes' : txn.card_present === 0 ? 'No' : '—'}</span>
            </div>
            <div className="detail-field">
              <label>Distance from Home</label>
              <span className="value">{txn.distance_from_home != null ? `${txn.distance_from_home} km` : '—'}</span>
            </div>
            <div className="detail-field">
              <label>Distance from Last Txn</label>
              <span className="value">{txn.distance_from_last_transaction != null ? `${txn.distance_from_last_transaction} km` : '—'}</span>
            </div>
            <div className="detail-field">
              <label>High Risk Country</label>
              <span className="value">{txn.high_risk_country === 1 ? 'Yes' : txn.high_risk_country === 0 ? 'No' : '—'}</span>
            </div>
            <div className="detail-field">
              <label>Velocity (24h)</label>
              <span className="value">{txn.velocity_last_24h ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {riskFactors.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3>Triggered Risk Factors</h3>
          </div>
          <div className="card-body">
            <ul className="risk-factors-list">
              {riskFactors.map((factor, i) => (
                <li key={i}>{factor}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Model Explanation — SHAP-based feature contributions */}
      {explanation && explanation.factors.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3>Model Explanation</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 8 }}>
              source: {explanation.source}
            </span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
              Features ranked by their contribution to the fraud prediction.
              Positive values increase risk; negative values decrease it.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {explanation.factors.map((factor, i) => {
                const absVal = Math.abs(factor.contribution)
                const maxAbs = Math.abs(explanation.factors[0]?.contribution || 1)
                const barWidth = Math.min((absVal / maxAbs) * 100, 100)
                const barColor = factor.direction === 'increases_risk'
                  ? 'var(--color-risk-high, #ef4444)'
                  : 'var(--color-risk-low, #22c55e)'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      minWidth: 200,
                      fontSize: '0.82rem',
                      color: 'var(--color-text)',
                      textAlign: 'right',
                    }}>
                      {factor.feature}
                    </span>
                    <div style={{
                      flex: 1,
                      height: 18,
                      background: 'var(--color-bg-secondary, #1e293b)',
                      borderRadius: 4,
                      overflow: 'hidden',
                      position: 'relative',
                    }}>
                      <div style={{
                        width: `${barWidth}%`,
                        height: '100%',
                        background: barColor,
                        opacity: 0.8,
                        borderRadius: 4,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <span style={{
                      minWidth: 80,
                      fontSize: '0.78rem',
                      fontFamily: 'monospace',
                      color: factor.direction === 'increases_risk'
                        ? 'var(--color-risk-high, #ef4444)'
                        : 'var(--color-risk-low, #22c55e)',
                      textAlign: 'right',
                    }}>
                      {factor.contribution > 0 ? '+' : ''}{factor.contribution.toFixed(4)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
      {explanationError && !explanation && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3>Model Explanation</h3>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {explanationError}
            </p>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>Analyst Review</h3>
        </div>
        <div className="card-body">
          <AnalystReviewForm
            transactionId={txn.transaction_id || ''}
            existingDecision={effectiveDecision}
            onReviewSubmitted={handleReviewSubmitted}
          />
        </div>
      </div>

      {apiReviews.length > 0 && (
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
          </div>
        </div>
      )}
    </div>
  )
}
