import { describe, it, expect } from 'vitest';
import {
  buildDefaultBaseInteractables,
  findInteractableNear,
  type BaseInteractable,
  type InteractKind,
} from '../../src/systems/base-interact.js';

describe('base-interact', () => {

  describe('buildDefaultBaseInteractables', () => {
    it('少なくとも5つのオブジェクトを返す', () => {
      const list = buildDefaultBaseInteractables();
      expect(list.length).toBeGreaterThanOrEqual(5);
    });

    it('全オブジェクトの座標は拠点外周壁の内側 1..34 × 1..26 に収まる', () => {
      const list = buildDefaultBaseInteractables();
      for (const it of list) {
        expect(it.tx).toBeGreaterThanOrEqual(1);
        expect(it.tx).toBeLessThanOrEqual(34);
        expect(it.ty).toBeGreaterThanOrEqual(1);
        expect(it.ty).toBeLessThanOrEqual(26);
      }
    });

    it('少なくとも2種類以上の kind が存在する（bench/brazier/...）', () => {
      const list = buildDefaultBaseInteractables();
      const kinds = new Set<InteractKind>(list.map(it => it.kind));
      expect(kinds.size).toBeGreaterThanOrEqual(2);
      // ベンチと焚き火は必須（プランの主要要素）
      expect(kinds.has('bench')).toBe(true);
      expect(kinds.has('brazier')).toBe(true);
    });

    it('噴水 (17,12)-(18,13) の内部には置かない', () => {
      const list = buildDefaultBaseInteractables();
      const onFountain = list.filter(it =>
        (it.tx === 17 || it.tx === 18) && (it.ty === 12 || it.ty === 13)
      );
      expect(onFountain).toHaveLength(0);
    });

    it('すべてのオブジェクトが label と flavor を持つ', () => {
      const list = buildDefaultBaseInteractables();
      for (const it of list) {
        expect(it.label.length).toBeGreaterThan(0);
        expect(it.flavor.length).toBeGreaterThan(0);
      }
    });
  });

  describe('findInteractableNear', () => {
    const list: BaseInteractable[] = [
      { tx:  5, ty:  5, kind: 'bench', label: 'A', flavor: ['a'] },
      { tx: 10, ty: 10, kind: 'well',  label: 'B', flavor: ['b'] },
    ];

    it('Manhattan 距離 1 以内にいれば見つける', () => {
      expect(findInteractableNear(list, 5, 6)?.tx).toBe(5); // 南隣
      expect(findInteractableNear(list, 6, 5)?.tx).toBe(5); // 東隣
      expect(findInteractableNear(list, 5, 5)?.tx).toBe(5); // 自身
    });

    it('距離 2 以上は見つけない', () => {
      expect(findInteractableNear(list, 5, 7)).toBeNull();
      expect(findInteractableNear(list, 0, 0)).toBeNull();
    });

    it('複数候補のうち最も近いものを返す', () => {
      // (5,6) は bench に距離 1、well には距離 9
      expect(findInteractableNear(list, 5, 6)?.kind).toBe('bench');
    });

    it('空リストなら null を返す', () => {
      expect(findInteractableNear([], 0, 0)).toBeNull();
    });
  });
});
