// ─────────────────────────────────────────────
// db.ts  SQLite セットアップ
// ─────────────────────────────────────────────

import Database from 'better-sqlite3';
import path     from 'node:path';
import url      from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'roguelike.db');

export function createDb(dbPath = DEFAULT_DB_PATH): Database.Database {
  const db = new Database(dbPath);

  // WAL モード（並行読み取りが速い）
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT    NOT NULL,
      player_name TEXT    NOT NULL,
      class_type  TEXT    NOT NULL,
      lv          INTEGER NOT NULL CHECK(lv >= 1),
      floor       INTEGER NOT NULL CHECK(floor >= 1),
      dungeon_id  TEXT    NOT NULL,
      gold        INTEGER NOT NULL CHECK(gold >= 0),
      turn_count  INTEGER NOT NULL CHECK(turn_count >= 0),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_scores_dungeon
      ON scores(dungeon_id, lv DESC, floor DESC);

    CREATE TABLE IF NOT EXISTS saves (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT    NOT NULL,
      slot       INTEGER NOT NULL CHECK(slot IN (0, 1, 2)),
      data       TEXT    NOT NULL,
      updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, slot)
    );

    CREATE INDEX IF NOT EXISTS idx_saves_user
      ON saves(user_id);
  `);

  return db;
}

export type Db = Database.Database;
