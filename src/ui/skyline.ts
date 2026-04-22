// ─────────────────────────────────────────────
// skyline.ts  遠景のパララックス背景
//
// BASE 拠点の壁の向こうに見える遠景。3 層の山並み・尖塔・遠い城壁を
// シルエットで重ね、カメラ X に対して異なる速度でスクロールさせる
// ことで奥行きを出す。各層のシルエットは決定論的乱数で 1 度だけ生成
// し、以降は描画時にカメラ移動量だけ平行移動する。
//
// 設計メモ：
//   - パスは module init で 1 回だけ作成（Path2D）。描画時は translate のみ。
//   - 色は時間帯（phase）で線形補間。fog 中はアルファを下げる。
//   - 画面外まで広がるよう、画面幅 + 余白でパスを生成する。
// ─────────────────────────────────────────────

'use strict';

import { seededRand } from './base-realism.js';
import type { WeatherState } from './weather.js';

// ─── 層ごとのシルエット定義 ────────────────────

interface SkylineLayer {
  /** カメラ X に対するスクロール係数（0 = 動かない、1 = 同速） */
  scroll: number;
  /** Path2D は実描画時に作る（毎フレーム再構築でも軽い：頂点数～80） */
  vertices: Array<[number, number]>;
  /** この層の上端 Y（画面比 0..1） */
  topRatio: number;
  /** この層の地平線 Y（px）。シルエット polygon はここで閉じる。 */
  horizonY: number;
  /** この層の基準色（時間帯ブレンド前のニュートラル） */
  baseColor: { r: number; g: number; b: number };
}

let _layersCache: SkylineLayer[] | null = null;
let _cacheKey = '';

/**
 * 1 層分のシルエット頂点を生成する。低周波のうねり + ピーク（尖塔）を混ぜる。
 *
 * @param seed       決定論シード（層ごとに変える）
 * @param width      頂点を打つ範囲の幅（px）
 * @param baseY      層の基準 Y（このラインを中心に上下する）
 * @param amplitude  山の高さの最大値（px）
 * @param spikeRate  尖塔の出現確率（0..1）。ピーク時に細い塔を生やす
 */
function _generateSilhouette(
  seed: number,
  width: number,
  baseY: number,
  amplitude: number,
  spikeRate: number,
): Array<[number, number]> {
  const rand = seededRand(seed);
  const verts: Array<[number, number]> = [];
  const step = 24; // 頂点間隔（px）
  let x = 0;
  // 低周波の正弦波 2 つを足し合わせて自然な山並みを作る
  const phase1 = rand() * Math.PI * 2;
  const phase2 = rand() * Math.PI * 2;
  while (x <= width) {
    const t = x / width;
    const w1 = Math.sin(t * Math.PI * 4 + phase1) * 0.6;
    const w2 = Math.sin(t * Math.PI * 11 + phase2) * 0.3;
    const noise = (rand() - 0.5) * 0.2;
    let y = baseY - amplitude * (0.4 + 0.6 * (0.5 + 0.5 * (w1 + w2 + noise)));
    // 尖塔（細い高い塔）をたまに足す
    if (rand() < spikeRate) {
      const spikeH = amplitude * (0.6 + rand() * 0.5);
      verts.push([x, y]);
      verts.push([x + 4, baseY - amplitude - spikeH]);
      verts.push([x + 8, y]);
      x += 12;
      continue;
    }
    verts.push([x, y]);
    x += step;
  }
  return verts;
}

/**
 * 層キャッシュを構築する。画面幅が変わったら作り直す。
 */
function _buildLayers(canvasW: number, canvasH: number): SkylineLayer[] {
  // 画面外まで広く取る（最大スクロール係数 0.3 を考慮し +50% 余白）
  const w = Math.ceil(canvasW * 1.5);
  // 見下ろし視点のゲームなので、遠景は画面上端の薄いリボンに限定する。
  // 地平線（horizon）は canvasH の 0.12〜0.18 付近。ここより下には何も塗らない。
  const L1horizon = canvasH * 0.14;
  const L2horizon = canvasH * 0.16;
  const L3horizon = canvasH * 0.18;
  const layers: SkylineLayer[] = [
    {
      scroll: 0.05,
      vertices: _generateSilhouette(0xA13F71, w, L1horizon, canvasH * 0.08, 0.0),
      topRatio: 0.0,
      horizonY: L1horizon,
      baseColor: { r: 90, g: 95, b: 130 }, // 遠い山並み（青灰）
    },
    {
      scroll: 0.15,
      vertices: _generateSilhouette(0x5C8BCE, w, L2horizon, canvasH * 0.07, 0.08),
      topRatio: 0.0,
      horizonY: L2horizon,
      baseColor: { r: 60, g: 65, b: 95 }, // 中景：尖塔混じりの山
    },
    {
      scroll: 0.30,
      vertices: _generateSilhouette(0x2D9B7A, w, L3horizon, canvasH * 0.06, 0.05),
      topRatio: 0.0,
      horizonY: L3horizon,
      baseColor: { r: 35, g: 40, b: 65 }, // 近景：城壁・パゴダ
    },
  ];
  return layers;
}

/** 層キャッシュを取得（必要なら再構築）。 */
function _getLayers(canvasW: number, canvasH: number): SkylineLayer[] {
  const key = `${canvasW}x${canvasH}`;
  if (_layersCache && key === _cacheKey) return _layersCache;
  _layersCache = _buildLayers(canvasW, canvasH);
  _cacheKey = key;
  return _layersCache;
}

/**
 * 時間帯ごとの空＋シルエット色を返す。phase は 0..1。
 * - 朝（0.0..0.2）: 桃色〜黄
 * - 昼（0.2..0.5）: 青みがかったニュートラル
 * - 夕（0.5..0.7）: 橙〜赤
 * - 夜（0.7..1.0）: 深い藍
 */
function _phaseTint(phase: number): { tint: { r: number; g: number; b: number; a: number }; sky: { r: number; g: number; b: number } } {
  const p = ((phase % 1) + 1) % 1;
  // アンカー：(p, tintR,G,B,A, skyR,G,B)
  const anchors: Array<[number, number, number, number, number, number, number, number]> = [
    [0.00, 255, 180, 160, 0.35, 200, 170, 180],  // 朝の桃色
    [0.20, 230, 220, 220, 0.20, 180, 200, 220],  // 朝→昼
    [0.40, 200, 220, 240, 0.18, 160, 195, 230],  // 昼の青
    [0.55, 255, 170, 110, 0.40, 230, 170, 130],  // 夕の橙
    [0.65, 220, 110, 80,  0.45, 180, 110, 100],  // 夕の赤
    [0.80, 60,  70,  120, 0.55, 50,  60,  100],  // 夜の藍
    [0.95, 30,  35,  80,  0.65, 25,  30,  70],   // 深夜
    [1.00, 255, 180, 160, 0.35, 200, 170, 180],
  ];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (p >= a[0] && p <= b[0]) {
      const t = (p - a[0]) / Math.max(1e-6, b[0] - a[0]);
      const lerp = (x: number, y: number): number => x + (y - x) * t;
      return {
        tint: {
          r: Math.round(lerp(a[1], b[1])),
          g: Math.round(lerp(a[2], b[2])),
          b: Math.round(lerp(a[3], b[3])),
          a: lerp(a[4], b[4]),
        },
        sky: {
          r: Math.round(lerp(a[5], b[5])),
          g: Math.round(lerp(a[6], b[6])),
          b: Math.round(lerp(a[7], b[7])),
        },
      };
    }
  }
  return {
    tint: { r: 200, g: 200, b: 220, a: 0.3 },
    sky:  { r: 180, g: 200, b: 220 },
  };
}

/**
 * 遠景（パララックス・スカイライン）を描画する。
 * BASE 拠点の最初に呼ぶ：背景塗り→これ→マップ→建物 の順。
 */
export function drawSkyline(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  camOffX: number,
  camOffY: number,
  _now: number,
  phase: number,
  weatherState: WeatherState | null,
): void {
  if (!ctx || !ctx.canvas) return;
  const layers = _getLayers(canvasW, canvasH);
  const { tint, sky } = _phaseTint(phase);

  // 霧の場合はシルエットを薄く（奥行きが消える方向）
  const fogFactor = (weatherState && weatherState.type === 'fog')
    ? Math.max(0.4, 1 - 0.55 * weatherState.intensity)
    : 1.0;

  ctx.save();

  // ── 1. 空のグラデーション帯（画面最上部 20% に限定） ──
  // 見下ろし視点のゲームなので、空は上端に薄くだけ乗せる。ゲームプレイ領域は覆わない。
  {
    const skyBandH = canvasH * 0.20;
    const skyTop    = `rgba(${sky.r},${sky.g},${sky.b},0.28)`;
    const skyBottom = `rgba(${sky.r},${sky.g},${sky.b},0.00)`;
    const grad = ctx.createLinearGradient(0, 0, 0, skyBandH);
    grad.addColorStop(0, skyTop);
    grad.addColorStop(1, skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, skyBandH);
  }

  // ── 2. 各シルエット層 ──
  // カメラが右に動くと層は左にスクロール（負の方向）。camOffY は奥行きには関わらない。
  void camOffY;
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    // パララックスのオフセット：層は背景なので「カメラ移動 × scroll」だけ動く。
    // camOffX は world→screen の +オフセットなので、そのまま掛ける。
    const offsetX = camOffX * layer.scroll;
    // 余白幅の半分を中央に来るように補正
    const baseShiftX = -(canvasW * 0.25);

    // 色：層が遠いほど tint に強く引き寄せる（大気遠近）
    const distance = 1 - li / Math.max(1, layers.length - 1); // L1=1, L3=0
    const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
    const r = Math.round(lerp(layer.baseColor.r, tint.r, distance * 0.7));
    const g = Math.round(lerp(layer.baseColor.g, tint.g, distance * 0.7));
    const b = Math.round(lerp(layer.baseColor.b, tint.b, distance * 0.7));
    const layerAlpha = (0.55 + 0.15 * (1 - distance)) * fogFactor;

    // パスを組み立て。polygon は horizonY で閉じる（下端は地平線、canvasH ではない）。
    ctx.beginPath();
    const verts = layer.vertices;
    const xShift = baseShiftX + offsetX;
    if (verts.length === 0) continue;
    const horizon = layer.horizonY;
    ctx.moveTo(verts[0][0] + xShift, horizon);
    for (const [vx, vy] of verts) {
      ctx.lineTo(vx + xShift, vy);
    }
    ctx.lineTo(verts[verts.length - 1][0] + xShift, horizon);
    ctx.closePath();

    // 上から地平線へのグラデーション（上＝シルエット色、下端は接地を示す明るさ）
    const topY = Math.min(...verts.map(v => v[1]));
    const grad = ctx.createLinearGradient(0, topY, 0, horizon);
    grad.addColorStop(0,   `rgba(${r},${g},${b},${layerAlpha.toFixed(3)})`);
    grad.addColorStop(0.7, `rgba(${Math.round(r * 0.85)},${Math.round(g * 0.85)},${Math.round(b * 0.9)},${(layerAlpha * 0.85).toFixed(3)})`);
    grad.addColorStop(1,   `rgba(${Math.round(r * 0.7)},${Math.round(g * 0.7)},${Math.round(b * 0.8)},${(layerAlpha * 0.65).toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  ctx.restore();
}

/** テスト用：層キャッシュをリセット。 */
export function _resetSkylineCache(): void {
  _layersCache = null;
  _cacheKey = '';
}
