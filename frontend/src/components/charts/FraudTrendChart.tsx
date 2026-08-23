import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { FraudTrend } from '../../types'

interface FraudTrendChartProps {
  data: FraudTrend[]
}

export default function FraudTrendChart({ data }: FraudTrendChartProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Fraud Trends (7 Days)</h3>
      </div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorFlagged" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorDeclined" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
            <XAxis
              dataKey="date"
              stroke="#5c5f73"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              stroke="#5c5f73"
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                background: '#1c1f2e',
                border: '1px solid #2a2d3e',
                borderRadius: '8px',
                color: '#e4e6f0',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="flagged"
              name="Flagged"
              stroke="#ef4444"
              fill="url(#colorFlagged)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="approved"
              name="Approved"
              stroke="#22c55e"
              fill="url(#colorApproved)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="declined"
              name="Declined"
              stroke="#f59e0b"
              fill="url(#colorDeclined)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
