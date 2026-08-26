import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import type {
  User, Transaction, Alert, AiModel, Report, AuditEntry,
  Case, TeamMember, ApiKey, ScheduledReport, Notification,
  AlertStatus, ModelStatus
} from '../types'
import {
  mockTransactions, mockAlerts, mockModels, mockReports,
  mockAuditLog, mockCases, mockTeam, mockApiKeys,
  mockScheduledReports, mockNotifications
} from '../data/mockData'

interface Thresholds {
  low: number
  medium: number
  high: number
}

interface AppContextValue {
  user: User | null
  transactions: Transaction[]
  alerts: Alert[]
  models: AiModel[]
  reports: Report[]
  auditLog: AuditEntry[]
  cases: Case[]
  team: TeamMember[]
  apiKeys: ApiKey[]
  scheduledReports: ScheduledReport[]
  notifications: Notification[]
  thresholds: Thresholds
  riskDistribution: { LOW: number; MEDIUM: number; HIGH: number }

  login: (email: string, password: string, role: User['role']) => void
  logout: () => void
  addTransactions: (txns: Transaction[]) => void
  updateAlertStatus: (alertId: string, newStatus: AlertStatus) => void
  assignAlert: (alertId: string, assignee: string) => void
  addAlertNote: (alertId: string, note: string) => void
  updateModelStatus: (modelId: string, status: ModelStatus) => void
  retrainModel: (modelId: string) => void
  addReport: (report: Report) => void
  updateThresholds: (t: Thresholds) => void
  addAuditEntry: (entry: AuditEntry) => void
  addCase: (c: Case) => void
  updateCase: (caseId: string, updates: Partial<Case>) => void
  addCaseNote: (caseId: string, note: { user: string; text: string; time: string }) => void
  addTeamMember: (member: TeamMember) => void
  removeTeamMember: (memberId: string) => void
  generateApiKey: (name: string) => void
  revokeApiKey: (keyId: string) => void
  addNotification: (n: Notification) => void
  markNotificationRead: (id: string) => void
}

const AppContext = createContext<AppContextValue | undefined>(undefined)

function generateKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'rg_'
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function now(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 16)
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions)
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts)
  const [models, setModels] = useState<AiModel[]>(mockModels)
  const [reports, setReports] = useState<Report[]>(mockReports)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(mockAuditLog)
  const [cases, setCases] = useState<Case[]>(mockCases)
  const [team, setTeam] = useState<TeamMember[]>(mockTeam)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(mockApiKeys)
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>(mockScheduledReports)
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [thresholds, setThresholds] = useState<Thresholds>({ low: 40, medium: 70, high: 85 })

  const riskDistribution = useMemo(() => ({
    LOW: transactions.filter(t => t.riskLevel === 'LOW').length,
    MEDIUM: transactions.filter(t => t.riskLevel === 'MEDIUM').length,
    HIGH: transactions.filter(t => t.riskLevel === 'HIGH').length,
  }), [transactions])

  const login = useCallback((email: string, _password: string, role: User['role']) => {
    const newUser: User = { id: 'USR-' + Date.now(), name: email.split('@')[0], email, role }
    setUser(newUser)
    setAuditLog(prev => [{ id: 'AUD-' + Date.now(), action: 'Login', user: newUser.name, timestamp: now(), details: `User logged in as ${role}`, ipAddress: '127.0.0.1', module: 'Auth' }, ...prev])
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  const addTransactions = useCallback((txns: Transaction[]) => {
    setTransactions(prev => [...txns, ...prev])
    setAuditLog(prev => [{ id: 'AUD-' + Date.now(), action: 'Transactions Imported', user: user?.name ?? 'System', timestamp: now(), details: `Imported ${txns.length} transactions`, ipAddress: '127.0.0.1', module: 'Transactions' }, ...prev])
  }, [user])

  const updateAlertStatus = useCallback((alertId: string, newStatus: AlertStatus) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? {
      ...a, status: newStatus,
      timeline: [...a.timeline, { action: 'Status Changed', user: user?.name ?? 'System', time: now(), detail: `Status changed to ${newStatus}` }]
    } : a))
    setAuditLog(prev => [{ id: 'AUD-' + Date.now(), action: 'Alert Status Updated', user: user?.name ?? 'System', timestamp: now(), details: `Alert ${alertId} status changed to ${newStatus}`, ipAddress: '127.0.0.1', module: 'Alerts' }, ...prev])
  }, [user])

  const assignAlert = useCallback((alertId: string, assignee: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? {
      ...a, assignee,
      timeline: [...a.timeline, { action: 'Assigned', user: user?.name ?? 'System', time: now(), detail: `Assigned to ${assignee}` }]
    } : a))
  }, [user])

  const addAlertNote = useCallback((alertId: string, note: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? {
      ...a,
      timeline: [...a.timeline, { action: 'Note Added', user: user?.name ?? 'System', time: now(), detail: note }]
    } : a))
  }, [user])

  const updateModelStatus = useCallback((modelId: string, status: ModelStatus) => {
    setModels(prev => prev.map(m => m.id === modelId ? { ...m, status } : m))
  }, [])

  const retrainModel = useCallback((modelId: string) => {
    setModels(prev => prev.map(m => m.id === modelId ? { ...m, status: 'training' as ModelStatus } : m))
    setTimeout(() => {
      setModels(prev => prev.map(m => m.id === modelId ? {
        ...m, status: 'active' as ModelStatus,
        accuracy: m.accuracy != null ? Math.min(99.9, m.accuracy + Math.random() * 0.5) : null,
        precision: m.precision != null ? Math.min(99.9, m.precision + Math.random() * 0.5) : null,
        recall: m.recall != null ? Math.min(99.9, m.recall + Math.random() * 0.5) : null,
        f1Score: m.f1Score != null ? Math.min(99.9, m.f1Score + Math.random() * 0.5) : null,
        lastTrained: now().slice(0, 10),
      } : m))
    }, 2000)
  }, [])

  const addReport = useCallback((report: Report) => {
    setReports(prev => [report, ...prev])
  }, [])

  const updateThresholds = useCallback((t: Thresholds) => {
    setThresholds(t)
    setAuditLog(prev => [{ id: 'AUD-' + Date.now(), action: 'Thresholds Updated', user: user?.name ?? 'System', timestamp: now(), details: `Thresholds set to LOW=${t.low}, MEDIUM=${t.medium}, HIGH=${t.high}`, ipAddress: '127.0.0.1', module: 'Settings' }, ...prev])
  }, [user])

  const addAuditEntry = useCallback((entry: AuditEntry) => {
    setAuditLog(prev => [entry, ...prev])
  }, [])

  const addCase = useCallback((c: Case) => {
    setCases(prev => [c, ...prev])
  }, [])

  const updateCase = useCallback((caseId: string, updates: Partial<Case>) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, ...updates, updatedAt: now().slice(0, 10) } : c))
  }, [])

  const addCaseNote = useCallback((caseId: string, note: { user: string; text: string; time: string }) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, notes: [...c.notes, note], updatedAt: now().slice(0, 10) } : c))
  }, [])

  const addTeamMember = useCallback((member: TeamMember) => {
    setTeam(prev => [...prev, member])
  }, [])

  const removeTeamMember = useCallback((memberId: string) => {
    setTeam(prev => prev.filter(m => m.id !== memberId))
  }, [])

  const generateApiKey = useCallback((name: string) => {
    const newKey: ApiKey = {
      id: 'KEY-' + Date.now(),
      name,
      key: generateKey(),
      createdAt: now().slice(0, 10),
      lastUsed: 'Never',
      active: true,
    }
    setApiKeys(prev => [...prev, newKey])
  }, [])

  const revokeApiKey = useCallback((keyId: string) => {
    setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, active: false } : k))
  }, [])

  const addNotification = useCallback((n: Notification) => {
    setNotifications(prev => [n, ...prev])
  }, [])

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const value: AppContextValue = {
    user, transactions, alerts, models, reports, auditLog, cases, team,
    apiKeys, scheduledReports, notifications, thresholds, riskDistribution,
    login, logout, addTransactions, updateAlertStatus, assignAlert, addAlertNote,
    updateModelStatus, retrainModel, addReport, updateThresholds, addAuditEntry,
    addCase, updateCase, addCaseNote, addTeamMember, removeTeamMember,
    generateApiKey, revokeApiKey, addNotification, markNotificationRead,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
