/**
 * Backward-compatible re-exports for the legacy route/service files.
 * All real logic now lives in adapters/betswirl/BetSwirlSubgraphAdapter.ts
 * and sources/graphql.ts.
 *
 * New code should call resolveAdapter(casinoId, chainId) instead.
 */
import axios from 'axios';
import { assertGraphConfigured, config, graphEndpoint } from '../config';
import { makeGraphClient, betSwirlEndpoint } from '../sources/graphql.js';

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

// Polygon deployment ID (kept for the legacy introspect script)
const POLYGON_DEPLOYMENT_ID =
  process.env.GRAPH_POLYGON_DEPLOYMENT_ID ??
  'QmUa6b7voVS4kuERGo3bEDvRsW2FdTogSLeztnvtsi5DB2';

function getGql() {
  assertGraphConfigured();
  return makeGraphClient(betSwirlEndpoint(config.graphApiKey, POLYGON_DEPLOYMENT_ID));
}

export const GAME_IDS = [
  'CoinToss', 'Dice', 'Roulette', 'Keno', 'Wheel', 'Plinko',
] as const;
export type GameId = (typeof GAME_IDS)[number];

export interface RawBet {
  id: string;
  gameId: GameId;
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

export interface DayData {
  date: string;
  totalWagered: string;
  totalPayout: string;
  betCount: string;
  token: { symbol: string; decimals: string };
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
  id gameId betAmount betCount betTimestamp betTxnHash
  rollTxnHash rollTimestamp totalBetAmount payout resolved refunded
  user { id }
  gameToken { id token { id symbol decimals } }
`;

const PAGE_SIZE = 1000;

/** Cursor-based pagination over all resolved bets in a timestamp range. */
export async function fetchAllBets(fromTs: number, toTs: number, chain?: "base" | "polygon"): Promise<RawBet[]> {
  const query = `
    query Bets($lastId: ID!, $from: BigInt!, $to: BigInt!) {
      bets(
        first: ${PAGE_SIZE} orderBy: id orderDirection: asc
        where: { id_gt: $lastId betTimestamp_gte: $from betTimestamp_lte: $to resolved: true }
        subgraphError: allow
      ) { ${BET_FIELDS} }
    }
  `;
  const all: RawBet[] = [];
  let lastId = '';
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

export async function fetchDayData(fromTs: number, toTs: number): Promise<DayData[]> {
  const gql = getGql();
  const fromDay = Math.floor(fromTs / 86400) * 86400;
  const toDay = Math.floor(toTs / 86400) * 86400;
  const query = `
    query DayData($lastId: ID!, $from: Int!, $to: Int!) {
      gameTokenDayDatas(
        first: ${PAGE_SIZE} orderBy: id orderDirection: asc
        where: { id_gt: $lastId date_gte: $from date_lte: $to }
        subgraphError: allow
      ) { id date totalWagered totalPayout betCount gameToken { token { symbol decimals } } }
    }
  `;
  interface Row {
    id: string; date: string; totalWagered: string; totalPayout: string;
    betCount: string; gameToken: { token: { symbol: string; decimals: string } };
  }
  const all: DayData[] = [];
  let lastId = '';
  while (true) {
    const data = await gql<{ gameTokenDayDatas: Row[] }>(query, { lastId, from: fromDay, to: toDay });
    const page = data.gameTokenDayDatas ?? [];
    for (const d of page) all.push({ date: d.date, totalWagered: d.totalWagered, totalPayout: d.totalPayout, betCount: d.betCount, token: d.gameToken.token });
    if (page.length < PAGE_SIZE) break;
    lastId = page[page.length - 1].id;
  }
  return all;
}

export async function fetchTokenTotals(): Promise<TokenTotals[]> {
  const gql = getGql();
  const query = `query Tokens { tokens(first: 1000) { id symbol decimals totalWagered totalPayout betCount } }`;
  const data = await gql<{ tokens: TokenTotals[] }>(query);
  return data.tokens ?? [];
}

export async function fetchDataDateRange(): Promise<{ minDate: number; maxDate: number } | null> {
  const gql = getGql();
  const query = `
    query Range {
      first: gameTokenDayDatas(first: 1, orderBy: date, orderDirection: asc) { date }
      last: gameTokenDayDatas(first: 1, orderBy: date, orderDirection: desc) { date }
    }
  `;
  const data = await gql<{ first: Array<{ date: string }>; last: Array<{ date: string }> }>(query);
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
