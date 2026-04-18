// ─────────────────────────────────────────────
// fov.ts  視線（LOS）・射線遮断チェック（純粋関数）
//
// Bresenham の直線アルゴリズムによる視線判定。
// グローバル状態を一切参照せず、引数だけで完結する。
// ─────────────────────────────────────────────

/** map.isWalkable() を持つ最小インターフェース */
export interface FovMap {
  isWalkable(tx: number, ty: number): boolean;
}

/** 視線判定に登場する最小アクター */
export interface FovActor {
  tx:    number;
  ty:    number;
  alive: boolean;
}

/**
 * タイル (x0,y0) → (x1,y1) の視線が通るか判定する。
 * 壁タイルで遮断される。斜め移動時は両コーナーが壁なら遮断。
 *
 * @param map   isWalkable を持つマップ
 * @param x0    始点X（タイル座標）
 * @param y0    始点Y
 * @param x1    終点X
 * @param y1    終点Y
 */
export function hasLOS(
  map: FovMap,
  x0: number, y0: number,
  x1: number, y1: number,
): boolean {
  const adx = Math.abs(x1 - x0);
  const ady = Math.abs(y1 - y0);
  const sx  = x0 < x1 ? 1 : -1;
  const sy  = y0 < y1 ? 1 : -1;
  let err = adx - ady;
  let cx = x0, cy = y0;

  for (let i = 0; i < 512; i++) {
    if (cx === x1 && cy === y1) return true;
    const e2   = 2 * err;
    const movX = e2 > -ady;
    const movY = e2 <  adx;
    // 斜め移動時：両コーナーが壁なら視線遮断
    if (movX && movY && !map.isWalkable(cx + sx, cy) && !map.isWalkable(cx, cy + sy)) return false;
    if (movX) { err -= ady; cx += sx; }
    if (movY) { err += adx; cy += sy; }
    // 中間タイルが壁なら視線遮断（終点は除く）
    if ((cx !== x1 || cy !== y1) && !map.isWalkable(cx, cy)) return false;
  }
  return false;
}

/**
 * (x0,y0) → (x1,y1) の直線上に excludeActor 以外の
 * 生存アクターが存在するか（射線遮断チェック）。
 *
 * @param actors       判定対象のアクター配列
 * @param excludeActor 除外するアクター（射手自身など）
 */
export function isActorOnLine(
  actors:      FovActor[],
  excludeActor: FovActor,
  x0: number, y0: number,
  x1: number, y1: number,
): boolean {
  const adx = Math.abs(x1 - x0), ady = Math.abs(y1 - y0);
  const sx  = x0 < x1 ? 1 : -1, sy  = y0 < y1 ? 1 : -1;
  let err = adx - ady;
  let cx = x0, cy = y0;

  for (let i = 0; i < 512; i++) {
    if (cx === x1 && cy === y1) return false;
    const e2 = 2 * err;
    if (e2 > -ady) { err -= ady; cx += sx; }
    if (e2 <  adx) { err += adx; cy += sy; }
    // 中間タイル（終点除く）に別の生存アクターがいたら遮断
    if ((cx !== x1 || cy !== y1)
        && actors.some(a => a !== excludeActor && a.alive && a.tx === cx && a.ty === cy)) {
      return true;
    }
  }
  return false;
}
