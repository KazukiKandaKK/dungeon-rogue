// ─────────────────────────────────────────────
// camera.ts  カメラ追従・シネマティック演出
//
// プレイヤー中心の指数補間による滑らかな追従に加え、
// 以下の3種類の "シネマティック" 状態を管理する。
//
//   - floor-entry : 新フロア開始時に外側から寄せるパン
//   - boss-zoom   : ボスフロア突入時の短いズームイン
//   - base-fly-in : 拠点帰還時の南から上昇するフライイン
//
// 本モジュールは純粋関数寄り（CameraState のみ変更する）。
// DOM や Canvas には触らず、すべての単位は screen px / seconds。
// ─────────────────────────────────────────────

export type CamCinematic =
  | { kind: 'none' }
  | { kind: 'floor-entry'; t: number; duration: number; fromDX: number; fromDY: number }
  | { kind: 'boss-zoom';   t: number; duration: number; focusWX: number; focusWY: number; zoom: number }
  | { kind: 'base-fly-in'; t: number; duration: number; fromDY: number };

export interface CameraState {
  /** 実際に描画で使うオフセット（= W/2 - playerWX + cinematic補正） */
  offX: number;
  offY: number;
  /** 追従目標（通常時は playerRender を画面中央に合わせる値） */
  targetX: number;
  targetY: number;
  /** ズーム倍率（通常 1.0、ボス演出中のみ 1.3 付近まで上がって戻る） */
  zoom: number;
  cinematic: CamCinematic;
  /** 距離を半分にするのに必要な秒数。小さいほどキビキビ追従する。 */
  lerpHalfLife: number;
}

/** デフォルトのカメラ状態を作る。 */
export function createCamera(): CameraState {
  return {
    offX: 0,
    offY: 0,
    targetX: 0,
    targetY: 0,
    zoom: 1,
    cinematic: { kind: 'none' },
    lerpHalfLife: 0.08,
  };
}

// ── 補助関数 ────────────────────────────────────────

function easeOutCubic(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return 1 - Math.pow(1 - c, 3);
}

/** 三角プロファイル：0→ピーク(0.5)→0 */
function triangle(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c < 0.5 ? c * 2 : (1 - c) * 2;
}

// ── シネマティック開始 ─────────────────────────────

/**
 * 新フロアに入った瞬間にカメラを外側にずらし、プレイヤーへ寄せ戻す。
 * dir は "新フロアが来る方向" — 例: 'south' なら下方向から登場。
 */
export function beginFloorEntry(cam: CameraState, dir: 'north' | 'south' | 'east' | 'west'): void {
  const magnitude = 220;
  let fromDX = 0, fromDY = 0;
  switch (dir) {
    case 'north': fromDY = -magnitude; break;
    case 'south': fromDY =  magnitude; break;
    case 'east':  fromDX =  magnitude; break;
    case 'west':  fromDX = -magnitude; break;
  }
  cam.cinematic = { kind: 'floor-entry', t: 0, duration: 0.6, fromDX, fromDY };
}

/** ボスフロア突入演出：ボスを画面中央に寄せつつ 1.3 倍ズーム、すぐ戻る。 */
export function beginBossZoom(cam: CameraState, bossWorldX: number, bossWorldY: number): void {
  cam.cinematic = {
    kind: 'boss-zoom', t: 0, duration: 1.2,
    focusWX: bossWorldX, focusWY: bossWorldY, zoom: 1.3,
  };
}

/** 拠点帰還のフライイン：南から上がってプレイヤーに着地。 */
export function beginBaseFlyIn(cam: CameraState): void {
  cam.cinematic = { kind: 'base-fly-in', t: 0, duration: 0.8, fromDY: 200 };
}

/** 実行中の演出を強制終了。 */
export function clearCinematic(cam: CameraState): void {
  cam.cinematic = { kind: 'none' };
  cam.zoom = 1;
}

// ── フレーム更新 ─────────────────────────────────

/**
 * カメラを 1 フレーム進める。
 * @returns 入力を locked にすべきなら true。
 */
export function tickCamera(
  cam: CameraState,
  dt: number,
  playerWX: number,
  playerWY: number,
  canvasW: number,
  canvasH: number,
): boolean {
  // 通常の追従目標（プレイヤーを中央に置くための offset）
  const baseTargetX = canvasW / 2 - playerWX;
  const baseTargetY = canvasH / 2 - playerWY;
  cam.targetX = baseTargetX;
  cam.targetY = baseTargetY;

  let locksInput = false;
  let desiredX = baseTargetX;
  let desiredY = baseTargetY;
  let desiredZoom = 1;

  const cin = cam.cinematic;
  if (cin.kind === 'floor-entry') {
    const wasStart = cin.t === 0;
    cin.t += dt;
    const p = easeOutCubic(cin.t / cin.duration);
    // 開始時: プレイヤーが fromDX/fromDY だけずれて画面中央に来る（= 逆方向へ camera オフセット）
    const startX = baseTargetX - cin.fromDX;
    const startY = baseTargetY - cin.fromDY;
    desiredX = startX + (baseTargetX - startX) * p;
    desiredY = startY + (baseTargetY - startY) * p;
    // 演出開始直後は lerp を介さず startX/startY にスナップして違和感を防ぐ
    if (wasStart) { cam.offX = startX; cam.offY = startY; }
    locksInput = true;
    if (cin.t >= cin.duration) {
      cam.cinematic = { kind: 'none' };
    }
  } else if (cin.kind === 'base-fly-in') {
    const wasStart = cin.t === 0;
    cin.t += dt;
    const p = easeOutCubic(cin.t / cin.duration);
    const startY = baseTargetY - cin.fromDY;
    desiredX = baseTargetX;
    desiredY = startY + (baseTargetY - startY) * p;
    if (wasStart) { cam.offX = baseTargetX; cam.offY = startY; }
    locksInput = true;
    if (cin.t >= cin.duration) {
      cam.cinematic = { kind: 'none' };
    }
  } else if (cin.kind === 'boss-zoom') {
    cin.t += dt;
    const raw = cin.t / cin.duration;
    const tri = triangle(raw);  // 0 → 1 → 0
    // ボス側へ目標をずらす（中央寄せ）
    const bossTargetX = canvasW / 2 - cin.focusWX;
    const bossTargetY = canvasH / 2 - cin.focusWY;
    desiredX = baseTargetX + (bossTargetX - baseTargetX) * tri;
    desiredY = baseTargetY + (bossTargetY - baseTargetY) * tri;
    desiredZoom = 1 + (cin.zoom - 1) * tri;
    locksInput = true;
    if (cin.t >= cin.duration) {
      cam.cinematic = { kind: 'none' };
      desiredZoom = 1;
    }
  }

  // 指数補間で近づける（shake はここでは重ねない）
  const halfLife = Math.max(0.0001, cam.lerpHalfLife);
  const k = 1 - Math.pow(0.5, dt / halfLife);
  cam.offX += (desiredX - cam.offX) * k;
  cam.offY += (desiredY - cam.offY) * k;
  cam.zoom += (desiredZoom - cam.zoom) * k;

  return locksInput;
}
