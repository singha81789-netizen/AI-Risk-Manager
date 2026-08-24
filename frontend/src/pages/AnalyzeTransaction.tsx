import { useState } from 'react'
import { predictTransaction } from '../services/api'
import RiskBadge from '../components/common/RiskBadge'
import type { ApiPredictionResponse } from '../types'

const DEFAULT_TRANSACTION = {
  transaction_id: '',
  age: 35,
  gender: 'M',
  merchant_category: 'electronics',
  amount: 500.0,
  transaction_type: 'Online',
  card_type: 'Credit',
  card_present: 0,
  device_type: 'Web_Browser',
  distance_from_home: 50.0,
  distance_from_last_transaction: 30.0,
  high_risk_country: 0,
  velocity_last_24h: 3,
}

const MERCHANT_CATEGORIES = [
  'electronics', 'grocery', 'jewelry', 'cash_withdrawal',
  'digital_services', 'luxury_goods', 'transportation',
  'food_beverage', 'travel', 'entertainment', 'other',
]

const TRANSACTION_TYPES = [
  'Online', 'POS', 'ATM', 'Wire_Transfer', 'Contactless', 'Manual',
]

const CARD_TYPES = ['Credit', 'Debit', 'Prepaid']

const DEVICE_TYPES = [
  'Web_Browser', 'Mobile_App', 'POS_Terminal', 'ATM', 'API', 'Unknown',
]

export default function AnalyzeTransaction() {
  const [form, setForm] = useState(DEFAULT_TRANSACTION)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ApiPredictionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setResult(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setResult(null)

    try {
      const payload = {
        ...form,
        transaction_id: form.transaction_id || `TXN-${Date.now().toString(36).toUpperCase()}`,
      }
      const response = await predictTransaction(payload)
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction failed')
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setForm(DEFAULT_TRANSACTION)
    setResult(null)
    setError(null)
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h2>Analyze Transaction</h2>
          <p>Submit a transaction to the ML model for fraud risk assessment</p>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-header">
            <h3>Transaction Input</h3>
          </div>
          <div className="card-body">
            <form className="analyze-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="transaction_id">Transaction ID (optional)</label>
                  <input
                    id="transaction_id"
                    type="text"
                    value={form.transaction_id}
                    onChange={(e) => updateField('transaction_id', e.target.value)}
                    placeholder="Auto-generated if empty"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="amount">Amount (USD) *</label>
                  <input
                    id="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => updateField('amount', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="age">Customer Age *</label>
                  <input
                    id="age"
                    type="number"
                    min="0"
                    max="150"
                    value={form.age}
                    onChange={(e) => updateField('age', parseInt(e.target.value) || 0)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="gender">Gender *</label>
                  <select
                    id="gender"
                    value={form.gender}
                    onChange={(e) => updateField('gender', e.target.value)}
                    required
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="merchant_category">Merchant Category *</label>
                  <select
                    id="merchant_category"
                    value={form.merchant_category}
                    onChange={(e) => updateField('merchant_category', e.target.value)}
                    required
                  >
                    {MERCHANT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="transaction_type">Transaction Type *</label>
                  <select
                    id="transaction_type"
                    value={form.transaction_type}
                    onChange={(e) => updateField('transaction_type', e.target.value)}
                    required
                  >
                    {TRANSACTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="card_type">Card Type *</label>
                  <select
                    id="card_type"
                    value={form.card_type}
                    onChange={(e) => updateField('card_type', e.target.value)}
                    required
                  >
                    {CARD_TYPES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="device_type">Device Type *</label>
                  <select
                    id="device_type"
                    value={form.device_type}
                    onChange={(e) => updateField('device_type', e.target.value)}
                    required
                  >
                    {DEVICE_TYPES.map((d) => (
                      <option key={d} value={d}>
                        {d.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="card_present">Card Present *</label>
                  <select
                    id="card_present"
                    value={form.card_present}
                    onChange={(e) => updateField('card_present', parseInt(e.target.value))}
                    required
                  >
                    <option value={1}>Yes (1)</option>
                    <option value={0}>No (0)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="distance_from_home">Distance from Home (km) *</label>
                  <input
                    id="distance_from_home"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.distance_from_home}
                    onChange={(e) => updateField('distance_from_home', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="distance_from_last">Distance from Last Txn (km) *</label>
                  <input
                    id="distance_from_last"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.distance_from_last_transaction}
                    onChange={(e) => updateField('distance_from_last_transaction', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="high_risk_country">High Risk Country *</label>
                  <select
                    id="high_risk_country"
                    value={form.high_risk_country}
                    onChange={(e) => updateField('high_risk_country', parseInt(e.target.value))}
                    required
                  >
                    <option value={0}>No (0)</option>
                    <option value={1}>Yes (1)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="velocity">Velocity (24h) *</label>
                  <input
                    id="velocity"
                    type="number"
                    min="0"
                    value={form.velocity_last_24h}
                    onChange={(e) => updateField('velocity_last_24h', parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="review-submit-btn" disabled={submitting}>
                  {submitting ? 'Analyzing...' : 'Analyze Transaction'}
                </button>
                <button type="button" className="back-button" onClick={handleReset} disabled={submitting}>
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Results Panel */}
        <div className="card">
          <div className="card-header">
            <h3>Prediction Results</h3>
          </div>
          <div className="card-body">
            {error && (
              <div className="error-state" style={{ padding: '1rem' }}>
                <p>Error: {error}</p>
              </div>
            )}

            {!result && !error && (
              <div className="empty-state">
                <p>Submit a transaction to see ML model prediction results.</p>
              </div>
            )}

            {result && (
              <div className="prediction-result">
                <div className="result-highlight">
                  <div className="detail-field">
                    <label>Transaction ID</label>
                    <span className="value" style={{ fontFamily: 'monospace' }}>
                      {result.transaction_id}
                    </span>
                  </div>

                  <div className="detail-field">
                    <label>Fraud Probability</label>
                    <span className="value" style={{ fontSize: '2rem', fontWeight: 700 }}>
                      {(result.fraud_probability * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="detail-field">
                    <label>Risk Score</label>
                    <span className="value" style={{ fontSize: '2rem', fontWeight: 700 }}>
                      {result.risk_score}
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                        {' '}/ 100
                      </span>
                    </span>
                  </div>

                  <div className="detail-field">
                    <label>Risk Level</label>
                    <RiskBadge level={result.risk_level} />
                  </div>

                  <div className="detail-field">
                    <label>Automated Decision</label>
                    <span className="value" style={{ fontWeight: 600 }}>
                      {result.decision}
                    </span>
                  </div>

                  {result.anomaly && (
                    <div className="detail-field">
                      <label>Anomaly Detection</label>
                      <span className="value">
                        {result.anomaly.is_anomaly ? 'Anomalous' : 'Normal'} ({result.anomaly.anomaly_label})
                      </span>
                    </div>
                  )}
                </div>

                {result.triggered_risk_factors.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: 8 }}>Triggered Risk Factors</h4>
                    <ul className="risk-factors-list">
                      {result.triggered_risk_factors.map((factor, i) => (
                        <li key={i}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
