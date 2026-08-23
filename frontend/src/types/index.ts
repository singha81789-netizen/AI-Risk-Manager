export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type TransactionStatus = 'pending' | 'approved' | 'declined' | 'under_review';

export interface Transaction {
  id: string;
  timestamp: string;
  amount: number;
  currency: string;
  merchant: string;
  merchantCategory: string;
  cardLast4: string;
  cardholderName: string;
  cardholderEmail: string;
  ipAddress: string;
  deviceFingerprint: string;
  country: string;
  city: string;
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: string[];
  status: TransactionStatus;
  aiAnalysis: string;
  velocityChecks: VelocityCheck[];
}

export interface VelocityCheck {
  label: string;
  count: number;
  threshold: number;
  passed: boolean;
}

export interface RiskScoreBreakdown {
  factor: string;
  score: number;
  weight: number;
}

export interface FraudStats {
  totalTransactions: number;
  flaggedTransactions: number;
  approvedTransactions: number;
  declinedTransactions: number;
  averageRiskScore: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  totalFraudLoss: number;
  preventedLoss: number;
}

export interface AnalystReview {
  id: string;
  transactionId: string;
  analystName: string;
  timestamp: string;
  decision: 'approve' | 'decline' | 'escalate' | 'hold';
  notes: string;
  confidence: number;
}

export interface FraudTrend {
  date: string;
  flagged: number;
  approved: number;
  declined: number;
  avgRiskScore: number;
}

export interface CategoryRisk {
  category: string;
  riskScore: number;
  transactionCount: number;
}
