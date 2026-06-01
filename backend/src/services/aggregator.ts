import { fetchDayData, fetchBankSummary } from '../api/graph';
import { getNormalizedBets, NormalizedBet } from './sync';
import { config } from '../config';

export interface SummaryMetrics {
  totalInflows: number;   // total wagered by players
  totalOutflows: number;  // total paid out to players
  netPosition: number;    // inflows - outflows (house profit)
  payoutRatio: number;    // outflows / inflows (0..1)
  txCount: number;        // resolved bet count
}

export interface DailyBreakdown {
  date: string;   // 'YYYY-MM-DD'
  inflow: number;
  outflow: number;
  net: number;
}

/** Include only resolved, non-refunded bets in financial metrics. */
function isCountable(b: NormalizedBet): boolean {
  return b.resolved && !b.refunded;
}

function sumBets(bets: NormalizedBet[]): SummaryMetrics {
  const counted = bets.filter(isCountable);
  let totalInflows = 0;
  let totalOutflows = 0;
  for (const b of counted) {
    totalInflows += b.amount_usd;
    totalOutflows += b.payout_usd;
  }
  return {
    totalInflows,
    totalOutflows,
    netPosition: totalInflows - totalOutflows,
    payoutRatio: totalInflows === 0 ? 0 : totalOutflows / totalInflows,
    txCount: counted.length,
  };
}

/** Date-filtered summary computed from individual bets. */
export async function getSummary(fromTs: number, toTs: number): Promise<SummaryMetrics> {
  const bets = await getNormalizedBets(fromTs, toTs);
  return sumBets(bets);
}

/** All-time cumulative summary from the Bank entity (one query). */
export async function getBankSummary(): Promise<SummaryMetrics> {
  const bank = await fetchBankSummary(config.casinoStoreAddress);
  if (!bank) {
    throw new Error(
      `No Bank/Casino entity found for address ${config.casinoStoreAddress}. ` +
        'Verify CASINO_STORE_ADDRESS and run the introspect script.'
    );
  }
  const decimals = 6; // USDC/USDT on Polygon
  const divisor = 10 ** decimals;
  const totalInflows = Number(bank.totalWagered) / divisor;
  const totalOutflows = Number(bank.totalPayout) / divisor;
  return {
    totalInflows,
    totalOutflows,
    netPosition: totalInflows - totalOutflows,
    payoutRatio: totalInflows === 0 ? 0 : totalOutflows / totalInflows,
    txCount: Number(bank.betCount),
  };
}

/**
 * Per-day breakdown using GameToken pre-aggregated DayData when available.
 * Falls back to per-bet aggregation if DayData entities are empty.
 */
export async function getDailyBreakdown(
  fromTs: number,
  toTs: number
): Promise<DailyBreakdown[]> {
  const dayDatas = await fetchDayData(fromTs, toTs);

  if (dayDatas.length > 0) {
    const byDate = new Map<string, DailyBreakdown>();
    for (const d of dayDatas) {
      const date = new Date(Number(d.date) * 1000).toISOString().slice(0, 10);
      const dec = Number(d.token.decimals);
      const divisor = 10 ** dec;
      const inflow = Number(d.totalWagered) / divisor;
      const outflow = Number(d.totalPayout) / divisor;
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

  // Fallback: aggregate from individual bets
  const bets = (await getNormalizedBets(fromTs, toTs)).filter(isCountable);
  const byDate = new Map<string, DailyBreakdown>();
  for (const b of bets) {
    const date = new Date(b.timestamp * 1000).toISOString().slice(0, 10);
    const existing = byDate.get(date) ?? { date, inflow: 0, outflow: 0, net: 0 };
    byDate.set(date, {
      date,
      inflow: existing.inflow + b.amount_usd,
      outflow: existing.outflow + b.payout_usd,
      net: existing.net + (b.amount_usd - b.payout_usd),
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
