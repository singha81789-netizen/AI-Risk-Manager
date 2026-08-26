import type { Transaction, Alert, AiModel, Report, AuditEntry, Case, TeamMember, ApiKey, ScheduledReport, Notification } from '../types'

export const mockTransactions: Transaction[] = [
  { id: 'TXN-001', date: '2026-08-25 14:32', amount: 12500, user: 'John Smith', location: 'New York, US', category: 'Wire Transfer', riskScore: 87, riskLevel: 'HIGH', status: 'under_review', merchant: 'Global Pay Inc', cardType: 'Corporate Wire', deviceType: 'Desktop', flagged: true, aiReasons: ['Unusual amount', 'New recipient', 'High-risk jurisdiction'] },
  { id: 'TXN-002', date: '2026-08-25 13:15', amount: 3200, user: 'Sarah Chen', location: 'London, UK', category: 'Purchase', riskScore: 45, riskLevel: 'MEDIUM', status: 'approved', merchant: 'Tech Supplies Ltd', cardType: 'Visa Business', deviceType: 'Mobile', flagged: false, aiReasons: ['Slightly above average'] },
  { id: 'TXN-003', date: '2026-08-25 11:48', amount: 890, user: 'Mike Johnson', location: 'Chicago, US', category: 'ATM Withdrawal', riskScore: 22, riskLevel: 'LOW', status: 'approved', merchant: 'ATM Network', cardType: 'Mastercard', deviceType: 'ATM', flagged: false, aiReasons: [] },
  { id: 'TXN-004', date: '2026-08-25 10:05', amount: 45000, user: 'Unknown', location: 'Dubai, AE', category: 'Wire Transfer', riskScore: 94, riskLevel: 'HIGH', status: 'declined', merchant: 'Offshore Holdings', cardType: 'Wire', deviceType: 'Unknown', flagged: true, aiReasons: ['Sanctioned region', 'Structuring pattern', 'Velocity anomaly', 'Mismatched IP'] },
  { id: 'TXN-005', date: '2026-08-24 22:10', amount: 150, user: 'Emily Davis', location: 'San Francisco, US', category: 'Subscription', riskScore: 8, riskLevel: 'LOW', status: 'approved', merchant: 'Netflix', cardType: 'Visa Personal', deviceType: 'Smart TV', flagged: false, aiReasons: [] },
  { id: 'TXN-006', date: '2026-08-24 19:30', amount: 7800, user: 'Robert Kim', location: 'Tokyo, JP', category: 'Purchase', riskScore: 62, riskLevel: 'MEDIUM', status: 'pending', merchant: 'Electronics Store', cardType: 'Amex Business', deviceType: 'Desktop', flagged: false, aiReasons: ['High-value purchase', 'Unusual category'] },
  { id: 'TXN-007', date: '2026-08-24 16:45', amount: 23000, user: 'Anna Petrova', location: 'Moscow, RU', category: 'Wire Transfer', riskScore: 91, riskLevel: 'HIGH', status: 'under_review', merchant: 'Eastern Trading Co', cardType: 'Wire', deviceType: 'Desktop', flagged: true, aiReasons: ['Sanctioned country', 'Shell company indicators', 'Rapid fund movement'] },
  { id: 'TXN-008', date: '2026-08-24 14:20', amount: 450, user: 'David Lee', location: 'Seoul, KR', category: 'Purchase', riskScore: 15, riskLevel: 'LOW', status: 'approved', merchant: 'Coffee Shop', cardType: 'Visa Personal', deviceType: 'Mobile', flagged: false, aiReasons: [] },
  { id: 'TXN-009', date: '2026-08-24 11:00', amount: 5600, user: 'Lisa Wang', location: 'Singapore, SG', category: 'Transfer', riskScore: 55, riskLevel: 'MEDIUM', status: 'approved', merchant: 'Internal Transfer', cardType: 'Bank Transfer', deviceType: 'Desktop', flagged: false, aiReasons: ['Cross-border transfer', 'Above threshold'] },
  { id: 'TXN-010', date: '2026-08-23 20:15', amount: 180000, user: 'Omar Hassan', location: 'Istanbul, TR', category: 'Wire Transfer', riskScore: 98, riskLevel: 'HIGH', status: 'declined', merchant: 'Intl Commodities', cardType: 'Wire', deviceType: 'Unknown', flagged: true, aiReasons: ['Terrorism financing risk', 'Layering pattern', 'Nested accounts', 'PEP involvement'] },
  { id: 'TXN-011', date: '2026-08-23 15:30', amount: 275, user: 'Tom Brown', location: 'Toronto, CA', category: 'Purchase', riskScore: 12, riskLevel: 'LOW', status: 'approved', merchant: 'Amazon', cardType: 'Visa Personal', deviceType: 'Mobile', flagged: false, aiReasons: [] },
  { id: 'TXN-012', date: '2026-08-23 12:00', amount: 9400, user: 'Maria Garcia', location: 'Mexico City, MX', category: 'Cash Deposit', riskScore: 68, riskLevel: 'MEDIUM', status: 'pending', merchant: 'Bank Branch', cardType: 'Cash', deviceType: 'Branch', flagged: false, aiReasons: ['Large cash transaction', 'Multiple deposits'] },
]

export const mockAlerts: Alert[] = [
  { id: 'ALT-001', transactionId: 'TXN-004', severity: 'Critical', status: 'New', title: 'Sanctioned Region Wire Transfer', description: 'Transaction to Dubai flagged for sanctioned region involvement. Amount $45,000 routed through intermediary.', riskScore: 94, assignee: 'Alex Morgan', createdAt: '2026-08-25 10:10', timeline: [{ action: 'Created', user: 'AI System', time: '2026-08-25 10:10', detail: 'Auto-generated from risk scoring engine' }, { action: 'Escalated', user: 'System', time: '2026-08-25 10:11', detail: 'Auto-escalated due to critical severity' }] },
  { id: 'ALT-002', transactionId: 'TXN-010', severity: 'Critical', status: 'Under Review', title: 'Terrorism Financing Suspect', description: 'High-risk wire of $180,000 to Istanbul with multiple red flags including layering and PEP involvement.', riskScore: 98, assignee: 'Alex Morgan', createdAt: '2026-08-23 20:20', timeline: [{ action: 'Created', user: 'AI System', time: '2026-08-23 20:20', detail: 'Auto-generated from risk scoring engine' }, { action: 'Assigned', user: 'Admin', time: '2026-08-23 20:25', detail: 'Assigned to senior analyst' }, { action: 'Under Review', user: 'Alex Morgan', time: '2026-08-24 09:00', detail: 'Review initiated' }] },
  { id: 'ALT-003', transactionId: 'TXN-001', severity: 'High', status: 'New', title: 'Suspicious Wire Transfer Pattern', description: '$12,500 wire to new recipient with unusual routing. Pattern consistent with structuring.', riskScore: 87, assignee: 'Unassigned', createdAt: '2026-08-25 14:35', timeline: [{ action: 'Created', user: 'AI System', time: '2026-08-25 14:35', detail: 'Auto-generated from risk scoring engine' }] },
  { id: 'ALT-004', transactionId: 'TXN-007', severity: 'High', status: 'Under Review', title: 'Sanctioned Country Transaction', description: '$23,000 wire involving Russian entity. Shell company indicators detected.', riskScore: 91, assignee: 'Jordan Lee', createdAt: '2026-08-24 16:50', timeline: [{ action: 'Created', user: 'AI System', time: '2026-08-24 16:50', detail: 'Auto-generated' }, { action: 'Assigned', user: 'Admin', time: '2026-08-24 17:00', detail: 'Assigned to Jordan Lee' }, { action: 'Under Review', user: 'Jordan Lee', time: '2026-08-25 08:30', detail: 'Investigation started' }] },
  { id: 'ALT-005', transactionId: 'TXN-006', severity: 'Medium', status: 'New', title: 'Unusual Purchase Pattern', description: 'High-value electronics purchase in Tokyo. Cardholder confirmed but pattern deviation noted.', riskScore: 62, assignee: 'Unassigned', createdAt: '2026-08-24 19:35', timeline: [{ action: 'Created', user: 'AI System', time: '2026-08-24 19:35', detail: 'Auto-generated' }] },
  { id: 'ALT-006', transactionId: 'TXN-012', severity: 'Medium', status: 'False Positive', title: 'Large Cash Deposit Pattern', description: 'Multiple cash deposits below reporting threshold. After review, determined to be legitimate business cash handling.', riskScore: 68, assignee: 'Sam Wilson', createdAt: '2026-08-23 12:05', timeline: [{ action: 'Created', user: 'AI System', time: '2026-08-23 12:05', detail: 'Auto-generated' }, { action: 'Assigned', user: 'Admin', time: '2026-08-23 12:30', detail: 'Assigned to Sam Wilson' }, { action: 'Resolved', user: 'Sam Wilson', time: '2026-08-23 16:00', detail: 'False positive - legitimate business operations' }] },
]

export const mockModels: AiModel[] = [
  { id: 'MDL-001', name: 'Fraud Detection v3.2', description: 'Primary transaction fraud detection model using gradient boosting', type: 'Gradient Boosting', status: 'active', accuracy: 96.8, precision: 94.2, recall: 97.1, f1Score: 95.6, lastTrained: '2026-08-20', trainingSize: 1250000, featureImportance: [{ feature: 'Transaction Amount', importance: 0.28 }, { feature: 'Time of Day', importance: 0.18 }, { feature: 'Location Risk', importance: 0.15 }, { feature: 'Merchant Category', importance: 0.14 }, { feature: 'Velocity Score', importance: 0.12 }, { feature: 'Device Trust', importance: 0.08 }, { feature: 'Account Age', importance: 0.05 }] },
  { id: 'MDL-002', name: 'AML Pattern Recognition', description: 'Anti-money laundering pattern detection using LSTM neural network', type: 'LSTM Neural Network', status: 'active', accuracy: 93.5, precision: 91.8, recall: 95.2, f1Score: 93.5, lastTrained: '2026-08-18', trainingSize: 850000, featureImportance: [{ feature: 'Transaction Chain', importance: 0.32 }, { feature: 'Amount Patterns', importance: 0.22 }, { feature: 'Geographic Flow', importance: 0.18 }, { feature: 'Entity Links', importance: 0.15 }, { feature: 'Temporal Gaps', importance: 0.13 }] },
  { id: 'MDL-003', name: 'Anomaly Detection', description: 'Unsupervised anomaly detection for novel fraud patterns', type: 'Isolation Forest', status: 'training', accuracy: null, precision: null, recall: null, f1Score: null, lastTrained: null, trainingSize: 500000, featureImportance: [] },
  { id: 'MDL-004', name: 'Risk Scoring Engine', description: 'Composite risk scoring model combining multiple signals', type: 'Ensemble', status: 'active', accuracy: 95.2, precision: 93.5, recall: 96.8, f1Score: 95.1, lastTrained: '2026-08-15', trainingSize: 2000000, featureImportance: [{ feature: 'Risk Score History', importance: 0.25 }, { feature: 'Account Behavior', importance: 0.20 }, { feature: 'External Threat Intel', importance: 0.18 }, { feature: 'Peer Comparison', importance: 0.15 }, { feature: 'Regulatory Flags', importance: 0.12 }, { feature: 'Market Conditions', importance: 0.10 }] },
]

export const mockReports: Report[] = [
  { id: 'RPT-001', title: 'Monthly Risk Summary - July 2026', type: 'Risk Summary', date: '2026-08-01', status: 'Generated', size: '2.4 MB' },
  { id: 'RPT-002', title: 'AML Compliance Report Q2 2026', type: 'Compliance', date: '2026-07-15', status: 'Generated', size: '5.1 MB' },
  { id: 'RPT-003', title: 'Suspicious Activity Report', type: 'SAR Filing', date: '2026-08-20', status: 'Pending Review', size: '1.8 MB' },
  { id: 'RPT-004', title: 'Transaction Monitoring Report', type: 'Monitoring', date: '2026-08-25', status: 'Generated', size: '3.2 MB' },
  { id: 'RPT-005', title: 'Model Performance Assessment', type: 'Model Audit', date: '2026-08-22', status: 'In Progress', size: '4.7 MB' },
  { id: 'RPT-006', title: 'Regulatory Filing - FinCEN', type: 'Regulatory', date: '2026-08-10', status: 'Submitted', size: '6.3 MB' },
]

export const mockAuditLog: AuditEntry[] = [
  { id: 'AUD-001', action: 'Login', user: 'Alex Morgan', timestamp: '2026-08-25 09:00', details: 'Successful login from Chrome on Windows', ipAddress: '192.168.1.100', module: 'Auth' },
  { id: 'AUD-002', action: 'Alert Escalated', user: 'System', timestamp: '2026-08-25 10:11', details: 'Auto-escalated ALT-001 (Critical severity)', ipAddress: 'System', module: 'Alerts' },
  { id: 'AUD-003', action: 'Transaction Reviewed', user: 'Alex Morgan', timestamp: '2026-08-25 11:30', details: 'Reviewed TXN-004, status updated to declined', ipAddress: '192.168.1.100', module: 'Transactions' },
  { id: 'AUD-004', action: 'Model Retrained', user: 'Admin', timestamp: '2026-08-24 16:00', details: 'Retrained Fraud Detection v3.2 with 50k new samples', ipAddress: '192.168.1.50', module: 'AI Models' },
  { id: 'AUD-005', action: 'Report Generated', user: 'Jordan Lee', timestamp: '2026-08-24 14:20', details: 'Generated Transaction Monitoring Report', ipAddress: '192.168.1.120', module: 'Reports' },
  { id: 'AUD-006', action: 'Settings Updated', user: 'Admin', timestamp: '2026-08-23 10:00', details: 'Updated risk thresholds: LOW=40, MEDIUM=70, HIGH=85', ipAddress: '192.168.1.50', module: 'Settings' },
  { id: 'AUD-007', action: 'Team Member Added', user: 'Admin', timestamp: '2026-08-22 09:15', details: 'Added Sam Wilson as Analyst', ipAddress: '192.168.1.50', module: 'Settings' },
  { id: 'AUD-008', action: 'Case Created', user: 'Alex Morgan', timestamp: '2026-08-21 11:00', details: 'Created CASE-001 for multi-jurisdiction investigation', ipAddress: '192.168.1.100', module: 'Cases' },
]

export const mockCases: Case[] = [
  { id: 'CASE-001', title: 'Multi-Jurisdiction Wire Fraud Investigation', status: 'Open', priority: 'Critical', assignee: 'Alex Morgan', createdAt: '2026-08-21', updatedAt: '2026-08-25', transactionCount: 5, totalAmount: 258000, notes: [{ user: 'Alex Morgan', text: 'Initiated investigation. Multiple wire transfers to high-risk jurisdictions identified.', time: '2026-08-21 11:00' }, { user: 'Alex Morgan', text: 'Cross-referenced with OFAC list. Two matches found.', time: '2026-08-23 14:30' }] },
  { id: 'CASE-002', title: 'Structuring Pattern Analysis', status: 'In Progress', priority: 'High', assignee: 'Jordan Lee', createdAt: '2026-08-18', updatedAt: '2026-08-24', transactionCount: 12, totalAmount: 89500, notes: [{ user: 'Jordan Lee', text: 'Detected pattern of deposits just below $10,000 threshold across multiple accounts.', time: '2026-08-18 09:00' }] },
  { id: 'CASE-003', title: 'New Account Fraud Ring', status: 'Open', priority: 'Medium', assignee: 'Sam Wilson', createdAt: '2026-08-20', updatedAt: '2026-08-22', transactionCount: 8, totalAmount: 34200, notes: [] },
]

export const mockTeam: TeamMember[] = [
  { id: 'USR-001', name: 'Alex Morgan', email: 'alex@riskguard.io', role: 'Admin', status: 'Active', lastActive: '2026-08-25 09:00' },
  { id: 'USR-002', name: 'Jordan Lee', email: 'jordan@riskguard.io', role: 'Analyst', status: 'Active', lastActive: '2026-08-25 08:30' },
  { id: 'USR-003', name: 'Sam Wilson', email: 'sam@riskguard.io', role: 'Analyst', status: 'Active', lastActive: '2026-08-24 17:00' },
  { id: 'USR-004', name: 'Casey Taylor', email: 'casey@riskguard.io', role: 'Viewer', status: 'Away', lastActive: '2026-08-23 15:00' },
]

export const mockApiKeys: ApiKey[] = [
  { id: 'KEY-001', name: 'Production API', key: 'rg_prod_••••••••••••••••', createdAt: '2026-07-01', lastUsed: '2026-08-25 08:00', active: true },
  { id: 'KEY-002', name: 'Staging API', key: 'rg_stg_••••••••••••••••', createdAt: '2026-07-15', lastUsed: '2026-08-20 14:00', active: true },
  { id: 'KEY-003', name: 'Legacy Integration', key: 'rg_leg_••••••••••••••••', createdAt: '2026-06-01', lastUsed: '2026-07-30 10:00', active: false },
]

export const mockScheduledReports: ScheduledReport[] = [
  { id: 'SCH-001', name: 'Daily Risk Summary', frequency: 'Daily at 06:00 UTC', recipients: ['alex@riskguard.io', 'jordan@riskguard.io'], nextRun: '2026-08-26 06:00', active: true },
  { id: 'SCH-002', name: 'Weekly Compliance Report', frequency: 'Every Monday 09:00 UTC', recipients: ['alex@riskguard.io', 'compliance@riskguard.io'], nextRun: '2026-08-31 09:00', active: true },
  { id: 'SCH-003', name: 'Monthly Model Performance', frequency: '1st of month 08:00 UTC', recipients: ['admin@riskguard.io'], nextRun: '2026-09-01 08:00', active: true },
]

export const mockNotifications: Notification[] = [
  { id: 'NTF-001', title: 'Critical Alert', message: 'New critical alert ALT-001 requires immediate attention', time: '5 min ago', read: false, type: 'alert' },
  { id: 'NTF-002', title: 'Model Training Complete', message: 'AML Pattern Recognition model training completed successfully', time: '1 hour ago', read: false, type: 'model' },
  { id: 'NTF-003', title: 'Report Generated', message: 'Transaction Monitoring Report is ready for download', time: '3 hours ago', read: true, type: 'report' },
  { id: 'NTF-004', title: 'Case Updated', message: 'CASE-001 has new notes from Alex Morgan', time: '1 day ago', read: true, type: 'case' },
]
