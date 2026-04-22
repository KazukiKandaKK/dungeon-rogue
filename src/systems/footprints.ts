// ─────────────────────────────────────────────
// footprints.ts  プレイヤーの足跡システム
//
// BASE 拠点でプレイヤーが歩いた跡を残す。1 タイル進むごとに 1 つ生成、
// 左右の足を交互に配置し、寿命に従って徐々に薄くなる。
//
// 設計メモ：
//   - 状態は Footprint[] の配列を 1 本だけ呼び出し側に持ってもらう。
//   - 上限 24 個。超えたら最古から削る。
//   - 描画は世界座標→スクリーン座標へカメラオフセットを足すだけ。
//   - Canvas に依存しない部分（emit/tick）は Node テストできる純関数。
// ─────────────────────────────────────────────

'use strict';

/** 足跡 1 つの内部表現。 */
export interface Footprint {
  /** ワールド座標 X（タイル中心の px 値） */
  wx: number;
  /** ワールド座標 Y（タイル中心の px 値） */
  wy: number;
  /** 進行方向のラジアン角（atan2(dy, dx)） */
  angle: number;
  /** 左右どちらの足か */
  foot: 'L' | 'R';
  /** 生成時刻（Date.now 相当） */
  bornAt: number;
  /** 現在の不透明度 0..1。tick で減衰させる */
  alpha: number;
}

/** 足跡リストの上限。これを超えると最古から捨てる。 */
export const FOOTPRINT_CAP = 24;

/** 内部状態：左右の交互判定用カウンタ。配列ごとに自前で持っても良いが、
 *  簡便のためモジュール内で seed として使うだけにする。 */
let _emitSerial = 0;

/**
 * 足跡を 1 つ追加する。配列が cap を超えたら最古から削る。
 * 左右の足は呼び出し回数で交互に切り替わる。
 */
export function emitFootprint(
  list: Footprint[],
  wx: number,
  wy: number,
  angle: number,
  now: number,
): void {
  const foot: 'L' | 'R' = (_emitSerial++ % 2 === 0) ? 'L' : 'R';
  list.push({ wx, wy, angle, foot, bornAt: now, alpha: 1 });
  while (list.length > FOOTPRINT_CAP) {
    list.shift();
  }
}

/**
 * 足跡の寿命を進める。alpha は (lifetimeMs - 経過時間) / lifetimeMs。
 * 期限切れは取り除く。
 */
export function tickFootprints(
  list: Footprint[],
  now: number,
  lifetimeMs: number,
): void {
  // 後ろから走査して splice しても良いが、件数が小さい（<= 24）ので filter で十分。
  for (const fp of list) {
    const age = now - fp.bornAt;
    fp.alpha = Math.max(0, 1 - age / lifetimeMs);
  }
  // 期限切れを除去
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].alpha <= 0) list.splice(i, 1);
  }
}

/**
 * 足跡を描画する。小さな黒い楕円を進行方向に向けて配置。
 * 左右で少し横方向にオフセットを掛けることで歩いた感じが出る。
 */
export function drawFootprints(
  ctx: CanvasRenderingContext2D,
  list: Footprint[],
  camOffX: number,
  camOffY: number,
  _now: number,
): void {
  if (list.length === 0) return;
  ctx.save();
  for (const fp of list) {
    if (fp.alpha <= 0) continue;
    const sx = fp.wx + camOffX;
    const sy = fp.wy + camOffY;
    // 進行方向に対して直角の方向に左右のオフセット
    const side = fp.foot === 'L' ? -1 : 1;
    const ox = Math.cos(fp.angle + Math.PI / 2) * 4 * side;
    const oy = Math.sin(fp.angle + Math.PI / 2) * 4 * side;
    const fx = sx + ox;
    const fy = sy + oy;

    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(fp.angle);
    // 黒い楕円（つま先方向に少し細く）
    const a = fp.alpha;
    ctx.fillStyle = `rgba(20,12,8,${(0.45 * a).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.6, 2.0, 0, 0, Math.PI * 2);
    ctx.fill();
    // つま先側のドット（軽く前方に）
    ctx.fillStyle = `rgba(20,12,8,${(0.30 * a).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(3.2, 0, 1.2, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * テスト用に内部の交互カウンタをリセットする。本番コードからは呼ばない想定。
 */
export function _resetFootprintSerial(): void {
  _emitSerial = 0;
}
