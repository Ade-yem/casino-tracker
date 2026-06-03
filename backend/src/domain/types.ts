/** Normalized bet — casino/chain agnostic. */
export interface NormalizedBet {
  id: string;
  bettor: string;
  amount_usd: number;
  payout_usd: number;
  token: string;
  game_type: string;
  resolved: boolean;
  refunded: boolean;
  bet_tx_hash: string;
  roll_tx_hash: string | null;
  timestamp: number;        // UNIX seconds
  casino: string;           // e.g. 'betswirl'
  chain: string;            // e.g. 'polygon'
}

export interface SummaryMetrics {
  totalInflows: number;
  totalOutflows: number;
  netPosition: number;
  payoutRatio: number;
  txCount: number;
}

export interface DailyBreakdown {
  date: string;             // 'YYYY-MM-DD'
  inflow: number;
  outflow: number;
  net: number;
}

export interface DateRange {
  minDate: number;          // UNIX seconds
  maxDate: number;          // UNIX seconds
}

/** Capabilities a CasinoAdapter can advertise. */
export enum Capability {
  /** Returns per-bet data with game type, amounts, tx hashes. */
  BET_HISTORY = 'bet_history',
  /** Returns pre-aggregated daily inflow/outflow. */
  DAILY_AGGREGATES = 'daily_aggregates',
  /** Returns all-time cumulative totals. */
  ALL_TIME_SUMMARY = 'all_time_summary',
  /** Can discover the earliest/latest available dates. */
  DATE_RANGE = 'date_range',
}
