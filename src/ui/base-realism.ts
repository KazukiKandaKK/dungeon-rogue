// ─────────────────────────────────────────────
// base-realism.ts  決定論的ヘルパー（リアル化レイヤ用）
//
// 摩耗・ひび・苔・水たまりなど、座標から決定論的に派生する乱数を扱うため
// だけのモジュール。Canvas を一切参照しないので Node 環境でも import できる。
// 実描画は base-objects.ts 側に置く（Path2D 等を必要とするため）。
// ─────────────────────────────────────────────

'use strict';

/** 2 つの整数から 32bit ハッシュを作る。 */
export function hash2(x: number, y: number): number {
  return (((x | 0) * 73856093) ^ ((y | 0) * 19349663)) >>> 0;
}

/** 3 つの整数から 32bit ハッシュ（建物 seed × インデックスなどで使う）。 */
export function hash3(x: number, y: number, z: number): number {
  return (((x | 0) * 73856093) ^ ((y | 0) * 19349663) ^ ((z | 0) * 83492791)) >>> 0;
}

/**
 * mulberry32 ベースの決定論 PRNG。
 * `() => 0..1` の関数を返す。同じ seed なら同じ列が出る。
 */
export function seededRand(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
