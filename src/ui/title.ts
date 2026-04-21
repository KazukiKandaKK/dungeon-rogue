// ─────────────────────────────────────────────
// title.ts  タイトル／セーブスロット／職業選択／ビルド選択／ゲームオーバー描画
//
// main.js から段階的に移行した Canvas 描画関数群。
// 依存する状態をすべてコンテキスト引数として明示する。
// ─────────────────────────────────────────────

import { roundRect }              from './hud.js';
import { CLASSES, CLASS_IDS }     from '../data/classes.js';
import { BUILDS, BUILD_IDS }      from '../core/game-constants.js';
import { DUNGEONS }               from '../world/dungeon_defs.js';
import { getSlotData, hasAnySave } from '../systems/saves.js';
import type { SaveSlotMode }      from '../core/game-context.js';
import { APPEARANCES, APPEARANCE_IDS, TINTS } from '../data/appearances.js';
import { todayKey, getDailyBest } from '../systems/daily.js';
import { PETS, PET_KINDS, type PetKind } from '../entities/pet.js';

// ── TitleContext / drawTitle ──────────────────────────────

export interface TitleContext {
  titleCursor: number;
}

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  c: TitleContext,
): void {
  // Background
  ctx.fillStyle = '#060118';
  ctx.fillRect(0, 0, W, H);

  // Stars
  const now = performance.now() / 1000;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 80; i++) {
    const sx = (i * 137.5) % W;
    const sy = (i * 97.3) % H;
    const blink = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.7 + i));
    ctx.globalAlpha = blink * 0.5;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // Title
  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = 'bold 52px monospace';
  ctx.shadowColor  = '#a855f7';
  ctx.shadowBlur   = 30;
  ctx.fillStyle    = '#e9d5ff';
  ctx.fillText('ダンジョン探索', W / 2, H / 2 - 100);
  ctx.shadowBlur   = 0;
  ctx.restore();

  // Subtitle
  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = '14px monospace';
  ctx.fillStyle    = 'rgba(167,139,250,0.7)';
  ctx.fillText('Roguelike Dungeon Crawler', W / 2, H / 2 - 52);
  ctx.restore();

  // Menu
  const hasAny = hasAnySave();
  const menuItems = ['▶  はじめから'];
  if (hasAny) menuItems.push('▶  続きから');
  menuItems.push('▶  デイリー挑戦');

  const itemH    = 52;
  const menuTop  = H / 2 + 10;

  menuItems.forEach((label, i) => {
    const y   = menuTop + i * itemH;
    const sel = c.titleCursor === i;

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = `${sel ? 'bold ' : ''}22px monospace`;

    if (sel) {
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur  = 18;
      ctx.fillStyle   = '#f0abfc';
    } else {
      ctx.fillStyle = 'rgba(196,181,253,0.6)';
    }
    ctx.fillText(label, W / 2, y);
    ctx.restore();
  });

  // デイリー本日のベスト
  const tk   = todayKey();
  const best = getDailyBest(tk);
  if (best) {
    ctx.save();
    ctx.font         = '11px monospace';
    ctx.fillStyle    = 'rgba(253,224,71,0.65)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    const ds = `${tk.slice(0,4)}-${tk.slice(4,6)}-${tk.slice(6,8)}`;
    ctx.fillText(`☀ ${ds} デイリー Best: ${best.score}（F${best.floor}${best.cleared ? ' 制覇' : ''}）`, W / 2, H - 36);
    ctx.restore();
  }

  // Footer
  ctx.font         = '10px monospace';
  ctx.fillStyle    = 'rgba(100,80,160,0.5)';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('↑ ↓ で選択   Enter で決定', W / 2, H - 16);
}

// ── SaveSlotContext / drawSaveSlot ────────────────────────

export interface SaveSlotContext {
  saveSlotMode:   SaveSlotMode;  // 'load' | 'save'
  saveSlotCursor: number;
}

export function drawSaveSlot(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  c: SaveSlotContext,
): void {
  // Dim overlay
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, W, H);

  const title = c.saveSlotMode === 'save'
    ? '💾 スロットを選んでセーブ'
    : '📂 スロットを選んでロード';
  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = 'bold 20px monospace';
  ctx.fillStyle    = '#f0abfc';
  ctx.fillText(title, W / 2, 80);
  ctx.restore();

  const slotW = 540, slotH = 72, gap = 16;
  const startX = (W - slotW) / 2;
  const startY = 130;

  for (let i = 0; i < 3; i++) {
    const sx  = startX;
    const sy  = startY + i * (slotH + gap);
    const sel = c.saveSlotCursor === i;
    const s   = getSlotData(i as 0 | 1 | 2);

    // Slot background
    ctx.save();
    roundRect(ctx, sx, sy, slotW, slotH, 8);
    ctx.fillStyle   = sel ? 'rgba(88,28,135,0.7)' : 'rgba(20,10,40,0.8)';
    ctx.fill();
    ctx.strokeStyle = sel ? '#a855f7' : 'rgba(100,60,180,0.4)';
    ctx.lineWidth   = sel ? 2 : 1;
    ctx.stroke();
    if (sel) {
      ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 14;
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    ctx.restore();

    // Slot number
    ctx.save();
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.font         = `bold 14px monospace`;
    ctx.fillStyle    = sel ? '#e9d5ff' : 'rgba(167,139,250,0.7)';
    ctx.fillText(`SLOT ${i + 1}`, sx + 16, sy + slotH / 2);
    ctx.restore();

    // Save data summary
    ctx.save();
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    if (s) {
      const dungeon = DUNGEONS.find(d => d.id === s.dungeonId);
      const dateStr = s.savedAt
        ? new Date(s.savedAt).toLocaleString('ja-JP', {
            month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })
        : '';
      const loc = dungeon ? `${dungeon.emoji}${dungeon.name} ${s.floor}層` : '🏠 拠点';
      ctx.font      = 'bold 15px monospace';
      ctx.fillStyle = sel ? '#fff' : '#c4b5fd';
      ctx.fillText(loc, sx + 90, sy + slotH / 2 - 10);
      ctx.font      = '11px monospace';
      ctx.fillStyle = sel ? '#e9d5ff' : 'rgba(200,180,240,0.7)';
      ctx.fillText(`LV ${s.lv}  HP ${s.hp}  💰 ${s.gold}G   ${dateStr}`, sx + 90, sy + slotH / 2 + 12);
    } else {
      ctx.font      = '14px monospace';
      ctx.fillStyle = 'rgba(120,100,160,0.5)';
      ctx.fillText('--- 空 ---', sx + 90, sy + slotH / 2);
    }
    ctx.restore();

    // Empty slot in load mode: show disabled
    if (c.saveSlotMode === 'load' && !s) {
      ctx.save();
      roundRect(ctx, sx, sy, slotW, slotH, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();
      ctx.restore();
    }
  }

  // Footer
  ctx.save();
  ctx.font         = '11px monospace';
  ctx.fillStyle    = 'rgba(148,130,220,0.6)';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  const hint = c.saveSlotMode === 'save'
    ? '↑ ↓ で選択   Enter でセーブ   Esc で戻る'
    : '↑ ↓ で選択   Enter でロード   Esc で戻る';
  ctx.fillText(hint, W / 2, H - 16);
  ctx.restore();
}

// ── ClassSelectContext / drawClassSelect ──────────────────

export interface ClassSelectContext {
  classCursor: number;
}

export function drawClassSelect(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  c: ClassSelectContext,
): void {
  // Dark background
  ctx.fillStyle = '#060118';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.save();
  ctx.font         = 'bold 28px sans-serif';
  ctx.fillStyle    = '#fde68a';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor  = '#fbbf24';
  ctx.shadowBlur   = 20;
  ctx.fillText('WFC Dungeon Crawler', W / 2, 60);
  ctx.shadowBlur   = 0;
  ctx.font         = '14px monospace';
  ctx.fillStyle    = '#a5b4fc';
  ctx.fillText('職業を選んでください', W / 2, 96);
  ctx.restore();

  const cardW = 168, cardH = 250, gap = 16;
  const totalW = CLASS_IDS.length * (cardW + gap) - gap;
  const startX = (W - totalW) / 2;
  const cardY  = (H - cardH) / 2 - 10;

  CLASS_IDS.forEach((id, i) => {
    const cls = CLASSES[id];
    const cx  = startX + i * (cardW + gap);
    const sel = i === c.classCursor;

    ctx.save();
    // Card background
    roundRect(ctx, cx, cardY, cardW, cardH, 10);
    ctx.fillStyle   = sel ? cls.bgColor.replace('0.15', '0.35') : cls.bgColor;
    ctx.fill();
    ctx.strokeStyle = sel ? cls.color : 'rgba(100,80,180,0.4)';
    ctx.lineWidth   = sel ? 2.5 : 1;
    ctx.stroke();

    // Glow on selected
    if (sel) {
      ctx.shadowColor = cls.color;
      ctx.shadowBlur  = 18;
      roundRect(ctx, cx, cardY, cardW, cardH, 10);
      ctx.stroke();
      ctx.shadowBlur  = 0;
    }

    // Icon
    ctx.font         = '36px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cls.icon, cx + cardW / 2, cardY + 44);

    // Name
    ctx.font      = `bold 16px monospace`;
    ctx.fillStyle = sel ? cls.color : '#e2e8f0';
    ctx.fillText(cls.name, cx + cardW / 2, cardY + 84);

    // Stats
    ctx.font         = '10px monospace';
    ctx.fillStyle    = 'rgba(200,200,220,0.9)';
    ctx.textBaseline = 'top';
    const stats = [
      `❤ HP  ${cls.baseHP}  (+${cls.hpPerLv}/Lv)`,
      `✨ MP  ${cls.baseMpMax}  (+${cls.mpPerLv}/Lv)`,
      `⚔ ATK ${cls.baseAtk}  (+${cls.atkPerLv}/Lv)`,
      `🛡 DEF ${cls.baseDef}  (+${cls.defPerLv}/Lv)`,
      `💨 SPD ${cls.baseSpd}   🍀 LUK ${cls.baseLuk}`,
      `魔法: ${(cls.startSpells ?? []).join(' ') || 'なし'}`,
    ];
    stats.forEach((s, j) => {
      ctx.fillText(s, cx + 12, cardY + 100 + j * 16);
    });

    // Description
    ctx.font      = '9px monospace';
    ctx.fillStyle = 'rgba(160,160,200,0.8)';
    cls.desc.forEach((line, j) => {
      ctx.fillText(line, cx + cardW / 2, cardY + 200 + j * 12);
    });

    // Selected indicator
    if (sel) {
      ctx.font         = 'bold 11px monospace';
      ctx.fillStyle    = cls.color;
      ctx.textBaseline = 'middle';
      ctx.fillText('▼ Enter で決定', cx + cardW / 2, cardY + cardH - 16);
    }

    ctx.restore();
  });

  // Navigation hint
  ctx.font         = '10px monospace';
  ctx.fillStyle    = 'rgba(148,130,220,0.6)';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('← → で選択   Enter で決定', W / 2, H - 16);
}

// ── BuildSelectContext / drawBuildSelect ──────────────────

export interface BuildSelectContext {
  playerClass: string;
  buildCursor: number;
  mysteryMode: boolean;
}

export function drawBuildSelect(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  c: BuildSelectContext,
): void {
  ctx.fillStyle = '#060118';
  ctx.fillRect(0, 0, W, H);

  const cls = CLASSES[c.playerClass as keyof typeof CLASSES];

  ctx.save();
  ctx.font        = 'bold 24px sans-serif'; ctx.fillStyle = '#fde68a';
  ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 16;
  ctx.fillText('パラメータ重視を選ぶ', W / 2, 52);
  ctx.shadowBlur  = 0;
  ctx.font        = '13px monospace'; ctx.fillStyle = '#a5b4fc';
  ctx.fillText(`職業: ${cls.icon} ${cls.name}　　← → ↑ ↓ で選択　Backspace で戻る`, W / 2, 84);
  ctx.restore();

  // 6つのカードを 3×2 グリッド表示
  const cardW = 220, cardH = 110, gap = 12;
  const cols   = 3;
  const gridW  = cols * cardW + (cols - 1) * gap;
  const startX = (W - gridW) / 2;
  const startY = 110;

  BUILD_IDS.forEach((id, i) => {
    const build = BUILDS[id];
    const col   = i % cols;
    const row   = Math.floor(i / cols);
    const cx    = startX + col * (cardW + gap);
    const cy    = startY + row * (cardH + gap);
    const sel   = i === c.buildCursor;
    const bb    = build.bonus;

    ctx.save();
    roundRect(ctx, cx, cy, cardW, cardH, 8);
    // シンプルに色計算
    if (sel) {
      ctx.fillStyle = 'rgba(40,20,80,0.95)';
    } else {
      ctx.fillStyle = 'rgba(12,4,28,0.88)';
    }
    ctx.fill();
    ctx.strokeStyle = sel ? build.color : 'rgba(80,60,140,0.5)';
    ctx.lineWidth   = sel ? 2.5 : 1;
    ctx.stroke();
    if (sel) {
      ctx.shadowColor = build.color; ctx.shadowBlur = 14;
      ctx.stroke(); ctx.shadowBlur = 0;
    }

    // タイトル
    ctx.font      = 'bold 14px monospace';
    ctx.fillStyle = sel ? '#fff' : '#c4b5fd';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`${build.icon} ${build.name}`, cx + 10, cy + 10);

    // ボーナス表示
    ctx.font      = '9px monospace'; ctx.fillStyle = '#86efac';
    const bonusParts: string[] = [];
    if (bb.atkPerLv > 0) bonusParts.push(`ATK+${bb.atkPerLv}/Lv`);
    if (bb.defPerLv > 0) bonusParts.push(`DEF+${bb.defPerLv}/Lv`);
    if (bb.hpPerLv  > 0) bonusParts.push(`HP+${bb.hpPerLv}/Lv`);
    if (bb.mpPerLv  > 0) bonusParts.push(`MP+${bb.mpPerLv}/Lv`);
    if (bb.spdEvery > 0) bonusParts.push(`SPD+1/${bb.spdEvery}Lv`);
    if (bb.lukEvery > 0) bonusParts.push(`LUK+1/${bb.lukEvery}Lv`);
    ctx.fillText(bonusParts.slice(0, 3).join('  '), cx + 10, cy + 30);
    if (bonusParts.length > 3)
      ctx.fillText(bonusParts.slice(3).join('  '), cx + 10, cy + 42);

    // 説明
    ctx.font      = '9px monospace'; ctx.fillStyle = 'rgba(180,180,210,0.75)';
    let line = '', lineY = cy + 58;
    for (const ch of build.desc) {
      line += ch;
      if (line.length >= 24) { ctx.fillText(line, cx + 10, lineY); line = ''; lineY += 13; }
    }
    if (line) ctx.fillText(line, cx + 10, lineY);

    if (sel) {
      ctx.font      = 'bold 10px monospace'; ctx.fillStyle = build.color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('▼ Enter で決定', cx + cardW / 2, cy + cardH - 4);
    }
    ctx.restore();
  });

  ctx.font      = '10px monospace'; ctx.fillStyle = 'rgba(148,130,220,0.5)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('← → ↑ ↓ で選択   Enter で決定   Backspace で戻る', W / 2, H - 16);

  // 不思議ダンジョン切り替え
  const mystLabel = c.mysteryMode
    ? '✅ 不思議ダンジョン [M]でOFF'
    : '⬜ 不思議ダンジョン [M]でON';
  ctx.font      = '11px monospace';
  ctx.fillStyle = c.mysteryMode ? '#34d399' : 'rgba(156,163,175,0.6)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(mystLabel, W / 2, H - 32);
}

// ── CharCreateContext / drawCharCreate ────────────────────

export interface CharCreateContext {
  /** 選択中の種族 index */
  speciesCursor: number;
  /** 選択中の色 index */
  tintCursor:    number;
  /** 'species' | 'tint' のどちらを選んでいるか */
  focusGroup:    'species' | 'tint';
  /** デイリー挑戦モード中か */
  dailyMode?:    boolean;
  /** デイリー日付（YYYYMMDD） */
  dailyDateKey?: string;
  /** ペット選択（null=なし） */
  petCursor?:   number;     // 0..PET_KINDS.length（0=なし、1..=PETS）
}

export function drawCharCreate(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  c: CharCreateContext,
): void {
  // 背景（少しだけ雪っぽく）
  ctx.fillStyle = '#060118';
  ctx.fillRect(0, 0, W, H);
  // 舞う雪片
  const now = performance.now() / 1000;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 60; i++) {
    const sx = (i * 173.3 + now * 18) % W;
    const sy = (i * 97.1 + now * 32 + i * 7) % H;
    ctx.beginPath(); ctx.arc(sx, sy, 1.3, 0, Math.PI * 2); ctx.fill();
  }

  // タイトル
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 28px sans-serif';
  ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 20;
  ctx.fillStyle = '#fde68a';
  ctx.fillText('キャラクタをつくる', W / 2, 60);
  ctx.shadowBlur = 0;
  ctx.font = '13px monospace';
  ctx.fillStyle = '#a5b4fc';
  ctx.fillText('← → で種族　　↑ ↓ で色　　Enter で決定', W / 2, 92);
  ctx.restore();

  // デイリー挑戦バッジ
  if (c.dailyMode) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px monospace';
    const dk = c.dailyDateKey ?? '';
    const ds = dk.length === 8 ? `${dk.slice(0,4)}-${dk.slice(4,6)}-${dk.slice(6,8)}` : '';
    const label = `☀ デイリー挑戦 ${ds}（共通シード）`;
    const tw = ctx.measureText(label).width + 24;
    roundRect(ctx, W / 2 - tw / 2, 108, tw, 22, 8);
    ctx.fillStyle = 'rgba(253,224,71,0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(253,224,71,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.fillText(label, W / 2, 119);
    ctx.restore();
  }

  // ── 中央の大きなプレビュー ─────────────
  const previewCX = W / 2;
  const previewCY = H / 2 - 30;
  const previewS  = 260;
  const species   = APPEARANCES[APPEARANCE_IDS[c.speciesCursor]];
  const tint      = TINTS[c.tintCursor].color;
  const phase     = (now * 0.6) % 1;

  // プレビュー台座
  ctx.save();
  ctx.fillStyle = 'rgba(20,10,40,0.8)';
  ctx.strokeStyle = 'rgba(168,85,247,0.45)';
  ctx.lineWidth = 2;
  roundRect(ctx, previewCX - 180, previewCY - 150, 360, 300, 14);
  ctx.fill(); ctx.stroke();
  // 淡い光
  ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // 3方向プレビュー：正面（大）、側面（小左）、背面（小右）
  ctx.save();
  species.draw(ctx, previewCX, previewCY + 10, previewS, 'front', tint, phase, 1);
  ctx.restore();
  ctx.save();
  species.draw(ctx, previewCX - 128, previewCY + 80, 110, 'side', tint, (phase + 0.3) % 1, 1);
  ctx.restore();
  ctx.save();
  species.draw(ctx, previewCX + 128, previewCY + 80, 110, 'back', tint, (phase + 0.6) % 1, 1);
  ctx.restore();

  // 小ラベル
  ctx.save();
  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(168,85,247,0.7)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('SIDE', previewCX - 128, previewCY + 138);
  ctx.fillText('FRONT', previewCX,       previewCY + 138);
  ctx.fillText('BACK', previewCX + 128, previewCY + 138);
  ctx.restore();

  // ── 種族カルーセル（上部） ─────────────
  const speciesY = 170;
  const speciesCardW = 96, speciesCardH = 88, speciesGap = 10;
  const speciesTotalW = APPEARANCE_IDS.length * speciesCardW + (APPEARANCE_IDS.length - 1) * speciesGap;
  const speciesStartX = (W - speciesTotalW) / 2;

  APPEARANCE_IDS.forEach((id, i) => {
    const def = APPEARANCES[id];
    const cx0 = speciesStartX + i * (speciesCardW + speciesGap);
    const sel = i === c.speciesCursor;
    const focused = sel && c.focusGroup === 'species';

    ctx.save();
    roundRect(ctx, cx0, speciesY, speciesCardW, speciesCardH, 8);
    ctx.fillStyle = sel ? 'rgba(88,28,135,0.55)' : 'rgba(12,4,28,0.75)';
    ctx.fill();
    ctx.strokeStyle = focused ? '#f0abfc' : (sel ? 'rgba(168,85,247,0.7)' : 'rgba(80,60,140,0.4)');
    ctx.lineWidth = focused ? 2.2 : 1;
    ctx.stroke();
    if (focused) {
      ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 10;
      ctx.stroke(); ctx.shadowBlur = 0;
    }

    // ミニプレビュー
    ctx.save();
    def.draw(ctx, cx0 + speciesCardW / 2, speciesY + 38, 70, 'front', tint, (phase + i * 0.1) % 1, 1);
    ctx.restore();
    // 名前
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = sel ? '#fff' : '#c4b5fd';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(def.name, cx0 + speciesCardW / 2, speciesY + speciesCardH - 6);
    ctx.restore();
  });

  // ── 色パレット（下部） ─────────────
  const tintY = H - 150;
  const tintCardW = 96, tintCardH = 52, tintGap = 10;
  const tintTotalW = TINTS.length * tintCardW + (TINTS.length - 1) * tintGap;
  const tintStartX = (W - tintTotalW) / 2;

  TINTS.forEach((t, i) => {
    const cx0 = tintStartX + i * (tintCardW + tintGap);
    const sel = i === c.tintCursor;
    const focused = sel && c.focusGroup === 'tint';

    ctx.save();
    roundRect(ctx, cx0, tintY, tintCardW, tintCardH, 8);
    ctx.fillStyle = sel ? 'rgba(88,28,135,0.55)' : 'rgba(12,4,28,0.75)';
    ctx.fill();
    ctx.strokeStyle = focused ? '#f0abfc' : (sel ? 'rgba(168,85,247,0.7)' : 'rgba(80,60,140,0.4)');
    ctx.lineWidth = focused ? 2.2 : 1;
    ctx.stroke();
    if (focused) {
      ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 10;
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    // カラーチップ
    ctx.fillStyle = t.color;
    ctx.shadowColor = t.color; ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(cx0 + tintCardW / 2, tintY + 18, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 名前
    ctx.font = '10px monospace';
    ctx.fillStyle = sel ? '#fff' : '#c4b5fd';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(t.name, cx0 + tintCardW / 2, tintY + tintCardH - 5);
    ctx.restore();
  });

  // 種族説明
  ctx.save();
  ctx.font = '11px monospace'; ctx.fillStyle = 'rgba(200,180,240,0.8)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const lines = species.desc.split('\n');
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, tintY - 56 + i * 14);
  });
  // 種族特性ラベル（黄色で強調）
  if (species.traits?.label) {
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#fde68a';
    ctx.shadowColor = 'rgba(251,191,36,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(`◆ ${species.traits.label}`, W / 2, tintY - 24);
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // ペット選択（フッター上） — Pキーで切り替え
  const petCur = c.petCursor ?? 0;
  const petLabel = petCur === 0
    ? 'なし'
    : (PETS[PET_KINDS[(petCur - 1) % PET_KINDS.length] as PetKind]?.name ?? 'なし');
  ctx.save();
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = petCur > 0 ? '#86efac' : 'rgba(156,163,175,0.7)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(`🐾 ペット: ${petLabel}（[P] で切替）`, W / 2, H - 32);
  ctx.restore();

  // フッター
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(148,130,220,0.55)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('← → ↑ ↓ で選択   P でペット   Enter で決定   Backspace で戻る', W / 2, H - 16);
}

// ── GameOverContext / drawGameOver ────────────────────────

export interface GameOverContext {
  gameOverTimer: number;
}

export function drawGameOver(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  c: GameOverContext,
): void {
  ctx.save();
  ctx.fillStyle    = 'rgba(5,0,20,0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor  = '#f87171';
  ctx.shadowBlur   = 24;
  ctx.font         = 'bold 52px sans-serif';
  ctx.fillStyle    = '#fca5a5';
  ctx.fillText('GAME  OVER', W / 2, H / 2 - 24);
  ctx.shadowBlur   = 0;
  if (c.gameOverTimer <= 0) {
    ctx.font      = '14px monospace';
    ctx.fillStyle = 'rgba(196,181,253,0.85)';
    ctx.fillText('Enter で拠点に戻る', W / 2, H / 2 + 24);
    ctx.font      = '11px monospace';
    ctx.fillStyle = 'rgba(156,163,175,0.6)';
    ctx.fillText('（所持品は失われる。装備は保持される）', W / 2, H / 2 + 46);
  }
  ctx.restore();
}
