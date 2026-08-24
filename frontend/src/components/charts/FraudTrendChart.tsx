import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { ApiFraudTrend } from '../../types'

interface FraudTrendChartProps {
  data: ApiFraudTrend[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null
  return (
    <div style={{
      background: 'rgba(26, 31, 53, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '10px',
      padding: '14px 18px',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    }}>
      <p style={{ fontSize: '0.78rem', color: '#8892b0', marginBottom: '8px', fontWeight: 600 }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color }} />
          <span style={{ fontSize: '0.82rem', color: '#8892b0' }}>{entry.name}:</span>
          <span style={{ fontSize: '0.82rem', color: '#f0f2f8', fontWeight: 600 }}>{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function FraudTrendChart({ data }: FraudTrendChartProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Fraud Trends (7 Days)
        </h3>
      </div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorFlagged" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00d68f" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00d68f" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorDeclined" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffaa00" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ffaa00" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              stroke="#5a6380"
              tick={{ fontSize: 12, fill: '#5a6380' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
            />
            <YAxis
              stroke="#5a6380"
              tick={{ fontSize: 12, fill: '#5a6380' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '0.82rem', paddingTop: '12px' }}
            />
            <Area
              type="monotone"
              dataKey="flagged"
              name="Flagged"
              stroke="#ff6b6b"
              fill="url(#colorFlagged)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#ff6b6b', fill: '#1a1f35' }}
            />
            <Area
              type="monotone"
              dataKey="approved"
              name="Approved"
              stroke="#00d68f"
              fill="url(#colorApproved)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#00d68f', fill: '#1a1f35' }}
            />
            <Area
              type="monotone"
              dataKey="declined"
              name="Declined"
              stroke="#ffaa00"
              fill="url(#colorDeclined)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffaa00', fill: '#1a1f35' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
