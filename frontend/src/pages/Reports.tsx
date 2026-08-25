import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { getReportSummary, exportFlaggedCsv, exportPdfReport } from '../services/api'
import { useToast } from '../components/common/Toast'
import { useCurrency } from '../contexts/CurrencyContext'
import type { ReportSummary } from '../types'

type DateRange = '7d' | '30d' | '90d' | 'custom'

const COLORS = ['#6366f1', '#f97316', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899']

function formatPctChange(current: number, previous: number): { text: string; positive: boolean } {
  if (previous === 0) return { text: 'N/A', positive: true }
  const change = ((current - previous) / previous) * 100
  const positive = change <= 0 // for flagged/fraud_rate, decreasing is good
  return { text: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`, positive }
}

export default function Reports() {
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const { showToast } = useToast()
  const { formatCurrency } = useCurrency()

  const daysMap: Record<DateRange, number> = { '7d': 7, '30d': 30, '90d': 90, 'custom': 30 }
  const selectedDays = dateRange === 'custom' ? 30 : daysMap[dateRange]

  useEffect(() => {
    loadSummary()
  }, [dateRange])

  async function loadSummary() {
    try {
      setLoading(true)
      const data = await getReportSummary({ days: selectedDays })
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
      const blob = await exportPdfReport(selectedDays)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ai_risk_report_${Date.now()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      showToast('PDF report downloaded successfully', 'success')
    } catch (err: any) {
      setError(err.message || 'Failed to download PDF')
      showToast('Failed to download PDF', 'error')
    } finally {
      setDownloading(null)
    }
  }

  async function downloadCsv() {
    try {
      setDownloading('csv')
      const blob = await exportFlaggedCsv(undefined, selectedDays)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `flagged_transactions_${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast('CSV exported successfully', 'success')
    } catch (err: any) {
      setError(err.message || 'Failed to download CSV')
      showToast('Failed to export CSV', 'error')
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

  const totalCategory = categoryData.reduce((sum: number, c: any) => sum + c.count, 0)

  // Month-over-month comparison
  const prev = summary.previous_period
  const flaggedComparison = prev ? formatPctChange(summary.total_flagged, prev.total_flagged) : null
  const scoreComparison = prev ? formatPctChange(summary.avg_risk_score, prev.avg_risk_score) : null
  const fraudComparison = prev ? formatPctChange(summary.fraud_rate_pct, prev.fraud_rate_pct) : null

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

      {/* Date Range Selector */}
      <div className="reports-date-range">
        {(['7d', '30d', '90d', 'custom'] as DateRange[]).map((range) => (
          <button
            key={range}
            className={`date-range-btn ${dateRange === range ? 'active' : ''}`}
            onClick={() => setDateRange(range)}
          >
            {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'Custom'}
          </button>
        ))}
      </div>

      {/* Export Preview */}
      <div className="reports-export-preview">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#818cf8" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <span>
          Export will include <strong>{summary.total_flagged}</strong> flagged transactions from the last{' '}
          {dateRange === '7d' ? '7 days' : dateRange === '30d' ? '30 days' : dateRange === '90d' ? '90 days' : '30 days'}
          {summary.top_riskiest_transactions.length > 0 && (
            <> and the top {Math.min(summary.top_riskiest_transactions.length, 20)} riskiest transactions</>
          )}.
        </span>
      </div>

      {error && (
        <div className="upload-error">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Month-over-Month Comparison */}
      {prev && (
        <div className="reports-mom-grid">
          <div className="mom-card">
            <span className="mom-label">Flagged Transactions</span>
            <div className="mom-values">
              <span className="mom-current">{summary.total_flagged.toLocaleString()}</span>
              <span className="mom-vs">vs {prev.total_flagged.toLocaleString()} last period</span>
            </div>
            {flaggedComparison && (
              <span className={`mom-change ${flaggedComparison.positive ? 'positive' : 'negative'}`}>
                {flaggedComparison.positive ? '↓' : '↑'} {flaggedComparison.text} vs last period
              </span>
            )}
          </div>
          <div className="mom-card">
            <span className="mom-label">Avg Risk Score</span>
            <div className="mom-values">
              <span className="mom-current">{summary.avg_risk_score}</span>
              <span className="mom-vs">vs {prev.avg_risk_score} last period</span>
            </div>
            {scoreComparison && (
              <span className={`mom-change ${scoreComparison.positive ? 'positive' : 'negative'}`}>
                {scoreComparison.positive ? '↓' : '↑'} {scoreComparison.text} vs last period
              </span>
            )}
          </div>
          <div className="mom-card">
            <span className="mom-label">Fraud Rate</span>
            <div className="mom-values">
              <span className="mom-current">{summary.fraud_rate_pct}%</span>
              <span className="mom-vs">vs {prev.fraud_rate_pct}% last period</span>
            </div>
            {fraudComparison && (
              <span className={`mom-change ${fraudComparison.positive ? 'positive' : 'negative'}`}>
                {fraudComparison.positive ? '↓' : '↑'} {fraudComparison.text} vs last period
              </span>
            )}
          </div>
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
          <span className="report-stat-value">{formatCurrency(summary.total_amount_at_risk)}</span>
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
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      const numVal = Number(value)
                      const pct = totalCategory > 0 ? ((numVal / totalCategory) * 100).toFixed(1) : '0'
                      return [`${numVal} transactions (${pct}%)`, String(name)]
                    }}
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="category-legend">
              {categoryData.map((item: any, index: number) => {
                const pct = totalCategory > 0 ? ((item.count / totalCategory) * 100).toFixed(1) : '0'
                return (
                  <div key={index} className="legend-item">
                    <span className="legend-dot" style={{ background: COLORS[index % COLORS.length] }} />
                    <span className="legend-name">{item.name}</span>
                    <span className="legend-value">{item.count} ({pct}%)</span>
                  </div>
                )
              })}
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
                    <td className="txn-amount">{formatCurrency(txn.amount || 0)}</td>
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
