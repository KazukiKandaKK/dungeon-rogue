// ─────────────────────────────────────────────
// inventory.ts  インベントリ・魔法メニュー・露店メニュー描画
//
// main.js から段階的に移行した Canvas 描画関数群。
// 依存する状態をすべてコンテキスト引数として明示する。
// ─────────────────────────────────────────────

import type { Player }    from '../entities/player.js';
import type { ItemDef }   from '../data/equipment.js';
import { itemStatText }   from '../data/equipment.js';
import { SPELLS }         from '../data/magic.js';
import { SLOTS, SLOT_LABEL, INV_COLS } from '../core/game-constants.js';
import { roundRect, drawMCSlot }       from './hud.js';

// ── 魔法メニューコンテキスト ─────────────────────

export interface MagicMenuContext {
  player:      Player;
  magicCursor: number;
}

// ── 露店メニューエントリ / コンテキスト ──────────

export interface ShopMenuEntry {
  item:  ItemDef;
  price: number;
}

export interface ShopMenuContext {
  player:     Player;
  shopItems:  ShopMenuEntry[];
  shopCursor: number;
}

// ── インベントリコンテキスト ─────────────────────

export interface InventoryContext {
  player:    Player;
  invCursor: number;
}

// ─────────────────────────────────────────────
// drawMagicMenu  魔法メニュー
// ─────────────────────────────────────────────

export function drawMagicMenu(
  ctx: CanvasRenderingContext2D,
  W:   number,
  H:   number,
  { player, magicCursor }: MagicMenuContext,
): void {
  ctx.save();
  const spells = player.spells ?? [];
  const ROW_H  = 38;
  const pw = 420, ph = Math.max(120, 54 + spells.length * ROW_H + 20);
  const px = (W - pw) / 2, py = (H - ph) / 2;

  roundRect(ctx, px, py, pw, ph, 12);
  ctx.fillStyle = 'rgba(8,3,30,0.97)'; ctx.fill();
  ctx.strokeStyle = 'rgba(129,140,248,0.8)'; ctx.lineWidth = 2; ctx.stroke();

  ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#818cf8';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(`✨ 魔法  (MP: ${player.mp}/${player.totalMaxMp})`, px + pw / 2, py + 12);
  ctx.strokeStyle = 'rgba(129,140,248,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + 12, py + 34); ctx.lineTo(px + pw - 12, py + 34); ctx.stroke();

  if (spells.length === 0) {
    ctx.font = '12px monospace'; ctx.fillStyle = '#666'; ctx.textAlign = 'center';
    ctx.fillText('使える魔法がない', px + pw / 2, py + 54);
  } else {
    for (let i = 0; i < spells.length; i++) {
      const spell    = SPELLS[spells[i]];
      if (!spell) continue;
      const rowY     = py + 44 + i * ROW_H;
      const isSelect = i === magicCursor;
      const mpOk     = player.mp >= spell.mp;

      if (isSelect) {
        roundRect(ctx, px + 10, rowY - 2, pw - 20, ROW_H - 4, 6);
        ctx.fillStyle = 'rgba(79,70,229,0.4)'; ctx.fill();
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const midY = rowY + ROW_H / 2 - 6;
      ctx.font = '14px monospace';
      ctx.fillStyle = isSelect ? '#fff' : (mpOk ? '#c4b5fd' : '#555');
      ctx.fillText(`${spell.icon} ${spell.name}`, px + 18, midY);
      ctx.font = '10px monospace';
      ctx.fillStyle = mpOk ? '#6366f1' : '#7f1d1d';
      ctx.fillText(`MP: ${spell.mp}`, px + 190, midY);
      ctx.font = '9px monospace';
      ctx.fillStyle = isSelect ? '#a5b4fc' : '#4a5568';
      ctx.fillText(spell.desc, px + 18, midY + 14);

      // 射程タグ
      const rangeLabel: Record<string, string> = {
        burst: '爆発', line: '直線', cross: '十字', floor: '全体', self: '自身',
      };
      ctx.font = '9px monospace'; ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      ctx.fillText(`[${rangeLabel[spell.range] ?? spell.range}]`, px + pw - 16, midY);
    }
  }

  ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(156,163,175,0.5)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('[↑↓] 選択   [Enter] 発動   [1-6] ホットバーセット   [O/Esc] 閉じる', px + pw / 2, py + ph - 6);
  ctx.restore();
}

// ─────────────────────────────────────────────
// drawShopMenu  露店メニュー
// ─────────────────────────────────────────────

export function drawShopMenu(
  ctx: CanvasRenderingContext2D,
  W:   number,
  H:   number,
  { player, shopItems, shopCursor }: ShopMenuContext,
): void {
  ctx.save();
  const ROW_H = 40;
  const pw = 520, ph = Math.max(160, 80 + shopItems.length * ROW_H + 24);
  const px = (W - pw) / 2, py = (H - ph) / 2;

  roundRect(ctx, px, py, pw, ph, 12);
  ctx.fillStyle = 'rgba(10,5,25,0.97)'; ctx.fill();
  ctx.strokeStyle = 'rgba(251,191,36,0.8)'; ctx.lineWidth = 2; ctx.stroke();

  ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(`🏪 露店  (所持金: ${player.gold}G)`, px + pw / 2, py + 12);

  ctx.strokeStyle = 'rgba(251,191,36,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + 12, py + 36); ctx.lineTo(px + pw - 12, py + 36); ctx.stroke();

  if (shopItems.length === 0) {
    ctx.font = '12px monospace'; ctx.fillStyle = '#666'; ctx.textAlign = 'center';
    ctx.fillText('売り切れ！', px + pw / 2, py + 56);
  } else {
    for (let i = 0; i < shopItems.length; i++) {
      const entry     = shopItems[i];
      const item      = entry.item;
      const rowY      = py + 46 + i * ROW_H;
      const isSel     = i === shopCursor;
      const canAfford = player.gold >= entry.price;

      if (isSel) {
        roundRect(ctx, px + 10, rowY - 2, pw - 20, ROW_H - 4, 6);
        ctx.fillStyle = 'rgba(120,80,0,0.4)'; ctx.fill();
      }

      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const midY = rowY + ROW_H / 2 - 4;
      ctx.font = '13px monospace';
      ctx.fillStyle = isSel ? '#fff' : (canAfford ? '#e2e8f0' : '#555');
      ctx.fillText(`${item.icon} ${item.name}`, px + 18, midY);

      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(167,139,250,0.8)';
      ctx.fillText(itemStatText(item), px + 190, midY);

      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = canAfford ? '#fbbf24' : '#7f1d1d';
      ctx.textAlign = 'right';
      ctx.fillText(`${entry.price}G`, px + pw - 18, midY);

      if (isSel) {
        ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(200,200,200,0.6)';
        ctx.textAlign = 'right';
        ctx.fillText('[Enter]購入', px + pw - 18, midY + 14);
      }
    }
  }

  ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(156,163,175,0.5)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('[↑↓] 選択   [Enter] 購入   [B/Esc] 閉じる', px + pw / 2, py + ph - 6);
  ctx.restore();
}

// ─────────────────────────────────────────────
// drawInventory  装備・所持品画面
// ─────────────────────────────────────────────

export function drawInventory(
  ctx: CanvasRenderingContext2D,
  W:   number,
  H:   number,
  { player, invCursor }: InventoryContext,
): void {
  ctx.save();

  // ── レイアウト定数 ──────────────────────────
  const S    = 54;    // スロットサイズ
  const G    = 4;     // スロット間ギャップ
  const ROWS = Math.ceil(player.maxInventory / INV_COLS);

  const LEFT_W = 220; // 装備パネル幅
  const GRID_W = INV_COLS * S + (INV_COLS - 1) * G;
  const pw = LEFT_W + 18 + GRID_W + 24;  // パネル全幅
  const ph = ROWS * (S + G) + 120;       // 行数に応じた高さ
  const px = (W - pw) / 2 | 0;
  const py = H - ph - 60 | 0;            // 画面下部（ホットバーの上）

  // ── 外パネル（マイクラ風ダークグレー）──────
  ctx.fillStyle = '#2d2d2d';
  ctx.fillRect(px, py, pw, ph);
  // 外枠ベベル
  ctx.fillStyle = '#555';
  ctx.fillRect(px, py, pw, 2); ctx.fillRect(px, py, 2, ph);
  ctx.fillStyle = '#111';
  ctx.fillRect(px, py + ph - 2, pw, 2); ctx.fillRect(px + pw - 2, py, 2, ph);

  // ── タイトルバー ────────────────────────────
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(px + 2, py + 2, pw - 4, 30);
  ctx.font         = 'bold 13px "Noto Sans JP", monospace';
  ctx.fillStyle    = '#ffffff';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('装備・所持品', px + pw / 2, py + 17);

  // ── 縦仕切り ────────────────────────────────
  const divX = px + LEFT_W + 8;
  ctx.fillStyle = '#111';
  ctx.fillRect(divX, py + 34, 2, ph - 64);
  ctx.fillStyle = '#484848';
  ctx.fillRect(divX + 2, py + 34, 1, ph - 64);

  // ════════════════════════════════════════════
  // 左ゾーン：装備スロット
  // ════════════════════════════════════════════
  const EX = px + 10;
  let   EY = py + 40;

  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#aaaaaa';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('装  備', EX + 2, EY);
  EY += 16;

  const EQUIP_SLOT_W = LEFT_W - 14;
  const EQUIP_SLOT_H = 50;
  const SLOT_ICON: Record<string, string> = { weapon: '⚔', armor: '🛡', accessory: '💍' };

  SLOTS.forEach((slot, i) => {
    const eq  = player.equip[slot];
    const sel = invCursor === i;
    const sy  = EY + i * (EQUIP_SLOT_H + 5);

    // スロット背景（横長スロット・ベベル）
    const B = 3;
    ctx.fillStyle = sel ? '#7090e8' : '#3a3a3a';
    ctx.fillRect(EX, sy, EQUIP_SLOT_W, EQUIP_SLOT_H);
    ctx.fillStyle = sel ? '#a0b8ff' : '#555';
    ctx.fillRect(EX, sy, EQUIP_SLOT_W, B);
    ctx.fillRect(EX, sy, B, EQUIP_SLOT_H);
    ctx.fillStyle = sel ? '#2040a8' : '#1a1a1a';
    ctx.fillRect(EX, sy + EQUIP_SLOT_H - B, EQUIP_SLOT_W, B);
    ctx.fillRect(EX + EQUIP_SLOT_W - B, sy, B, EQUIP_SLOT_H);
    ctx.fillStyle = sel ? '#1e2d5a' : '#1d1d1d';
    ctx.fillRect(EX + B, sy + B, EQUIP_SLOT_W - B * 2, EQUIP_SLOT_H - B * 2);

    // スロットアイコン（左端 IS×IS の正方形ミニスロット）
    const IS = EQUIP_SLOT_H - 8;
    drawMCSlot(ctx, EX + 4, sy + 4, IS, false);
    ctx.font = `${IS - 8}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = eq ? '#ffffff' : '#444';
    ctx.fillText(eq ? eq.icon : (SLOT_ICON[slot] ?? ''), EX + 4 + IS / 2, sy + EQUIP_SLOT_H / 2);

    // スロットラベル＋アイテム名
    const TX = EX + 4 + IS + 8;
    const MY = sy + EQUIP_SLOT_H / 2;
    ctx.textAlign = 'left';
    ctx.font = '9px monospace';
    ctx.fillStyle = sel ? '#aac0ff' : '#888';
    ctx.textBaseline = 'bottom';
    ctx.fillText(SLOT_LABEL[slot] ?? slot, TX, MY);

    if (eq) {
      ctx.font = '11px monospace';
      ctx.fillStyle = sel ? '#fffccc' : '#e8e8e8';
      ctx.textBaseline = 'top';
      ctx.fillText(eq.name, TX, MY);
      ctx.font = '9px monospace';
      ctx.fillStyle = sel ? '#b0aaff' : '#9977ff';
      ctx.textBaseline = 'top';
      ctx.fillText(itemStatText(eq), TX, MY + 13);
      // 耐久バー
      if (eq.durability !== undefined && eq.maxDurability !== undefined) {
        const barW    = EQUIP_SLOT_W - IS - 20;
        const durRatio = Math.max(0, eq.durability / eq.maxDurability);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(TX, MY + 26, barW, 4);
        ctx.fillStyle = durRatio > 0.5 ? '#4ade80' : durRatio > 0.2 ? '#fbbf24' : '#ef4444';
        ctx.fillRect(TX, MY + 26, Math.max(0, barW * durRatio), 4);
      }
    } else {
      ctx.font = '10px monospace';
      ctx.fillStyle = '#444';
      ctx.textBaseline = 'top';
      ctx.fillText('（なし）', TX, MY);
    }
  });

  // ── ステータス ──────────────────────────────
  const STAT_Y = EY + SLOTS.length * (EQUIP_SLOT_H + 5) + 10;
  ctx.fillStyle = '#111';
  ctx.fillRect(EX, STAT_Y, EQUIP_SLOT_W, 2);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(EX, STAT_Y + 2, EQUIP_SLOT_W, 1);

  const SY2 = STAT_Y + 10;
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const drawStat = (label: string, val: string, color: string, x: number, y: number) => {
    ctx.fillStyle = '#888'; ctx.fillText(label, x, y);
    ctx.fillStyle = color;  ctx.fillText(val,   x + 28, y);
  };
  drawStat('LV',  String(player.lv),                   '#fde68a', EX + 2,  SY2);
  drawStat('EXP', `${player.exp}/${player.expNext}`,   '#86efac', EX + 64, SY2);
  drawStat('HP',  `${player.hp}/${player.maxHP}`,      '#f87171', EX + 2,  SY2 + 16);
  drawStat('MP',  `${player.mp}/${player.totalMaxMp}`, '#818cf8', EX + 80, SY2 + 16);
  drawStat('ATK', String(player.atk),                  '#fb923c', EX + 2,  SY2 + 32);
  drawStat('DEF', String(player.def),                  '#38bdf8', EX + 64, SY2 + 32);
  ctx.fillStyle = '#888';    ctx.fillText('G', EX + 2,  SY2 + 48);
  ctx.fillStyle = '#fbbf24'; ctx.fillText(String(player.gold ?? 0), EX + 28, SY2 + 48);

  // ════════════════════════════════════════════
  // 右ゾーン：インベントリグリッド
  // ════════════════════════════════════════════
  const GX = divX + 10;
  const GY = py + 40;

  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#aaaaaa';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`所持品  ${player.inventory.length} / ${player.maxInventory}`, GX, GY);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < INV_COLS; col++) {
      const idx = row * INV_COLS + col;
      const sx  = GX + col * (S + G);
      const sy  = GY + 18 + row * (S + G);
      const sel = invCursor === SLOTS.length + idx;

      drawMCSlot(ctx, sx, sy, S, sel);

      const item = player.inventory[idx];
      if (item) {
        // アイテムアイコン（中央）
        ctx.font = '26px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(item.icon, sx + S / 2, sy + S / 2 - 2);

        // スロット種別バッジ（右下）
        const badgeMap: Record<string, string> = {
          weapon: '武', armor: '鎧', accessory: '飾', consumable: '薬',
        };
        const badge = badgeMap[item.slot] ?? '';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = item.slot === 'consumable' ? '#86efac' : '#a5b4fc';
        ctx.fillText(badge, sx + S - 4, sy + S - 3);
      } else if (idx < player.maxInventory) {
        // 空スロットのスロット番号
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#333';
        ctx.fillText(String(idx + 1), sx + S / 2, sy + S / 2);
      }
    }
  }

  // ── ツールチップ ────────────────────────────
  const selItem  = invCursor >= SLOTS.length
    ? (player.inventory[invCursor - SLOTS.length] ?? null)
    : null;
  const selEquip = invCursor < SLOTS.length
    ? (player.equip[SLOTS[invCursor]] ?? null)
    : null;
  const tipTarget = selItem ?? selEquip;

  const TY = GY + 18 + ROWS * (S + G) + 8;
  const TW = GRID_W;
  ctx.fillStyle = '#111';
  ctx.fillRect(GX, TY, TW, 2);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(GX, TY + 2, TW, 1);

  if (tipTarget) {
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#fffccc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${tipTarget.icon} ${tipTarget.name}`, GX + 4, TY + 8);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#a5b4fc';
    ctx.fillText(itemStatText(tipTarget), GX + 4, TY + 24);

    ctx.font = '9px monospace';
    ctx.fillStyle = '#666';
    if (selItem) {
      const hint = selItem.slot === 'consumable' ? '[Enter] 使う' : '[Enter] 装備';
      ctx.fillText(`${hint}   [D] 捨てる`, GX + 4, TY + 40);
    } else if (selEquip) {
      ctx.fillText('[Enter] 外す', GX + 4, TY + 40);
    }
  } else {
    ctx.font = '9px monospace';
    ctx.fillStyle = '#444';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('アイテムを選択...', GX + 4, TY + 20);
  }

  // ── フッター ────────────────────────────────
  ctx.font = '9px monospace';
  ctx.fillStyle = '#555';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('↑↓←→ 選択   Enter 装備/使う   D 捨てる   I/ESC 閉じる', px + pw / 2, py + ph - 6);

  ctx.restore();
}
