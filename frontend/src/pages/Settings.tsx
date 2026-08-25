import { useState } from 'react'
import { useCurrency } from '../contexts/CurrencyContext'

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile')
  const [twoFactor, setTwoFactor] = useState(true)
  const [loginAlerts, setLoginAlerts] = useState(true)
  const { currency, toggleCurrency } = useCurrency()

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Profile & Settings</h1>
      </div>

      <div className="settings-tabs">
        <button className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}>Profile</button>
        <button className={`settings-tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}>Security</button>
        <button className={`settings-tab ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('preferences')}>Preferences</button>
        <button className={`settings-tab ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}>Notifications</button>
      </div>

      <div className="settings-content">
        {activeTab === 'profile' && (
          <>
            <div className="profile-card">
              <div className="profile-avatar">AS</div>
              <div className="profile-info">
                <h3>Aryan Singh</h3>
                <p>Risk Analyst</p>
              </div>
              <button className="edit-profile-btn">Edit Profile</button>
            </div>
            <div className="settings-details">
              <div className="settings-section">
                <h3>Account Information</h3>
                <div className="settings-field">
                  <label>Email</label>
                  <span>aryan.singh@example.com</span>
                </div>
                <div className="settings-field">
                  <label>Phone</label>
                  <span>+91 98765 43210</span>
                </div>
                <div className="settings-field">
                  <label>Role</label>
                  <span>Risk Analyst</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'security' && (
          <div className="settings-details">
            <div className="settings-section">
              <h3>Security Settings</h3>
              <div className="settings-field">
                <label>Change Password</label>
                <button className="edit-profile-btn">Update Password</button>
              </div>
              <div className="settings-field">
                <label>Two-Factor Authentication</label>
                <div className="toggle-switch">
                  <input type="checkbox" checked={twoFactor} onChange={() => setTwoFactor(!twoFactor)} id="2fa" />
                  <label htmlFor="2fa" />
                </div>
              </div>
              <div className="settings-field">
                <label>Login Alerts</label>
                <div className="toggle-switch">
                  <input type="checkbox" checked={loginAlerts} onChange={() => setLoginAlerts(!loginAlerts)} id="login-alerts" />
                  <label htmlFor="login-alerts" />
                </div>
              </div>
            </div>
            <div className="settings-section">
              <h3>Account Activity</h3>
              <div className="settings-field">
                <label>Last Login</label>
                <span>Aug 25, 2026 3:45 PM IST</span>
              </div>
              <div className="settings-field">
                <label>IP Address</label>
                <span>103.21.58.xxx</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="settings-details">
            <div className="settings-section">
              <h3>Display Preferences</h3>
              <div className="currency-toggle">
                <span className="currency-toggle-label">Currency</span>
                <div className="currency-toggle-btn">
                  <button className={currency === 'USD' ? 'active' : ''} onClick={() => currency !== 'USD' && toggleCurrency()}>USD ($)</button>
                  <button className={currency === 'INR' ? 'active' : ''} onClick={() => currency !== 'INR' && toggleCurrency()}>INR (₹)</button>
                </div>
              </div>
            </div>
            <div className="settings-section">
              <h3>Data Refresh</h3>
              <div className="settings-field">
                <label>Auto-refresh dashboard</label>
                <span style={{ color: 'var(--color-text-secondary)' }}>Disabled (manual refresh only)</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="settings-details">
            <div className="settings-section">
              <h3>Notification Preferences</h3>
              <div className="settings-field">
                <label>Email notifications for high-risk alerts</label>
                <div className="toggle-switch">
                  <input type="checkbox" checked={true} onChange={() => {}} id="email-high" />
                  <label htmlFor="email-high" />
                </div>
              </div>
              <div className="settings-field">
                <label>Daily summary reports</label>
                <div className="toggle-switch">
                  <input type="checkbox" checked={false} onChange={() => {}} id="daily-summary" />
                  <label htmlFor="daily-summary" />
                </div>
              </div>
              <div className="settings-field">
                <label>Model retraining notifications</label>
                <div className="toggle-switch">
                  <input type="checkbox" checked={true} onChange={() => {}} id="model-retrain" />
                  <label htmlFor="model-retrain" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
