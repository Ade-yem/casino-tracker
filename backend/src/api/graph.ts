import axios from 'axios';
import { assertGraphConfigured, graphEndpoint } from '../config';

/**
 * Minimal GraphQL POST helper against the BetSwirl subgraph on The Graph's
 * decentralized network. Throws on GraphQL or transport errors.
 */
export async function gql<T>(
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

export interface RawBet {
  id: string;
  bettor: string;
  amount: string;
  payout: string;
  status: 'Pending' | 'Win' | 'Lose';
  timestamp: string;
  rollTxnHash: string | null;
  gameToken: { symbol: string; decimals: string };
}

export interface DayData {
  date: string;
  totalBetAmount: string;
  totalPayoutAmount: string;
  totalBetCount: string;
  gameToken: { symbol: string; decimals: string };
}

export interface StoreSummary {
  id: string;
  totalBetAmount: string;
  totalPayoutAmount: string;
  totalBetCount: string;
}

/** Subgraph query roots, one per game type. */
export const GAME_QUERY_ROOTS = [
  'diceBets',
  'coinTossBets',
  'rouletteBets',
  'kenoBets',
  'russianRouletteBets',
] as const;
export type GameQueryRoot = (typeof GAME_QUERY_ROOTS)[number];

/** Map a query root to the canonical game-type label stored/displayed. */
export const GAME_TYPE_LABEL: Record<GameQueryRoot, string> = {
  diceBets: 'Dice',
  coinTossBets: 'CoinToss',
  rouletteBets: 'Roulette',
  kenoBets: 'Keno',
  russianRouletteBets: 'RussianRoulette',
};

const PAGE_SIZE = 1000;

/**
 * Fetch every bet of one game type within [fromTs, toTs] using cursor-based
 * pagination on `id` (never `skip`, which degrades past ~5k rows).
 */
async function fetchBetsForGame(
  root: GameQueryRoot,
  fromTs: number,
  toTs: number
): Promise<RawBet[]> {
  const query = `
    query Bets($lastId: ID!, $from: Int!, $to: Int!) {
      ${root}(
        first: ${PAGE_SIZE}
        orderBy: id
        orderDirection: asc
        where: { id_gt: $lastId, timestamp_gte: $from, timestamp_lte: $to }
      ) {
        id
        bettor
        amount
        payout
        status
        timestamp
        rollTxnHash
        gameToken { symbol decimals }
      }
    }
  `;

  const all: RawBet[] = [];
  let lastId = '';

  // Walk pages until a short page signals the end.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await gql<Record<string, RawBet[]>>(query, {
      lastId,
      from: fromTs,
      to: toTs,
    });
    const page = data[root] ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    lastId = page[page.length - 1].id;
  }

  return all;
}

/** Fetch bets across all game types in parallel, tagged with their game type. */
export async function fetchAllBets(
  fromTs: number,
  toTs: number
): Promise<Array<{ raw: RawBet; gameType: string }>> {
  const pages = await Promise.all(
    GAME_QUERY_ROOTS.map(async (root) => {
      const bets = await fetchBetsForGame(root, fromTs, toTs);
      return bets.map((raw) => ({ raw, gameType: GAME_TYPE_LABEL[root] }));
    })
  );
  return pages
    .flat()
    .sort((a, b) => Number(a.raw.timestamp) - Number(b.raw.timestamp));
}

/** Pre-aggregated per-day, per-game-token totals. */
export async function fetchDayData(fromTs: number, toTs: number): Promise<DayData[]> {
  const query = `
    query DayData($from: Int!, $to: Int!, $lastDate: Int!) {
      gameTokenDayDatas(
        first: ${PAGE_SIZE}
        orderBy: date
        orderDirection: asc
        where: { date_gte: $from, date_lte: $to, date_gt: $lastDate }
      ) {
        date
        totalBetAmount
        totalPayoutAmount
        totalBetCount
        gameToken { symbol decimals }
      }
    }
  `;

  const all: DayData[] = [];
  let lastDate = fromTs - 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await gql<{ gameTokenDayDatas: DayData[] }>(query, {
      from: fromTs,
      to: toTs,
      lastDate,
    });
    const page = data.gameTokenDayDatas ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    lastDate = Number(page[page.length - 1].date);
  }

  return all;
}

/** Cumulative totals from the Store entity (single call). */
export async function fetchStoreSummary(storeId: string): Promise<StoreSummary | null> {
  const query = `
    query Store($id: ID!) {
      store(id: $id) {
        id
        totalBetAmount
        totalPayoutAmount
        totalBetCount
      }
    }
  `;
  const data = await gql<{ store: StoreSummary | null }>(query, {
    id: storeId.toLowerCase(),
  });
  return data.store;
}

/** List stores (used to discover the BetSwirl Store address on first setup). */
export async function listStores(): Promise<StoreSummary[]> {
  const query = `
    query Stores {
      stores(first: 10) {
        id
        totalBetAmount
        totalPayoutAmount
        totalBetCount
      }
    }
  `;
  const data = await gql<{ stores: StoreSummary[] }>(query);
  return data.stores;
}
