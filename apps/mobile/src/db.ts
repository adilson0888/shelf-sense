import type { SQLiteDatabase } from "expo-sqlite";

export interface ScanRow {
  id: number;
  code: string;
  scanned_at: string;
}

/**
 * Runs once when the database is opened (see <SQLiteProvider onInit>).
 * This is the walking-skeleton's whole "offline storage" schema — real
 * tables (shelves, SKUs, sync queue) arrive with the specs that need them.
 */
export async function migrateDb(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      scanned_at TEXT NOT NULL
    );
  `);
}

export async function insertScan(db: SQLiteDatabase, code: string): Promise<void> {
  await db.runAsync("INSERT INTO scans (code, scanned_at) VALUES (?, ?)", code, new Date().toISOString());
}

export async function listScans(db: SQLiteDatabase, limit = 25): Promise<ScanRow[]> {
  return db.getAllAsync<ScanRow>("SELECT * FROM scans ORDER BY id DESC LIMIT ?", limit);
}
