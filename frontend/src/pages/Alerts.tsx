import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { getAlerts, getAlertStats, updateAlertStatus } from '../services/api'
import type { ApiAlert, AlertStats } from '../types'

export default function Alerts() {
  const [alerts, setAlerts] = useState<ApiAlert[]>([])
  const [stats, setStats] = useState<AlertStats | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [activeTab])

  async function loadData() {
    try {
      setLoading(true)
      const statusFilter = activeTab === 'all' ? undefined : activeTab.toUpperCase()
      const [alertsData, statsData] = await Promise.all([
        getAlerts({ status: statusFilter, limit: 100 }),
        getAlertStats(),
      ])
      setAlerts(alertsData.alerts)
      setTotal(alertsData.total)
      setStats(statsData)
    } catch (err: any) {
      setError(err.message || 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusUpdate(alertId: number, newStatus: string) {
    try {
      setUpdatingId(alertId)
      await updateAlertStatus(alertId, newStatus)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to update alert')
    } finally {
      setUpdatingId(null)
    }
  }

  const summaryData = stats ? [
    { name: 'Open', value: stats.open, color: '#ef4444' },
    { name: 'Reviewed', value: stats.reviewed, color: '#f59e0b' },
    { name: 'Confirmed', value: stats.confirmed_fraud, color: '#dc2626' },
    { name: 'False Positive', value: stats.false_positive, color: '#10b981' },
  ] : []

  function getIcon(type: string) {
    switch (type) {
      case 'HIGH':
        return (
          <div className="alert-icon high">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        )
      case 'MEDIUM':
        return (
          <div className="alert-icon medium">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="alert-icon low">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
        )
    }
  }

  function getStatusActions(alert: ApiAlert) {
    if (alert.status === 'CONFIRMED_FRAUD' || alert.status === 'FALSE_POSITIVE') {
      return <span className="alert-status-final">{alert.status.replace('_', ' ')}</span>
    }
    return (
      <div className="alert-actions">
        <button
          className="alert-action-btn confirm"
          onClick={() => handleStatusUpdate(alert.id, 'CONFIRMED_FRAUD')}
          disabled={updatingId === alert.id}
        >
          Confirm Fraud
        </button>
        <button
          className="alert-action-btn dismiss"
          onClick={() => handleStatusUpdate(alert.id, 'FALSE_POSITIVE')}
          disabled={updatingId === alert.id}
        >
          False Positive
        </button>
        <button
          className="alert-action-btn review"
          onClick={() => handleStatusUpdate(alert.id, 'REVIEWED')}
          disabled={updatingId === alert.id}
        >
          Mark Reviewed
        </button>
      </div>
    )
  }

  if (loading && alerts.length === 0) {
    return (
      <div className="alerts-page">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading alerts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="alerts-page">
      <div className="alerts-header">
        <h1>Alerts & Notifications</h1>
        <span className="alert-count">{total} total alerts</span>
      </div>

      {error && (
        <div className="upload-error">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="alerts-content">
        <div className="alerts-main">
          <div className="alerts-tabs">
            <button
              className={`alert-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All ({stats?.total || 0})
            </button>
            <button
              className={`alert-tab ${activeTab === 'open' ? 'active' : ''}`}
              onClick={() => setActiveTab('open')}
            >
              Open ({stats?.open || 0})
            </button>
            <button
              className={`alert-tab ${activeTab === 'reviewed' ? 'active' : ''}`}
              onClick={() => setActiveTab('reviewed')}
            >
              Reviewed ({stats?.reviewed || 0})
            </button>
            <button
              className={`alert-tab ${activeTab === 'CONFIRMED_FRAUD' ? 'active' : ''}`}
              onClick={() => setActiveTab('CONFIRMED_FRAUD')}
            >
              Confirmed ({stats?.confirmed_fraud || 0})
            </button>
            <button
              className={`alert-tab ${activeTab === 'FALSE_POSITIVE' ? 'active' : ''}`}
              onClick={() => setActiveTab('FALSE_POSITIVE')}
            >
              False Pos ({stats?.false_positive || 0})
            </button>
          </div>

          <div className="alerts-list">
            {alerts.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <p>No alerts found</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className={`alert-item ${alert.risk_level.toLowerCase()}`}>
                  {getIcon(alert.risk_level)}
                  <div className="alert-content">
                    <div className="alert-main-info">
                      <h4>
                        {alert.risk_level} Risk Alert
                        <span className="alert-txn-id">{alert.transaction_id}</span>
                      </h4>
                      {alert.amount && (
                        <span className="alert-amount">${alert.amount.toLocaleString()}</span>
                      )}
                    </div>
                    {alert.reason && alert.reason.length > 0 && (
                      <div className="alert-reasons">
                        {alert.reason.map((r, i) => (
                          <span key={i} className="alert-reason-tag">{r}</span>
                        ))}
                      </div>
                    )}
                    <div className="alert-meta">
                      <span className="alert-score">Score: {alert.risk_score}</span>
                      <span className="alert-time">
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                    </div>
                    {getStatusActions(alert)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="alerts-sidebar">
          <div className="alert-summary-card">
            <h3>Alert Summary</h3>
            {stats && (
              <>
                <div className="donut-chart-container">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie
                        data={summaryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {summaryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center">
                    <span className="donut-total">{stats.total}</span>
                    <span className="donut-label">Total</span>
                  </div>
                </div>
                <div className="summary-legend">
                  {summaryData.map((item, index) => (
                    <div key={index} className="legend-item">
                      <span className="legend-dot" style={{ background: item.color }} />
                      <span className="legend-name">{item.name}</span>
                      <span className="legend-value">({item.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="alert-stats-card">
            <h3>Quick Stats</h3>
            {stats && (
              <div className="quick-stats">
                <div className="quick-stat">
                  <span className="quick-stat-label">High Risk</span>
                  <span className="quick-stat-value high">{stats.high_risk}</span>
                </div>
                <div className="quick-stat">
                  <span className="quick-stat-label">Medium Risk</span>
                  <span className="quick-stat-value medium">{stats.medium_risk}</span>
                </div>
                <div className="quick-stat">
                  <span className="quick-stat-label">Pending Action</span>
                  <span className="quick-stat-value">{stats.open}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
