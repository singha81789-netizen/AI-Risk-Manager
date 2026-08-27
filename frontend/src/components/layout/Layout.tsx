import { useState, useCallback, useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../../contexts/AppContext'
import { useTheme } from '../../contexts/ThemeContext'
import Sidebar from './Sidebar'
import TopNavbar from './TopNavbar'
import PageHeader from './PageHeader'
import WelcomeTour from '../WelcomeTour'

export default function Layout() {
  const { user, sidebarCollapsed, tourSeen, markTourSeen, login } = useApp()
  const { theme } = useTheme()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const isDark = theme === 'dark'

  // Auto-show tour for first-time users (or demo login)
  useEffect(() => {
    if (user && !tourSeen) {
      const timer = setTimeout(() => setTourOpen(true), 600)
      return () => clearTimeout(timer)
    }
  }, [user, tourSeen])

  // Also trigger tour for demo users (first visit after demo login)
  useEffect(() => {
    if (user && location.pathname === '/dashboard' && !localStorage.getItem('riskguard-tour-seen')) {
      const timer = setTimeout(() => setTourOpen(true), 600)
      return () => clearTimeout(timer)
    }
  }, [user, location.pathname])

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const sidebarWidth = sidebarCollapsed ? 68 : 256

  const handleTourClose = useCallback(() => {
    setTourOpen(false)
    markTourSeen()
  }, [markTourSeen])

  const handleTourClick = useCallback(() => {
    setTourOpen(true)
  }, [])

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-[#0B1120]' : 'bg-gray-50'}`}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TopNavbar
        onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        onTourClick={handleTourClick}
      />

      <main
        className="pt-16 min-h-screen transition-all duration-300 ease-in-out"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <PageHeader />
          <Outlet />
        </div>
      </main>

      <WelcomeTour isOpen={tourOpen} onClose={handleTourClose} onComplete={handleTourClose} />
    </div>
  )
}
