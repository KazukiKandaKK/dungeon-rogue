import { describe, it, expect } from 'vitest';
import {
  createAmbientCreatures,
  updateAmbientCreatures,
  type AmbientCreature,
} from '../../src/ui/ambient-creatures.js';

// ─────────────────────────────────────────────
// 街並みリアル化 Part2（街の生活感）のスモークテスト。
// 描画は Canvas に依存するためここでは検証しない。
// 小動物プールの初期化・徘徊更新ロジック・夜間停止だけを Node 上で確認する。
// ─────────────────────────────────────────────

const COLS = 36;
const ROWS = 28;

function buildMap(): { isWalkable: (tx: number, ty: number) => boolean } {
  // 36×28 の単純グリッド：外周だけ壁、噴水 (17,12)-(18,13) も壁。
  const fountain = new Set(['17,12','18,12','17,13','18,13']);
  return {
    isWalkable: (tx: number, ty: number): boolean => {
      if (tx <= 0 || ty <= 0 || tx >= COLS - 1 || ty >= ROWS - 1) return false;
      if (fountain.has(`${tx},${ty}`)) return false;
      return true;
    },
  };
}

describe('createAmbientCreatures', () => {
  it('歩行可能タイルだけにプールを生成する', () => {
    const m = buildMap();
    const list = createAmbientCreatures(m.isWalkable, COLS, ROWS);
    expect(list.length).toBeGreaterThanOrEqual(6);
    expect(list.length).toBeLessThanOrEqual(10);
    for (const c of list) {
      expect(m.isWalkable(c.tx, c.ty)).toBe(true);
    }
  });

  it('種別は chicken / cat / dog / mouse のいずれか', () => {
    const m = buildMap();
    const list = createAmbientCreatures(m.isWalkable, COLS, ROWS);
    const allowed = new Set(['chicken', 'cat', 'dog', 'mouse']);
    for (const c of list) {
      expect(allowed.has(c.kind)).toBe(true);
    }
  });

  it('複数回呼んでも初期座標は同じ（決定論的な配置）', () => {
    const m = buildMap();
    const a = createAmbientCreatures(m.isWalkable, COLS, ROWS);
    const b = createAmbientCreatures(m.isWalkable, COLS, ROWS);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].tx).toBe(b[i].tx);
      expect(a[i].ty).toBe(b[i].ty);
      expect(a[i].kind).toBe(b[i].kind);
    }
  });
});

describe('updateAmbientCreatures', () => {
  it('更新を回しても全個体が歩行可能タイル上に留まる', () => {
    const m = buildMap();
    const list = createAmbientCreatures(m.isWalkable, COLS, ROWS);
    // nextActAt を全部0に下げてすぐ動けるようにする
    for (const c of list) c.nextActAt = 0;
    for (let step = 0; step < 60; step++) {
      updateAmbientCreatures(list, 1 / 30, m.isWalkable, COLS, ROWS, 0);
    }
    for (const c of list) {
      expect(m.isWalkable(c.tx, c.ty)).toBe(true);
      expect(c.tx).toBeGreaterThanOrEqual(1);
      expect(c.ty).toBeGreaterThanOrEqual(1);
      expect(c.tx).toBeLessThan(COLS - 1);
      expect(c.ty).toBeLessThan(ROWS - 1);
    }
  });

  it('夜間（nightFactor>0.5）は移動しない', () => {
    const m = buildMap();
    const list = createAmbientCreatures(m.isWalkable, COLS, ROWS);
    const before = list.map(c => ({ tx: c.tx, ty: c.ty }));
    for (const c of list) c.nextActAt = 0;
    for (let step = 0; step < 60; step++) {
      updateAmbientCreatures(list, 1 / 30, m.isWalkable, COLS, ROWS, /*night*/ 0.9);
    }
    for (let i = 0; i < list.length; i++) {
      expect(list[i].tx).toBe(before[i].tx);
      expect(list[i].ty).toBe(before[i].ty);
    }
  });

  it('moveT は更新で 1 を超えない', () => {
    const m = buildMap();
    const list = createAmbientCreatures(m.isWalkable, COLS, ROWS);
    for (const c of list) c.nextActAt = 0;
    for (let step = 0; step < 30; step++) {
      updateAmbientCreatures(list, 1 / 30, m.isWalkable, COLS, ROWS, 0);
      for (const c of list) {
        expect(c.moveT).toBeGreaterThanOrEqual(0);
        expect(c.moveT).toBeLessThanOrEqual(1);
      }
    }
  });

  it('壁だけのマップでは新規移動が起きない（クラッシュもしない）', () => {
    const isWalkable = (_tx: number, _ty: number): boolean => false;
    // 既存プールは createAmbientCreatures が拒否するので、
    // 手動で 1 体組んで「動けない」ことだけ確認する
    const list: AmbientCreature[] = [{
      kind: 'cat', tx: 5, ty: 5, fromTx: 5, fromTy: 5,
      moveT: 1, nextActAt: 0, phaseT: 0, facingDir: 1,
    }];
    for (let step = 0; step < 10; step++) {
      updateAmbientCreatures(list, 1 / 30, isWalkable, COLS, ROWS, 0);
    }
    expect(list[0].tx).toBe(5);
    expect(list[0].ty).toBe(5);
  });
});
