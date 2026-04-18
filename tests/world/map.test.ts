import { describe, it, expect } from 'vitest';
import { GameMap } from '../../src/world/map.js';
import { TILE }    from '../../src/world/tiles.js';

const COLS = 40;
const ROWS = 32;

describe('GameMap', () => {

  describe('コンストラクタ・基本プロパティ', () => {
    it('dungeon テーマで生成できる', () => {
      const m = new GameMap(COLS, ROWS, 'dungeon');
      expect(m.cols).toBe(COLS);
      expect(m.rows).toBe(ROWS);
      expect(m.theme).toBe('dungeon');
      expect(m.grid).toHaveLength(ROWS);
      expect(m.grid[0]).toHaveLength(COLS);
    });

    it('forest テーマで生成できる', () => {
      const m = new GameMap(COLS, ROWS, 'forest');
      expect(m.theme).toBe('forest');
      expect(m.grid).toHaveLength(ROWS);
    });

    it('town テーマで生成できる', () => {
      const m = new GameMap(COLS, ROWS, 'town');
      expect(m.theme).toBe('town');
      expect(m.grid).toHaveLength(ROWS);
    });

    it('base テーマで生成できる', () => {
      const m = new GameMap(16, 12, 'base');
      expect(m.theme).toBe('base');
      expect(m.grid).toHaveLength(12);
      expect(m.grid[0]).toHaveLength(16);
    });

    it('bossArena=true で生成できる', () => {
      const m = new GameMap(COLS, ROWS, 'dungeon', true);
      expect(m.bossArena).toBe(true);
      expect(m.exits.N).toBeDefined();
      expect(m.exits.S).toBeDefined();
    });

    it('tileSize は 96', () => {
      const m = new GameMap(COLS, ROWS);
      expect(m.tileSize).toBe(96);
    });

    it('revealedTraps は空の Set', () => {
      const m = new GameMap(COLS, ROWS);
      expect(m.revealedTraps.size).toBe(0);
    });
  });

  describe('isWalkable', () => {
    it('境界外は false', () => {
      const m = new GameMap(COLS, ROWS);
      expect(m.isWalkable(-1, 0)).toBe(false);
      expect(m.isWalkable(0, -1)).toBe(false);
      expect(m.isWalkable(COLS, 0)).toBe(false);
      expect(m.isWalkable(0, ROWS)).toBe(false);
    });

    it('外周（壁）は false', () => {
      const m = new GameMap(COLS, ROWS, 'dungeon');
      expect(m.isWalkable(0, 0)).toBe(false);
      expect(m.isWalkable(COLS - 1, ROWS - 1)).toBe(false);
    });

    it('STAIRS タイルは true', () => {
      const m = new GameMap(COLS, ROWS, 'dungeon');
      if (!m.stairs) return; // 稀に null
      expect(m.isWalkable(m.stairs.tx, m.stairs.ty)).toBe(true);
    });
  });

  describe('isStairs', () => {
    it('stairs 座標で true を返す', () => {
      const m = new GameMap(COLS, ROWS, 'dungeon');
      if (!m.stairs) return;
      expect(m.isStairs(m.stairs.tx, m.stairs.ty)).toBe(true);
    });

    it('stairs 以外の座標で false を返す', () => {
      const m = new GameMap(COLS, ROWS, 'dungeon');
      if (!m.stairs) return;
      expect(m.isStairs(m.stairs.tx + 1, m.stairs.ty)).toBe(false);
    });

    it('stairs が null のとき常に false', () => {
      const m = new GameMap(COLS, ROWS, 'dungeon', true); // BossArena: stairs=null
      expect(m.isStairs(0, 0)).toBe(false);
    });
  });

  describe('getExitDir', () => {
    it('BossArena の N 出口座標で "N" を返す', () => {
      const m = new GameMap(COLS, ROWS, 'dungeon', true);
      const n = m.exits.N;
      if (!n) return;
      expect(m.getExitDir(n.tx, n.ty)).toBe('N');
    });

    it('出口でない座標で null を返す', () => {
      const m = new GameMap(COLS, ROWS, 'dungeon', true);
      const cx = Math.floor(COLS / 2);
      const cy = Math.floor(ROWS / 2);
      // 中央は出口ではないはず
      expect(m.getExitDir(cx, cy)).toBeNull();
    });
  });

  describe('findSpawnTile', () => {
    it('歩行可能なタイルを返す', () => {
      const m = new GameMap(COLS, ROWS, 'dungeon');
      const { tx, ty } = m.findSpawnTile();
      expect(m.isWalkable(tx, ty)).toBe(true);
    });

    it('境界付近（5マス以内）を避ける', () => {
      const m = new GameMap(COLS, ROWS, 'dungeon');
      const { tx, ty } = m.findSpawnTile();
      expect(tx).toBeGreaterThanOrEqual(5);
      expect(ty).toBeGreaterThanOrEqual(5);
      expect(tx).toBeLessThan(COLS - 5);
      expect(ty).toBeLessThan(ROWS - 5);
    });

    it('TRAP タイルでない', () => {
      const m = new GameMap(COLS, ROWS, 'dungeon');
      const { tx, ty } = m.findSpawnTile();
      expect(m.grid[ty][tx]).not.toBe(TILE.TRAP);
    });

    it('WATER タイルでない', () => {
      const m = new GameMap(COLS, ROWS, 'dungeon');
      const { tx, ty } = m.findSpawnTile();
      expect(m.grid[ty][tx]).not.toBe(TILE.WATER);
    });
  });

  describe('getActorAt', () => {
    it('一致する alive アクターを返す', () => {
      const m = new GameMap(COLS, ROWS);
      const actors = [
        { alive: true,  tx: 3, ty: 4 },
        { alive: false, tx: 5, ty: 6 },
      ];
      expect(m.getActorAt(3, 4, actors)).toBe(actors[0]);
    });

    it('alive=false のアクターは無視する', () => {
      const m = new GameMap(COLS, ROWS);
      const actors = [{ alive: false, tx: 5, ty: 6 }];
      expect(m.getActorAt(5, 6, actors)).toBeNull();
    });

    it('存在しない座標で null を返す', () => {
      const m = new GameMap(COLS, ROWS);
      expect(m.getActorAt(99, 99, [])).toBeNull();
    });
  });

});
