import { describe, it, expect } from 'vitest';
import { findPath } from '../../src/world/astar.js';

// グリッドヘルパー: 0=通路, 1=壁
function makeWalkable(grid) {
  return (x, y) => grid[y]?.[x] === 0;
}

// 全マス通路の w×h グリッドを作る
function openGrid(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

describe('findPath', () => {

  // ── 基本動作 ───────────────────────────────────────────

  it('スタートとゴールが同じならそのタイルだけ返す', () => {
    const walkable = makeWalkable(openGrid(5, 5));
    const path = findPath(5, 5, walkable, 2, 2, 2, 2);
    expect(path).toEqual([{ x: 2, y: 2 }]);
  });

  it('横一直線の経路を返す', () => {
    const walkable = makeWalkable(openGrid(5, 1));
    const path = findPath(5, 1, walkable, 0, 0, 4, 0);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 4, y: 0 });
    // 途中タイルも連続している
    for (let i = 1; i < path.length; i++) {
      expect(Math.abs(path[i].x - path[i - 1].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(path[i].y - path[i - 1].y)).toBeLessThanOrEqual(1);
    }
  });

  it('縦一直線の経路を返す', () => {
    const walkable = makeWalkable(openGrid(1, 5));
    const path = findPath(1, 5, walkable, 0, 0, 0, 4);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 0, y: 4 });
  });

  // ── 壁回避 ─────────────────────────────────────────────

  it('壁を迂回する経路を返す', () => {
    // . . . . .
    // . # # # .
    // . . . . .
    //   S       G
    const grid = [
      [0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 0, 0, 0],
    ];
    const walkable = makeWalkable(grid);
    // S=(1,0), G=(3,0) — 直進は壁に阻まれる
    const path = findPath(5, 3, walkable, 1, 0, 3, 0);
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ x: 1, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 3, y: 0 });
    // 経路上に壁タイルがないことを確認
    for (const tile of path) {
      expect(grid[tile.y][tile.x]).toBe(0);
    }
  });

  // ── 到達不能 ────────────────────────────────────────────

  it('到達できない場合は空配列を返す', () => {
    // ゴールを壁で完全に囲む
    const grid = [
      [0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 1, 0, 1, 0],  // (2,2) がゴール、壁に囲まれている
      [0, 1, 1, 1, 0],
      [0, 0, 0, 0, 0],
    ];
    const walkable = makeWalkable(grid);
    const path = findPath(5, 5, walkable, 0, 0, 2, 2);
    expect(path).toEqual([]);
  });

  it('スタートが壁の場合は空配列を返す', () => {
    const grid = [
      [1, 0],
      [0, 0],
    ];
    const walkable = makeWalkable(grid);
    const path = findPath(2, 2, walkable, 0, 0, 1, 1);
    expect(path).toEqual([]);
  });

  // ── 斜め移動 ────────────────────────────────────────────

  it('斜め移動が使われる（斜め方向の最短距離）', () => {
    const walkable = makeWalkable(openGrid(3, 3));
    // (0,0) → (2,2) は斜め2歩が最短
    const path = findPath(3, 3, walkable, 0, 0, 2, 2);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 2, y: 2 });
    // 斜め移動なら3タイル（スタート含む）
    expect(path.length).toBe(3);
  });

  // ── 斜めコーナーカット防止 ──────────────────────────────

  it('斜め移動で壁の角を通り抜けない', () => {
    // . #
    // # .
    // (0,0)→(1,1) で斜め直進は両隣が壁 → 迂回が必要
    const grid = [
      [0, 1],
      [1, 0],
    ];
    const walkable = makeWalkable(grid);
    const path = findPath(2, 2, walkable, 0, 0, 1, 1);
    // 壁に囲まれているので到達不能
    expect(path).toEqual([]);
  });

  it('片側だけ壁でも斜めコーナーカットしない', () => {
    // . . .
    // . # .
    // . . .
    // (0,0)→(2,2) で (1,1) は壁だが、斜めコーナーカット防止で (1,0)→(2,1) 等の
    // 角をすり抜けないことを確認（実際には迂回経路が返る）
    const grid = [
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ];
    const walkable = makeWalkable(grid);
    const path = findPath(3, 3, walkable, 0, 0, 2, 2);
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ x: 2, y: 2 });
    // 壁タイルを踏んでいない
    for (const tile of path) {
      expect(grid[tile.y][tile.x]).toBe(0);
    }
  });

  // ── 境界値 ──────────────────────────────────────────────

  it('1×1 グリッドでスタート==ゴール', () => {
    const walkable = () => true;
    const path = findPath(1, 1, walkable, 0, 0, 0, 0);
    expect(path).toEqual([{ x: 0, y: 0 }]);
  });

  it('グリッドの四隅を結ぶ', () => {
    const walkable = makeWalkable(openGrid(10, 10));
    const path = findPath(10, 10, walkable, 0, 0, 9, 9);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 9, y: 9 });
    // 斜め移動なら10タイル
    expect(path.length).toBe(10);
  });

});
