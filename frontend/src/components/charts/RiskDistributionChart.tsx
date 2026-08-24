import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface RiskDistributionChartProps {
  stats: {
    highRiskCount: number
    mediumRiskCount: number
    lowRiskCount: number
  }
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null
  const data = payload[0]
  return (
    <div style={{
      background: 'rgba(26, 31, 53, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '10px',
      padding: '14px 18px',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: data.payload.color }} />
        <span style={{ fontSize: '0.85rem', color: '#f0f2f8', fontWeight: 600 }}>{data.name}</span>
      </div>
      <p style={{ fontSize: '0.82rem', color: '#8892b0', marginLeft: '18px' }}>
        {data.value} transactions
      </p>
    </div>
  )
}

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent === 0) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function RiskDistributionChart({ stats }: RiskDistributionChartProps) {
  const data = [
    { name: 'High Risk', value: stats.highRiskCount, color: '#ff6b6b' },
    { name: 'Medium Risk', value: stats.mediumRiskCount, color: '#ffaa00' },
    { name: 'Low Risk', value: stats.lowRiskCount, color: '#00d68f' },
  ]

  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="card">
      <div className="card-header">
        <h3>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
            <path d="M22 12A10 10 0 0 0 12 2v10z" />
          </svg>
          Risk Distribution
        </h3>
      </div>
      <div className="card-body">
        {total === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
            <p style={{ fontSize: '0.88rem' }}>No risk data available</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={4}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomLabel}
                  animationBegin={0}
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                      stroke="transparent"
                      style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '0.82rem', paddingTop: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '8px' }}>
              {data.map((d) => (
                <div key={d.name} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: d.color }}>{d.value}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{d.name}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
