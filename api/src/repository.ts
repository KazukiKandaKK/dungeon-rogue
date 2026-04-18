// ─────────────────────────────────────────────
// repository.ts  Repository インターフェース + インメモリ実装
//
// テストは MemoryRepository を使用。
// 本番は SqliteRepository（better-sqlite3 + Node.js LTS）に差し替え。
// ─────────────────────────────────────────────

import type { ScoreInput, ScoreRow, SaveRow, SlotNumber } from './types.js';

// ── Repository インターフェース（抽象）────────────

export interface ScoreRepository {
  insert(input: ScoreInput): number;
  findAll(dungeonId: string | null, limit: number, offset: number): ScoreRow[];
  findByUser(userId: string): ScoreRow[];
}

export interface SaveRepository {
  findByUser(userId: string): SaveRow[];
  upsert(userId: string, slot: SlotNumber, data: string): void;
  delete(userId: string, slot: SlotNumber): void;
}

// ── インメモリ実装（テスト・開発用）──────────────────

export class MemoryScoreRepository implements ScoreRepository {
  private _rows: ScoreRow[] = [];
  private _nextId = 1;

  insert(input: ScoreInput): number {
    const id = this._nextId++;
    this._rows.push({
      ...input,
      id,
      created_at: new Date().toISOString(),
    });
    return id;
  }

  findAll(dungeonId: string | null, limit: number, offset: number): ScoreRow[] {
    let rows = dungeonId
      ? this._rows.filter(r => r.dungeon_id === dungeonId)
      : [...this._rows];

    rows.sort((a, b) =>
      b.lv - a.lv || b.floor - a.floor || b.gold - a.gold
    );
    return rows.slice(offset, offset + limit);
  }

  findByUser(userId: string): ScoreRow[] {
    return this._rows
      .filter(r => r.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 50);
  }
}

export class MemorySaveRepository implements SaveRepository {
  /** key: `${userId}:${slot}` */
  private _rows: Map<string, SaveRow> = new Map();
  private _nextId = 1;

  private _key(userId: string, slot: SlotNumber): string {
    return `${userId}:${slot}`;
  }

  findByUser(userId: string): SaveRow[] {
    return [...this._rows.values()].filter(r => r.user_id === userId);
  }

  upsert(userId: string, slot: SlotNumber, data: string): void {
    const key      = this._key(userId, slot);
    const existing = this._rows.get(key);
    this._rows.set(key, {
      id:         existing?.id ?? this._nextId++,
      user_id:    userId,
      slot,
      data,
      updated_at: new Date().toISOString(),
    });
  }

  delete(userId: string, slot: SlotNumber): void {
    this._rows.delete(this._key(userId, slot));
  }
}
