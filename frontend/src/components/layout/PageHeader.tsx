import { useLocation, Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

interface PageMeta {
  title: string
  subtitle: string
  breadcrumbs: { label: string; path?: string }[]
}

const PAGE_META: Record<string, PageMeta> = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Real-time overview of your fraud detection system',
    breadcrumbs: [{ label: 'Home', path: '/dashboard' }, { label: 'Dashboard' }],
  },
  '/transactions': {
    title: 'Transactions',
    subtitle: 'View, filter, and analyze all monitored transactions',
    breadcrumbs: [{ label: 'Home', path: '/dashboard' }, { label: 'Transactions' }],
  },
  '/alerts': {
    title: 'Alerts',
    subtitle: 'Monitor and respond to security alerts in real time',
    breadcrumbs: [{ label: 'Home', path: '/dashboard' }, { label: 'Alerts' }],
  },
  '/ai-models': {
    title: 'AI Models',
    subtitle: 'Manage and monitor your machine learning detection models',
    breadcrumbs: [{ label: 'Home', path: '/dashboard' }, { label: 'AI Models' }],
  },
  '/reports': {
    title: 'Reports',
    subtitle: 'Generate and download compliance and analytics reports',
    breadcrumbs: [{ label: 'Home', path: '/dashboard' }, { label: 'Reports' }],
  },
  '/audit': {
    title: 'Audit Log',
    subtitle: 'Track all system activities and user actions for compliance',
    breadcrumbs: [{ label: 'Home', path: '/dashboard' }, { label: 'Audit Log' }],
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Configure your account, thresholds, and system preferences',
    breadcrumbs: [{ label: 'Home', path: '/dashboard' }, { label: 'Settings' }],
  },
}

export default function PageHeader() {
  const location = useLocation()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const meta = PAGE_META[location.pathname]

  if (!meta) return null

  return (
    <div className="mb-6 lg:mb-8">
      <nav className="flex items-center gap-1.5 text-xs mb-3">
        <Home className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
        {meta.breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight className={`w-3 h-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            {crumb.path ? (
              <Link
                to={crumb.path}
                className={`transition-colors duration-150 hover:text-[#4F6DF5] ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {crumb.label}
              </Link>
            ) : (
              <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      <h1 className={`text-2xl lg:text-3xl font-bold tracking-tight ${
        isDark ? 'text-white' : 'text-gray-900'
      }`}>
        {meta.title}
      </h1>
      <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {meta.subtitle}
      </p>
    </div>
  )
}
