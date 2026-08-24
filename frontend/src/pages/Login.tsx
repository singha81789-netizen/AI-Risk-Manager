import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'email' | 'phone'>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      navigate('/')
    }, 1500)
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
            AI-Powered Risk &<br />
            <span className="gradient-text">Fraud Detection</span>
          </h1>
          <p>Detect, flag, and manage financial risks and fraud patterns in real-time.</p>
        </div>

        <div className="auth-split-visual">
          <div className="shield-visual">
            <div className="shield-glow-bg"></div>
            <div className="shield-main">
              <svg width="140" height="160" viewBox="0 0 140 160" fill="none">
                <defs>
                  <linearGradient id="shieldGrad" x1="70" y1="0" x2="70" y2="160" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8b5cf6" />
                    <stop offset="1" stopColor="#6366f1" />
                  </linearGradient>
                  <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
                <path d="M70 10L15 35V75C15 115 35 145 70 155C105 145 125 115 125 75V35L70 10Z"
                  stroke="url(#shieldGrad)" strokeWidth="2" fill="none" />
                <path d="M70 30L30 50V80C30 110 48 132 70 140C92 132 110 110 110 80V50L70 30Z"
                  stroke="url(#shieldGrad)" strokeWidth="1.5" fill="none" opacity="0.4" />
                <circle cx="70" cy="78" r="22" stroke="url(#shieldGrad)" strokeWidth="1.5" fill="none" />
                <path d="M58 78C58 70 64 63 70 63C76 63 82 70 82 78C82 86 76 93 70 93"
                  stroke="url(#brainGrad)" strokeWidth="2" fill="none" />
                <circle cx="70" cy="78" r="4" fill="#8b5cf6" />
                <circle cx="58" cy="68" r="2" fill="#a78bfa" opacity="0.6" />
                <circle cx="82" cy="68" r="2" fill="#a78bfa" opacity="0.6" />
                <circle cx="55" cy="85" r="1.5" fill="#818cf8" opacity="0.5" />
                <circle cx="85" cy="85" r="1.5" fill="#818cf8" opacity="0.5" />
              </svg>
            </div>
            <div className="floating-element float-1">
              <div className="float-card">
                <div className="float-bars">
                  <div className="bar" style={{ height: '35%' }}></div>
                  <div className="bar" style={{ height: '65%' }}></div>
                  <div className="bar" style={{ height: '45%' }}></div>
                  <div className="bar" style={{ height: '80%' }}></div>
                  <div className="bar" style={{ height: '55%' }}></div>
                </div>
              </div>
            </div>
            <div className="floating-element float-2">
              <div className="float-card">
                <div className="float-lines">
                  <div className="line"></div>
                  <div className="line short"></div>
                  <div className="line medium"></div>
                </div>
              </div>
            </div>
            <div className="floating-element float-3">
              <div className="float-card mini">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#8b5cf6" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
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
          <div className="auth-form-card">
            <div className="auth-form-logo">
              <div className="form-logo-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
            </div>

            <h2>Welcome Back!</h2>
            <p className="auth-form-subtitle">Sign in to your AI Risk Manager account</p>

            <div className="auth-tabs">
              <button
                className={`auth-tab ${activeTab === 'email' ? 'active' : ''}`}
                onClick={() => setActiveTab('email')}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Email
              </button>
              <button
                className={`auth-tab ${activeTab === 'phone' ? 'active' : ''}`}
                onClick={() => setActiveTab('phone')}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                Phone
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {activeTab === 'email' ? (
                <div className="input-group">
                  <label>Email address</label>
                  <div className="input-wrapper">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="input-group">
                  <label>Phone number</label>
                  <div className="input-wrapper phone-input">
                    <span className="phone-prefix">+91</span>
                    <input
                      type="tel"
                      placeholder="98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="input-group">
                <label>Password</label>
                <div className="input-wrapper">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="toggle-visibility"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="form-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  Remember me
                </label>
                <a href="#" className="forgot-link">Forgot password?</a>
              </div>

              <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? (
                  <div className="btn-loader"></div>
                ) : (
                  'Login'
                )}
              </button>
            </form>

            <div className="social-divider">
              <span>or continue with</span>
            </div>

            <div className="social-buttons">
              <button type="button" className="social-btn">
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
              <button type="button" className="social-btn">
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
                  <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
                  <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
                  <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
                </svg>
                Microsoft
              </button>
            </div>

            <p className="auth-switch-link">
              Don't have an account? <a onClick={() => navigate('/register')}>Sign up</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
