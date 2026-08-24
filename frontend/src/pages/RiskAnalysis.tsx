import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { getDashboardStats } from '../services/api'
import type { ApiDashboardStats } from '../types'

const riskFactors = [
  { factor: 'Unusual Location', percentage: 85, color: '#7c3aed' },
  { factor: 'High Transaction Amount', percentage: 76, color: '#f59e0b' },
  { factor: 'New Device Login', percentage: 64, color: '#06b6d4' },
  { factor: 'Multiple Transactions', percentage: 48, color: '#10b981' },
  { factor: 'Watchlist Match', percentage: 35, color: '#ef4444' },
]

const factorIcons: Record<string, string> = {
  'Unusual Location': 'location',
  'High Transaction Amount': 'amount',
  'New Device Login': 'device',
  'Multiple Transactions': 'multi',
  'Watchlist Match': 'watchlist',
}

function getFactorIcon(name: string) {
  switch (factorIcons[name]) {
    case 'location':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#7c3aed" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      )
    case 'amount':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#f59e0b" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      )
    case 'device':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#06b6d4" strokeWidth="2">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      )
    case 'multi':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" strokeWidth="2">
          <polyline points="16 3 21 3 21 8" />
          <line x1="4" y1="20" x2="21" y2="3" />
          <polyline points="21 16 21 21 16 21" />
          <line x1="15" y1="15" x2="21" y2="21" />
        </svg>
      )
    case 'watchlist':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      )
    default:
      return null
  }
}

export default function RiskAnalysis() {
  const [stats, setStats] = useState<ApiDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const avgScore = stats?.averageRiskScore || 0
  const totalTxns = stats?.totalTransactions || 0
  const highCount = stats?.highRiskCount || 0
  const mediumCount = stats?.mediumRiskCount || 0
  const lowCount = stats?.lowRiskCount || 0

  const trendData = (stats?.trends || []).map(t => ({
    day: t.date,
    score: t.avgRiskScore,
  }))

  const distributionData = [
    { name: 'Low Risk', value: lowCount || 1, color: '#10b981' },
    { name: 'Medium Risk', value: mediumCount || 1, color: '#f59e0b' },
    { name: 'High Risk', value: highCount || 1, color: '#ef4444' },
  ]

  const recentHighRisk = (stats?.recentTransactions || []).slice(0, 5)

  return (
    <div className="risk-analysis-page">
      <div className="ra-header">
        <div className="ra-header-left">
          <h1>Risk Analysis</h1>
          <p className="ra-subtitle">Deep insights into risk patterns, trends, and contributing factors.</p>
        </div>
        <div className="ra-header-right">
          <div className="ra-date-picker">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>Last 7 Days</span>
          </div>
          <button className="ra-export-btn">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Report
          </button>
        </div>
      </div>

      <div className="ra-kpi-grid">
        <div className="ra-kpi-card">
          <div className="ra-kpi-content">
            <span className="ra-kpi-label">Overall Risk Score</span>
            <div className="ra-kpi-value-row">
              <span className="ra-kpi-value">{avgScore}</span>
              <span className="ra-kpi-unit">/100</span>
              <span className="ra-kpi-badge high">High Risk</span>
            </div>
            <span className="ra-kpi-change up">from last week</span>
          </div>
          <div className="ra-kpi-icon purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
        </div>

        <div className="ra-kpi-card">
          <div className="ra-kpi-content">
            <span className="ra-kpi-label">Model Confidence</span>
            <div className="ra-kpi-value-row">
              <span className="ra-kpi-value">95.3</span>
              <span className="ra-kpi-unit">%</span>
            </div>
            <span className="ra-kpi-change up">+ 2.1% from last week</span>
          </div>
          <div className="ra-kpi-sparkline">
            <svg viewBox="0 0 80 35" fill="none">
              <path d="M0 30 Q10 28, 20 25 T40 15 T60 10 T80 5" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <div className="ra-kpi-card">
          <div className="ra-kpi-content">
            <span className="ra-kpi-label">Anomalies Detected</span>
            <div className="ra-kpi-value-row">
              <span className="ra-kpi-value red">{highCount + mediumCount || 153}</span>
            </div>
            <span className="ra-kpi-change up">+ 22% from last week</span>
          </div>
        </div>

        <div className="ra-kpi-card">
          <div className="ra-kpi-content">
            <span className="ra-kpi-label">Accuracy</span>
            <div className="ra-kpi-value-row">
              <span className="ra-kpi-value">94.3</span>
              <span className="ra-kpi-unit">%</span>
            </div>
            <span className="ra-kpi-change up">+ 1.8% from last week</span>
          </div>
          <div className="ra-kpi-ring">
            <svg viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="20" fill="none" stroke="#1e293b" strokeWidth="4" />
              <circle cx="25" cy="25" r="20" fill="none" stroke="#06b6d4" strokeWidth="4"
                strokeDasharray="118.8" strokeDashoffset="6.7" strokeLinecap="round"
                transform="rotate(-90 25 25)" />
            </svg>
          </div>
        </div>
      </div>

      <div className="ra-main-grid">
        <div className="ra-trend-card">
          <div className="ra-card-header">
            <div>
              <h3>Risk Score Trend</h3>
              <p className="ra-card-subtitle">Daily average risk score over the last 7 days</p>
            </div>
            <span className="ra-time-badge">7 Days</span>
          </div>
          <div className="ra-trend-chart">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData.length ? trendData : [
                { day: '18 May', score: 42 },
                { day: '19 May', score: 48 },
                { day: '20 May', score: 35 },
                { day: '21 May', score: 55 },
                { day: '22 May', score: 72 },
                { day: '23 May', score: 65 },
                { day: '24 May', score: 76 },
              ]}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: '#151c2c',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#7c3aed"
                  strokeWidth={2.5}
                  fill="url(#scoreGradient)"
                  dot={{ fill: '#7c3aed', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: '#7c3aed', stroke: '#151c2c', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ra-factors-card">
          <div className="ra-card-header">
            <div>
              <h3>Top Risk Factors</h3>
              <p className="ra-card-subtitle">Factors contributing to high risk scores</p>
            </div>
          </div>
          <div className="ra-factors-list">
            {riskFactors.map((factor, index) => (
              <div key={index} className="ra-factor-item">
                <div className="ra-factor-icon">{getFactorIcon(factor.factor)}</div>
                <div className="ra-factor-body">
                  <div className="ra-factor-header">
                    <span className="ra-factor-name">{factor.factor}</span>
                    <span className="ra-factor-pct">{factor.percentage}%</span>
                  </div>
                  <div className="ra-factor-bar">
                    <div
                      className="ra-factor-bar-fill"
                      style={{ width: `${factor.percentage}%`, background: factor.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ra-bottom-grid">
        <div className="ra-recent-card">
          <div className="ra-card-header">
            <h3>Recent High Risk Transactions</h3>
            <a href="/transactions" className="ra-view-all">View All</a>
          </div>
          <table className="ra-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Amount</th>
                <th>Risk Score</th>
                <th>Risk Level</th>
                <th>Reason</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentHighRisk.length > 0 ? recentHighRisk.map((txn, i) => (
                <tr key={i}>
                  <td className="ra-txn-id">{txn.transaction_id || 'N/A'}</td>
                  <td className="ra-txn-amount">${(txn.amount || 0).toLocaleString()}</td>
                  <td>
                    <span className={`ra-score-badge ${(txn.risk_level || '').toLowerCase()}`}>
                      {txn.risk_score}
                    </span>
                  </td>
                  <td>
                    <span className={`ra-level-badge ${(txn.risk_level || '').toLowerCase()}`}>
                      {txn.risk_level}
                    </span>
                  </td>
                  <td className="ra-reason">
                    {txn.triggered_risk_factors?.[0] || 'Multiple factors'}
                  </td>
                  <td className="ra-time">just now</td>
                </tr>
              )) : (
                <>
                  <tr>
                    <td className="ra-txn-id">TXN-2025-00125</td>
                    <td className="ra-txn-amount">$2,45,000</td>
                    <td><span className="ra-score-badge high">91</span></td>
                    <td><span className="ra-level-badge high">High</span></td>
                    <td className="ra-reason">Unusual Location</td>
                    <td className="ra-time">2 min ago</td>
                  </tr>
                  <tr>
                    <td className="ra-txn-id">TXN-2025-00124</td>
                    <td className="ra-txn-amount">$1,25,500</td>
                    <td><span className="ra-score-badge high">87</span></td>
                    <td><span className="ra-level-badge high">High</span></td>
                    <td className="ra-reason">High Amount</td>
                    <td className="ra-time">8 min ago</td>
                  </tr>
                  <tr>
                    <td className="ra-txn-id">TXN-2025-00123</td>
                    <td className="ra-txn-amount">$98,750</td>
                    <td><span className="ra-score-badge high">82</span></td>
                    <td><span className="ra-level-badge high">High</span></td>
                    <td className="ra-reason">New Beneficiary</td>
                    <td className="ra-time">15 min ago</td>
                  </tr>
                  <tr>
                    <td className="ra-txn-id">TXN-2025-00122</td>
                    <td className="ra-txn-amount">$75,000</td>
                    <td><span className="ra-score-badge high">79</span></td>
                    <td><span className="ra-level-badge high">High</span></td>
                    <td className="ra-reason">Velocity</td>
                    <td className="ra-time">21 min ago</td>
                  </tr>
                  <tr>
                    <td className="ra-txn-id">TXN-2025-00121</td>
                    <td className="ra-txn-amount">$60,250</td>
                    <td><span className="ra-score-badge high">77</span></td>
                    <td><span className="ra-level-badge high">High</span></td>
                    <td className="ra-reason">Multiple Factors</td>
                    <td className="ra-time">32 min ago</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="ra-distribution-card">
          <div className="ra-card-header">
            <div>
              <h3>Risk Distribution</h3>
              <p className="ra-card-subtitle">Distribution of risk levels across all transactions</p>
            </div>
          </div>
          <div className="ra-donut-wrapper">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="ra-donut-center">
              <span className="ra-donut-total">{totalTxns.toLocaleString()}</span>
              <span className="ra-donut-label">Total</span>
            </div>
          </div>
          <div className="ra-dist-legend">
            <div className="ra-dist-item">
              <span className="ra-dist-dot" style={{ background: '#10b981' }} />
              <span className="ra-dist-name">Low Risk</span>
              <span className="ra-dist-val">{lowCount.toLocaleString()} ({totalTxns ? ((lowCount/totalTxns)*100).toFixed(1) : 0}%)</span>
            </div>
            <div className="ra-dist-item">
              <span className="ra-dist-dot" style={{ background: '#f59e0b' }} />
              <span className="ra-dist-name">Medium Risk</span>
              <span className="ra-dist-val">{mediumCount.toLocaleString()} ({totalTxns ? ((mediumCount/totalTxns)*100).toFixed(1) : 0}%)</span>
            </div>
            <div className="ra-dist-item">
              <span className="ra-dist-dot" style={{ background: '#ef4444' }} />
              <span className="ra-dist-name">High Risk</span>
              <span className="ra-dist-val">{highCount.toLocaleString()} ({totalTxns ? ((highCount/totalTxns)*100).toFixed(1) : 0}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
