// ─────────────────────────────────────────────
// quests.ts  デイリークエスト掲示板の描画
//
// 魂の祠（_drawShrine）と同じような縦リスト型の半透明モーダル。
// 各クエストの進捗バーと、達成済みなら「報酬受領」のハイライトを出す。
// ─────────────────────────────────────────────

import type { QuestDef } from '../systems/quests.js';

function _kindIcon(kind: QuestDef['kind']): string {
  if (kind === 'kill')    return '⚔';
  if (kind === 'collect') return '📦';
  return '🏁';
}

export interface QuestBoardState {
  quests: QuestDef[];
  cursor: number;
}

/**
 * クエスト掲示板モーダルを描画する。
 */
export function drawQuestBoard(
  ctx: CanvasRenderingContext2D,
  W:   number,
  H:   number,
  state: QuestBoardState,
): void {
  ctx.save();

  // 暗幕
  ctx.fillStyle = 'rgba(5,0,20,0.85)';
  ctx.fillRect(0, 0, W, H);

  const panelW = 620, panelH = 440;
  const px = (W - panelW) / 2;
  const py = (H - panelH) / 2;

  ctx.fillStyle   = 'rgba(20,8,40,0.95)';
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth   = 2;
  ctx.shadowColor = '#b45309';
  ctx.shadowBlur  = 16;
  ctx.beginPath();
  ctx.roundRect(px, py, panelW, panelH, 10);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;

  // タイトル
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('📜 デイリー依頼掲示板 📜', W / 2, py + 14);

  ctx.font = '11px monospace';
  ctx.fillStyle = '#c4b5fd';
  ctx.fillText('今日の依頼 3件 — 明日になれば再更新される', W / 2, py + 40);

  // 一覧
  const startY = py + 72;
  const rowH   = 100;
  const quests = state.quests;

  if (quests.length === 0) {
    ctx.fillStyle = '#c4b5fd';
    ctx.font = '13px monospace';
    ctx.fillText('今日の依頼はまだありません', W / 2, startY + 40);
    _footer(ctx, W, py, panelH);
    ctx.restore();
    return;
  }

  quests.forEach((q, i) => {
    const y   = startY + i * rowH;
    const sel = i === state.cursor;
    const complete = q.progress >= q.total;

    // 背景
    ctx.fillStyle = sel
      ? 'rgba(251,191,36,0.18)'
      : (q.claimed ? 'rgba(120,120,120,0.08)' : 'rgba(255,255,255,0.04)');
    ctx.fillRect(px + 16, y, panelW - 32, rowH - 10);
    if (sel) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 16, y, panelW - 32, rowH - 10);
    }

    // タイトル＋アイコン
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = q.claimed ? '#78716c' : (sel ? '#fde68a' : '#fbbf24');
    ctx.fillText(`${_kindIcon(q.kind)} ${q.title}`, px + 28, y + 8);

    // 説明
    ctx.font = '11px monospace';
    ctx.fillStyle = q.claimed ? '#57534e' : '#e9d5ff';
    ctx.fillText(q.desc, px + 28, y + 28);

    // プログレスバー
    const barX = px + 28;
    const barY = y + 52;
    const barW = panelW - 260;
    const barH = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(barX, barY, barW, barH);
    const ratio = Math.min(1, q.progress / q.total);
    ctx.fillStyle = complete ? '#86efac' : '#fbbf24';
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.strokeStyle = 'rgba(251,191,36,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = complete ? '#86efac' : '#fde68a';
    ctx.fillText(`${q.progress} / ${q.total}`, barX, barY + 22);

    // 報酬 / ステータス
    ctx.textAlign = 'right';
    const statusX = px + panelW - 28;
    if (q.claimed) {
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#78716c';
      ctx.fillText('✓ 受領済み', statusX, y + 14);
    } else if (complete) {
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#86efac';
      ctx.fillText('Enter で受け取り', statusX, y + 14);
    } else {
      ctx.font = '11px monospace';
      ctx.fillStyle = '#c4b5fd';
      ctx.fillText('進行中', statusX, y + 14);
    }
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = q.claimed ? '#57534e' : '#fde68a';
    ctx.fillText(`💰 ${q.reward.gold}G`, statusX, y + 38);
    ctx.fillStyle = q.claimed ? '#57534e' : '#c084fc';
    ctx.fillText(`✦ 魂 ${q.reward.souls}`, statusX, y + 54);
  });

  _footer(ctx, W, py, panelH);
  ctx.restore();
}

function _footer(
  ctx: CanvasRenderingContext2D,
  W:   number,
  py:  number,
  panelH: number,
): void {
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(196,181,253,0.65)';
  ctx.textAlign = 'center';
  ctx.fillText('↑↓ 選択   Enter 報酬受領   Esc / B で閉じる', W / 2, py + panelH - 22);
}
