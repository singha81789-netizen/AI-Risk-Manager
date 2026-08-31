import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Shield, Zap, Brain, BarChart3, Loader2,
  Mail, AlertCircle, Lock, Eye, EyeOff, CheckCircle2, ArrowRight
} from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { useTheme } from '../contexts/ThemeContext'
import { authLogin } from '../services/api'
import type { UserRole } from '../types'

interface FieldErrors {
  email?: string
  password?: string
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useApp()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const locationState = location.state as { successMessage?: string; email?: string } | null
  const initialEmail = locationState?.email || ''
  const initialSuccess = locationState?.successMessage || ''

  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorType, setErrorType] = useState<'notFound' | 'general' | null>(null)
  const [success, setSuccess] = useState(initialSuccess)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (initialSuccess) {
      setSuccess(initialSuccess)
    }
  }, [initialSuccess])

  const validateFields = useCallback((): boolean => {
    const errors: FieldErrors = {}
    if (!email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address'
    }
    if (!password) {
      errors.password = 'Password is required'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [email, password])

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateFields()) return
    setLoading(true)
    setError('')
    setErrorType(null)
    setSuccess('')

    const cleanEmail = email.trim().toLowerCase()

    try {
      const result = await authLogin({ email: cleanEmail, password })
      localStorage.setItem('riskguard-token', result.token)
      login(result.user.email, '', result.user.role as UserRole)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      setError(msg)
      if (msg.includes('Unable to connect to server')) {
        setErrorType('general')
      } else if (msg.toLowerCase().includes('account not found') || msg.toLowerCase().includes('not found')) {
        setErrorType('notFound')
      } else {
        setErrorType('general')
      }
    } finally {
      setLoading(false)
    }
  }, [email, password, validateFields, login, navigate])

  const handleDemo = () => {
    login('demo@riskguard.io', '', 'Admin')
    navigate('/dashboard')
  }

  const inputBase = `w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 ${
    isDark
      ? 'bg-white/5 border text-white placeholder-gray-500 focus:bg-white/10'
      : 'bg-gray-50 border text-gray-900 placeholder-gray-400 focus:bg-white'
  }`

  const labelBase = `block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-600'}`

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0B1120] via-[#0F172A] to-[#1a1a3e] p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4F6DF5]/10 via-transparent to-[#7C5CFC]/10" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4F6DF5] to-[#7C5CFC] shadow-lg shadow-[#4F6DF5]/20">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-[#4F6DF5] to-[#7C5CFC] bg-clip-text text-transparent">
              RiskGuard
            </span>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            AI-Powered Risk & Fraud Detection
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            Protect your business with intelligent, real-time fraud analysis.
          </p>

          <div className="space-y-4">
            {[
              { icon: Zap, text: 'Real-time transaction monitoring' },
              { icon: Brain, text: 'Machine learning anomaly detection' },
              { icon: BarChart3, text: 'Advanced risk scoring & analytics' },
              { icon: Lock, text: 'Enterprise-grade security' },
            ].map((feature) => (
              <div key={feature.text} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#4F6DF5]/10">
                  <feature.icon className="w-4 h-4 text-[#4F6DF5]" />
                </div>
                <span className="text-gray-300 text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-gray-600 text-sm">
          &copy; 2026 RiskGuard. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className={`flex-1 flex items-center justify-center p-6 sm:p-8 transition-colors duration-200 ${
        isDark ? 'bg-[#0F172A]' : 'bg-gray-50'
      }`}>
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F6DF5] to-[#7C5CFC]">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-[#4F6DF5] to-[#7C5CFC] bg-clip-text text-transparent">
              RiskGuard
            </span>
          </div>

          <h2 className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Welcome back
          </h2>
          <p className={`text-sm mb-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Sign in to access your risk management dashboard
          </p>

          {success && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
              <span>{success}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="flex-1">{error}</span>
              </div>
              {error.includes('Unable to connect to server') && (
                <p className="mt-2 text-xs text-red-300/80">
                  Run: <code className="bg-red-500/10 px-1.5 py-0.5 rounded">uvicorn api.main:app --reload --port 8000</code>
                </p>
              )}
              {errorType === 'notFound' && (
                <div className="mt-3 pt-2.5 border-t border-red-500/20 flex justify-end">
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Create an account <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className={labelBase}>Email</label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setFieldErrors((prev) => ({ ...prev, email: undefined }))
                  }}
                  placeholder="you@company.com"
                  className={`${inputBase} pl-10 ${
                    fieldErrors.email
                      ? 'border-red-500/50'
                      : isDark
                      ? 'border-white/10 focus:border-[#4F6DF5]/50'
                      : 'border-gray-200 focus:border-[#4F6DF5]/50'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label className={labelBase}>Password</label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setFieldErrors((prev) => ({ ...prev, password: undefined }))
                  }}
                  placeholder="Enter your password"
                  className={`${inputBase} pl-10 pr-10 ${
                    fieldErrors.password
                      ? 'border-red-500/50'
                      : isDark
                      ? 'border-white/10 focus:border-[#4F6DF5]/50'
                      : 'border-gray-200 focus:border-[#4F6DF5]/50'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#4F6DF5] to-[#7C3AED] text-white font-semibold text-sm hover:shadow-[0_0_20px_rgba(79,109,245,0.3)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
              ) : (
                'Sign In'
              )}
            </button>

            <button
              type="button"
              onClick={handleDemo}
              className={`w-full py-2.5 rounded-xl border font-medium text-sm transition-all duration-200 ${
                isDark
                  ? 'border-[#4F6DF5]/30 text-[#4F6DF5] hover:bg-[#4F6DF5]/10'
                  : 'border-[#4F6DF5]/30 text-[#4F6DF5] hover:bg-[#4F6DF5]/5'
              }`}
            >
              Continue as Demo User
            </button>
          </form>

          <p className={`mt-6 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Don't have an account?{' '}
            <Link to="/register" className="text-[#4F6DF5] hover:underline font-semibold">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

