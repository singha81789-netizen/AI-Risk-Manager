interface RiskScoreBarProps {
  score: number
}

function getLevel(score: number): string {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

export default function RiskScoreBar({ score }: RiskScoreBarProps) {
  const level = getLevel(score)
  return (
    <div className="risk-score-bar">
      <span className="score-value">{score}</span>
      <div className="bar">
        <div
          className={`bar-fill ${level}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}
