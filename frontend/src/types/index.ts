export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type TransactionStatus = 'pending' | 'approved' | 'declined' | 'under_review';

export type AnalystDecision = 'CONFIRM_FRAUD' | 'FALSE_POSITIVE' | 'ESCALATE';

// --- Backend API types (match backend Pydantic schemas) ---

export interface ApiTransaction {
  id: number;
  transaction_id: string | null;
  timestamp: string | null;
  amount: number | null;
  merchant_category: string | null;
  transaction_type: string | null;
  card_type: string | null;
  card_present: number | null;
  device_type: string | null;
  age: number | null;
  gender: string | null;
  distance_from_home: number | null;
  distance_from_last_transaction: number | null;
  high_risk_country: number | null;
  velocity_last_24h: number | null;
  created_at: string | null;
  fraud_probability: number | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  prediction: string | null;
  triggered_risk_factors: string[] | null;
  model_version: string | null;
  analyst_decision: string | null;
  analyst_notes: string | null;
  analyst_id: string | null;
  reviewed_at: string | null;
}

export interface ApiDashboardStats {
  totalTransactions: number;
  flaggedTransactions: number;
  approvedTransactions: number;
  declinedTransactions: number;
  averageRiskScore: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  reviewedTransactions: number;
  pendingReview: number;
  recentTransactions: ApiTransaction[];
  categoryRisk: ApiCategoryRisk[];
  trends: ApiFraudTrend[];
}

export interface ApiFraudTrend {
  date: string;
  flagged: number;
  approved: number;
  declined: number;
  avgRiskScore: number;
}

export interface ApiCategoryRisk {
  category: string;
  riskScore: number;
  transactionCount: number;
}

export interface ApiPredictionResponse {
  transaction_id: string | null;
  fraud_probability: number;
  risk_score: number;
  risk_level: RiskLevel;
  decision: string;
  is_fraud_predicted: boolean;
  triggered_risk_factors: string[];
  anomaly: {
    is_anomaly: boolean;
    anomaly_score: number;
    anomaly_label: string;
  } | null;
}

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

// --- Upload / Batch types ---

export interface BatchResult {
  transaction_id: string | null;
  amount: number | null;
  merchant_category: string | null;
  fraud_probability: number;
  risk_score: number;
  risk_level: RiskLevel;
  decision: string;
  triggered_risk_factors: string[];
  is_anomaly: boolean;
  anomaly_score: number;
}

export interface BatchUploadResponse {
  filename: string;
  total_rows: number;
  processed_rows: number;
  errors: string[];
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  alerts_created: number;
  results: BatchResult[];
}

export interface PreviewResponse {
  filename: string;
  total_rows: number;
  columns: string[];
  preview_rows: Record<string, unknown>[];
  detected_schema: Record<string, string>;
}

// --- Alert types ---

export interface ApiAlert {
  id: number;
  transaction_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  reason: string[] | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  amount: number | null;
  merchant_category: string | null;
}

export interface AlertStats {
  total: number;
  open: number;
  reviewed: number;
  confirmed_fraud: number;
  false_positive: number;
  high_risk: number;
  medium_risk: number;
}

// --- Report types ---

export interface ReportSummary {
  total_transactions: number;
  total_flagged: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  avg_risk_score: number;
  total_amount_analyzed: number;
  total_amount_at_risk: number;
  fraud_rate_pct: number;
  top_riskiest_transactions: Record<string, unknown>[];
  category_breakdown: Record<string, unknown>[];
  previous_period?: {
    total_flagged: number;
    avg_risk_score: number;
    fraud_rate_pct: number;
  } | null;
}

// --- AI Models types ---

export interface AiModel {
  id: string;
  name: string;
  description: string;
  accuracy: number | null;
  status: 'active' | 'training' | 'inactive';
  type: 'primary' | 'secondary' | 'standard';
  last_updated: string;
}

export interface ModelPerformancePoint {
  date: string;
  isolationForest: number;
  lof: number;
  dbscan: number;
  randomForest: number;
}

export interface RiskThresholds {
  overall_risk_sensitivity: number;
  high_risk_threshold: number;
}
