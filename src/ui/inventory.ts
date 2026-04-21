// ─────────────────────────────────────────────
// inventory.ts  インベントリ・魔法メニュー・露店メニュー描画
//
// main.js から段階的に移行した Canvas 描画関数群。
// 依存する状態をすべてコンテキスト引数として明示する。
// ─────────────────────────────────────────────

import type { Player }    from '../entities/player.js';
import type { ItemDef }   from '../data/equipment.js';
import type { SpriteLoader } from '../core/sprites.js';
import { itemStatText }   from '../data/equipment.js';
import { SPELLS }         from '../data/magic.js';
import { SLOTS, SLOT_LABEL, INV_COLS } from '../core/game-constants.js';
import { roundRect, drawMCSlot }       from './hud.js';
import { drawItemIcon }                from './item-renderer.js';
import { APPEARANCES }                 from '../data/appearances.js';

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
  sprites?:  SpriteLoader;
}

// ── カテゴリ別の背景色 ───────────────────────────
//
// 一覧性のために、スロットの中身によってセルの内側を色分けする。
// 塗りつぶし色（内側）とフチ色（ベベル上）のペアを返す。
// null のときは通常のダーク背景のまま。

export interface SlotTint {
  /** スロット内側の塗り色（半透明） */
  fill:   string;
  /** ベベル上部のアクセント色 */
  accent: string;
  /** 右下に小さく出すラベル（任意） */
  label?: string;
}

export function itemCategoryTint(item: ItemDef | null | undefined): SlotTint | null {
  if (!item) return null;
  if (item.slot === 'consumable') {
    if (item.revive)           return { fill: 'rgba(253,224,71,0.35)', accent: 'rgba(253,224,71,0.7)', label: '蘇' }; // 金：蘇生
    if (item.healMp !== undefined) return { fill: 'rgba(99,102,241,0.32)',  accent: 'rgba(129,140,248,0.7)', label: '魔' }; // 青：MP回復
    if (item.heal   !== undefined) return { fill: 'rgba(34,197,94,0.32)',   accent: 'rgba(134,239,172,0.7)', label: '回' }; // 緑：HP回復
    if ((item as { spellId?: string }).spellId) return { fill: 'rgba(168,85,247,0.32)', accent: 'rgba(196,181,253,0.7)', label: '巻' }; // 紫：巻物
    return { fill: 'rgba(148,163,184,0.25)', accent: 'rgba(203,213,225,0.55)', label: '薬' };
  }
  if (item.slot === 'weapon')    return { fill: 'rgba(239,68,68,0.3)',   accent: 'rgba(252,165,165,0.7)', label: '武' };
  if (item.slot === 'accessory') return { fill: 'rgba(251,191,36,0.3)',  accent: 'rgba(253,224,71,0.75)', label: '飾' };
  if (item.slot === 'head')      return { fill: 'rgba(14,165,233,0.28)', accent: 'rgba(125,211,252,0.7)', label: '頭' };
  if (item.slot === 'chest')     return { fill: 'rgba(59,130,246,0.3)',  accent: 'rgba(147,197,253,0.7)', label: '胸' };
  if (item.slot === 'waist')     return { fill: 'rgba(139,92,246,0.28)', accent: 'rgba(196,181,253,0.7)', label: '腰' };
  if (item.slot === 'legs')      return { fill: 'rgba(71,85,105,0.35)',  accent: 'rgba(148,163,184,0.7)', label: '足' };
  return null;
}

/**
 * drawMCSlot の上にカテゴリ色を重ね塗りする。
 * 選択中はさらに明るく表示される。
 */
function paintSlotTint(
  ctx: CanvasRenderingContext2D,
  x:   number,
  y:   number,
  s:   number,
  tint: SlotTint,
  selected: boolean,
): void {
  const B = 3;
  ctx.save();
  // 内側（ベベル内）に色を重ねる
  ctx.fillStyle = tint.fill;
  ctx.fillRect(x + B, y + B, s - B * 2, s - B * 2);
  // 選択時は追加で明度アップ
  if (selected) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + B, y + B, s - B * 2, s - B * 2);
  }
  // 上辺アクセント
  ctx.fillStyle = tint.accent;
  ctx.fillRect(x + B, y + B, s - B * 2, 1);
  ctx.restore();
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
// drawRiddleMenu  ボス結界の謎メニュー（4 択 UI）
// ─────────────────────────────────────────────

export interface RiddleMenuContext {
  /** 問題文 */
  question:     string;
  /** 4 つの選択肢 */
  choices:      readonly string[];
  /** 現在のカーソル位置 */
  riddleCursor: number;
  /** ボス名（タイトルに表示） */
  bossName:     string;
  /** 間違えた回数（警告を表示） */
  wrongCount:   number;
}

export function drawRiddleMenu(
  ctx: CanvasRenderingContext2D,
  W:   number,
  H:   number,
  c:   RiddleMenuContext,
): void {
  ctx.save();

  // 背景の暗幕
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);

  const pw = 520;
  const ph = 340;
  const px = (W - pw) / 2 | 0;
  const py = (H - ph) / 2 | 0;

  // パネル
  roundRect(ctx, px, py, pw, ph, 14);
  ctx.fillStyle   = 'rgba(10,5,30,0.97)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251,191,36,0.8)';
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  // 内側ゴールドライン
  roundRect(ctx, px + 6, py + 6, pw - 12, ph - 12, 10);
  ctx.strokeStyle = 'rgba(253,224,71,0.25)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  // タイトル
  ctx.font         = 'bold 16px "Noto Sans JP", monospace';
  ctx.fillStyle    = '#fde047';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`🔒 ${c.bossName} の謎`, px + pw / 2, py + 16);

  // 区切り線
  ctx.strokeStyle = 'rgba(251,191,36,0.35)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(px + 16, py + 40);
  ctx.lineTo(px + pw - 16, py + 40);
  ctx.stroke();

  // 問題文
  ctx.font      = '14px "Noto Sans JP", monospace';
  ctx.fillStyle = '#e9d5ff';
  ctx.textAlign = 'center';
  ctx.fillText(c.question, px + pw / 2, py + 58);

  // 選択肢
  const ROW_H = 42;
  const startY = py + 100;
  for (let i = 0; i < c.choices.length; i++) {
    const rowY     = startY + i * (ROW_H + 6);
    const isSelect = i === c.riddleCursor;

    roundRect(ctx, px + 30, rowY, pw - 60, ROW_H, 8);
    ctx.fillStyle = isSelect ? 'rgba(251,191,36,0.25)' : 'rgba(30,20,60,0.6)';
    ctx.fill();
    ctx.strokeStyle = isSelect ? 'rgba(253,224,71,0.9)' : 'rgba(100,80,160,0.4)';
    ctx.lineWidth   = isSelect ? 2 : 1;
    ctx.stroke();

    // 番号バッジ
    ctx.font      = 'bold 14px monospace';
    ctx.fillStyle = isSelect ? '#fde047' : '#a78bfa';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}.`, px + 46, rowY + ROW_H / 2);

    // 選択肢テキスト
    ctx.font      = '14px "Noto Sans JP", monospace';
    ctx.fillStyle = isSelect ? '#ffffff' : '#c4b5fd';
    ctx.fillText(c.choices[i]!, px + 70, rowY + ROW_H / 2);

    // カーソルマーク
    if (isSelect) {
      ctx.font      = '14px monospace';
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'right';
      ctx.fillText('▶', px + pw - 46, rowY + ROW_H / 2);
    }
  }

  // 警告（間違い回数）
  if (c.wrongCount > 0) {
    ctx.font      = '11px "Noto Sans JP", monospace';
    ctx.fillStyle = '#f87171';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`⚠ 不正解が ${c.wrongCount} 回！ ボスが回復している！`, px + pw / 2, py + ph - 28);
  }

  // 操作説明
  ctx.font      = '10px monospace';
  ctx.fillStyle = 'rgba(196,181,253,0.7)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('[↑↓] 選択   [Enter/Space] 決定   [1-4] 直接選択   [Q/Esc] 閉じる', px + pw / 2, py + ph - 10);

  ctx.restore();
}

// ─────────────────────────────────────────────
// drawInventory  装備・所持品画面
// ─────────────────────────────────────────────

export function drawInventory(
  ctx: CanvasRenderingContext2D,
  W:   number,
  H:   number,
  { player, invCursor, sprites }: InventoryContext,
): void {
  ctx.save();

  // ── レイアウト定数 ──────────────────────────
  const S    = 54;    // スロットサイズ
  const G    = 4;     // スロット間ギャップ
  const ROWS = Math.ceil(player.maxInventory / INV_COLS);

  const LEFT_W = 260; // 装備パネル幅（ペーパードール用に拡張）
  const GRID_W = INV_COLS * S + (INV_COLS - 1) * G;
  const pw = LEFT_W + 18 + GRID_W + 24;  // パネル全幅
  const ph = Math.max(ROWS * (S + G) + 120, 460); // 装備欄が収まる最低高さ
  const px = (W - pw) / 2 | 0;
  const py = (H - ph) / 2 | 0;            // 画面中央

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
  // 左ゾーン：ペーパードール（自分の姿＋装備スロット）
  // ════════════════════════════════════════════
  const EX = px + 10;
  let   EY = py + 40;

  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#aaaaaa';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('装  備', EX + 2, EY);
  EY += 16;

  // ペーパードールのレイアウト
  const SS        = 44;   // 各装備スロットの正方形サイズ
  const SGAP      = 6;    // スロット間ギャップ
  const AVATAR_W  = LEFT_W - 2 * SS - 3 * SGAP - 20; // 中央アバター幅
  const AVATAR_H  = 4 * SS + 3 * SGAP;               // 左列4スロット分の高さ
  const PD_Y      = EY;
  const LEFT_COL_X  = EX + 4;
  const AVATAR_X    = LEFT_COL_X + SS + SGAP;
  const RIGHT_COL_X = AVATAR_X + AVATAR_W + SGAP;

  const SLOT_ICON: Record<string, string> = {
    weapon: '⚔', head: '🎩', chest: '🛡', waist: '🎗', legs: '🥾', accessory: '💍',
  };
  const SLOT_POS: Record<string, { col: 'L' | 'R'; row: number }> = {
    head:      { col: 'L', row: 0 },
    chest:     { col: 'L', row: 1 },
    waist:     { col: 'L', row: 2 },
    legs:      { col: 'L', row: 3 },
    weapon:    { col: 'R', row: 0 },
    accessory: { col: 'R', row: 1 },
  };

  // ── アバターボックス ────────────────────────
  const avCx = AVATAR_X + AVATAR_W / 2;
  const avCy = PD_Y + AVATAR_H / 2;

  // 背景（ベベル付き暗いパネル）
  ctx.fillStyle = '#1d1d1d';
  ctx.fillRect(AVATAR_X, PD_Y, AVATAR_W, AVATAR_H);
  ctx.fillStyle = '#111';
  ctx.fillRect(AVATAR_X, PD_Y, AVATAR_W, 2);
  ctx.fillRect(AVATAR_X, PD_Y, 2, AVATAR_H);
  ctx.fillStyle = '#444';
  ctx.fillRect(AVATAR_X, PD_Y + AVATAR_H - 2, AVATAR_W, 2);
  ctx.fillRect(AVATAR_X + AVATAR_W - 2, PD_Y, 2, AVATAR_H);

  // 背景のほのかな光（胸防具の色 or 武器色）
  const glowColor = player.equip?.chest?.color ?? player.equip?.weapon?.color ?? null;
  if (glowColor) {
    const grad = ctx.createRadialGradient(avCx, avCy, 4, avCx, avCy, AVATAR_W * 0.55);
    grad.addColorStop(0, glowColor + '55');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(AVATAR_X + 2, PD_Y + 2, AVATAR_W - 4, AVATAR_H - 4);
  }

  // プレイヤーの姿
  const spriteSize = Math.min(AVATAR_W, AVATAR_H) - 24;
  const app = player.appearance;
  if (app && APPEARANCES[app.species]) {
    ctx.save();
    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur  = 14;
    }
    // アイドル位相（UIではゆったり揺らす）
    const phase = ((Date.now() * 0.0007) % 1 + 1) % 1;
    APPEARANCES[app.species].draw(ctx, avCx, avCy, spriteSize, 'front', app.tint, phase, 1);
    ctx.restore();
  } else if (sprites && sprites.get('player_front')) {
    ctx.save();
    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur  = 14;
    }
    sprites.draw(ctx, 'player_front', avCx, avCy, spriteSize, spriteSize);
    ctx.restore();
  } else {
    // スプライト未ロード時のフォールバック（絵文字）
    ctx.font         = `${spriteSize * 0.7}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#c4b5fd';
    ctx.fillText('🧙', avCx, avCy);
  }

  // 職業ラベル（アバター下）
  ctx.font         = '9px monospace';
  ctx.fillStyle    = '#888';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  const classLabel: Record<string, string> = {
    warrior: '戦士', mage: '魔法使い', thief: '盗賊', priest: '僧侶', archer: '狩人',
  };
  const clsText = classLabel[player.classType] ?? player.classType;
  ctx.fillText(`Lv.${player.lv} ${clsText}`, avCx, PD_Y + AVATAR_H - 4);

  // ── 6 個の装備スロット（アバターの両脇） ────
  SLOTS.forEach((slot, i) => {
    const pos  = SLOT_POS[slot];
    if (!pos) return;
    const eq   = player.equip[slot];
    const sel  = invCursor === i;
    const slx  = pos.col === 'L' ? LEFT_COL_X : RIGHT_COL_X;
    const sly  = PD_Y + pos.row * (SS + SGAP);

    // スロットベース
    const B = 3;
    ctx.fillStyle = sel ? '#7090e8' : '#3a3a3a';
    ctx.fillRect(slx, sly, SS, SS);
    ctx.fillStyle = sel ? '#a0b8ff' : '#555';
    ctx.fillRect(slx, sly, SS, B);
    ctx.fillRect(slx, sly, B, SS);
    ctx.fillStyle = sel ? '#2040a8' : '#1a1a1a';
    ctx.fillRect(slx, sly + SS - B, SS, B);
    ctx.fillRect(slx + SS - B, sly, B, SS);
    ctx.fillStyle = sel ? '#1e2d5a' : '#1d1d1d';
    ctx.fillRect(slx + B, sly + B, SS - B * 2, SS - B * 2);

    // 装備中ならカテゴリ色で内側を塗る
    if (eq) {
      const tint = itemCategoryTint(eq);
      if (tint) paintSlotTint(ctx, slx, sly, SS, tint, sel);
    }

    // アイコン
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    if (eq) {
      ctx.fillStyle = '#ffffff';
      drawItemIcon(ctx, eq, slx + SS / 2, sly + SS / 2 - 2, 32, sprites);
      // 耐久バー（下端）
      if (eq.durability !== undefined && eq.maxDurability !== undefined) {
        const barW    = SS - 8;
        const durRatio = Math.max(0, eq.durability / eq.maxDurability);
        ctx.fillStyle = '#000';
        ctx.fillRect(slx + 4, sly + SS - 7, barW, 3);
        ctx.fillStyle = durRatio > 0.5 ? '#4ade80' : durRatio > 0.2 ? '#fbbf24' : '#ef4444';
        ctx.fillRect(slx + 4, sly + SS - 7, Math.max(0, barW * durRatio), 3);
      }
    } else {
      ctx.font      = `${SS - 22}px monospace`;
      ctx.fillStyle = '#555';
      ctx.fillText(SLOT_ICON[slot] ?? '·', slx + SS / 2, sly + SS / 2);
    }

    // スロット種別ラベル（スロット外 上端 or 下端）
    ctx.font      = '8px monospace';
    ctx.fillStyle = sel ? '#aac0ff' : '#777';
    ctx.textAlign = pos.col === 'L' ? 'left' : 'right';
    const labX = pos.col === 'L' ? slx : slx + SS;
    ctx.textBaseline = 'bottom';
    ctx.fillText(SLOT_LABEL[slot] ?? slot, labX, sly - 1);
  });

  EY = PD_Y + AVATAR_H + 8;

  // ── ステータス ──────────────────────────────
  const STAT_Y = EY;
  const EQUIP_SLOT_W = LEFT_W - 14;
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
        // カテゴリ別の背景色（回復=緑、MP=青、巻物=紫、武器=赤、など）
        const tint = itemCategoryTint(item);
        if (tint) paintSlotTint(ctx, sx, sy, S, tint, sel);

        // 呪い・祝福・未鑑定の枠装飾
        if (item.slot !== 'consumable' && item.identified === false) {
          ctx.save();
          ctx.strokeStyle = 'rgba(168,85,247,0.85)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(sx + 1, sy + 1, S - 2, S - 2);
          ctx.restore();
        } else if (item.cursed) {
          ctx.save();
          ctx.shadowColor = 'rgba(124,58,237,0.9)'; ctx.shadowBlur = 8;
          ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 2;
          ctx.strokeRect(sx + 1, sy + 1, S - 2, S - 2);
          ctx.restore();
        } else if (item.blessed) {
          ctx.save();
          ctx.shadowColor = 'rgba(253,224,71,0.9)'; ctx.shadowBlur = 8;
          ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2;
          ctx.strokeRect(sx + 1, sy + 1, S - 2, S - 2);
          ctx.restore();
        }

        // アイテムアイコン（中央）
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        drawItemIcon(ctx, item, sx + S / 2, sy + S / 2 - 2, 40, sprites);

        // スロット種別バッジ（右下）
        const badge = tint?.label ?? '';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = tint?.accent ?? '#a5b4fc';
        ctx.fillText(badge, sx + S - 4, sy + S - 3);

        // 個数（右上、2以上のときだけ）
        const cnt = item.count ?? 1;
        if (cnt > 1) {
          const label = `×${cnt}`;
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'top';
          // 影付きで読みやすく
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.fillText(label, sx + S - 3, sy + 4);
          ctx.fillStyle = '#fde68a';
          ctx.fillText(label, sx + S - 4, sy + 3);
        }
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
    // 鑑定状況に応じて表示を変える
    const unident = tipTarget.slot !== 'consumable' && tipTarget.identified === false;
    let displayName = tipTarget.name;
    let nameColor: string = '#fffccc';
    if (unident) {
      displayName = `??? ${SLOT_LABEL[tipTarget.slot] ?? ''}`;
      nameColor = '#c4b5fd';
    } else if (tipTarget.cursed) {
      displayName = `呪われた ${tipTarget.name}`;
      nameColor = '#c084fc';
    } else if (tipTarget.blessed) {
      displayName = `祝福された ${tipTarget.name}`;
      nameColor = '#fde047';
    }
    ctx.fillStyle = nameColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${tipTarget.icon} ${displayName}`, GX + 4, TY + 8);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#a5b4fc';
    ctx.fillText(unident ? '（鑑定の巻物で正体を暴ける）' : itemStatText(tipTarget), GX + 4, TY + 24);

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
