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
// Raw subgraph types
// ---------------------------------------------------------------------------

interface RawBet {
  id: string;
  gameId: string;
  betAmount: string;
  betCount: string;
  betTimestamp: string;
  betTxnHash: string;
  rollTxnHash: string | null;
  rollTimestamp: string | null;
  totalBetAmount: string | null;
  payout: string | null;
  resolved: boolean;
  refunded: boolean;
  user: { id: string };
  gameToken: {
    id: string;
    token: { id: string; symbol: string; decimals: string };
  };
}

interface DayDataRow {
  id: string;
  date: string;
  totalWagered: string;
  totalPayout: string;
  betCount: string;
  gameToken: { token: { symbol: string; decimals: string } };
}

interface TokenRow {
  id: string;
  symbol: string;
  decimals: string;
  totalWagered: string;
  totalPayout: string;
  betCount: string;
}

// ---------------------------------------------------------------------------
// Query fragments
// ---------------------------------------------------------------------------

const BET_FIELDS = `
  id gameId betAmount betCount betTimestamp betTxnHash
  rollTxnHash rollTimestamp totalBetAmount payout resolved refunded
  user { id }
  gameToken { id token { id symbol decimals } }
`;

const PAGE_SIZE = 1000;

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class BetSwirlSubgraphAdapter implements CasinoAdapter {
  readonly casinoId = 'betswirl';
  readonly chainId: string;
  readonly capabilities = new Set<Capability>([
    Capability.BET_HISTORY,
    Capability.DAILY_AGGREGATES,
    Capability.ALL_TIME_SUMMARY,
    Capability.DATE_RANGE,
  ]);

  private readonly gql: ReturnType<typeof makeGraphClient>;

  constructor(chainId: string, apiKey: string, deploymentId: string) {
    this.chainId = chainId;
    this.gql = makeGraphClient(betSwirlEndpoint(apiKey, deploymentId));
  }

  // -------------------------------------------------------------------------
  // CasinoAdapter: getBets
  // -------------------------------------------------------------------------

  async getBets(fromTs: number, toTs: number): Promise<NormalizedBet[]> {
    const query = `
      query Bets($lastId: ID!, $from: BigInt!, $to: BigInt!) {
        bets(
          first: ${PAGE_SIZE}
          orderBy: id orderDirection: asc
          where: { id_gt: $lastId betTimestamp_gte: $from betTimestamp_lte: $to resolved: true }
          subgraphError: allow
        ) { ${BET_FIELDS} }
      }
    `;

    const raw: RawBet[] = [];
    let lastId = '';
    while (true) {
      const data = await this.gql<{ bets: RawBet[] }>(query, {
        lastId,
        from: String(fromTs),
        to: String(toTs),
      });
      const page = data.bets ?? [];
      raw.push(...page);
      if (page.length < PAGE_SIZE) break;
      lastId = page[page.length - 1].id;
    }

    return raw.map((b) => this.normalizeBet(b));
  }

  // -------------------------------------------------------------------------
  // CasinoAdapter: getSummary
  // -------------------------------------------------------------------------

  async getSummary(fromTs: number, toTs: number): Promise<SummaryMetrics> {
    const rows = await this.fetchDayData(fromTs, toTs);
    return this.summarizeDayData(rows);
  }

  // -------------------------------------------------------------------------
  // CasinoAdapter: getDailyBreakdown
  // -------------------------------------------------------------------------

  async getDailyBreakdown(fromTs: number, toTs: number): Promise<DailyBreakdown[]> {
    const rows = await this.fetchDayData(fromTs, toTs);
    const byDate = new Map<string, DailyBreakdown>();

    for (const d of rows) {
      const date = new Date(Number(d.date) * 1000).toISOString().slice(0, 10);
      const divisor = 10 ** Number(d.gameToken.token.decimals);
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

  // -------------------------------------------------------------------------
  // CasinoAdapter: getAllTimeSummary
  // -------------------------------------------------------------------------

  async getAllTimeSummary(): Promise<SummaryMetrics> {
    const query = `
      query Tokens {
        tokens(first: 1000) { id symbol decimals totalWagered totalPayout betCount }
      }
    `;
    const data = await this.gql<{ tokens: TokenRow[] }>(query);
    const tokens = data.tokens ?? [];
    let inflows = 0, outflows = 0, txCount = 0;
    for (const t of tokens) {
      const d = 10 ** Number(t.decimals);
      inflows += Number(t.totalWagered) / d;
      outflows += Number(t.totalPayout) / d;
      txCount += Number(t.betCount);
    }
    return this.toMetrics(inflows, outflows, txCount);
  }

  // -------------------------------------------------------------------------
  // CasinoAdapter: getDateRange
  // -------------------------------------------------------------------------

  async getDateRange(): Promise<DateRange | null> {
    const query = `
      query Range {
        first: gameTokenDayDatas(first: 1, orderBy: date, orderDirection: asc) { date }
        last: gameTokenDayDatas(first: 1, orderBy: date, orderDirection: desc) { date }
      }
    `;
    const data = await this.gql<{
      first: Array<{ date: string }>;
      last: Array<{ date: string }>;
    }>(query);
    if (!data.first?.length || !data.last?.length) return null;
    return {
      minDate: Number(data.first[0].date),
      maxDate: Number(data.last[0].date),
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async fetchDayData(fromTs: number, toTs: number): Promise<DayDataRow[]> {
    const fromDay = Math.floor(fromTs / 86400) * 86400;
    const toDay = Math.floor(toTs / 86400) * 86400;

    const query = `
      query DayData($lastId: ID!, $from: Int!, $to: Int!) {
        gameTokenDayDatas(
          first: ${PAGE_SIZE}
          orderBy: id orderDirection: asc
          where: { id_gt: $lastId date_gte: $from date_lte: $to }
          subgraphError: allow
        ) { id date totalWagered totalPayout betCount gameToken { token { symbol decimals } } }
      }
    `;

    const all: DayDataRow[] = [];
    let lastId = '';
    while (true) {
      const data = await this.gql<{ gameTokenDayDatas: DayDataRow[] }>(query, {
        lastId,
        from: fromDay,
        to: toDay,
      });
      const page = data.gameTokenDayDatas ?? [];
      all.push(...page);
      if (page.length < PAGE_SIZE) break;
      lastId = page[page.length - 1].id;
    }
    return all;
  }

  private normalizeBet(raw: RawBet): NormalizedBet {
    const decimals = Number(raw.gameToken.token.decimals);
    const divisor = 10 ** decimals;
    const totalWagered = raw.totalBetAmount
      ? Number(raw.totalBetAmount) / divisor
      : (Number(raw.betAmount) * Number(raw.betCount)) / divisor;

    return {
      id: raw.id,
      bettor: raw.user.id,
      amount_usd: totalWagered,
      payout_usd: raw.payout ? Number(raw.payout) / divisor : 0,
      token: raw.gameToken.token.symbol,
      game_type: raw.gameId,
      resolved: raw.resolved,
      refunded: raw.refunded,
      bet_tx_hash: raw.betTxnHash,
      roll_tx_hash: raw.rollTxnHash,
      timestamp: Number(raw.betTimestamp),
      casino: this.casinoId,
      chain: this.chainId,
    };
  }

  private toMetrics(inflows: number, outflows: number, txCount: number): SummaryMetrics {
    return {
      totalInflows: inflows,
      totalOutflows: outflows,
      netPosition: inflows - outflows,
      payoutRatio: inflows === 0 ? 0 : outflows / inflows,
      txCount,
    };
  }

  private summarizeDayData(rows: DayDataRow[]): SummaryMetrics {
    let inflows = 0, outflows = 0, txCount = 0;
    for (const d of rows) {
      const div = 10 ** Number(d.gameToken.token.decimals);
      inflows += Number(d.totalWagered) / div;
      outflows += Number(d.totalPayout) / div;
      txCount += Number(d.betCount);
    }
    return this.toMetrics(inflows, outflows, txCount);
  }
}
