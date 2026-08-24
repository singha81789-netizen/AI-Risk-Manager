import { useNavigate } from 'react-router-dom'

export default function VerifyEmail() {
  const navigate = useNavigate()

  return (
    <div className="auth-page">
      <div className="auth-card verify-card">
        <h1>Verify Email</h1>

        <div className="verify-icon">
          <div className="verify-circle">
            <svg viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="38" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 4" />
              <rect x="15" y="25" width="50" height="35" rx="4" fill="#6366f1" opacity="0.1" stroke="#6366f1" strokeWidth="2" />
              <path d="M15 30L40 48L65 30" stroke="#6366f1" strokeWidth="2" fill="none" />
              <circle cx="60" cy="20" r="12" fill="#6366f1" />
              <path d="M55 20L58 23L65 16" stroke="#fff" strokeWidth="2" fill="none" />
            </svg>
          </div>
        </div>

        <h2>Verify Your Email</h2>
        <p className="verify-text">
          We've sent a verification link to<br />
          <strong>you@example.com</strong>
        </p>
        <p className="verify-subtext">
          Please check your inbox and click on the link to verify your account.
        </p>

        <button className="auth-submit-btn" style={{ marginBottom: '16px' }}>
          Resend Email
        </button>

        <button
          className="back-to-login"
          onClick={() => navigate('/login')}
        >
          Back to Login
        </button>
      </div>
    </div>
  )
}
