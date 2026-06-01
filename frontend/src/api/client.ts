import type {
  SummaryMetrics,
  DailyBreakdown,
  TransactionsResponse,
} from '../types';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? JSON.stringify(body);
    } catch {
      detail = res.statusText;
    }
    throw new Error(`Request failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<T>;
}

export function fetchSummary(
  startDate?: string,
  endDate?: string
): Promise<SummaryMetrics> {
  return getJson<SummaryMetrics>(`${BASE}/summary${qs({ startDate, endDate })}`);
}

export function fetchDailyBreakdown(
  startDate?: string,
  endDate?: string
): Promise<DailyBreakdown[]> {
  return getJson<DailyBreakdown[]>(
    `${BASE}/daily-breakdown${qs({ startDate, endDate })}`
  );
}

export function fetchTransactions(params: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<TransactionsResponse> {
  return getJson<TransactionsResponse>(`${BASE}/transactions${qs(params)}`);
}

export async function triggerRefresh(): Promise<void> {
  const res = await fetch(`${BASE}/refresh`, { method: 'POST' });
  if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
}

export function csvExportUrl(startDate?: string, endDate?: string): string {
  return `${BASE}/export/csv${qs({ startDate, endDate })}`;
}

export interface DataRange {
  minDate: string | null;
  maxDate: string | null;
}

export function fetchDataRange(): Promise<DataRange> {
  return getJson<DataRange>(`${BASE}/meta`);
}
