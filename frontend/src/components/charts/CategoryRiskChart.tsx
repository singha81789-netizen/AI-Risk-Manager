import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { CategoryRisk } from '../../types'

interface CategoryRiskChartProps {
  data: CategoryRisk[]
}

export default function CategoryRiskChart({ data }: CategoryRiskChartProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Risk by Merchant Category</h3>
      </div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              stroke="#5c5f73"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="category"
              stroke="#5c5f73"
              tick={{ fontSize: 12 }}
              width={120}
            />
            <Tooltip
              contentStyle={{
                background: '#1c1f2e',
                border: '1px solid #2a2d3e',
                borderRadius: '8px',
                color: '#e4e6f0',
              }}
            />
            <Bar
              dataKey="riskScore"
              name="Risk Score"
              fill="#6366f1"
              radius={[0, 4, 4, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
