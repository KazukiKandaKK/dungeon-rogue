// ─────────────────────────────────────────────
// craft.ts  クラフト屋（武器合成）UI
//
// 手持ちの武器を 2 本選んで合成した結果のプレビューを表示する。
// 左右 2 パネルで武器を選び、中央に結果ステータスを表示する。
// ─────────────────────────────────────────────

import type { Player }       from '../entities/player.js';
import type { ItemDef }      from '../data/equipment.js';
import { itemStatText }      from '../data/equipment.js';
import { roundRect }         from './hud.js';
import { canCraft, craftCost, combineWeapons } from '../systems/craft.js';

export type CraftSide = 'A' | 'B';

export interface CraftMenuContext {
  player:      Player;
  /** 左右の選択カーソル（weapon リスト内のインデックス） */
  craftCurA:   number;
  craftCurB:   number;
  /** 現在アクティブな側 */
  craftSide:   CraftSide;
}

/** プレイヤーの所持品から武器のみ抽出（index情報付き） */
export function listWeapons(player: Player): { item: ItemDef; invIndex: number }[] {
  const out: { item: ItemDef; invIndex: number }[] = [];
  player.inventory.forEach((it, i) => {
    if (it.slot === 'weapon') out.push({ item: it, invIndex: i });
  });
  return out;
}

function drawWeaponColumn(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  title: string,
  weapons: { item: ItemDef; invIndex: number }[],
  cursor: number,
  active: boolean,
  otherInvIndex: number, // 反対側で選択中の invIndex（重複選択を灰色に）
): void {
  // 背景
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = 'rgba(18,10,32,0.92)'; ctx.fill();
  ctx.strokeStyle = active ? 'rgba(251,191,36,0.85)' : 'rgba(120,80,160,0.45)';
  ctx.lineWidth   = active ? 2.2 : 1.2;
  ctx.stroke();

  // 見出し
  ctx.font = 'bold 12px "Noto Sans JP", monospace';
  ctx.fillStyle = active ? '#fde68a' : '#c4b5fd';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(title, x + w / 2, y + 8);

  // 武器行
  const rowH = 44;
  const startY = y + 30;

  if (weapons.length === 0) {
    ctx.font = '11px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('(武器なし)', x + w / 2, startY + 14);
    return;
  }

  const visibleRows = Math.floor((h - 40) / rowH);
  const half = Math.floor(visibleRows / 2);
  const scroll = Math.max(0, Math.min(weapons.length - visibleRows, cursor - half));

  for (let vi = 0; vi < Math.min(visibleRows, weapons.length - scroll); vi++) {
    const i = scroll + vi;
    const { item, invIndex } = weapons[i];
    const rowY = startY + vi * rowH;
    const isSel = i === cursor;
    const isOther = invIndex === otherInvIndex;

    roundRect(ctx, x + 8, rowY, w - 16, rowH - 6, 5);
    if (isSel && active) {
      ctx.fillStyle = 'rgba(251,191,36,0.18)'; ctx.fill();
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5; ctx.stroke();
    } else if (isSel) {
      ctx.fillStyle = 'rgba(168,85,247,0.18)'; ctx.fill();
      ctx.strokeStyle = 'rgba(168,85,247,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(30,18,52,0.55)'; ctx.fill();
    }

    // アイコン
    ctx.font = '20px monospace';
    ctx.fillStyle = isOther ? '#6b7280' : (item.color ?? '#e2e8f0');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(item.icon ?? '⚔', x + 22, rowY + (rowH - 6) / 2);

    // 名前
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px "Noto Sans JP", monospace';
    ctx.fillStyle = isOther ? '#6b7280' : '#e2e8f0';
    const nameTxt = isOther ? `${item.name}（選択中）` : item.name;
    ctx.fillText(nameTxt, x + 42, rowY + 10);

    // ステータス
    ctx.font = '9px monospace';
    ctx.fillStyle = isOther ? '#4b5563' : '#94a3b8';
    ctx.fillText(itemStatText(item), x + 42, rowY + 24);

    // Tier
    ctx.textAlign = 'right';
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = isOther ? '#4b5563' : '#fbbf24';
    ctx.fillText(`T${item.tier}`, x + w - 14, rowY + 12);
  }

  // スクロールインジケータ
  if (weapons.length > visibleRows) {
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(200,200,200,0.55)';
    ctx.textAlign = 'right';
    ctx.fillText(`${cursor + 1}/${weapons.length}`, x + w - 10, y + h - 12);
  }
}

function drawPreviewPanel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  a: ItemDef | null, b: ItemDef | null,
  player: Player,
): void {
  roundRect(ctx, x, y, w, h, 10);
  // 中央背景（グラデ）
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(127,29,29,0.85)');
  g.addColorStop(1, 'rgba(60,10,10,0.95)');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke();

  ctx.font = 'bold 13px "Noto Sans JP", monospace';
  ctx.fillStyle = '#fde68a';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('⚒ 合成結果', x + w / 2, y + 10);

  if (!a || !b || !canCraft(a, b)) {
    ctx.font = '11px "Noto Sans JP", monospace';
    ctx.fillStyle = '#fca5a5';
    ctx.fillText('武器を2本', x + w / 2, y + h / 2 - 14);
    ctx.fillText('選んでね', x + w / 2, y + h / 2 + 2);
    return;
  }

  const result = combineWeapons(a, b);
  const cost   = craftCost(a, b);
  const canPay = player.gold >= cost;

  // 結果アイコン
  ctx.font = '44px monospace';
  ctx.fillStyle = result.color ?? '#fbbf24';
  ctx.shadowColor = result.color ?? '#fbbf24';
  ctx.shadowBlur = 18;
  ctx.textBaseline = 'middle';
  ctx.fillText(result.icon ?? '⚔', x + w / 2, y + 62);
  ctx.shadowBlur = 0;

  // 結果名
  ctx.font = 'bold 12px "Noto Sans JP", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.fillText(result.name, x + w / 2, y + 94);

  // ステータス（1 行ずつ）
  ctx.font = '10px monospace';
  ctx.fillStyle = '#fde68a';
  const statTxt = itemStatText(result);
  // 長い場合は折り返し（おおよそ22文字で改行）
  const lines: string[] = [];
  const parts = statTxt.split(' ');
  let line = '';
  for (const p of parts) {
    if ((line + ' ' + p).length > 24) { lines.push(line); line = p; }
    else line = line ? line + ' ' + p : p;
  }
  if (line) lines.push(line);
  let ty = y + 116;
  for (const l of lines) {
    ctx.fillText(l, x + w / 2, ty);
    ty += 14;
  }

  // 矢印（A + B → 結果）
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = 'rgba(253,230,138,0.7)';
  const arrY = y + h - 82;
  ctx.fillText(`${a.icon ?? '⚔'} + ${b.icon ?? '⚔'}`, x + w / 2, arrY);
  ctx.fillText('⬇', x + w / 2, arrY + 14);

  // コスト
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = canPay ? '#fbbf24' : '#f87171';
  ctx.fillText(`費用 ${cost}G`, x + w / 2, y + h - 46);
  ctx.font = '9px monospace';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`(所持 ${player.gold}G)`, x + w / 2, y + h - 30);

  // 合成ボタン
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = canPay ? '#4ade80' : '#6b7280';
  ctx.fillText(canPay ? '[Enter] 合成する' : '[資金不足]', x + w / 2, y + h - 14);
}

export function drawCraftMenu(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  c: CraftMenuContext,
): void {
  ctx.save();

  // 暗幕
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);

  const pw = 780, ph = 500;
  const px = ((W - pw) / 2) | 0;
  const py = ((H - ph) / 2) | 0;

  // 外枠
  roundRect(ctx, px, py, pw, ph, 14);
  ctx.fillStyle = 'rgba(8,3,18,0.97)'; ctx.fill();
  ctx.strokeStyle = 'rgba(245,158,11,0.85)'; ctx.lineWidth = 2.5; ctx.stroke();

  // タイトル
  ctx.font = 'bold 16px "Noto Sans JP", monospace';
  ctx.fillStyle = '#fde68a';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('⚒ 鍛冶屋 — 武器合成', px + pw / 2, py + 14);

  ctx.font = '10px "Noto Sans JP", monospace';
  ctx.fillStyle = 'rgba(253,230,138,0.65)';
  ctx.fillText('武器を2本選んで、より強い1本に鍛えなおそう。', px + pw / 2, py + 36);

  // 区切り
  ctx.strokeStyle = 'rgba(245,158,11,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + 14, py + 54); ctx.lineTo(px + pw - 14, py + 54); ctx.stroke();

  const weapons = listWeapons(c.player);
  const colW = 240, colH = 390;
  const colA_X = px + 16;
  const colB_X = px + pw - 16 - colW;
  const colY   = py + 62;
  const mid    = px + pw / 2 - 120;

  const curA = weapons[c.craftCurA];
  const curB = weapons[c.craftCurB];

  drawWeaponColumn(ctx, colA_X, colY, colW, colH, '🅰 合成元 A',
    weapons, c.craftCurA, c.craftSide === 'A',
    curB ? curB.invIndex : -1);
  drawWeaponColumn(ctx, colB_X, colY, colW, colH, '🅱 合成元 B',
    weapons, c.craftCurB, c.craftSide === 'B',
    curA ? curA.invIndex : -1);

  // 中央プレビュー
  const a = curA ? curA.item : null;
  const b = curB ? curB.item : null;
  // 同じアイテム実体を選んでいる場合はプレビューを無効化
  const safeB = (curA && curB && curA.invIndex === curB.invIndex) ? null : b;
  drawPreviewPanel(ctx, mid, colY, 240, colH, a, safeB, c.player);

  // 操作説明
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(253,230,138,0.65)';
  ctx.textAlign = 'center';
  ctx.fillText('[←→/Tab] 側切替  [↑↓] 選択  [Enter] 合成  [Esc/B] 閉じる',
    px + pw / 2, py + ph - 14);

  ctx.restore();
}
