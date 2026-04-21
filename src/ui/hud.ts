// ─────────────────────────────────────────────
// hud.ts  HUD・ミニマップ・フローティングテキスト・ホットバー描画
//
// main.js から段階的に移行した Canvas 描画関数群。
// 依存する状態をすべて HudContext / MinimapContext として明示する。
// ─────────────────────────────────────────────

import type { Player }      from '../entities/player.js';
import type { Enemy }       from '../entities/enemy.js';
import type { DungeonDef }  from '../world/dungeon_defs.js';
import { SPELLS }           from '../data/magic.js';
import { drawItemSvg, drawItemIcon } from './item-renderer.js';
import type { SpriteLoader } from '../core/sprites.js';
import { getActiveTitle } from '../systems/titles.js';
import type { FloatingText, GamePhase } from '../core/game-context.js';
import { TILE }             from '../world/tiles.js';

// ── マップの最小インターフェース ─────────────────────

export interface HudMap {
  cols:          number;
  rows:          number;
  isWalkable(tx: number, ty: number): boolean;
  grid:          number[][];
  stairs:        { tx: number; ty: number } | null;
  revealedTraps: Set<string>;
}

// ── HUD に必要なコンテキスト ──────────────────────

export interface HudContext {
  player:         Player;
  enemies:        Enemy[];
  gamePhase:      GamePhase;
  currentDungeon: DungeonDef | null;
  floorNumber:    number;
  turnCount:      number;
}

export interface MinimapContext {
  map:          HudMap;
  player:       Player;
  enemies:      Enemy[];
  exploredTiles: Set<string>;
  floorItems:   Array<{ tx: number; ty: number }>;
  floorChests:  Array<{ tx: number; ty: number; opened: boolean }>;
  shopPos:      { tx: number; ty: number } | null;
}

export interface HotbarContext {
  player:    Player;
  hotbar:    (string | null)[];
  gamePhase: GamePhase;
  sprites?:  SpriteLoader;
}

// ── Canvas ユーティリティ ────────────────────────

/**
 * 角丸矩形パスを作成する（ctx.fill() / ctx.stroke() で描画）
 */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

/**
 * Minecraft 風スロット枠を描画する（装備画面・インベントリ）
 */
export function drawMCSlot(
  ctx:      CanvasRenderingContext2D,
  x: number, y: number,
  s: number,
  selected: boolean,
  // hover は将来の拡張用（現在未使用）
  _hover = false,
): void {
  const B = 3; // ベベル幅
  ctx.fillStyle = selected ? '#7090e8' : '#3a3a3a';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = selected ? '#a0b8ff' : '#585858';
  ctx.fillRect(x, y, s, B);
  ctx.fillRect(x, y, B, s);
  ctx.fillStyle = selected ? '#2040a8' : '#1a1a1a';
  ctx.fillRect(x, y + s - B, s, B);
  ctx.fillRect(x + s - B, y, B, s);
  ctx.fillStyle = selected ? '#1e2d5a' : '#1d1d1d';
  ctx.fillRect(x + B, y + B, s - B * 2, s - B * 2);
}

// ── HUD（左上ステータス + 右上フロア情報 + 下ヒント） ─

/**
 * メイン HUD を描画する
 */
export function drawHUD(
  ctx: CanvasRenderingContext2D,
  W:   number,
  H:   number,
  c:   HudContext,
): void {
  const { player, enemies, gamePhase, currentDungeon, floorNumber, turnCount } = c;
  ctx.save();

  // ─── 左上: HP + ステータス ─────────────────
  const px = 10, py = 10, pw = 190, ph = 165;
  roundRect(ctx, px, py, pw, ph, 8);
  ctx.fillStyle = 'rgba(15,5,40,0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(250,204,21,0.6)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // 称号バナー（パネル上部に重ねる）
  const activeTitle = getActiveTitle();
  if (activeTitle) {
    const banner = `${activeTitle.icon} ${activeTitle.name}`;
    ctx.font = 'bold 10px monospace';
    const tw = ctx.measureText(banner).width + 12;
    const bx = px + pw / 2 - tw / 2;
    const by = py - 9;
    roundRect(ctx, bx, by, tw, 14, 4);
    ctx.fillStyle = 'rgba(30,8,60,0.95)'; ctx.fill();
    ctx.strokeStyle = activeTitle.color; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = activeTitle.color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(banner, px + pw / 2, by + 8);
  }

  ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#fde68a';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`❤ HP  ${player.hp} / ${player.maxHP}`, px + 8, py + 8);

  const bx = px + 8, by2 = py + 22, bw = pw - 16, bh = 9;
  roundRect(ctx, bx, by2, bw, bh, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
  const ratio = player.hp / player.maxHP;
  const grad  = ctx.createLinearGradient(bx, 0, bx + bw * ratio, 0);
  if (ratio > 0.5)       { grad.addColorStop(0, '#34d399'); grad.addColorStop(1, '#10b981'); }
  else if (ratio > 0.25) { grad.addColorStop(0, '#fbbf24'); grad.addColorStop(1, '#f59e0b'); }
  else                   { grad.addColorStop(0, '#f87171'); grad.addColorStop(1, '#ef4444'); }
  roundRect(ctx, bx, by2, bw * Math.max(0, ratio), bh, 4);
  ctx.fillStyle = grad; ctx.fill();

  ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#818cf8';
  ctx.fillText(`✨ MP  ${player.mp} / ${player.totalMaxMp}`, px + 8, py + 36);
  const mpRatio = player.totalMaxMp > 0 ? player.mp / player.totalMaxMp : 0;
  roundRect(ctx, bx, py + 50, bw, bh, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
  if (mpRatio > 0) {
    const mpGrad = ctx.createLinearGradient(bx, 0, bx + bw * mpRatio, 0);
    mpGrad.addColorStop(0, '#6366f1'); mpGrad.addColorStop(1, '#818cf8');
    roundRect(ctx, bx, py + 50, bw * mpRatio, bh, 4);
    ctx.fillStyle = mpGrad; ctx.fill();
  }

  ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#c4b5fd';
  ctx.fillText(`⚔ ATK ${player.atk}   🛡 DEF ${player.def}`, px + 8, py + 67);
  ctx.fillStyle = '#fcd34d';
  ctx.fillText(`💨 SPD ${player.spd}   🍀 LUK ${player.luk}`, px + 8, py + 81);

  const efIcons: Record<string, string> = { haste: '💨', barrier: '🔵', regen: '🌿' };
  let efX = px + 8;
  for (const ef of player.statusEffects) {
    ctx.font = '11px monospace';
    ctx.fillText(`${efIcons[ef.type] ?? '◉'}${ef.turnsLeft}`, efX, py + 95);
    efX += 28;
  }

  ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#fbbf24';
  ctx.fillText(`LV ${player.lv}`, px + 8, py + 108);
  ctx.font = '9px monospace'; ctx.fillStyle = '#a5b4fc';
  ctx.textAlign = 'right';
  ctx.fillText(`${player.exp} / ${player.expNext}`, px + pw - 8, py + 111);
  ctx.textAlign = 'left';

  const ex2 = px + 8, ey2 = py + 124, ew2 = pw - 16, eh2 = 8;
  roundRect(ctx, ex2, ey2, ew2, eh2, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
  const expRatio = player.expNext > 0 ? player.exp / player.expNext : 0;
  if (expRatio > 0) {
    const expGrad = ctx.createLinearGradient(ex2, 0, ex2 + ew2 * expRatio, 0);
    expGrad.addColorStop(0, '#6366f1'); expGrad.addColorStop(1, '#a78bfa');
    roundRect(ctx, ex2, ey2, ew2 * expRatio, eh2, 4);
    ctx.fillStyle = expGrad; ctx.fill();
  }

  ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(`🎒 ${player.inventory.length}/${player.maxInventory}  [I]装備 [O]魔法`, px + 8, py + 136);
  ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#fbbf24';
  ctx.fillText(`💰 ${player.gold} G`, px + 8, py + 150);
  // 素材（石・木）— 右詰めで同じ行に表示
  ctx.textAlign = 'right';
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`⛏ ${(player.stones ?? 0)}`, px + pw - 50, py + 150);
  ctx.fillStyle = '#d97706';
  ctx.fillText(`🪵 ${(player.wood ?? 0)}`, px + pw - 8, py + 150);
  ctx.textAlign = 'left';

  // ─── 右上: フロア情報 ─────────────────────
  const rpw = 110, rph = 62, rpx = W - rpw - 10, rpy = 10;
  roundRect(ctx, rpx, rpy, rpw, rph, 8);
  ctx.fillStyle = 'rgba(15,5,40,0.85)'; ctx.fill();
  ctx.strokeStyle = 'rgba(167,139,250,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#c4b5fd';
  ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.fillText(
    gamePhase === 'BASE' ? '🏠 拠点'
    : currentDungeon?.bossRush ? `💀 Wave ${floorNumber}`
    : `⚔ Floor ${floorNumber}`,
    rpx + rpw - 8, rpy + 8);
  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`Turn: ${turnCount}`, rpx + rpw - 8, rpy + 30);
  ctx.fillText(`敵: ${enemies.filter(e => e.alive).length} 体`, rpx + rpw - 8, rpy + 46);

  // ─── 下部ヒント ────────────────────────────
  ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(196,181,253,0.4)';
  ctx.textBaseline = 'bottom';
  ctx.fillText(
    'WASD/矢印:移動  Shift+方向:ダッシュ  Space:攻撃  G:⛏掘る  T:🧱石壁  V:🪵木壁  F/.：待機  [I]装備 [O]魔法',
    W / 2, H - 6);

  ctx.restore();
}

// ── ボス HP バー（画面上部中央） ─────────────────

/**
 * ボスが生存していれば HP バーを画面上部に描画する
 */
export function drawBossHPBar(
  ctx: CanvasRenderingContext2D,
  W:   number,
  enemies: Enemy[],
): void {
  const boss = enemies.find(e => e.alive && e.isBoss);
  if (!boss) return;

  const bw = 320, bh = 18;
  const bx = (W - bw) / 2, by = 12;

  ctx.save();

  roundRect(ctx, bx - 12, by - 8, bw + 24, bh + 30, 8);
  ctx.fillStyle = 'rgba(10,0,30,0.92)'; ctx.fill();
  ctx.strokeStyle = 'rgba(160,40,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#f87171';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 8;
  ctx.fillText(`💀 BOSS: ${boss.name}`, W / 2, by - 4);
  ctx.shadowBlur = 0;

  roundRect(ctx, bx, by + 13, bw, bh, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();

  const ratio      = Math.max(0, boss.hp / boss.maxHP);
  const ghostRatio = Math.max(ratio, Math.min(1, boss.displayHp / boss.maxHP));

  // 残像（白っぽく、本体 HP に遅れて追いつく）
  if (ghostRatio > ratio + 0.001) {
    roundRect(ctx, bx + bw * ratio, by + 13, bw * (ghostRatio - ratio), bh, 5);
    ctx.fillStyle = 'rgba(255,240,240,0.55)'; ctx.fill();
  }

  if (ratio > 0) {
    const grad = ctx.createLinearGradient(bx, 0, bx + bw * ratio, 0);
    grad.addColorStop(0, '#7c1fa0'); grad.addColorStop(0.5, '#cc2266'); grad.addColorStop(1, '#ff4444');
    roundRect(ctx, bx, by + 13, bw * ratio, bh, 5);
    ctx.fillStyle = grad; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, bx, by + 13, bw * ratio, bh / 2, 5);
    ctx.fill();
  }

  // ── 段階区切り線（25/50/75%） ────────────────
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
  for (const q of [0.25, 0.5, 0.75]) {
    ctx.beginPath();
    ctx.moveTo(bx + bw * q, by + 13);
    ctx.lineTo(bx + bw * q, by + 13 + bh);
    ctx.stroke();
  }

  ctx.font = 'bold 10px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${boss.hp} / ${boss.maxHP}`, W / 2, by + 13 + bh / 2);

  ctx.restore();
}

// ── ミニマップ ────────────────────────────────────

/**
 * 右下にミニマップを描画する
 */
export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  W:   number,
  H:   number,
  c:   MinimapContext,
): void {
  const { map, player, enemies, exploredTiles, floorItems, floorChests, shopPos } = c;
  const TS  = 2;
  const MW  = map.cols * TS, MH = map.rows * TS, PAD = 6;
  const mx  = W - MW - PAD - 2, my = H - MH - PAD - 2;

  ctx.save();
  ctx.fillStyle = 'rgba(8,2,25,0.82)'; ctx.strokeStyle = 'rgba(91,33,182,0.7)'; ctx.lineWidth = 1;
  roundRect(ctx, mx - 3, my - 3, MW + 8, MH + 8, 4);
  ctx.fill(); ctx.stroke();

  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx2 = 0; tx2 < map.cols; tx2++) {
      if (!exploredTiles.has(`${tx2},${ty}`)) continue;
      const px2 = mx + tx2 * TS, py2 = my + ty * TS;
      const mmTile = map.grid[ty][tx2];
      if      (mmTile === TILE.PILLAR)           ctx.fillStyle = '#888';
      else if (mmTile === TILE.WATER)            ctx.fillStyle = '#3b82f6';
      else if (mmTile === TILE.ICE)              ctx.fillStyle = '#a5e8ff';
      else if (mmTile === TILE.MAGMA)            ctx.fillStyle = '#dc2626';
      else if (mmTile === TILE.TRAP)             ctx.fillStyle = map.revealedTraps.has(`${tx2},${ty}`) ? '#ef4444' : '#c4a87a';
      else if (map.isWalkable(tx2, ty))         ctx.fillStyle = '#c4a87a';
      else                                       ctx.fillStyle = '#3b1f82';
      ctx.fillRect(px2, py2, TS, TS);
    }
  }

  if (map.stairs && exploredTiles.has(`${map.stairs.tx},${map.stairs.ty}`)) {
    ctx.fillStyle = '#fde047';
    ctx.fillRect(mx + map.stairs.tx * TS - 1, my + map.stairs.ty * TS - 1, TS + 2, TS + 2);
  }

  for (const fi of floorItems) {
    if (!exploredTiles.has(`${fi.tx},${fi.ty}`)) continue;
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(mx + fi.tx * TS, my + fi.ty * TS, TS, TS);
  }

  for (const ch of floorChests) {
    if (ch.opened || !exploredTiles.has(`${ch.tx},${ch.ty}`)) continue;
    ctx.fillStyle = '#ffd700'; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 3;
    ctx.fillRect(mx + ch.tx * TS - 1, my + ch.ty * TS - 1, TS + 2, TS + 2);
    ctx.shadowBlur = 0;
  }

  for (const e of enemies) {
    if (!e.alive || !exploredTiles.has(`${e.tx},${e.ty}`)) continue;
    ctx.fillStyle = '#f87171';
    ctx.fillRect(mx + e.tx * TS, my + e.ty * TS, TS, TS);
  }

  if (shopPos && exploredTiles.has(`${shopPos.tx},${shopPos.ty}`)) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(mx + shopPos.tx * TS - 1, my + shopPos.ty * TS - 1, TS + 2, TS + 2);
  }

  if (player?.alive) {
    ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#c4b5fd'; ctx.shadowBlur = 4;
    ctx.fillRect(mx + player.tx * TS - 1, my + player.ty * TS - 1, TS + 2, TS + 2);
    ctx.shadowBlur = 0;
  }

  ctx.font = 'bold 8px monospace'; ctx.fillStyle = 'rgba(196,181,253,0.7)';
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText('MAP', mx - 2, my - 4);

  ctx.restore();
}

// ── フローティングテキスト ──────────────────────────

/**
 * 画面に浮かぶダメージ数値・レベルアップ通知などを描画する
 */
export function drawFloatingTexts(
  ctx:   CanvasRenderingContext2D,
  texts: FloatingText[],
): void {
  if (texts.length === 0) return;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // shadowBlur は重いため使わず、影は 1 ドロー追加で表現する
  for (const ft of texts) {
    ctx.globalAlpha = ft.alpha;
    if (ft.big) {
      ctx.font = 'bold 22px monospace';
      // 黒影
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(ft.text, ft.x + 2, ft.y + 2);
      // 本体
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    } else {
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(ft.text, ft.x + 1, ft.y + 2);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── MMO スキルホットバー ──────────────────────────

/**
 * 画面下部中央にスキルホットバーと所持品ストリップを描画する
 */
export function drawHotbar(
  ctx: CanvasRenderingContext2D,
  W:   number,
  H:   number,
  c:   HotbarContext,
): void {
  const { player, hotbar, gamePhase, sprites } = c;
  if (gamePhase === 'BASE') return;
  ctx.save();

  const SLOT_W = 60, SLOT_H = 60, GAP = 8;
  const totalW = 6 * SLOT_W + 5 * GAP;
  const startX = (W - totalW) / 2;
  const startY = H - 88;
  const PAD = 10;

  roundRect(ctx, startX - PAD, startY - PAD, totalW + PAD * 2, SLOT_H + PAD * 2 + 20, 10);
  ctx.fillStyle = 'rgba(6,2,20,0.85)'; ctx.fill();
  ctx.strokeStyle = 'rgba(99,102,241,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();

  for (let i = 0; i < 6; i++) {
    const sx = startX + i * (SLOT_W + GAP), sy = startY;
    const spellId = hotbar[i];
    const spell   = spellId ? SPELLS[spellId] : null;
    const hasMP   = spell ? player.mp >= spell.mp : false;

    roundRect(ctx, sx, sy, SLOT_W, SLOT_H, 7);
    ctx.fillStyle = spell
      ? (hasMP ? 'rgba(30,22,75,0.95)' : 'rgba(55,10,10,0.95)')
      : 'rgba(12,8,28,0.7)';
    ctx.fill();

    ctx.strokeStyle = spell
      ? (hasMP ? 'rgba(129,140,248,0.85)' : 'rgba(248,113,113,0.6)')
      : 'rgba(60,50,100,0.45)';
    ctx.lineWidth = 1.5; ctx.stroke();

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = spell ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`${i + 1}`, sx + 4, sy + 3);

    if (spell) {
      ctx.font = '24px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = hasMP ? 1 : 0.35;
      ctx.fillText(spell.icon, sx + SLOT_W / 2, sy + SLOT_H / 2 - 2);
      ctx.globalAlpha = 1;

      ctx.font = '9px monospace';
      ctx.fillStyle = hasMP ? '#818cf8' : '#f87171';
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`${spell.mp}MP`, sx + SLOT_W - 3, sy + SLOT_H - 2);

      const name = spell.name.length > 5 ? spell.name.slice(0, 4) + '…' : spell.name;
      ctx.font = '9px monospace';
      ctx.fillStyle = hasMP ? 'rgba(196,181,253,0.9)' : 'rgba(248,113,113,0.6)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(name, sx + SLOT_W / 2, sy + SLOT_H + 4);
    } else {
      ctx.font = '18px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('＋', sx + SLOT_W / 2, sy + SLOT_H / 2);
    }
  }

  ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(148,163,184,0.45)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(
    '[O]魔法メニュー → [1-6]でスロットセット  |  [1-6]でスキル発動',
    W / 2, startY + SLOT_H + PAD + 4);

  // ── インベントリ常時表示ストリップ（ホットバー右横・最大6個）──
  const INV_S = 44, INV_G = 3;
  const showCount = Math.min(6, player.inventory.length);
  if (showCount > 0) {
    const invTotalW = showCount * INV_S + (showCount - 1) * INV_G;
    const invX = startX + totalW + PAD + 12;
    const invY = startY + (SLOT_H - INV_S) / 2;

    roundRect(ctx, invX - 6, invY - 6, invTotalW + 12, INV_S + 12, 8);
    ctx.fillStyle = 'rgba(6,2,20,0.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(99,102,241,0.4)'; ctx.lineWidth = 1; ctx.stroke();

    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(148,163,184,0.5)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`所持品 ${player.inventory.length}/${player.maxInventory}`, invX + invTotalW / 2, invY - 6);

    for (let i = 0; i < showCount; i++) {
      const sx = invX + i * (INV_S + INV_G), sy = invY;
      const item = player.inventory[i];
      drawMCSlot(ctx, sx, sy, INV_S, false);
      if (item) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        drawItemIcon(ctx, item, sx + INV_S / 2, sy + INV_S / 2 - 1, INV_S - 6, sprites);
        const badge = ({ weapon: '武', armor: '鎧', accessory: '飾', consumable: '薬' } as Record<string, string>)[item.slot] ?? '';
        ctx.font = 'bold 7px monospace';
        ctx.fillStyle = item.slot === 'consumable' ? '#86efac' : '#a5b4fc';
        ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText(badge, sx + INV_S - 2, sy + INV_S - 2);
        // スタック数
        const cnt = item.count ?? 1;
        if (cnt > 1) {
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.textAlign = 'right'; ctx.textBaseline = 'top';
          ctx.fillText(`×${cnt}`, sx + INV_S - 1, sy + 2);
          ctx.fillStyle = '#fde68a';
          ctx.fillText(`×${cnt}`, sx + INV_S - 2, sy + 1);
        }
      }
    }
  }

  ctx.restore();
}
