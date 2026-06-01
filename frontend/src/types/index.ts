export interface Bet {
  id: string;
  bettor: string;
  amount_usd: number;
  payout_usd: number;
  token: string;
  game_type: string;
  status: 'Pending' | 'Win' | 'Lose';
  roll_tx_hash: string | null;
  timestamp: number;
}

export interface SummaryMetrics {
  totalInflows: number;
  totalOutflows: number;
  netPosition: number;
  payoutRatio: number;
  txCount: number;
}

export interface DailyBreakdown {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface TransactionsResponse {
  data: Bet[];
  total: number;
  limit: number;
  offset: number;
}
