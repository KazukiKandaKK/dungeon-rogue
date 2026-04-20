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

  const now = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
  const pulse = 0.5 + 0.5 * Math.abs(Math.sin(now * 2));

  // 背景暗幕
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);

  const pw = 520, ph = 460;
  const px = ((W - pw) / 2) | 0;
  const py = ((H - ph) / 2) | 0;

  // 外枠（木の露店）
  const woodG = ctx.createLinearGradient(px, py, px, py + ph);
  woodG.addColorStop(0, '#3d2411');
  woodG.addColorStop(1, '#1a0e06');
  roundRect(ctx, px, py, pw, ph, 14);
  ctx.fillStyle = woodG; ctx.fill();
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.2;
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 14 * pulse;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 天幕
  drawAwning(ctx, px + 8, py + 10, pw - 16, 20, now);

  // 看板
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 10;
  ctx.fillStyle = '#78350f';
  roundRect(ctx, px + pw / 2 - 130, py + 36, 260, 30, 6); ctx.fill();
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.font = 'bold 14px "Noto Sans JP", monospace';
  ctx.fillStyle = '#fde68a';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🏪 委託露店', px + pw / 2, py + 52);

  ctx.font = '10px "Noto Sans JP", monospace';
  ctx.fillStyle = 'rgba(253,230,138,0.65)';
  ctx.fillText('ダンジョン帰還時に自動売却される', px + pw / 2, py + 76);

  // 区切り
  ctx.strokeStyle = 'rgba(251,191,36,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + 16, py + 92); ctx.lineTo(px + pw - 16, py + 92); ctx.stroke();

  // リスト構築
  const all = [
    ...c.stallItems.map((si)       => ({ item: si.item, price: si.price, inStall: true })),
    ...c.player.inventory.map((it) => ({ item: it, price: c.stallPriceFn(it), inStall: false })),
  ];

  if (all.length === 0) {
    ctx.font = '13px "Noto Sans JP", monospace';
    ctx.fillStyle = 'rgba(200,200,200,0.55)';
    ctx.fillText('所持品も委託中もありません', px + pw / 2, py + 180);
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(251,191,36,0.55)';
    ctx.fillText('[B / Esc] 閉じる', px + pw / 2, py + ph - 14);
    ctx.restore();
    return;
  }

  // 委託中の合計金額
  const stallTotal = c.stallItems.reduce((s, si) => s + si.price, 0);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#34d399';
  ctx.fillText(`📦 委託中: ${c.stallItems.length} 点（合計 ${stallTotal} G）`, px + 24, py + 104);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`🎒 所持品: ${c.player.inventory.length} / ${c.player.maxInventory}`,
    px + pw - 24, py + 104);

  // アイテムカードリスト
  const ROW_H = 40;
  const listY = py + 120;
  const visible = Math.min(7, all.length);
  const half = Math.floor(visible / 2);
  const scroll = Math.max(0, Math.min(all.length - visible, c.stallCursor - half));

  for (let vi = 0; vi < visible; vi++) {
    const i = scroll + vi;
    if (i >= all.length) break;
    const entry = all[i];
    const rowY = listY + vi * ROW_H;
    const isSel = i === c.stallCursor;
    const tier = entry.item.tier ?? 0;
    const tierC = TIER_COLORS[tier] ?? '#9ca3af';

    const cardX = px + 14, cardY = rowY + 3;
    const cardW = pw - 28, cardH = ROW_H - 6;

    const g = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    if (isSel) {
      g.addColorStop(0, 'rgba(251,191,36,0.22)');
      g.addColorStop(1, 'rgba(120,60,10,0.4)');
    } else if (entry.inStall) {
      g.addColorStop(0, 'rgba(20,50,30,0.55)');
      g.addColorStop(1, 'rgba(3,20,9,0.7)');
    } else {
      g.addColorStop(0, 'rgba(30,20,10,0.55)');
      g.addColorStop(1, 'rgba(10,6,3,0.7)');
    }
    roundRect(ctx, cardX, cardY, cardW, cardH, 7);
    ctx.fillStyle = g; ctx.fill();

    // tier バー
    ctx.fillStyle = tierC;
    roundRect(ctx, cardX, cardY, 3, cardH, 1); ctx.fill();

    if (isSel) {
      ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 10 * pulse;
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.8;
      roundRect(ctx, cardX, cardY, cardW, cardH, 7); ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = entry.inStall ? 'rgba(52,211,153,0.4)' : 'rgba(120,80,40,0.4)';
      ctx.lineWidth = 1;
      roundRect(ctx, cardX, cardY, cardW, cardH, 7); ctx.stroke();
    }

    // 委託中マーカー
    const mark = entry.inStall ? '🏪' : '📦';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = entry.inStall ? '#34d399' : '#cbd5e1';
    ctx.fillText(mark, cardX + 22, cardY + cardH / 2);

    // アイテムアイコン
    ctx.font = '16px monospace';
    ctx.fillStyle = entry.item.color ?? '#e2e8f0';
    ctx.fillText(entry.item.icon ?? '?', cardX + 46, cardY + cardH / 2);

    // 名前
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px "Noto Sans JP", monospace';
    ctx.fillStyle = isSel ? '#ffffff' : (entry.inStall ? '#86efac' : '#e9d5ff');
    ctx.fillText(entry.item.name, cardX + 62, cardY + 12);

    // 状態
    ctx.font = '9px monospace';
    ctx.fillStyle = entry.inStall ? 'rgba(134,239,172,0.75)' : 'rgba(167,139,250,0.7)';
    ctx.fillText(
      entry.inStall ? '委託中 — [E] 引き上げる' : '手持ち — [E] 委託する',
      cardX + 62, cardY + cardH - 10,
    );

    // 価格タグ
    const tagX = cardX + cardW - 78, tagY = cardY + 5;
    const tagW = 68, tagH = cardH - 10;
    ctx.fillStyle = entry.inStall ? '#14532d' : '#78350f';
    roundRect(ctx, tagX, tagY, tagW, tagH, 5); ctx.fill();
    ctx.strokeStyle = entry.inStall ? '#4ade80' : '#fbbf24';
    ctx.lineWidth = 1.2; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = entry.inStall ? '#86efac' : '#fde68a';
    ctx.fillText(`${entry.price}G`, tagX + tagW / 2, tagY + tagH / 2);
  }

  if (all.length > visible) {
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(251,191,36,0.55)';
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(`${c.stallCursor + 1} / ${all.length}`, px + pw - 24, py + ph - 36);
  }

  // フッター
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(251,191,36,0.6)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('[E] 委託 / 引き上げ   [↑↓] 選択   [B / Esc] 閉じる',
    px + pw / 2, py + ph - 10);

  ctx.restore();
}

// ── 宝箱UI ─────────────────────────────────────

export interface BaseChestContext {
  player:        Player;
  baseChest:     ItemDef[];
  baseChestSide: 'chest' | 'inventory';
  baseCursor:    number;
}

function drawChestIcon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number, glow: number,
): void {
  ctx.save();
  const w = size, h = size * 0.8;
  const x = cx - w / 2, y = cy - h / 2 + 2;

  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 8 + 10 * glow;

  // 本体
  const bodyY = y + h * 0.4, bodyH = h * 0.6;
  const bg = ctx.createLinearGradient(x, bodyY, x, bodyY + bodyH);
  bg.addColorStop(0, '#92400e'); bg.addColorStop(1, '#451a03');
  roundRect(ctx, x, bodyY, w, bodyH, 3); ctx.fillStyle = bg; ctx.fill();

  // 蓋
  const lidG = ctx.createLinearGradient(x, y, x, y + h * 0.4);
  lidG.addColorStop(0, '#b45309'); lidG.addColorStop(1, '#78350f');
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.4);
  ctx.lineTo(x + w, y + h * 0.4);
  ctx.lineTo(x + w, y + h * 0.2);
  ctx.arc(cx, y + h * 0.2, w / 2, 0, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = lidG; ctx.fill();

  // 金縁
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1;
  ctx.strokeRect(x, bodyY, w, bodyH);

  // 鍵穴
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 6;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(cx, bodyY + 6, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#451a03';
  ctx.beginPath(); ctx.arc(cx, bodyY + 5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(cx - 1, bodyY + 5, 2, 4);

  ctx.restore();
}

function drawSparkle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fde68a';
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.3, cy - r * 0.3);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx + r * 0.3, cy + r * 0.3);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r * 0.3, cy + r * 0.3);
  ctx.lineTo(cx - r, cy);
  ctx.lineTo(cx - r * 0.3, cy - r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawBaseChest(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  c: BaseChestContext,
): void {
  ctx.save();

  const now = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
  const pulse = 0.5 + 0.5 * Math.abs(Math.sin(now * 1.5));

  // 背景暗幕
  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  ctx.fillRect(0, 0, W, H);

  const ROW_H = 40;
  const COL_W = 290;
  const pw = COL_W * 2 + 80;
  const ph = 460;
  const px = ((W - pw) / 2) | 0;
  const py = ((H - ph) / 2) | 0;

  // 外枠（木目 + 金縁）
  const outerG = ctx.createLinearGradient(px, py, px, py + ph);
  outerG.addColorStop(0, '#2d1810');
  outerG.addColorStop(1, '#0a0503');
  roundRect(ctx, px, py, pw, ph, 14);
  ctx.fillStyle = outerG; ctx.fill();
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 18 * pulse;
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.shadowBlur = 0;

  // 内側金線
  ctx.strokeStyle = 'rgba(251,191,36,0.25)'; ctx.lineWidth = 1;
  roundRect(ctx, px + 5, py + 5, pw - 10, ph - 10, 10); ctx.stroke();

  // キラキラ粒子（背景）
  for (let i = 0; i < 10; i++) {
    const sp = ((now * 0.35 + i * 0.13) % 1);
    const sx = px + 20 + (i * 73 % (pw - 40));
    const sy = py + 20 + sp * (ph - 40);
    drawSparkle(ctx, sx, sy, 2.2, (1 - sp) * 0.5);
  }

  // ── タイトル横断バー ─────────────────
  const titleY = py + 14;
  const chestCX = px + pw / 2 - 120;
  drawChestIcon(ctx, chestCX, titleY + 18, 40, pulse);

  ctx.font = 'bold 18px "Noto Sans JP", monospace';
  ctx.fillStyle = '#fde68a';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 10;
  ctx.fillText('宝箱 — 倉庫', chestCX + 28, titleY + 14);
  ctx.shadowBlur = 0;
  ctx.font = '10px "Noto Sans JP", monospace';
  ctx.fillStyle = 'rgba(253,230,138,0.65)';
  ctx.fillText(`${c.baseChest.length} 点を預かり中`, chestCX + 28, titleY + 30);

  // 区切り
  ctx.strokeStyle = 'rgba(251,191,36,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + 16, py + 54);
  ctx.lineTo(px + pw - 16, py + 54); ctx.stroke();

  // ── 2 カラム構成 ──────────────────────
  const colY = py + 64;
  const colH = ph - 100;
  const colA_X = px + 20;
  const colB_X = px + pw / 2 + 20;

  // カラム枠（チェスト側）
  const drawColPanel = (
    cx: number, cy: number, cw: number, ch: number,
    title: string, count: string, active: boolean,
  ) => {
    roundRect(ctx, cx, cy, cw, ch, 10);
    const g = ctx.createLinearGradient(cx, cy, cx, cy + ch);
    g.addColorStop(0, 'rgba(38,22,10,0.85)');
    g.addColorStop(1, 'rgba(14,7,3,0.92)');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = active ? '#fbbf24' : 'rgba(120,80,40,0.45)';
    ctx.lineWidth = active ? 2 : 1;
    ctx.stroke();

    ctx.font = 'bold 12px "Noto Sans JP", monospace';
    ctx.fillStyle = active ? '#fde68a' : '#9ca3af';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(title, cx + 12, cy + 8);
    ctx.font = '10px monospace';
    ctx.fillStyle = active ? 'rgba(253,230,138,0.7)' : 'rgba(156,163,175,0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(count, cx + cw - 12, cy + 10);
  };

  drawColPanel(colA_X, colY, COL_W, colH, '🗃 宝箱', `${c.baseChest.length} 件`,
    c.baseChestSide === 'chest');
  drawColPanel(colB_X, colY, COL_W, colH, '🎒 所持品',
    `${c.player.inventory.length} / ${c.player.maxInventory}`,
    c.baseChestSide === 'inventory');

  // アイテムリスト
  const drawCol = (items: ItemDef[], startX: number, colY0: number, side: 'chest' | 'inventory') => {
    if (items.length === 0) {
      ctx.font = '11px "Noto Sans JP", monospace';
      ctx.fillStyle = '#4b5563';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('（なし）', startX + COL_W / 2, colY0 + colH / 2);
      return;
    }
    const maxVisible = Math.floor((colH - 34) / ROW_H);
    const active = c.baseChestSide === side;
    const half = Math.floor(maxVisible / 2);
    const scroll = active
      ? Math.max(0, Math.min(items.length - maxVisible, c.baseCursor - half))
      : 0;
    for (let vi = 0; vi < Math.min(maxVisible, items.length - scroll); vi++) {
      const i = scroll + vi;
      const item = items[i];
      const rowY  = colY0 + 30 + vi * ROW_H;
      const isSel = active && i === c.baseCursor;
      const tier = item.tier ?? 0;
      const tierC = TIER_COLORS[tier] ?? '#9ca3af';

      const cardX = startX + 8, cardY = rowY, cardW = COL_W - 16, cardH = ROW_H - 4;
      roundRect(ctx, cardX, cardY, cardW, cardH, 6);
      if (isSel) {
        const bg = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
        bg.addColorStop(0, 'rgba(120,80,0,0.55)');
        bg.addColorStop(1, 'rgba(60,40,10,0.7)');
        ctx.fillStyle = bg; ctx.fill();
        ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 8 * pulse;
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.8;
        roundRect(ctx, cardX, cardY, cardW, cardH, 6);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = 'rgba(28,16,8,0.55)'; ctx.fill();
      }

      // tier 左バー
      ctx.fillStyle = tierC;
      roundRect(ctx, cardX, cardY, 3, cardH, 1); ctx.fill();

      // アイコン
      ctx.font = '18px monospace';
      ctx.fillStyle = item.color ?? '#e2e8f0';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(item.icon ?? '?', cardX + 22, cardY + cardH / 2);

      // 名前
      ctx.textAlign = 'left';
      ctx.font = 'bold 11px "Noto Sans JP", monospace';
      ctx.fillStyle = isSel ? '#ffffff' : '#e9d5ff';
      ctx.fillText(item.name, cardX + 40, cardY + 13);

      // ステータス
      ctx.font = '9px monospace';
      ctx.fillStyle = isSel ? '#fde68a' : 'rgba(167,139,250,0.7)';
      ctx.fillText(itemStatText(item), cardX + 40, cardY + cardH - 10);

      // tier
      ctx.textAlign = 'right';
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = tierC;
      ctx.fillText(`T${tier}`, cardX + cardW - 8, cardY + 13);
    }

    // スクロール表示
    if (items.length > maxVisible) {
      ctx.font = '8px monospace';
      ctx.fillStyle = active ? 'rgba(251,191,36,0.6)' : 'rgba(156,163,175,0.4)';
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`${active ? c.baseCursor + 1 : 1} / ${items.length}`,
        startX + COL_W - 12, colY0 + colH - 6);
    }
  };

  drawCol(c.baseChest, colA_X, colY, 'chest');
  drawCol(c.player.inventory, colB_X, colY, 'inventory');

  // ── 中央の転送アイコン（矢印） ─────────
  const arrowY = colY + colH / 2;
  const arrowX = (colA_X + COL_W + colB_X) / 2;
  ctx.save();
  ctx.translate(arrowX, arrowY);
  const dir = c.baseChestSide === 'chest' ? 1 : -1;
  const bob = Math.sin(now * 3) * 3;
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = `rgba(251,191,36,${0.6 + 0.4 * pulse})`;
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 12;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(dir > 0 ? '→' : '←', bob, 0);
  ctx.shadowBlur = 0;
  ctx.font = '8px monospace';
  ctx.fillStyle = 'rgba(253,230,138,0.65)';
  ctx.fillText('Enter', 0, 16);
  ctx.restore();

  // フッター
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(251,191,36,0.6)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('[←→] 切替   [↑↓] 選択   [Enter] 移動   [B / Esc] 閉じる',
    px + pw / 2, py + ph - 10);

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

// ── tier ごとのアクセントカラー ───────────────
const TIER_COLORS: Record<number, string> = {
  0: '#9ca3af',
  1: '#60a5fa',
  2: '#a78bfa',
  3: '#fbbf24',
};

function drawAwning(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  t: number,
): void {
  // 波打つ天幕
  ctx.save();
  const stripes = 10;
  const sw = w / stripes;
  for (let i = 0; i < stripes; i++) {
    const wave = Math.sin(t * 1.3 + i * 0.7) * 2.5;
    ctx.fillStyle = i % 2 === 0 ? '#b91c1c' : '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(x + i * sw,             y);
    ctx.lineTo(x + (i + 1) * sw,       y);
    ctx.lineTo(x + (i + 1) * sw + 1,   y + h + wave);
    ctx.lineTo(x + i * sw - 1,         y + h + wave);
    ctx.closePath();
    ctx.fill();
  }
  // 天幕の縁
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= stripes; i++) {
    const wave = Math.sin(t * 1.3 + i * 0.7) * 2.5;
    if (i === 0) ctx.moveTo(x + i * sw, y + h + wave);
    else ctx.lineTo(x + i * sw, y + h + wave);
  }
  ctx.stroke();
  ctx.restore();
}

function drawCoinStack(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, count: number,
  t: number,
): void {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const yy = cy - i * 3;
    const wobble = Math.sin(t * 2 + i * 0.8) * 0.4;
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(cx + wobble, yy, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(cx + wobble, yy, 9, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBaseShop(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  c: BaseShopContext,
): void {
  ctx.save();

  const now = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;

  // 背景暗幕
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);

  const pw = 560;
  const ROW_H = 54;
  const headerH = 92;
  const footerH = 56;
  const listH = Math.max(ROW_H, ROW_H * Math.max(1, c.baseShopItems.length));
  const ph = headerH + Math.min(listH, ROW_H * 7) + footerH;
  const px = ((W - pw) / 2) | 0;
  const py = Math.max(20, ((H - ph) / 2) | 0);

  // ── 外枠（木目と金縁） ──────────────────
  const woodG = ctx.createLinearGradient(px, py, px, py + ph);
  woodG.addColorStop(0, '#3b1f0c');
  woodG.addColorStop(1, '#1a0e05');
  roundRect(ctx, px, py, pw, ph, 14);
  ctx.fillStyle = woodG; ctx.fill();
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5; ctx.stroke();

  // 内側の金縁
  ctx.strokeStyle = 'rgba(251,191,36,0.25)'; ctx.lineWidth = 1;
  roundRect(ctx, px + 5, py + 5, pw - 10, ph - 10, 10); ctx.stroke();

  // ── 天幕（屋根） ──────────────────────
  drawAwning(ctx, px + 8, py + 10, pw - 16, 20, now);

  // ── 看板 ─────────────────────────────
  const signY = py + 36;
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 12;
  ctx.fillStyle = '#78350f';
  roundRect(ctx, px + pw / 2 - 110, signY, 220, 32, 6); ctx.fill();
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.font = 'bold 15px "Noto Sans JP", monospace';
  ctx.fillStyle = '#fde68a';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🏪 拠点ショップ', px + pw / 2, signY + 16);

  // ── 所持金（金貨スタック演出） ──────────
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#fde68a';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`💰 所持金: ${c.player.gold}G`, px + 24, py + headerH - 14);

  // 仕切り
  ctx.strokeStyle = 'rgba(251,191,36,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + 16, py + headerH - 2);
  ctx.lineTo(px + pw - 16, py + headerH - 2); ctx.stroke();

  // ── 売り切れ表示 ───────────────────────
  if (c.baseShopItems.length === 0) {
    ctx.font = 'bold 14px "Noto Sans JP", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('本日は売り切れです…', px + pw / 2, py + headerH + 30);
    ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(156,163,175,0.55)';
    ctx.fillText('[Esc / B] 閉じる', px + pw / 2, py + ph - 20);
    ctx.restore();
    return;
  }

  // ── アイテムリスト（カード形式） ──────────
  const listStartY = py + headerH + 4;
  const visible = Math.min(7, c.baseShopItems.length);
  const half = Math.floor(visible / 2);
  const scroll = Math.max(0, Math.min(
    c.baseShopItems.length - visible,
    c.baseShopCursor - half,
  ));

  for (let vi = 0; vi < visible; vi++) {
    const i = scroll + vi;
    if (i >= c.baseShopItems.length) break;
    const entry  = c.baseShopItems[i];
    const rowY   = listStartY + vi * ROW_H;
    const isSel  = i === c.baseShopCursor;
    const canBuy = c.player.gold >= entry.price;
    const tier   = (entry.item.tier ?? 0);
    const tierC  = TIER_COLORS[tier] ?? '#9ca3af';

    // カード背景
    const cardX = px + 14, cardY = rowY + 3;
    const cardW = pw - 28, cardH = ROW_H - 6;
    const bgG = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    if (isSel) {
      bgG.addColorStop(0, 'rgba(120,80,0,0.6)');
      bgG.addColorStop(1, 'rgba(60,40,10,0.85)');
    } else {
      bgG.addColorStop(0, 'rgba(42,26,10,0.75)');
      bgG.addColorStop(1, 'rgba(20,10,5,0.85)');
    }
    roundRect(ctx, cardX, cardY, cardW, cardH, 7);
    ctx.fillStyle = bgG; ctx.fill();

    // tier カラーの左バー
    ctx.fillStyle = tierC;
    roundRect(ctx, cardX, cardY, 4, cardH, 2); ctx.fill();

    // 選択ハイライト（点滅する枠）
    if (isSel) {
      const pulse = 0.6 + 0.4 * Math.abs(Math.sin(now * 4));
      ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 10 * pulse;
      ctx.strokeStyle = `rgba(251,191,36,${pulse})`;
      ctx.lineWidth = 2;
      roundRect(ctx, cardX, cardY, cardW, cardH, 7);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = `rgba(120,80,40,0.4)`;
      ctx.lineWidth = 1;
      roundRect(ctx, cardX, cardY, cardW, cardH, 7);
      ctx.stroke();
    }

    // 円形アイコン枠
    const iconCX = cardX + 30, iconCY = cardY + cardH / 2;
    ctx.fillStyle = 'rgba(8,5,2,0.7)';
    ctx.beginPath(); ctx.arc(iconCX, iconCY, 17, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = tierC; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(iconCX, iconCY, 17, 0, Math.PI * 2); ctx.stroke();

    // アイコン
    ctx.font = '22px monospace';
    ctx.fillStyle = entry.item.color ?? '#e2d5c0';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(entry.item.icon ?? '?', iconCX, iconCY);

    // 名前 + Tier バッジ
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px "Noto Sans JP", monospace';
    ctx.fillStyle = isSel ? '#ffffff' : (canBuy ? '#fde68a' : '#6b7280');
    ctx.fillText(entry.item.name, cardX + 56, cardY + 14);

    // Tier バッジ
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = tierC;
    ctx.fillText(`[T${tier}]`, cardX + 56 + ctx.measureText(entry.item.name).width + 22, cardY + 14);

    // ステータス
    ctx.font = '10px monospace';
    ctx.fillStyle = isSel ? '#c4b5fd' : 'rgba(167,139,250,0.65)';
    ctx.fillText(itemStatText(entry.item), cardX + 56, cardY + cardH - 14);

    // 価格タグ
    const tagX = cardX + cardW - 76, tagY = cardY + 6;
    const tagW = 66, tagH = cardH - 12;
    ctx.fillStyle = canBuy ? '#78350f' : '#3f3f46';
    roundRect(ctx, tagX, tagY, tagW, tagH, 5); ctx.fill();
    ctx.strokeStyle = canBuy ? '#fbbf24' : '#6b7280';
    ctx.lineWidth = 1.2; ctx.stroke();
    // タグの穴
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath(); ctx.arc(tagX + 6, tagY + tagH / 2, 2.5, 0, Math.PI * 2); ctx.fill();
    // 価格
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = canBuy ? '#fde68a' : '#9ca3af';
    ctx.fillText(`${entry.price}G`, tagX + tagW / 2 + 3, tagY + tagH / 2);

    // 買えないマーク
    if (!canBuy) {
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#f87171';
      ctx.fillText('資金不足', tagX + tagW / 2 + 3, tagY + tagH - 6);
    }
  }

  // スクロールインジケータ
  if (c.baseShopItems.length > visible) {
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(251,191,36,0.55)';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(`${c.baseShopCursor + 1} / ${c.baseShopItems.length}`,
      px + pw - 20, listStartY + visible * ROW_H + 4);
  }

  // 金貨スタック（右下）
  if (c.player.gold > 0) {
    const stacks = Math.min(6, Math.max(1, Math.floor(c.player.gold / 50) + 1));
    drawCoinStack(ctx, px + 28, py + ph - 24, stacks, now);
  }

  // フッター
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(251,191,36,0.6)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('[↑↓] 選択   [Enter] 購入   [B / Esc] 閉じる', px + pw / 2, py + ph - 20);

  ctx.restore();
}
