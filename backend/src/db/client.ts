import Database from 'better-sqlite3';
import { config } from '../config.js';
import {
  CREATE_BETS_TABLE,
  CREATE_BETS_TIMESTAMP_INDEX,
  CREATE_SYNC_STATE_TABLE,
} from './schema.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(CREATE_BETS_TABLE);
  db.exec(CREATE_BETS_TIMESTAMP_INDEX);
  db.exec(CREATE_SYNC_STATE_TABLE);
  db.prepare(
    `INSERT OR IGNORE INTO sync_state (id, last_timestamp, last_sync_time) VALUES (1, 0, 0)`
  ).run();
  return db;
}

export function initDb(): void {
  getDb();
}
