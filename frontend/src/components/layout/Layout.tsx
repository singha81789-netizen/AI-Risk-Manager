import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Onboarding from '../common/Onboarding'

const pageNames: Record<string, string> = {
  '/': 'Dashboard',
  '/upload': 'CSV Upload',
  '/transactions': 'Transactions',
  '/risk-analysis': 'Risk Analysis',
  '/alerts': 'Alerts',
  '/fraud-detection': 'AI Models',
  '/reports': 'Reports',
  '/features': 'Features',
  '/settings': 'Settings',
  '/glossary': 'Glossary',
}

interface SearchResult {
  type: 'transaction' | 'alert'
  id: string
  label: string
  sublabel: string
  href: string
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const currentPage = pageNames[location.pathname] || 'Dashboard'

  // Close search on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close search on navigation
  useEffect(() => {
    setShowSearch(false)
    setSearchQuery('')
  }, [location.pathname])

  async function handleSearch(query: string) {
    setSearchQuery(query)
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }

    // Client-side search across known patterns
    const results: SearchResult[] = []
    const q = query.toLowerCase()

    // Search transactions (by ID pattern)
    if (q.startsWith('txn') || q.match(/^\d/)) {
      results.push({
        type: 'transaction',
        id: query,
        label: `Transaction ${query}`,
        sublabel: 'View transaction details',
        href: `/transactions?search=${encodeURIComponent(query)}`,
      })
    }

    // Search alerts
    if (q.includes('high') || q.includes('alert') || q.includes('fraud')) {
      results.push({
        type: 'alert',
        id: 'alerts',
        label: 'View Alerts',
        sublabel: `Search for "${query}" in alerts`,
        href: `/alerts`,
      })
    }

    // Always show quick navigation options
    const navMap: Record<string, string> = {
      dashboard: '/',
      transaction: '/transactions',
      risk: '/risk-analysis',
      alert: '/alerts',
      report: '/reports',
      setting: '/settings',
      glossary: '/glossary',
      model: '/ai-models',
    }

    for (const [key, path] of Object.entries(navMap)) {
      if (key.includes(q) || q.includes(key)) {
        results.push({
          type: 'transaction',
          id: path,
          label: `Go to ${pageNames[path] || path}`,
          sublabel: `Navigate to ${pageNames[path] || path} page`,
          href: path,
        })
      }
    }

    setSearchResults(results.slice(0, 8))
    setShowSearch(true)
  }

  function handleSearchSelect(href: string) {
    navigate(href)
    setShowSearch(false)
    setSearchQuery('')
  }

  return (
    <div className="layout">
      <Onboarding />

      <button
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-content">
        <header className="top-header">
          <div className="header-left">
            <div className="header-search" ref={searchRef}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search transactions, alerts, pages..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setShowSearch(true)}
              />
              {showSearch && searchResults.length > 0 && (
                <div className="search-results-dropdown">
                  {searchResults.map((result, i) => (
                    <div
                      key={i}
                      className="search-result-item"
                      onClick={() => handleSearchSelect(result.href)}
                    >
                      <span className={`search-result-type ${result.type}`}>
                        {result.type === 'transaction' ? 'TXN' : 'ALERT'}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{result.label}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{result.sublabel}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showSearch && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="search-results-dropdown">
                  <div className="search-no-results">No results for "{searchQuery}"</div>
                </div>
              )}
            </div>
          </div>
          <div className="header-right">
            <button className="header-btn notification-btn" title="Notifications" onClick={() => navigate('/alerts')}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="notification-dot" />
            </button>
            <button className="header-btn" title="Glossary" onClick={() => navigate('/glossary')}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>
            <div className="user-profile">
              <div className="user-avatar">AS</div>
              <div className="user-info">
                <span className="user-name">Aryan Singh</span>
                <span className="user-role">Risk Analyst</span>
              </div>
            </div>
          </div>
        </header>

        <div className="main-scroll">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
