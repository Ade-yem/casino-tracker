import { RawBet, fetchAllBets } from '../adapters/graph';
import { getDb } from '../db/client';

export interface NormalizedBet {
  id: string;
  bettor: string;
  amount_usd: number;
  payout_usd: number;
  token: string;
  game_type: string;
  resolved: boolean;
  refunded: boolean;
  bet_tx_hash: string;
  roll_tx_hash: string | null;
  timestamp: number;
}

export function normalizeBet(raw: RawBet): NormalizedBet {
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
  };
}

export async function getNormalizedBets(fromTs: number, toTs: number): Promise<NormalizedBet[]> {
  const raw = await fetchAllBets(fromTs, toTs);
  return raw.map(normalizeBet);
}

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
