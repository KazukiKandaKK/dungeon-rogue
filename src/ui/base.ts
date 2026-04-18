// ─────────────────────────────────────────────
// base.ts  拠点UI描画（委託露店・宝箱・拠点ショップ）
//
// main.js の _drawStall / _drawBaseChest / _drawBaseShop を
// TypeScript へ移行した Canvas 描画関数群。
// 依存する状態をすべてコンテキスト型として明示する。
// ─────────────────────────────────────────────

import type { Player }    from '../entities/player.js';
import type { ItemDef }   from '../data/equipment.js';
import { itemStatText }   from '../data/equipment.js';
import { roundRect }      from './hud.js';

// ── 委託露店 ────────────────────────────────────

export interface StallEntry {
  item:    ItemDef;
  price:   number;
}

export interface StallContext {
  player:       Player;
  stallItems:   StallEntry[];
  stallCursor:  number;
  stallPriceFn: (item: ItemDef) => number;
}

export function drawStall(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  c: StallContext,
): void {
  ctx.save();
  const pw = 400, ph = 400;
  const px = (W - pw) / 2, py = (H - ph) / 2;

  roundRect(ctx, px, py, pw, ph, 12);
  ctx.fillStyle = 'rgba(10,5,15,0.97)'; ctx.fill();
  ctx.strokeStyle = 'rgba(251,191,36,0.8)'; ctx.lineWidth = 2; ctx.stroke();

  ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('🏪 委託露店（ダンジョン帰還時に自動売却）', px + pw / 2, py + 10);

  ctx.font = '9px monospace'; ctx.fillStyle = '#aaa';
  ctx.fillText('[E] 委託 / 引き上げ  [↑↓] 選択  [B/Esc] 閉じる', px + pw / 2, py + 28);

  ctx.strokeStyle = 'rgba(251,191,36,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px+12, py+44); ctx.lineTo(px+pw-12, py+44); ctx.stroke();

  const all = [
    ...c.stallItems.map((si, i)   => ({ item: si.item, price: si.price, inStall: true,  idx: i })),
    ...c.player.inventory.map((item, i) => ({ item, price: c.stallPriceFn(item), inStall: false, idx: i })),
  ];

  if (all.length === 0) {
    ctx.fillStyle = 'rgba(200,200,200,0.4)';
    ctx.font = '11px monospace';
    ctx.fillText('インベントリが空です', px + pw / 2, py + 80);
    ctx.restore();
    return;
  }

  // ヘッダ
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#fbbf24';
  ctx.fillText('委託中', px + 18, py + 56);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('手持ち', px + 18 + 50, py + 56);

  const ROW_H = 28;
  all.forEach((entry, i) => {
    const ry = py + 70 + i * ROW_H;
    if (ry + ROW_H > py + ph - 12) return;
    const isSel = i === c.stallCursor;
    if (isSel) {
      ctx.fillStyle = 'rgba(251,191,36,0.18)';
      ctx.fillRect(px + 10, ry - 12, pw - 20, ROW_H - 2);
      ctx.strokeStyle = 'rgba(251,191,36,0.5)'; ctx.lineWidth = 1;
      roundRect(ctx, px + 10, ry - 12, pw - 20, ROW_H - 2, 4); ctx.stroke();
    }
    const mark = entry.inStall ? '🏪' : '📦';
    ctx.fillStyle = entry.inStall ? '#fbbf24' : '#e2e8f0';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${mark} ${entry.item.icon ?? ''}${entry.item.name}`, px + 18, ry);
    ctx.fillStyle = '#86efac';
    ctx.textAlign = 'right';
    ctx.fillText(`${entry.price}G`, px + pw - 18, ry);
    ctx.textAlign = 'left';
    ctx.fillStyle = entry.inStall ? '#34d399' : '#6b7280';
    ctx.font = '9px monospace';
    ctx.fillText(entry.inStall ? '委託中' : '→ 委託する', px + 200, ry);
  });
  ctx.restore();
}

// ── 宝箱UI ─────────────────────────────────────

export interface BaseChestContext {
  player:        Player;
  baseChest:     ItemDef[];
  baseChestSide: 'chest' | 'inventory';
  baseCursor:    number;
}

export function drawBaseChest(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  c: BaseChestContext,
): void {
  ctx.save();
  const ROW_H = 32;
  const COL_W = 270;
  const pw = COL_W * 2 + 60, ph = 420;
  const px = (W - pw) / 2, py = (H - ph) / 2;

  roundRect(ctx, px, py, pw, ph, 12);
  ctx.fillStyle = 'rgba(10,5,15,0.97)'; ctx.fill();
  ctx.strokeStyle = 'rgba(251,191,36,0.8)'; ctx.lineWidth = 2; ctx.stroke();

  ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('🗃 宝箱', px + pw / 2, py + 10);

  ctx.strokeStyle = 'rgba(251,191,36,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px+12, py+32); ctx.lineTo(px+pw-12, py+32); ctx.stroke();

  const lx = px + 18, rx = px + COL_W + 30;

  // 列ヘッダー
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = c.baseChestSide === 'chest' ? '#fbbf24' : 'rgba(200,200,200,0.5)';
  ctx.fillText(`◀ 宝箱 (${c.baseChest.length}件)`, lx, py + 38);
  ctx.fillStyle = c.baseChestSide === 'inventory' ? '#fbbf24' : 'rgba(200,200,200,0.5)';
  ctx.fillText(`所持品 (${c.player.inventory.length}/${c.player.maxInventory}) ▶`, rx, py + 38);

  // 縦区切り線
  ctx.strokeStyle = 'rgba(251,191,36,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + COL_W + 18, py + 36);
  ctx.lineTo(px + COL_W + 18, py + ph - 12);
  ctx.stroke();

  // アイテムリスト
  const drawCol = (items: ItemDef[], startX: number, side: 'chest' | 'inventory') => {
    if (items.length === 0) {
      ctx.font = '10px monospace'; ctx.fillStyle = '#444'; ctx.textAlign = 'left';
      ctx.fillText('（なし）', startX, py + 64);
      return;
    }
    const maxVisible = Math.floor((ph - 70) / ROW_H);
    const scroll = c.baseChestSide === side ? Math.max(0, c.baseCursor - maxVisible + 1) : 0;
    items.forEach((item, i) => {
      const visI = i - scroll;
      if (visI < 0 || visI >= maxVisible) return;
      const rowY  = py + 58 + visI * ROW_H;
      const isSel = c.baseChestSide === side && i === c.baseCursor;
      if (isSel) {
        roundRect(ctx, startX - 4, rowY - 2, COL_W, ROW_H - 2, 5);
        ctx.fillStyle = 'rgba(120,80,0,0.45)'; ctx.fill();
      }
      ctx.font = '11px monospace';
      ctx.fillStyle = isSel ? '#fff' : '#c4b5fd';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(`${item.icon} ${item.name}`, startX, rowY + ROW_H / 2 - 4);
      ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(167,139,250,0.7)';
      ctx.fillText(itemStatText(item), startX, rowY + ROW_H / 2 + 8);
    });
  };

  drawCol(c.baseChest,        lx, 'chest');
  drawCol(c.player.inventory, rx, 'inventory');

  ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(156,163,175,0.5)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('[←→]切替  [↑↓]選択  [Enter]移動  [B/Esc]閉じる', px + pw/2, py + ph - 6);
  ctx.restore();
}

// ── 拠点ショップ UI ───────────────────────────

export interface BaseShopEntry {
  item:  ItemDef;
  price: number;
}

export interface BaseShopContext {
  player:         Player;
  baseShopItems:  BaseShopEntry[];
  baseShopCursor: number;
}

export function drawBaseShop(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  c: BaseShopContext,
): void {
  ctx.save();
  const ROW_H = 40;
  const pw = 420, ph = 48 + ROW_H * Math.max(1, c.baseShopItems.length) + 48;
  const px = (W - pw) / 2, py = Math.max(20, (H - ph) / 2);

  roundRect(ctx, px, py, pw, ph, 12);
  ctx.fillStyle = 'rgba(8,5,2,0.97)'; ctx.fill();
  ctx.strokeStyle = 'rgba(251,191,36,0.85)'; ctx.lineWidth = 2; ctx.stroke();

  ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('🏪 拠点ショップ', px + pw / 2, py + 10);

  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(200,200,200,0.6)';
  ctx.fillText(`所持金: ${c.player.gold}G`, px + pw / 2, py + 28);

  ctx.strokeStyle = 'rgba(251,191,36,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px+12, py+44); ctx.lineTo(px+pw-12, py+44); ctx.stroke();

  if (c.baseShopItems.length === 0) {
    ctx.font = '11px monospace'; ctx.fillStyle = '#666'; ctx.textAlign = 'center';
    ctx.fillText('本日は売り切れです。', px + pw / 2, py + 70);
  } else {
    c.baseShopItems.forEach((entry, i) => {
      const rowY   = py + 48 + i * ROW_H;
      const isSel  = i === c.baseShopCursor;
      const canBuy = c.player.gold >= entry.price;
      if (isSel) {
        roundRect(ctx, px + 8, rowY + 2, pw - 16, ROW_H - 4, 6);
        ctx.fillStyle = 'rgba(120,80,0,0.45)'; ctx.fill();
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = '13px monospace';
      ctx.fillStyle = isSel ? '#fff' : (canBuy ? '#e2d5c0' : '#666');
      ctx.fillText(`${entry.item.icon} ${entry.item.name}`, px + 20, rowY + ROW_H / 2 - 5);
      ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(167,139,250,0.7)';
      ctx.fillText(itemStatText(entry.item), px + 20, rowY + ROW_H / 2 + 9);
      ctx.textAlign = 'right';
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = canBuy ? '#fbbf24' : '#f87171';
      ctx.fillText(`${entry.price}G`, px + pw - 18, rowY + ROW_H / 2);
    });
  }

  ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(156,163,175,0.5)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('[↑↓]選択  [Enter]購入  [B/Esc]閉じる', px + pw / 2, py + ph - 6);
  ctx.restore();
}
