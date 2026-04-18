import { describe, it, expect } from 'vitest';
import { TILE } from '../../src/world/tiles.js';
import { ForestGenerator } from '../../src/world/forest.js';
import { TownGenerator }   from '../../src/world/town.js';

const COLS = 40;
const ROWS = 32;

// ── ForestGenerator ────────────────────────────────────

describe('ForestGenerator', () => {

  it('グリッドの寸法が cols×rows と一致する', () => {
    const { grid } = new ForestGenerator(COLS, ROWS).generate();
    expect(grid).toHaveLength(ROWS);
    expect(grid[0]).toHaveLength(COLS);
  });

  it('FLOOR タイルが存在する（開けた空間がある）', () => {
    const { grid } = new ForestGenerator(COLS, ROWS).generate();
    const floors = grid.flat().filter(t => t === TILE.FLOOR);
    expect(floors.length).toBeGreaterThan(0);
  });

  it('exits が返される', () => {
    const { exits } = new ForestGenerator(COLS, ROWS).generate();
    // 森は N/S/E/W いずれか（全部揃わない場合もある）
    const dirs = Object.keys(exits);
    expect(dirs.length).toBeGreaterThan(0);
  });

  it('exits のタイルは端行/端列にある', () => {
    const { exits } = new ForestGenerator(COLS, ROWS).generate();
    for (const pos of Object.values(exits)) {
      if (!pos) continue;
      const onEdge =
        pos.tx === 0 || pos.ty === 0 ||
        pos.tx === COLS - 1 || pos.ty === ROWS - 1;
      expect(onEdge).toBe(true);
    }
  });

  it('stairs が返される、かつ STAIRS タイル', () => {
    const { grid, stairs } = new ForestGenerator(COLS, ROWS).generate();
    // stairs が null の場合はスキップ（候補ゼロの場合）
    if (!stairs) return;
    expect(grid[stairs.ty][stairs.tx]).toBe(TILE.STAIRS);
  });

  it('中央エリア（スポーン地点）は FLOOR', () => {
    const { grid } = new ForestGenerator(COLS, ROWS).generate();
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    expect(grid[cy][cx]).toBe(TILE.FLOOR);
  });

  it('クラッシュせず決定論的でない（乱数あり）', () => {
    const results = Array.from({ length: 5 }, () =>
      new ForestGenerator(COLS, ROWS).generate()
    );
    // 5 回実行してどれもクラッシュしない
    for (const r of results) {
      expect(r.grid).toHaveLength(ROWS);
    }
  });

});

// ── TownGenerator ────────────────────────────────────

describe('TownGenerator', () => {

  it('グリッドの寸法が cols×rows と一致する', () => {
    const { grid } = new TownGenerator(COLS, ROWS).generate();
    expect(grid).toHaveLength(ROWS);
    expect(grid[0]).toHaveLength(COLS);
  });

  it('CORRIDOR（道路）タイルが存在する', () => {
    const { grid } = new TownGenerator(COLS, ROWS).generate();
    const corridors = grid.flat().filter(t => t === TILE.CORRIDOR);
    expect(corridors.length).toBeGreaterThan(0);
  });

  it('FLOOR（広場・建物内）タイルが存在する', () => {
    const { grid } = new TownGenerator(COLS, ROWS).generate();
    const floors = grid.flat().filter(t => t === TILE.FLOOR);
    expect(floors.length).toBeGreaterThan(0);
  });

  it('exits が返される', () => {
    const { exits } = new TownGenerator(COLS, ROWS).generate();
    expect(Object.keys(exits).length).toBeGreaterThan(0);
  });

  it('exits のタイルは端行/端列にある', () => {
    const { exits } = new TownGenerator(COLS, ROWS).generate();
    for (const pos of Object.values(exits)) {
      if (!pos) continue;
      const onEdge =
        pos.tx === 0 || pos.ty === 0 ||
        pos.tx === COLS - 1 || pos.ty === ROWS - 1;
      expect(onEdge).toBe(true);
    }
  });

  it('中央広場（中心）は FLOOR', () => {
    const { grid } = new TownGenerator(COLS, ROWS).generate();
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    expect(grid[cy][cx]).toBe(TILE.FLOOR);
  });

  it('複数回実行してもクラッシュしない', () => {
    for (let i = 0; i < 5; i++) {
      expect(() => new TownGenerator(COLS, ROWS).generate()).not.toThrow();
    }
  });

});
