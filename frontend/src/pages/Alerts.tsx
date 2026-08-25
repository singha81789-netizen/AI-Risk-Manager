import { useState, useEffect, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { getAlerts, getAlertStats, updateAlertStatus } from '../services/api'
import { useToast } from '../components/common/Toast'
import Modal from '../components/common/Modal'
import type { ApiAlert, AlertStats } from '../types'

type SortOption = 'newest' | 'amount' | 'risk_score'

const TAG_EXPLANATIONS: Record<string, string> = {
  high_velocity: 'Many transactions in a short time period',
  distance_anomaly: 'Transaction location is far from the user\'s usual area',
  high_amount: 'Transaction amount is unusually large',
  new_device: 'Transaction from an unrecognized device',
  watchlist_match: 'User or merchant is on the fraud watchlist',
  unusual_time: 'Transaction occurred at an unusual hour',
  multiple_failed: 'Multiple failed attempts before success',
  new_beneficiary: 'First-time transfer to this recipient',
  geo_mismatch: 'Location doesn\'t match card issuer country',
  velocity: 'High transaction frequency detected',
  location: 'Transaction from an unusual location',
  amount: 'Transaction amount exceeds normal pattern',
  device: 'New or unrecognized device used',
}

const PAGE_SIZE = 10

export default function Alerts() {
  const [alerts, setAlerts] = useState<ApiAlert[]>([])
  const [stats, setStats] = useState<AlertStats | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingAction, setPendingAction] = useState<{ alert: ApiAlert; status: string } | null>(null)
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    loadData()
  }, [activeTab])

  async function loadData() {
    try {
      setLoading(true)
      const statusFilter = activeTab === 'all' ? undefined : activeTab.toUpperCase()
      const [alertsData, statsData] = await Promise.all([
        getAlerts({ status: statusFilter, limit: 200 }),
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
      showToast('Alert updated successfully', 'success')
    } catch (err: any) {
      setError(err.message || 'Failed to update alert')
      showToast('Failed to update alert', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  function confirmAction(alert: ApiAlert, status: string) {
    setPendingAction({ alert, status })
  }

  function executeConfirmedAction() {
    if (pendingAction) {
      handleStatusUpdate(pendingAction.alert.id, pendingAction.status)
      setPendingAction(null)
    }
  }

  // Filter and sort
  const filteredAlerts = useMemo(() => {
    let result = [...alerts]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(a =>
        a.transaction_id.toLowerCase().includes(q) ||
        (a.amount && a.amount.toString().includes(q)) ||
        (a.reason && a.reason.some(r => r.toLowerCase().includes(q)))
      )
    }

    switch (sortBy) {
      case 'amount':
        result.sort((a, b) => (b.amount || 0) - (a.amount || 0))
        break
      case 'risk_score':
        result.sort((a, b) => b.risk_score - a.risk_score)
        break
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    return result
  }, [alerts, searchQuery, sortBy])

  const totalPages = Math.ceil(filteredAlerts.length / PAGE_SIZE)
  const paginatedAlerts = filteredAlerts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Reset page on search/sort change
  useEffect(() => { setCurrentPage(1) }, [searchQuery, sortBy])

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
          onClick={() => confirmAction(alert, 'CONFIRMED_FRAUD')}
          disabled={updatingId === alert.id}
        >
          Confirm Fraud
        </button>
        <button
          className="alert-action-btn dismiss"
          onClick={() => confirmAction(alert, 'FALSE_POSITIVE')}
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
          {/* Search and Sort Bar */}
          <div className="alerts-controls">
            <div className="alerts-search">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search by Transaction ID, amount, or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="alerts-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <option value="newest">Newest First</option>
              <option value="amount">Highest Amount</option>
              <option value="risk_score">Highest Risk Score</option>
            </select>
          </div>

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
            {paginatedAlerts.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <p>No alerts found</p>
              </div>
            ) : (
              paginatedAlerts.map((alert) => (
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
                          <span
                            key={i}
                            className="alert-reason-tag clickable"
                            onClick={() => setActiveTooltip(activeTooltip === r ? null : r)}
                          >
                            {r}
                            {activeTooltip === r && (
                              <span className="reason-tooltip">
                                {TAG_EXPLANATIONS[r] || 'Risk factor contributing to the alert'}
                              </span>
                            )}
                          </span>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="alerts-pagination">
              <span className="pagination-info">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredAlerts.length)} of {filteredAlerts.length}
              </span>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const page = currentPage <= 3 ? i + 1 : currentPage + i - 2
                  if (page < 1 || page > totalPages) return null
                  return (
                    <button
                      key={page}
                      className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  )
                })}
                <button
                  className="pagination-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
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

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={executeConfirmedAction}
        title={pendingAction?.status === 'CONFIRMED_FRAUD' ? 'Confirm Fraud' : 'Mark as False Positive'}
        confirmText={pendingAction?.status === 'CONFIRMED_FRAUD' ? 'Yes, Confirm Fraud' : 'Yes, Mark False Positive'}
        confirmColor={pendingAction?.status === 'CONFIRMED_FRAUD' ? 'danger' : 'warning'}
      >
        {pendingAction && (
          <>
            <p>Are you sure you want to mark this alert as <strong>{pendingAction.status.replace('_', ' ')}</strong>?</p>
            <div className="modal-detail">
              <span>Transaction ID</span>
              <strong>{pendingAction.alert.transaction_id}</strong>
            </div>
            {pendingAction.alert.amount && (
              <div className="modal-detail">
                <span>Amount</span>
                <strong>${pendingAction.alert.amount.toLocaleString()}</strong>
              </div>
            )}
            <div className="modal-detail">
              <span>Risk Score</span>
              <strong>{pendingAction.alert.risk_score}</strong>
            </div>
            <div className="modal-detail">
              <span>Risk Level</span>
              <strong>{pendingAction.alert.risk_level}</strong>
            </div>
            <p style={{ marginTop: 12, fontSize: '0.82rem', color: '#94a3b8' }}>
              This action cannot be undone.
            </p>
          </>
        )}
      </Modal>
    </div>
  )
}
