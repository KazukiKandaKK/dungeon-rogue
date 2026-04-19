// ─────────────────────────────────────────────
// magic-vfx.ts  魔法の豪華エフェクト（タイムライン式）
//
// 各呪文は発動時に 1 つ以上の MagicEffect を発行する。
// update / draw はメインループの描画フェーズで呼ばれる。
// ─────────────────────────────────────────────

import type { ParticleSystem } from './particle.js';

export type MagicEffectType =
  | 'meteor'      // フロアに隕石が降り注ぐ
  | 'fireball'    // 拡大 → 爆発
  | 'thunder'     // ジグザグ雷
  | 'blizzard'    // 氷の花びら
  | 'frost_nova'  // 拡大する氷リング
  | 'holy_nova'   // 拡大する光リング + 光条
  | 'holy_strike' // 縦の光柱 + 斜光
  | 'arcane_ray'  // 虹色の光線
  | 'dark_bolt'   // 紫の尾を引く弾
  | 'mana_burst'  // 魔法陣 → 爆発
  | 'gravity'     // 重力の歪み
  | 'void_rift'   // 闇の裂け目
  | 'quake'       // 地割れ
  | 'generic_ring';

export interface MagicEffect {
  type:    MagicEffectType;
  age:     number;           // 経過秒
  life:    number;           // 寿命秒
  params:  Record<string, number | string | number[] | Array<{ tx: number; ty: number }>>;
}

// ── タイル座標をスクリーン座標に変換するヘルパー ──
function tileToScreen(tx: number, ty: number, TILE_SIZE: number, camOffX: number, camOffY: number) {
  return {
    sx: (tx + 0.5) * TILE_SIZE + camOffX,
    sy: (ty + 0.5) * TILE_SIZE + camOffY,
  };
}

// ═══════════════════════════════════════════════
// Update
// ═══════════════════════════════════════════════

export function updateMagicEffects(effects: MagicEffect[], dt: number): MagicEffect[] {
  for (const e of effects) e.age += dt;
  return effects.filter(e => e.age < e.life);
}

// ═══════════════════════════════════════════════
// Draw (ダンジョンレイヤーの上に描画)
// ═══════════════════════════════════════════════

export interface DrawCtx {
  ctx:       CanvasRenderingContext2D;
  camOffX:   number;
  camOffY:   number;
  TILE_SIZE: number;
  W:         number;
  H:         number;
  particles: ParticleSystem;
  onShake?:  (intensity: number, duration: number) => void;
}

export function drawMagicEffects(effects: MagicEffect[], dctx: DrawCtx): void {
  for (const e of effects) {
    switch (e.type) {
      case 'meteor':       drawMeteor(e, dctx);       break;
      case 'fireball':     drawFireball(e, dctx);     break;
      case 'thunder':      drawThunder(e, dctx);      break;
      case 'blizzard':     drawBlizzard(e, dctx);     break;
      case 'frost_nova':   drawFrostNova(e, dctx);    break;
      case 'holy_nova':    drawHolyNova(e, dctx);     break;
      case 'holy_strike':  drawHolyStrike(e, dctx);   break;
      case 'arcane_ray':   drawArcaneRay(e, dctx);    break;
      case 'dark_bolt':    drawDarkBolt(e, dctx);     break;
      case 'mana_burst':   drawManaBurst(e, dctx);    break;
      case 'gravity':      drawGravity(e, dctx);      break;
      case 'void_rift':    drawVoidRift(e, dctx);     break;
      case 'quake':        drawQuake(e, dctx);        break;
      case 'generic_ring': drawGenericRing(e, dctx);  break;
    }
  }
}

// ═══════════════════════════════════════════════
// メテオ — フロアに隕石が降り注ぐ
// ═══════════════════════════════════════════════

function drawMeteor(e: MagicEffect, d: DrawCtx): void {
  const { ctx, camOffX, camOffY, TILE_SIZE, particles, onShake } = d;
  const impacts = e.params.impacts as Array<{ tx: number; ty: number }>;
  const delays  = e.params.delays  as number[];
  if (!impacts || !delays) return;

  // 加算合成やグラデーション系は撤廃、単純な円+線で軽量化
  ctx.save();

  for (let i = 0; i < impacts.length; i++) {
    const tDelay  = delays[i];
    const localT  = e.age - tDelay;
    if (localT < 0) continue;

    const { sx, sy } = tileToScreen(impacts[i].tx, impacts[i].ty, TILE_SIZE, camOffX, camOffY);
    const fallDur   = 0.3;
    const explDur   = 0.28;

    if (localT < fallDur) {
      // 落下中 — 単色線 + 小さな橙円のみ
      const t       = localT / fallDur;
      const startSx = sx - 120;
      const startSy = sy - 260;
      const cx      = startSx + (sx - startSx) * t;
      const cy      = startSy + (sy - startSy) * t;
      const radius  = 5 + t * 2;

      // 軌跡（単色半透明ライン・短め）
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#ff7a20';
      ctx.lineWidth   = 4;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - (sx - startSx) * 0.18, cy - (sy - startSy) * 0.18);
      ctx.lineTo(cx, cy);
      ctx.stroke();

      // 隕石本体（単色円のみ）
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff9030';
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a0a04';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (localT < fallDur + explDur) {
      // 着弾 — 1 リングのみ + 1 円の発光
      const t = (localT - fallDur) / explDur;
      const ringR = 6 + t * TILE_SIZE * 0.55;
      const alpha = Math.max(0, 1 - t);

      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = '#ffb060';
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffdc80';
      ctx.beginPath();
      ctx.arc(sx, sy, TILE_SIZE * 0.35 * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fill();

      // 衝撃時 1 回だけパーティクル + シェイク
      const spawnedKey = `_spawned_${i}` as const;
      if (!e.params[spawnedKey]) {
        particles.spawn(sx, sy, '#ff9040', 4);
        onShake?.(4, 0.12);
        (e.params as Record<string, number>)[spawnedKey] = 1;
      }
    }
  }

  ctx.restore();
}

// ═══════════════════════════════════════════════
// ファイアボール — 拡大 → 爆発
// ═══════════════════════════════════════════════

function drawFireball(e: MagicEffect, d: DrawCtx): void {
  const { ctx, camOffX, camOffY, TILE_SIZE } = d;
  const sx0 = e.params.sx as number;
  const sy0 = e.params.sy as number;
  const tx  = e.params.tx as number;
  const ty  = e.params.ty as number;
  const { sx, sy } = tileToScreen(tx, ty, TILE_SIZE, camOffX, camOffY);
  const t   = e.age / e.life; // 0 → 1

  ctx.save();

  if (t < 0.5) {
    // 飛翔中：外殻橙 + 芯黄の 2 円のみ
    const p  = t / 0.5;
    const cx = sx0 + (sx - sx0) * p;
    const cy = sy0 + (sy - sy0) * p;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ff6020';
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffe080';
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 爆発：輪+芯の 2 円のみ
    const p = (t - 0.5) / 0.5;
    const r = TILE_SIZE * 0.8 * p;
    ctx.globalAlpha = Math.max(0, 1 - p) * 0.6;
    ctx.fillStyle = '#ff8040';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = Math.max(0, 1 - p);
    ctx.fillStyle = '#ffe0a0';
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════
// サンダー — ジグザグ雷
// ═══════════════════════════════════════════════

function drawThunder(e: MagicEffect, d: DrawCtx): void {
  const { ctx, camOffX, camOffY, TILE_SIZE } = d;
  const sx0 = e.params.sx0 as number;
  const sy0 = e.params.sy0 as number;
  const tx  = e.params.tx as number;
  const ty  = e.params.ty as number;
  const { sx, sy } = tileToScreen(tx, ty, TILE_SIZE, camOffX, camOffY);
  const seed = e.params.seed as number;
  const t    = e.age / e.life;

  // 1 本のジグザグ + 着弾円のみ
  ctx.save();
  const alpha = Math.max(0, 1 - t);
  const dx = sx - sx0, dy = sy - sy0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny =  dx / len;
  const segs = 6;

  ctx.beginPath();
  ctx.moveTo(sx0, sy0);
  for (let i = 1; i < segs; i++) {
    const p = i / segs;
    const bx = sx0 + dx * p;
    const by = sy0 + dy * p;
    const jitter = (Math.sin(seed * 13 + i * 3.7) + Math.cos(seed * 7 + i * 5.3)) * 8 * (1 - Math.abs(0.5 - p) * 2);
    ctx.lineTo(bx + nx * jitter, by + ny * jitter);
  }
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth   = 3 * alpha + 1;
  ctx.globalAlpha = alpha;
  ctx.stroke();

  // 着弾（黄円）
  ctx.fillStyle = '#fffce8';
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(sx, sy, 10 * alpha + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ═══════════════════════════════════════════════
// ブリザード — 氷の花びら
// ═══════════════════════════════════════════════

function drawBlizzard(e: MagicEffect, d: DrawCtx): void {
  const { ctx, camOffX, camOffY, TILE_SIZE } = d;
  const sx0 = e.params.sx0 as number;
  const sy0 = e.params.sy0 as number;
  const t   = e.age / e.life;
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  ctx.save();
  for (const [dx, dy] of dirs) {
    const reach = TILE_SIZE * 3.0 * t;
    for (let k = 0; k < 3; k++) {
      const p  = Math.min(1, t * 2 - k * 0.15);
      if (p <= 0) continue;
      const r  = reach * (0.3 + k * 0.22);
      const cx = sx0 + dx * r;
      const cy = sy0 + dy * r;
      const size = 7 * (1 - p * 0.5);

      ctx.globalAlpha = Math.max(0, 1 - p) * 0.9;
      ctx.fillStyle   = '#e0f4ff';
      drawSnowflake(ctx, cx, cy, size);
    }
  }
  ctx.restore();
}

function drawSnowflake(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * size, cy + Math.sin(a) * size);
  }
  ctx.strokeStyle = '#e0f4ff';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

// ═══════════════════════════════════════════════
// フロストノヴァ — 拡大する氷リング
// ═══════════════════════════════════════════════

function drawFrostNova(e: MagicEffect, d: DrawCtx): void {
  const { ctx, camOffX, camOffY, TILE_SIZE } = d;
  const sx0 = e.params.sx0 as number;
  const sy0 = e.params.sy0 as number;
  const range = e.params.range as number;
  const t = e.age / e.life;
  const r = (TILE_SIZE * (range + 0.5)) * t;

  // リング 1 本のみ（lighter 合成なし）
  ctx.save();
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth   = 4;
  ctx.globalAlpha = Math.max(0, 1 - t);
  ctx.beginPath();
  ctx.arc(sx0, sy0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════
// ホーリーノヴァ — 光リング + 光条
// ═══════════════════════════════════════════════

function drawHolyNova(e: MagicEffect, d: DrawCtx): void {
  const { ctx } = d;
  const sx0 = e.params.sx0 as number;
  const sy0 = e.params.sy0 as number;
  const range = e.params.range as number;
  const t = e.age / e.life;
  const r = (d.TILE_SIZE * (range + 0.5)) * t;

  // リング 1 本 + 薄塗り円（lighter 合成・グラデーション撤廃）
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t) * 0.35;
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(sx0, sy0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = Math.max(0, 1 - t);
  ctx.strokeStyle = '#fff9d0';
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.arc(sx0, sy0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════
// ホーリーストライク — 縦の光柱
// ═══════════════════════════════════════════════

function drawHolyStrike(e: MagicEffect, d: DrawCtx): void {
  const { ctx, camOffX, camOffY, TILE_SIZE, H } = d;
  const tiles = e.params.tiles as Array<{ tx: number; ty: number }>;
  if (!tiles) return;
  const t = e.age / e.life;

  // 光柱を単色塗りに、着弾は単色円
  ctx.save();
  for (const tile of tiles) {
    const { sx, sy } = tileToScreen(tile.tx, tile.ty, TILE_SIZE, camOffX, camOffY);
    const width = TILE_SIZE * 0.7 * (t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7);
    ctx.globalAlpha = Math.max(0, 1 - t) * 0.55;
    ctx.fillStyle = '#fffad0';
    ctx.fillRect(sx - width / 2, 0, width, H);
    // 着弾フラッシュ（単色円）
    const fR = 18 * (1 - t);
    if (fR > 0.5) {
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, fR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════
// アルカンレイ — 虹色の光線
// ═══════════════════════════════════════════════

function drawArcaneRay(e: MagicEffect, d: DrawCtx): void {
  const { ctx } = d;
  const sx0 = e.params.sx0 as number;
  const sy0 = e.params.sy0 as number;
  const sx1 = e.params.sx1 as number;
  const sy1 = e.params.sy1 as number;
  const t = e.age / e.life;
  const alpha = Math.max(0, 1 - t);

  // 太い紫 + 白芯の 2 本のみ（lighter 合成なし）
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth   = 10;
  ctx.globalAlpha = alpha * 0.55;
  ctx.beginPath();
  ctx.moveTo(sx0, sy0);
  ctx.lineTo(sx1, sy1);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = 3;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(sx0, sy0);
  ctx.lineTo(sx1, sy1);
  ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════
// ダークボルト — 紫の尾を引く弾
// ═══════════════════════════════════════════════

function drawDarkBolt(e: MagicEffect, d: DrawCtx): void {
  const { ctx } = d;
  const sx0 = e.params.sx0 as number;
  const sy0 = e.params.sy0 as number;
  const sx1 = e.params.sx1 as number;
  const sy1 = e.params.sy1 as number;
  const t = e.age / e.life;
  const p = Math.min(1, t * 1.5);
  const cx = sx0 + (sx1 - sx0) * p;
  const cy = sy0 + (sy1 - sy0) * p;

  ctx.save();
  // 尾（単色半透明）
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth   = 6;
  ctx.lineCap     = 'round';
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(sx0, sy0);
  ctx.lineTo(cx, cy);
  ctx.stroke();

  // 弾頭（単色円 2 枚）
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#c084fc';
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ═══════════════════════════════════════════════
// マナバースト — 魔法陣 + 爆発
// ═══════════════════════════════════════════════

function drawManaBurst(e: MagicEffect, d: DrawCtx): void {
  const { ctx } = d;
  const sx0 = e.params.sx0 as number;
  const sy0 = e.params.sy0 as number;
  const range = (e.params.range as number) || 3;
  const t = e.age / e.life;
  const R = d.TILE_SIZE * (range + 0.5);

  // 魔法陣 1 円 + 三角（ルーン点なし、lighter 合成なし）
  ctx.save();
  const circleR = R * 0.45 * (0.3 + t * 0.7);
  ctx.translate(sx0, sy0);
  ctx.rotate(t * Math.PI * 2);
  ctx.strokeStyle = '#d8b4fe';
  ctx.lineWidth   = 2;
  ctx.globalAlpha = Math.max(0, 1 - t) * 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, circleR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const x = Math.cos(a) * circleR;
    const y = Math.sin(a) * circleR;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.rotate(-t * Math.PI * 2);

  // 爆発（単色円のみ）
  if (t > 0.4) {
    const p = (t - 0.4) / 0.6;
    const r = R * p;
    ctx.globalAlpha = (1 - p) * 0.45;
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════
// グラビティ — 重力歪み
// ═══════════════════════════════════════════════

function drawGravity(e: MagicEffect, d: DrawCtx): void {
  const { ctx, W, H } = d;
  const t = e.age / e.life;
  const alpha = Math.max(0, (1 - Math.abs(t - 0.5) * 2)) * 0.35;

  // 全画面のうっすら紫フラッシュだけ（multiply/lighter なし）
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#312e81';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // 中央に薄いリング 2 本のみ
  ctx.save();
  const cx = W / 2;
  const cy = H / 2;
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 2;
  for (let k = 0; k < 2; k++) {
    const r = 40 + k * 30 + t * 50;
    ctx.globalAlpha = Math.max(0, 1 - t) * (0.5 - k * 0.15);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════
// ヴォイドリフト — 闇の裂け目
// ═══════════════════════════════════════════════

function drawVoidRift(e: MagicEffect, d: DrawCtx): void {
  const { ctx, W, H } = d;
  const t = e.age / e.life;
  // 画面暗転を軽く
  ctx.save();
  ctx.globalAlpha = 0.3 * (1 - Math.abs(t - 0.5) * 2);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const rifts = e.params.rifts as number[];
  if (!rifts) return;
  ctx.save();
  const alpha = Math.max(0, Math.sin(t * Math.PI));
  // 紫 + 白の 2 パスだけ（lighter なし）
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth   = 3 * alpha;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  for (let i = 0; i < rifts.length; i += 4) {
    ctx.moveTo(rifts[i], rifts[i + 1]);
    ctx.lineTo(rifts[i + 2], rifts[i + 3]);
  }
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = 1 * alpha;
  ctx.beginPath();
  for (let i = 0; i < rifts.length; i += 4) {
    ctx.moveTo(rifts[i], rifts[i + 1]);
    ctx.lineTo(rifts[i + 2], rifts[i + 3]);
  }
  ctx.stroke();
  ctx.restore();
}

// ═══════════════════════════════════════════════
// クエイク — 地割れ
// ═══════════════════════════════════════════════

function drawQuake(e: MagicEffect, d: DrawCtx): void {
  const { ctx, W, H } = d;
  const t = e.age / e.life;
  const alpha = Math.max(0, 1 - t);
  const cracks = e.params.cracks as number[];
  if (!cracks) return;

  ctx.save();
  // 地割れライン（shadowBlur なし、1 パス）
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#422006';
  ctx.lineWidth   = 3;
  ctx.beginPath();
  for (let i = 0; i < cracks.length; i += 4) {
    ctx.moveTo(cracks[i], cracks[i + 1]);
    const x1 = cracks[i + 2];
    const y1 = cracks[i + 3];
    const mx = (cracks[i] + x1) / 2 + (Math.sin(i) * 12);
    const my = (cracks[i + 1] + y1) / 2 + (Math.cos(i) * 12);
    ctx.lineTo(mx, my);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
  ctx.restore();
  void W; void H;
}

// ═══════════════════════════════════════════════
// 汎用リング（未定義呪文のフォールバック）
// ═══════════════════════════════════════════════

function drawGenericRing(e: MagicEffect, d: DrawCtx): void {
  const { ctx } = d;
  const sx0 = e.params.sx0 as number;
  const sy0 = e.params.sy0 as number;
  const color = e.params.color as string;
  const range = (e.params.range as number) || 2;
  const t = e.age / e.life;
  const r = d.TILE_SIZE * (range + 0.5) * t;

  // 単色リング 1 本のみ（lighter 合成なし）
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 3;
  ctx.globalAlpha = Math.max(0, 1 - t);
  ctx.beginPath();
  ctx.arc(sx0, sy0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
