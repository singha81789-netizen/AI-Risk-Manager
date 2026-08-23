export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type TransactionStatus = 'pending' | 'approved' | 'declined' | 'under_review';

export type AnalystDecision = 'CONFIRM_FRAUD' | 'FALSE_POSITIVE' | 'ESCALATE';

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
  analystDecision?: AnalystDecision | null;
  analystNotes?: string;
  analystId?: string;
  reviewedAt?: string;
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
  reviewedTransactions?: number;
  pendingReview?: number;
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

// --- API types (match backend Pydantic schemas) ---

export interface ApiAnalystReview {
  id: number;
  transaction_id: string;
  analyst_id: string;
  decision: AnalystDecision;
  notes: string | null;
  ai_fraud_probability: number | null;
  ai_risk_score: number | null;
  ai_risk_level: string | null;
  ai_decision: string | null;
  model_version: string | null;
  created_at: string;
}

export interface ApiReviewDecisionRequest {
  transaction_id: string;
  analyst_id: string;
  decision: AnalystDecision;
  notes?: string;
}

export interface ApiReviewResponse {
  transaction_id: string;
  event_type: string;
  actor: string;
  status: string;
}

export interface ApiAuditLogEntry {
  id: number;
  event_type: string;
  transaction_id: string | null;
  actor: string;
  timestamp: string;
  details: Record<string, unknown> | null;
  model_version: string | null;
}

// --- Model Explainability types ---

export interface FeatureFactor {
  feature: string;
  raw_feature: string;
  contribution: number;
  feature_value: unknown;
  direction: 'increases_risk' | 'decreases_risk';
}

export interface ModelExplanation {
  transaction_id: string;
  fraud_probability: number;
  risk_score: number;
  factors: FeatureFactor[];
  base_value: number;
  model_version: string;
  source: 'model';
}
