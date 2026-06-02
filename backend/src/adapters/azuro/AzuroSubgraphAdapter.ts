import { makeGraphClient } from '../../sources/graphql.js';
import type { CasinoAdapter } from '../CasinoAdapter.js';
import type {
  NormalizedBet,
  SummaryMetrics,
  DailyBreakdown,
  DateRange,
} from '../../domain/types.js';
import { Capability } from '../../domain/types.js';

// ---------------------------------------------------------------------------
// Azuro API v3 Subgraph schema types
// ---------------------------------------------------------------------------

interface AzuroBet {
  id: string;
  betId: string;
  bettor: string;
  owner: string;
  amount: string;           // BigDecimal — already human-readable (no decimals division needed)
  rawAmount: string;        // BigInt — raw on-chain units
  payout: string | null;    // BigDecimal — actual payout (null until resolved/settled)
  rawPayout: string | null;
  potentialPayout: string;
  status: 'Accepted' | 'Canceled' | 'Resolved';
  result: 'Won' | 'Lost' | null;
  type: 'Ordinar' | 'Express';
  createdBlockTimestamp: string;   // UNIX seconds
  resolvedBlockTimestamp: string | null;
  createdTxHash: string;
  resolvedTxHash: string | null;
  core: { address: string; liquidityPool: { token: { symbol: string; decimals: string } } };
}

interface AzuroLiquidityPool {
  id: string;
  token: { symbol: string; decimals: string };
  betsAmount: string;
  wonBetsAmount: string;
}

const PAGE_SIZE = 1000;

// Azuro uses self-hosted thegraph.azuro.org — no API key required
const AZURO_ENDPOINTS: Record<string, string> = {
  polygon:  'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-polygon-v3',
  arbitrum: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-arbitrum-one-v3',
  gnosis:   'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-gnosis-v3',
};

export class AzuroSubgraphAdapter implements CasinoAdapter {
  readonly casinoId = 'azuro';
  readonly chainId: string;
  readonly capabilities = new Set<Capability>([
    Capability.BET_HISTORY,
    Capability.DAILY_AGGREGATES,
    Capability.ALL_TIME_SUMMARY,
    Capability.DATE_RANGE,
  ]);

  private readonly gql: ReturnType<typeof makeGraphClient>;

  constructor(chainId: string) {
    const endpoint = AZURO_ENDPOINTS[chainId];
    if (!endpoint) throw new Error(`Azuro has no subgraph for chain: ${chainId}`);
    this.chainId = chainId;
    this.gql = makeGraphClient(endpoint);
  }

  // -------------------------------------------------------------------------

  async getBets(fromTs: number, toTs: number): Promise<NormalizedBet[]> {
    const query = `
      query Bets($lastId: ID!, $from: BigInt!, $to: BigInt!) {
        bets(
          first: ${PAGE_SIZE}
          orderBy: id orderDirection: asc
          where: {
            id_gt: $lastId
            createdBlockTimestamp_gte: $from
            createdBlockTimestamp_lte: $to
            status_in: [Resolved, Canceled]
          }
        ) {
          id betId bettor amount rawAmount payout rawPayout
          potentialPayout status result type
          createdBlockTimestamp resolvedBlockTimestamp
          createdTxHash resolvedTxHash
          core {
            address
            liquidityPool { token { symbol decimals } }
          }
        }
      }
    `;

    const all: AzuroBet[] = [];
    let lastId = '';
    while (true) {
      const data = await this.gql<{ bets: AzuroBet[] }>(query, {
        lastId,
        from: String(fromTs),
        to: String(toTs),
      });
      const page = data.bets ?? [];
      all.push(...page);
      if (page.length < PAGE_SIZE) break;
      lastId = page[page.length - 1].id;
    }

    return all.map((b) => this.normalizeBet(b));
  }

  async getSummary(fromTs: number, toTs: number): Promise<SummaryMetrics> {
    const bets = await this.getBets(fromTs, toTs);
    return this.metricsFromBets(bets);
  }

  async getDailyBreakdown(fromTs: number, toTs: number): Promise<DailyBreakdown[]> {
    const bets = await this.getBets(fromTs, toTs);
    const byDate = new Map<string, DailyBreakdown>();

    for (const b of bets) {
      const date = new Date(b.timestamp * 1000).toISOString().slice(0, 10);
      const existing = byDate.get(date) ?? { date, inflow: 0, outflow: 0, net: 0 };
      byDate.set(date, {
        date,
        inflow:  existing.inflow  + b.amount_usd,
        outflow: existing.outflow + b.payout_usd,
        net:     existing.net     + (b.amount_usd - b.payout_usd),
      });
    }

    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  async getAllTimeSummary(): Promise<SummaryMetrics> {
    const query = `
      query Pools {
        liquidityPoolContracts(first: 100) {
          id
          token { symbol decimals }
          betsAmount
          wonBetsAmount
        }
      }
    `;
    const data = await this.gql<{ liquidityPoolContracts: AzuroLiquidityPool[] }>(query);
    const pools = data.liquidityPoolContracts ?? [];

    let inflows = 0, outflows = 0;
    for (const p of pools) {
      // betsAmount / wonBetsAmount are raw units — divide by token decimals
      const dec = 10 ** Number(p.token.decimals);
      inflows  += Number(p.betsAmount)    / dec;
      outflows += Number(p.wonBetsAmount) / dec;
    }

    return {
      totalInflows:  inflows,
      totalOutflows: outflows,
      netPosition:   inflows - outflows,
      payoutRatio:   inflows === 0 ? 0 : outflows / inflows,
      txCount:       0, // not available in pool aggregates
    };
  }

  async getDateRange(): Promise<DateRange | null> {
    const query = `
      query Range {
        first: bets(first: 1, orderBy: createdBlockTimestamp, orderDirection: asc) { createdBlockTimestamp }
        last:  bets(first: 1, orderBy: createdBlockTimestamp, orderDirection: desc) { createdBlockTimestamp }
      }
    `;
    const data = await this.gql<{
      first: Array<{ createdBlockTimestamp: string }>;
      last:  Array<{ createdBlockTimestamp: string }>;
    }>(query);
    if (!data.first?.length || !data.last?.length) return null;
    return {
      minDate: Number(data.first[0].createdBlockTimestamp),
      maxDate: Number(data.last[0].createdBlockTimestamp),
    };
  }

  // -------------------------------------------------------------------------

  private normalizeBet(raw: AzuroBet): NormalizedBet {
    // Azuro `amount` / `payout` fields are BigDecimal — already human-readable
    const amount  = Number(raw.amount  ?? 0);
    const payout  = Number(raw.payout  ?? 0);

    return {
      id:           raw.id,
      bettor:       raw.bettor,
      amount_usd:   amount,
      payout_usd:   payout,
      token:        raw.core?.liquidityPool?.token?.symbol ?? 'USDC',
      game_type:    raw.type,   // 'Ordinar' | 'Express'
      resolved:     raw.status === 'Resolved',
      refunded:     raw.status === 'Canceled',
      bet_tx_hash:  raw.createdTxHash,
      roll_tx_hash: raw.resolvedTxHash ?? null,
      timestamp:    Number(raw.createdBlockTimestamp),
      casino:       this.casinoId,
      chain:        this.chainId,
    };
  }

  private metricsFromBets(bets: NormalizedBet[]): SummaryMetrics {
    let inflows = 0, outflows = 0;
    for (const b of bets) {
      inflows  += b.amount_usd;
      outflows += b.payout_usd;
    }
    return {
      totalInflows:  inflows,
      totalOutflows: outflows,
      netPosition:   inflows - outflows,
      payoutRatio:   inflows === 0 ? 0 : outflows / inflows,
      txCount:       bets.length,
    };
  }
}
