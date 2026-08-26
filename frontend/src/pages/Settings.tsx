import { useState, useCallback } from 'react'
import {
  User, Shield, Users, Key, Bell, Palette, Check, Copy, Trash2, Plus, X, Sun, Moon, Save
} from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { useTheme } from '../contexts/ThemeContext'
import type { UserRole } from '../types'

type Tab = 'Profile' | 'Risk Thresholds' | 'Team' | 'API Keys' | 'Notifications' | 'Appearance'

const TABS: { id: Tab; icon: typeof User; label: string }[] = [
  { id: 'Profile', icon: User, label: 'Profile' },
  { id: 'Risk Thresholds', icon: Shield, label: 'Risk Thresholds' },
  { id: 'Team', icon: Users, label: 'Team' },
  { id: 'API Keys', icon: Key, label: 'API Keys' },
  { id: 'Notifications', icon: Bell, label: 'Notifications' },
  { id: 'Appearance', icon: Palette, label: 'Appearance' },
]

const ROLES: UserRole[] = ['Admin', 'Analyst', 'Viewer']

export default function Settings() {
  const {
    user, thresholds, updateThresholds, addAuditEntry,
    team, addTeamMember, removeTeamMember,
    apiKeys, generateApiKey, revokeApiKey,
  } = useApp()
  const { theme, toggleTheme } = useTheme()

  const [activeTab, setActiveTab] = useState<Tab>('Profile')
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const now = () => new Date().toISOString().replace('T', ' ').slice(0, 16)

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-green-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-[slideUp_0.2s_ease]">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
      </div>

      <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-accent text-white shadow-sm'
                : 'text-navy-300 hover:text-white hover:bg-navy-800/60'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'Profile' && (
        <ProfileTab user={user} showToast={showToast} addAuditEntry={addAuditEntry} now={now} />
      )}
      {activeTab === 'Risk Thresholds' && (
        <ThresholdsTab thresholds={thresholds} updateThresholds={updateThresholds} addAuditEntry={addAuditEntry} showToast={showToast} now={now} />
      )}
      {activeTab === 'Team' && (
        <TeamTab team={team} addTeamMember={addTeamMember} removeTeamMember={removeTeamMember} showToast={showToast} />
      )}
      {activeTab === 'API Keys' && (
        <ApiKeyTab apiKeys={apiKeys} generateApiKey={generateApiKey} revokeApiKey={revokeApiKey} showToast={showToast} />
      )}
      {activeTab === 'Notifications' && (
        <NotificationsTab showToast={showToast} />
      )}
      {activeTab === 'Appearance' && (
        <AppearanceTab theme={theme} toggleTheme={toggleTheme} showToast={showToast} />
      )}
    </div>
  )
}

function ProfileTab({ user, showToast, addAuditEntry, now }: any) {
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState('')
  const initials = (user?.name ?? 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="glass-card p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center text-xl font-bold text-accent">
          {initials}
        </div>
        <div>
          <div className="text-white font-semibold">{user?.name ?? 'User'}</div>
          <div className="text-navy-400 text-sm">{user?.role ?? 'Admin'}</div>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-navy-400 mb-1 block">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className="input-field text-sm" />
        </div>
        <div>
          <label className="text-xs text-navy-400 mb-1 block">Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} className="input-field text-sm" type="email" />
        </div>
        <div>
          <label className="text-xs text-navy-400 mb-1 block">Phone</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} className="input-field text-sm" placeholder="+1 (555) 000-0000" />
        </div>
        <div>
          <label className="text-xs text-navy-400 mb-1 block">Role</label>
          <input value={user?.role ?? 'Admin'} readOnly className="input-field text-sm opacity-60 cursor-not-allowed" />
        </div>
      </div>
      <button
        onClick={() => {
          addAuditEntry({ id: 'AUD-' + Date.now(), action: 'Profile Updated', user: name || 'User', timestamp: now(), details: 'User updated profile information', ipAddress: '127.0.0.1', module: 'Settings' })
          showToast('Profile saved')
        }}
        className="btn-primary text-sm flex items-center gap-2"
      >
        <Save className="w-4 h-4" /> Save Changes
      </button>
    </div>
  )
}

function ThresholdsTab({ thresholds, updateThresholds, addAuditEntry, showToast, now }: any) {
  const [low, setLow] = useState(thresholds.low)
  const [medium, setMedium] = useState(thresholds.medium)
  const [high, setHigh] = useState(thresholds.high)

  const valid = low < medium && medium < high

  return (
    <div className="glass-card p-6 space-y-6 max-w-2xl">
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-white font-medium">Low Risk Threshold</label>
            <span className="text-xs text-green-400 font-mono">{low}</span>
          </div>
          <input
            type="range" min={0} max={100} value={low}
            onChange={e => setLow(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: '#10B981' }}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-white font-medium">Medium Risk Threshold</label>
            <span className="text-xs text-amber-400 font-mono">{medium}</span>
          </div>
          <input
            type="range" min={0} max={100} value={medium}
            onChange={e => setMedium(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: '#F59E0B' }}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-white font-medium">High Risk Threshold</label>
            <span className="text-xs text-red-400 font-mono">{high}</span>
          </div>
          <input
            type="range" min={0} max={100} value={high}
            onChange={e => setHigh(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: '#EF4444' }}
          />
        </div>
      </div>

      <div className="rounded-xl bg-navy-800/50 border border-white/5 p-4">
        <div className="text-xs text-navy-400 mb-2">Preview</div>
        <div className="flex h-6 rounded-lg overflow-hidden">
          <div className="bg-green-500" style={{ width: `${low}%` }} />
          <div className="bg-amber-500" style={{ width: `${medium - low}%` }} />
          <div className="bg-red-500" style={{ width: `${100 - high}%` }} />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-navy-400">
          <span>0</span>
          <span>Low: {low}</span>
          <span>Med: {medium}</span>
          <span>High: {high}</span>
          <span>100</span>
        </div>
      </div>

      {!valid && (
        <p className="text-xs text-red-400">Low must be less than Medium, and Medium must be less than High.</p>
      )}

      <button
        disabled={!valid}
        onClick={() => {
          updateThresholds({ low, medium, high })
          showToast('Thresholds saved')
        }}
        className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Save className="w-4 h-4" /> Save Changes
      </button>
    </div>
  )
}

function TeamTab({ team, addTeamMember, removeTeamMember, showToast }: any) {
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('Viewer')

  const handleInvite = () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return
    addTeamMember({
      id: 'TM-' + Date.now(),
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      status: 'Invited',
      lastActive: 'Pending',
    })
    showToast(`Invite sent to ${inviteName.trim()}`)
    setInviteName('')
    setInviteEmail('')
    setInviteRole('Viewer')
    setShowInvite(false)
  }

  const handleRemove = (id: string, name: string) => {
    if (confirm(`Remove ${name} from the team?`)) {
      removeTeamMember(id)
      showToast(`${name} removed from team`)
    }
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Team Members</h2>
        <button onClick={() => setShowInvite(!showInvite)} className="btn-secondary text-xs flex items-center gap-1.5">
          {showInvite ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {showInvite ? 'Cancel' : 'Invite Member'}
        </button>
      </div>

      {showInvite && (
        <div className="p-4 rounded-xl bg-navy-800/40 border border-white/5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input placeholder="Name" value={inviteName} onChange={e => setInviteName(e.target.value)} className="input-field text-sm" />
            <input placeholder="Email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="input-field text-sm" type="email" />
            <div className="relative">
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as UserRole)} className="input-field text-sm appearance-none pr-7">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleInvite} className="btn-primary text-xs">Send Invite</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {['Name', 'Email', 'Role', 'Status', 'Last Active', 'Actions'].map(h => (
                <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-navy-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.map((m: any) => (
              <tr key={m.id} className="border-b border-white/5 hover:bg-navy-800/30 transition-colors">
                <td className="py-3 px-3 text-white font-medium">{m.name}</td>
                <td className="py-3 px-3 text-navy-300 text-xs">{m.email}</td>
                <td className="py-3 px-3">
                  <div className="relative">
                    <select defaultValue={m.role} className="input-field !py-1 !px-2 text-xs !w-auto appearance-none pr-6">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'Active' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {m.status}
                  </span>
                </td>
                <td className="py-3 px-3 text-navy-400 text-xs">{m.lastActive}</td>
                <td className="py-3 px-3">
                  <button
                    onClick={() => handleRemove(m.id, m.name)}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ApiKeyTab({ apiKeys, generateApiKey, revokeApiKey, showToast }: any) {
  const [showGenerate, setShowGenerate] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleGenerate = () => {
    if (!keyName.trim()) return
    generateApiKey(keyName.trim())
    const generated = apiKeys[apiKeys.length - 1]
    if (generated) setNewKeyValue(generated.key)
    showToast(`API key "${keyName.trim()}" generated`)
    setKeyName('')
    setShowGenerate(false)
  }

  const handleCopy = (key: string, id: string) => {
    navigator.clipboard.writeText(key)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRevoke = (id: string, name: string) => {
    if (confirm(`Revoke API key "${name}"?`)) {
      revokeApiKey(id)
      showToast(`API key "${name}" revoked`)
    }
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">API Keys</h2>
        <button onClick={() => setShowGenerate(!showGenerate)} className="btn-secondary text-xs flex items-center gap-1.5">
          {showGenerate ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {showGenerate ? 'Cancel' : 'Generate New Key'}
        </button>
      </div>

      {showGenerate && (
        <div className="p-4 rounded-xl bg-navy-800/40 border border-white/5 flex gap-3">
          <input
            placeholder="Key name"
            value={keyName}
            onChange={e => setKeyName(e.target.value)}
            className="input-field text-sm flex-1"
          />
          <button onClick={handleGenerate} className="btn-primary text-xs whitespace-nowrap">Generate</button>
        </div>
      )}

      {newKeyValue && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 space-y-2">
          <div className="text-xs text-green-400 font-medium">New API Key (copy now, it won't be shown again):</div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-white bg-navy-800/60 px-3 py-1.5 rounded-lg flex-1 overflow-x-auto">{newKeyValue}</code>
            <button
              onClick={() => handleCopy(newKeyValue, 'new')}
              className="p-1.5 rounded-lg bg-navy-800/60 text-navy-300 hover:text-white transition-colors"
            >
              {copiedId === 'new' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {apiKeys.map((k: any) => (
          <div key={k.id} className="flex items-center justify-between p-4 rounded-xl bg-navy-800/30 border border-white/5 hover:bg-navy-800/50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-white">{k.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${k.active ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                  {k.active ? 'Active' : 'Revoked'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs text-navy-300 font-mono">{k.key.slice(0, 7)}****...****</code>
                {k.active && (
                  <button
                    onClick={() => handleCopy(k.key, k.id)}
                    className="text-navy-400 hover:text-white transition-colors"
                  >
                    {copiedId === k.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
              <div className="text-[10px] text-navy-500 mt-1">Created: {k.createdAt} | Last used: {k.lastUsed}</div>
            </div>
            {k.active && (
              <button
                onClick={() => handleRevoke(k.id, k.name)}
                className="ml-3 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Revoke
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function NotificationsTab({ showToast }: { showToast: (msg: string) => void }) {
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [smsAlerts, setSmsAlerts] = useState(false)
  const [inAppAlerts, setInAppAlerts] = useState(true)
  const [desktopAlerts, setDesktopAlerts] = useState(false)
  const [emailFreq, setEmailFreq] = useState('Instant')
  const [smsFreq, setSmsFreq] = useState('Daily digest')
  const [inAppFreq, setInAppFreq] = useState('Instant')
  const [desktopFreq, setDesktopFreq] = useState('Hourly digest')

  const toggles = [
    { label: 'Email Alerts', enabled: emailAlerts, toggle: setEmailAlerts, freq: emailFreq, setFreq: setEmailFreq },
    { label: 'SMS Alerts', enabled: smsAlerts, toggle: setSmsAlerts, freq: smsFreq, setFreq: setSmsFreq },
    { label: 'In-App Notifications', enabled: inAppAlerts, toggle: setInAppAlerts, freq: inAppFreq, setFreq: setInAppFreq },
    { label: 'Desktop Notifications', enabled: desktopAlerts, toggle: setDesktopAlerts, freq: desktopFreq, setFreq: setDesktopFreq },
  ]

  return (
    <div className="glass-card p-6 space-y-6 max-w-2xl">
      {toggles.map(t => (
        <div key={t.label} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => t.toggle(!t.enabled)}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${t.enabled ? 'bg-accent' : 'bg-navy-600'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${t.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-white">{t.label}</span>
          </div>
          {t.enabled && (
            <div className="relative">
              <select
                value={t.freq}
                onChange={e => t.setFreq(e.target.value)}
                className="input-field !py-1.5 !px-3 text-xs !w-auto appearance-none pr-7"
              >
                <option>Instant</option>
                <option>Hourly digest</option>
                <option>Daily digest</option>
              </select>
            </div>
          )}
        </div>
      ))}
      <button onClick={() => showToast('Notification preferences saved')} className="btn-primary text-sm flex items-center gap-2">
        <Save className="w-4 h-4" /> Save Preferences
      </button>
    </div>
  )
}

function AppearanceTab({ theme, toggleTheme, showToast }: { theme: string; toggleTheme: () => void; showToast: (msg: string) => void }) {
  const [language, setLanguage] = useState('English')

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Theme</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => { if (theme !== 'dark') toggleTheme(); showToast('Theme set to Dark') }}
            className={`relative p-4 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-accent shadow-lg shadow-accent/10' : 'border-white/10 hover:border-white/20'}`}
          >
            {theme === 'dark' && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            <div className="rounded-lg bg-navy-950 p-3 mb-3 border border-white/5">
              <div className="flex gap-2 mb-2">
                <div className="w-8 h-1.5 rounded bg-navy-700" />
                <div className="w-6 h-1.5 rounded bg-navy-600" />
              </div>
              <div className="h-10 rounded bg-navy-800 border border-white/5" />
            </div>
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-navy-300" />
              <span className="text-sm font-medium text-white">Dark</span>
            </div>
          </button>

          <button
            onClick={() => { if (theme !== 'light') toggleTheme(); showToast('Theme set to Light') }}
            className={`relative p-4 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-accent shadow-lg shadow-accent/10' : 'border-white/10 hover:border-white/20'}`}
          >
            {theme === 'light' && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            <div className="rounded-lg bg-gray-100 p-3 mb-3 border border-gray-200">
              <div className="flex gap-2 mb-2">
                <div className="w-8 h-1.5 rounded bg-gray-300" />
                <div className="w-6 h-1.5 rounded bg-gray-200" />
              </div>
              <div className="h-10 rounded bg-white border border-gray-200" />
            </div>
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-white">Light</span>
            </div>
          </button>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Language</h2>
        <div className="relative max-w-xs">
          <select
            value={language}
            onChange={e => { setLanguage(e.target.value); showToast(`Language set to ${e.target.value}`) }}
            className="input-field text-sm appearance-none pr-7"
          >
            {['English', 'Spanish', 'French', 'German', 'Japanese', 'Chinese'].map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
