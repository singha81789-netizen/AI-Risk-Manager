import { useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Eye, EyeOff, CheckCircle, Loader2, Mail, AlertCircle, Lock, User as UserIcon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { authRegister } from '../services/api'
import type { UserRole } from '../types'

interface FieldErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
  terms?: string
}

export default function Signup() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<UserRole>('Analyst')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const passwordStrength = () => {
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
  }

  const strength = passwordStrength()
  const strengthColors = ['bg-red-500', 'bg-amber-500', 'bg-yellow-400', 'bg-emerald-500']
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong']

  const validateFields = useCallback((): boolean => {
    const errors: FieldErrors = {}
    if (!name.trim()) {
      errors.name = 'Full name is required'
    }
    if (!email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address'
    }
    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters'
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }
    if (!agreed) {
      errors.terms = 'You must agree to the Terms and Privacy Policy'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [name, email, password, confirmPassword, agreed])

  const handleRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateFields()) return

    setLoading(true)
    setError('')
    const cleanEmail = email.trim().toLowerCase()

    try {
      await authRegister({
        name: name.trim(),
        email: cleanEmail,
        password,
        role,
      })
      sessionStorage.setItem('riskguard-verify-email', cleanEmail)
      navigate(`/verify-email?email=${encodeURIComponent(cleanEmail)}`, {
        state: { email: cleanEmail },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [name, email, password, role, validateFields, navigate])

  const benefits = [
    'AI-powered fraud detection engine',
    'Real-time transaction monitoring',
    'Customizable risk scoring rules',
    'Comprehensive audit trail logging',
    'Team collaboration & case management',
  ]

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
            Start protecting your business today
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            Join thousands of companies using AI to detect and prevent fraud.
          </p>

          <div className="space-y-4">
            {benefits.map((text) => (
              <div key={text} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="text-gray-300 text-sm">{text}</span>
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
            Create your account
          </h2>
          <p className={`text-sm mb-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Get started with RiskGuard in minutes
          </p>

          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className={labelBase}>Full Name</label>
              <div className="relative">
                <UserIcon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setFieldErrors((prev) => ({ ...prev, name: undefined }))
                  }}
                  placeholder="John Doe"
                  className={`${inputBase} pl-10 ${
                    fieldErrors.name
                      ? 'border-red-500/50'
                      : isDark
                      ? 'border-white/10 focus:border-[#4F6DF5]/50'
                      : 'border-gray-200 focus:border-[#4F6DF5]/50'
                  }`}
                />
              </div>
              {fieldErrors.name && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.name}
                </p>
              )}
            </div>

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
                  placeholder="Create a strong password (min 6 chars)"
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
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-200 ${
                          i < strength ? strengthColors[strength - 1] : isDark ? 'bg-white/10' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs mt-1 ${strength > 0 ? (isDark ? 'text-gray-400' : 'text-gray-600') : 'text-gray-400'}`}>
                    {strength > 0 ? strengthLabels[strength - 1] : 'Enter a password'}
                  </p>
                </div>
              )}
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.password}
                </p>
              )}
            </div>

            <div>
              <label className={labelBase}>Confirm Password</label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                  }}
                  placeholder="Confirm your password"
                  className={`${inputBase} pl-10 pr-10 ${
                    fieldErrors.confirmPassword
                      ? 'border-red-500/50'
                      : isDark
                      ? 'border-white/10 focus:border-[#4F6DF5]/50'
                      : 'border-gray-200 focus:border-[#4F6DF5]/50'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            <div>
              <label className={labelBase}>Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className={`${inputBase} appearance-none cursor-pointer ${
                  isDark ? 'border-white/10 focus:border-[#4F6DF5]/50' : 'border-gray-200 focus:border-[#4F6DF5]/50'
                }`}
              >
                <option value="Admin" className={isDark ? 'bg-[#0F172A]' : 'bg-white'}>Admin</option>
                <option value="Analyst" className={isDark ? 'bg-[#0F172A]' : 'bg-white'}>Analyst</option>
                <option value="Viewer" className={isDark ? 'bg-[#0F172A]' : 'bg-white'}>Viewer</option>
              </select>
            </div>

            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => {
                    setAgreed(e.target.checked)
                    setFieldErrors((prev) => ({ ...prev, terms: undefined }))
                  }}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-[#4F6DF5] focus:ring-[#4F6DF5]/50 cursor-pointer"
                />
                <span className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  I agree to the{' '}
                  <span className="text-[#4F6DF5] hover:underline font-medium">Terms of Service</span>{' '}
                  and{' '}
                  <span className="text-[#4F6DF5] hover:underline font-medium">Privacy Policy</span>
                </span>
              </label>
              {fieldErrors.terms && (
                <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.terms}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#4F6DF5] to-[#7C3AED] text-white font-semibold text-sm hover:shadow-[0_0_20px_rgba(79,109,245,0.3)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating account & sending code...</>
              ) : (
                <><Mail className="w-4 h-4" /> Create Account & Send Code</>
              )}
            </button>
          </form>

          <p className={`mt-6 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Already have an account?{' '}
            <Link to="/login" className="text-[#4F6DF5] hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

