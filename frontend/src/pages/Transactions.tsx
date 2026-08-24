import { useState, useEffect } from 'react'
import { getTransactions } from '../services/api'
import type { ApiTransaction } from '../types'

export default function Transactions() {
  const [transactions, setTransactions] = useState<ApiTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    loadTransactions()
  }, [riskFilter, currentPage])

  async function loadTransactions() {
    try {
      setLoading(true)
      const data = await getTransactions({
        risk_level: riskFilter || undefined,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      })
      setTransactions(data.transactions)
      setTotal(data.total)
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = transactions.filter(txn => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (txn.transaction_id || '').toLowerCase().includes(q) ||
      (txn.merchant_category || '').toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(total / pageSize)

  function getRiskBadgeClass(level: string | null) {
    if (!level) return ''
    return level.toLowerCase()
  }

  function getPredictionClass(pred: string | null) {
    if (!pred) return ''
    if (pred === 'DECLINE') return 'flagged'
    if (pred === 'REVIEW') return 'review'
    return 'safe'
  }

  if (loading && transactions.length === 0) {
    return (
      <div className="transactions-page">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading transactions...</p>
        </div>
      </div>
    )
  }

  if (error && transactions.length === 0) {
    return (
      <div className="transactions-page">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={loadTransactions} className="retry-btn">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="transactions-page">
      <div className="transactions-header">
        <h1>Transaction Monitoring</h1>
        <span className="transaction-count">{total} total transactions</span>
      </div>

      <div className="transactions-filters">
        <div className="search-box">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by ID, category, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          value={riskFilter}
          onChange={(e) => { setRiskFilter(e.target.value); setCurrentPage(1) }}
        >
          <option value="">All Risk Levels</option>
          <option value="HIGH">High Risk</option>
          <option value="MEDIUM">Medium Risk</option>
          <option value="LOW">Low Risk</option>
        </select>

        <button className="filter-btn" onClick={loadTransactions}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="transactions-table-card">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Amount</th>
              <th>Category</th>
              <th>Type</th>
              <th>Risk Score</th>
              <th>Risk Level</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  <p>No transactions found</p>
                </td>
              </tr>
            ) : (
              filteredTransactions.map((txn) => (
                <tr key={txn.id}>
                  <td className="txn-id">{txn.transaction_id || 'N/A'}</td>
                  <td className="txn-amount">${(txn.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>{txn.merchant_category || 'N/A'}</td>
                  <td>{txn.transaction_type || 'N/A'}</td>
                  <td>
                    <span className={`risk-score ${getRiskBadgeClass(txn.risk_level)}`}>
                      {txn.risk_score ?? 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className={`risk-level-badge ${getRiskBadgeClass(txn.risk_level)}`}>
                      {txn.risk_level || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge-light ${getPredictionClass(txn.prediction)}`}>
                      {txn.prediction || 'Pending'}
                    </span>
                  </td>
                  <td className="txn-time">
                    {txn.timestamp
                      ? new Date(txn.timestamp).toLocaleString()
                      : txn.created_at
                        ? new Date(txn.created_at).toLocaleString()
                        : 'N/A'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            Prev
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let page: number
            if (totalPages <= 5) {
              page = i + 1
            } else if (currentPage <= 3) {
              page = i + 1
            } else if (currentPage >= totalPages - 2) {
              page = totalPages - 4 + i
            } else {
              page = currentPage - 2 + i
            }
            return (
              <button
                key={page}
                className={`page-btn ${currentPage === page ? 'active' : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            )
          })}
          <button
            className="page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
