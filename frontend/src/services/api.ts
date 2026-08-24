import type {
  ApiAnalystReview,
  ApiReviewDecisionRequest,
  ApiReviewResponse,
  ApiAuditLogEntry,
  AnalystDecision,
  ModelExplanation,
  ApiTransaction,
  ApiDashboardStats,
  ApiPredictionResponse,
  BatchUploadResponse,
  PreviewResponse,
  ApiAlert,
  AlertStats,
  ReportSummary,
} from '../types';

const BASE_URL = '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Health ---
export async function healthCheck(): Promise<{ status: string; service: string }> {
  return request('/health');
}

// --- Dashboard ---
export async function getDashboardStats(): Promise<ApiDashboardStats> {
  return request('/dashboard/stats');
}

// --- Transactions ---
export async function getTransactions(
  params?: { risk_level?: string; limit?: number; offset?: number },
): Promise<{ transactions: ApiTransaction[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.risk_level) searchParams.set('risk_level', params.risk_level);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const qs = searchParams.toString();
  return request(`/transactions${qs ? `?${qs}` : ''}`);
}

export async function getTransactionById(
  transactionId: string,
): Promise<ApiTransaction> {
  return request(`/transactions/${encodeURIComponent(transactionId)}`);
}

// --- Predict ---
export async function predictTransaction(
  payload: Record<string, unknown>,
): Promise<ApiPredictionResponse> {
  return request('/predict', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// --- Explain ---
export async function getModelExplanation(
  payload: Record<string, unknown>,
): Promise<ModelExplanation> {
  return request('/explain', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// --- CSV Upload ---
export async function previewCsv(file: File): Promise<PreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE_URL}/upload/preview`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function uploadCsv(
  file: File,
  mediumThreshold?: number,
  highThreshold?: number,
): Promise<BatchUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const params = new URLSearchParams();
  if (mediumThreshold !== undefined) params.set('medium_threshold', String(mediumThreshold));
  if (highThreshold !== undefined) params.set('high_threshold', String(highThreshold));
  const qs = params.toString();
  const res = await fetch(`${BASE_URL}/upload/csv${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

// --- Thresholds ---
export async function updateThresholds(
  mediumThreshold: number,
  highThreshold: number,
): Promise<{ updated: number; alerts_created: number }> {
  const params = new URLSearchParams({
    medium_threshold: String(mediumThreshold),
    high_threshold: String(highThreshold),
  });
  return request(`/thresholds?${params.toString()}`, { method: 'POST' });
}

// --- Alerts ---
export async function getAlerts(params?: {
  status?: string;
  risk_level?: string;
  limit?: number;
  offset?: number;
}): Promise<{ alerts: ApiAlert[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.risk_level) searchParams.set('risk_level', params.risk_level);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const qs = searchParams.toString();
  return request(`/alerts${qs ? `?${qs}` : ''}`);
}

export async function getAlertStats(): Promise<AlertStats> {
  return request('/alerts/stats');
}

export async function updateAlertStatus(
  alertId: number,
  status: string,
  reviewedBy?: string,
): Promise<{ id: number; status: string; message: string }> {
  return request(`/alerts/${alertId}`, {
    method: 'PUT',
    body: JSON.stringify({ status, reviewed_by: reviewedBy }),
  });
}

// --- Reports ---
export async function getReportSummary(): Promise<ReportSummary> {
  return request('/reports/summary');
}

export async function exportFlaggedCsv(riskLevel?: string): Promise<Blob> {
  const params = new URLSearchParams();
  if (riskLevel) params.set('risk_level', riskLevel);
  const qs = params.toString();
  const res = await fetch(`${BASE_URL}/reports/export/csv${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    throw new Error(`Export failed: ${res.status}`);
  }
  return res.blob();
}

export async function exportPdfReport(): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/reports/export/pdf`);
  if (!res.ok) {
    throw new Error(`Export failed: ${res.status}`);
  }
  return res.blob();
}

// --- Analyst ---
export async function getAnalystReviews(
  transactionId?: string,
): Promise<ApiAnalystReview[]> {
  const params = new URLSearchParams();
  if (transactionId) params.set('transaction_id', transactionId);
  const qs = params.toString();
  return request(`/analyst/reviews${qs ? `?${qs}` : ''}`);
}

export async function submitAnalystDecision(
  payload: ApiReviewDecisionRequest,
): Promise<ApiReviewResponse> {
  return request('/analyst/decision', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// --- Analyst ID management ---
const ANALYST_ID_KEY = 'ai-risk-manager-analyst-id';

export function getAnalystId(): string {
  let id = localStorage.getItem(ANALYST_ID_KEY);
  if (!id) {
    id = `analyst-${Date.now().toString(36)}`;
    localStorage.setItem(ANALYST_ID_KEY, id);
  }
  return id;
}

export function setAnalystId(id: string): void {
  localStorage.setItem(ANALYST_ID_KEY, id);
}

export async function submitReview(
  transactionId: string,
  decision: AnalystDecision,
  notes: string,
): Promise<ApiReviewResponse> {
  const analystId = getAnalystId();
  return submitAnalystDecision({
    transaction_id: transactionId,
    analyst_id: analystId,
    decision,
    notes: notes || undefined,
  });
}

// --- Audit Logs ---
export async function getAuditLogs(
  transactionId?: string,
  limit = 50,
): Promise<ApiAuditLogEntry[]> {
  const params = new URLSearchParams();
  if (transactionId) params.set('transaction_id', transactionId);
  params.set('limit', String(limit));
  return request(`/audit/logs?${params.toString()}`);
}
