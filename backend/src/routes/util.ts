import { Request } from 'express';
import { resolveAdapter, defaultAdapter } from '../adapters/registry.js';
import type { CasinoAdapter } from '../adapters/registry.js';

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

/**
 * Resolve the adapter from optional ?casino= and ?chain= query params.
 * Falls back to BetSwirl/Polygon when absent (backward-compatible).
 */
export function parseAdapter(req: Request): CasinoAdapter {
  const casino = (req.query.casino as string | undefined) ?? 'betswirl';
  const chain = (req.query.chain as string | undefined) ?? 'polygon';
  if (casino === 'betswirl' && chain === 'polygon') return defaultAdapter();
  return resolveAdapter(casino, chain);
}
