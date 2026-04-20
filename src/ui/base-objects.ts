// ─────────────────────────────────────────────
// base-objects.ts  拠点オブジェクト描画
//
// main.js から移行した拠点オブジェクト（宝箱・ショップ・カジノ・ポータル等）の
// 描画ヘルパー関数群。
// ─────────────────────────────────────────────

'use strict';

import { roundRect } from '../ui/hud.js';
import { TILE_SIZE } from '../world/tiles.js';
import {
  BASE_CHEST_POS,
  BASE_SHOP_POS,
  BASE_CASINO_POS,
  BASE_STALL_POS,
  BASE_LOAN_POS,
  BASE_RECLASS_POS,
  BASE_CRAFT_POS,
  BASE_FOUNTAIN_POS,
  BASE_PORTALS,
} from '../core/game-constants.js';
import { DUNGEONS } from '../world/dungeon_defs.js';
import type { SpriteLoader } from '../core/sprites.js';
import type { DungeonDef } from '../world/dungeon_defs.js';

// ─── 公開インターフェース ──────────────────────

export interface BaseObjectsContext {
  player:          { tx: number; ty: number };
  baseChestCount:  number;
  baseShopCount:   number;
  stallCount:      number;
  loanDebt:        number;
  sprites:         SpriteLoader;
  clearedDungeons: Set<string>;
}

// ─── 内部純粋関数 ──────────────────────────────

function isDungeonUnlocked(dungeonId: string, clearedDungeons: Set<string>): boolean {
  const idx = DUNGEONS.findIndex(d => d.id === dungeonId);
  if (idx <= 0) return true;
  return clearedDungeons.has(DUNGEONS[idx - 1].id);
}

// ─── 内部描画ヘルパー ──────────────────────────

function objChest(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ts: number,
  itemCount: number,
  onPlayer: boolean,
): void {
  ctx.save();
  const w = ts - 6, h = ts - 4;
  const x = cx - w / 2, y = cy - h / 2;
  const glow = onPlayer || itemCount > 0;
  if (glow) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = onPlayer ? 16 : 8; }

  const bodyY = y + h * 0.42, bodyH = h * 0.58;
  const bg = ctx.createLinearGradient(x, bodyY, x, bodyY + bodyH);
  bg.addColorStop(0, '#78350f'); bg.addColorStop(1, '#451a03');
  roundRect(ctx, x, bodyY, w, bodyH, 3); ctx.fillStyle = bg; ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(x + 3, bodyY + bodyH * i / 3);
    ctx.lineTo(x + w - 3, bodyY + bodyH * i / 3); ctx.stroke();
  }
  ctx.fillStyle = '#92400e';
  ctx.fillRect(x, bodyY + bodyH * 0.3, w, bodyH * 0.22);
  ctx.fillStyle = '#fbbf24'; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 4;
  ([[w * 0.2, bodyH * 0.41], [w * 0.8, bodyH * 0.41]] as [number, number][]).forEach(([rx, ry]) => {
    ctx.beginPath(); ctx.arc(x + rx, bodyY + ry, 2, 0, Math.PI * 2); ctx.fill();
  });

  const lidW = w + 4, lidX = cx - lidW / 2, lidY = y, lidH = h * 0.44;
  const lidG = ctx.createLinearGradient(lidX, lidY, lidX + lidW, lidY + lidH);
  lidG.addColorStop(0, '#92400e'); lidG.addColorStop(1, '#78350f');
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(lidX, lidY + lidH);
  ctx.lineTo(lidX + lidW, lidY + lidH);
  ctx.lineTo(lidX + lidW, lidY + lidH * 0.5);
  ctx.arc(cx, lidY + lidH * 0.5, lidW / 2, 0, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = lidG; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.ellipse(cx, lidY + lidH * 0.35, lidW * 0.35, lidH * 0.18, 0, 0, Math.PI * 2); ctx.fill();

  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 6;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(cx, bodyY + 3, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#92400e';
  ctx.beginPath(); ctx.arc(cx, bodyY + 2.5, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(cx - 1.2, bodyY + 2.5, 2.4, 4);

  ctx.shadowBlur = 0; ctx.restore();
}

function drawPortalGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  dungeonId: string,
  color: string,
  pulse: number,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.7 + 0.3 * pulse;
  switch (dungeonId) {
    case 'cave':
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy + r * 0.6);
      ctx.lineTo(cx - r, cy + r * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#05000f';
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.2); ctx.lineTo(cx + r * 0.5, cy + r * 0.6);
      ctx.lineTo(cx - r * 0.5, cy + r * 0.6); ctx.closePath(); ctx.fill();
      break;
    case 'goblin_nest':
      ctx.fillRect(cx - r * 0.15, cy - r, r * 0.3, r * 2);
      ctx.fillRect(cx - r * 0.7, cy - r * 0.15, r * 1.4, r * 0.3);
      break;
    case 'cursed_forest':
      ctx.fillRect(cx - r * 0.15, cy, r * 0.3, r);
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.7, cy + r * 0.1);
      ctx.lineTo(cx - r * 0.7, cy + r * 0.1); ctx.closePath(); ctx.fill();
      break;
    case 'abyss':
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2, true); ctx.fill();
      break;
    case 'boss_rush':
      ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#05000f';
      ctx.beginPath(); ctx.arc(cx - r * 0.28, cy - r * 0.15, r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + r * 0.28, cy - r * 0.15, r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.fillRect(cx - r * 0.35, cy + r * 0.55, r * 0.7, r * 0.5);
      ctx.fillStyle = '#05000f';
      for (let i = 0; i < 3; i++) ctx.fillRect(cx - r * 0.25 + i * r * 0.25, cy + r * 0.56, r * 0.15, r * 0.35);
      break;
    default:
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.restore();
}

// ─── 装飾：噴水・たいまつ・地区看板・ポータル祭壇 ──

/** 中央広場の噴水（2×2 ブロック相当、左上タイルを基準に描画） */
function drawFountain(
  ctx: CanvasRenderingContext2D,
  cx: number,   // 2×2 ブロックの中心
  cy: number,
  ts: number,
  now: number,
): void {
  ctx.save();
  const r1 = ts * 0.9;   // 外周石
  const r2 = ts * 0.62;  // 水面
  const r3 = ts * 0.2;   // 中央台座

  // 石の外周
  const stoneG = ctx.createRadialGradient(cx, cy, r2, cx, cy, r1);
  stoneG.addColorStop(0, '#52525b');
  stoneG.addColorStop(1, '#1c1917');
  ctx.fillStyle = stoneG;
  ctx.beginPath(); ctx.ellipse(cx, cy, r1, r1 * 0.68, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#78716c'; ctx.lineWidth = 1.5;
  ctx.stroke();

  // 水面（青緑のグラデ）
  const waterG = ctx.createRadialGradient(cx, cy - r2 * 0.1, r2 * 0.2, cx, cy, r2);
  waterG.addColorStop(0, 'rgba(147,197,253,0.85)');
  waterG.addColorStop(0.6, 'rgba(56,189,248,0.6)');
  waterG.addColorStop(1, 'rgba(14,116,144,0.75)');
  ctx.fillStyle = waterG;
  ctx.beginPath(); ctx.ellipse(cx, cy, r2, r2 * 0.68, 0, 0, Math.PI * 2); ctx.fill();

  // さざ波
  ctx.strokeStyle = 'rgba(186,230,253,0.55)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const phase = (now * 0.6 + i * 0.33) % 1;
    const rr = r2 * (0.3 + 0.6 * phase);
    ctx.globalAlpha = (1 - phase) * 0.6;
    ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.68, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 中央台座（石柱）
  ctx.fillStyle = '#a8a29e';
  ctx.beginPath(); ctx.ellipse(cx, cy, r3, r3 * 0.68, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#78716c';
  ctx.fillRect(cx - r3 * 0.4, cy - r2 * 0.42, r3 * 0.8, r2 * 0.42);
  ctx.fillStyle = '#d6d3d1';
  ctx.beginPath(); ctx.ellipse(cx, cy - r2 * 0.42, r3 * 0.45, r3 * 0.18, 0, 0, Math.PI * 2); ctx.fill();

  // 噴き上がる水柱
  const jetH = ts * 0.55 * (0.85 + 0.15 * Math.sin(now * 2.8));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const jetG = ctx.createLinearGradient(cx, cy - r2 * 0.42 - jetH, cx, cy - r2 * 0.42);
  jetG.addColorStop(0, 'rgba(224,242,254,0)');
  jetG.addColorStop(0.4, 'rgba(186,230,253,0.8)');
  jetG.addColorStop(1, 'rgba(56,189,248,0.9)');
  ctx.fillStyle = jetG;
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy - r2 * 0.42);
  ctx.quadraticCurveTo(cx, cy - r2 * 0.42 - jetH * 1.2, cx + 3, cy - r2 * 0.42);
  ctx.closePath();
  ctx.fill();

  // 水しぶき
  for (let i = 0; i < 6; i++) {
    const pa = ((now * 0.9 + i * 0.17) % 1);
    const angle = (i / 6) * Math.PI * 2;
    const sx = cx + Math.cos(angle) * ts * 0.3 * pa;
    const sy = cy - r2 * 0.42 - jetH * 0.5 + pa * ts * 0.3;
    ctx.fillStyle = `rgba(224,242,254,${(1 - pa) * 0.9})`;
    ctx.beginPath(); ctx.arc(sx, sy, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // コイン（願い事）
  ctx.fillStyle = '#fbbf24';
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 4;
  ([
    [-r2 * 0.4,  r2 * 0.15],
    [ r2 * 0.35, r2 * 0.28],
    [-r2 * 0.15, r2 * 0.38],
    [ r2 * 0.1, -r2 * 0.05],
  ] as [number, number][]).forEach(([ox, oy]) => {
    ctx.beginPath(); ctx.ellipse(cx + ox, cy + oy, 2.4, 1.6, 0, 0, Math.PI * 2); ctx.fill();
  });

  ctx.restore();
}

/** たいまつ（柱に設置したものをイメージ） */
function drawTorch(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  now: number,
  phase: number,
): void {
  ctx.save();
  const flicker = 0.7 + 0.3 * Math.sin(now * 8 + phase * 3);
  // 取り付け金具
  ctx.fillStyle = '#44403c';
  ctx.fillRect(cx - 2, cy - 2, 4, 14);
  // 燃料
  ctx.fillStyle = '#78350f';
  ctx.fillRect(cx - 3, cy - 8, 6, 8);
  // 炎
  const fG = ctx.createRadialGradient(cx, cy - 10, 1, cx, cy - 14 * flicker, 10 * flicker);
  fG.addColorStop(0, `rgba(254,240,138,${0.95 * flicker})`);
  fG.addColorStop(0.45, `rgba(251,146,60,${0.85 * flicker})`);
  fG.addColorStop(1, 'rgba(185,28,28,0)');
  ctx.fillStyle = fG;
  ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 14 * flicker;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy - 8);
  ctx.quadraticCurveTo(cx - 2, cy - 16 * flicker, cx, cy - 20 * flicker);
  ctx.quadraticCurveTo(cx + 2, cy - 16 * flicker, cx + 5, cy - 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 地区看板（釣り下げ式の木札） */
function drawDistrictBanner(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  text: string,
  color: string,
): void {
  ctx.save();
  const w = text.length * 11 + 20;
  const h = 22;
  // 吊りロープ
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - w * 0.35, cy - h * 0.5 - 6); ctx.lineTo(cx - w * 0.35, cy - h * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + w * 0.35, cy - h * 0.5 - 6); ctx.lineTo(cx + w * 0.35, cy - h * 0.5); ctx.stroke();
  // 木板
  const g = ctx.createLinearGradient(cx, cy - h / 2, cx, cy + h / 2);
  g.addColorStop(0, '#92400e'); g.addColorStop(1, '#451a03');
  ctx.fillStyle = g;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 3); ctx.fill();
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1; ctx.stroke();
  // 釘
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(cx - w / 2 + 4, cy - h / 2 + 4, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + w / 2 - 4, cy - h / 2 + 4, 1.5, 0, Math.PI * 2); ctx.fill();
  // 文字
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

/** ポータル足元の魔法陣＋祭壇階段 */
function drawPortalPedestal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ts: number,
  color: string,
  pulse: number,
  unlocked: boolean,
  now: number,
): void {
  ctx.save();
  // 石の台座（階段状）
  ctx.fillStyle = '#1c1917';
  ctx.beginPath(); ctx.ellipse(cx, cy + ts * 0.35, ts * 0.55, ts * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3f3f46';
  ctx.beginPath(); ctx.ellipse(cx, cy + ts * 0.33, ts * 0.5, ts * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#52525b';
  ctx.beginPath(); ctx.ellipse(cx, cy + ts * 0.30, ts * 0.42, ts * 0.1, 0, 0, Math.PI * 2); ctx.fill();

  if (!unlocked) { ctx.restore(); return; }

  // 魔法陣（回転）
  ctx.save();
  ctx.translate(cx, cy + ts * 0.3);
  ctx.rotate(now * 0.3);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35 + 0.35 * pulse;
  ctx.lineWidth = 1.2;
  ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.ellipse(0, 0, ts * 0.38, ts * 0.09, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, ts * 0.28, ts * 0.068, 0, 0, Math.PI * 2); ctx.stroke();
  // 三角ルーン
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const x = Math.cos(a) * ts * 0.34, y = Math.sin(a) * ts * 0.08;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function objPortal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ts: number,
  dungeon: DungeonDef,
  pulse: number,
  onPlayer: boolean,
): void {
  ctx.save();
  const c = dungeon.color;
  const pw = ts * 0.14;
  const gateW = ts * 0.9;
  const gateH = ts * 1.05;
  const gx = cx - gateW / 2;
  const gy = cy - gateH * 0.72;
  const archCY = gy + gateH * 0.32;
  const innerW = gateW - pw * 2;

  ctx.shadowColor = c; ctx.shadowBlur = 12 + 10 * pulse;

  ctx.fillStyle = '#05000f';
  ctx.beginPath();
  ctx.arc(cx, archCY, innerW / 2, Math.PI, 0);
  ctx.rect(cx - innerW / 2, archCY, innerW, gateH * 0.62);
  ctx.fill();

  const ig = ctx.createRadialGradient(cx, archCY, 0, cx, archCY, innerW * 0.52);
  ig.addColorStop(0, c + 'bb');
  ig.addColorStop(0.35, c + '44');
  ig.addColorStop(0.75, c + '11');
  ig.addColorStop(1, 'transparent');
  ctx.fillStyle = ig;
  ctx.globalAlpha = 0.45 + 0.55 * pulse;
  ctx.beginPath();
  ctx.arc(cx, archCY, innerW / 2, Math.PI, 0);
  ctx.rect(cx - innerW / 2, archCY, innerW, gateH * 0.62);
  ctx.fill();
  ctx.globalAlpha = 1;

  const pilG_l = ctx.createLinearGradient(gx, 0, gx + pw, 0);
  pilG_l.addColorStop(0, '#111118'); pilG_l.addColorStop(0.5, c + '60'); pilG_l.addColorStop(1, '#1e1e28');
  ctx.shadowBlur = 0; ctx.fillStyle = pilG_l;
  ctx.fillRect(gx, gy + gateH * 0.3, pw, gateH * 0.72);

  const pilG_r = ctx.createLinearGradient(gx + gateW - pw, 0, gx + gateW, 0);
  pilG_r.addColorStop(0, '#1e1e28'); pilG_r.addColorStop(0.5, c + '60'); pilG_r.addColorStop(1, '#111118');
  ctx.fillStyle = pilG_r;
  ctx.fillRect(gx + gateW - pw, gy + gateH * 0.3, pw, gateH * 0.72);

  ctx.shadowColor = c; ctx.shadowBlur = 8;
  ctx.fillStyle = c + 'aa';
  ctx.fillRect(gx - 1, gy + gateH * 0.3, pw + 2, 4);
  ctx.fillRect(gx + gateW - pw - 1, gy + gateH * 0.3, pw + 2, 4);

  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(cx - 5, gy + gateH * 0.28);
  ctx.lineTo(cx + 5, gy + gateH * 0.28);
  ctx.lineTo(cx + 3, gy + gateH * 0.34);
  ctx.lineTo(cx - 3, gy + gateH * 0.34);
  ctx.closePath(); ctx.fill();

  ctx.shadowBlur = 10; ctx.shadowColor = c;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  drawPortalGlyph(ctx, cx, archCY, ts * 0.22, dungeon.id, c, pulse);

  if (dungeon.bossRush) {
    ctx.shadowColor = c; ctx.shadowBlur = 6;
    ctx.strokeStyle = c + '99'; ctx.lineWidth = 1;
    ctx.strokeRect(gx - 1, gy + gateH * 0.3, gateW + 2, gateH * 0.72);
  }

  ctx.shadowBlur = 0; ctx.restore();
}

// ─────────────────────────────────────────────
// 3×2 タイル占有の建物描画
//   (cx, cy) は入口タイル中心。建物は上方と左右に広がる
//     w = 3 * ts, h = 2 * ts, bottom = cy + ts/2
// ─────────────────────────────────────────────

/** ショップ：赤屋根の木造店舗 */
function drawShopBuilding(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean, itemCount: number,
): void {
  ctx.save();
  const w = ts * 3, h = ts * 2;
  const x = cx - w / 2;
  const y = cy + ts / 2 - h;

  if (on) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 22; }

  // 本体：板壁
  const wallG = ctx.createLinearGradient(x, y + h * 0.3, x, y + h);
  wallG.addColorStop(0, '#7c2d12'); wallG.addColorStop(1, '#431407');
  ctx.fillStyle = wallG;
  roundRect(ctx, x + 4, y + h * 0.3, w - 8, h * 0.7, 3); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const ly = y + h * 0.3 + (h * 0.7) * i / 5;
    ctx.beginPath(); ctx.moveTo(x + 8, ly); ctx.lineTo(x + w - 8, ly); ctx.stroke();
  }

  // 三角屋根
  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.moveTo(x - 2, y + h * 0.3);
  ctx.lineTo(x + w / 2, y - 4);
  ctx.lineTo(x + w + 2, y + h * 0.3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#450a0a'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const ly = y + (h * 0.3) * i / 4;
    const dx = (w / 2 + 2) * (1 - i / 4);
    ctx.beginPath(); ctx.moveTo(x + w / 2 - dx, ly); ctx.lineTo(x + w / 2 + dx, ly); ctx.stroke();
  }

  // 庇（紅白しま）
  const awY = y + h * 0.33, awH = h * 0.1;
  const stripes = 9, sw = (w - 16) / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#b91c1c' : '#fde68a';
    ctx.beginPath();
    ctx.moveTo(x + 8 + i * sw, awY);
    ctx.lineTo(x + 8 + (i + 1) * sw, awY);
    ctx.lineTo(x + 8 + (i + 0.5) * sw, awY + awH + 4);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x + 8, awY - 2, w - 16, 3);

  // 看板
  ctx.fillStyle = '#1c0a01';
  roundRect(ctx, cx - ts * 0.55, y + h * 0.14, ts * 1.1, h * 0.13, 3); ctx.fill();
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#fde68a'; ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 4;
  ctx.fillText('SHOP', cx, y + h * 0.205);
  ctx.shadowBlur = 0;

  // 扉（中央）
  const doorW = ts * 0.55, doorH = ts * 0.95;
  const doorX = cx - doorW / 2, doorY = cy + ts / 2 - doorH;
  const doorG = ctx.createLinearGradient(doorX, doorY, doorX, doorY + doorH);
  doorG.addColorStop(0, '#451a03'); doorG.addColorStop(1, '#1c0a01');
  ctx.fillStyle = doorG;
  roundRect(ctx, doorX, doorY, doorW, doorH, 3); ctx.fill();
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.moveTo(doorX + doorW / 2, doorY); ctx.lineTo(doorX + doorW / 2, doorY + doorH); ctx.stroke();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(doorX + doorW * 0.82, doorY + doorH * 0.55, 2.5, 0, Math.PI * 2); ctx.fill();

  // 窓ディスプレイ（左右）
  const winW = ts * 0.55, winH = ts * 0.45, winY = cy - ts * 0.28;
  ([-ts * 1.05, ts * 1.05] as number[]).forEach((ox, i) => {
    const wx = cx + ox - winW / 2;
    ctx.fillStyle = '#78350f';
    roundRect(ctx, wx - 3, winY - 3, winW + 6, winH + 6, 3); ctx.fill();
    const gG = ctx.createLinearGradient(wx, winY, wx, winY + winH);
    gG.addColorStop(0, '#fcd34d'); gG.addColorStop(1, '#f59e0b');
    ctx.fillStyle = gG;
    roundRect(ctx, wx, winY, winW, winH, 2); ctx.fill();
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(wx + winW / 2, winY); ctx.lineTo(wx + winW / 2, winY + winH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx, winY + winH / 2); ctx.lineTo(wx + winW, winY + winH / 2); ctx.stroke();
    if (i === 0) {
      // 剣
      ctx.fillStyle = 'rgba(20,8,1,0.85)';
      ctx.fillRect(wx + winW * 0.47, winY + winH * 0.12, 4, winH * 0.7);
      ctx.fillRect(wx + winW * 0.28, winY + winH * 0.32, winW * 0.48, 4);
    } else {
      // ポーション
      ctx.fillStyle = 'rgba(239,68,68,0.9)';
      ctx.beginPath(); ctx.ellipse(wx + winW * 0.5, winY + winH * 0.65, winW * 0.2, winH * 0.24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(28,10,1,0.85)';
      ctx.fillRect(wx + winW * 0.44, winY + winH * 0.22, winW * 0.12, winH * 0.27);
    }
  });

  // 煙突（屋根右）
  ctx.fillStyle = '#44403c';
  ctx.fillRect(x + w * 0.72, y + h * 0.05, ts * 0.14, h * 0.22);
  ctx.fillStyle = '#27272a';
  ctx.fillRect(x + w * 0.72 - 2, y + h * 0.05, ts * 0.14 + 4, 4);
  // 煙
  for (let i = 0; i < 3; i++) {
    const ph = ((now * 0.6 + i * 0.33) % 1);
    const sx = x + w * 0.78 + Math.sin((now + i) * 1.6) * 4;
    const sy = y + h * 0.05 - ph * 24;
    ctx.fillStyle = `rgba(200,200,200,${(1 - ph) * 0.5})`;
    ctx.beginPath(); ctx.arc(sx, sy, 3 + ph * 4, 0, Math.PI * 2); ctx.fill();
  }

  // 商品点数バッジ
  if (itemCount > 0) {
    ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(x + w - 18, y + h * 0.12, 12, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'white'; ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(itemCount), x + w - 18, y + h * 0.12);
  }

  ctx.restore();
}

/** 委託露店：布屋根＋木の棚、樽・箱・売り物 */
function drawStallBuilding(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean, stallCount: number,
): void {
  ctx.save();
  const w = ts * 3, h = ts * 2;
  const x = cx - w / 2;
  const y = cy + ts / 2 - h;

  if (on) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 20; }

  // 布屋根（緑黄しま、たわむ）
  const canvasY = y + h * 0.12, canvasH = h * 0.32;
  const stripes = 7, sw = w / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#065f46' : '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(x + i * sw, canvasY);
    ctx.lineTo(x + (i + 1) * sw, canvasY);
    ctx.lineTo(x + (i + 1) * sw, canvasY + canvasH - 4 - 3 * Math.sin(((i + 1) / stripes) * Math.PI));
    ctx.lineTo(x + i * sw, canvasY + canvasH - 4 - 3 * Math.sin((i / stripes) * Math.PI));
    ctx.closePath(); ctx.fill();
  }
  // 屋根縁
  ctx.fillStyle = '#052e2a';
  ctx.beginPath();
  for (let i = 0; i <= stripes; i++) {
    const px = x + i * sw;
    const py = canvasY + canvasH - 3 * Math.sin((i / stripes) * Math.PI);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  for (let i = stripes; i >= 0; i--) {
    const px = x + i * sw;
    const py = canvasY + canvasH + 4 - 3 * Math.sin((i / stripes) * Math.PI);
    ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();

  // 支柱
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x + 4,      canvasY + canvasH, 6, h * 0.52);
  ctx.fillRect(x + w - 10, canvasY + canvasH, 6, h * 0.52);

  // 木のカウンター
  const ctY = y + h * 0.62, ctH = h * 0.16;
  const ctG = ctx.createLinearGradient(x, ctY, x, ctY + ctH);
  ctG.addColorStop(0, '#92400e'); ctG.addColorStop(1, '#451a03');
  ctx.fillStyle = ctG;
  roundRect(ctx, x + 10, ctY, w - 20, ctH, 3); ctx.fill();
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const ly = ctY + ctH * i / 4;
    ctx.beginPath(); ctx.moveTo(x + 12, ly); ctx.lineTo(x + w - 12, ly); ctx.stroke();
  }

  // カウンター上の売り物（3点）
  const itemY = ctY - 8;
  // ポーション
  ctx.fillStyle = '#a855f7';
  ctx.beginPath(); ctx.ellipse(x + w * 0.22, itemY, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x + w * 0.22 - 3, itemY - 10, 6, 6);
  // 巻物
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(x + w * 0.5 - 10, itemY - 4, 20, 8);
  ctx.fillStyle = '#92400e';
  ctx.beginPath(); ctx.arc(x + w * 0.5 - 10, itemY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.5 + 10, itemY, 4, 0, Math.PI * 2); ctx.fill();
  // 宝石
  ctx.fillStyle = '#22d3ee';
  ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.78, itemY - 5);
  ctx.lineTo(x + w * 0.82, itemY);
  ctx.lineTo(x + w * 0.78, itemY + 5);
  ctx.lineTo(x + w * 0.74, itemY);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;

  // 樽（左下）
  const barX = x + 8, barY = y + h * 0.82, barW = ts * 0.4, barH = ts * 0.4;
  const barG = ctx.createLinearGradient(barX, barY, barX + barW, barY);
  barG.addColorStop(0, '#451a03'); barG.addColorStop(0.5, '#78350f'); barG.addColorStop(1, '#451a03');
  ctx.fillStyle = barG;
  roundRect(ctx, barX, barY, barW, barH, 4); ctx.fill();
  ctx.strokeStyle = '#1c0a01'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(barX, barY + barH * 0.3); ctx.lineTo(barX + barW, barY + barH * 0.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(barX, barY + barH * 0.7); ctx.lineTo(barX + barW, barY + barH * 0.7); ctx.stroke();

  // 木箱（右下）
  const boxX = x + w - ts * 0.45, boxY = y + h * 0.82, boxW = ts * 0.38, boxH = ts * 0.4;
  ctx.fillStyle = '#92400e';
  roundRect(ctx, boxX, boxY, boxW, boxH, 2); ctx.fill();
  ctx.strokeStyle = '#451a03'; ctx.lineWidth = 1.5;
  ctx.strokeRect(boxX, boxY, boxW, boxH);
  ctx.beginPath(); ctx.moveTo(boxX, boxY + boxH / 2); ctx.lineTo(boxX + boxW, boxY + boxH / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(boxX + boxW / 2, boxY); ctx.lineTo(boxX + boxW / 2, boxY + boxH); ctx.stroke();

  // 委託数バッジ
  if (stallCount > 0) {
    const bx = x + w - 16, by = y + h * 0.16;
    ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 6;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'white'; ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(stallCount), bx, by);
  }

  // 点滅の小旗
  const flagX = x + w * 0.5, flagY = y + h * 0.03;
  ctx.fillStyle = '#dc2626';
  const flagW = 12 + 2 * Math.sin(now * 4);
  ctx.beginPath();
  ctx.moveTo(flagX, flagY);
  ctx.lineTo(flagX + flagW, flagY + 3);
  ctx.lineTo(flagX, flagY + 8);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#78350f';
  ctx.fillRect(flagX - 1, flagY, 2, 14);

  ctx.restore();
}

/** カジノ：ネオン輝く店舗、マーキー・トランプ柄・両開きドア */
function drawCasinoBuilding(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean,
): void {
  ctx.save();
  const w = ts * 3, h = ts * 2;
  const x = cx - w / 2;
  const y = cy + ts / 2 - h;
  const pulse = 0.5 + 0.5 * Math.abs(Math.sin(now * 2.5));
  const col = '#f59e0b';

  ctx.shadowColor = col; ctx.shadowBlur = (on ? 22 : 12) + 10 * pulse;

  // 本体
  const bodyG = ctx.createLinearGradient(x, y + h * 0.2, x, y + h);
  bodyG.addColorStop(0, '#1e1b3a'); bodyG.addColorStop(1, '#0d0a20');
  ctx.fillStyle = bodyG;
  roundRect(ctx, x + 6, y + h * 0.2, w - 12, h * 0.8, 4); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5 + 0.5 * pulse; ctx.stroke(); ctx.globalAlpha = 1;

  // 上部マーキー屋根
  ctx.shadowBlur = 0;
  const roofG = ctx.createLinearGradient(x, y, x, y + h * 0.22);
  roofG.addColorStop(0, '#4c1d95'); roofG.addColorStop(1, '#1e1b3a');
  ctx.fillStyle = roofG;
  roundRect(ctx, x, y, w, h * 0.22, 4); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();

  // "CASINO" ネオン文字
  ctx.font = 'bold 20px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = col; ctx.shadowBlur = 12 + 6 * pulse;
  ctx.fillStyle = '#fde68a';
  ctx.fillText('CASINO', cx, y + h * 0.11);

  // マーキーの電球（屋根縁を一周）
  ctx.shadowBlur = 0;
  const nBulbsTop = 14;
  for (let i = 0; i < nBulbsTop; i++) {
    const bx = x + (w - 8) * (i + 0.5) / nBulbsTop + 4;
    const alpha = ((pulse + i * 0.12) % 1);
    const hues = [col, '#ef4444', '#fde68a', '#22d3ee'];
    ctx.fillStyle = hues[i % hues.length];
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 5;
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(alpha * Math.PI));
    ctx.beginPath(); ctx.arc(bx, y + h * 0.22 - 2, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.shadowBlur = 0;

  // 側面の縦電球列
  for (let i = 0; i < 5; i++) {
    const ly = y + h * (0.3 + i * 0.12);
    const alpha = ((pulse + i * 0.3) % 1);
    ctx.fillStyle = '#fde68a';
    ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(alpha * Math.PI));
    ctx.beginPath(); ctx.arc(x + 4, ly, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w - 4, ly, 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 大型ディスプレイ（スート）
  const dispY = y + h * 0.3, dispH = h * 0.32;
  roundRect(ctx, x + w * 0.12, dispY, w * 0.76, dispH, 4);
  ctx.fillStyle = '#0f172a'; ctx.fill();
  ctx.strokeStyle = col + '88'; ctx.lineWidth = 1; ctx.stroke();
  // 仕切り
  ctx.strokeStyle = col + '44'; ctx.lineWidth = 1;
  ([1/3, 2/3] as number[]).forEach(f => {
    const lx = x + w * 0.12 + w * 0.76 * f;
    ctx.beginPath(); ctx.moveTo(lx, dispY + 4); ctx.lineTo(lx, dispY + dispH - 4); ctx.stroke();
  });
  const suits = ['♠', '♥', '♦'], sCol = ['#e2e8f0', '#f87171', '#f87171'];
  suits.forEach((s, i) => {
    ctx.font = `bold ${Math.floor(ts * 0.32)}px serif`;
    ctx.fillStyle = sCol[i];
    ctx.shadowColor = i === 0 ? col : '#f87171'; ctx.shadowBlur = 6;
    ctx.fillText(s, x + w * 0.12 + w * 0.76 * (i + 0.5) / 3, dispY + dispH * 0.5);
  });
  ctx.shadowBlur = 0;

  // 両開きの金扉（中央・下）
  const doorW = ts * 0.9, doorH = ts * 0.95;
  const doorX = cx - doorW / 2, doorY = cy + ts / 2 - doorH;
  const doorG = ctx.createLinearGradient(doorX, doorY, doorX, doorY + doorH);
  doorG.addColorStop(0, '#78350f'); doorG.addColorStop(1, '#451a03');
  ctx.fillStyle = doorG;
  roundRect(ctx, doorX, doorY, doorW, doorH, 4); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke();
  // 観音扉の中央線
  ctx.strokeStyle = col + 'cc'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, doorY + 4); ctx.lineTo(cx, doorY + doorH - 4); ctx.stroke();
  // 取っ手
  ctx.fillStyle = col;
  ctx.shadowColor = col; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(cx - 8, doorY + doorH * 0.55, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 8, doorY + doorH * 0.55, 3, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // 扉の窓（♥ のステンドグラス）
  ctx.fillStyle = '#ef4444';
  ctx.font = `bold ${Math.floor(ts * 0.28)}px serif`;
  ctx.fillText('♥', cx, doorY + doorH * 0.3);

  ctx.restore();
}

/** 金貸し：薄暗い路地の店、鉄格子窓から NPC が覗く */
function drawLoanBuilding(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean, debt: number,
  sprite: HTMLImageElement | null,
): void {
  ctx.save();
  const w = ts * 3, h = ts * 2;
  const x = cx - w / 2;
  const y = cy + ts / 2 - h;
  const angry = debt > 0;
  const glow = angry ? 'rgba(239,68,68,0.8)' : 'rgba(180,83,9,0.55)';

  ctx.shadowColor = glow; ctx.shadowBlur = on ? 22 : 12;

  // 左右の暗い路地壁
  ctx.fillStyle = '#1c1917';
  roundRect(ctx, x, y + h * 0.1, ts * 0.55, h * 0.9, 3); ctx.fill();
  roundRect(ctx, x + w - ts * 0.55, y + h * 0.1, ts * 0.55, h * 0.9, 3); ctx.fill();
  // レンガ模様（側壁）
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const ly = y + h * 0.15 + i * h * 0.17;
    ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(x + ts * 0.55, ly); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w - ts * 0.55, ly); ctx.lineTo(x + w, ly); ctx.stroke();
    for (let j = 0; j < 2; j++) {
      const bx = x + (j + (i % 2) * 0.5) * ts * 0.27;
      ctx.beginPath(); ctx.moveTo(bx, ly); ctx.lineTo(bx, ly + h * 0.085); ctx.stroke();
      const bx2 = x + w - ts * 0.55 + (j + (i % 2) * 0.5) * ts * 0.27;
      ctx.beginPath(); ctx.moveTo(bx2, ly); ctx.lineTo(bx2, ly + h * 0.085); ctx.stroke();
    }
  }

  // 中央の店の本体（幅 w*0.52）
  const bodyX = x + ts * 0.55, bodyY = y + h * 0.15, bodyW = w - ts * 1.1, bodyH = h * 0.85;
  const bodyG = ctx.createLinearGradient(bodyX, bodyY, bodyX, bodyY + bodyH);
  bodyG.addColorStop(0, '#3f1a0a'); bodyG.addColorStop(1, '#1a0905');
  ctx.fillStyle = bodyG;
  roundRect(ctx, bodyX, bodyY, bodyW, bodyH, 3); ctx.fill();
  ctx.strokeStyle = angry ? '#7f1d1d' : '#78350f';
  ctx.lineWidth = 1.5; ctx.stroke();

  // 屋根の庇（木板）
  ctx.fillStyle = '#292524';
  ctx.beginPath();
  ctx.moveTo(bodyX - 6, bodyY + 4);
  ctx.lineTo(bodyX + bodyW + 6, bodyY + 4);
  ctx.lineTo(bodyX + bodyW + 2, bodyY - 10);
  ctx.lineTo(bodyX - 2, bodyY - 10);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#0c0a09'; ctx.lineWidth = 1; ctx.stroke();

  // $ ランプ（揺れる）
  const lampX = bodyX + bodyW * 0.5;
  const lampY = bodyY + 2 + Math.sin(now * 1.5) * 1.2;
  ctx.strokeStyle = '#44403c'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(lampX, bodyY - 10); ctx.lineTo(lampX, lampY); ctx.stroke();
  ctx.shadowColor = angry ? '#ef4444' : '#fbbf24';
  ctx.shadowBlur = 10;
  const lampG = ctx.createRadialGradient(lampX, lampY + 8, 1, lampX, lampY + 8, 14);
  lampG.addColorStop(0, angry ? '#fecaca' : '#fef3c7');
  lampG.addColorStop(1, angry ? 'rgba(239,68,68,0)' : 'rgba(251,191,36,0)');
  ctx.fillStyle = lampG;
  ctx.beginPath(); ctx.arc(lampX, lampY + 8, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = angry ? '#ef4444' : '#fde68a';
  ctx.font = 'bold 14px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('$', lampX, lampY + 8);
  ctx.shadowBlur = 0;

  // 鉄格子の窓（中央上、NPC が見える）
  const winX = bodyX + bodyW * 0.15, winY = bodyY + bodyH * 0.2;
  const winW = bodyW * 0.7, winH = bodyH * 0.38;
  // 窓ガラス（暖色）
  const gG = ctx.createLinearGradient(winX, winY, winX, winY + winH);
  gG.addColorStop(0, angry ? '#7c2d12' : '#78350f');
  gG.addColorStop(1, angry ? '#450a0a' : '#451a03');
  ctx.fillStyle = gG;
  roundRect(ctx, winX, winY, winW, winH, 2); ctx.fill();
  ctx.strokeStyle = '#1c0a01'; ctx.lineWidth = 2; ctx.strokeRect(winX, winY, winW, winH);

  // NPC スプライト（窓の奥）
  if (sprite) {
    ctx.save();
    ctx.beginPath(); roundRect(ctx, winX + 2, winY + 2, winW - 4, winH - 4, 1); ctx.clip();
    ctx.drawImage(sprite, winX + winW * 0.1, winY - winH * 0.2, winW * 0.8, winH * 1.2);
    ctx.restore();
  } else {
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath(); ctx.arc(winX + winW * 0.5, winY + winH * 0.65, winH * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#292524';
    ctx.beginPath(); ctx.arc(winX + winW * 0.42, winY + winH * 0.6, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(winX + winW * 0.58, winY + winH * 0.6, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // 鉄格子（縦棒）
  ctx.strokeStyle = '#292524'; ctx.lineWidth = 2.5;
  for (let i = 1; i < 5; i++) {
    const bx = winX + winW * i / 5;
    ctx.beginPath(); ctx.moveTo(bx, winY); ctx.lineTo(bx, winY + winH); ctx.stroke();
  }
  // 鉄格子（横棒）
  ctx.beginPath(); ctx.moveTo(winX, winY + winH * 0.5); ctx.lineTo(winX + winW, winY + winH * 0.5); ctx.stroke();

  // 扉（右側、窓口カウンター付き）
  const doorW = bodyW * 0.9, doorH = bodyH * 0.35;
  const doorX = bodyX + (bodyW - doorW) / 2;
  const doorY = bodyY + bodyH - doorH;
  ctx.fillStyle = '#1c0a01';
  roundRect(ctx, doorX, doorY, doorW, doorH, 2); ctx.fill();
  ctx.strokeStyle = '#44403c'; ctx.lineWidth = 1.5; ctx.stroke();
  // カウンタースロット
  ctx.fillStyle = '#0c0a09';
  ctx.fillRect(doorX + doorW * 0.25, doorY + doorH * 0.3, doorW * 0.5, 4);
  // 札束（スロットから覗く）
  ctx.fillStyle = '#166534';
  ctx.fillRect(doorX + doorW * 0.35, doorY + doorH * 0.25, doorW * 0.3, 4);

  // 血のしずく（怒り時）
  if (angry) {
    for (let i = 0; i < 3; i++) {
      const ph = ((now * 0.7 + i * 0.33) % 1);
      const dx = bodyX + bodyW * (0.25 + i * 0.25);
      const dy = bodyY + bodyH * 0.04 + ph * bodyH * 0.2;
      ctx.fillStyle = `rgba(220,38,38,${(1 - ph) * 0.85})`;
      ctx.beginPath(); ctx.ellipse(dx, dy, 1.8, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  ctx.restore();
}

/** 鍛冶屋：石造りの炉＋煙突、外に鉄床とハンマー */
function drawForgeBuilding(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean,
): void {
  ctx.save();
  const w = ts * 3, h = ts * 2;
  const x = cx - w / 2;
  const y = cy + ts / 2 - h;
  const flicker = 0.6 + 0.4 * Math.abs(Math.sin(now * 5));

  ctx.shadowColor = `rgba(251,146,60,${0.55 + 0.35 * flicker})`;
  ctx.shadowBlur = on ? 22 : 14;

  // 石壁
  const wallG = ctx.createLinearGradient(x, y + h * 0.18, x, y + h);
  wallG.addColorStop(0, '#52525b'); wallG.addColorStop(1, '#27272a');
  ctx.fillStyle = wallG;
  roundRect(ctx, x + 4, y + h * 0.18, w - 8, h * 0.82, 3); ctx.fill();

  // 石ブロックのテクスチャ
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const ly = y + h * 0.18 + (h * 0.82) * i / 6;
    ctx.beginPath(); ctx.moveTo(x + 8, ly); ctx.lineTo(x + w - 8, ly); ctx.stroke();
    const off = (i % 2) * (w - 16) / 8;
    for (let j = 0; j < 4; j++) {
      const bx = x + 8 + off + j * (w - 16) / 4;
      if (bx < x + w - 8) {
        ctx.beginPath(); ctx.moveTo(bx, ly); ctx.lineTo(bx, ly + (h * 0.82) / 6); ctx.stroke();
      }
    }
  }

  // 屋根（三角、瓦）
  ctx.fillStyle = '#3f3f46';
  ctx.beginPath();
  ctx.moveTo(x - 2, y + h * 0.18);
  ctx.lineTo(x + w / 2, y - 4);
  ctx.lineTo(x + w + 2, y + h * 0.18);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#18181b'; ctx.lineWidth = 1.5; ctx.stroke();

  // 煙突
  const chX = x + w * 0.15, chY = y - ts * 0.35, chW = ts * 0.28, chH = ts * 0.55;
  const chG = ctx.createLinearGradient(chX, chY, chX + chW, chY);
  chG.addColorStop(0, '#18181b'); chG.addColorStop(0.5, '#3f3f46'); chG.addColorStop(1, '#18181b');
  ctx.fillStyle = chG;
  ctx.fillRect(chX, chY, chW, chH);
  ctx.fillStyle = '#09090b';
  ctx.fillRect(chX - 3, chY, chW + 6, 5);
  // 煙（大きめ）
  for (let i = 0; i < 5; i++) {
    const ph = ((now * 0.3 + i * 0.2) % 1);
    const sx = chX + chW * 0.5 + Math.sin((now + i) * 1.2) * 6;
    const sy = chY - 4 - ph * 50;
    ctx.fillStyle = `rgba(120,113,108,${(1 - ph) * 0.6})`;
    ctx.beginPath(); ctx.arc(sx, sy, 5 + ph * 8, 0, Math.PI * 2); ctx.fill();
  }

  // 炉の口（中央、光る）
  const furX = cx - ts * 0.55, furY = y + h * 0.4;
  const furW = ts * 1.1, furH = ts * 0.58;
  // 枠
  ctx.fillStyle = '#18181b';
  roundRect(ctx, furX - 4, furY - 4, furW + 8, furH + 8, 4); ctx.fill();
  // 炉内（炎）
  const mg = ctx.createRadialGradient(
    cx, furY + furH * 0.55, 2,
    cx, furY + furH * 0.55, furW * 0.55,
  );
  mg.addColorStop(0,    `rgba(255,250,200,${0.95 * flicker})`);
  mg.addColorStop(0.3,  `rgba(253,224,71,${0.9 * flicker})`);
  mg.addColorStop(0.6,  `rgba(251,146,60,${0.8 * flicker})`);
  mg.addColorStop(0.85, `rgba(185,28,28,${0.55 * flicker})`);
  mg.addColorStop(1,    'rgba(40,8,4,0)');
  ctx.fillStyle = mg;
  roundRect(ctx, furX, furY, furW, furH, 4); ctx.fill();
  // 炉内 薪
  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(furX + furW * 0.25, furY + furH * 0.75, furW * 0.1, 4);
  ctx.fillRect(furX + furW * 0.5, furY + furH * 0.78, furW * 0.12, 4);
  ctx.fillRect(furX + furW * 0.7, furY + furH * 0.73, furW * 0.1, 4);

  // 火の粉
  ctx.shadowBlur = 0;
  for (let i = 0; i < 6; i++) {
    const fa = ((now * 1.6 + i * 0.17) % 1);
    const spx = cx + Math.sin((now * 2.5 + i * 1.3)) * ts * 0.5;
    const spy = furY + furH * 0.2 - fa * ts * 0.9;
    ctx.fillStyle = `rgba(253,224,71,${(1 - fa) * 0.9})`;
    ctx.beginPath(); ctx.arc(spx, spy, 1.6, 0, Math.PI * 2); ctx.fill();
  }

  // 鉄床（手前・左）
  const anvX = x + ts * 0.2, anvY = y + h * 0.88, anvW = ts * 0.7, anvH = ts * 0.22;
  ctx.fillStyle = '#52525b';
  roundRect(ctx, anvX + anvW * 0.2, anvY + anvH * 0.75, anvW * 0.6, anvH * 0.25, 2); ctx.fill();
  ctx.fillStyle = '#27272a';
  ctx.fillRect(anvX + anvW * 0.35, anvY + anvH * 0.4, anvW * 0.3, anvH * 0.35);
  ctx.fillStyle = '#3f3f46';
  roundRect(ctx, anvX, anvY, anvW, anvH * 0.4, 2); ctx.fill();
  ctx.fillStyle = '#a1a1aa';
  ctx.fillRect(anvX + 4, anvY + 1, anvW - 8, 3);

  // ハンマー（右手前、叩き動作）
  const hX = x + w - ts * 0.65, hY = y + h * 0.86;
  ctx.save();
  ctx.translate(hX, hY);
  ctx.rotate(-0.35 + 0.25 * Math.sin(now * 3.2));
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-2, 0, 4, ts * 0.42);
  ctx.fillStyle = '#a1a1aa';
  roundRect(ctx, -9, -8, 18, 12, 2); ctx.fill();
  ctx.fillStyle = '#f4f4f5';
  ctx.fillRect(-7, -7, 5, 3);
  ctx.restore();

  // 看板（「鍛冶」文字入り）
  ctx.fillStyle = '#1c0a01';
  roundRect(ctx, cx - ts * 0.6, y + h * 0.06, ts * 1.2, h * 0.1, 3); ctx.fill();
  ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#fb923c';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 4;
  ctx.fillText('FORGE', cx, y + h * 0.11);
  ctx.shadowBlur = 0;

  ctx.restore();
}

/** 転職の祭壇：2 本の石柱＋中央祭壇、浮遊結晶、床の魔法陣 */
function drawReclassShrine(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean,
): void {
  ctx.save();
  const w = ts * 3, h = ts * 2;
  const x = cx - w / 2;
  const y = cy + ts / 2 - h;
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(now * 1.6));

  ctx.shadowColor = `rgba(168,85,247,${(on ? 0.9 : 0.55) * pulse + 0.2})`;
  ctx.shadowBlur = on ? 26 : 16;

  // 背面壁（淡紫のカーテン / 夜空）
  const bgG = ctx.createLinearGradient(x, y, x, y + h * 0.75);
  bgG.addColorStop(0, '#1e1b4b'); bgG.addColorStop(1, '#0f0a2a');
  ctx.fillStyle = bgG;
  roundRect(ctx, x + ts * 0.1, y + h * 0.12, w - ts * 0.2, h * 0.55, 4); ctx.fill();

  // 背面に浮かぶ星
  ctx.shadowBlur = 0;
  for (let i = 0; i < 8; i++) {
    const phase = (now * 0.4 + i * 0.19) % 1;
    const sx2 = x + ts * 0.2 + (w - ts * 0.4) * ((i * 0.37) % 1);
    const sy2 = y + h * 0.2 + h * 0.35 * ((i * 0.53) % 1);
    ctx.fillStyle = `rgba(221,214,254,${0.3 + 0.5 * Math.abs(Math.sin(phase * Math.PI))})`;
    ctx.beginPath(); ctx.arc(sx2, sy2, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  // 石柱×2（左右）
  ctx.shadowColor = `rgba(168,85,247,${0.5 * pulse + 0.2})`;
  ctx.shadowBlur = on ? 18 : 10;
  const colYTop = y + h * 0.1, colH = h * 0.78, colW = ts * 0.35;
  ([x + ts * 0.15, x + w - ts * 0.15 - colW] as number[]).forEach(pxLeft => {
    const pg = ctx.createLinearGradient(pxLeft, 0, pxLeft + colW, 0);
    pg.addColorStop(0, '#312e81'); pg.addColorStop(0.5, '#6366f1'); pg.addColorStop(1, '#312e81');
    ctx.fillStyle = pg;
    ctx.fillRect(pxLeft, colYTop + colH * 0.08, colW, colH * 0.82);
    // 柱頭
    ctx.fillStyle = '#a5b4fc';
    roundRect(ctx, pxLeft - 4, colYTop, colW + 8, colH * 0.1, 2); ctx.fill();
    // 柱底
    roundRect(ctx, pxLeft - 4, colYTop + colH * 0.9, colW + 8, colH * 0.1, 2); ctx.fill();
    // ルーン
    ctx.fillStyle = `rgba(253,224,255,${0.6 + 0.4 * pulse})`;
    ctx.font = `bold ${Math.floor(ts * 0.2)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#c4b5fd'; ctx.shadowBlur = 6;
    ctx.fillText('✧', pxLeft + colW / 2, colYTop + colH * 0.3);
    ctx.fillText('⚝', pxLeft + colW / 2, colYTop + colH * 0.55);
  });
  ctx.shadowBlur = 0;

  // 中央祭壇（台座）
  const altarCx = cx;
  const altarY = y + h * 0.7;
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.moveTo(altarCx - ts * 0.55, altarY + ts * 0.32);
  ctx.lineTo(altarCx + ts * 0.55, altarY + ts * 0.32);
  ctx.lineTo(altarCx + ts * 0.42, altarY + ts * 0.08);
  ctx.lineTo(altarCx - ts * 0.42, altarY + ts * 0.08);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 1.5; ctx.stroke();

  // 祭壇天面
  ctx.fillStyle = '#312e81';
  ctx.beginPath();
  ctx.ellipse(altarCx, altarY + ts * 0.08, ts * 0.42, ts * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a5b4fc'; ctx.stroke();

  // 床の魔法陣（回転）
  ctx.save();
  ctx.translate(altarCx, altarY + ts * 0.22);
  ctx.rotate(now * 0.4);
  ctx.strokeStyle = `rgba(192,132,252,${0.5 + 0.4 * pulse})`;
  ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 10;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, ts * 0.45, ts * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, ts * 0.32, ts * 0.072, 0, 0, Math.PI * 2); ctx.stroke();
  // 星型
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const rx = Math.cos(a) * ts * 0.4, ry = Math.sin(a) * ts * 0.09;
    if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
    const a2 = a + Math.PI / 5;
    ctx.lineTo(Math.cos(a2) * ts * 0.18, Math.sin(a2) * ts * 0.04);
  }
  ctx.closePath(); ctx.stroke();
  ctx.restore();

  // 浮遊結晶（祭壇上）
  const floatY = Math.sin(now * 1.8) * 4;
  const crysCy = altarY - ts * 0.05 + floatY;
  ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 18 * pulse;
  ctx.fillStyle = '#c084fc';
  ctx.beginPath();
  ctx.moveTo(altarCx,               crysCy - ts * 0.3);
  ctx.lineTo(altarCx + ts * 0.18,   crysCy - ts * 0.05);
  ctx.lineTo(altarCx + ts * 0.12,   crysCy + ts * 0.22);
  ctx.lineTo(altarCx - ts * 0.12,   crysCy + ts * 0.22);
  ctx.lineTo(altarCx - ts * 0.18,   crysCy - ts * 0.05);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#f0abfc'; ctx.lineWidth = 1; ctx.stroke();

  // ハイライト
  ctx.fillStyle = 'rgba(253,224,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(altarCx - ts * 0.06, crysCy - ts * 0.22);
  ctx.lineTo(altarCx + ts * 0.02, crysCy - ts * 0.05);
  ctx.lineTo(altarCx - ts * 0.07, crysCy + ts * 0.05);
  ctx.closePath(); ctx.fill();

  // 結晶の周囲を回るオーブ
  ctx.shadowBlur = 10;
  for (let i = 0; i < 3; i++) {
    const ang = now * 1.2 + i * (Math.PI * 2 / 3);
    const ox = altarCx + Math.cos(ang) * ts * 0.4;
    const oy = crysCy  + Math.sin(ang) * ts * 0.15;
    ctx.fillStyle = '#f0abfc';
    ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

// ─── エクスポート関数 ──────────────────────────

export function drawBaseObjects(
  ctx: CanvasRenderingContext2D,
  camOffX: number,
  camOffY: number,
  now: number,
  c: BaseObjectsContext,
): void {
  const ts = TILE_SIZE;

  const _label = (text: string, x: number, y: number, color = '#fbbf24', size = 9) => {
    ctx.font = `bold ${size}px monospace`;
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  };
  const _prompt = (text: string, x: number, y: number) => _label(text, x, y, '#ffffff', 11);

  // ── 装飾：中央噴水（2×2 ブロックの中心は BASE_FOUNTAIN_POS の右下角） ──
  {
    const cx = (BASE_FOUNTAIN_POS.tx + 1) * ts + camOffX;
    const cy = (BASE_FOUNTAIN_POS.ty + 1) * ts + camOffY;
    drawFountain(ctx, cx, cy, ts, now);
  }

  // ── 装飾：ポータルの間の四隅にたいまつ ──
  {
    const torches: [number, number, number][] = [
      [1, 2, 0],  [26, 2, 1],
      [1, 6, 2],  [26, 6, 3],
    ];
    for (const [tx, ty, phase] of torches) {
      const tcx = tx * ts + ts / 2 + camOffX;
      const tcy = ty * ts + ts / 2 + camOffY;
      drawTorch(ctx, tcx, tcy, now, phase);
    }
  }

  // ── 装飾：地区看板 ──
  {
    // ポータルの間（中央アーチ上）
    drawDistrictBanner(
      ctx,
      13 * ts + ts + camOffX, 7 * ts + ts * 0.2 + camOffY,
      '転移の間', '#c4b5fd',
    );
    // 商業地区（西）— 建物の上方
    drawDistrictBanner(
      ctx,
      6 * ts + ts / 2 + camOffX, 9 * ts + ts * 0.7 + camOffY,
      '市場', '#fde68a',
    );
    // 工房地区（東）— 建物の上方
    drawDistrictBanner(
      ctx,
      21 * ts + ts / 2 + camOffX, 9 * ts + ts * 0.7 + camOffY,
      '工房', '#fdba74',
    );
    // 裏路地 — 背の低い看板、建物の間にぶら下げる
    drawDistrictBanner(
      ctx,
      13 * ts + ts + camOffX, 13 * ts + ts * 0.4 + camOffY,
      '裏路地', '#94a3b8',
    );
  }

  // 宝箱
  {
    const cx = BASE_CHEST_POS.tx * ts + ts / 2 + camOffX;
    const cy = BASE_CHEST_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_CHEST_POS.tx && c.player.ty === BASE_CHEST_POS.ty;
    objChest(ctx, cx, cy, ts, c.baseChestCount, on);
    _label(`宝箱 (${c.baseChestCount}件)`, cx, cy - ts / 2 - 8);
    if (on) _prompt('[E] 宝箱を開ける', cx, cy + ts / 2 + 14);
  }

  // ショップ（3×2 タイル建物）
  {
    const sx = BASE_SHOP_POS.tx * ts + ts / 2 + camOffX;
    const sy = BASE_SHOP_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_SHOP_POS.tx && c.player.ty === BASE_SHOP_POS.ty;
    drawShopBuilding(ctx, sx, sy, ts, now, on, c.baseShopCount);
    _label(`ショップ (${c.baseShopCount}点)`, sx, sy - ts * 1.55);
    if (on) _prompt('[E] ショップを開く', sx, sy + ts / 2 + 14);
  }

  // カジノ（3×2 タイル建物）
  {
    const cx = BASE_CASINO_POS.tx * ts + ts / 2 + camOffX;
    const cy = BASE_CASINO_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_CASINO_POS.tx && c.player.ty === BASE_CASINO_POS.ty;
    drawCasinoBuilding(ctx, cx, cy, ts, now, on);
    _label('カジノ', cx, cy - ts * 1.55, '#f59e0b');
    if (on) _prompt('[E] カジノへ入る', cx, cy + ts / 2 + 14);
  }

  // 委託露店（3×2 タイル建物）
  {
    const stx = BASE_STALL_POS.tx * ts + ts / 2 + camOffX;
    const sty = BASE_STALL_POS.ty * ts + ts / 2 + camOffY;
    const on  = c.player.tx === BASE_STALL_POS.tx && c.player.ty === BASE_STALL_POS.ty;
    drawStallBuilding(ctx, stx, sty, ts, now, on, c.stallCount);
    _label(`委託露店 (${c.stallCount}件)`, stx, sty - ts * 1.55, '#fde68a');
    if (on) _prompt('[E] 露店を開く', stx, sty + ts / 2 + 14);
  }

  // 金貸し（3×2 タイル建物）
  {
    const lx = BASE_LOAN_POS.tx * ts + ts / 2 + camOffX;
    const ly = BASE_LOAN_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_LOAN_POS.tx && c.player.ty === BASE_LOAN_POS.ty;
    const spr = c.sprites.get('debt_collector') ?? null;
    drawLoanBuilding(ctx, lx, ly, ts, now, on, c.loanDebt, spr);
    const debtLabel = c.loanDebt > 0 ? `借金: ${c.loanDebt}G` : '金貸し';
    _label(debtLabel, lx, ly - ts * 1.55, c.loanDebt > 0 ? '#f87171' : '#fbbf24');
    if (on) _prompt('[E] 借りる  [R] 返済', lx, ly + ts / 2 + 14);
  }

  // 転職の祭壇（3×2 タイル建物）
  {
    const rx = BASE_RECLASS_POS.tx * ts + ts / 2 + camOffX;
    const ry = BASE_RECLASS_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_RECLASS_POS.tx && c.player.ty === BASE_RECLASS_POS.ty;
    drawReclassShrine(ctx, rx, ry, ts, now, on);
    _label('転職の祭壇', rx, ry - ts * 1.55, '#e9d5ff');
    if (on) _prompt('[E] 転職する', rx, ry + ts / 2 + 14);
  }

  // 鍛冶屋（3×2 タイル建物）
  {
    const fx = BASE_CRAFT_POS.tx * ts + ts / 2 + camOffX;
    const fy = BASE_CRAFT_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_CRAFT_POS.tx && c.player.ty === BASE_CRAFT_POS.ty;
    drawForgeBuilding(ctx, fx, fy, ts, now, on);
    _label('鍛冶屋', fx, fy - ts * 1.55, '#fb923c');
    if (on) _prompt('[E] 武器を合成する', fx, fy + ts / 2 + 14);
  }

  // ポータル
  for (const portal of BASE_PORTALS) {
    const dungeon = DUNGEONS.find(d => d.id === portal.dungeonId);
    if (!dungeon) continue;
    const px = portal.tx * ts + ts / 2 + camOffX;
    const py = portal.ty * ts + ts / 2 + camOffY;
    const unlocked = isDungeonUnlocked(portal.dungeonId, c.clearedDungeons);
    const pulse = unlocked
      ? 0.5 + 0.5 * Math.abs(Math.sin((now / (dungeon.bossRush ? 0.7 : 1.2)) * Math.PI))
      : 0.3;
    const on = c.player.tx === portal.tx && c.player.ty === portal.ty;

    // ポータル足元の祭壇＋魔法陣
    drawPortalPedestal(ctx, px, py, ts, dungeon.color, pulse, unlocked, now);

    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.4;
    objPortal(ctx, px, py, ts, dungeon, pulse, on);
    ctx.restore();

    if (!unlocked) {
      ctx.font = `${ts * 0.55}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔒', px, py);
    }

    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = unlocked ? dungeon.color : 'rgba(160,160,160,0.7)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(dungeon.name, px, py - ts * 0.75);
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(200,200,200,0.65)';
    ctx.fillText(dungeon.bossRush ? `全${dungeon.maxFloors}波` : dungeon.infinite ? '∞階' : `${dungeon.maxFloors}階`, px, py - ts * 0.55);

    if (!dungeon.bossRush && unlocked) {
      const bw = ts - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(px - bw / 2, py + ts * 0.42, bw, 3);
      ctx.fillStyle = dungeon.color;
      ctx.fillRect(px - bw / 2, py + ts * 0.42, bw * Math.min(1, dungeon.diffMult / 2.5), 3);
    }

    if (on) {
      if (unlocked) {
        const msg = dungeon.bossRush ? '[E] 挑戦する！' : `[E] ${dungeon.name}へ`;
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = dungeon.bossRush ? '#ff6b6b' : '#ffffff';
        ctx.fillText(msg, px, py + ts * 0.72);
      } else {
        const idx = DUNGEONS.findIndex(d => d.id === portal.dungeonId);
        const prev = DUNGEONS[idx - 1];
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#f59e0b';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${prev.emoji}${prev.name}をクリアで解放`, px, py + ts * 0.72);
      }
    }
  }
}
