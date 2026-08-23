import type { RiskLevel } from '../../types'

interface RiskBadgeProps {
  level: RiskLevel
}

export default function RiskBadge({ level }: RiskBadgeProps) {
  return (
    <span className={`risk-badge ${level.toLowerCase()}`}>
      <span className="dot" />
      {level}
    </span>
  )
}
