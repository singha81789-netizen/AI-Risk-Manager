import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { getReportSummary, exportFlaggedCsv, exportPdfReport } from '../services/api'
import type { ReportSummary } from '../types'

export default function Reports() {
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null)

  useEffect(() => {
    loadSummary()
  }, [])

  async function loadSummary() {
    try {
      setLoading(true)
      const data = await getReportSummary()
      setSummary(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  async function downloadPdf() {
    try {
      setDownloading('pdf')
      const blob = await exportPdfReport()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ai_risk_report_${Date.now()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || 'Failed to download PDF')
    } finally {
      setDownloading(null)
    }
  }

  async function downloadCsv() {
    try {
      setDownloading('csv')
      const blob = await exportFlaggedCsv()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `flagged_transactions_${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || 'Failed to download CSV')
    } finally {
      setDownloading(null)
    }
  }

  if (loading) {
    return (
      <div className="reports-page">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading report data...</p>
        </div>
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="reports-page">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={loadSummary} className="retry-btn">Retry</button>
        </div>
      </div>
    )
  }

  if (!summary) return null

  const riskDistData = [
    { name: 'High Risk', value: summary.high_risk, color: '#ef4444' },
    { name: 'Medium Risk', value: summary.medium_risk, color: '#f59e0b' },
    { name: 'Low Risk', value: summary.low_risk, color: '#10b981' },
  ]

  const categoryData = summary.category_breakdown.map((c: any) => ({
    name: c.category,
    count: c.count,
    avgScore: c.avg_risk_score,
  }))

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h1>Reports & Analytics</h1>
        <div className="reports-actions">
          <button className="export-btn" onClick={downloadCsv} disabled={downloading === 'csv'}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {downloading === 'csv' ? 'Exporting...' : 'Export CSV'}
          </button>
          <button className="export-btn primary" onClick={downloadPdf} disabled={downloading === 'pdf'}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            {downloading === 'pdf' ? 'Generating...' : 'Download PDF Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="upload-error">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="reports-stats-grid">
        <div className="report-stat-card">
          <span className="report-stat-label">Total Analyzed</span>
          <span className="report-stat-value">{summary.total_transactions.toLocaleString()}</span>
        </div>

        <div className="report-stat-card">
          <span className="report-stat-label">Flagged</span>
          <span className="report-stat-value red">{summary.total_flagged.toLocaleString()}</span>
          <span className="report-stat-sublabel">{summary.fraud_rate_pct}% fraud rate</span>
        </div>

        <div className="report-stat-card">
          <span className="report-stat-label">Amount at Risk</span>
          <span className="report-stat-value">${summary.total_amount_at_risk.toLocaleString()}</span>
        </div>

        <div className="report-stat-card">
          <span className="report-stat-label">Avg Risk Score</span>
          <span className="report-stat-value">{summary.avg_risk_score}</span>
        </div>
      </div>

      <div className="reports-charts-grid">
        <div className="bar-chart-card">
          <h3>Risk Level Distribution</h3>
          <div className="bar-chart-container">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={riskDistData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {riskDistData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {categoryData.length > 0 && (
          <div className="pie-chart-card">
            <h3>Transactions by Category</h3>
            <div className="pie-chart-container">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="name"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#6366f1', '#f97316', '#10b981', '#f59e0b', '#8b5cf6'][index % 5]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="category-legend">
              {categoryData.map((item, index) => (
                <div key={index} className="legend-item">
                  <span className="legend-dot" style={{ background: ['#6366f1', '#f97316', '#10b981', '#f59e0b', '#8b5cf6'][index % 5] }} />
                  <span className="legend-name">{item.name}</span>
                  <span className="legend-value">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {summary.top_riskiest_transactions.length > 0 && (
        <div className="reports-table-card">
          <h3>Top Riskiest Transactions</h3>
          <div className="reports-table-scroll">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th>Risk Score</th>
                  <th>Risk Level</th>
                  <th>Fraud Probability</th>
                </tr>
              </thead>
              <tbody>
                {summary.top_riskiest_transactions.map((txn: any, i: number) => (
                  <tr key={i}>
                    <td className="txn-id">{txn.transaction_id || 'N/A'}</td>
                    <td className="txn-amount">${(txn.amount || 0).toLocaleString()}</td>
                    <td>{txn.merchant_category || 'N/A'}</td>
                    <td>
                      <span className={`risk-score ${(txn.risk_level || '').toLowerCase()}`}>
                        {txn.risk_score}
                      </span>
                    </td>
                    <td>
                      <span className={`risk-level-badge ${(txn.risk_level || '').toLowerCase()}`}>
                        {txn.risk_level}
                      </span>
                    </td>
                    <td>{(txn.fraud_probability * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
