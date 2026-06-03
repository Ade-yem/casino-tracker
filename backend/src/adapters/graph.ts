/**
 * The Graph query client for the BetSwirl Polygon subgraph.
 *
 * Schema confirmed from BetSwirl SDK source (@betswirl/sdk-core).
 * All bets live in a single `Bet` entity (not separate diceBets/coinTossBets).
 * Player address is `user { address: id }`, timestamp is `betTimestamp`,
 * resolution is `resolved` (boolean, not a status enum).
 */
import axios from 'axios';
import { assertGraphConfigured, config, graphEndpoint } from '../config';

/**
 * Execute a GraphQL query against the subgraph.
 * @param query Graphql query
 * @param variables Query variables
 * @param chain Optionally specify "base" or "polygon" to target the respective subgraph; defaults to polygon.
 * @returns 
 */
async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  chain?: "base" | "polygon"
): Promise<T> {
  assertGraphConfigured();
  const res = await axios.post(
    graphEndpoint(chain),
    { query, variables },
    { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.graphApiKey}` }, timeout: 30_000 }
  );
  if (res.data.errors) {
    throw new Error(res.data.errors.map((e: { message: string }) => e.message).join('; '));
  }
  return res.data.data as T;
}

// gameId values as used in the subgraph (confirmed from SDK xe/Ee maps)
export const GAME_IDS = [
  'CoinToss',
  'Dice',
  'Roulette',
  'Keno',
  'Wheel',
  'Plinko',
] as const;

export type GameId = (typeof GAME_IDS)[number];

/** Raw bet as returned by the subgraph (before normalization). */
export interface RawBet {
  id: string;
  gameId: GameId;
  betAmount: string;       // amount per single bet (raw token units)
  betCount: string;        // number of bets in the transaction
  betTimestamp: string;    // UNIX seconds
  betTxnHash: string;
  rollTxnHash: string | null;
  rollTimestamp: string | null;
  // totalBetAmount aliased as rollTotalBetAmount in the SDK;
  // it is the resolved total wagered (may differ from betAmount*betCount for multi-bets)
  totalBetAmount: string | null;
  payout: string | null;   // what the house returned; null if pending
  resolved: boolean;
  refunded: boolean;
  user: { id: string };    // player wallet address (id = lowercased address)
  gameToken: {
    id: string;
    token: {
      id: string;          // token contract address
      symbol: string;
      decimals: string;
    };
  };
}

/** Pre-aggregated per-day data from the GameToken entity's dayData. */
export interface DayData {
  date: string;            // UNIX day timestamp (start of day UTC)
  totalWagered: string;    // sum of all bet amounts that day (raw units)
  totalPayout: string;     // sum of all payouts that day (raw units)
  betCount: string;
  token: {
    symbol: string;
    decimals: string;
  };
}

export interface TokenTotals {
  id: string;
  symbol: string;
  decimals: string;
  totalWagered: string;
  totalPayout: string;
  betCount: string;
}

const BET_FIELDS = `
  id
  gameId
  betAmount
  betCount
  betTimestamp
  betTxnHash
  rollTxnHash
  rollTimestamp
  totalBetAmount
  payout
  resolved
  refunded
  user { id }
  gameToken {
    id
    token { id symbol decimals }
  }
`;

const PAGE_SIZE = 1000;

/** Cursor-based pagination over all resolved bets in a timestamp range. */
export async function fetchAllBets(fromTs: number, toTs: number, chain?: "base" | "polygon"): Promise<RawBet[]> {
  const query = `
    query Bets($lastId: ID!, $from: BigInt!, $to: BigInt!) {
      bets(
        first: ${PAGE_SIZE}
        orderBy: id
        orderDirection: asc
        where: {
          id_gt: $lastId
          betTimestamp_gte: $from
          betTimestamp_lte: $to
          resolved: true
        }
        subgraphError: allow
      ) {
        ${BET_FIELDS}
      }
    }
  `;

  const all: RawBet[] = [];
  let lastId = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await gql<{ bets: RawBet[] }>(query, {
      lastId,
      from: String(fromTs),
      to: String(toTs),
    }, chain);
    const page = data.bets ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    lastId = page[page.length - 1].id;
  }

  return all;
}

/**
 * Fetch pre-aggregated per-day, per-game-token totals from GameTokenDayData.
 * Cursor-paginated on `id` so multi-game/multi-token ranges aren't truncated
 * at 1000 rows. `date` is stored as a unix day boundary (seconds).
 */
export async function fetchDayData(fromTs: number, toTs: number): Promise<DayData[]> {
  const fromDay = Math.floor(fromTs / 86400) * 86400;
  const toDay = Math.floor(toTs / 86400) * 86400;

  const query = `
    query DayData($lastId: ID!, $from: Int!, $to: Int!) {
      gameTokenDayDatas(
        first: ${PAGE_SIZE}
        orderBy: id
        orderDirection: asc
        where: { id_gt: $lastId, date_gte: $from, date_lte: $to }
        subgraphError: allow
      ) {
        id
        date
        totalWagered
        totalPayout
        betCount
        gameToken {
          token { symbol decimals }
        }
      }
    }
  `;

  interface Row {
    id: string;
    date: string;
    totalWagered: string;
    totalPayout: string;
    betCount: string;
    gameToken: { token: { symbol: string; decimals: string } };
  }

  const all: DayData[] = [];
  let lastId = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await gql<{ gameTokenDayDatas: Row[] }>(query, {
      lastId,
      from: fromDay,
      to: toDay,
    });
    const page = data.gameTokenDayDatas ?? [];
    for (const d of page) {
      all.push({
        date: d.date,
        totalWagered: d.totalWagered,
        totalPayout: d.totalPayout,
        betCount: d.betCount,
        token: d.gameToken.token,
      });
    }
    if (page.length < PAGE_SIZE) break;
    lastId = page[page.length - 1].id;
  }

  return all;
}

/**
 * All-time cumulative totals, per token.
 *
 * The subgraph's `Store` entity only tracks counts (betCount, userCount, ...),
 * not financial totals. The authoritative all-time wagered/payout figures live
 * on the `Token` entity, one row per token (USDC, USDT, BETS, ...). The caller
 * sums across tokens, dividing each by its own decimals.
 */
export async function fetchTokenTotals(): Promise<TokenTotals[]> {
  const query = `
    query Tokens {
      tokens(first: 1000) {
        id
        symbol
        decimals
        totalWagered
        totalPayout
        betCount
      }
    }
  `;
  const data = await gql<{ tokens: TokenTotals[] }>(query);
  return data.tokens ?? [];
}

/**
 * Earliest and latest day (UNIX seconds) present in GameTokenDayData.
 * Lets the dashboard open on a window that actually has data instead of
 * a hardcoded range. Returns null when the subgraph has no day data.
 */
export async function fetchDataDateRange(): Promise<{ minDate: number; maxDate: number } | null> {
  const query = `
    query Range {
      first: gameTokenDayDatas(first: 1, orderBy: date, orderDirection: asc) { date }
      last: gameTokenDayDatas(first: 1, orderBy: date, orderDirection: desc) { date }
    }
  `;
  const data = await gql<{
    first: Array<{ date: string }>;
    last: Array<{ date: string }>;
  }>(query);
  if (!data.first?.length || !data.last?.length) return null;
  return { minDate: Number(data.first[0].date), maxDate: Number(data.last[0].date) };
}

/**
 * Introspection helper: discover which top-level query fields exist.
 * Used by the introspect script to validate field names at runtime.
 * @param chain Optionally specify "base" or "polygon" to target the respective subgraph; defaults to polygon.
 */
export async function introspectQueryType(chain?: "base" | "polygon"): Promise<string[]> {
  const data = await gql<{
    __schema: { queryType: { fields: Array<{ name: string }> } };
  }>(`{ __schema { queryType { fields { name } } } }`, {}, chain);
  return data.__schema.queryType.fields.map((f) => f.name);
}

/**
 * Run a raw GraphQL query — used by the introspect script to explore schema.
 */
export { gql as rawGql };
