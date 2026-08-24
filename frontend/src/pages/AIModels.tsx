import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  getAiModels,
  getModelPerformance,
  getRiskThresholds,
  updateRiskThresholds,
  toggleModelStatus,
} from '../services/api'
import type { AiModel, ModelPerformancePoint, RiskThresholds } from '../types'

export default function AIModels() {
  const [models, setModels] = useState<AiModel[]>([])
  const [performance, setPerformance] = useState<ModelPerformancePoint[]>([])
  const [thresholds, setThresholds] = useState<RiskThresholds>({
    overall_risk_sensitivity: 35,
    high_risk_threshold: 70,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [trainingCount] = useState(1)
  const [predictionsToday] = useState(12648)

  const load = useCallback(async () => {
    try {
      const [m, p, t] = await Promise.all([
        getAiModels(),
        getModelPerformance(),
        getRiskThresholds(),
      ])
      setModels(m)
      setPerformance(p)
      setThresholds(t)
    } catch {
      setModels([
        { id: 'if', name: 'Isolation Forest', description: 'Detects anomalies by isolating unusual patterns.', accuracy: 95.6, status: 'active', type: 'primary', last_updated: '2h ago' },
        { id: 'lof', name: 'Local Outlier Factor', description: 'Finds local outliers based on density deviation.', accuracy: 92.1, status: 'active', type: 'standard', last_updated: '1d ago' },
        { id: 'dbscan', name: 'DBSCAN', description: 'Cluster-based detection for noise and outliers.', accuracy: 89.3, status: 'active', type: 'standard', last_updated: '3d ago' },
        { id: 'rf', name: 'Random Forest Classifier', description: 'Supervised model for risk classification.', accuracy: 94.8, status: 'active', type: 'secondary', last_updated: '5h ago' },
        { id: 'nn', name: 'Neural Network Model', description: 'Deep learning model for complex patterns.', accuracy: 89.2, status: 'training', type: 'standard', last_updated: 'Just now' },
      ])
      setPerformance([
        { date: '24 May', isolationForest: 95.2, lof: 91.8, dbscan: 89.0, randomForest: 94.5 },
        { date: '25 May', isolationForest: 95.4, lof: 91.5, dbscan: 88.8, randomForest: 94.6 },
        { date: '26 May', isolationForest: 95.1, lof: 92.0, dbscan: 89.2, randomForest: 94.7 },
        { date: '27 May', isolationForest: 95.3, lof: 91.9, dbscan: 89.1, randomForest: 94.5 },
        { date: '28 May', isolationForest: 95.5, lof: 92.1, dbscan: 89.3, randomForest: 94.8 },
        { date: '29 May', isolationForest: 95.6, lof: 92.1, dbscan: 89.3, randomForest: 94.8 },
      ])
      setThresholds({ overall_risk_sensitivity: 35, high_risk_threshold: 70 })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateRiskThresholds(thresholds.overall_risk_sensitivity, thresholds.high_risk_threshold)
    } catch { /* ok */ }
    setSaving(false)
  }

  const handleToggle = async (modelId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    setModels(prev => prev.map(m => m.id === modelId ? { ...m, status: newStatus } : m))
    try { await toggleModelStatus(modelId, newStatus) } catch {}
  }

  const activeModels = models.filter(m => m.status === 'active')
  const filteredModels = statusFilter === 'All Status' ? models : models.filter(m => m.status === statusFilter.toLowerCase())

  const sensitivityLabel = thresholds.overall_risk_sensitivity <= 30 ? 'Low' : thresholds.overall_risk_sensitivity <= 60 ? 'Medium' : 'High'

  return (
    <div className="ai-models-page">
      <div className="ai-header">
        <div className="ai-header-left">
          <h1>AI Models & Settings</h1>
          <p className="ai-subtitle">Manage and configure AI models used for risk detection and fraud prevention.</p>
        </div>
        <button className="ai-add-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add New Model
        </button>
      </div>

      <div className="ai-kpi-grid">
        <div className="ai-kpi-card">
          <div className="ai-kpi-content">
            <span className="ai-kpi-label">Active Models</span>
            <div className="ai-kpi-value-row">
              <span className="ai-kpi-value">{activeModels.length}</span>
              <span className="ai-kpi-unit">/ {models.length} Total</span>
            </div>
            <span className="ai-kpi-sub">2 models updated this week</span>
          </div>
          <div className="ai-kpi-icon purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.57-3.25 3.93" />
              <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.57 3.25 3.93" />
              <path d="M12 9.93V14" />
              <path d="M9 18l3 4 3-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
        </div>

        <div className="ai-kpi-card">
          <div className="ai-kpi-content">
            <span className="ai-kpi-label">Model Performance</span>
            <div className="ai-kpi-value-row">
              <span className="ai-kpi-value">94.2</span>
              <span className="ai-kpi-unit">%</span>
            </div>
            <span className="ai-kpi-sub">Average Accuracy</span>
            <span className="ai-kpi-change up">+ 3.4% vs last week</span>
          </div>
          <div className="ai-kpi-sparkline green">
            <svg viewBox="0 0 80 35" fill="none">
              <path d="M0 28 Q12 26, 20 22 T40 12 T60 8 T80 5" stroke="#10b981" strokeWidth="2" fill="none" />
            </svg>
          </div>
        </div>

        <div className="ai-kpi-card">
          <div className="ai-kpi-content">
            <span className="ai-kpi-label">Predictions Today</span>
            <div className="ai-kpi-value-row">
              <span className="ai-kpi-value">{predictionsToday.toLocaleString()}</span>
            </div>
            <span className="ai-kpi-sub">Total Predictions</span>
            <span className="ai-kpi-change up">+ 18.6% vs yesterday</span>
          </div>
          <div className="ai-kpi-sparkline blue">
            <svg viewBox="0 0 80 35" fill="none">
              <path d="M0 30 Q15 25, 25 20 T45 10 T65 8 T80 3" stroke="#3b82f6" strokeWidth="2" fill="none" />
            </svg>
          </div>
        </div>

        <div className="ai-kpi-card">
          <div className="ai-kpi-content">
            <span className="ai-kpi-label">Models in Training</span>
            <div className="ai-kpi-value-row">
              <span className="ai-kpi-value">{trainingCount}</span>
            </div>
            <span className="ai-kpi-sub">Active Now</span>
            <span className="ai-kpi-eta">ETA: 00:28:15</span>
          </div>
          <div className="ai-kpi-icon orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </div>
        </div>
      </div>

      <div className="ai-main-grid">
        <div className="ai-thresholds-card">
          <div className="ai-card-header">
            <div>
              <h3>Risk Thresholds</h3>
              <p className="ai-card-subtitle">Adjust sensitivity of fraud detection models.</p>
            </div>
          </div>
          <div className="ai-sliders">
            <div className="ai-slider-group">
              <label className="ai-slider-label">Overall Risk Sensitivity</label>
              <div className="ai-slider-value">
                <span className="ai-slider-pct" style={{ color: '#10b981' }}>{sensitivityLabel} ({thresholds.overall_risk_sensitivity}%)</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={thresholds.overall_risk_sensitivity}
                onChange={e => setThresholds(prev => ({ ...prev, overall_risk_sensitivity: Number(e.target.value) }))}
                className="ai-range green"
              />
              <div className="ai-range-labels">
                <span>0%</span>
                <span>100%</span>
              </div>
              <span className="ai-range-hint">Low Sensitivity ← → High Sensitivity</span>
            </div>
            <div className="ai-slider-group">
              <label className="ai-slider-label">High Risk Threshold</label>
              <div className="ai-slider-value">
                <span className="ai-slider-pct red">{thresholds.high_risk_threshold}%</span>
              </div>
              <input
                type="range"
                min={30}
                max={100}
                value={thresholds.high_risk_threshold}
                onChange={e => setThresholds(prev => ({ ...prev, high_risk_threshold: Number(e.target.value) }))}
                className="ai-range red"
              />
              <div className="ai-range-labels">
                <span>30%</span>
                <span>100%</span>
              </div>
              <span className="ai-range-hint">Reclassify above threshold as high risk.</span>
            </div>
          </div>

          <div className="ai-risk-levels">
            <div className="ai-level-box green">
              <span className="ai-level-name">Low Risk</span>
              <span className="ai-level-range">0% - 35%</span>
              <span className="ai-level-desc">Minimal risk level</span>
            </div>
            <div className="ai-level-box yellow">
              <span className="ai-level-name">Medium Risk</span>
              <span className="ai-level-range">35% - 70%</span>
              <span className="ai-level-desc">Monitor closely</span>
            </div>
            <div className="ai-level-box red">
              <span className="ai-level-name">High Risk</span>
              <span className="ai-level-range">70% - 100%</span>
              <span className="ai-level-desc">Immediate action</span>
            </div>
          </div>

          <button className="ai-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Thresholds'}
          </button>
        </div>

        <div className="ai-models-card">
          <div className="ai-card-header">
            <h3>AI Models Overview</h3>
            <p className="ai-card-subtitle">View and manage all risk detection models.</p>
          </div>
          <div className="ai-model-filter">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="ai-filter-select"
            >
              <option>All Status</option>
              <option>Active</option>
              <option>Training</option>
              <option>Inactive</option>
            </select>
          </div>
          <div className="ai-model-list">
            {filteredModels.map(model => (
              <div key={model.id} className="ai-model-item">
                <div className="ai-model-icon-wrap">
                  <div className={`ai-model-icon ${model.id}`}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.57-3.25 3.93" />
                      <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.57 3.25 3.93" />
                      <path d="M12 9.93V14" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  </div>
                </div>
                <div className="ai-model-body">
                  <div className="ai-model-top">
                    <div className="ai-model-name-row">
                      <span className="ai-model-name">{model.name}</span>
                      {model.type === 'primary' && <span className="ai-model-tag primary">Primary</span>}
                      {model.type === 'secondary' && <span className="ai-model-tag secondary">Secondary</span>}
                    </div>
                    <div className="ai-model-toggle">
                      <span className="ai-model-status">{model.status === 'active' ? 'Status' : 'Status'}</span>
                      <label className="ai-switch">
                        <input
                          type="checkbox"
                          checked={model.status === 'active'}
                          onChange={() => handleToggle(model.id, model.status)}
                          disabled={model.status === 'training'}
                        />
                        <span className="ai-slider-track" />
                      </label>
                    </div>
                  </div>
                  <p className="ai-model-desc">{model.description}</p>
                  <div className="ai-model-meta">
                    <span className="ai-model-accuracy">
                      {model.accuracy ? (
                        <>
                          <span className="ai-accuracy-label">Accuracy</span>
                          <span className="ai-accuracy-val">{model.accuracy}%</span>
                        </>
                      ) : (
                        <span className="ai-model-status-text training">Training</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <button className="ai-add-model-btn">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Model
            </button>
          </div>
        </div>
      </div>

      <div className="ai-bottom-grid">
        <div className="ai-performance-card">
          <div className="ai-card-header">
            <div>
              <h3>Model Performance Over Time</h3>
              <p className="ai-card-subtitle">Accuracy trend of active models in the last 30 days.</p>
            </div>
            <select className="ai-perf-range">
              <option>Last 30 Days</option>
              <option>Last 7 Days</option>
              <option>Last 90 Days</option>
            </select>
          </div>
          <div className="ai-perf-chart">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={performance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} domain={[80, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: '#151c2c', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }}
                  formatter={(val) => [`${Number(val).toFixed(1)}%`]}
                />
                <Line type="monotone" dataKey="isolationForest" stroke="#7c3aed" strokeWidth={2} dot={false} name="Isolation Forest" />
                <Line type="monotone" dataKey="lof" stroke="#06b6d4" strokeWidth={2} dot={false} name="Local Outlier Factor" />
                <Line type="monotone" dataKey="dbscan" stroke="#f59e0b" strokeWidth={2} dot={false} name="DBSCAN" />
                <Line type="monotone" dataKey="randomForest" stroke="#10b981" strokeWidth={2} dot={false} name="Random Forest" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="ai-perf-legend">
            <span className="ai-legend-item"><span className="ai-legend-dot" style={{ background: '#7c3aed' }} /> Isolation Forest</span>
            <span className="ai-legend-item"><span className="ai-legend-dot" style={{ background: '#06b6d4' }} /> Local Outlier Factor</span>
            <span className="ai-legend-item"><span className="ai-legend-dot" style={{ background: '#f59e0b' }} /> DBSCAN</span>
            <span className="ai-legend-item"><span className="ai-legend-dot" style={{ background: '#10b981' }} /> Random Forest</span>
          </div>
        </div>

        <div className="ai-updates-card">
          <div className="ai-card-header">
            <h3>Recent Model Updates</h3>
            <a href="#" className="ai-view-all">View All</a>
          </div>
          <div className="ai-updates-list">
            <div className="ai-update-item">
              <div className="ai-update-icon green">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="ai-update-body">
                <span className="ai-update-text">Isolation Forest model updated</span>
                <span className="ai-update-desc">Improved anomaly detection threshold</span>
              </div>
              <span className="ai-update-time">2h ago</span>
            </div>
            <div className="ai-update-item">
              <div className="ai-update-icon blue">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </div>
              <div className="ai-update-body">
                <span className="ai-update-text">Random Forest retrained</span>
                <span className="ai-update-desc">Added new transaction features</span>
              </div>
              <span className="ai-update-time">1d ago</span>
            </div>
            <div className="ai-update-item">
              <div className="ai-update-icon yellow">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              <div className="ai-update-body">
                <span className="ai-update-text">DBSCAN parameters tuned</span>
                <span className="ai-update-desc">Optimized cluster detection</span>
              </div>
              <span className="ai-update-time">2d ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
