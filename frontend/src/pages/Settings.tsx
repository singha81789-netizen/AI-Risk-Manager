import { useState } from 'react'

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile')
  const [twoFactor, setTwoFactor] = useState(true)
  const [loginAlerts, setLoginAlerts] = useState(true)

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Profile & Settings</h1>
      </div>

      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button
          className={`settings-tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          Security
        </button>
        <button
          className={`settings-tab ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('preferences')}
        >
          Preferences
        </button>
        <button
          className={`settings-tab ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          Notifications
        </button>
      </div>

      <div className="settings-content">
        <div className="profile-card">
          <div className="profile-avatar">
            <div className="avatar-circle">
              <span>AS</span>
            </div>
          </div>
          <h2>Aryan Singh</h2>
          <p className="profile-role">Risk Analyst</p>
          <p className="profile-email">aryan.singh@example.com</p>
          <p className="profile-phone">+91 98765 43210</p>
          <button className="edit-profile-btn">Edit Profile</button>
        </div>

        <div className="settings-details">
          <div className="settings-section">
            <h3>Security Settings</h3>
            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label">Change Password</span>
                <span className="settings-item-value muted">Enabled</span>
              </div>
            </div>
            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label">Two-Factor Authentication</span>
                <span className={`settings-item-value ${twoFactor ? 'active' : ''}`}>
                  {twoFactor ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={twoFactor}
                  onChange={(e) => setTwoFactor(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label">Login Alerts</span>
                <span className={`settings-item-value ${loginAlerts ? 'active' : ''}`}>
                  {loginAlerts ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={loginAlerts}
                  onChange={(e) => setLoginAlerts(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h3>Account Activity</h3>
            <div className="activity-item">
              <span className="activity-label">Last Login</span>
              <span className="activity-value">23 Aug 2026, 10:35 PM</span>
            </div>
            <div className="activity-item">
              <span className="activity-label">IP Address</span>
              <span className="activity-value">117.204.45.67</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
