import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Eye, EyeOff, Zap, Lock, Brain, BarChart3, Loader2, ArrowLeft, Mail } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { authLogin, authLoginVerify } from '../services/api'
import type { UserRole } from '../types'

type Step = 'email' | 'otp'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useApp()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [role, setRole] = useState<UserRole>('Admin')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (step === 'otp') {
      otpRefs.current[0]?.focus()
    }
  }, [step])

  const handleSendOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      await authLogin({ email })
      setSuccess('Verification code sent! Check your email (or terminal for dev mode).')
      setStep('otp')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send OTP'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [email])

  const handleOtpChange = useCallback((index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1)
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }, [otp])

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }, [otp])

  const handleOtpPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) {
      const newOtp = pasted.split('').concat(Array(6).fill('')).slice(0, 6)
      setOtp(newOtp)
      otpRefs.current[Math.min(pasted.length, 5)]?.focus()
    }
  }, [])

  const handleVerifyOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Please enter the full 6-digit code')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await authLoginVerify({ email, code })
      localStorage.setItem('riskguard-token', result.token)
      login(result.user.email, '', result.user.role as UserRole)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed'
      setError(msg)
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }, [otp, email, login, navigate])

  const handleDemo = () => {
    login('demo@riskguard.io', 'demo123', 'Admin')
    navigate('/dashboard')
  }

  const handleBack = () => {
    setStep('email')
    setError('')
    setSuccess('')
    setOtp(['', '', '', '', '', ''])
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0B1120] via-[#0F172A] to-[#1a1a3e] p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4F6DF5]/10 via-transparent to-[#7C5CFC]/10" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4F6DF5] to-[#7C5CFC]">
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
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-[#0F172A]">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F6DF5] to-[#7C5CFC]">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-[#4F6DF5] to-[#7C5CFC] bg-clip-text text-transparent">
              RiskGuard
            </span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">
            {step === 'email' ? 'Welcome back' : 'Enter verification code'}
          </h2>
          <p className="text-gray-400 text-sm mb-8">
            {step === 'email'
              ? 'Sign in to your account to continue'
              : `We sent a 6-digit code to ${email}`
            }
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && step === 'otp' && (
            <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              {success}
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm outline-none focus:border-[#4F6DF5]/50 focus:bg-white/10 transition-all duration-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-[#4F6DF5]/50 transition-all duration-200 appearance-none cursor-pointer"
                >
                  <option value="Admin" className="bg-[#0F172A]">Admin</option>
                  <option value="Analyst" className="bg-[#0F172A]">Analyst</option>
                  <option value="Viewer" className="bg-[#0F172A]">Viewer</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleDemo}
                className="w-full py-2.5 rounded-xl border border-[#4F6DF5]/30 text-[#4F6DF5] font-medium text-sm hover:bg-[#4F6DF5]/10 transition-all duration-200"
              >
                Continue as Demo User
              </button>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-2.5 rounded-xl bg-[#4F6DF5] text-white font-medium text-sm hover:shadow-[0_0_20px_rgba(79,109,245,0.3)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending code...</>
                ) : (
                  <><Mail className="w-4 h-4" /> Send Verification Code</>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">6-Digit Code</label>
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      onPaste={i === 0 ? handleOtpPaste : undefined}
                      className="w-12 h-14 text-center text-xl font-bold rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-[#4F6DF5]/50 focus:bg-white/10 transition-all duration-200"
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 font-medium text-sm hover:bg-white/5 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  disabled={loading || otp.join('').length !== 6}
                  className="flex-1 py-2.5 rounded-xl bg-[#4F6DF5] text-white font-medium text-sm hover:shadow-[0_0_20px_rgba(79,109,245,0.3)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                  ) : (
                    'Verify & Sign In'
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full text-center text-sm text-gray-400 hover:text-[#4F6DF5] transition-colors"
              >
                Resend code
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#4F6DF5] hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
