import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const riskTrendData = [
  { day: '17 Aug', score: 45 },
  { day: '18 Aug', score: 52 },
  { day: '19 Aug', score: 48 },
  { day: '20 Aug', score: 65 },
  { day: '21 Aug', score: 72 },
  { day: '22 Aug', score: 68 },
  { day: '23 Aug', score: 76 },
]

const riskFactors = [
  { factor: 'Unusual Location', percentage: 85, color: '#6366f1' },
  { factor: 'High Transaction Amount', percentage: 76, color: '#6366f1' },
  { factor: 'New Device Login', percentage: 64, color: '#6366f1' },
  { factor: 'Multiple Transactions', percentage: 48, color: '#6366f1' },
  { factor: 'Watchlist Match', percentage: 35, color: '#ef4444' },
]

export default function RiskAnalysis() {
  return (
    <div className="risk-analysis-page">
      <div className="risk-analysis-header">
        <h1>Risk Analysis</h1>
      </div>

      <div className="risk-stats-grid">
        <div className="risk-stat-card">
          <div className="risk-stat-content">
            <span className="risk-stat-label">Overall Risk Score</span>
            <div className="risk-stat-value-large">
              <span className="value">76</span>
              <span className="unit">/100</span>
            </div>
            <span className="risk-stat-status high">High Risk</span>
          </div>
          <div className="risk-stat-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
        </div>

        <div className="risk-stat-card">
          <div className="risk-stat-content">
            <span className="risk-stat-label">Model Confidence</span>
            <div className="risk-stat-value-large">
              <span className="value">95.3</span>
              <span className="unit">%</span>
            </div>
          </div>
          <div className="confidence-chart">
            <svg viewBox="0 0 100 40">
              <path d="M0 35 Q25 30, 50 20 T100 5" fill="none" stroke="#10b981" strokeWidth="2" />
            </svg>
          </div>
        </div>

        <div className="risk-stat-card">
          <div className="risk-stat-content">
            <span className="risk-stat-label">Anomalies Detected</span>
            <div className="risk-stat-value-large red">
              <span className="value">153</span>
            </div>
            <span className="risk-stat-change positive">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              </svg>
              + 22%
            </span>
          </div>
        </div>

        <div className="risk-stat-card">
          <div className="risk-stat-content">
            <span className="risk-stat-label">Accuracy</span>
            <div className="risk-stat-value-large">
              <span className="value">94.3</span>
              <span className="unit">%</span>
            </div>
          </div>
          <div className="accuracy-ring">
            <svg viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="20" fill="none" stroke="#e2e8f0" strokeWidth="4" />
              <circle cx="25" cy="25" r="20" fill="none" stroke="#6366f1" strokeWidth="4"
                strokeDasharray="118.8" strokeDashoffset="6.7" transform="rotate(-90 25 25)" />
            </svg>
          </div>
        </div>
      </div>

      <div className="risk-analysis-content">
        <div className="risk-trend-card">
          <h3>Risk Trend (Last 7 Days)</h3>
          <div className="risk-trend-chart">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={riskTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ fill: '#6366f1', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="risk-factors-card">
          <h3>Top Risk Factors</h3>
          <div className="risk-factors-list">
            {riskFactors.map((factor, index) => (
              <div key={index} className="risk-factor-item">
                <div className="risk-factor-info">
                  <span className="risk-factor-name">{factor.factor}</span>
                  <span className="risk-factor-percentage">{factor.percentage}%</span>
                </div>
                <div className="risk-factor-bar">
                  <div
                    className="risk-factor-bar-fill"
                    style={{ width: `${factor.percentage}%`, background: factor.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
