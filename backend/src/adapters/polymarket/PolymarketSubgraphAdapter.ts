import { makeGraphClient, betSwirlEndpoint } from '../../sources/graphql.js';
import type { CasinoAdapter } from '../CasinoAdapter.js';
import type {
  NormalizedBet,
  SummaryMetrics,
  DailyBreakdown,
  DateRange,
} from '../../domain/types.js';
import { Capability } from '../../domain/types.js';

// ---------------------------------------------------------------------------
// Polymarket Activity Subgraph — Polygon
//
// IMPORTANT: Polymarket migrated to new CTF Exchange contracts on 2026-04-28
// and stopped supporting their old subgraph indexer. This adapter provides
// historical data up to that date.
//
// Subgraph ID: Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp
// Tracks: OrderFilled events (trades) + Redemptions (payouts)
//
// Financial model:
//   Inflow  = USDC value of outcome tokens purchased (OrderFilled makerAmountFilled)
//   Outflow = USDC redeemed by winning position holders (Redemption payout)
// ---------------------------------------------------------------------------

const POLYMARKET_SUBGRAPH_ID = 'Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp';
const USDC_DECIMALS = 6;
const PAGE_SIZE = 1000;

interface OrderFilledEvent {
  id: string;
  timestamp: string;
  maker: string;
  taker: string;
  makerAmountFilled: string;  // USDC (6 decimals)
  takerAmountFilled: string;  // outcome token units
  fee: string;
  orderHash: string;
  conditionId: string;
}

interface RedemptionEvent {
  id: string;
  timestamp: string;
  redeemer: string;
  payout: string;             // USDC (6 decimals)
}

export class PolymarketSubgraphAdapter implements CasinoAdapter {
  readonly casinoId = 'polymarket';
  readonly chainId = 'polygon';
  readonly capabilities = new Set<Capability>([
    Capability.BET_HISTORY,
    Capability.DAILY_AGGREGATES,
    Capability.ALL_TIME_SUMMARY,
    Capability.DATE_RANGE,
  ]);

  private readonly gql: ReturnType<typeof makeGraphClient>;

  constructor(apiKey: string) {
    // Uses The Graph gateway with the user's API key
    const endpoint = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${POLYMARKET_SUBGRAPH_ID}`;
    this.gql = makeGraphClient(endpoint);
  }

  // -------------------------------------------------------------------------

  async getBets(fromTs: number, toTs: number): Promise<NormalizedBet[]> {
    const [orders, redemptions] = await Promise.all([
      this.fetchOrders(fromTs, toTs),
      this.fetchRedemptions(fromTs, toTs),
    ]);

    // Map orders (inflows) to normalized bets
    const orderBets: NormalizedBet[] = orders.map((o) => ({
      id:           `order-${o.id}`,
      bettor:       o.taker || o.maker,
      amount_usd:   Number(o.makerAmountFilled) / 10 ** USDC_DECIMALS,
      payout_usd:   0,  // payout tracked separately via Redemption
      token:        'USDC',
      game_type:    'prediction',
      resolved:     true,
      refunded:     false,
      bet_tx_hash:  o.orderHash,
      roll_tx_hash: null,
      timestamp:    Number(o.timestamp),
      casino:       this.casinoId,
      chain:        this.chainId,
    }));

    // Map redemptions (outflows) as separate entries
    const redemptionBets: NormalizedBet[] = redemptions.map((r) => ({
      id:           `redeem-${r.id}`,
      bettor:       r.redeemer,
      amount_usd:   0,
      payout_usd:   Number(r.payout) / 10 ** USDC_DECIMALS,
      token:        'USDC',
      game_type:    'redemption',
      resolved:     true,
      refunded:     false,
      bet_tx_hash:  r.id.split('-')[0] ?? r.id,
      roll_tx_hash: null,
      timestamp:    Number(r.timestamp),
      casino:       this.casinoId,
      chain:        this.chainId,
    }));

    return [...orderBets, ...redemptionBets].sort((a, b) => a.timestamp - b.timestamp);
  }

  async getSummary(fromTs: number, toTs: number): Promise<SummaryMetrics> {
    const [orders, redemptions] = await Promise.all([
      this.fetchOrders(fromTs, toTs),
      this.fetchRedemptions(fromTs, toTs),
    ]);

    const inflows  = orders.reduce((s, o) => s + Number(o.makerAmountFilled) / 10 ** USDC_DECIMALS, 0);
    const outflows = redemptions.reduce((s, r) => s + Number(r.payout) / 10 ** USDC_DECIMALS, 0);

    return {
      totalInflows:  inflows,
      totalOutflows: outflows,
      netPosition:   inflows - outflows,
      payoutRatio:   inflows === 0 ? 0 : outflows / inflows,
      txCount:       orders.length,
    };
  }

  async getDailyBreakdown(fromTs: number, toTs: number): Promise<DailyBreakdown[]> {
    const [orders, redemptions] = await Promise.all([
      this.fetchOrders(fromTs, toTs),
      this.fetchRedemptions(fromTs, toTs),
    ]);

    const byDate = new Map<string, DailyBreakdown>();

    for (const o of orders) {
      const date = new Date(Number(o.timestamp) * 1000).toISOString().slice(0, 10);
      const amount = Number(o.makerAmountFilled) / 10 ** USDC_DECIMALS;
      const ex = byDate.get(date) ?? { date, inflow: 0, outflow: 0, net: 0 };
      byDate.set(date, { date, inflow: ex.inflow + amount, outflow: ex.outflow, net: ex.net + amount });
    }
    for (const r of redemptions) {
      const date = new Date(Number(r.timestamp) * 1000).toISOString().slice(0, 10);
      const amount = Number(r.payout) / 10 ** USDC_DECIMALS;
      const ex = byDate.get(date) ?? { date, inflow: 0, outflow: 0, net: 0 };
      byDate.set(date, { date, inflow: ex.inflow, outflow: ex.outflow + amount, net: ex.net - amount });
    }

    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  async getAllTimeSummary(): Promise<SummaryMetrics> {
    // Subgraph deprecated — return summary for the full indexed period
    const epoch = 1620000000; // May 2021 (Polymarket launch on Polygon)
    const cutoff = 1745798400; // 2026-04-28 (deprecation date)
    return this.getSummary(epoch, cutoff);
  }

  async getDateRange(): Promise<DateRange | null> {
    const query = `
      query Range {
        first: orderFilledEvents(first: 1, orderBy: timestamp, orderDirection: asc) { timestamp }
        last:  orderFilledEvents(first: 1, orderBy: timestamp, orderDirection: desc) { timestamp }
      }
    `;
    try {
      const data = await this.gql<{
        first: Array<{ timestamp: string }>;
        last:  Array<{ timestamp: string }>;
      }>(query);
      if (!data.first?.length || !data.last?.length) return null;
      return {
        minDate: Number(data.first[0].timestamp),
        maxDate: Number(data.last[0].timestamp),
      };
    } catch {
      // Subgraph may be offline — return known deprecation window
      return { minDate: 1620000000, maxDate: 1745798400 };
    }
  }

  // -------------------------------------------------------------------------

  private async fetchOrders(fromTs: number, toTs: number): Promise<OrderFilledEvent[]> {
    const query = `
      query Orders($lastId: ID!, $from: BigInt!, $to: BigInt!) {
        orderFilledEvents(
          first: ${PAGE_SIZE}
          orderBy: id orderDirection: asc
          where: { id_gt: $lastId timestamp_gte: $from timestamp_lte: $to }
        ) {
          id timestamp maker taker
          makerAmountFilled takerAmountFilled fee
          orderHash conditionId
        }
      }
    `;
    return this.paginate<OrderFilledEvent>(query, 'orderFilledEvents', fromTs, toTs);
  }

  private async fetchRedemptions(fromTs: number, toTs: number): Promise<RedemptionEvent[]> {
    const query = `
      query Redemptions($lastId: ID!, $from: BigInt!, $to: BigInt!) {
        redemptions(
          first: ${PAGE_SIZE}
          orderBy: id orderDirection: asc
          where: { id_gt: $lastId timestamp_gte: $from timestamp_lte: $to }
        ) {
          id timestamp redeemer payout
        }
      }
    `;
    return this.paginate<RedemptionEvent>(query, 'redemptions', fromTs, toTs);
  }

  private async paginate<T extends { id: string }>(
    query: string,
    field: string,
    fromTs: number,
    toTs: number,
  ): Promise<T[]> {
    const all: T[] = [];
    let lastId = '';
    while (true) {
      const data = await this.gql<Record<string, T[]>>(query, {
        lastId,
        from: String(fromTs),
        to:   String(toTs),
      });
      const page = data[field] ?? [];
      all.push(...page);
      if (page.length < PAGE_SIZE) break;
      lastId = page[page.length - 1].id;
    }
    return all;
  }
}
