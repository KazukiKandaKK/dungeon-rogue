// ─────────────────────────────────────────────
// weather.ts  天候レイヤ（雨・雪・霧・花吹雪）
//
// BASE 拠点とダンジョンの両方で使える汎用の天候描画モジュール。
// 粒子位置は now からの連続時間で決定論的に計算し、状態配列を持たない
// 純関数スタイル（時刻ベースの手続き生成）で実装する。
//
// 設計メモ：
//   - 状態は WeatherState 1 つだけ（type, startedAt, durationMs, intensity）。
//   - 各粒子は seed（ループインデックス）と now から sin/cos の式で位置を決める。
//   - これにより、描画側はフレーム間の粒子配列を持たずに済み、
//     BASE とダンジョンで自由に使い回せる。
// ─────────────────────────────────────────────

'use strict';

/** 天候タイプ。clear は何も描画しない。 */
export type WeatherType = 'clear' | 'rain' | 'snow' | 'fog' | 'petals';

/**
 * 天候の状態。モジュール外で保持する想定（BASE は base-objects.ts、
 * ダンジョンは呼び出し側）。
 */
export interface WeatherState {
  /** 現在の天候タイプ */
  type:       WeatherType;
  /** この天候が始まった時刻（Date.now 相当） */
  startedAt:  number;
  /** この天候が続く時間（ミリ秒） */
  durationMs: number;
  /** 強さ 0..1。粒数や濃さに掛ける */
  intensity:  number;
}

/**
 * 画面全体に天候を描画する。
 * clear の場合は何もしない。粒子は決定論的に now から位置が決まるため、
 * 状態配列は不要。
 *
 * @param ctx      描画コンテキスト
 * @param camOffX  カメラオフセット（現在未使用だが、将来の視差用に引数だけ残す）
 * @param camOffY  同上
 * @param now      現在時刻（ミリ秒）
 * @param W        画面幅（px）
 * @param H        画面高さ（px）
 * @param state    現在の天候状態
 */
export function drawWeather(
  ctx: CanvasRenderingContext2D,
  camOffX: number, camOffY: number,
  now: number,
  W: number, H: number,
  state: WeatherState,
): void {
  if (state.type === 'clear') return;
  // 引数を明示的に参照（将来のパララックス用に camOffX/Y を残しておく）
  void camOffX; void camOffY;

  switch (state.type) {
    case 'rain':   drawRain  (ctx, now, W, H, state.intensity); break;
    case 'snow':   drawSnow  (ctx, now, W, H, state.intensity); break;
    case 'fog':    drawFog   (ctx, now, W, H, state.intensity); break;
    case 'petals': drawPetals(ctx, now, W, H, state.intensity); break;
  }
}

// ─── 各天候の描画 ───────────────────────────────

/** 雨：斜めに流れる短い白ライン。 */
function drawRain(
  ctx: CanvasRenderingContext2D,
  now: number, W: number, H: number, intensity: number,
): void {
  // 画面サイズから粒数を 150〜250 の範囲で決定。強さ係数も掛ける。
  const area   = W * H;
  const baseN  = 150 + Math.min(100, Math.floor(area / 9000));
  const count  = Math.max(60, Math.floor(baseN * (0.5 + 0.5 * intensity)));
  const alpha  = Math.min(0.85, 0.35 + 0.45 * intensity);

  // 斜め角度（右下向き）。画面を広めにカバーするため少し幅を持たせる。
  const angle  = Math.PI * 0.38; // 約 68 度
  const dirX   = Math.cos(angle);
  const dirY   = Math.sin(angle);
  const dropLen = 14;             // 粒の長さ
  const speed  = 950;             // px/秒

  ctx.save();
  ctx.strokeStyle = `rgba(200,220,255,${alpha.toFixed(3)})`;
  ctx.lineWidth   = 1.2;
  ctx.lineCap     = 'round';
  ctx.beginPath();

  for (let i = 0; i < count; i++) {
    // 各粒の seed（擬似乱数代わりの決定論的ハッシュ）
    const s1 = (i * 12.9898) % 1;
    const s2 = (i * 78.233) % 1;
    const s3 = (i * 37.719) % 1;

    // 起点：画面の左上を超える領域にオフセット（斜めに流れるため）
    const spanX = W + H;
    const spanY = H + 200;
    const baseX = (s1 * 9301 + s2 * 49297) % spanX;
    const baseY = (s2 * 6197 + s3 * 31337) % spanY;

    // 時間で下方向に流す。spanY でループ。
    const t = (now * 0.001) * speed * (0.85 + 0.25 * s3);
    const x0 = ((baseX - t * dirX) % spanX + spanX) % spanX - H * 0.5;
    const y0 = ((baseY + t * dirY) % spanY + spanY) % spanY - 80;
    const x1 = x0 + dropLen * dirX;
    const y1 = y0 + dropLen * dirY;

    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
  ctx.restore();
}

/** 雪：ゆっくり舞い落ちる白い円。横揺れ sin。 */
function drawSnow(
  ctx: CanvasRenderingContext2D,
  now: number, W: number, H: number, intensity: number,
): void {
  const area  = W * H;
  const baseN = 80 + Math.min(70, Math.floor(area / 18000));
  const count = Math.max(30, Math.floor(baseN * (0.5 + 0.5 * intensity)));
  const alpha = Math.min(0.95, 0.55 + 0.4 * intensity);

  const speed = 90; // px/秒（ゆったり）

  ctx.save();
  for (let i = 0; i < count; i++) {
    const s1 = (i * 12.9898) % 1;
    const s2 = (i * 78.233) % 1;
    const s3 = (i * 37.719) % 1;

    const spanY = H + 80;
    const baseX = (s1 * 9301) % W;
    const baseY = (s2 * 6197) % spanY;

    // 落下
    const t  = (now * 0.001) * speed * (0.7 + 0.6 * s3);
    const y  = ((baseY + t) % spanY + spanY) % spanY - 40;

    // 横揺れ（sin）
    const swayAmp  = 14 + 10 * s3;
    const swayFreq = 0.0006 + 0.0008 * s2;
    const x = baseX + Math.sin(now * swayFreq + s1 * 6.28) * swayAmp;

    // サイズ（奥行きのある見た目）
    const r = 1.2 + s3 * 2.4;
    ctx.fillStyle = `rgba(255,255,255,${(alpha * (0.55 + 0.45 * s3)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 霧：半透明のふんわりした塊が複数層で左右に流れる。 */
function drawFog(
  ctx: CanvasRenderingContext2D,
  now: number, W: number, H: number, intensity: number,
): void {
  const layerCount = 4;
  const baseAlpha  = 0.12 + 0.08 * intensity; // 1 層あたりの基底 α

  ctx.save();
  for (let layer = 0; layer < layerCount; layer++) {
    // 各層で速度・高さ・シード・色を変える。
    const speed = 18 + layer * 9;            // px/秒
    const dir   = layer % 2 === 0 ? 1 : -1;
    const yBase = H * (0.15 + 0.22 * layer); // 層の中心
    const alpha = baseAlpha * (1 - layer * 0.15);

    // 塊の個数（幅に比例）
    const blobCount = Math.max(3, Math.floor(W / 260));

    ctx.fillStyle = `rgba(220,225,230,${alpha.toFixed(3)})`;
    for (let i = 0; i < blobCount; i++) {
      const s1 = ((layer * 7 + i) * 12.9898) % 1;
      const s2 = ((layer * 7 + i) * 78.233) % 1;
      const s3 = ((layer * 7 + i) * 37.719) % 1;

      const spanX = W + 600;
      const baseX = (s1 * 9301) % spanX;
      const t     = (now * 0.001) * speed * dir;
      const x     = ((baseX + t) % spanX + spanX) % spanX - 300;

      // 縦位置は層中心から少し上下させる
      const y = yBase + Math.sin(now * 0.0003 + s2 * 6.28) * 30 + (s3 - 0.5) * 80;

      // 塊サイズ
      const rx = 180 + 120 * s2;
      const ry = 50 + 30 * s3;

      // Path2D で楕円のふんわり塊
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** 花吹雪：桜風の花弁が回転しながら舞う。 */
function drawPetals(
  ctx: CanvasRenderingContext2D,
  now: number, W: number, H: number, intensity: number,
): void {
  const area  = W * H;
  const baseN = 40 + Math.min(40, Math.floor(area / 30000));
  const count = Math.max(20, Math.floor(baseN * (0.5 + 0.5 * intensity)));
  const alpha = Math.min(0.95, 0.65 + 0.3 * intensity);

  const speed = 110; // px/秒

  ctx.save();
  ctx.fillStyle = `rgba(251,207,232,${alpha.toFixed(3)})`;
  for (let i = 0; i < count; i++) {
    const s1 = (i * 12.9898) % 1;
    const s2 = (i * 78.233) % 1;
    const s3 = (i * 37.719) % 1;

    const spanY = H + 120;
    const baseX = (s1 * 9301) % W;
    const baseY = (s2 * 6197) % spanY;

    const t = (now * 0.001) * speed * (0.8 + 0.5 * s3);
    const y = ((baseY + t) % spanY + spanY) % spanY - 60;

    // 横揺れは sin だが雪より大きく
    const sway = Math.sin(now * (0.0008 + 0.0012 * s2) + s1 * 6.28) * (24 + 18 * s3);
    const x    = baseX + sway;

    // 回転（時間と seed で回る）
    const rot = now * (0.003 + 0.004 * s3) + s1 * 6.28;

    // 花弁サイズ（snow より大きめ）
    const rx = 5 + 3 * s3;
    const ry = 3 + 2 * s3;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ─── 状態生成 ──────────────────────────────────

/**
 * 次の天候状態を決定する。pool の中から 1 つ抽選し、
 * durationMs と intensity をランダムに決める。
 *
 * @param prev  直前の状態（未使用だが、将来の連続性制御用に受け取る）
 * @param now   現在時刻
 * @param pool  抽選対象の天候タイプ配列
 */
export function nextWeatherState(
  prev: WeatherState | null,
  now: number,
  pool: WeatherType[],
): WeatherState {
  // prev は現在未使用。将来「同じ天候が連続しにくくする」等の拡張用に引数だけ残す。
  void prev;
  const safePool: WeatherType[] = pool.length > 0 ? pool : ['clear'];
  const type = safePool[Math.floor(Math.random() * safePool.length)] ?? 'clear';

  // 継続時間：clear は長め（静かな時間）、それ以外は 60〜150 秒。
  const durationMs = type === 'clear'
    ? 90_000 + Math.random() * 90_000
    : 60_000 + Math.random() * 90_000;

  // 強さ：適度にばらつかせる
  const intensity = 0.5 + Math.random() * 0.5;

  return {
    type,
    startedAt: now,
    durationMs,
    intensity,
  };
}
