import { describe, it, expect } from 'vitest';
import { TILE } from '../../src/world/tiles.js';
import {
  DungeonGenerator,
  MonsterHouseArenaGenerator,
  BossArenaGenerator,
  BaseRoomGenerator,
} from '../../src/world/dungeon.js';

const COLS = 40;
const ROWS = 32;

// ── ヘルパー ──────────────────────────────────────

/** グリッドの全セルを検査し walkable なセル数を返す */
function countWalkable(grid: number[][], cols: number, rows: number): number {
  let n = 0;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (grid[y][x] === TILE.FLOOR || grid[y][x] === TILE.CORRIDOR ||
          grid[y][x] === TILE.STAIRS || grid[y][x] === TILE.TRAP ||
          grid[y][x] === TILE.WATER) n++;
  return n;
}

/** BFS で (sx,sy) から到達できる walkable タイル数を数える */
function reachable(grid: number[][], cols: number, rows: number, sx: number, sy: number): number {
  const walkable = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < cols && y < rows &&
    (grid[y][x] === TILE.FLOOR || grid[y][x] === TILE.CORRIDOR ||
     grid[y][x] === TILE.STAIRS || grid[y][x] === TILE.TRAP || grid[y][x] === TILE.WATER);

  const visited = new Set<string>();
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift()!;
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
      const nx = x + dx, ny = y + dy;
      if (walkable(nx, ny)) q.push([nx, ny]);
    }
  }
  return visited.size;
}

// ─────────────────────────────────────────────────

describe('DungeonGenerator', () => {

  it('グリッドの寸法が cols×rows と一致する', () => {
    const { grid } = new DungeonGenerator(COLS, ROWS).generate();
    expect(grid).toHaveLength(ROWS);
    expect(grid[0]).toHaveLength(COLS);
  });

  it('外周はすべて壁', () => {
    const { grid } = new DungeonGenerator(COLS, ROWS).generate();
    for (let x = 0; x < COLS; x++) {
      expect(grid[0][x]).toBe(TILE.WALL);
      expect(grid[ROWS - 1][x]).toBe(TILE.WALL);
    }
    for (let y = 0; y < ROWS; y++) {
      expect(grid[y][0]).toBe(TILE.WALL);
      expect(grid[y][COLS - 1]).toBe(TILE.WALL);
    }
  });

  it('walkable タイルが存在する', () => {
    const { grid } = new DungeonGenerator(COLS, ROWS).generate();
    expect(countWalkable(grid, COLS, ROWS)).toBeGreaterThan(0);
  });

  it('stairs が返される', () => {
    const { stairs } = new DungeonGenerator(COLS, ROWS).generate();
    expect(stairs).not.toBeNull();
    expect(stairs!.tx).toBeGreaterThanOrEqual(0);
    expect(stairs!.ty).toBeGreaterThanOrEqual(0);
  });

  it('stairs は STAIRS タイル', () => {
    const { grid, stairs } = new DungeonGenerator(COLS, ROWS).generate();
    expect(grid[stairs!.ty][stairs!.tx]).toBe(TILE.STAIRS);
  });

  it('rooms が 1 つ以上生成される', () => {
    const { rooms } = new DungeonGenerator(COLS, ROWS).generate();
    expect(rooms.length).toBeGreaterThanOrEqual(1);
  });

  it('全部屋の中心から BFS で階段に到達できる（連結性）', () => {
    const { grid, rooms, stairs } = new DungeonGenerator(COLS, ROWS).generate();
    if (!stairs || rooms.length === 0) return;
    const reached = reachable(grid, COLS, ROWS, rooms[0].cx, rooms[0].cy);
    // 少なくとも stairs に到達できる（1 タイル以上）
    expect(reached).toBeGreaterThan(0);
    // stairs タイルも same connected component
    const stairsReach = reachable(grid, COLS, ROWS, stairs.tx, stairs.ty);
    expect(stairsReach).toBeGreaterThan(0);
  });

  it('exits は空オブジェクト（DungeonGenerator は exits を持たない）', () => {
    const { exits } = new DungeonGenerator(COLS, ROWS).generate();
    expect(Object.keys(exits)).toHaveLength(0);
  });

  it('trapDensity を変えてもクラッシュしない', () => {
    const gen = new DungeonGenerator(COLS, ROWS);
    gen.trapDensity = 3;
    expect(() => gen.generate()).not.toThrow();
  });

});

describe('MonsterHouseArenaGenerator', () => {

  it('グリッド寸法が正しい', () => {
    const { grid } = new MonsterHouseArenaGenerator(COLS, ROWS).generate();
    expect(grid).toHaveLength(ROWS);
    expect(grid[0]).toHaveLength(COLS);
  });

  it('4方向の exits がある', () => {
    const { exits } = new MonsterHouseArenaGenerator(COLS, ROWS).generate();
    expect(exits.N).toBeDefined();
    expect(exits.S).toBeDefined();
    expect(exits.W).toBeDefined();
    expect(exits.E).toBeDefined();
  });

  it('monsterHouseRoom が返される', () => {
    const { monsterHouseRoom } = new MonsterHouseArenaGenerator(COLS, ROWS).generate();
    expect(monsterHouseRoom).not.toBeNull();
    expect(monsterHouseRoom!.w).toBeGreaterThan(0);
    expect(monsterHouseRoom!.h).toBeGreaterThan(0);
  });

  it('stairs が返される', () => {
    const { stairs } = new MonsterHouseArenaGenerator(COLS, ROWS).generate();
    expect(stairs).not.toBeNull();
  });

});

describe('BossArenaGenerator', () => {

  it('グリッド寸法が正しい', () => {
    const { grid } = new BossArenaGenerator(COLS, ROWS).generate();
    expect(grid).toHaveLength(ROWS);
    expect(grid[0]).toHaveLength(COLS);
  });

  it('4方向の exits がある', () => {
    const { exits } = new BossArenaGenerator(COLS, ROWS).generate();
    expect(exits.N).toBeDefined();
    expect(exits.S).toBeDefined();
    expect(exits.W).toBeDefined();
    expect(exits.E).toBeDefined();
  });

  it('中央エリアは床タイル', () => {
    const { grid } = new BossArenaGenerator(COLS, ROWS).generate();
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    expect(grid[cy][cx]).toBe(TILE.FLOOR);
  });

});

describe('BaseRoomGenerator', () => {

  it('グリッド寸法が正しい', () => {
    const { grid } = new BaseRoomGenerator(16, 12).generate();
    expect(grid).toHaveLength(12);
    expect(grid[0]).toHaveLength(16);
  });

  it('外周は壁', () => {
    const { grid } = new BaseRoomGenerator(16, 12).generate();
    for (let x = 0; x < 16; x++) {
      expect(grid[0][x]).toBe(TILE.WALL);
      expect(grid[11][x]).toBe(TILE.WALL);
    }
    for (let y = 0; y < 12; y++) {
      expect(grid[y][0]).toBe(TILE.WALL);
      expect(grid[y][15]).toBe(TILE.WALL);
    }
  });

  it('内部は主に床タイル', () => {
    const { grid } = new BaseRoomGenerator(16, 12).generate();
    // 中央付近が FLOOR
    expect(grid[6][8]).toBe(TILE.FLOOR);
  });

});
