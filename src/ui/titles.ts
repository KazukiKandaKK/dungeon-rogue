// ─────────────────────────────────────────────
// titles.ts (UI)  称号選択モーダル
//
// 解放済み称号と未解放（条件＋現在値）の一覧を表示して、装備を選ぶ。
// ─────────────────────────────────────────────

import { TITLES, getStats, getActiveTitle } from '../systems/titles.js';
import type { TitleDef } from '../systems/titles.js';

export interface TitleMenuState {
  cursor: number;
  /** 表示対象の一覧（外から渡す、通常は TITLES 全件） */
  items:  readonly TitleDef[];
}

function _progressText(t: TitleDef, stats: ReturnType<typeof getStats>): string {
  const v = (stats as unknown as Record<string, number>)[t.cond.key] ?? 0;
  return `${v} / ${t.cond.threshold}`;
}

export function drawTitleMenu(
  ctx: CanvasRenderingContext2D,
  W:   number,
  H:   number,
  state: TitleMenuState,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(5,0,20,0.85)';
  ctx.fillRect(0, 0, W, H);

  const panelW = 640, panelH = 480;
  const px = (W - panelW) / 2;
  const py = (H - panelH) / 2;

  ctx.fillStyle   = 'rgba(20,8,40,0.95)';
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth   = 2;
  ctx.shadowColor = '#7c3aed';
  ctx.shadowBlur  = 14;
  ctx.beginPath();
  ctx.roundRect(px, py, panelW, panelH, 10);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('🎖 称号を選択', W / 2, py + 14);

  const active = getActiveTitle();
  ctx.font = '11px monospace';
  ctx.fillStyle = '#c4b5fd';
  ctx.fillText(
    active ? `装備中: ${active.icon} ${active.name}` : '装備中: なし',
    W / 2, py + 40,
  );

  const stats = getStats();
  const startY = py + 64;
  const rowH   = 34;

  state.items.forEach((t, i) => {
    const y = startY + i * rowH;
    if (y + rowH > py + panelH - 36) return;
    const sel = i === state.cursor;
    const v = (stats as unknown as Record<string, number>)[t.cond.key] ?? 0;
    const unlocked = v >= t.cond.threshold;
    const equipped = active?.id === t.id;

    ctx.fillStyle = sel
      ? 'rgba(167,139,250,0.22)'
      : (equipped ? 'rgba(251,191,36,0.10)' : 'rgba(255,255,255,0.03)');
    ctx.fillRect(px + 16, y, panelW - 32, rowH - 4);
    if (sel) {
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 16, y, panelW - 32, rowH - 4);
    }

    // アイコン+名前
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = unlocked ? t.color : '#57534e';
    ctx.fillText(`${t.icon} ${t.name}`, px + 28, y + 6);
    // 条件
    ctx.font = '10px monospace';
    ctx.fillStyle = unlocked ? '#c4b5fd' : '#78716c';
    ctx.fillText(t.desc, px + 180, y + 8);
    // 進捗
    ctx.textAlign = 'right';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = unlocked ? '#86efac' : '#fca5a5';
    ctx.fillText(_progressText(t, stats), px + panelW - 90, y + 8);
    // ステータス
    ctx.fillStyle = equipped ? '#fde68a' : (unlocked ? '#86efac' : '#78716c');
    const label = equipped ? '装備中' : (unlocked ? 'Enter装備' : '未解放');
    ctx.fillText(label, px + panelW - 28, y + 8);
  });

  // 装備解除ヒント
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(196,181,253,0.65)';
  ctx.textAlign = 'center';
  ctx.fillText('↑↓ 選択   Enter 装備   X で解除   Esc / B で閉じる', W / 2, py + panelH - 22);

  ctx.restore();
}
