const BASE_URL = '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('riskguard-token');
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };
  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Auth ---
export async function authRegister(data: { email: string; password: string; name: string; role: string }) {
  return request<{ message: string; token: string; user: { id: string; email: string; name: string; role: string } }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function authLogin(data: { email: string; password: string }) {
  return request<{ message: string; token: string; user: { id: string; email: string; name: string; role: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function authMe() {
  return request<{ id: string; email: string; name: string; role: string }>('/auth/me');
}

// --- Upload ---
export async function uploadCsvFile(file: File) {
  const token = localStorage.getItem('riskguard-token');
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE_URL}/upload/csv`, {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

// --- Dashboard ---
export async function getDashboardStats(params?: { days?: number; start_date?: string; end_date?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.days) searchParams.set('days', String(params.days));
  if (params?.start_date) searchParams.set('start_date', params.start_date);
  if (params?.end_date) searchParams.set('end_date', params.end_date);
  const qs = searchParams.toString();
  return request<Record<string, unknown>>(`/dashboard/stats${qs ? `?${qs}` : ''}`);
}

// --- Reports ---
export async function getReportSummary(days = 30) {
  return request<Record<string, unknown>>(`/reports/summary?days=${days}`);
}

export async function downloadCsvReport(days = 30, riskLevel?: string): Promise<Blob> {
  const params = new URLSearchParams({ days: String(days) });
  if (riskLevel) params.set('risk_level', riskLevel);
  const token = localStorage.getItem('riskguard-token');
  const res = await fetch(`${BASE_URL}/reports/export/csv?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`CSV export failed: ${res.status}`);
  return res.blob();
}

export async function downloadPdfReport(days = 30): Promise<Blob> {
  const token = localStorage.getItem('riskguard-token');
  const res = await fetch(`${BASE_URL}/reports/export/pdf?days=${days}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`PDF export failed: ${res.status}`);
  return res.blob();
}

// --- Transactions ---
export async function getTransactions(params?: { risk_level?: string; limit?: number; offset?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.risk_level) searchParams.set('risk_level', params.risk_level);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  const qs = searchParams.toString();
  return request<{ transactions: Record<string, unknown>[]; total: number }>(`/transactions${qs ? `?${qs}` : ''}`);
}

// --- Alerts ---
export async function getAlerts(params?: { status?: string; risk_level?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.risk_level) searchParams.set('risk_level', params.risk_level);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();
  return request<{ alerts: Record<string, unknown>[]; total: number }>(`/alerts${qs ? `?${qs}` : ''}`);
}

// --- AI Models ---
export async function getAiModels() {
  return request<Record<string, unknown>[]>('/ai-models');
}

export async function getModelPerformance() {
  return request<Record<string, unknown>[]>('/ai-models/performance');
}
