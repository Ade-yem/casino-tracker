import { RawBet, fetchAllBets } from '../api/graph';
import { getDb } from '../db/client';

export interface NormalizedBet {
  id: string;
  bettor: string;
  amount_usd: number;
  payout_usd: number;
  token: string;
  game_type: string;
  status: 'Pending' | 'Win' | 'Lose';
  roll_tx_hash: string | null;
  timestamp: number;
}

/** Convert a raw subgraph bet into display/storage units. */
export function normalizeBet(raw: RawBet, gameType: string): NormalizedBet {
  const decimals = Number(raw.gameToken.decimals);
  const divisor = 10 ** decimals;
  return {
    id: raw.id,
    bettor: raw.bettor,
    amount_usd: Number(raw.amount) / divisor,
    payout_usd: Number(raw.payout) / divisor,
    token: raw.gameToken.symbol,
    game_type: gameType,
    status: raw.status,
    roll_tx_hash: raw.rollTxnHash,
    timestamp: Number(raw.timestamp),
  };
}

/** Fetch + normalize bets across all game types for a time range. */
export async function getNormalizedBets(
  fromTs: number,
  toTs: number
): Promise<NormalizedBet[]> {
  const tagged = await fetchAllBets(fromTs, toTs);
  return tagged.map(({ raw, gameType }) => normalizeBet(raw, gameType));
}

/**
 * Optional write-through cache: persist normalized bets to SQLite so repeated
 * requests don't re-hit The Graph. INSERT OR REPLACE keyed on the bet id.
 */
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
        status: b.status,
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

/** Clear the local cache (used by POST /api/refresh). */
export function clearCache(): void {
  const db = getDb();
  db.prepare('DELETE FROM bets').run();
  db.prepare('UPDATE sync_state SET last_timestamp = 0, last_sync_time = 0 WHERE id = 1').run();
}
