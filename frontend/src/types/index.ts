export interface Bet {
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
  timestamp: number;
  casino: string;
  chain: string;
}

export interface CatalogEntry {
  casinoId: string;
  casinoName: string;
  casinoUrl: string;
  chainId: string;
  chainName: string;
  sources: string[];
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
