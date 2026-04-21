import { describe, it, expect } from 'vitest';
import { TILE, TILE_DEF, ALL_TILE_IDS, THEMES, THEME_IDS, TILE_SIZE } from '../../src/world/tiles.js';

describe('tiles', () => {

  describe('TILE 定数', () => {
    it('FLOOR=0 から MAGMA=8 まで 9 種類ある', () => {
      expect(Object.values(TILE)).toHaveLength(9);
      expect(TILE.FLOOR).toBe(0);
      expect(TILE.WATER).toBe(6);
      expect(TILE.MAGMA).toBe(8);
    });

    it('ALL_TILE_IDS が TILE の全値を含む', () => {
      const vals = Object.values(TILE);
      expect(ALL_TILE_IDS).toHaveLength(vals.length);
      for (const v of vals) expect(ALL_TILE_IDS).toContain(v);
    });
  });

  describe('TILE_DEF', () => {
    it('全タイルに label・color・walkable・weight・allowedNeighbors がある', () => {
      for (const id of ALL_TILE_IDS) {
        const def = TILE_DEF[id];
        expect(def.label).toBeTruthy();
        expect(def.color).toMatch(/^#/);
        expect(typeof def.walkable).toBe('boolean');
        expect(def.weight).toBeGreaterThan(0);
        expect(Array.isArray(def.allowedNeighbors)).toBe(true);
      }
    });

    it('FLOOR・CORRIDOR・STAIRS・TRAP・WATER は歩行可能', () => {
      for (const id of [TILE.FLOOR, TILE.CORRIDOR, TILE.STAIRS, TILE.TRAP, TILE.WATER]) {
        expect(TILE_DEF[id].walkable).toBe(true);
      }
    });

    it('WALL・PILLAR は歩行不可', () => {
      for (const id of [TILE.WALL, TILE.PILLAR]) {
        expect(TILE_DEF[id].walkable).toBe(false);
      }
    });

    it('allowedNeighbors の値は有効な TileType のみ', () => {
      for (const id of ALL_TILE_IDS) {
        for (const n of TILE_DEF[id].allowedNeighbors) {
          expect(ALL_TILE_IDS).toContain(n);
        }
      }
    });
  });

  describe('THEMES', () => {
    it('THEME_IDS の全テーマが THEMES に存在する', () => {
      for (const id of THEME_IDS) {
        expect(THEMES[id]).toBeDefined();
      }
    });

    it('各テーマに bg・label・wall・floor・corridor がある', () => {
      for (const id of THEME_IDS) {
        const t = THEMES[id];
        expect(t.bg).toMatch(/^#/);
        expect(t.label).toBeTruthy();
        expect(t.wall.base).toBeTruthy();
        expect(t.floor.base).toBeTruthy();
        expect(t.corridor.base).toBeTruthy();
      }
    });
  });

  describe('TILE_SIZE', () => {
    it('96 である', () => {
      expect(TILE_SIZE).toBe(96);
    });
  });

});
