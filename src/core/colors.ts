// ─────────────────────────────────────────────
// colors.ts  カラーユーティリティ（純粋関数）
// ─────────────────────────────────────────────

export interface Rgb { r: number; g: number; b: number; }

/** "#rrggbb" → Rgb オブジェクト（パース失敗時は null） */
export function hexRgb(hex: string): Rgb | null {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : null;
}

/**
 * 色を明るくする
 * @param hex   "#rrggbb" 形式
 * @param amount 0〜1 の割合（255 × amount を加算）
 */
export function lightenColor(hex: string, amount: number): string {
  const c = hexRgb(hex);
  if (!c) return hex;
  return `rgb(${Math.min(255, (c.r + 255 * amount) | 0)},${Math.min(255, (c.g + 255 * amount) | 0)},${Math.min(255, (c.b + 255 * amount) | 0)})`;
}

/**
 * 色を暗くする
 * @param hex   "#rrggbb" 形式
 * @param amount 0〜1 の割合（255 × amount を減算）
 */
export function darkenColor(hex: string, amount: number): string {
  const c = hexRgb(hex);
  if (!c) return hex;
  return `rgb(${Math.max(0, (c.r - 255 * amount) | 0)},${Math.max(0, (c.g - 255 * amount) | 0)},${Math.max(0, (c.b - 255 * amount) | 0)})`;
}
