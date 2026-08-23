import type {
  Transaction,
  FraudStats,
  AnalystReview,
  FraudTrend,
  CategoryRisk,
  RiskScoreBreakdown,
} from '../types';

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'TXN-20260823-001',
    timestamp: '2026-08-23T14:32:00Z',
    amount: 4999.00,
    currency: 'USD',
    merchant: 'ElectroMax Store',
    merchantCategory: 'Electronics',
    cardLast4: '4532',
    cardholderName: 'James Morrison',
    cardholderEmail: 'j.morrison@email.com',
    ipAddress: '192.168.1.105',
    deviceFingerprint: 'FP-A3B2C1D0',
    country: 'US',
    city: 'New York',
    riskScore: 92,
    riskLevel: 'HIGH',
    riskFactors: [
      'Transaction amount 4.2x above account average',
      'New device fingerprint detected',
      'Multiple transactions in last 1 hour',
      'IP geolocation mismatch with billing address',
    ],
    status: 'under_review',
    aiAnalysis: 'High-risk transaction detected. Unusual purchase amount combined with new device and geographic inconsistency strongly suggest potential account compromise.',
    velocityChecks: [
      { label: 'Transactions (1h)', count: 5, threshold: 3, passed: false },
      { label: 'Transactions (24h)', count: 12, threshold: 10, passed: false },
      { label: 'Amount (1h)', count: 12450, threshold: 5000, passed: false },
      { label: 'International TXN', count: 0, threshold: 2, passed: true },
    ],
    analystDecision: 'ESCALATE',
    analystNotes: 'Escalating to senior fraud team. Multiple velocity breaches combined with device anomaly suggest organized fraud attempt.',
    analystId: 'analyst-alex-r',
    reviewedAt: '2026-08-23T14:45:00Z',
  },
  {
    id: 'TXN-20260823-002',
    timestamp: '2026-08-23T13:15:00Z',
    amount: 245.50,
    currency: 'USD',
    merchant: 'Fresh Grocery Mart',
    merchantCategory: 'Groceries',
    cardLast4: '8891',
    cardholderName: 'Sarah Chen',
    cardholderEmail: 's.chen@email.com',
    ipAddress: '10.0.0.42',
    deviceFingerprint: 'FP-X9Y8Z7W6',
    country: 'US',
    city: 'San Francisco',
    riskScore: 12,
    riskLevel: 'LOW',
    riskFactors: [],
    status: 'approved',
    aiAnalysis: 'Low-risk transaction. Amount and merchant category consistent with account history. Verified device and location.',
    velocityChecks: [
      { label: 'Transactions (1h)', count: 1, threshold: 3, passed: true },
      { label: 'Transactions (24h)', count: 3, threshold: 10, passed: true },
      { label: 'Amount (1h)', count: 245.5, threshold: 5000, passed: true },
      { label: 'International TXN', count: 0, threshold: 2, passed: true },
    ],
  },
  {
    id: 'TXN-20260823-003',
    timestamp: '2026-08-23T12:48:00Z',
    amount: 1899.00,
    currency: 'EUR',
    merchant: 'LuxTime Watches',
    merchantCategory: 'Luxury Goods',
    cardLast4: '3104',
    cardholderName: 'Michael Torres',
    cardholderEmail: 'm.torres@email.com',
    ipAddress: '203.0.113.42',
    deviceFingerprint: 'FP-M4N3O2P1',
    country: 'DE',
    city: 'Berlin',
    riskScore: 78,
    riskLevel: 'HIGH',
    riskFactors: [
      'First transaction from this country',
      'Luxury goods category (elevated risk)',
      'Transaction at unusual hour for timezone',
    ],
    status: 'under_review',
    aiAnalysis: 'Suspicious international transaction. Cardholder has no prior European transactions. Luxury purchase at non-standard hour warrants review.',
    velocityChecks: [
      { label: 'Transactions (1h)', count: 1, threshold: 3, passed: true },
      { label: 'Transactions (24h)', count: 4, threshold: 10, passed: true },
      { label: 'Amount (1h)', count: 1899, threshold: 5000, passed: true },
      { label: 'International TXN', count: 1, threshold: 2, passed: true },
    ],
  },
  {
    id: 'TXN-20260823-004',
    timestamp: '2026-08-23T11:22:00Z',
    amount: 89.99,
    currency: 'USD',
    merchant: 'CloudStream Subscription',
    merchantCategory: 'Digital Services',
    cardLast4: '5567',
    cardholderName: 'Emily Nakamura',
    cardholderEmail: 'e.nakamura@email.com',
    ipAddress: '172.16.0.1',
    deviceFingerprint: 'FP-Q7R6S5T4',
    country: 'US',
    city: 'Seattle',
    riskScore: 35,
    riskLevel: 'MEDIUM',
    riskFactors: [
      'Subscription amount 2x above typical digital spend',
    ],
    status: 'approved',
    aiAnalysis: 'Medium-risk flagged due to elevated subscription spend. Low overall concern based on merchant reputation and account standing.',
    velocityChecks: [
      { label: 'Transactions (1h)', count: 1, threshold: 3, passed: true },
      { label: 'Transactions (24h)', count: 6, threshold: 10, passed: true },
      { label: 'Amount (1h)', count: 89.99, threshold: 5000, passed: true },
      { label: 'International TXN', count: 0, threshold: 2, passed: true },
    ],
  },
  {
    id: 'TXN-20260823-005',
    timestamp: '2026-08-23T10:05:00Z',
    amount: 3250.00,
    currency: 'USD',
    merchant: 'QuickCash ATM',
    merchantCategory: 'Cash Withdrawal',
    cardLast4: '7712',
    cardholderName: 'Robert Kim',
    cardholderEmail: 'r.kim@email.com',
    ipAddress: '198.51.100.23',
    deviceFingerprint: 'FP-U2V1W0X9',
    country: 'US',
    city: 'Chicago',
    riskScore: 85,
    riskLevel: 'HIGH',
    riskFactors: [
      'Large cash withdrawal exceeds daily limit',
      'ATM location 200 miles from home address',
      'Third ATM transaction today',
    ],
    status: 'declined',
    aiAnalysis: 'Cash withdrawal pattern indicates potential card theft. Multiple ATM visits at increasing distances from home. Recommended card freeze.',
    velocityChecks: [
      { label: 'Transactions (1h)', count: 3, threshold: 3, passed: false },
      { label: 'Transactions (24h)', count: 8, threshold: 10, passed: true },
      { label: 'Amount (1h)', count: 5750, threshold: 5000, passed: false },
      { label: 'International TXN', count: 0, threshold: 2, passed: true },
    ],
    analystDecision: 'CONFIRM_FRAUD',
    analystNotes: 'Card likely compromised. ATM pattern shows classic card theft behavior. Cardholder notified via SMS.',
    analystId: 'analyst-maria-s',
    reviewedAt: '2026-08-23T10:15:00Z',
  },
  {
    id: 'TXN-20260823-006',
    timestamp: '2026-08-23T09:30:00Z',
    amount: 125.00,
    currency: 'GBP',
    merchant: 'Thames Coffee Co',
    merchantCategory: 'Food & Beverage',
    cardLast4: '2233',
    cardholderName: 'Lisa Patel',
    cardholderEmail: 'l.patel@email.com',
    ipAddress: '192.0.2.88',
    deviceFingerprint: 'FP-Y3Z4A5B6',
    country: 'GB',
    city: 'London',
    riskScore: 8,
    riskLevel: 'LOW',
    riskFactors: [],
    status: 'approved',
    aiAnalysis: 'Routine transaction. Matches cardholder travel history and spending patterns. Verified through 3D Secure.',
    velocityChecks: [
      { label: 'Transactions (1h)', count: 1, threshold: 3, passed: true },
      { label: 'Transactions (24h)', count: 2, threshold: 10, passed: true },
      { label: 'Amount (1h)', count: 125, threshold: 5000, passed: true },
      { label: 'International TXN', count: 1, threshold: 2, passed: true },
    ],
  },
  {
    id: 'TXN-20260823-007',
    timestamp: '2026-08-23T08:12:00Z',
    amount: 4200.00,
    currency: 'USD',
    merchant: 'Premier Jewelry',
    merchantCategory: 'Jewelry',
    cardLast4: '9988',
    cardholderName: 'David Wright',
    cardholderEmail: 'd.wright@email.com',
    ipAddress: '203.0.113.99',
    deviceFingerprint: 'FP-C7D8E9F0',
    country: 'US',
    city: 'Miami',
    riskScore: 65,
    riskLevel: 'MEDIUM',
    riskFactors: [
      'First-time jewelry purchase',
      'Merchant category elevated risk flag',
      'Device fingerprint changed since last login',
    ],
    status: 'under_review',
    aiAnalysis: 'Jewelry purchase flagged for review. While the amount is within account limits, first-time purchase at high-risk merchant with device change requires verification.',
    velocityChecks: [
      { label: 'Transactions (1h)', count: 1, threshold: 3, passed: true },
      { label: 'Transactions (24h)', count: 3, threshold: 10, passed: true },
      { label: 'Amount (1h)', count: 4200, threshold: 5000, passed: true },
      { label: 'International TXN', count: 0, threshold: 2, passed: true },
    ],
  },
  {
    id: 'TXN-20260823-008',
    timestamp: '2026-08-23T07:45:00Z',
    amount: 15.00,
    currency: 'USD',
    merchant: 'Metro Transit',
    merchantCategory: 'Transportation',
    cardLast4: '6644',
    cardholderName: 'Anna Kim',
    cardholderEmail: 'a.kim@email.com',
    ipAddress: '10.10.10.5',
    deviceFingerprint: 'FP-G1H2I3J4',
    country: 'US',
    city: 'Boston',
    riskScore: 5,
    riskLevel: 'LOW',
    riskFactors: [],
    status: 'approved',
    aiAnalysis: 'Routine transit purchase. Highly consistent with daily commute pattern. No risk indicators detected.',
    velocityChecks: [
      { label: 'Transactions (1h)', count: 1, threshold: 3, passed: true },
      { label: 'Transactions (24h)', count: 4, threshold: 10, passed: true },
      { label: 'Amount (1h)', count: 15, threshold: 5000, passed: true },
      { label: 'International TXN', count: 0, threshold: 2, passed: true },
    ],
  },
];

const MOCK_REVIEWS: AnalystReview[] = [
  {
    id: 'REV-001',
    transactionId: 'TXN-20260823-001',
    analystName: 'Alex Rivera',
    timestamp: '2026-08-23T14:45:00Z',
    decision: 'escalate',
    notes: 'Escalating to senior fraud team. Multiple velocity breaches combined with device anomaly suggest organized fraud attempt.',
    confidence: 0.95,
  },
  {
    id: 'REV-002',
    transactionId: 'TXN-20260823-005',
    analystName: 'Maria Santos',
    timestamp: '2026-08-23T10:15:00Z',
    decision: 'decline',
    notes: 'Card likely compromised. ATM pattern shows classic card theft behavior. Cardholder notified via SMS.',
    confidence: 0.92,
  },
  {
    id: 'REV-003',
    transactionId: 'TXN-20260823-003',
    analystName: 'Alex Rivera',
    timestamp: '2026-08-23T13:00:00Z',
    decision: 'hold',
    notes: 'Pending cardholder verification call. If confirmed legitimate, this may be a travel pattern update.',
    confidence: 0.70,
  },
];

const MOCK_FRAUD_STATS: FraudStats = {
  totalTransactions: 14832,
  flaggedTransactions: 847,
  approvedTransactions: 13521,
  declinedTransactions: 464,
  averageRiskScore: 28.4,
  highRiskCount: 187,
  mediumRiskCount: 660,
  lowRiskCount: 13985,
  totalFraudLoss: 42350,
  preventedLoss: 187200,
  reviewedTransactions: 612,
  pendingReview: 235,
};

const MOCK_TRENDS: FraudTrend[] = [
  { date: 'Aug 17', flagged: 112, approved: 2015, declined: 58, avgRiskScore: 26 },
  { date: 'Aug 18', flagged: 98, approved: 2103, declined: 42, avgRiskScore: 24 },
  { date: 'Aug 19', flagged: 145, approved: 1987, declined: 71, avgRiskScore: 32 },
  { date: 'Aug 20', flagged: 132, approved: 2050, declined: 65, avgRiskScore: 30 },
  { date: 'Aug 21', flagged: 108, approved: 2180, declined: 51, avgRiskScore: 27 },
  { date: 'Aug 22', flagged: 127, approved: 2098, declined: 59, avgRiskScore: 29 },
  { date: 'Aug 23', flagged: 125, approved: 2088, declined: 62, avgRiskScore: 28 },
];

const MOCK_CATEGORY_RISK: CategoryRisk[] = [
  { category: 'Electronics', riskScore: 72, transactionCount: 1842 },
  { category: 'Luxury Goods', riskScore: 68, transactionCount: 432 },
  { category: 'Jewelry', riskScore: 65, transactionCount: 298 },
  { category: 'Cash Withdrawal', riskScore: 61, transactionCount: 987 },
  { category: 'Digital Services', riskScore: 35, transactionCount: 2105 },
  { category: 'Groceries', riskScore: 12, transactionCount: 4321 },
  { category: 'Transportation', riskScore: 8, transactionCount: 3210 },
  { category: 'Food & Beverage', riskScore: 10, transactionCount: 1637 },
];

const MOCK_RISK_BREAKDOWN: RiskScoreBreakdown[] = [
  { factor: 'Amount Deviation', score: 85, weight: 0.25 },
  { factor: 'Velocity', score: 90, weight: 0.20 },
  { factor: 'Device Risk', score: 70, weight: 0.15 },
  { factor: 'Geographic Risk', score: 60, weight: 0.15 },
  { factor: 'Merchant Risk', score: 45, weight: 0.15 },
  { factor: 'Behavioral Pattern', score: 55, weight: 0.10 },
];

export function getTransactions(): Transaction[] {
  return MOCK_TRANSACTIONS;
}

export function getTransactionById(id: string): Transaction | undefined {
  return MOCK_TRANSACTIONS.find((t) => t.id === id);
}

export function getFlaggedTransactions(): Transaction[] {
  return MOCK_TRANSACTIONS.filter((t) => t.riskLevel !== 'LOW');
}

export function getFraudStats(): FraudStats {
  return MOCK_FRAUD_STATS;
}

export function getAnalystReviews(): AnalystReview[] {
  return MOCK_REVIEWS;
}

export function getReviewsByTransactionId(txnId: string): AnalystReview[] {
  return MOCK_REVIEWS.filter((r) => r.transactionId === txnId);
}

export function getFraudTrends(): FraudTrend[] {
  return MOCK_TRENDS;
}

export function getCategoryRiskData(): CategoryRisk[] {
  return MOCK_CATEGORY_RISK;
}

export function getRiskScoreBreakdown(): RiskScoreBreakdown[] {
  return MOCK_RISK_BREAKDOWN;
}
