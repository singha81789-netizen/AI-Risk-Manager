import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function OTPVerification() {
  const navigate = useNavigate()
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(30)
  const [canResend, setCanResend] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [resendTimer])

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1)
    }

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
      setActiveIndex(index + 1)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
      setActiveIndex(index - 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6)
    const newOtp = [...otp]
    pastedData.split('').forEach((char, index) => {
      if (index < 6) {
        newOtp[index] = char
      }
    })
    setOtp(newOtp)
    const focusIndex = Math.min(pastedData.length, 5)
    inputRefs.current[focusIndex]?.focus()
    setActiveIndex(focusIndex)
  }

  const handleResend = () => {
    if (canResend) {
      setResendTimer(30)
      setCanResend(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const otpValue = otp.join('')
    if (otpValue.length === 6) {
      setIsLoading(true)
      setTimeout(() => {
        setIsLoading(false)
        navigate('/')
      }, 1500)
    }
  }

  return (
    <div className="auth-split-page">
      <div className="auth-split-left">
        <div className="auth-split-brand">
          <div className="brand-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="brand-name">AI RISK MANAGER</span>
        </div>

        <div className="auth-split-hero">
          <h1>
            Secure<br />
            <span className="gradient-text">Verification</span>
          </h1>
          <p>Two-factor authentication adds an extra layer of security to your account.</p>
        </div>

        <div className="auth-split-visual">
          <div className="shield-visual">
            <div className="shield-glow-bg"></div>
            <div className="shield-main">
              <svg width="140" height="160" viewBox="0 0 140 160" fill="none">
                <defs>
                  <linearGradient id="shieldGrad2" x1="70" y1="0" x2="70" y2="160" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#10b981" />
                    <stop offset="1" stopColor="#059669" />
                  </linearGradient>
                </defs>
                <path d="M70 10L15 35V75C15 115 35 145 70 155C105 145 125 115 125 75V35L70 10Z"
                  stroke="url(#shieldGrad2)" strokeWidth="2" fill="none" />
                <path d="M70 30L30 50V80C30 110 48 132 70 140C92 132 110 110 110 80V50L70 30Z"
                  stroke="url(#shieldGrad2)" strokeWidth="1.5" fill="none" opacity="0.4" />
                <circle cx="70" cy="78" r="22" stroke="url(#shieldGrad2)" strokeWidth="2" fill="none" />
                <path d="M60 78L67 85L82 70" stroke="url(#shieldGrad2)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="floating-element float-1">
              <div className="float-card">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#10b981" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
            </div>
            <div className="floating-element float-2">
              <div className="float-card">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#059669" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
            </div>
            <div className="floating-element float-3">
              <div className="float-card mini">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-split-footer">
          <p>© 2025 AI Risk Manager. All rights reserved.</p>
        </div>
      </div>

      <div className="auth-split-right">
        <div className="auth-form-container">
          <div className="auth-form-card otp-card">
            <div className="otp-icon">
              <div className="otp-icon-circle">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
            </div>

            <h2>Verify Your Phone</h2>
            <p className="otp-subtitle">
              We've sent a 6-digit verification code to<br />
              <strong>+91 98765 43210</strong>
            </p>

            <form onSubmit={handleSubmit}>
              <div className="otp-input-group">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className={`otp-input ${digit ? 'filled' : ''} ${activeIndex === index ? 'active' : ''}`}
                  />
                ))}
              </div>

              <button type="submit" className="submit-btn" disabled={isLoading || otp.join('').length < 6}>
                {isLoading ? (
                  <div className="btn-loader"></div>
                ) : (
                  'Verify OTP'
                )}
              </button>
            </form>

            <div className="otp-resend">
              {canResend ? (
                <button className="resend-btn" onClick={handleResend}>
                  Resend OTP
                </button>
              ) : (
                <span className="resend-timer">
                  Resend OTP in <strong>{resendTimer}s</strong>
                </span>
              )}
            </div>

            <p className="otp-back">
              <button className="back-btn-text" onClick={() => navigate('/login')}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Back to Login
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
