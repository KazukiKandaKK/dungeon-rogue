import { describe, it, expect } from 'vitest';
import { Actor }     from '../../src/entities/actor.js';
import { TILE_SIZE } from '../../src/world/tiles.js';

function makeActor(tx = 3, ty = 4, maxHP = 10): Actor {
  return new Actor(tx, ty, maxHP);
}

describe('Actor', () => {

  describe('コンストラクタ', () => {
    it('タイル座標・HP を正しく初期化する', () => {
      const a = makeActor(3, 4, 20);
      expect(a.tx).toBe(3);
      expect(a.ty).toBe(4);
      expect(a.hp).toBe(20);
      expect(a.maxHP).toBe(20);
      expect(a.alive).toBe(true);
    });

    it('renderX/Y は (tx+0.5)*TILE_SIZE に初期化される', () => {
      const a = makeActor(2, 5, 10);
      expect(a.renderX).toBe((2 + 0.5) * TILE_SIZE);
      expect(a.renderY).toBe((5 + 0.5) * TILE_SIZE);
    });
  });

  describe('moveTo', () => {
    it('タイル座標と向きを更新する', () => {
      const a = makeActor(3, 3, 10);
      a.moveTo(5, 3);
      expect(a.tx).toBe(5);
      expect(a.ty).toBe(3);
      expect(a.dirX).toBe(2);  // 移動差分
      expect(a.dirY).toBe(0);
    });
  });

  describe('takeDamage', () => {
    it('ダメージを HP に反映する', () => {
      const a = makeActor(0, 0, 10);
      const result = a.takeDamage(3, 0, 0);
      expect(result).toBe(3);
      expect(a.hp).toBe(7);
      expect(a.alive).toBe(true);
    });

    it('HP が 0 になると alive = false になる', () => {
      const a = makeActor(0, 0, 5);
      a.takeDamage(5, 0, 0);
      expect(a.hp).toBe(0);
      expect(a.alive).toBe(false);
    });

    it('死亡後は 0 を返す', () => {
      const a = makeActor(0, 0, 5);
      a.takeDamage(5, 0, 0);
      const result = a.takeDamage(3, 0, 0);
      expect(result).toBe(0);
      expect(a.hp).toBe(0);
    });

    it('HP は 0 より下がらない（オーバーキル）', () => {
      const a = makeActor(0, 0, 5);
      a.takeDamage(100, 0, 0);
      expect(a.hp).toBe(0);
    });
  });

  describe('isAdjacentTo', () => {
    it('斜め含む1マス以内なら true', () => {
      const a = makeActor(5, 5, 10);
      const targets = [
        {tx: 4, ty: 4}, {tx: 5, ty: 4}, {tx: 6, ty: 4},
        {tx: 4, ty: 5}, {tx: 5, ty: 5}, {tx: 6, ty: 5},
        {tx: 4, ty: 6}, {tx: 5, ty: 6}, {tx: 6, ty: 6},
      ];
      for (const t of targets) {
        expect(a.isAdjacentTo(t), `${t.tx},${t.ty}`).toBe(true);
      }
    });

    it('2マス離れると false', () => {
      const a = makeActor(5, 5, 10);
      expect(a.isAdjacentTo({tx: 7, ty: 5})).toBe(false);
    });
  });

  describe('screenPos', () => {
    it('カメラオフセット込みで座標を返す', () => {
      const a = makeActor(2, 3, 10);
      const { sx, sy } = a.screenPos(100, 200);
      expect(sx).toBeCloseTo(a.renderX + a.bumpX + 100);
      expect(sy).toBeCloseTo(a.renderY + a.bumpY + 200);
    });
  });

});
