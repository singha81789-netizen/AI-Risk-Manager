import { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useApp } from '../../contexts/AppContext'
import Sidebar from './Sidebar'
import TopNavbar from './TopNavbar'

export default function Layout() {
  const { user } = useApp()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-[#0B1120]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TopNavbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

      <main className="lg:ml-64 pt-16 min-h-screen transition-all duration-200">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
