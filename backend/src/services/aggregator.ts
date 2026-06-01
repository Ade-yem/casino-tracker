import { fetchDayData, fetchTokenTotals, DayData } from '../api/graph';

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

function toMetrics(inflows: number, outflows: number, txCount: number): SummaryMetrics {
  return {
    totalInflows: inflows,
    totalOutflows: outflows,
    netPosition: inflows - outflows,
    payoutRatio: inflows === 0 ? 0 : outflows / inflows,
    txCount,
  };
}

/**
 * Date-filtered summary, derived from the same pre-aggregated GameTokenDayData
 * the daily chart uses — so the summary cards and the chart always agree, and
 * we avoid fetching every individual bet.
 */
export async function getSummary(fromTs: number, toTs: number): Promise<SummaryMetrics> {
  const dayDatas = await fetchDayData(fromTs, toTs);
  return summarizeDayData(dayDatas);
}

function summarizeDayData(dayDatas: DayData[]): SummaryMetrics {
  let inflows = 0;
  let outflows = 0;
  let txCount = 0;
  for (const d of dayDatas) {
    const divisor = 10 ** Number(d.token.decimals);
    inflows += Number(d.totalWagered) / divisor;
    outflows += Number(d.totalPayout) / divisor;
    txCount += Number(d.betCount);
  }
  return toMetrics(inflows, outflows, txCount);
}

/**
 * All-time cumulative summary, aggregated across every token.
 * Each token is divided by its own decimals before summing.
 */
export async function getAllTimeSummary(): Promise<SummaryMetrics> {
  const tokens = await fetchTokenTotals();
  let inflows = 0;
  let outflows = 0;
  let txCount = 0;
  for (const t of tokens) {
    const divisor = 10 ** Number(t.decimals);
    inflows += Number(t.totalWagered) / divisor;
    outflows += Number(t.totalPayout) / divisor;
    txCount += Number(t.betCount);
  }
  return toMetrics(inflows, outflows, txCount);
}

/** Per-day inflow/outflow/net, grouped across all game-token rows. */
export async function getDailyBreakdown(
  fromTs: number,
  toTs: number
): Promise<DailyBreakdown[]> {
  const dayDatas = await fetchDayData(fromTs, toTs);
  const byDate = new Map<string, DailyBreakdown>();

  for (const d of dayDatas) {
    const date = new Date(Number(d.date) * 1000).toISOString().slice(0, 10);
    const divisor = 10 ** Number(d.token.decimals);
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
