import { useState, useRef, useEffect } from 'react'
import { Menu, Search, Sun, Moon, Bell, ChevronDown, LogOut } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useApp } from '../../contexts/AppContext'

interface TopNavbarProps {
  onMenuToggle: () => void
}

export default function TopNavbar({ onMenuToggle }: TopNavbarProps) {
  const { theme, toggleTheme } = useTheme()
  const { user, notifications, markNotificationRead } = useApp()
  const isDark = theme === 'dark'

  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)

  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const buttonBase = `flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 ${
    isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
  }`

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-30 h-16 backdrop-blur-xl border-b flex items-center justify-between px-4 sm:px-6 transition-colors duration-200 ${
        isDark
          ? 'bg-[rgba(22,31,50,0.7)] border-[rgba(42,53,80,0.6)] text-white'
          : 'bg-[rgba(255,255,255,0.8)] border-gray-200 text-gray-900'
      }`}
    >
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className={buttonBase}>
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions, alerts..."
            className={`w-64 lg:w-80 pl-9 pr-4 py-2 rounded-xl text-sm transition-all duration-200 outline-none ${
              isDark
                ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-[#4F6DF5]/50 focus:bg-white/10'
                : 'bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#4F6DF5]/50 focus:bg-white'
            }`}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={toggleTheme} className={buttonBase}>
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setNotifOpen(!notifOpen)
              setUserOpen(false)
            }}
            className={`${buttonBase} relative`}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              className={`absolute right-0 top-12 w-80 sm:w-96 rounded-2xl shadow-2xl border overflow-hidden transition-all duration-200 ${
                isDark
                  ? 'bg-[#161F32] border-[rgba(42,53,80,0.6)]'
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className={`px-4 py-3 border-b font-semibold text-sm ${isDark ? 'border-white/10 text-white' : 'border-gray-100 text-gray-900'}`}>
                Notifications
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className={`px-4 py-6 text-sm text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    No notifications
                  </p>
                ) : (
                  notifications.slice(0, 6).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        markNotificationRead(n.id)
                      }}
                      className={`w-full text-left px-4 py-3 border-b transition-all duration-200 ${
                        isDark ? 'border-white/5' : 'border-gray-50'
                      } ${!n.read ? (isDark ? 'bg-[#4F6DF5]/5' : 'bg-[#4F6DF5]/5') : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${!n.read ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-gray-400' : 'text-gray-600')}`}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="w-2 h-2 mt-1.5 rounded-full bg-[#4F6DF5] shrink-0" />
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {n.message}
                      </p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                        {n.time}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={userRef}>
          <button
            onClick={() => {
              setUserOpen(!userOpen)
              setNotifOpen(false)
            }}
            className="flex items-center gap-2 transition-all duration-200"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4F6DF5] to-[#7C5CFC] flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <ChevronDown
              className={`hidden sm:block w-4 h-4 transition-transform duration-200 ${isDark ? 'text-gray-400' : 'text-gray-500'} ${userOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {userOpen && (
            <div
              className={`absolute right-0 top-12 w-64 rounded-2xl shadow-2xl border overflow-hidden transition-all duration-200 ${
                isDark
                  ? 'bg-[#161F32] border-[rgba(42,53,80,0.6)]'
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className={`px-4 py-3 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
                <p className="font-semibold text-sm">{user?.name}</p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{user?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#4F6DF5]/10 text-[#4F6DF5]">
                  {user?.role}
                </span>
              </div>
              <div className={`px-2 py-2 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                <button
                  onClick={() => {
                    setUserOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-all duration-200"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
