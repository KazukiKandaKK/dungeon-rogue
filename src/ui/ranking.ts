// ─────────────────────────────────────────────
// ranking.ts (UI)  冒険者ランキング・モーダル
//
// 縦スクロール式の 50 位表。自分は黄色ハイライト。↑↓ でカーソル移動、
// スクロールで見切れないように追従する。
// ─────────────────────────────────────────────

import type { RankEntry } from '../systems/ranking.js';

export interface RankingMenuState {
  list:   readonly RankEntry[];
  cursor: number;   // 現在選択中の順位 index（0..list.length-1）
}

export function drawRanking(
  ctx: CanvasRenderingContext2D,
  W:   number,
  H:   number,
  state: RankingMenuState,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(5,0,20,0.85)';
  ctx.fillRect(0, 0, W, H);

  const panelW = 680, panelH = 540;
  const px = (W - panelW) / 2;
  const py = (H - panelH) / 2;

  ctx.fillStyle   = 'rgba(20,8,40,0.95)';
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth   = 2;
  ctx.shadowColor = '#b45309';
  ctx.shadowBlur  = 18;
  ctx.beginPath();
  ctx.roundRect(px, py, panelW, panelH, 10);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;

  // タイトル
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('🏆 冒険者ギルド・デイリーランキング 🏆', W / 2, py + 14);

  ctx.font = '11px monospace';
  ctx.fillStyle = '#c4b5fd';
  const me = state.list.find(e => e.me);
  ctx.fillText(
    me ? `あなたの順位: ${me.rank}位 / ${state.list.length}人  スコア ${me.score}`
       : `未挑戦（デイリーモードで走ると登録される）`,
    W / 2, py + 40,
  );

  // 表ヘッダー
  const startY = py + 72;
  const rowH   = 28;
  const visibleRows = Math.floor((panelH - 92 - 28) / rowH);

  ctx.textAlign = 'left';
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = 'rgba(196,181,253,0.8)';
  ctx.fillText('#',        px + 24,  startY - 14);
  ctx.fillText('冒険者',   px + 60,  startY - 14);
  ctx.fillText('称号',     px + 290, startY - 14);
  ctx.textAlign = 'right';
  ctx.fillText('階層',     px + panelW - 180, startY - 14);
  ctx.fillText('スコア',   px + panelW - 80,  startY - 14);
  ctx.fillText('Clear',    px + panelW - 28,  startY - 14);

  // カーソル位置に応じたスクロール
  const maxScroll = Math.max(0, state.list.length - visibleRows);
  const scroll = Math.max(0, Math.min(maxScroll, state.cursor - Math.floor(visibleRows / 2)));

  for (let row = 0; row < visibleRows; row++) {
    const i = scroll + row;
    if (i >= state.list.length) break;
    const e = state.list[i];
    const y = startY + row * rowH;

    const bgRow = e.me
      ? 'rgba(251,191,36,0.22)'
      : (state.cursor === i ? 'rgba(167,139,250,0.16)' : (i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)'));
    ctx.fillStyle = bgRow;
    ctx.fillRect(px + 16, y, panelW - 32, rowH - 2);
    if (e.me) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 16, y, panelW - 32, rowH - 2);
    }

    // 順位
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px monospace';
    const rankColor = e.rank === 1 ? '#fde047'
                    : e.rank === 2 ? '#e5e7eb'
                    : e.rank === 3 ? '#f97316'
                    : (e.me ? '#fde68a' : '#c4b5fd');
    ctx.fillStyle = rankColor;
    const rankStr = e.rank <= 3 ? ['🥇','🥈','🥉'][e.rank - 1] : String(e.rank);
    ctx.fillText(rankStr, px + 24, y + rowH / 2);

    // 名前（Lv）
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = e.me ? '#fde68a' : e.tint;
    ctx.fillText(`Lv${e.lv || '?'} ${e.name}`, px + 60, y + rowH / 2);

    // 称号
    if (e.title) {
      ctx.font = '10px monospace';
      ctx.fillStyle = e.title.color;
      ctx.fillText(`${e.title.icon} ${e.title.name}`, px + 290, y + rowH / 2);
    } else {
      ctx.font = '10px monospace';
      ctx.fillStyle = '#57534e';
      ctx.fillText('—', px + 290, y + rowH / 2);
    }

    // 階層 / スコア / クリア
    ctx.textAlign = 'right';
    ctx.font = '11px monospace';
    ctx.fillStyle = '#a5b4fc';
    ctx.fillText(`${e.floor}F`, px + panelW - 180, y + rowH / 2);
    ctx.fillStyle = e.me ? '#fde68a' : '#fde68a';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(String(e.score), px + panelW - 80, y + rowH / 2);
    ctx.font = '11px monospace';
    ctx.fillStyle = e.cleared ? '#86efac' : '#57534e';
    ctx.fillText(e.cleared ? '✓' : '—', px + panelW - 28, y + rowH / 2);
  }

  // スクロールバー（視覚だけ）
  if (state.list.length > visibleRows) {
    const barX = px + panelW - 10;
    const barY = startY;
    const barH = visibleRows * rowH;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(barX, barY, 3, barH);
    const thumbH = Math.max(20, barH * (visibleRows / state.list.length));
    const thumbY = barY + (barH - thumbH) * (scroll / Math.max(1, maxScroll));
    ctx.fillStyle = '#a78bfa';
    ctx.fillRect(barX, thumbY, 3, thumbH);
  }

  // フッター
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(196,181,253,0.65)';
  ctx.textAlign = 'center';
  ctx.fillText('↑↓ 選択   Esc / B で閉じる', W / 2, py + panelH - 22);

  ctx.restore();
}
