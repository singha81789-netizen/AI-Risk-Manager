import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell, AlertTriangle, Clock, CheckCircle, Settings, Search, ExternalLink,
  Ban, Shield, ChevronDown, X
} from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import type { Alert, AlertStatus } from '../types'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatCurrency(n: number) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const severityDot: Record<string, string> = {
  Critical: 'bg-red-500 animate-pulse',
  High: 'bg-red-500',
  Medium: 'bg-amber-500',
  Low: 'bg-blue-400',
}

const severityText: Record<string, string> = {
  Critical: 'text-red-400',
  High: 'text-red-400',
  Medium: 'text-amber-400',
  Low: 'text-blue-400',
}

const statusBadge: Record<string, string> = {
  New: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  'Under Review': 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  Resolved: 'bg-green-500/15 text-green-400 border border-green-500/20',
  'False Positive': 'bg-navy-500/15 text-navy-300 border border-navy-500/20',
}

type FilterTab = 'All' | 'New' | 'Under Review' | 'Resolved' | 'False Positive'

export default function Alerts() {
  const { alerts, updateAlertStatus, assignAlert, addAlertNote, team } = useApp()

  const [activeTab, setActiveTab] = useState<FilterTab>('All')
  const [search, setSearch] = useState('')
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [noteText, setNoteText] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [mobileDetail, setMobileDetail] = useState(false)

  // Notification settings state
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [inAppEnabled, setInAppEnabled] = useState(true)
  const [criticalThreshold, setCriticalThreshold] = useState('always')
  const [highThreshold, setHighThreshold] = useState('daily')
  const [mediumThreshold, setMediumThreshold] = useState('weekly')
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  // Counts
  const totalCount = alerts.length
  const criticalHighCount = useMemo(() => alerts.filter(a => a.severity === 'Critical' || a.severity === 'High').length, [alerts])
  const underReviewCount = useMemo(() => alerts.filter(a => a.status === 'Under Review').length, [alerts])
  const resolvedCount = useMemo(() => alerts.filter(a => a.status === 'Resolved').length, [alerts])

  const tabCounts = useMemo(() => ({
    All: alerts.length,
    New: alerts.filter(a => a.status === 'New').length,
    'Under Review': alerts.filter(a => a.status === 'Under Review').length,
    Resolved: alerts.filter(a => a.status === 'Resolved').length,
    'False Positive': alerts.filter(a => a.status === 'False Positive').length,
  }), [alerts])

  // Filtering
  const filtered = useMemo(() => {
    let result = alerts
    if (activeTab !== 'All') {
      result = result.filter(a => a.status === activeTab)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(a =>
        a.id.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.transactionId.toLowerCase().includes(q)
      )
    }
    return result
  }, [alerts, activeTab, search])

  const handleStatusChange = useCallback((alertId: string, newStatus: AlertStatus) => {
    updateAlertStatus(alertId, newStatus)
    setSelectedAlert(prev => prev && prev.id === alertId ? { ...prev, status: newStatus } : prev)
    showToast(`Alert status updated to ${newStatus}`)
  }, [updateAlertStatus, showToast])

  const handleAssign = useCallback((alertId: string, assignee: string) => {
    assignAlert(alertId, assignee)
    setSelectedAlert(prev => prev && prev.id === alertId ? { ...prev, assignee } : prev)
    showToast(`Alert assigned to ${assignee}`)
  }, [assignAlert, showToast])

  const handleAddNote = useCallback(() => {
    if (!selectedAlert || !noteText.trim()) return
    addAlertNote(selectedAlert.id, noteText.trim())
    setSelectedAlert(prev => prev ? {
      ...prev,
      timeline: [...prev.timeline, { action: 'Note Added', user: 'You', time: new Date().toISOString().replace('T', ' ').slice(0, 16), detail: noteText.trim() }]
    } : prev)
    setNoteText('')
    showToast('Note added')
  }, [selectedAlert, noteText, addAlertNote, showToast])

  const handleConfirmFraud = useCallback(() => {
    if (!selectedAlert) return
    handleStatusChange(selectedAlert.id, 'Resolved')
  }, [selectedAlert, handleStatusChange])

  const handleDismiss = useCallback(() => {
    if (!selectedAlert) return
    handleStatusChange(selectedAlert.id, 'False Positive')
  }, [selectedAlert, handleStatusChange])

  const handleEscalate = useCallback(() => {
    if (!selectedAlert) return
    showToast(`Alert ${selectedAlert.id} escalated`)
  }, [selectedAlert, showToast])

  const selectAlert = useCallback((alert: Alert) => {
    setSelectedAlert(alert)
    setMobileDetail(true)
  }, [])

  const statCards = [
    { label: 'Total Alerts', value: totalCount, icon: Bell, bg: 'bg-blue-500/15', iconColor: 'text-blue-400' },
    { label: 'Critical/High', value: criticalHighCount, icon: AlertTriangle, bg: 'bg-red-500/15', iconColor: 'text-red-400' },
    { label: 'Under Review', value: underReviewCount, icon: Clock, bg: 'bg-amber-500/15', iconColor: 'text-amber-400' },
    { label: 'Resolved', value: resolvedCount, icon: CheckCircle, bg: 'bg-green-500/15', iconColor: 'text-green-400' },
  ]

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] bg-green-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-[slideUp_0.2s_ease]">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="text-navy-300 text-sm mt-1">Review and manage fraud alerts</p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2.5 rounded-xl bg-navy-800/60 border border-white/5 text-navy-300 hover:text-white hover:bg-navy-700/60 transition-all"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(sc => (
          <div key={sc.label} className="glass-card p-5 group hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${sc.bg} flex items-center justify-center`}>
                <sc.icon className={`w-5 h-5 ${sc.iconColor}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">{sc.value}</div>
            <div className="text-xs text-navy-400">{sc.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex rounded-xl bg-navy-800/60 border border-white/5 p-0.5 flex-wrap">
          {(['All', 'New', 'Under Review', 'Resolved', 'False Positive'] as FilterTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                activeTab === tab ? 'bg-accent text-white shadow-sm' : 'text-navy-300 hover:text-white'
              }`}
            >
              {tab} <span className="ml-1 opacity-60">{tabCounts[tab]}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
          <input
            type="text"
            placeholder="Search alerts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9 text-sm"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-[3fr_2fr] gap-5">
        {/* Alert List */}
        <div className="space-y-3">
          {filtered.map(alert => (
            <div
              key={alert.id}
              onClick={() => selectAlert(alert)}
              className={`glass-card p-4 cursor-pointer transition-all duration-200 hover:shadow-lg mb-3 ${
                selectedAlert?.id === alert.id ? 'border-l-4 border-l-accent' : ''
              }`}
            >
              {/* Top Row */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${severityDot[alert.severity]}`} />
                <span className="text-xs font-mono text-navy-300">{alert.id}</span>
                <span className={`text-xs font-medium ${severityText[alert.severity]}`}>{alert.severity}</span>
                <span className={`ml-auto inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[alert.status]}`}>
                  {alert.status}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-sm font-bold text-white mb-1">{alert.title}</h3>

              {/* Description */}
              <p className="text-xs text-navy-300 line-clamp-2 mb-3">{alert.description}</p>

              {/* Meta */}
              <div className="flex items-center gap-4 text-xs text-navy-400 mb-3">
                <Link
                  to="/transactions"
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-1 text-accent hover:underline"
                >
                  {alert.transactionId} <ExternalLink className="w-3 h-3" />
                </Link>
                <span>{timeAgo(alert.createdAt)}</span>
                {alert.assignee && alert.assignee !== 'Unassigned' && (
                  <span className="px-1.5 py-0.5 rounded bg-navy-700/60 text-navy-300">{alert.assignee}</span>
                )}
              </div>

              {/* Action Row */}
              <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                <div className="relative">
                  <select
                    value={alert.status}
                    onChange={e => handleStatusChange(alert.id, e.target.value as AlertStatus)}
                    className="input-field !py-1.5 !px-3 text-xs !w-auto appearance-none pr-7 cursor-pointer"
                  >
                    <option value="New">New</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Resolved">Resolved</option>
                    <option value="False Positive">False Positive</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-navy-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={alert.assignee}
                    onChange={e => handleAssign(alert.id, e.target.value)}
                    className="input-field !py-1.5 !px-3 text-xs !w-auto appearance-none pr-7 cursor-pointer"
                  >
                    <option value="Unassigned">Unassigned</option>
                    {team.map(m => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-navy-400 pointer-events-none" />
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="glass-card p-12 text-center">
              <Bell className="w-10 h-10 text-navy-600 mx-auto mb-3" />
              <p className="text-sm text-navy-400">No alerts match your filters</p>
            </div>
          )}
        </div>

        {/* Alert Detail Panel - Desktop */}
        {selectedAlert && (
          <div className="hidden lg:block">
            <div className="glass-card p-5 sticky top-24 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">{selectedAlert.id}</h2>
                  <p className="text-xs text-navy-400 mt-0.5">Alert Detail</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[selectedAlert.status]}`}>
                    {selectedAlert.status}
                  </span>
                </div>
              </div>

              {/* Severity + Title */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${severityDot[selectedAlert.severity]}`} />
                  <span className={`text-xs font-medium ${severityText[selectedAlert.severity]}`}>{selectedAlert.severity}</span>
                </div>
                <h3 className="text-sm font-bold text-white">{selectedAlert.title}</h3>
                <p className="text-xs text-navy-300 mt-1">{selectedAlert.description}</p>
              </div>

              {/* Transaction Info */}
              <div>
                <h4 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3">Transaction Info</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-navy-400">Transaction ID</span>
                    <Link to="/transactions" className="text-xs text-accent hover:underline flex items-center gap-1">
                      {selectedAlert.transactionId} <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-navy-400">Risk Score</span>
                    <span className="text-xs font-bold text-white">{selectedAlert.riskScore}/100</span>
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              <div>
                <h4 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3">AI Analysis</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-navy-300">Risk Score</span>
                      <span className={`text-sm font-bold ${selectedAlert.riskScore >= 85 ? 'text-red-400' : selectedAlert.riskScore >= 70 ? 'text-amber-400' : 'text-green-400'}`}>
                        {selectedAlert.riskScore}/100
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-navy-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          selectedAlert.riskScore >= 85 ? 'bg-red-500' : selectedAlert.riskScore >= 70 ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${selectedAlert.riskScore}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-navy-800/50 border border-white/5">
                      <span className="text-[10px] text-navy-400 uppercase tracking-wider block mb-1">Fraud Probability</span>
                      <span className="text-sm font-bold text-white">{Math.min(99, selectedAlert.riskScore + 3)}%</span>
                    </div>
                    <div className="p-3 rounded-xl bg-navy-800/50 border border-white/5">
                      <span className="text-[10px] text-navy-400 uppercase tracking-wider block mb-1">Confidence</span>
                      <span className="text-sm font-bold text-white">{Math.min(99, selectedAlert.riskScore - 5)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h4 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3">Timeline</h4>
                <div className="relative border-l-2 border-navy-700 ml-2 space-y-4">
                  {selectedAlert.timeline.map((entry, i) => (
                    <div key={i} className="relative pl-5">
                      <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-accent border-2 border-navy-900" />
                      <div className="text-xs text-navy-300 mb-0.5">{entry.action}</div>
                      <div className="text-[10px] text-navy-500">{entry.user} &middot; {entry.time}</div>
                      <p className="text-xs text-navy-200 mt-0.5">{entry.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <h4 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3">Notes</h4>
                <div className="space-y-2">
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add a note..."
                    rows={3}
                    className="input-field text-sm resize-none"
                  />
                  <button onClick={handleAddNote} className="btn-primary text-sm w-full" disabled={!noteText.trim()}>
                    Add Note
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <button onClick={handleConfirmFraud} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors">
                  <Ban className="w-4 h-4" /> Confirm Fraud
                </button>
                <button onClick={handleDismiss} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-500/15 border border-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/25 transition-colors">
                  <CheckCircle className="w-4 h-4" /> Dismiss
                </button>
                <button onClick={handleEscalate} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/25 transition-colors">
                  <Shield className="w-4 h-4" /> Escalate
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Detail Modal */}
      {selectedAlert && mobileDetail && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm lg:hidden" onClick={() => setMobileDetail(false)} />
          <div className="fixed inset-x-0 bottom-0 top-16 bg-navy-900 border-t border-white/10 z-50 flex flex-col overflow-y-auto lg:hidden animate-[slideUp_0.25s_ease] rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-navy-900 z-10">
              <div>
                <h2 className="text-base font-bold text-white">{selectedAlert.id}</h2>
                <p className="text-xs text-navy-400 mt-0.5">Alert Detail</p>
              </div>
              <button onClick={() => setMobileDetail(false)} className="p-1.5 rounded-lg hover:bg-navy-700/50 text-navy-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${severityDot[selectedAlert.severity]}`} />
                  <span className={`text-xs font-medium ${severityText[selectedAlert.severity]}`}>{selectedAlert.severity}</span>
                  <span className={`ml-auto inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[selectedAlert.status]}`}>
                    {selectedAlert.status}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">{selectedAlert.title}</h3>
                <p className="text-xs text-navy-300 mt-1">{selectedAlert.description}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3">Transaction Info</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-navy-400">Transaction ID</span>
                    <Link to="/transactions" onClick={() => setMobileDetail(false)} className="text-xs text-accent hover:underline flex items-center gap-1">
                      {selectedAlert.transactionId} <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-navy-400">Risk Score</span>
                    <span className="text-xs font-bold text-white">{selectedAlert.riskScore}/100</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3">Timeline</h4>
                <div className="relative border-l-2 border-navy-700 ml-2 space-y-4">
                  {selectedAlert.timeline.map((entry, i) => (
                    <div key={i} className="relative pl-5">
                      <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-accent border-2 border-navy-900" />
                      <div className="text-xs text-navy-300 mb-0.5">{entry.action}</div>
                      <div className="text-[10px] text-navy-500">{entry.user} &middot; {entry.time}</div>
                      <p className="text-xs text-navy-200 mt-0.5">{entry.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-3">Notes</h4>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                  className="input-field text-sm resize-none"
                />
                <button onClick={handleAddNote} className="btn-primary text-sm w-full mt-2" disabled={!noteText.trim()}>
                  Add Note
                </button>
              </div>

              <div className="flex flex-col gap-2 pb-6">
                <button onClick={handleConfirmFraud} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors">
                  <Ban className="w-4 h-4" /> Confirm Fraud
                </button>
                <button onClick={handleDismiss} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-500/15 border border-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/25 transition-colors">
                  <CheckCircle className="w-4 h-4" /> Dismiss
                </button>
                <button onClick={handleEscalate} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/25 transition-colors">
                  <Shield className="w-4 h-4" /> Escalate
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Notification Settings Modal */}
      {showSettings && (
        <>
          <div className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-navy-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto animate-[slideUp_0.25s_ease]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Notification Settings</h2>
                    <p className="text-xs text-navy-400">Configure alert notifications</p>
                  </div>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg hover:bg-navy-700/50 text-navy-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Toggle switches */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-navy-400 uppercase tracking-wider">Channels</h4>
                  {[
                    { label: 'Email notifications', enabled: emailEnabled, toggle: setEmailEnabled },
                    { label: 'SMS notifications', enabled: smsEnabled, toggle: setSmsEnabled },
                    { label: 'In-app notifications', enabled: inAppEnabled, toggle: setInAppEnabled },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm text-navy-200">{item.label}</span>
                      <button
                        onClick={() => item.toggle(!item.enabled)}
                        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${item.enabled ? 'bg-accent' : 'bg-navy-600'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${item.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Severity thresholds */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-navy-400 uppercase tracking-wider">Severity Thresholds</h4>
                  {[
                    { label: 'Critical', value: criticalThreshold, set: setCriticalThreshold, options: [{ v: 'always', l: 'Always' }] },
                    { label: 'High', value: highThreshold, set: setHighThreshold, options: [{ v: 'daily', l: 'Daily Digest' }, { v: 'realtime', l: 'Real-time' }] },
                    { label: 'Medium', value: mediumThreshold, set: setMediumThreshold, options: [{ v: 'weekly', l: 'Weekly Digest' }, { v: 'daily', l: 'Daily Digest' }, { v: 'realtime', l: 'Real-time' }] },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm text-navy-200">{item.label}</span>
                      <div className="relative">
                        <select
                          value={item.value}
                          onChange={e => item.set(e.target.value)}
                          className="input-field !py-1.5 !px-3 text-xs !w-auto appearance-none pr-7"
                        >
                          {item.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-navy-400 pointer-events-none" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-6 pb-6">
                <button
                  onClick={() => { setShowSettings(false); showToast('Settings saved') }}
                  className="btn-primary text-sm w-full"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
