// ─────────────────────────────────────────────
// ui/chat-ticker.ts  チャットティッカーの描画
//
// 画面左下に半透明帯で 3〜5 行を縦に並べる。
// 新しいメッセージほど下に出る（MMOチャット風）。
// 古いほど薄くフェードする。
// ─────────────────────────────────────────────

import { roundRect } from './hud.js';
import { getChatMessages, isChatEnabled, type ChatMessage } from '../systems/chat-ticker.js';

const MAX_VISIBLE  = 5;
const LINE_H       = 18;
const PAD_X        = 10;
const PAD_Y        = 6;
const LIFE_FADE_MS = 12000; // この時刻を超えたものから徐々にフェード

/**
 * 拠点では大きめ・ダンジョンでは小さめ＆薄め、というスケールも対応。
 * @param compact  true ならダンジョン用に控えめ
 */
export function drawChatTicker(
  ctx:     CanvasRenderingContext2D,
  W:       number,
  H:       number,
  compact: boolean = false,
): void {
  if (!isChatEnabled()) return;
  const all = getChatMessages();
  if (all.length === 0) return;

  const visible = all.slice(-MAX_VISIBLE);
  const now     = performance.now();
  const scale   = compact ? 0.85 : 1;
  const lineH   = LINE_H * scale;
  const fontPx  = 12 * scale;
  const panelW  = Math.min(420 * scale, W * 0.4);
  const panelH  = visible.length * lineH + PAD_Y * 2;
  const panelX  = 18;
  const panelY  = H - 78 - panelH; // 下から少し浮かせる

  ctx.save();
  // パネル背景
  ctx.globalAlpha = compact ? 0.55 : 0.78;
  ctx.fillStyle   = '#0a0418';
  roundRect(ctx, panelX, panelY, panelW, panelH, 8);
  ctx.fill();
  ctx.globalAlpha = compact ? 0.35 : 0.55;
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth   = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ヘッダ ──「ﾜｰﾙﾄﾞ #1」
  ctx.font         = `bold ${10 * scale}px monospace`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = 'rgba(196,181,253,0.6)';
  ctx.fillText('🌐 ﾜｰﾙﾄﾞ #1', panelX + PAD_X, panelY + 8);

  // 行
  ctx.font = `${fontPx}px monospace`;
  visible.forEach((m, i) => {
    const y = panelY + PAD_Y + i * lineH + lineH * 0.5 + 4;
    const age = now - m.bornAt;
    const fade = age > LIFE_FADE_MS
      ? Math.max(0, 1 - (age - LIFE_FADE_MS) / 2000)
      : 1;
    if (fade <= 0) return;
    ctx.globalAlpha = fade;
    _drawChatLine(ctx, m, panelX + PAD_X, y, panelW - PAD_X * 2, fontPx);
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

function _drawChatLine(
  ctx:    CanvasRenderingContext2D,
  m:      ChatMessage,
  x:      number,
  y:      number,
  maxW:   number,
  fontPx: number,
): void {
  // [Lv12 雪だるまの フロスト] テキスト
  const isPlayer = m.name === 'あなた';
  const prefix = isPlayer
    ? '[あなた] '
    : `[Lv${m.lv} ${m.speciesName}の${m.name}] `;

  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'left';

  // プレフィックス（種族ティント色）
  ctx.fillStyle = m.tint;
  ctx.shadowColor = m.tint;
  ctx.shadowBlur  = 4;
  ctx.fillText(prefix, x, y);
  ctx.shadowBlur  = 0;
  const pw = ctx.measureText(prefix).width;

  // 本文
  const bodyColor =
    m.kind === 'achieve'  ? '#fde68a' :
    m.kind === 'question' ? '#a5b4fc' :
                            '#e9d5ff';
  ctx.fillStyle = bodyColor;
  // 折り返さず単純切り捨て
  const remain = maxW - pw;
  let text = m.text;
  while (ctx.measureText(text + '…').width > remain && text.length > 0) {
    text = text.slice(0, -1);
  }
  if (text !== m.text) text += '…';
  ctx.fillText(text, x + pw, y);
}
