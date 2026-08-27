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
  ChevronsLeft,
  ChevronsRight,
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
  const { logout, sidebarCollapsed, setSidebarCollapsed } = useApp()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const isDark = theme === 'dark'
  const collapsed = sidebarCollapsed

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const toggleCollapse = () => {
    setSidebarCollapsed(!collapsed)
  }

  const sidebarWidth = collapsed ? 'w-[68px]' : 'w-64'

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-6'} py-5 border-b ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#4F6DF5] to-[#7C5CFC] shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold bg-gradient-to-r from-[#4F6DF5] to-[#7C5CFC] bg-clip-text text-transparent whitespace-nowrap">
            RiskGuard
          </span>
        )}
      </div>

      <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-[#4F6DF5]/10 text-[#4F6DF5] border-l-2 border-[#4F6DF5]'
                  : isDark
                    ? 'text-gray-400 hover:bg-white/5 border-l-2 border-transparent hover:text-white'
                    : 'text-gray-500 hover:bg-gray-100 border-l-2 border-transparent hover:text-gray-900'
              }`
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={`px-2.5 py-4 border-t ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
        <button
          onClick={toggleCollapse}
          className={`hidden lg:flex items-center ${collapsed ? 'justify-center' : 'gap-3'} w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 mb-1 ${
            isDark
              ? 'text-gray-400 hover:bg-white/5 hover:text-white'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          {collapsed ? <ChevronsRight className="w-5 h-5" /> : <ChevronsLeft className="w-5 h-5" />}
          {!collapsed && <span>Collapse</span>}
        </button>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            isDark
              ? 'text-gray-400 hover:bg-white/5 hover:text-red-400'
              : 'text-gray-500 hover:bg-gray-100 hover:text-red-500'
          }`}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex-col ${sidebarWidth} transition-all duration-300 ease-in-out ${
          isDark ? 'bg-[#0B1120] border-r border-white/5' : 'bg-white border-r border-gray-200'
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
