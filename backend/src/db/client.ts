import Database from 'better-sqlite3';
import { config } from '../config';
import {
  CREATE_BETS_TABLE,
  CREATE_BETS_TIMESTAMP_INDEX,
  CREATE_SYNC_STATE_TABLE,
} from './schema';

let db: Database.Database | null = null;

/** Lazily open (and initialize) the SQLite cache database. */
export function getDb(): Database.Database {
  if (db) return db;
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(CREATE_BETS_TABLE);
  db.exec(CREATE_BETS_TIMESTAMP_INDEX);
  db.exec(CREATE_SYNC_STATE_TABLE);
  // Ensure a single sync_state row exists.
  db.prepare(
    `INSERT OR IGNORE INTO sync_state (id, last_timestamp, last_sync_time) VALUES (1, 0, 0)`
  ).run();
  return db;
}

/** Called at server startup so a bad DB path fails fast. */
export function initDb(): void {
  getDb();
}
