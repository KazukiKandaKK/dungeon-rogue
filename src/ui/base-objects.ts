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

function objShop(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ts: number,
  itemCount: number,
  onPlayer: boolean,
): void {
  ctx.save();
  const w = ts, h = ts;
  const x = cx - w / 2, y = cy - h / 2;
  if (onPlayer) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 14; }

  const wallG = ctx.createLinearGradient(x, y + h * 0.22, x, y + h * 0.88);
  wallG.addColorStop(0, '#2d1b10'); wallG.addColorStop(1, '#1a0e08');
  ctx.fillStyle = wallG;
  roundRect(ctx, x + 1, y + h * 0.22, w - 2, h * 0.66, 2); ctx.fill();

  ctx.strokeStyle = '#1a0e08'; ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const ly = y + h * 0.22 + (h * 0.66) * i / 4;
    ctx.beginPath(); ctx.moveTo(x + 3, ly); ctx.lineTo(x + w - 3, ly); ctx.stroke();
  }

  const awR = '#b91c1c', awY = '#f59e0b';
  const stripes = 5, sw = (w - 2) / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? awR : awY;
    ctx.beginPath();
    const lx = x + 1 + i * sw;
    ctx.moveTo(lx, y + h * 0.18);
    ctx.lineTo(lx + sw, y + h * 0.18);
    ctx.lineTo(lx + sw + 1, y + h * 0.31);
    ctx.lineTo(lx - 1, y + h * 0.31);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(x + 1, y + h * 0.31, w - 2, 2);

  const ctG = ctx.createLinearGradient(x, y + h * 0.71, x, y + h * 0.91);
  ctG.addColorStop(0, '#78350f'); ctG.addColorStop(1, '#451a03');
  roundRect(ctx, x, y + h * 0.71, w, h * 0.2, 3);
  ctx.fillStyle = ctG; ctx.fill();
  ctx.fillStyle = '#92400e'; ctx.fillRect(x, y + h * 0.71, w, 3);

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#c4b5fd';
  roundRect(ctx, cx - 9, y + h * 0.57, 5, 9, 1); ctx.fill();
  ctx.fillStyle = '#fcd34d';
  ctx.beginPath(); ctx.arc(cx + 1, y + h * 0.62, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#86efac';
  roundRect(ctx, cx + 6, y + h * 0.57, 4, 9, 1); ctx.fill();

  if (itemCount > 0) {
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${itemCount}点`, cx, y + h * 0.12);
  }

  ctx.restore();
}

function objCasino(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ts: number,
  pulse: number,
  onPlayer: boolean,
): void {
  ctx.save();
  const w = ts, h = ts;
  const x = cx - w / 2, y = cy - h / 2;
  const col = '#f59e0b';
  ctx.shadowColor = col; ctx.shadowBlur = (onPlayer ? 18 : 6) + 8 * pulse;

  const bg = ctx.createLinearGradient(x, y + h * 0.1, x, y + h);
  bg.addColorStop(0, '#1c1510'); bg.addColorStop(1, '#0d0a06');
  roundRect(ctx, x, y + h * 0.1, w, h * 0.85, 5);
  ctx.fillStyle = bg; ctx.fill();

  roundRect(ctx, x, y + h * 0.1, w, h * 0.85, 5);
  ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.4 + 0.6 * pulse; ctx.stroke(); ctx.globalAlpha = 1;

  roundRect(ctx, x + w * 0.1, y + h * 0.2, w * 0.8, h * 0.38, 3);
  ctx.fillStyle = '#0f172a'; ctx.fill();
  roundRect(ctx, x + w * 0.1, y + h * 0.2, w * 0.8, h * 0.38, 3);
  ctx.strokeStyle = col + '88'; ctx.lineWidth = 1; ctx.stroke();

  ctx.strokeStyle = col + '44'; ctx.lineWidth = 1;
  ([1/3, 2/3] as number[]).forEach(f => {
    const lx = x + w * 0.1 + w * 0.8 * f;
    ctx.beginPath(); ctx.moveTo(lx, y + h * 0.21); ctx.lineTo(lx, y + h * 0.57); ctx.stroke();
  });

  const suits = ['♠', '♥', '♦'], sCol = ['#e2e8f0', '#f87171', '#f87171'];
  suits.forEach((s, i) => {
    ctx.font = `bold ${Math.floor(ts * 0.26)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = sCol[i];
    ctx.shadowColor = i === 0 ? col : '#f87171'; ctx.shadowBlur = 5;
    ctx.fillText(s, x + w * 0.1 + w * 0.8 * (i + 0.5) / 3, y + h * 0.39);
  });

  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const lvX = x + w - 4, lvY1 = y + h * 0.28, lvY2 = y + h * 0.62;
  ctx.beginPath(); ctx.moveTo(lvX, lvY1); ctx.lineTo(lvX, lvY2); ctx.stroke();
  ctx.fillStyle = '#dc2626';
  ctx.beginPath(); ctx.arc(lvX, lvY1, 4, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#292524';
  roundRect(ctx, x + w * 0.08, y + h * 0.65, w * 0.76, h * 0.2, 3); ctx.fill();
  ([0.25, 0.5, 0.75] as number[]).forEach((f, i) => {
    ctx.fillStyle = ([col, '#ef4444', '#4ade80'] as string[])[i];
    ctx.beginPath(); ctx.arc(x + w * 0.08 + w * 0.76 * f, y + h * 0.75, 4, 0, Math.PI * 2); ctx.fill();
  });

  ctx.shadowBlur = 0;
  for (let i = 0; i < 6; i++) {
    const lx = x + w * (i + 0.5) / 6;
    const alpha = ((pulse + i * 0.25) % 1);
    ctx.fillStyle = i % 2 === 0 ? col : '#ef4444';
    ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(alpha * Math.PI));
    ctx.beginPath(); ctx.arc(lx, y + h * 0.14, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
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

  // 宝箱
  {
    const cx = BASE_CHEST_POS.tx * ts + ts / 2 + camOffX;
    const cy = BASE_CHEST_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_CHEST_POS.tx && c.player.ty === BASE_CHEST_POS.ty;
    objChest(ctx, cx, cy, ts, c.baseChestCount, on);
    _label(`宝箱 (${c.baseChestCount}件)`, cx, cy - ts / 2 - 8);
    if (on) _prompt('[E] 宝箱を開ける', cx, cy + ts / 2 + 14);
  }

  // ショップ
  {
    const sx = BASE_SHOP_POS.tx * ts + ts / 2 + camOffX;
    const sy = BASE_SHOP_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_SHOP_POS.tx && c.player.ty === BASE_SHOP_POS.ty;
    objShop(ctx, sx, sy, ts, c.baseShopCount, on);
    _label('ショップ', sx, sy - ts / 2 - 8);
    if (on) _prompt('[E] ショップを開く', sx, sy + ts / 2 + 14);
  }

  // カジノ
  {
    const pulse = 0.5 + 0.5 * Math.abs(Math.sin((now / 0.9) * Math.PI));
    const cx = BASE_CASINO_POS.tx * ts + ts / 2 + camOffX;
    const cy = BASE_CASINO_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_CASINO_POS.tx && c.player.ty === BASE_CASINO_POS.ty;
    objCasino(ctx, cx, cy, ts, pulse, on);
    _label('カジノ', cx, cy - ts / 2 - 8, '#f59e0b');
    if (on) _prompt('[E] カジノへ入る', cx, cy + ts / 2 + 14);
  }

  // 委託露店
  {
    const stx = BASE_STALL_POS.tx * ts + ts / 2 + camOffX;
    const sty = BASE_STALL_POS.ty * ts + ts / 2 + camOffY;
    const on  = c.player.tx === BASE_STALL_POS.tx && c.player.ty === BASE_STALL_POS.ty;
    ctx.save();
    ctx.shadowColor = on ? 'rgba(251,191,36,0.9)' : 'rgba(251,191,36,0.4)';
    ctx.shadowBlur  = on ? 16 : 8;
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.moveTo(stx - ts*0.55, sty - ts*0.1);
    ctx.lineTo(stx + ts*0.55, sty - ts*0.1);
    ctx.lineTo(stx + ts*0.45, sty - ts*0.55);
    ctx.lineTo(stx - ts*0.45, sty - ts*0.55);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    for (let i = -1; i <= 1; i++) {
      const bx = stx + i * ts * 0.28;
      ctx.fillRect(bx - 3, sty - ts*0.55, 6, ts*0.45);
    }
    ctx.fillStyle = '#78350f';
    ctx.fillRect(stx - ts*0.5, sty - ts*0.1, ts, ts*0.25);
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1; ctx.strokeRect(stx - ts*0.5, sty - ts*0.1, ts, ts*0.25);
    if (c.stallCount > 0) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(stx + ts*0.4, sty - ts*0.45, 8, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'white'; ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(c.stallCount), stx + ts*0.4, sty - ts*0.45);
    }
    ctx.restore();
    _label(`委託露店 (${c.stallCount}件)`, stx, sty - ts*0.7, '#fbbf24');
    if (on) _prompt('[E] 露店を開く', stx, sty + ts*0.6);
  }

  // 金貸し
  {
    const lx = BASE_LOAN_POS.tx * ts + ts / 2 + camOffX;
    const ly = BASE_LOAN_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_LOAN_POS.tx && c.player.ty === BASE_LOAN_POS.ty;
    const spr = c.sprites.get('debt_collector');
    ctx.save();
    ctx.shadowColor = c.loanDebt > 0 ? 'rgba(239,68,68,0.8)' : 'rgba(180,83,9,0.6)';
    ctx.shadowBlur = on ? 20 : 10;
    if (spr) {
      ctx.drawImage(spr, lx - ts * 0.5, ly - ts * 0.65, ts, ts);
    } else {
      ctx.font = `${ts * 0.8}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🤑', lx, ly);
    }
    ctx.restore();
    const debtLabel = c.loanDebt > 0 ? `借金: ${c.loanDebt}G` : '金貸し';
    _label(debtLabel, lx, ly - ts * 0.75, c.loanDebt > 0 ? '#f87171' : '#fbbf24');
    if (on) _prompt('[E] 借りる  [R] 返済', lx, ly + ts * 0.6);
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
