import { describe, it, expect } from 'vitest';
import { hash2, hash3, seededRand } from '../../src/ui/base-realism.js';

// ─────────────────────────────────────────────
// 街並みリアル化レイヤのスモークテスト。
// 描画関数自体は Canvas (Path2D) に依存するため Node では import できない。
// ここでは Canvas に依存しない決定論ヘルパーだけ検証する。
// ─────────────────────────────────────────────

describe('hash2 / hash3', () => {
  it('同じ入力に対して常に同じ値を返す（決定論的）', () => {
    expect(hash2(3, 7)).toBe(hash2(3, 7));
    expect(hash2(0, 0)).toBe(hash2(0, 0));
    expect(hash3(5, 10, 15)).toBe(hash3(5, 10, 15));
  });

  it('異なる入力ではほぼ別の値を返す', () => {
    const a = hash2(1, 2);
    const b = hash2(2, 1);
    const c = hash2(1, 3);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  it('結果は 32bit unsigned int の範囲に収まる', () => {
    for (const [x, y] of [[0, 0], [-100, 100], [1000, 999]]) {
      const h = hash2(x, y);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(0x100000000);
      expect(Number.isInteger(h)).toBe(true);
    }
  });
});

describe('seededRand', () => {
  it('同じ seed なら同じ列を返す（再現性）', () => {
    const a = seededRand(42);
    const b = seededRand(42);
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b());
    }
  });

  it('値はすべて 0..1 の範囲に収まる', () => {
    const r = seededRand(99);
    for (let i = 0; i < 200; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('seed=0 でもクラッシュせず連続する乱数列を返す', () => {
    const r = seededRand(0);
    const v1 = r();
    const v2 = r();
    expect(v1).toBeGreaterThanOrEqual(0);
    expect(v2).toBeGreaterThanOrEqual(0);
    // 0 連発にならないこと
    expect(v1 === 0 && v2 === 0).toBe(false);
  });
});
