import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  icon: ReactNode
  iconBg: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  className?: string
}

export default function StatCard({ label, value, icon, iconBg, change, changeType, className }: StatCardProps) {
  return (
    <div className={`stat-card ${className || ''}`}>
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        <div className="stat-icon" style={{ background: iconBg }}>
          {icon}
        </div>
      </div>
      <div className="stat-value">{value}</div>
      {change && (
        <div className={`stat-change ${changeType || 'neutral'}`}>
          {changeType === 'positive' && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          )}
          {changeType === 'negative' && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
              <polyline points="17 18 23 18 23 12" />
            </svg>
          )}
          {change}
        </div>
      )}
    </div>
  )
}
