// SQLite is an optional write-through cache. The Graph is the source of truth.

export const CREATE_BETS_TABLE = `
  CREATE TABLE IF NOT EXISTS bets (
    id           TEXT PRIMARY KEY,
    bettor       TEXT NOT NULL,
    amount       TEXT NOT NULL,        -- raw token units
    amount_usd   REAL NOT NULL,        -- amount / 10^decimals
    payout_usd   REAL NOT NULL,        -- payout / 10^decimals
    token        TEXT NOT NULL,        -- 'USDC' | 'USDT' | 'BETS' ...
    game_type    TEXT NOT NULL,        -- 'Dice' | 'CoinToss' | 'Roulette' | 'Keno' | 'RussianRoulette'
    status       TEXT NOT NULL,        -- 'Pending' | 'Win' | 'Lose'
    roll_tx_hash TEXT,
    timestamp    INTEGER NOT NULL      -- UNIX seconds
  )
`;

export const CREATE_BETS_TIMESTAMP_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_bets_timestamp ON bets (timestamp)
`;

export const CREATE_SYNC_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_state (
    id              INTEGER PRIMARY KEY DEFAULT 1,
    last_timestamp  INTEGER NOT NULL DEFAULT 0,
    last_sync_time  INTEGER NOT NULL DEFAULT 0
  )
`;
