import type { NormalizedBet, SummaryMetrics, DailyBreakdown, DateRange, Capability } from '../domain/types.js';

/**
 * Single extension point for adding a new casino or data source.
 *
 * Each method is optional — check `capabilities` before calling. Calling a
 * method the adapter doesn't support throws `UnsupportedCapabilityError`.
 */
export interface CasinoAdapter {
  readonly casinoId: string;
  readonly chainId: string;
  readonly capabilities: Set<Capability>;

  getBets(fromTs: number, toTs: number): Promise<NormalizedBet[]>;
  getSummary(fromTs: number, toTs: number): Promise<SummaryMetrics>;
  getDailyBreakdown(fromTs: number, toTs: number): Promise<DailyBreakdown[]>;
  getAllTimeSummary(): Promise<SummaryMetrics>;
  getDateRange(): Promise<DateRange | null>;
}

export class UnsupportedCapabilityError extends Error {
  constructor(casinoId: string, chainId: string, capability: Capability) {
    super(`${casinoId}/${chainId} does not support capability: ${capability}`);
    this.name = 'UnsupportedCapabilityError';
  }
}
