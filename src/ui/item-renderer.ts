// ─────────────────────────────────────────────
// item-renderer.ts  アイテムアイコン Canvas 描画（純粋関数）
//
// グローバル状態を一切参照しない。
// Canvas コンテキストと座標・サイズを受け取り描画するだけ。
// ─────────────────────────────────────────────

import { lightenColor, darkenColor } from '../core/colors.js';

// ── アイテム描画に必要な最小型定義 ──────────────

export type ItemSlot = 'consumable' | 'weapon' | 'armor' | 'accessory' | 'gold';

export interface RenderableItem {
  color?:   string;
  slot:     ItemSlot;
  id?:      string;
  spellId?: string;
  healMp?:  number | 'full';
}

// ── Canvas 描画プリミティブ ──────────────────────

/** コイン（ゴールドアイコン） */
export function drawItemCoin(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, sz: number, color: string,
): void {
  const r = sz * 0.4;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.22, cy - r * 0.28, r * 0.32, r * 0.18, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = sz * 0.04;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.font = `bold ${sz * 0.35 | 0}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('G', cx, cy + sz * 0.02);
}

/** ポーション */
export function drawItemPotion(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, sz: number, color: string,
): void {
  const bR = sz * 0.3, nW = sz * 0.12, nH = sz * 0.22, by = cy + sz * 0.06;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.arc(cx, by, bR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.globalAlpha = 0.88;
  ctx.beginPath(); ctx.arc(cx, by, bR * 0.9, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(180,210,255,0.75)';
  ctx.fillRect(cx - nW / 2, by - bR - nH, nW, nH + bR * 0.2);
  ctx.fillStyle = '#92400e';
  ctx.fillRect(cx - nW * 0.75, by - bR - nH - sz * 0.05, nW * 1.5, sz * 0.07);
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.beginPath(); ctx.ellipse(cx - bR * 0.3, by - bR * 0.25, bR * 0.28, bR * 0.17, -0.5, 0, Math.PI * 2); ctx.fill();
}

/** マナバイアル */
export function drawItemVial(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, sz: number, color: string,
): void {
  const w = sz * 0.18, h = sz * 0.7, x = cx - w / 2, y = cy - h / 2, r = w / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.roundRect(x, y + h * 0.15, w, h * 0.85, [0, 0, r, r]); ctx.fill();
  ctx.fillStyle = color; ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.roundRect(x + w * 0.1, y + h * 0.26, w * 0.8, h * 0.67, [0, 0, r * 0.8, r * 0.8]); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(190,215,255,0.85)';
  ctx.fillRect(x - w * 0.18, y + h * 0.1, w * 1.36, h * 0.11);
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.fillRect(x + w * 0.15, y + h * 0.3, w * 0.2, h * 0.38);
}

/** 巻物 */
export function drawItemScroll(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, sz: number, color: string,
): void {
  const sw = sz * 0.68, sh = sz * 0.44, rr = sz * 0.12, sx2 = cx - sw / 2, sy2 = cy - sh / 2;
  ctx.fillStyle = '#fef3c7'; ctx.fillRect(sx2 + rr, sy2, sw - rr * 2, sh);
  for (const ex of [sx2 + rr, sx2 + sw - rr]) {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.ellipse(ex, cy, rr, sh / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b45309';
    ctx.beginPath(); ctx.ellipse(ex, cy, rr * 0.45, sh * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = color; ctx.lineWidth = sz * 0.025;
  for (let i = 0; i < 3; i++) {
    const ly = sy2 + sh * (0.22 + i * 0.26);
    ctx.beginPath(); ctx.moveTo(sx2 + rr + sw * 0.07, ly); ctx.lineTo(sx2 + sw - rr - sw * 0.07, ly); ctx.stroke();
  }
  ctx.fillStyle = color; ctx.globalAlpha = 0.75;
  ctx.font = `bold ${sz * 0.22 | 0}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✦', cx, cy); ctx.globalAlpha = 1;
}

/** 剣 */
export function drawItemSword(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, sz: number, color: string,
): void {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI / 4);
  const blen = sz * 0.68, bw = sz * 0.07, gw = sz * 0.38, hw = sz * 0.06;
  const g = ctx.createLinearGradient(-bw, -blen / 2, bw, blen / 2);
  g.addColorStop(0, 'rgba(220,235,255,.95)'); g.addColorStop(0.5, color); g.addColorStop(1, 'rgba(100,120,180,.8)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, -blen / 2); ctx.lineTo(bw, blen * 0.35); ctx.lineTo(-bw, blen * 0.35); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#92400e'; ctx.fillRect(-gw / 2, blen * 0.3, gw, sz * 0.06);
  ctx.fillStyle = '#78350f'; ctx.fillRect(-hw / 2, blen * 0.35, hw, sz * 0.22);
  ctx.restore();
}

/** 斧 */
export function drawItemAxe(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, sz: number, color: string,
): void {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = '#78350f'; ctx.fillRect(-sz * 0.04, -sz * 0.38, sz * 0.08, sz * 0.76);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-sz * 0.05, -sz * 0.3); ctx.lineTo(-sz * 0.36, -sz * 0.38);
  ctx.lineTo(-sz * 0.38, sz * 0.06); ctx.lineTo(-sz * 0.05, sz * 0.01);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.48)'; ctx.lineWidth = sz * 0.03;
  ctx.beginPath(); ctx.moveTo(-sz * 0.36, -sz * 0.38); ctx.lineTo(-sz * 0.38, sz * 0.06); ctx.stroke();
  ctx.restore();
}

/** ハンマー */
export function drawItemHammer(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, sz: number, color: string,
): void {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = '#78350f'; ctx.fillRect(-sz * 0.05, -sz * 0.08, sz * 0.1, sz * 0.45);
  const hw = sz * 0.52, hh = sz * 0.3;
  ctx.fillStyle = color; ctx.fillRect(-hw / 2, -sz * 0.36, hw, hh);
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-hw / 2 + sz * 0.04, -sz * 0.34, hw * 0.45, hh * 0.42);
  ctx.restore();
}

/** スタッフ */
export function drawItemStaff(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, sz: number, color: string,
): void {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = '#78350f'; ctx.fillRect(-sz * 0.04, -sz * 0.42, sz * 0.08, sz * 0.84);
  const or = sz * 0.22;
  ctx.shadowColor = color; ctx.shadowBlur = sz * 0.25;
  ctx.fillStyle = color; ctx.globalAlpha = 0.75;
  ctx.beginPath(); ctx.arc(0, -sz * 0.33, or, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.arc(-or * 0.28, -sz * 0.33 - or * 0.22, or * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** 盾 */
export function drawItemShield(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, sz: number, color: string,
): void {
  const sw = sz * 0.6, sh = sz * 0.7, x = cx - sw / 2, y = cy - sh / 2;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x + sw * 0.1, y); ctx.lineTo(x + sw * 0.9, y);
    ctx.quadraticCurveTo(x + sw, y, x + sw, y + sh * 0.4);
    ctx.quadraticCurveTo(x + sw, y + sh * 0.72, cx, y + sh);
    ctx.quadraticCurveTo(x, y + sh * 0.72, x, y + sh * 0.4);
    ctx.quadraticCurveTo(x, y, x + sw * 0.1, y);
    ctx.closePath();
  };
  ctx.fillStyle = 'rgba(0,0,0,.35)'; path(); ctx.fill();
  ctx.save(); ctx.translate(0, sz * 0.02);
  ctx.fillStyle = color; path(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.fillRect(cx - sw * 0.06, y + sh * 0.14, sw * 0.12, sh * 0.52);
  ctx.fillRect(cx - sw * 0.24, y + sh * 0.27, sw * 0.48, sh * 0.14);
  ctx.restore();
}

/** 指輪 */
export function drawItemRing(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, sz: number, color: string,
): void {
  const r = sz * 0.27, rw = sz * 0.07;
  ctx.strokeStyle = color; ctx.lineWidth = rw;
  ctx.beginPath(); ctx.arc(cx, cy + sz * 0.06, r, 0, Math.PI * 2); ctx.stroke();
  const gr = sz * 0.12;
  ctx.shadowColor = color; ctx.shadowBlur = sz * 0.2;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy - r + sz * 0.04, gr, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.48)';
  ctx.beginPath(); ctx.arc(cx - gr * 0.3, cy - r + sz * 0.04 - gr * 0.28, gr * 0.38, 0, Math.PI * 2); ctx.fill();
}

/** 宝石 */
export function drawItemGem(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, sz: number, color: string,
): void {
  const gw = sz * 0.46, gt = sz * 0.2, gb = sz * 0.35;
  const lc = lightenColor(color, 0.3), dc = darkenColor(color, 0.2);
  ctx.fillStyle = lc;
  ctx.beginPath(); ctx.moveTo(cx, cy - gt); ctx.lineTo(cx + gw / 2, cy - gt * 0.1); ctx.lineTo(cx, cy + gb * 0.1); ctx.lineTo(cx - gw / 2, cy - gt * 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(cx - gw / 2, cy - gt * 0.1); ctx.lineTo(cx, cy + gb * 0.1); ctx.lineTo(cx - gw * 0.38, cy + gb); ctx.lineTo(cx, cy + gb * 1.08); ctx.closePath(); ctx.fill();
  ctx.fillStyle = dc;
  ctx.beginPath(); ctx.moveTo(cx + gw / 2, cy - gt * 0.1); ctx.lineTo(cx + gw * 0.38, cy + gb); ctx.lineTo(cx, cy + gb * 1.08); ctx.lineTo(cx, cy + gb * 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.42)';
  ctx.beginPath(); ctx.moveTo(cx - gw * 0.15, cy - gt * 0.85); ctx.lineTo(cx + gw * 0.2, cy - gt * 0.45); ctx.lineTo(cx - gw * 0.08, cy - gt * 0.15); ctx.lineTo(cx - gw * 0.3, cy - gt * 0.55); ctx.closePath(); ctx.fill();
}

// ── ディスパッチャ ────────────────────────────────

/**
 * アイテムのスロット種別に応じたアイコンを描画する
 * @param item スロット・ID・spellId・healMp を持つ最小アイテムオブジェクト
 */
export function drawItemSvg(
  ctx:  CanvasRenderingContext2D,
  item: RenderableItem,
  cx:   number,
  cy:   number,
  sz:   number,
): void {
  const c = item.color ?? '#fbbf24';
  const { slot, id } = item;
  if (slot === 'gold') {
    drawItemCoin(ctx, cx, cy, sz, c);
  } else if (slot === 'consumable') {
    if (item.spellId)       drawItemScroll(ctx, cx, cy, sz, c);
    else if (item.healMp)   drawItemVial(ctx, cx, cy, sz, c);
    else                    drawItemPotion(ctx, cx, cy, sz, c);
  } else if (slot === 'weapon') {
    if (id?.includes('axe'))     drawItemAxe(ctx, cx, cy, sz, c);
    else if (id?.includes('hammer')) drawItemHammer(ctx, cx, cy, sz, c);
    else if (id?.includes('staff'))  drawItemStaff(ctx, cx, cy, sz, c);
    else                         drawItemSword(ctx, cx, cy, sz, c);
  } else if (slot === 'armor') {
    drawItemShield(ctx, cx, cy, sz, c);
  } else {
    if (id?.includes('ring')) drawItemRing(ctx, cx, cy, sz, c);
    else                      drawItemGem(ctx, cx, cy, sz, c);
  }
}
