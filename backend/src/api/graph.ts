/**
 * Backward-compatible re-exports for the legacy route/service files.
 * All real logic now lives in adapters/betswirl/BetSwirlSubgraphAdapter.ts
 * and sources/graphql.ts.
 *
 * New code should call resolveAdapter(casinoId, chainId) instead.
 */
import { makeGraphClient, betSwirlEndpoint } from '../sources/graphql.js';
import { config, assertGraphConfigured } from '../config.js';

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

export async function fetchAllBets(fromTs: number, toTs: number): Promise<RawBet[]> {
  const gql = getGql();
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
      lastId, from: String(fromTs), to: String(toTs),
    });
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

export async function introspectQueryType(): Promise<string[]> {
  const gql = getGql();
  const data = await gql<{ __schema: { queryType: { fields: Array<{ name: string }> } } }>(
    `{ __schema { queryType { fields { name } } } }`
  );
  return data.__schema.queryType.fields.map((f) => f.name);
}

// rawGql: use getGql() to get a bound query function
