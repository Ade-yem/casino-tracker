import { Request } from 'express';

/**
 * Parse `startDate`/`endDate` query params (ISO strings like "2024-01-01") into
 * UNIX seconds. Falls back to the last 30 days when absent. End date is pushed
 * to end-of-day so the full day is included.
 */
export function parseDateRange(req: Request): { fromTs: number; toTs: number } {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDays = 30 * 24 * 60 * 60;

  const startStr = req.query.startDate as string | undefined;
  const endStr = req.query.endDate as string | undefined;

  let fromTs = now - thirtyDays;
  let toTs = now;

  if (startStr) {
    const t = Math.floor(new Date(startStr + 'T00:00:00Z').getTime() / 1000);
    if (!Number.isNaN(t)) fromTs = t;
  }
  if (endStr) {
    const t = Math.floor(new Date(endStr + 'T23:59:59Z').getTime() / 1000);
    if (!Number.isNaN(t)) toTs = t;
  }

  return { fromTs, toTs };
}

export function parseIntParam(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}
