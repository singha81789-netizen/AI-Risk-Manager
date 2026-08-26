import { NavLink, useNavigate } from 'react-router-dom'
import {
  Shield,
  LayoutDashboard,
  CreditCard,
  Bell,
  Brain,
  FileBarChart,
  ScrollText,
  Settings,
  LogOut,
} from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { useTheme } from '../../contexts/ThemeContext'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: CreditCard, label: 'Transactions' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/ai-models', icon: Brain, label: 'AI Models' },
  { to: '/reports', icon: FileBarChart, label: 'Reports' },
  { to: '/audit', icon: ScrollText, label: 'Audit Log' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { logout } = useApp()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const isDark = theme === 'dark'

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#4F6DF5] to-[#7C5CFC]">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-bold bg-gradient-to-r from-[#4F6DF5] to-[#7C5CFC] bg-clip-text text-transparent">
          RiskGuard
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[#4F6DF5]/10 text-[#4F6DF5] border-l-2 border-[#4F6DF5]'
                  : isDark
                    ? 'text-gray-400 hover:bg-white/5 border-l-2 border-transparent'
                    : 'text-gray-500 hover:bg-gray-100 border-l-2 border-transparent'
              }`
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/5">
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            isDark
              ? 'text-gray-400 hover:bg-white/5 hover:text-red-400'
              : 'text-gray-500 hover:bg-gray-100 hover:text-red-500'
          }`}
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex-col w-64 transition-colors duration-200 ${
          isDark ? 'bg-[#0B1120]' : 'bg-white'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200"
            onClick={onClose}
          />
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out ${
              isDark ? 'bg-[#0B1120]' : 'bg-white'
            } ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
