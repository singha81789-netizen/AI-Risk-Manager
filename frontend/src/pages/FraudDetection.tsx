import { useState } from 'react'
import { updateThresholds } from '../services/api'

export default function FraudDetection() {
  const [mediumThreshold, setMediumThreshold] = useState(35)
  const [highThreshold, setHighThreshold] = useState(70)
  const [updating, setUpdating] = useState(false)
  const [result, setResult] = useState<{ updated: number; alerts_created: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleUpdate() {
    const med = mediumThreshold / 100
    const high = highThreshold / 100

    if (med >= high) {
      setError('Medium threshold must be less than high threshold')
      return
    }
    if (med <= 0 || high > 1) {
      setError('Thresholds must be between 1 and 100')
      return
    }

    try {
      setUpdating(true)
      setError(null)
      const res = await updateThresholds(med, high)
      setResult(res)
    } catch (err: any) {
      setError(err.message || 'Failed to update thresholds')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="fraud-detection-page">
      <div className="fraud-detection-header">
        <h1>AI Models & Settings</h1>
      </div>

      <div className="fraud-content">
        <div className="threshold-card">
          <h3>Risk Thresholds</h3>
          <p className="threshold-description">
            Adjust the sensitivity of the fraud detection model. Changes will reclassify
            all existing transactions without re-running the ML pipeline.
          </p>

          <div className="threshold-controls">
            <div className="threshold-group">
              <label>
                Medium Risk Threshold
                <span className="threshold-value">{mediumThreshold}%</span>
              </label>
              <input
                type="range"
                min="10"
                max="80"
                value={mediumThreshold}
                onChange={(e) => setMediumThreshold(Number(e.target.value))}
                className="threshold-slider medium"
              />
              <div className="threshold-labels">
                <span>Low sensitivity (10%)</span>
                <span>High sensitivity (80%)</span>
              </div>
            </div>

            <div className="threshold-group">
              <label>
                High Risk Threshold
                <span className="threshold-value">{highThreshold}%</span>
              </label>
              <input
                type="range"
                min="30"
                max="95"
                value={highThreshold}
                onChange={(e) => setHighThreshold(Number(e.target.value))}
                className="threshold-slider high"
              />
              <div className="threshold-labels">
                <span>Low sensitivity (30%)</span>
                <span>High sensitivity (95%)</span>
              </div>
            </div>
          </div>

          <div className="threshold-preview">
            <div className="preview-segment low">
              <span>LOW</span>
              <span className="preview-range">0 - {mediumThreshold}%</span>
            </div>
            <div className="preview-segment medium">
              <span>MEDIUM</span>
              <span className="preview-range">{mediumThreshold}% - {highThreshold}%</span>
            </div>
            <div className="preview-segment high">
              <span>HIGH</span>
              <span className="preview-range">{highThreshold}% - 100%</span>
            </div>
          </div>

          <button
            className="btn-primary threshold-btn"
            onClick={handleUpdate}
            disabled={updating}
          >
            {updating ? 'Updating...' : 'Apply Thresholds'}
          </button>

          {error && (
            <div className="threshold-error">{error}</div>
          )}

          {result && (
            <div className="threshold-result">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div>
                <strong>Thresholds updated successfully</strong>
                <p>{result.updated} transactions reclassified, {result.alerts_created} new alerts created</p>
              </div>
            </div>
          )}
        </div>

        <div className="model-info-card">
          <h3>Ensemble Models</h3>
          <div className="model-list">
            <div className="model-item">
              <div className="model-icon iforest">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12l2 2 4-4" />
                </svg>
              </div>
              <div className="model-details">
                <h4>Isolation Forest</h4>
                <p>Primary anomaly detector — isolates unusual observations</p>
                <span className="model-weight">Weight: 50%</span>
              </div>
            </div>

            <div className="model-item">
              <div className="model-icon lof">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div className="model-details">
                <h4>Local Outlier Factor</h4>
                <p>Density-based detection — finds points in low-density regions</p>
                <span className="model-weight">Weight: 30%</span>
              </div>
            </div>

            <div className="model-item">
              <div className="model-icon dbscan">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="8" cy="8" r="3" />
                  <circle cx="16" cy="16" r="3" />
                  <circle cx="16" cy="8" r="2" />
                  <circle cx="8" cy="16" r="2" />
                </svg>
              </div>
              <div className="model-details">
                <h4>DBSCAN</h4>
                <p>Cluster-based detection — identifies noise points outside clusters</p>
                <span className="model-weight">Weight: 20%</span>
              </div>
            </div>

            <div className="model-item">
              <div className="model-icon rf">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.57-3.25 3.93" />
                  <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.57 3.25 3.93" />
                  <path d="M12 9.93V14" />
                  <path d="M9 18l3 4 3-4" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
              <div className="model-details">
                <h4>Random Forest (Supervised)</h4>
                <p>Primary fraud classifier — learns from labeled historical data</p>
                <span className="model-weight">Primary scorer</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
