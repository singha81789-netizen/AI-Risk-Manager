import { useState, useEffect, useRef, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'
import { getDashboardStats } from '../services/api'
import type { ApiDashboardStats } from '../types'

function useCountUp(target: number, duration = 1200, enabled = true): number {
  const [value, setValue] = useState(0)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled || target === 0) {
      setValue(target)
      return
    }
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration, enabled])

  return value
}

type DateRange = '1d' | '7d' | '30d' | 'custom'

export default function Dashboard() {
  const [stats, setStats] = useState<ApiDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('7d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const loadStats = useCallback(async () => {
    try {
      setLoading(true)
      const params: { days?: number; start_date?: string; end_date?: string } = {}
      if (dateRange === '1d') params.days = 1
      else if (dateRange === '7d') params.days = 7
      else if (dateRange === '30d') params.days = 30
      else if (dateRange === 'custom' && customStart && customEnd) {
        params.start_date = customStart
        params.end_date = customEnd
      }
      const data = await getDashboardStats(params)
      setStats(data)
      setLastUpdated(new Date())
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [dateRange, customStart, customEnd])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const totalTx = stats?.totalTransactions ?? 0
  const flaggedTx = stats?.flaggedTransactions ?? 0
  const approvedTx = stats?.approvedTransactions ?? 0
  const avgRisk = stats?.averageRiskScore ?? 0

  const animTotal = useCountUp(totalTx, 1200, !loading)
  const animFlagged = useCountUp(flaggedTx, 1200, !loading)
  const animApproved = useCountUp(approvedTx, 1200, !loading)
  const animAvgRisk = useCountUp(Math.round(avgRisk), 1200, !loading)

  const rangeLabel = dateRange === '1d' ? 'Today'
    : dateRange === '7d' ? 'Last 7 Days'
    : dateRange === '30d' ? 'Last 30 Days'
    : customStart && customEnd ? `${customStart} to ${customEnd}`
    : 'Custom Range'

  if (loading && !stats) {
    return (
      <div className="dashboard-page">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="dashboard-page">
        <div className="error-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <p>{error}</p>
          <button onClick={loadStats} className="retry-btn">Retry</button>
        </div>
      </div>
    )
  }

  if (!stats) return null

  const distributionData = [
    { name: 'Low Risk', value: stats.lowRiskCount, color: '#10b981' },
    { name: 'Medium Risk', value: stats.mediumRiskCount, color: '#f59e0b' },
    { name: 'High Risk', value: stats.highRiskCount, color: '#ef4444' },
  ]

  const categoryData = stats.categoryRisk.map(c => ({
    name: c.category,
    count: c.transactionCount,
    avgScore: c.riskScore,
  }))

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <h1>Dashboard</h1>
          <div className="date-range-filter">
            {(['1d', '7d', '30d', 'custom'] as DateRange[]).map((range) => (
              <button
                key={range}
                className={`date-range-btn ${dateRange === range ? 'active' : ''}`}
                onClick={() => setDateRange(range)}
              >
                {range === '1d' ? 'Today' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'Custom'}
              </button>
            ))}
            {dateRange === 'custom' && (
              <div className="custom-date-inputs">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="custom-date-input"
                />
                <span className="date-separator">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="custom-date-input"
                />
              </div>
            )}
          </div>
        </div>
        <div className="dashboard-header-right">
          {lastUpdated && (
            <span className="last-updated">
              Last updated: {lastUpdated.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })} {lastUpdated.toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit', hour12: true,
              })}
            </span>
          )}
          <button onClick={loadStats} className="refresh-btn" disabled={loading}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className={loading ? 'spinning' : ''}>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="dashboard-stats-grid">
        <div className="dashboard-stat-card">
          <div className="stat-icon purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Transactions</span>
            <span className="stat-value">{animTotal.toLocaleString()}</span>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="stat-icon red">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">
              Flagged Transactions
              <span className="info-tooltip">
                <span className="info-tooltip-icon">i</span>
                <span className="info-tooltip-content">
                  Transactions flagged by our AI as potentially risky (high or medium risk). Industry average is 2-8% of all transactions.
                </span>
              </span>
            </span>
            <span className="stat-value">{animFlagged.toLocaleString()}</span>
            <span className="stat-sublabel">{stats.highRiskCount} high risk</span>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="stat-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">Approved</span>
            <span className="stat-value">{animApproved.toLocaleString()}</span>
            <span className="stat-sublabel">Transactions safe</span>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="stat-icon orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">
              Avg Risk Score
              <span className="info-tooltip">
                <span className="info-tooltip-icon">i</span>
                <span className="info-tooltip-content">
                  The average risk score (0-100) across all transactions. Higher scores indicate greater fraud risk. Typical range is 20-40.
                </span>
              </span>
            </span>
            <span className="stat-value">{animAvgRisk} <span className="stat-unit">/100</span></span>
            <span className="stat-sublabel">{stats.pendingReview} pending review</span>
          </div>
        </div>
      </div>

      <div className="dashboard-charts-row">
        <div className="chart-card risk-overview">
          <h3>Risk Trends ({rangeLabel})</h3>
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-dot" style={{ background: '#10b981' }} />
              Approved
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: '#f59e0b' }} />
              Flagged
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: '#ef4444' }} />
              Declined
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              />
              <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="flagged" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="declined" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card risk-distribution">
          <h3>Risk Distribution</h3>
          <div className="pie-chart-wrapper">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-center">
              <span className="pie-total">{stats.totalTransactions.toLocaleString()}</span>
              <span className="pie-label">Total</span>
            </div>
          </div>
          <div className="distribution-legend">
            {distributionData.map((item, i) => (
              <div key={i} className="legend-row">
                <span className="legend-dot" style={{ background: item.color }} />
                <span className="legend-name">{item.name}</span>
                <span className="legend-value">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card category-risk">
          <h3>Category Risk</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" stroke="#94a3b8" fontSize={11} />
              <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={90} />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats.recentTransactions && stats.recentTransactions.length > 0 && (
        <div className="dashboard-table-card">
          <h3>Recent High-Risk Transactions</h3>
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Risk Score</th>
                <th>Risk Level</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentTransactions.map((txn, i) => (
                <tr key={i}>
                  <td className="txn-id">{txn.transaction_id || 'N/A'}</td>
                  <td className="txn-amount">${(txn.amount || 0).toLocaleString()}</td>
                  <td>{txn.merchant_category || 'N/A'}</td>
                  <td>
                    <span className={`risk-score ${(txn.risk_level || '').toLowerCase()}`}>
                      {txn.risk_score ?? 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className={`risk-level-badge ${(txn.risk_level || '').toLowerCase()}`}>
                      {txn.risk_level || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge-light ${(txn.prediction || '').toLowerCase()}`}>
                      {txn.prediction || 'N/A'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
