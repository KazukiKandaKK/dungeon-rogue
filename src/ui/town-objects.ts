// ─────────────────────────────────────────────
// town-objects.ts  ファンタジー壮大プロップ（MMO級建造物）
//
// タイル 3〜4 段級の巨大建造物を SVG Path2D で組み上げ、
// 浮遊ルーン・光柱・舞い散る魔素で王都の景観を演出する。
// ─────────────────────────────────────────────

'use strict';

import { roundRect } from '../ui/hud.js';
import { TILE_SIZE } from '../world/tiles.js';
import { DUNGEONS } from '../world/dungeon_defs.js';
import type { DungeonDef } from '../world/dungeon_defs.js';

// ─── SVG パス（論理座標 -1..+1、中央原点） ──────

/** 大聖堂アーチ（二段アーチ+尖塔ベース） */
const GREAT_ARCH = new Path2D(
  // 外郭
  'M -0.80 0.70 L -0.80 -0.30 ' +
  'C -0.80 -0.85  0.80 -0.85  0.80 -0.30 ' +
  'L 0.80 0.70 ' +
  'L 0.55 0.70 L 0.55 -0.25 ' +
  'C 0.55 -0.60 -0.55 -0.60 -0.55 -0.25 ' +
  'L -0.55 0.70 Z'
);

/** 尖塔の頂点（上向き三角の塔） */
const SPIRE = new Path2D(
  'M -0.12 0.00 L 0.00 -0.85 L 0.12 0.00 Z'
);

/** ガーゴイル（翼を広げた守護像の簡略シルエット） */
const GARGOYLE = new Path2D(
  // 胴
  'M -0.10 0.20 L -0.20 0.05 L -0.18 -0.10 L -0.05 -0.18 ' +
  'L 0.05 -0.18 L 0.18 -0.10 L 0.20 0.05 L 0.10 0.20 Z ' +
  // 頭の角
  'M -0.08 -0.18 L -0.14 -0.32 L -0.02 -0.22 Z ' +
  'M  0.08 -0.18 L  0.14 -0.32 L  0.02 -0.22 Z ' +
  // 左翼
  'M -0.20 -0.05 L -0.55 -0.20 L -0.50 0.00 L -0.30 0.10 Z ' +
  // 右翼
  'M  0.20 -0.05 L  0.55 -0.20 L  0.50 0.00 L  0.30 0.10 Z'
);

/** 旗竿から垂れるバナー（吹き流し。描画時に波打ち加工） */
const BANNER_BASE = new Path2D(
  'M -0.40 -0.10 L 0.40 -0.10 L 0.40 0.55 L 0.20 0.70 L 0.00 0.55 L -0.20 0.70 L -0.40 0.55 Z'
);

/** ドラゴン頭の横顔（アーチ両端の飾り） */
const DRAGON_HEAD = new Path2D(
  'M -0.50 0.10 L -0.30 -0.15 L -0.05 -0.25 L 0.20 -0.20 L 0.45 -0.05 ' +
  'L 0.50 0.10 L 0.40 0.15 L 0.30 0.08 L 0.20 0.15 L 0.10 0.05 ' +
  'L 0.00 0.15 L -0.15 0.10 L -0.30 0.22 L -0.45 0.18 Z'
);

/** 六角形 */
const HEX = (() => {
  const p = new Path2D();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) p.moveTo(Math.cos(a), Math.sin(a));
    else         p.lineTo(Math.cos(a), Math.sin(a));
  }
  p.closePath();
  return p;
})();

/** 五芒星（連続線） */
const PENTAGRAM = (() => {
  const p = new Path2D();
  const pts: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    pts.push([Math.cos(a), Math.sin(a)]);
  }
  const order = [0, 2, 4, 1, 3];
  for (let i = 0; i < order.length; i++) {
    const [x, y] = pts[order[i]];
    if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
  }
  p.closePath();
  return p;
})();

/** 大聖堂のバラ窓 */
const ROSE_WINDOW = (() => {
  const p = new Path2D();
  p.arc(0, 0, 1, 0, Math.PI * 2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.cos(a) * 0.6, y = Math.sin(a) * 0.6;
    p.moveTo(x, y);
    p.arc(x, y, 0.3, 0, Math.PI * 2);
  }
  return p;
})();

/** 2階建て酒場のシルエット */
const INN_BODY = new Path2D(
  'M -0.85 0.70 L -0.85 -0.15 L -0.60 -0.15 L -0.60 -0.45 ' +
  'L -0.30 -0.45 L -0.30 -0.15 L 0.30 -0.15 L 0.30 -0.45 ' +
  'L 0.60 -0.45 L 0.60 -0.15 L 0.85 -0.15 L 0.85 0.70 Z'
);

/** 酒場の屋根（ギャンブレル風） */
const INN_ROOF = new Path2D(
  'M -0.95 -0.15 L -0.70 -0.45 L -0.45 -0.55 L -0.45 -0.70 ' +
  'L 0.45 -0.70 L 0.45 -0.55 L 0.70 -0.45 L 0.95 -0.15 Z'
);

/** 行商キャラバンの幌（大きめドーム） */
const CANOPY = new Path2D(
  'M -0.70 0.10 ' +
  'C -0.70 -0.60  0.70 -0.60  0.70 0.10 ' +
  'L 0.70 0.18 L -0.70 0.18 Z'
);

/** オベリスク */
const OBELISK = new Path2D(
  'M -0.14 0.55 L -0.10 -0.60 L 0.00 -0.82 L 0.10 -0.60 L 0.14 0.55 Z'
);

// ─── 共通ヘルパ ──────────────────────────────────

function withScale(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, s: number,
  fn: () => void,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  fn();
  ctx.restore();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  text: string, color: string, sub?: string,
): void {
  ctx.save();
  ctx.font = 'bold 14px "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.max(96, ctx.measureText(text).width + 24);
  const g = ctx.createLinearGradient(cx - w / 2, cy - 14, cx + w / 2, cy + 14);
  g.addColorStop(0, 'rgba(12,6,25,0.92)');
  g.addColorStop(1, 'rgba(30,15,55,0.92)');
  ctx.fillStyle = g;
  roundRect(ctx, cx - w / 2, cy - 14, w, 28, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(252,211,77,0.55)';
  ctx.lineWidth = 1.2;
  roundRect(ctx, cx - w / 2, cy - 14, w, 28, 10);
  ctx.stroke();
  // 角の飾り
  ctx.fillStyle = 'rgba(252,211,77,0.8)';
  for (const [dx, dy] of [[-w / 2 + 6, 0], [w / 2 - 6, 0]]) {
    ctx.beginPath(); ctx.arc(cx + dx, cy, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillText(text, cx, cy);
  if (sub) {
    ctx.shadowBlur = 0;
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#fde68a';
    ctx.fillText(sub, cx, cy + 22);
  }
  ctx.restore();
}

function isDungeonUnlocked(id: string, cleared: Set<string>): boolean {
  const idx = DUNGEONS.findIndex(d => d.id === id);
  if (idx <= 0) return true;
  return cleared.has(DUNGEONS[idx - 1].id);
}

// 松明
function drawTorch(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, ts: number, now: number, seed: number,
): void {
  const flick = Math.sin(now * 10 + seed) * 0.5 + 0.5;
  ctx.save();
  // ブラケット
  ctx.fillStyle = '#2b1c10';
  ctx.fillRect(cx - ts * 0.04, cy - ts * 0.02, ts * 0.08, ts * 0.42);
  ctx.fillStyle = '#5a4024';
  roundRect(ctx, cx - ts * 0.11, cy - ts * 0.08, ts * 0.22, ts * 0.10, 3);
  ctx.fill();
  // 炎
  ctx.shadowColor = '#fb923c';
  ctx.shadowBlur = 22 + flick * 18;
  ctx.fillStyle = '#f87171';
  ctx.beginPath();
  ctx.ellipse(cx, cy - ts * 0.22, ts * 0.12, ts * 0.26 + flick * ts * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fb923c';
  ctx.beginPath();
  ctx.ellipse(cx, cy - ts * 0.24, ts * 0.08, ts * 0.18 + flick * ts * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.ellipse(cx, cy - ts * 0.25, ts * 0.04, ts * 0.10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 浮遊する魔素（光の粒）
function drawDriftingMotes(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number, count: number, color: string, now: number, seed: number,
): void {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const phase = (now * 0.6 + i * 1.3 + seed) % 1;
    const a = (i / count) * Math.PI * 2 + seed;
    const r = radius * (0.3 + phase * 0.8);
    const x = cx + Math.cos(a) * r;
    const y = cy - phase * radius * 1.1 + Math.sin(a * 3) * 3;
    const alpha = (1 - phase) * 0.9;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, 1.8 + Math.sin(now * 3 + i) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 光柱（ボリュームライト）
function drawLightBeam(
  ctx: CanvasRenderingContext2D,
  cx: number, topY: number, baseY: number, halfW: number, color: string, alpha: number,
): void {
  ctx.save();
  const g = ctx.createLinearGradient(cx, topY, cx, baseY);
  g.addColorStop(0, color + '00');
  g.addColorStop(0.5, color + '55');
  g.addColorStop(1, color + '00');
  ctx.fillStyle = g;
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.moveTo(cx - halfW * 0.3, topY);
  ctx.lineTo(cx + halfW * 0.3, topY);
  ctx.lineTo(cx + halfW, baseY);
  ctx.lineTo(cx - halfW, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ─── ダンジョン入口（3タイル幅×3タイル高の大聖堂門） ───

export function drawDungeonPortal(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number, now: number,
  dungeon: DungeonDef, unlocked: boolean, hovered: boolean, seed: number,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(now * 1.8 + seed);
  const rot   = now * 0.5 + seed;
  const color = unlocked ? dungeon.color : '#475569';

  // ─ 地面の魔法陣（ポータル直下の影陣）─
  if (unlocked) {
    ctx.save();
    ctx.translate(cx, cy + ts * 0.65);
    ctx.scale(1, 0.35);
    const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, ts * 0.9);
    gg.addColorStop(0, color + 'aa');
    gg.addColorStop(0.7, color + '22');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.globalAlpha = 0.5 + 0.3 * pulse;
    ctx.beginPath(); ctx.arc(0, 0, ts * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ─ 石段（3段）─
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const w = ts * (1.6 - i * 0.15);
    const h = ts * 0.10;
    const y = cy + ts * 0.50 - i * h * 0.95;
    const g = ctx.createLinearGradient(cx, y, cx, y + h);
    g.addColorStop(0, '#8a7560');
    g.addColorStop(1, '#3d2f20');
    ctx.fillStyle = g;
    roundRect(ctx, cx - w / 2, y, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = '#1a120c';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  // ─ 光柱（奥から立ち昇る光）─
  if (unlocked) {
    drawLightBeam(ctx, cx, cy - ts * 2.5, cy + ts * 0.2, ts * 0.5, color, 0.4 + 0.3 * pulse);
  }

  // ─ 大聖堂アーチ本体（タイル3段分） ─
  withScale(ctx, cx, cy - ts * 0.25, ts * 1.9, () => {
    // 影
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.translate(0.02, 0.04);
    ctx.fill(GREAT_ARCH);
    ctx.restore();
    // 石のグラデ
    const g = ctx.createLinearGradient(0, -0.85, 0, 0.70);
    g.addColorStop(0, '#9a8672');
    g.addColorStop(0.3, '#6a5540');
    g.addColorStop(0.7, '#3e2f20');
    g.addColorStop(1, '#1f1810');
    ctx.fillStyle = g;
    ctx.fill(GREAT_ARCH);
    ctx.strokeStyle = '#100a06';
    ctx.lineWidth = 0.022;
    ctx.stroke(GREAT_ARCH);
    // 石の目地（横）
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.015;
    for (let yy = -0.18; yy < 0.68; yy += 0.12) {
      ctx.beginPath();
      ctx.moveTo(-0.80, yy); ctx.lineTo(-0.55, yy);
      ctx.moveTo(0.55, yy);  ctx.lineTo(0.80, yy);
      ctx.stroke();
    }
    // 柱の装飾帯（上下）
    ctx.fillStyle = color + 'cc';
    ctx.fillRect(-0.82, -0.08, 0.27, 0.04);
    ctx.fillRect( 0.55, -0.08, 0.27, 0.04);
    ctx.fillRect(-0.82,  0.54, 0.27, 0.05);
    ctx.fillRect( 0.55,  0.54, 0.27, 0.05);
    // キーストーン（楔石）
    const kg = ctx.createLinearGradient(0, -0.52, 0, -0.25);
    kg.addColorStop(0, color);
    kg.addColorStop(1, '#1a120c');
    ctx.fillStyle = kg;
    ctx.beginPath();
    ctx.moveTo(-0.14, -0.25);
    ctx.lineTo(0.14, -0.25);
    ctx.lineTo(0.10, -0.55);
    ctx.lineTo(-0.10, -0.55);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#100a06';
    ctx.lineWidth = 0.018;
    ctx.stroke();
  });

  // ─ 尖塔（左右） ─
  for (const side of [-1, 1]) {
    withScale(ctx, cx + side * ts * 1.30, cy - ts * 0.85, ts * 0.35, () => {
      const g = ctx.createLinearGradient(0, -0.85, 0, 0);
      g.addColorStop(0, color);
      g.addColorStop(1, '#2a2018');
      ctx.fillStyle = g;
      ctx.fill(SPIRE);
      ctx.strokeStyle = '#100a06';
      ctx.lineWidth = 0.04;
      ctx.stroke(SPIRE);
    });
  }

  // ─ ドラゴンヘッドの飾り（アーチ両肩） ─
  for (const side of [-1, 1]) {
    withScale(ctx, cx + side * ts * 0.85, cy - ts * 0.72, ts * 0.55 * -side, () => {
      const g = ctx.createLinearGradient(0, -0.25, 0, 0.15);
      g.addColorStop(0, color);
      g.addColorStop(1, '#1a120c');
      ctx.fillStyle = g;
      ctx.fill(DRAGON_HEAD);
      ctx.strokeStyle = '#100a06';
      ctx.lineWidth = 0.025;
      ctx.stroke(DRAGON_HEAD);
      // 目
      ctx.fillStyle = '#fde68a';
      ctx.shadowColor = '#fde68a';
      ctx.shadowBlur = 0.15;
      ctx.beginPath(); ctx.arc(0.15, -0.10, 0.035, 0, Math.PI * 2); ctx.fill();
    });
  }

  // ─ ガーゴイル（尖塔の根元左右）─
  for (const side of [-1, 1]) {
    withScale(ctx, cx + side * ts * 1.30, cy - ts * 0.48, ts * 0.42 * side, () => {
      ctx.fillStyle = 'rgba(30,22,15,0.95)';
      ctx.fill(GARGOYLE);
      ctx.strokeStyle = '#100a06';
      ctx.lineWidth = 0.025;
      ctx.stroke(GARGOYLE);
      // 目
      ctx.fillStyle = '#dc2626';
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 0.3;
      ctx.beginPath(); ctx.arc(-0.05, -0.22, 0.02, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 0.05, -0.22, 0.02, 0, Math.PI * 2); ctx.fill();
    });
  }

  // ─ ポータルの空洞（アーチの内側）：渦巻く光 ─
  const pY = cy - ts * 0.30;
  if (unlocked) {
    // 外側グロー
    const og = ctx.createRadialGradient(cx, pY, 0, cx, pY, ts * 0.85);
    og.addColorStop(0, color + 'ff');
    og.addColorStop(0.4, color + '99');
    og.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.35 * pulse;
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(cx, pY, ts * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 渦巻き（複数の同心楕円を回転）
    ctx.save();
    ctx.translate(cx, pY);
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(rot * (1 + i * 0.2) + i * 0.3);
      ctx.globalAlpha = 0.25 + 0.15 * pulse;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, ts * (0.58 - i * 0.07), ts * (0.42 - i * 0.05), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // 外周の回転六角＋逆回転五芒星
    withScale(ctx, cx, pY, ts * 0.58, () => {
      ctx.rotate(rot);
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.05;
      ctx.stroke(HEX);
    });
    withScale(ctx, cx, pY, ts * 0.40, () => {
      ctx.rotate(-rot * 1.5);
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 0.06;
      ctx.stroke(PENTAGRAM);
    });

    // 軌道上を周回するルーン文字
    const runes = '✦❈⟡☽✧✵';
    ctx.save();
    ctx.font = `${ts * 0.18}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 6; i++) {
      const a = rot * 1.2 + (i / 6) * Math.PI * 2;
      const rx = cx + Math.cos(a) * ts * 0.52;
      const ry = pY + Math.sin(a) * ts * 0.35;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = 0.8;
      ctx.fillText(runes[i], rx, ry);
    }
    ctx.restore();

    // 中央の深い虚空
    const cg = ctx.createRadialGradient(cx, pY, 0, cx, pY, ts * 0.28);
    cg.addColorStop(0, '#000');
    cg.addColorStop(0.7, 'rgba(0,0,0,0.9)');
    cg.addColorStop(1, color);
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx, pY, ts * 0.28, 0, Math.PI * 2); ctx.fill();

    // 立ち昇る魔素
    drawDriftingMotes(ctx, cx, pY + ts * 0.2, ts * 0.8, 14, color, now, seed);
  } else {
    // 封印：鎖＆錠前
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,12,0.95)';
    ctx.beginPath(); ctx.arc(cx, pY, ts * 0.45, 0, Math.PI * 2); ctx.fill();
    // 鎖
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * ts * 0.42, pY + Math.sin(a) * ts * 0.42);
      ctx.lineTo(cx - Math.cos(a) * ts * 0.42, pY - Math.sin(a) * ts * 0.42);
      ctx.stroke();
    }
    ctx.font = `${ts * 0.36}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔒', cx, pY);
    ctx.restore();
  }

  // ─ 旗（両脇に大きく2本） ─
  for (const side of [-1, 1]) {
    const fx = cx + side * ts * 1.05;
    const fy = cy - ts * 1.15;
    // 旗竿
    ctx.save();
    ctx.strokeStyle = '#1f1410';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, cy - ts * 0.15); ctx.stroke();
    // 旗頭（球）
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(fx, fy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 波打つ旗
    withScale(ctx, fx, fy + ts * 0.3, ts * 0.55 * side, () => {
      ctx.save();
      const wave = Math.sin(now * 3 + side) * 0.05;
      ctx.transform(1, wave, 0, 1, 0, 0);
      const g = ctx.createLinearGradient(0, -0.1, 0, 0.7);
      g.addColorStop(0, color);
      g.addColorStop(1, '#0a0608');
      ctx.fillStyle = g;
      ctx.fill(BANNER_BASE);
      ctx.strokeStyle = '#0a0608';
      ctx.lineWidth = 0.025;
      ctx.stroke(BANNER_BASE);
      // 紋章
      ctx.font = '0.28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(unlocked ? dungeon.emoji : '🔒', 0, 0.22);
      ctx.restore();
    });
  }

  // ─ 松明（柱の内側に2本） ─
  drawTorch(ctx, cx - ts * 0.90, cy - ts * 0.05, ts, now, seed);
  drawTorch(ctx, cx + ts * 0.90, cy - ts * 0.05, ts, now, seed + 1.3);

  // ─ 名札 ─
  const sub = unlocked
    ? (hovered ? '[E] 入る' : '')
    : (hovered ? '🔒 前のダンジョンをクリア' : '');
  drawLabel(ctx, cx, cy + ts * 0.82, dungeon.name, color, sub);
}

// ─── 酒場（2階建て・煙突・看板） ───

export function drawTavern(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number, now: number, hovered: boolean,
): void {
  const sway = Math.sin(now * 1.4) * 0.04;
  const smokeT = (now * 0.8) % 1;

  // 影
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + ts * 0.72, ts * 1.0, ts * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 本体
  withScale(ctx, cx, cy, ts * 1.4, () => {
    const g = ctx.createLinearGradient(0, -0.15, 0, 0.70);
    g.addColorStop(0, '#a0693a');
    g.addColorStop(1, '#3a2211');
    ctx.fillStyle = g;
    ctx.fill(INN_BODY);
    ctx.strokeStyle = '#1a0f05';
    ctx.lineWidth = 0.02;
    ctx.stroke(INN_BODY);
    // 板目
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.01;
    for (let i = 1; i < 7; i++) {
      const y = -0.15 + i * 0.12;
      ctx.beginPath(); ctx.moveTo(-0.85, y); ctx.lineTo(0.85, y); ctx.stroke();
    }
    // 木骨
    ctx.strokeStyle = '#1a0f05';
    ctx.lineWidth = 0.018;
    for (const vx of [-0.5, -0.1, 0.1, 0.5]) {
      ctx.beginPath(); ctx.moveTo(vx, -0.15); ctx.lineTo(vx, 0.70); ctx.stroke();
    }
  });

  // 屋根（ギャンブレル）
  withScale(ctx, cx, cy, ts * 1.4, () => {
    const rg = ctx.createLinearGradient(0, -0.70, 0, -0.15);
    rg.addColorStop(0, '#b45309');
    rg.addColorStop(1, '#6b2e08');
    ctx.fillStyle = rg;
    ctx.fill(INN_ROOF);
    ctx.strokeStyle = '#1a0f05';
    ctx.lineWidth = 0.022;
    ctx.stroke(INN_ROOF);
    // 瓦のテクスチャ
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.012;
    for (let i = -9; i <= 9; i++) {
      const x = i * 0.1;
      ctx.beginPath();
      ctx.moveTo(x, -0.15);
      ctx.lineTo(x + 0.02, -0.70);
      ctx.stroke();
    }
    // 棟飾り
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(0, -0.78);
    ctx.lineTo(0.04, -0.72);
    ctx.lineTo(0, -0.65);
    ctx.lineTo(-0.04, -0.72);
    ctx.closePath();
    ctx.fill();
  });

  // 屋根の旗（小）
  ctx.save();
  ctx.translate(cx, cy - ts * 1.1);
  ctx.strokeStyle = '#1a0f05';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, ts * 0.25); ctx.stroke();
  ctx.fillStyle = '#dc2626';
  const wave = Math.sin(now * 3) * 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(ts * 0.25, ts * 0.06);
  ctx.lineTo(ts * 0.28 + wave, ts * 0.14);
  ctx.lineTo(0, ts * 0.14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 煙突 + 煙
  ctx.save();
  ctx.fillStyle = '#292524';
  ctx.fillRect(cx + ts * 0.55, cy - ts * 0.85, ts * 0.16, ts * 0.32);
  ctx.fillStyle = '#b45309';
  ctx.fillRect(cx + ts * 0.53, cy - ts * 0.89, ts * 0.20, ts * 0.05);
  // 煙（3粒）
  for (let i = 0; i < 3; i++) {
    const t = (smokeT + i / 3) % 1;
    const sy = cy - ts * 0.85 - t * ts * 1.2;
    const sx = cx + ts * 0.63 + Math.sin(t * Math.PI * 2 + i) * ts * 0.15;
    ctx.globalAlpha = (1 - t) * 0.7;
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(sx, sy, ts * (0.06 + t * 0.08), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 1階：光る窓 + 扉
  const windowPositions = [-0.55, -0.15, 0.45];
  for (const wx of windowPositions) {
    const windowX = cx + wx * ts * 1.4 * 0.7;
    const windowY = cy + ts * 0.25;
    ctx.save();
    const wg = ctx.createRadialGradient(windowX, windowY, 0, windowX, windowY, ts * 0.2);
    wg.addColorStop(0, '#fde68a');
    wg.addColorStop(0.7, '#b45309');
    wg.addColorStop(1, '#3a2211');
    ctx.fillStyle = wg;
    roundRect(ctx, windowX - ts * 0.12, windowY - ts * 0.12, ts * 0.24, ts * 0.24, 3);
    ctx.fill();
    ctx.strokeStyle = '#1a0f05';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 十字桟
    ctx.beginPath();
    ctx.moveTo(windowX, windowY - ts * 0.12); ctx.lineTo(windowX, windowY + ts * 0.12);
    ctx.moveTo(windowX - ts * 0.12, windowY); ctx.lineTo(windowX + ts * 0.12, windowY);
    ctx.stroke();
    ctx.restore();
  }

  // ドア（光漏れ）
  ctx.save();
  const dg = ctx.createLinearGradient(cx + ts * 0.22, cy + ts * 0.3, cx + ts * 0.22, cy + ts * 0.95);
  dg.addColorStop(0, '#fde68a');
  dg.addColorStop(0.2, '#b45309');
  dg.addColorStop(1, '#1a0f05');
  ctx.fillStyle = dg;
  roundRect(ctx, cx + ts * 0.08, cy + ts * 0.30, ts * 0.30, ts * 0.68, 6);
  ctx.fill();
  ctx.strokeStyle = '#1a0f05';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(cx + ts * 0.32, cy + ts * 0.62, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // 吊り看板
  ctx.save();
  ctx.translate(cx - ts * 0.75, cy);
  ctx.rotate(sway);
  // チェーン
  ctx.strokeStyle = '#44403c';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -ts * 0.30); ctx.lineTo(0, 0); ctx.stroke();
  // 看板枠
  ctx.fillStyle = '#3f2712';
  roundRect(ctx, -ts * 0.22, 0, ts * 0.44, ts * 0.32, 6);
  ctx.fill();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 装飾コーナー
  ctx.fillStyle = '#fbbf24';
  for (const [dx, dy] of [[-ts * 0.20, 4], [ts * 0.20, 4], [-ts * 0.20, ts * 0.28], [ts * 0.20, ts * 0.28]]) {
    ctx.beginPath(); ctx.arc(dx, dy, 2, 0, Math.PI * 2); ctx.fill();
  }
  // アイコン
  ctx.font = `${ts * 0.22}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🍺', 0, ts * 0.16);
  ctx.restore();

  // 店先ランプ
  ctx.save();
  ctx.strokeStyle = '#292524';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx + ts * 0.42, cy - ts * 0.20); ctx.lineTo(cx + ts * 0.42, cy + ts * 0.05); ctx.stroke();
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.arc(cx + ts * 0.42, cy + ts * 0.12, ts * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  drawLabel(ctx, cx, cy + ts * 0.95, '冒険酒場 "勇者の止まり木"', '#fde68a', hovered ? '[E] のぞく' : '');
}

// ─── 行商人（豪華キャラバン + 焚き火 + 商品棚） ───

export function drawTrader(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number, now: number, hovered: boolean,
): void {
  const flick = Math.sin(now * 9) * 0.5 + 0.5;

  // 影
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + ts * 0.72, ts * 1.0, ts * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // キャラバン荷台
  ctx.save();
  const cg = ctx.createLinearGradient(cx, cy + ts * 0.05, cx, cy + ts * 0.55);
  cg.addColorStop(0, '#92400e');
  cg.addColorStop(1, '#3a1004');
  ctx.fillStyle = cg;
  roundRect(ctx, cx - ts * 0.75, cy + ts * 0.05, ts * 1.5, ts * 0.50, 6);
  ctx.fill();
  ctx.strokeStyle = '#1a0604';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 板目
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  for (let i = -4; i <= 4; i++) {
    const x = cx + i * ts * 0.18;
    ctx.beginPath(); ctx.moveTo(x, cy + ts * 0.05); ctx.lineTo(x, cy + ts * 0.55); ctx.stroke();
  }
  // 金の装飾
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - ts * 0.72, cy + ts * 0.12); ctx.lineTo(cx + ts * 0.72, cy + ts * 0.12);
  ctx.moveTo(cx - ts * 0.72, cy + ts * 0.48); ctx.lineTo(cx + ts * 0.72, cy + ts * 0.48);
  ctx.stroke();
  ctx.restore();

  // 車輪 4 つ（手前側2、奥側2）
  for (const [side, z] of [[-1, 1], [1, 1], [-0.4, 0.95], [0.4, 0.95]] as const) {
    const wx = cx + side * ts * 0.5;
    const wy = cy + ts * 0.6;
    const r  = ts * 0.14 * z;
    ctx.save();
    ctx.fillStyle = '#1c1917';
    ctx.beginPath(); ctx.arc(wx, wy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f2712';
    ctx.beginPath(); ctx.arc(wx, wy, r * 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.cos(a) * r * 0.75, wy + Math.sin(a) * r * 0.75);
      ctx.stroke();
    }
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(wx, wy, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 大幌
  withScale(ctx, cx, cy, ts * 1.5, () => {
    const gr = ctx.createLinearGradient(0, -0.55, 0, 0.18);
    gr.addColorStop(0, '#10b981');
    gr.addColorStop(1, '#064e3b');
    ctx.fillStyle = gr;
    ctx.fill(CANOPY);
    ctx.strokeStyle = '#022c22';
    ctx.lineWidth = 0.018;
    ctx.stroke(CANOPY);
    // 縞模様
    ctx.strokeStyle = 'rgba(253,230,138,0.75)';
    ctx.lineWidth = 0.028;
    for (let i = -6; i <= 6; i++) {
      const sx = i * 0.1;
      ctx.beginPath();
      ctx.moveTo(sx, 0.10);
      ctx.quadraticCurveTo(sx * 1.2, -0.55, sx * 0.4, -0.55);
      ctx.stroke();
    }
    // 棟飾り
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(-0.70, -0.20, 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 0.70, -0.20, 0.035, 0, Math.PI * 2); ctx.fill();
  });

  // 幌のバンティング（三角旗の連なり）
  ctx.save();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - ts * 0.70, cy - ts * 0.35);
  ctx.quadraticCurveTo(cx, cy - ts * 0.22, cx + ts * 0.70, cy - ts * 0.35);
  ctx.stroke();
  const buntColors = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa'];
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const ax = cx - ts * 0.70 + t * ts * 1.40;
    const ay = cy - ts * 0.35 + Math.sin(t * Math.PI) * -ts * 0.13;
    ctx.fillStyle = buntColors[i % buntColors.length];
    ctx.beginPath();
    ctx.moveTo(ax - 3, ay);
    ctx.lineTo(ax + 3, ay);
    ctx.lineTo(ax, ay + ts * 0.08);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 商品：樽・宝箱・ポーション棚
  ctx.save();
  // 樽
  ctx.fillStyle = '#78350f';
  roundRect(ctx, cx - ts * 0.55, cy + ts * 0.10, ts * 0.18, ts * 0.28, 3);
  ctx.fill();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(cx - ts * 0.55, cy + ts * 0.18); ctx.lineTo(cx - ts * 0.37, cy + ts * 0.18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - ts * 0.55, cy + ts * 0.30); ctx.lineTo(cx - ts * 0.37, cy + ts * 0.30); ctx.stroke();
  // 宝箱
  ctx.fillStyle = '#b45309';
  roundRect(ctx, cx - ts * 0.18, cy + ts * 0.18, ts * 0.28, ts * 0.22, 3);
  ctx.fill();
  ctx.fillStyle = '#fde68a';
  roundRect(ctx, cx - ts * 0.18, cy + ts * 0.18, ts * 0.28, ts * 0.07, 3);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(cx - ts * 0.04, cy + ts * 0.30, 3, 0, Math.PI * 2); ctx.fill();
  // ポーション（3本）
  for (let i = 0; i < 3; i++) {
    const px = cx + ts * 0.20 + i * ts * 0.12;
    const py = cy + ts * 0.26;
    ctx.fillStyle = ['#ef4444', '#3b82f6', '#22c55e'][i];
    ctx.shadowColor = ['#ef4444', '#3b82f6', '#22c55e'][i];
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(px, py, ts * 0.04, ts * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(px - ts * 0.015, py - ts * 0.12, ts * 0.03, ts * 0.06);
  }
  ctx.restore();

  // 焚き火（隣に）
  const fx = cx - ts * 0.95;
  const fy = cy + ts * 0.55;
  ctx.save();
  // 石の輪
  ctx.fillStyle = '#57534e';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const sx = fx + Math.cos(a) * ts * 0.18;
    const sy = fy + Math.sin(a) * ts * 0.06;
    ctx.beginPath(); ctx.arc(sx, sy, ts * 0.05, 0, Math.PI * 2); ctx.fill();
  }
  // 薪
  ctx.strokeStyle = '#44403c';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(fx - ts * 0.12, fy - ts * 0.03); ctx.lineTo(fx + ts * 0.12, fy + ts * 0.05); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(fx - ts * 0.10, fy + ts * 0.05); ctx.lineTo(fx + ts * 0.10, fy - ts * 0.03); ctx.stroke();
  // 炎
  ctx.shadowColor = '#fb923c';
  ctx.shadowBlur = 20 + flick * 12;
  ctx.fillStyle = '#f87171';
  ctx.beginPath();
  ctx.ellipse(fx, fy - ts * 0.15, ts * 0.12, ts * 0.22 + flick * ts * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fb923c';
  ctx.beginPath();
  ctx.ellipse(fx, fy - ts * 0.17, ts * 0.08, ts * 0.17 + flick * ts * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.ellipse(fx, fy - ts * 0.19, ts * 0.04, ts * 0.10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 吊りランプ
  ctx.save();
  ctx.strokeStyle = '#292524';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx + ts * 0.62, cy - ts * 0.40); ctx.lineTo(cx + ts * 0.62, cy - ts * 0.10); ctx.stroke();
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.arc(cx + ts * 0.62, cy - ts * 0.04, ts * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  drawLabel(ctx, cx, cy + ts * 0.95, '流浪の行商人キャラバン', '#86efac', hovered ? '[E] 話す' : '');
}

// ─── 中央広場のモニュメント（発光オベリスク） ───

export function drawMonument(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number, now: number,
): void {
  const pulse = 0.55 + 0.45 * Math.sin(now * 1.6);
  const rot   = now * 0.4;

  // ─ 広場の円石 ─
  ctx.save();
  const pg = ctx.createRadialGradient(cx, cy + ts * 0.6, 0, cx, cy + ts * 0.6, ts * 1.0);
  pg.addColorStop(0, '#5e4829');
  pg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.ellipse(cx, cy + ts * 0.6, ts * 1.0, ts * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ─ 台座（2段） ─
  ctx.save();
  ctx.fillStyle = '#475569';
  roundRect(ctx, cx - ts * 0.45, cy + ts * 0.40, ts * 0.90, ts * 0.20, 4);
  ctx.fill();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#64748b';
  roundRect(ctx, cx - ts * 0.32, cy + ts * 0.28, ts * 0.64, ts * 0.14, 3);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // ─ 光柱 ─
  drawLightBeam(ctx, cx, cy - ts * 2.2, cy - ts * 0.4, ts * 0.4, '#c4b5fd', 0.4 + 0.3 * pulse);

  // ─ オベリスク ─
  withScale(ctx, cx, cy, ts * 1.5, () => {
    const g = ctx.createLinearGradient(0, -0.82, 0, 0.55);
    g.addColorStop(0, '#94a3b8');
    g.addColorStop(1, '#1e293b');
    ctx.fillStyle = g;
    ctx.fill(OBELISK);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 0.015;
    ctx.stroke(OBELISK);
    // ルーン刻印（縦3つ）
    ctx.font = '0.08px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#c4b5fd';
    ctx.shadowColor = '#a78bfa';
    ctx.shadowBlur = 0.3;
    const runeList = '✦❈⟡';
    for (let i = 0; i < 3; i++) {
      ctx.fillText(runeList[i], 0, -0.35 + i * 0.2);
    }
  });

  // ─ 頂点の発光クリスタル ─
  ctx.save();
  ctx.shadowColor = '#a78bfa';
  ctx.shadowBlur = 18 * pulse;
  const cgr = ctx.createLinearGradient(cx, cy - ts * 1.35, cx, cy - ts * 1.10);
  cgr.addColorStop(0, '#ede9fe');
  cgr.addColorStop(1, '#7c3aed');
  ctx.fillStyle = cgr;
  ctx.beginPath();
  ctx.moveTo(cx, cy - ts * 1.45);
  ctx.lineTo(cx + ts * 0.08, cy - ts * 1.25);
  ctx.lineTo(cx, cy - ts * 1.05);
  ctx.lineTo(cx - ts * 0.08, cy - ts * 1.25);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5b21b6';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // ─ 周回する小さな光球（3個） ─
  ctx.save();
  ctx.fillStyle = '#ede9fe';
  ctx.shadowColor = '#a78bfa';
  ctx.shadowBlur = 10;
  for (let i = 0; i < 3; i++) {
    const a = rot * 2 + (i / 3) * Math.PI * 2;
    const ox = cx + Math.cos(a) * ts * 0.35;
    const oy = cy - ts * 1.25 + Math.sin(a) * ts * 0.12;
    ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // ─ 立ち昇る魔素 ─
  drawDriftingMotes(ctx, cx, cy, ts * 0.5, 10, '#c4b5fd', now, 3);
}

// ─── 街を彩る背景のほたる（アンビエント） ───

export function drawAmbientMotes(
  ctx: CanvasRenderingContext2D,
  camOffX: number, camOffY: number,
  now: number,
): void {
  ctx.save();
  for (let i = 0; i < 40; i++) {
    const seed = i * 17.3;
    const x = ((Math.sin(seed) * 0.5 + 0.5) * 36 * TILE_SIZE) + camOffX;
    const drift = Math.sin(now * 0.4 + seed) * 20;
    const rise = ((now * 18 + seed * 30) % (24 * TILE_SIZE));
    const y = (24 * TILE_SIZE - rise) + camOffY + drift;
    const alpha = 0.3 + 0.5 * (Math.sin(now * 2 + seed) * 0.5 + 0.5);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = i % 3 === 0 ? '#fbbf24' : (i % 3 === 1 ? '#c4b5fd' : '#86efac');
    ctx.shadowBlur = 8;
    ctx.fillStyle = i % 3 === 0 ? '#fde68a' : (i % 3 === 1 ? '#c4b5fd' : '#86efac');
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// drawDungeonPortal / drawTavern / drawTrader / drawMonument / drawAmbientMotes
// は base-objects.ts から呼び出される公開 API として上で `export` されている。
