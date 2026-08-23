import type {
  ApiAnalystReview,
  ApiReviewDecisionRequest,
  ApiReviewResponse,
  ApiAuditLogEntry,
  AnalystDecision,
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

export async function healthCheck(): Promise<{ status: string; service: string }> {
  return request('/health');
}

export async function getAnalystReviews(
  transactionId?: string,
): Promise<ApiAnalystReview[]> {
  const params = new URLSearchParams();
  if (transactionId) params.set('transaction_id', transactionId);
  const qs = params.toString();
  return request(`/api/analyst/reviews${qs ? `?${qs}` : ''}`);
}

export async function submitAnalystDecision(
  payload: ApiReviewDecisionRequest,
): Promise<ApiReviewResponse> {
  return request('/api/analyst/decision', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getAuditLogs(
  transactionId?: string,
  limit = 50,
): Promise<ApiAuditLogEntry[]> {
  const params = new URLSearchParams();
  if (transactionId) params.set('transaction_id', transactionId);
  params.set('limit', String(limit));
  return request(`/api/audit/logs?${params.toString()}`);
}

// Local analyst ID -- stored in localStorage so each browser session
// has a consistent identity across review submissions.
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
