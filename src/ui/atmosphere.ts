// ─────────────────────────────────────────────
// atmosphere.ts  大気エフェクト（神々しい光線・砂埃・距離フォグ）
//
// 拠点 BASE の上に乗せる空気感レイヤ。各関数はスタンドアロンで呼べる。
// 描画パス内で Math.random() を使わず、now と決定論ハッシュから位置を決める。
// ─────────────────────────────────────────────

'use strict';

import { hash2 } from './base-realism.js';
import type { WeatherState } from './weather.js';

// ─── 1. 神々しい光線（god rays） ─────────────────

/**
 * 朝・夕の低い太陽光を表現する斜めの光柱を 5〜7 本描画する。
 * additive ブレンドで重ねることで、画面に温かい透明感を与える。
 *
 * @param phase 時間帯位相 0..1
 * @param intensity 0..1 の強度（雨雪時に下げる）
 */
export function drawGodRays(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  now: number,
  phase: number,
  intensity: number,
): void {
  if (!ctx || !ctx.canvas) return;
  const p = ((phase % 1) + 1) % 1;
  // 朝（0.05..0.20）と夕（0.45..0.60）に強く出す。間は 0。
  const dawnAmt = _bell(p, 0.12, 0.10);   // 中心 0.12
  const duskAmt = _bell(p, 0.55, 0.10);   // 中心 0.55
  let amt = Math.max(dawnAmt, duskAmt) * intensity;
  if (amt < 0.02) return;

  // 色：朝は桃、夕は金
  const dawnColor = { r: 255, g: 217, b: 168 };
  const duskColor = { r: 246, g: 194, b: 114 };
  const useDawn = dawnAmt > duskAmt;
  const c = useDawn ? dawnColor : duskColor;

  // 全体のゆるい明滅（4〜6 秒周期）
  const breathe = 0.85 + 0.15 * Math.sin(now * 0.0014);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // 4 本の細い光線。見下ろし視点なので画面上部だけに薄く降る。
  const RAY_COUNT = 4;
  // 太陽は朝ならやや左、夕ならやや右にあると仮定して角度を変える
  const baseAngle = useDawn ? Math.PI * 0.32 : Math.PI * 0.68; // 上→下方向の傾き
  for (let i = 0; i < RAY_COUNT; i++) {
    const seedHash = hash2(i + 1, useDawn ? 7 : 13);
    const tx = (seedHash % 1000) / 1000; // 0..1
    const startX = canvasW * (tx * 1.4 - 0.2); // 画面端を超えても良い
    const angleJitter = ((seedHash >>> 10) % 200 - 100) / 1000; // ±0.1 rad
    const angle = baseAngle + angleJitter;
    // 光線は画面上端 30% の範囲だけに抑える
    const length = canvasH * (0.25 + ((seedHash >>> 20) % 100) / 2000);
    // 幅も細く（以前の 1/3）
    const width = canvasW * (0.020 + ((seedHash >>> 16) % 50) / 3000);

    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    // 終端（画面下方向）の点
    const endX = startX + dx;
    const endY = dy; // 開始 y=0 から

    // アルファも以前の 1/3 程度に抑える
    const rayAlpha = amt * breathe * (0.10 + 0.08 * (((seedHash >>> 8) % 100) / 100));

    // 線形グラデーション：頭側が明るく、末端で消える
    const grad = ctx.createLinearGradient(startX, 0, endX, endY);
    grad.addColorStop(0,   `rgba(${c.r},${c.g},${c.b},${rayAlpha.toFixed(3)})`);
    grad.addColorStop(0.4, `rgba(${c.r},${c.g},${c.b},${(rayAlpha * 0.5).toFixed(3)})`);
    grad.addColorStop(1,   `rgba(${c.r},${c.g},${c.b},0)`);

    // 光柱を平行四辺形として塗る（angle 方向に長い帯）
    ctx.save();
    ctx.translate(startX, 0);
    ctx.rotate(angle - Math.PI / 2); // 帯の長手方向を angle に合わせる
    ctx.fillStyle = grad as unknown as CanvasGradient; // 直線グラデは座標系に紐づくので保存前に作る必要があるが、
    // ここでは簡易のため再生成する。
    const grad2 = ctx.createLinearGradient(0, 0, 0, length);
    grad2.addColorStop(0,   `rgba(${c.r},${c.g},${c.b},${rayAlpha.toFixed(3)})`);
    grad2.addColorStop(0.4, `rgba(${c.r},${c.g},${c.b},${(rayAlpha * 0.5).toFixed(3)})`);
    grad2.addColorStop(1,   `rgba(${c.r},${c.g},${c.b},0)`);
    ctx.fillStyle = grad2;
    ctx.fillRect(-width / 2, 0, width, length);
    ctx.restore();
  }

  ctx.restore();
}

/** 中心 c, 幅 w のベル形（ガウス近似）。p の関数として 0..1 を返す。 */
function _bell(p: number, c: number, w: number): number {
  const d = (p - c) / w;
  return Math.max(0, 1 - d * d);
}

// ─── 2. 砂埃（ダストモート） ─────────────────────

/** 1 つの砂埃の決定論パラメタ。位置は now から計算するので保持しない。 */
interface Mote {
  baseX: number;     // 0..1（画面幅比）
  baseY: number;     // 0..1（画面高比）
  driftSeed: number; // 個体差用シード
  size: number;      // px
}

let _motesCache: Mote[] | null = null;
const _MOTE_COUNT = 100;

function _getMotes(): Mote[] {
  if (_motesCache) return _motesCache;
  const arr: Mote[] = [];
  for (let i = 0; i < _MOTE_COUNT; i++) {
    const h = hash2(i + 17, i * 31 + 5) >>> 0;
    // シフトは全て符号なし（>>>）で。符号付き >> だと最上位ビット立ち時に負値化する。
    const baseX = (h % 10000) / 10000;
    const baseY = ((h >>> 13) % 10000) / 10000;
    const driftSeed = (h >>> 7) % 1000;
    const size = 0.8 + (((h >>> 24) % 100) / 100) * 1.2; // 0.8..2.0
    arr.push({ baseX, baseY, driftSeed, size });
  }
  _motesCache = arr;
  return arr;
}

/**
 * 砂埃（光の中で漂う粒）を描画する。
 * 朝・夕は明るく、昼は淡く、夜はほぼ見えない。
 */
export function drawDustMotes(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  now: number,
  phase: number,
): void {
  if (!ctx || !ctx.canvas) return;
  const p = ((phase % 1) + 1) % 1;
  // 時間帯ごとの輝度係数（控えめに。screen ブレンドなので小さくして良い）
  let brightness: number;
  if (p < 0.05 || p > 0.95) brightness = 0.05; // 深夜
  else if (p < 0.20) brightness = 0.35;         // 朝
  else if (p < 0.45) brightness = 0.15;         // 昼
  else if (p < 0.65) brightness = 0.35;         // 夕
  else brightness = 0.08;                       // 夜
  if (brightness < 0.05) return;

  const motes = _getMotes();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // ゆっくり上昇するため now を秒に換算した値を Y に引く
  const tSec = now * 0.001;
  for (const m of motes) {
    // 上昇：1 サイクル ≈ 30 秒で画面 1.4 倍ぶん上に登り、ループ
    const yProgress = ((m.baseY + tSec * 0.04 + m.driftSeed * 0.0007) % 1.4 + 1.4) % 1.4;
    const y = (1 - yProgress / 1.4) * canvasH;
    // 横方向の微振動
    const sway = Math.sin(tSec * 0.6 + m.driftSeed * 0.3) * 6;
    const x = m.baseX * canvasW + sway;

    const a = brightness * 0.35;
    ctx.fillStyle = `rgba(255,235,190,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, m.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─── 3. 距離フォグ（画面端のソフトフォグ） ─────────

/**
 * 画面の上・左・右・下の端から内側へ、奥行き演出のソフトフォグを描く。
 * 天候が fog/snow のときは濃く、夕焼け時は色を温かくする。
 */
export function drawEdgeFog(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  weatherState: WeatherState | null,
  phase: number,
): void {
  if (!ctx || !ctx.canvas) return;
  const p = ((phase % 1) + 1) % 1;

  // ベース色：基本は冷たい青灰、夕方は温かい
  const sunset = Math.max(0, Math.min(1, 1 - Math.abs(p - 0.6) / 0.15));
  const r = Math.round(180 + (235 - 180) * sunset);
  const g = Math.round(190 + (180 - 190) * sunset);
  const b = Math.round(210 + (140 - 210) * sunset);

  // 強度：基本 0.30、fog なら最大 0.65、snow なら少し強め 0.42
  let alpha = 0.28;
  if (weatherState) {
    if (weatherState.type === 'fog')  alpha = 0.30 + 0.40 * weatherState.intensity;
    if (weatherState.type === 'snow') alpha = 0.30 + 0.18 * weatherState.intensity;
  }

  const depth = 64; // 端からの厚み

  ctx.save();

  // 上端
  {
    const grad = ctx.createLinearGradient(0, 0, 0, depth);
    grad.addColorStop(0, `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, depth);
  }
  // 下端
  {
    const grad = ctx.createLinearGradient(0, canvasH - depth, 0, canvasH);
    grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},${(alpha * 0.7).toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, canvasH - depth, canvasW, depth);
  }
  // 左端
  {
    const grad = ctx.createLinearGradient(0, 0, depth, 0);
    grad.addColorStop(0, `rgba(${r},${g},${b},${(alpha * 0.85).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, depth, canvasH);
  }
  // 右端
  {
    const grad = ctx.createLinearGradient(canvasW - depth, 0, canvasW, 0);
    grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},${(alpha * 0.85).toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(canvasW - depth, 0, depth, canvasH);
  }

  ctx.restore();
}

/** テスト用：内部の motes キャッシュをリセット。 */
export function _resetAtmosphereCache(): void {
  _motesCache = null;
}
