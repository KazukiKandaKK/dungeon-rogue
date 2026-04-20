// ─────────────────────────────────────────────
// types.ts  プロジェクト共通の型定義
// ─────────────────────────────────────────────

/** タイル座標 */
export interface TilePos {
  tx: number;
  ty: number;
}

/**
 * ステータス異常エントリ
 * Player / Enemy の statusEffects 配列に格納される
 */
export interface StatusEffectEntry {
  type:        string;
  turns?:      number;      // 敵側（残りターン数）
  turnsLeft?:  number;      // プレイヤー側（残りターン数）
  power?:      number;
  defPenalty?: number;      // berserk の DEF 減少量
}

/**
 * マップの最低限インターフェース（魔法解決等で使用）
 */
export interface MapGrid {
  isWalkable(x: number, y: number): boolean;
  /** タイル ID 取得（省略可）— WATER 連鎖など拡張ロジック向け */
  grid?: number[][];
  cols?: number;
  rows?: number;
}

/**
 * ゲームマップのフルインターフェース（エンティティ移動・A* で使用）
 */
export interface GameMap extends MapGrid {
  tileSize: number;
  cols:     number;
  rows:     number;
}

/**
 * スプライトマネージャの最小インターフェース（描画メソッドに渡される）
 */
export interface SpriteManager {
  get(name: string | null): unknown;
  draw(
    ctx:  CanvasRenderingContext2D,
    name: string,
    x: number, y: number,
    w: number, h: number,
  ): void;
}
