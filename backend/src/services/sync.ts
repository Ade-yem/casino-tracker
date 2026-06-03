import { RawBet, fetchAllBets } from '../adapters/graph';
import { getDb } from '../db/client';

export interface NormalizedBet {
  id: string;
  bettor: string;          // player wallet address
  amount_usd: number;      // total wagered (betAmount * betCount), human-readable
  payout_usd: number;      // house outflow, human-readable (0 if lost)
  token: string;           // e.g. 'USDC'
  game_type: string;       // e.g. 'Dice', 'CoinToss'
  resolved: boolean;
  refunded: boolean;
  bet_tx_hash: string;
  roll_tx_hash: string | null;
  timestamp: number;       // betTimestamp (UNIX seconds)
}

/**
 * Convert a raw subgraph Bet into our normalized format.
 *
 * Amount: the total wagered per bet transaction = betAmount * betCount.
 * If totalBetAmount is present (set after roll resolution) we prefer it
 * because it's the authoritative on-chain value for multi-bet sessions.
 */
export function normalizeBet(raw: RawBet): NormalizedBet {
  const decimals = Number(raw.gameToken.token.decimals);
  const divisor = 10 ** decimals;

  // betAmount is per single roll; multiply by betCount for the full wager.
  const totalWagered = raw.totalBetAmount
    ? Number(raw.totalBetAmount) / divisor
    : (Number(raw.betAmount) * Number(raw.betCount)) / divisor;

  const payout = raw.payout ? Number(raw.payout) / divisor : 0;

  return {
    id: raw.id,
    bettor: raw.user.id,
    amount_usd: totalWagered,
    payout_usd: payout,
    token: raw.gameToken.token.symbol,
    game_type: raw.gameId,
    resolved: raw.resolved,
    refunded: raw.refunded,
    bet_tx_hash: raw.betTxnHash,
    roll_tx_hash: raw.rollTxnHash,
    timestamp: Number(raw.betTimestamp),
  };
}

/** Fetch + normalize all resolved bets for a time range. */
export async function getNormalizedBets(
  fromTs: number,
  toTs: number
): Promise<NormalizedBet[]> {
  const raw = await fetchAllBets(fromTs, toTs);
  return raw.map(normalizeBet);
}

/** Write-through cache: upsert normalized bets into SQLite. */
export function cacheBets(bets: NormalizedBet[]): void {
  if (bets.length === 0) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO bets
      (id, bettor, amount, amount_usd, payout_usd, token, game_type, status, roll_tx_hash, timestamp)
    VALUES
      (@id, @bettor, @amount, @amount_usd, @payout_usd, @token, @game_type, @status, @roll_tx_hash, @timestamp)
  `);
  const insertMany = db.transaction((rows: NormalizedBet[]) => {
    for (const b of rows) {
      stmt.run({
        id: b.id,
        bettor: b.bettor,
        amount: String(b.amount_usd),
        amount_usd: b.amount_usd,
        payout_usd: b.payout_usd,
        token: b.token,
        game_type: b.game_type,
        status: b.refunded ? 'Refunded' : b.resolved ? 'Resolved' : 'Pending',
        roll_tx_hash: b.roll_tx_hash,
        timestamp: b.timestamp,
      });
    }
  });
  insertMany(bets);

  const maxTs = bets.reduce((m, b) => Math.max(m, b.timestamp), 0);
  db.prepare(
    `UPDATE sync_state SET last_timestamp = MAX(last_timestamp, ?), last_sync_time = ? WHERE id = 1`
  ).run(maxTs, Math.floor(Date.now() / 1000));
}

export function clearCache(): void {
  const db = getDb();
  db.prepare('DELETE FROM bets').run();
  db.prepare('UPDATE sync_state SET last_timestamp = 0, last_sync_time = 0 WHERE id = 1').run();
}
