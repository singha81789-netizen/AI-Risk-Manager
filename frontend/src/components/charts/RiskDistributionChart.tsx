import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { FraudStats } from '../../types'

interface RiskDistributionChartProps {
  stats: FraudStats
}

export default function RiskDistributionChart({ stats }: RiskDistributionChartProps) {
  const data = [
    { name: 'High Risk', value: stats.highRiskCount, color: '#ef4444' },
    { name: 'Medium Risk', value: stats.mediumRiskCount, color: '#f59e0b' },
    { name: 'Low Risk', value: stats.lowRiskCount, color: '#22c55e' },
  ]

  return (
    <div className="card">
      <div className="card-header">
        <h3>Risk Distribution</h3>
      </div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#1c1f2e',
                border: '1px solid #2a2d3e',
                borderRadius: '8px',
                color: '#e4e6f0',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
