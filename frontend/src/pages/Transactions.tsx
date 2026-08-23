import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTransactions } from '../services/mockData'
import RiskBadge from '../components/common/RiskBadge'
import RiskScoreBar from '../components/common/RiskScoreBar'
import StatusBadge from '../components/common/StatusBadge'
import { format } from 'date-fns'
import type { RiskLevel, TransactionStatus } from '../types'

export default function Transactions() {
  const navigate = useNavigate()
  const allTransactions = getTransactions()

  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'ALL'>('ALL')

  const filtered = allTransactions.filter((txn) => {
    const matchesSearch =
      search === '' ||
      txn.id.toLowerCase().includes(search.toLowerCase()) ||
      txn.cardholderName.toLowerCase().includes(search.toLowerCase()) ||
      txn.merchant.toLowerCase().includes(search.toLowerCase())

    const matchesRisk = riskFilter === 'ALL' || txn.riskLevel === riskFilter
    const matchesStatus = statusFilter === 'ALL' || txn.status === statusFilter

    return matchesSearch && matchesRisk && matchesStatus
  })

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  return (
    <div>
      <div className="page-header">
        <h2>Transaction Monitoring</h2>
        <p>Monitor and review flagged transactions in real time</p>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search by ID, cardholder, or merchant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value as RiskLevel | 'ALL')}
        >
          <option value="ALL">All Risk Levels</option>
          <option value="HIGH">High Risk</option>
          <option value="MEDIUM">Medium Risk</option>
          <option value="LOW">Low Risk</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TransactionStatus | 'ALL')}
        >
          <option value="ALL">All Statuses</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>{filtered.length} Transaction{filtered.length !== 1 ? 's' : ''}</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Time</th>
                <th>Cardholder</th>
                <th>Amount</th>
                <th>Merchant</th>
                <th>Category</th>
                <th>Location</th>
                <th>Risk Score</th>
                <th>Risk Level</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((txn) => (
                <tr
                  key={txn.id}
                  className="table-row-link"
                  onClick={() => navigate(`/transactions/${txn.id}`)}
                >
                  <td style={{ fontWeight: 500 }}>{txn.id}</td>
                  <td>{format(new Date(txn.timestamp), 'MMM d, HH:mm')}</td>
                  <td>{txn.cardholderName}</td>
                  <td>{formatCurrency(txn.amount)}</td>
                  <td>{txn.merchant}</td>
                  <td>{txn.merchantCategory}</td>
                  <td>{txn.city}, {txn.country}</td>
                  <td><RiskScoreBar score={txn.riskScore} /></td>
                  <td><RiskBadge level={txn.riskLevel} /></td>
                  <td><StatusBadge status={txn.status} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      <p>No transactions match your filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
