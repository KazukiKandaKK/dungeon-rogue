// ─────────────────────────────────────────────
// repository-sqlite.ts  SQLite 実装（本番用）
//
// 必要環境: Node.js LTS (v22+) + better-sqlite3
//   npm install better-sqlite3 @types/better-sqlite3
//
// 使い方:
//   import { SqliteScoreRepository, SqliteSaveRepository } from './repository-sqlite.js';
//   import { createDb } from './db.js';
//   const db  = createDb('./roguelike.db');
//   const app = createApp(new SqliteScoreRepository(db), new SqliteSaveRepository(db));
// ─────────────────────────────────────────────

import type { Db } from './db.js';
import type { ScoreRepository, SaveRepository } from './repository.js';
import type { ScoreInput, ScoreRow, SaveRow, SlotNumber } from './types.js';

// ── ScoreRepository ─────────────────────────────

export class SqliteScoreRepository implements ScoreRepository {
  constructor(private _db: Db) {}

  insert(input: ScoreInput): number {
    const stmt = this._db.prepare(`
      INSERT INTO scores (user_id, player_name, class_type, lv, floor, dungeon_id, gold, turn_count)
      VALUES (@user_id, @player_name, @class_type, @lv, @floor, @dungeon_id, @gold, @turn_count)
    `);
    const result = stmt.run(input);
    return Number(result.lastInsertRowid);
  }

  findAll(dungeonId: string | null, limit: number, offset: number): ScoreRow[] {
    if (dungeonId) {
      return this._db.prepare(`
        SELECT * FROM scores
        WHERE dungeon_id = ?
        ORDER BY lv DESC, floor DESC, gold DESC
        LIMIT ? OFFSET ?
      `).all(dungeonId, limit, offset) as ScoreRow[];
    }
    return this._db.prepare(`
      SELECT * FROM scores
      ORDER BY lv DESC, floor DESC, gold DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as ScoreRow[];
  }

  findByUser(userId: string): ScoreRow[] {
    return this._db.prepare(`
      SELECT * FROM scores
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId) as ScoreRow[];
  }
}

// ── SaveRepository ──────────────────────────────

export class SqliteSaveRepository implements SaveRepository {
  constructor(private _db: Db) {}

  findByUser(userId: string): SaveRow[] {
    return this._db.prepare(`
      SELECT * FROM saves WHERE user_id = ? ORDER BY slot
    `).all(userId) as SaveRow[];
  }

  upsert(userId: string, slot: SlotNumber, data: string): void {
    this._db.prepare(`
      INSERT INTO saves (user_id, slot, data, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, slot) DO UPDATE SET
        data       = excluded.data,
        updated_at = excluded.updated_at
    `).run(userId, slot, data);
  }

  delete(userId: string, slot: SlotNumber): void {
    this._db.prepare(`
      DELETE FROM saves WHERE user_id = ? AND slot = ?
    `).run(userId, slot);
  }
}
