import { NavLink } from 'react-router-dom'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <h1>
          <span>AI</span> Risk Manager
        </h1>
        <p>Fraud Analyst Dashboard</p>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/"
          end
          onClick={onClose}
          className={({ isActive }) => isActive ? 'active' : ''}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
          Dashboard
        </NavLink>
        <NavLink
          to="/transactions"
          onClick={onClose}
          className={({ isActive }) => isActive ? 'active' : ''}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Transactions
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="analyst-info">
          <div className="avatar">AR</div>
          <div>
            <div className="analyst-name">Alex Rivera</div>
            <div className="analyst-role">Senior Fraud Analyst</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
