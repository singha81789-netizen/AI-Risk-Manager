import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { ApiCategoryRisk } from '../../types'

interface CategoryRiskChartProps {
  data: ApiCategoryRisk[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null
  const data = payload[0].payload
  return (
    <div style={{
      background: 'rgba(26, 31, 53, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '10px',
      padding: '14px 18px',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    }}>
      <p style={{ fontSize: '0.88rem', color: '#f0f2f8', fontWeight: 600, marginBottom: '6px' }}>{label}</p>
      <p style={{ fontSize: '0.82rem', color: '#8892b0' }}>
        Risk Score: <span style={{ color: '#f0f2f8', fontWeight: 600 }}>{data.riskScore}</span>
      </p>
      <p style={{ fontSize: '0.82rem', color: '#8892b0' }}>
        Transactions: <span style={{ color: '#f0f2f8', fontWeight: 600 }}>{data.transactionCount}</span>
      </p>
    </div>
  )
}

const getBarColor = (score: number) => {
  if (score >= 70) return '#ff6b6b'
  if (score >= 40) return '#ffaa00'
  return '#00d68f'
}

export default function CategoryRiskChart({ data }: CategoryRiskChartProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Risk by Merchant Category
        </h3>
      </div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              stroke="#5a6380"
              tick={{ fontSize: 12, fill: '#5a6380' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="category"
              stroke="#5a6380"
              tick={{ fontSize: 12, fill: '#8892b0' }}
              axisLine={false}
              tickLine={false}
              width={130}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
            <Bar
              dataKey="riskScore"
              name="Risk Score"
              radius={[0, 6, 6, 0]}
              barSize={22}
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={getBarColor(entry.riskScore)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
