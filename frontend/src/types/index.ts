export interface Bet {
  id: string;
  bettor: string;
  amount_usd: number;
  payout_usd: number;
  token: string;
  game_type: string;       // 'Dice' | 'CoinToss' | 'Roulette' | 'Keno' | 'Wheel' | 'Plinko'
  resolved: boolean;
  refunded: boolean;
  bet_tx_hash: string;
  roll_tx_hash: string | null;
  timestamp: number;       // UNIX seconds
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
