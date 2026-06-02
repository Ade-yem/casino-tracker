import { DuneClient, QueryParameter } from '@duneanalytics/client-sdk';
import type { CasinoAdapter } from '../CasinoAdapter.js';
import type {
  NormalizedBet,
  SummaryMetrics,
  DailyBreakdown,
  DateRange,
} from '../../domain/types.js';
import { UnsupportedCapabilityError } from '../CasinoAdapter.js';
import { Capability } from '../../domain/types.js';

/** Column name mapping from Dune query result to our domain fields. */
export interface DuneColumnMap {
  /** Column containing the date (YYYY-MM-DD string or UNIX timestamp). */
  date: string;
  /** Column containing inflow amount in USD. */
  inflow_usd: string;
  /** Column containing outflow amount in USD. */
  outflow_usd: string;
  /** Column containing bet/transaction count (optional). */
  bet_count?: string;
}

export interface GenericDuneConfig {
  casinoId: string;
  chainId: string;
  duneClient: DuneClient;
  /**
   * Dune query ID that accepts `start_date` and `end_date` text parameters
   * and returns rows with daily inflow/outflow data.
   */
  queryId: number;
  /**
   * Maps Dune result column names to our domain fields.
   * Defaults: date → 'date', inflow_usd → 'inflow_usd', etc.
   */
  columnMap?: Partial<DuneColumnMap>;
}

const DEFAULT_COLUMNS: DuneColumnMap = {
  date:       'date',
  inflow_usd: 'inflow_usd',
  outflow_usd: 'outflow_usd',
  bet_count:  'bet_count',
};

/**
 * Adapter for casinos tracked via a saved Dune Analytics query.
 *
 * The Dune query must accept two text parameters:
 *   - start_date (YYYY-MM-DD)
 *   - end_date   (YYYY-MM-DD)
 * and return daily rows with inflow_usd and outflow_usd columns
 * (column names configurable via columnMap).
 *
 * Capability: DAILY_AGGREGATES + ALL_TIME_SUMMARY only.
 * Per-bet data is not available from Dune aggregates.
 */
export class GenericDuneAdapter implements CasinoAdapter {
  readonly casinoId: string;
  readonly chainId: string;
  readonly capabilities = new Set<Capability>([
    Capability.DAILY_AGGREGATES,
    Capability.ALL_TIME_SUMMARY,
    Capability.DATE_RANGE,
  ]);

  private readonly cfg: GenericDuneConfig;
  private readonly cols: DuneColumnMap;

  constructor(cfg: GenericDuneConfig) {
    this.casinoId = cfg.casinoId;
    this.chainId  = cfg.chainId;
    this.cfg = cfg;
    this.cols = { ...DEFAULT_COLUMNS, ...cfg.columnMap };
  }

  // -------------------------------------------------------------------------
  // CasinoAdapter: getBets — not supported
  // -------------------------------------------------------------------------

  async getBets(_fromTs: number, _toTs: number): Promise<NormalizedBet[]> {
    throw new UnsupportedCapabilityError(this.casinoId, this.chainId, Capability.BET_HISTORY);
  }

  // -------------------------------------------------------------------------
  // CasinoAdapter: getDailyBreakdown
  // -------------------------------------------------------------------------

  async getDailyBreakdown(fromTs: number, toTs: number): Promise<DailyBreakdown[]> {
    const rows = await this.queryDune(fromTs, toTs);
    return rows;
  }

  // -------------------------------------------------------------------------
  // CasinoAdapter: getSummary
  // -------------------------------------------------------------------------

  async getSummary(fromTs: number, toTs: number): Promise<SummaryMetrics> {
    const rows = await this.getDailyBreakdown(fromTs, toTs);
    return this.toMetrics(rows);
  }

  // -------------------------------------------------------------------------
  // CasinoAdapter: getAllTimeSummary
  // -------------------------------------------------------------------------

  async getAllTimeSummary(): Promise<SummaryMetrics> {
    const epochStart = 0;
    const now = Math.floor(Date.now() / 1000);
    return this.getSummary(epochStart, now);
  }

  // -------------------------------------------------------------------------
  // CasinoAdapter: getDateRange
  // -------------------------------------------------------------------------

  async getDateRange(): Promise<DateRange | null> {
    const rows = await this.getDailyBreakdown(0, Math.floor(Date.now() / 1000));
    if (rows.length === 0) return null;
    const dates = rows.map((r) => new Date(r.date).getTime() / 1000);
    return {
      minDate: Math.min(...dates),
      maxDate: Math.max(...dates),
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async queryDune(fromTs: number, toTs: number): Promise<DailyBreakdown[]> {
    const startDate = new Date(fromTs * 1000).toISOString().slice(0, 10);
    const endDate   = new Date(toTs   * 1000).toISOString().slice(0, 10);

    const result = await this.cfg.duneClient.runQuery({
      queryId: this.cfg.queryId,
      query_parameters: [
        QueryParameter.text('start_date', startDate),
        QueryParameter.text('end_date',   endDate),
      ],
    });

    const rows = result.result?.rows ?? [];
    return rows.map((row) => this.mapRow(row as Record<string, unknown>));
  }

  private mapRow(row: Record<string, unknown>): DailyBreakdown {
    const rawDate  = row[this.cols.date];
    const inflow   = Number(row[this.cols.inflow_usd]  ?? 0);
    const outflow  = Number(row[this.cols.outflow_usd] ?? 0);

    // Accept both YYYY-MM-DD strings and UNIX timestamps
    let date: string;
    if (typeof rawDate === 'number') {
      date = new Date(rawDate * 1000).toISOString().slice(0, 10);
    } else {
      date = String(rawDate ?? '').slice(0, 10);
    }

    return { date, inflow, outflow, net: inflow - outflow };
  }

  private toMetrics(rows: DailyBreakdown[]): SummaryMetrics {
    let inflows = 0, outflows = 0, txCount = 0;
    for (const r of rows) {
      inflows  += r.inflow;
      outflows += r.outflow;
    }
    return {
      totalInflows:  inflows,
      totalOutflows: outflows,
      netPosition:   inflows - outflows,
      payoutRatio:   inflows === 0 ? 0 : outflows / inflows,
      txCount,
    };
  }
}
