import Database from "better-sqlite3";
import { initSchema } from "./schema.js";

export function openDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  initSchema(db);
  return db;
}
