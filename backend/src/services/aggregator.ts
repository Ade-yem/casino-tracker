import { config } from '../config';
import { fetchDayData, fetchStoreSummary } from '../api/graph';
import { getNormalizedBets, NormalizedBet } from './sync';

export interface SummaryMetrics {
  totalInflows: number; // SUM(amount_usd) across resolved bets
  totalOutflows: number; // SUM(payout_usd)
  netPosition: number; // inflows - outflows
  payoutRatio: number; // outflows / inflows (0..1)
  txCount: number;
}

export interface DailyBreakdown {
  date: string; // 'YYYY-MM-DD'
  inflow: number;
  outflow: number;
  net: number;
}

/** A bet counts toward flows only once resolved (Win or Lose), not Pending. */
function isResolved(b: NormalizedBet): boolean {
  return b.status === 'Win' || b.status === 'Lose';
}

/**
 * Date-range summary computed from individual bets (excludes Pending).
 * For an all-time view, getStoreSummary() is cheaper (single query).
 */
export async function getSummary(fromTs: number, toTs: number): Promise<SummaryMetrics> {
  const bets = (await getNormalizedBets(fromTs, toTs)).filter(isResolved);
  let totalInflows = 0;
  let totalOutflows = 0;
  for (const b of bets) {
    totalInflows += b.amount_usd;
    totalOutflows += b.payout_usd;
  }
  return {
    totalInflows,
    totalOutflows,
    netPosition: totalInflows - totalOutflows,
    payoutRatio: totalInflows === 0 ? 0 : totalOutflows / totalInflows,
    txCount: bets.length,
  };
}

/** Cumulative all-time summary from the Store entity (fast single query). */
export async function getStoreSummary(): Promise<SummaryMetrics> {
  if (!config.casinoStoreAddress) {
    throw new Error(
      'CASINO_STORE_ADDRESS is not set. Find it by running the introspect script or querying { stores { id } }.'
    );
  }
  const store = await fetchStoreSummary(config.casinoStoreAddress);
  if (!store) {
    throw new Error(
      `No Store found for address ${config.casinoStoreAddress}. Verify CASINO_STORE_ADDRESS.`
    );
  }
  // USDC/USDT on Polygon use 6 decimals. If the store mixes tokens this is an
  // approximation; the per-bet getSummary() path is exact.
  const decimals = 6;
  const divisor = 10 ** decimals;
  const totalInflows = Number(store.totalBetAmount) / divisor;
  const totalOutflows = Number(store.totalPayoutAmount) / divisor;
  return {
    totalInflows,
    totalOutflows,
    netPosition: totalInflows - totalOutflows,
    payoutRatio: totalInflows === 0 ? 0 : totalOutflows / totalInflows,
    txCount: Number(store.totalBetCount),
  };
}

/**
 * Per-day inflow/outflow using the subgraph's pre-aggregated GameTokenDayData.
 * One row per game-token-day, so we group by date and sum across tokens.
 */
export async function getDailyBreakdown(
  fromTs: number,
  toTs: number
): Promise<DailyBreakdown[]> {
  const dayDatas = await fetchDayData(fromTs, toTs);
  const byDate = new Map<string, DailyBreakdown>();

  for (const d of dayDatas) {
    const date = new Date(Number(d.date) * 1000).toISOString().slice(0, 10);
    const dec = Number(d.gameToken.decimals);
    const divisor = 10 ** dec;
    const inflow = Number(d.totalBetAmount) / divisor;
    const outflow = Number(d.totalPayoutAmount) / divisor;
    const existing = byDate.get(date) ?? { date, inflow: 0, outflow: 0, net: 0 };
    byDate.set(date, {
      date,
      inflow: existing.inflow + inflow,
      outflow: existing.outflow + outflow,
      net: existing.net + (inflow - outflow),
    });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
