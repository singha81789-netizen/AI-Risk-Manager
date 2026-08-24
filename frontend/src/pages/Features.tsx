import { useNavigate } from 'react-router-dom'

const features = [
  {
    title: 'Transaction Monitoring',
    description: 'Real-time monitoring of all financial transactions',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    color: '#6366f1',
    bgColor: 'rgba(99, 102, 241, 0.1)',
    path: '/transactions'
  },
  {
    title: 'Risk Analysis',
    description: 'AI-powered risk scoring & pattern analysis',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    ),
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
    path: '/analyze'
  },
  {
    title: 'Fraud Detection',
    description: 'Detect & flag fraudulent activities',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    path: '/transactions'
  },
  {
    title: 'Alerts & Notifications',
    description: 'Real-time alerts & notifications',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    path: '/transactions'
  },
  {
    title: 'Reports & Analytics',
    description: 'Detailed insights & performance reports',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    path: '/transactions'
  },
  {
    title: 'AI Models',
    description: 'Manage & train AI risk models',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.57-3.25 3.93" />
        <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.57 3.25 3.93" />
        <path d="M12 9.93V14" />
        <path d="M9 18l3 4 3-4" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
    color: '#a855f7',
    bgColor: 'rgba(168, 85, 247, 0.1)',
    path: '/analyze'
  },
  {
    title: 'Customer Management',
    description: 'Manage customer profiles & risk levels',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
    path: '/transactions'
  },
  {
    title: 'Compliance Check',
    description: 'KYC, AML & compliance monitoring',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    path: '/transactions'
  },
  {
    title: 'Settings',
    description: 'Application & profile settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.1)',
    path: '/transactions'
  }
]

export default function Features() {
  const navigate = useNavigate()

  return (
    <div className="features-page">
      <div className="features-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>All Features</h1>
      </div>

      <div className="features-grid">
        {features.map((feature, index) => (
          <div
            key={index}
            className="feature-card"
            onClick={() => navigate(feature.path)}
          >
            <div
              className="feature-icon"
              style={{ background: feature.bgColor, color: feature.color }}
            >
              {feature.icon}
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
