import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  icon: ReactNode
  iconBg: string
  change?: string
  changeType?: 'positive' | 'negative'
}

export default function StatCard({ label, value, icon, iconBg, change, changeType }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        <div className="stat-icon" style={{ background: iconBg }}>
          {icon}
        </div>
      </div>
      <div className="stat-value">{value}</div>
      {change && (
        <div className={`stat-change ${changeType || ''}`}>{change}</div>
      )}
    </div>
  )
}
