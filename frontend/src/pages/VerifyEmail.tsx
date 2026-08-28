import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Shield, AlertCircle, CheckCircle2, Loader2, ArrowLeft, RotateCw } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { authVerifyOtp, authResendOtp } from '../services/api'

export default function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Retrieve exact email without any modification
  const searchParams = new URLSearchParams(location.search)
  const emailFromUrl = searchParams.get('email')
  const emailFromState = (location.state as { email?: string } | null)?.email
  const emailFromStorage = sessionStorage.getItem('riskguard-verify-email')
  const email = (emailFromState || emailFromUrl || emailFromStorage || '').trim()

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // Focus first input on mount
    otpRefs.current[0]?.focus()
  }, [])

  // 60-second countdown timer for Resend Code
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleOtpChange = useCallback((index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1)
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError('')
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
      setError('')
      otpRefs.current[Math.min(pasted.length, 5)]?.focus()
    }
  }, [])

  const handleVerify = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError('Missing email address. Please sign up or sign in first.')
      return
    }
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit verification code.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await authVerifyOtp({ email, code })
      setSuccess('Email verified successfully! Redirecting to sign in...')
      sessionStorage.removeItem('riskguard-verify-email')
      setTimeout(() => {
        navigate('/login', {
          state: {
            successMessage: 'Email verified successfully! Please sign in with your credentials.',
            email,
          },
        })
      }, 1500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed'
      setError(msg)
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }, [otp, email, navigate])

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resending) return
    if (!email) {
      setError('Missing email address. Please sign up again.')
      return
    }
    setResending(true)
    setError('')
    setSuccess('')
    try {
      const res = await authResendOtp({ email })
      setSuccess(res.message || 'Verification code resent to your Gmail inbox!')
      setCooldown(60)
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend code'
      setError(msg)
    } finally {
      setResending(false)
    }
  }, [email, cooldown, resending])

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 sm:p-8 transition-colors duration-200 ${
      isDark ? 'bg-[#0F172A]' : 'bg-gray-50'
    }`}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4F6DF5] to-[#7C5CFC] shadow-lg shadow-[#4F6DF5]/20">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-[#4F6DF5] to-[#7C5CFC] bg-clip-text text-transparent">
            RiskGuard
          </span>
        </div>

        {/* Card */}
        <div className={`p-8 rounded-2xl border shadow-xl ${
          isDark
            ? 'bg-[#1E293B]/80 border-white/10 backdrop-blur-xl'
            : 'bg-white border-gray-200'
        }`}>
          <div className="text-center mb-6">
            <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Verify your email
            </h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              We sent a 6-digit verification code to
            </p>
            <p className="text-sm font-semibold text-[#4F6DF5] break-all mt-0.5">
              {email || 'your email'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider text-center mb-3 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                6-Digit Verification Code
              </label>
              <div className="flex gap-2.5 justify-center">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold rounded-xl outline-none transition-all duration-200 ${
                      isDark
                        ? 'bg-white/5 border border-white/10 text-white focus:border-[#4F6DF5] focus:bg-white/10 focus:ring-2 focus:ring-[#4F6DF5]/30'
                        : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-[#4F6DF5] focus:bg-white focus:ring-2 focus:ring-[#4F6DF5]/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otp.join('').length !== 6}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#4F6DF5] to-[#7C3AED] text-white font-semibold text-sm hover:shadow-[0_0_24px_rgba(79,109,245,0.4)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verifying Code...</>
              ) : (
                'Verify & Complete'
              )}
            </button>

            {/* Resend OTP button with cooldown */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
                className={`text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                  cooldown > 0 || resending
                    ? 'text-gray-500 cursor-not-allowed'
                    : isDark ? 'text-[#4F6DF5] hover:text-[#7C5CFC]' : 'text-[#4F6DF5] hover:text-[#3B50C4]'
                }`}
              >
                <RotateCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                {cooldown > 0 ? (
                  `Resend code in ${cooldown}s`
                ) : resending ? (
                  'Sending code...'
                ) : (
                  'Resend Verification Code'
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-xs">
            <Link
              to="/register"
              className={`inline-flex items-center gap-1 hover:underline ${
                isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign Up
            </Link>
            <Link
              to="/login"
              className="text-[#4F6DF5] hover:underline font-medium"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
