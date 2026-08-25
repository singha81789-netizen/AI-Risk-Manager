export type Theme = 'dark' | 'light'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type AlertSeverity = 'Critical' | 'High' | 'Medium' | 'Low'
export type AlertStatus = 'New' | 'Under Review' | 'Resolved' | 'False Positive'
export type TransactionStatus = 'approved' | 'declined' | 'pending' | 'under_review'
export type UserRole = 'Admin' | 'Analyst' | 'Viewer'
export type ModelStatus = 'active' | 'training' | 'inactive'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
}

export interface Transaction {
  id: string
  date: string
  amount: number
  user: string
  location: string
  category: string
  riskScore: number
  riskLevel: RiskLevel
  status: TransactionStatus
  merchant: string
  cardType: string
  deviceType: string
  flagged: boolean
  aiReasons: string[]
}

export interface Alert {
  id: string
  transactionId: string
  severity: AlertSeverity
  status: AlertStatus
  title: string
  description: string
  riskScore: number
  assignee: string
  createdAt: string
  timeline: AlertTimelineEntry[]
}

export interface AlertTimelineEntry {
  action: string
  user: string
  time: string
  detail: string
}

export interface AiModel {
  id: string
  name: string
  description: string
  type: string
  status: ModelStatus
  accuracy: number | null
  precision: number | null
  recall: number | null
  f1Score: number | null
  lastTrained: string | null
  trainingSize: number
  featureImportance: { feature: string; importance: number }[]
}

export interface Report {
  id: string
  title: string
  type: string
  date: string
  status: string
  size: string
}

export interface AuditEntry {
  id: string
  action: string
  user: string
  timestamp: string
  details: string
  ipAddress: string
  module: string
}

export interface Case {
  id: string
  title: string
  status: string
  priority: string
  assignee: string
  createdAt: string
  updatedAt: string
  transactionCount: number
  totalAmount: number
  notes: { user: string; text: string; time: string }[]
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: UserRole
  status: string
  lastActive: string
}

export interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsed: string
  active: boolean
}

export interface ScheduledReport {
  id: string
  name: string
  frequency: string
  recipients: string[]
  nextRun: string
  active: boolean
}

export interface Notification {
  id: string
  title: string
  message: string
  time: string
  read: boolean
  type: string
}
