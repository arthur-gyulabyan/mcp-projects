import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../../config';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dir = path.dirname(config.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}
