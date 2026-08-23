import { useNavigate } from 'react-router-dom'
import {
  getFraudStats,
  getFlaggedTransactions,
  getFraudTrends,
  getCategoryRiskData,
} from '../services/mockData'
import StatCard from '../components/common/StatCard'
import RiskBadge from '../components/common/RiskBadge'
import RiskScoreBar from '../components/common/RiskScoreBar'
import StatusBadge from '../components/common/StatusBadge'
import FraudTrendChart from '../components/charts/FraudTrendChart'
import RiskDistributionChart from '../components/charts/RiskDistributionChart'
import CategoryRiskChart from '../components/charts/CategoryRiskChart'
import { format } from 'date-fns'

const icons = {
  total: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#6366f1" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  flagged: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="2">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  prevented: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#22c55e" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  loss: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#f59e0b" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
}

export default function Dashboard() {
  const navigate = useNavigate()
  const stats = getFraudStats()
  const flagged = getFlaggedTransactions()
  const trends = getFraudTrends()
  const categoryRisk = getCategoryRiskData()

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard Overview</h2>
        <p>Real-time fraud monitoring and risk analytics</p>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Total Transactions"
          value={stats.totalTransactions.toLocaleString()}
          icon={icons.total}
          iconBg="rgba(99, 102, 241, 0.12)"
          change="+3.2% vs yesterday"
          changeType="positive"
        />
        <StatCard
          label="Flagged Transactions"
          value={stats.flaggedTransactions.toLocaleString()}
          icon={icons.flagged}
          iconBg="rgba(239, 68, 68, 0.12)"
          change="+8 flagged since last hour"
          changeType="negative"
        />
        <StatCard
          label="Prevented Loss"
          value={formatCurrency(stats.preventedLoss)}
          icon={icons.prevented}
          iconBg="rgba(34, 197, 94, 0.12)"
          change="95.3% detection rate"
          changeType="positive"
        />
        <StatCard
          label="Total Fraud Loss"
          value={formatCurrency(stats.totalFraudLoss)}
          icon={icons.loss}
          iconBg="rgba(245, 158, 11, 0.12)"
          change="-12.4% vs last week"
          changeType="positive"
        />
      </div>

      <div className="charts-grid">
        <FraudTrendChart data={trends} />
        <RiskDistributionChart stats={stats} />
      </div>

      <CategoryRiskChart data={categoryRisk} />

      <div className="high-risk-section">
        <div className="section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          High-Risk Transactions Requiring Attention
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
                <th>Risk Score</th>
                <th>Risk Level</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {flagged.map((txn) => (
                <tr
                  key={txn.id}
                  className="table-row-link"
                  onClick={() => navigate(`/transactions/${txn.id}`)}
                >
                  <td style={{ fontWeight: 500 }}>{txn.id}</td>
                  <td>{format(new Date(txn.timestamp), 'HH:mm:ss')}</td>
                  <td>{txn.cardholderName}</td>
                  <td>{formatCurrency(txn.amount)}</td>
                  <td>{txn.merchant}</td>
                  <td><RiskScoreBar score={txn.riskScore} /></td>
                  <td><RiskBadge level={txn.riskLevel} /></td>
                  <td><StatusBadge status={txn.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
