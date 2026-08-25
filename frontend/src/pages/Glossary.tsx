import { useState } from 'react'

const glossaryTerms = [
  { term: 'Risk Score', category: 'Core', definition: 'A number from 0-100 indicating how likely a transaction is fraudulent. Higher scores mean greater risk. Typical range is 20-40.' },
  { term: 'Risk Level', category: 'Core', definition: 'Classification as LOW, MEDIUM, or HIGH based on the risk score. HIGH risk transactions require immediate attention.' },
  { term: 'Anomaly', category: 'Detection', definition: 'A transaction that deviates significantly from normal patterns. May indicate fraud or data quality issues.' },
  { term: 'Fraud Probability', category: 'Core', definition: 'The AI model\'s estimated probability (0-100%) that a transaction is fraudulent, based on historical patterns.' },
  { term: 'Model Confidence', category: 'AI Model', definition: 'How accurately the AI model identifies fraud. Higher is better — 95% means it correctly classifies 95 out of 100 transactions.' },
  { term: 'Watchlist Match', category: 'Detection', definition: 'The user or merchant appears on a known fraud watchlist. These matches are flagged for immediate review.' },
  { term: 'False Positive', category: 'Workflow', definition: 'A legitimate transaction that was incorrectly flagged as suspicious. Reducing false positives improves customer experience.' },
  { term: 'Velocity', category: 'Detection', definition: 'The speed or frequency of transactions in a given time period. High velocity may indicate card testing or account takeover.' },
  { term: 'Flagged Transaction', category: 'Workflow', definition: 'A transaction the AI has flagged for review due to one or more suspicious indicators.' },
  { term: 'Confirmed Fraud', category: 'Workflow', definition: 'A transaction that has been reviewed by an analyst and confirmed as fraudulent.' },
  { term: 'Risk Factor', category: 'Detection', definition: 'A specific indicator that contributed to a transaction\'s risk score, such as unusual location or high amount.' },
  { term: 'Anomaly Score', category: 'AI Model', definition: 'A numerical score from the anomaly detection model indicating how unusual a transaction is compared to normal behavior.' },
  { term: 'Ensemble Detection', category: 'AI Model', definition: 'Using multiple AI models together (e.g., Isolation Forest + Random Forest) to improve fraud detection accuracy.' },
  { term: 'SHAP Explanation', category: 'AI Model', definition: 'A method to explain why the AI model made a specific prediction by showing which features contributed most to the decision.' },
  { term: 'Threshold', category: 'Configuration', definition: 'The cutoff values used to classify risk levels. Adjustable to balance between catching fraud and reducing false alarms.' },
  { term: 'Analyst Review', category: 'Workflow', definition: 'When a human analyst examines a flagged transaction to determine if it\'s truly fraudulent or a false positive.' },
  { term: 'Audit Log', category: 'Compliance', definition: 'A record of all actions taken in the system, including predictions, reviews, and status changes, for compliance and debugging.' },
  { term: 'High Risk Country', category: 'Detection', definition: 'A transaction originating from or going to a country known for higher fraud rates. Used as one of many risk signals.' },
]

export default function Glossary() {
  const [search, setSearch] = useState('')

  const filtered = glossaryTerms.filter(item =>
    item.term.toLowerCase().includes(search.toLowerCase()) ||
    item.definition.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce<Record<string, typeof glossaryTerms>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  return (
    <div className="glossary-page">
      <div className="glossary-header">
        <h1>Glossary</h1>
        <p className="glossary-subtitle">Simple definitions of fraud detection and risk management terms.</p>
      </div>

      <div className="glossary-search">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search terms or definitions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {Object.entries(grouped).length === 0 ? (
        <div className="empty-state">
          <p>No terms found matching "{search}"</p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>{category}</h2>
            <div className="glossary-grid">
              {items.map((item, i) => (
                <div key={i} className="glossary-card">
                  <h3>
                    {item.term}
                    <span className="glossary-tag">{item.category}</span>
                  </h3>
                  <p>{item.definition}</p>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
