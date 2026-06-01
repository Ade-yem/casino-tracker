/**
 * The Graph query client for the BetSwirl Polygon subgraph.
 *
 * Schema confirmed from BetSwirl SDK source (@betswirl/sdk-core).
 * All bets live in a single `Bet` entity (not separate diceBets/coinTossBets).
 * Player address is `user { address: id }`, timestamp is `betTimestamp`,
 * resolution is `resolved` (boolean, not a status enum).
 */
import axios from 'axios';
import { assertGraphConfigured, graphEndpoint } from '../config';

async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  assertGraphConfigured();
  const res = await axios.post(
    graphEndpoint(),
    { query, variables },
    { headers: { 'Content-Type': 'application/json' }, timeout: 30_000 }
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

export interface BankSummary {
  id: string;
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
export async function fetchAllBets(fromTs: number, toTs: number): Promise<RawBet[]> {
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
    });
    const page = data.bets ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    lastId = page[page.length - 1].id;
  }

  return all;
}

/**
 * Fetch pre-aggregated day data from GameToken entities.
 * Each GameToken has a dayData array; we query across all tokens.
 * NOTE: This uses a different approach than per-bet fetching — it queries the
 * GameToken entity's dayData, which pre-aggregates totalWagered/totalPayout.
 */
export async function fetchDayData(fromTs: number, toTs: number): Promise<DayData[]> {
  // Convert timestamps to day boundaries (The Graph stores day as unix day * 86400)
  const fromDay = Math.floor(fromTs / 86400) * 86400;
  const toDay = Math.floor(toTs / 86400) * 86400;

  const query = `
    query DayData($from: Int!, $to: Int!) {
      gameTokenDayDatas(
        first: ${PAGE_SIZE}
        orderBy: date
        orderDirection: asc
        where: { date_gte: $from, date_lte: $to }
        subgraphError: allow
      ) {
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

  // Try this entity; if field names differ we fall back in aggregator
  try {
    const data = await gql<{
      gameTokenDayDatas: Array<{
        date: string;
        totalWagered: string;
        totalPayout: string;
        betCount: string;
        gameToken: { token: { symbol: string; decimals: string } };
      }>;
    }>(query, { from: fromDay, to: toDay });

    return (data.gameTokenDayDatas ?? []).map((d) => ({
      date: d.date,
      totalWagered: d.totalWagered,
      totalPayout: d.totalPayout,
      betCount: d.betCount,
      token: d.gameToken.token,
    }));
  } catch {
    // If gameTokenDayDatas doesn't exist or fields differ, return empty so
    // aggregator falls back to per-bet aggregation.
    return [];
  }
}

/** Bank/Store cumulative summary for the Polygon deployment. */
export async function fetchBankSummary(bankAddress: string): Promise<BankSummary | null> {
  const query = `
    query Bank($id: ID!) {
      casino(id: $id) {
        id
        totalWagered
        totalPayout
        betCount
      }
    }
  `;

  // The entity might be called 'casino', 'bank', or 'store' — try in order.
  const entityNames = ['casino', 'bank', 'store'];
  for (const entity of entityNames) {
    try {
      const q = query.replace('casino(id', `${entity}(id`).replace('casino {\n', `${entity} {\n`);
      const data = await gql<Record<string, BankSummary | null>>(q, {
        id: bankAddress.toLowerCase(),
      });
      const result = data[entity];
      if (result) return result;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Introspection helper: discover which top-level query fields exist.
 * Used by the introspect script to validate field names at runtime.
 */
export async function introspectQueryType(): Promise<string[]> {
  const data = await gql<{
    __schema: { queryType: { fields: Array<{ name: string }> } };
  }>(`{ __schema { queryType { fields { name } } } }`);
  return data.__schema.queryType.fields.map((f) => f.name);
}

/**
 * Run a raw GraphQL query — used by the introspect script to explore schema.
 */
export { gql as rawGql };
