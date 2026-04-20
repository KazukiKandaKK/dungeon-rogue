// ─────────────────────────────────────────────
// casino.ts  カジノ・金貸し UI 描画
//
// main.js の _drawCasino / _drawLoan / _drawCard などを
// TypeScript に移行した Canvas 描画関数群。
// 依存する状態をすべて CasinoContext / LoanContext として明示する。
// ─────────────────────────────────────────────

import type { Player }       from '../entities/player.js';
import type {
  CasinoMode, BjPhase, BjResult, RlPhase, RlBetType, CcPhase, SlPhase, BlackjackCard,
} from '../core/game-context.js';
import { roundRect }         from './hud.js';
import {
  RL_RED, LOAN_AMOUNTS, REPAY_AMOUNTS, LOAN_INTEREST, LOAN_QUEST_FLOORS,
} from '../core/game-constants.js';

// ── 内部ヘルパー型 ─────────────────────────────

interface CcEvalResult { rank: number; point: number; }

// ── 内部ヘルパー関数 ──────────────────────────

function bjHandValue(hand: BlackjackCard[]): number {
  let total = hand.reduce((s, c) => s + c.value, 0);
  let aces  = hand.filter(c => c.rank === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function ccEval(dice: number[]): CcEvalResult {
  const d = [...dice].sort((a, b) => a - b);
  // ピンゾロ (1-1-1)
  if (d[0] === 1 && d[1] === 1 && d[2] === 1) return { rank: 100, point: 1 };
  // シゴロ (4-5-6)
  if (d[0] === 4 && d[1] === 5 && d[2] === 6) return { rank: 50, point: 6 };
  // ヒフミ (1-2-3)
  if (d[0] === 1 && d[1] === 2 && d[2] === 3) return { rank: -1, point: 0 };
  // ゾロ目 (同じ数3つ)
  if (d[0] === d[1] && d[1] === d[2]) return { rank: 10, point: d[0] };
  // 目あり (ペア + 目)
  if (d[0] === d[1]) return { rank: 1, point: d[2] };
  if (d[1] === d[2]) return { rank: 1, point: d[0] };
  if (d[0] === d[2]) return { rank: 1, point: d[1] };
  // 役なし
  return { rank: 0, point: 0 };
}

function ccRankLabel(ev: CcEvalResult): string {
  if (ev.rank === 100) return 'ピンゾロ！';
  if (ev.rank === 50)  return 'シゴロ！';
  if (ev.rank === -1)  return 'ヒフミ…';
  if (ev.rank === 10)  return `ゾロ目(${ev.point})`;
  if (ev.rank === 1)   return `${ev.point}の目`;
  return '役なし';
}

// ── エクスポート型 ────────────────────────────

export interface CasinoContext {
  player:       Player;
  casinoMode:   CasinoMode;
  casinoCursor: number;
  bjPhase:      BjPhase;
  bjBet:        number;
  bjHand:       BlackjackCard[];
  bjDealerHand: BlackjackCard[];
  bjResult:     BjResult;
  bjMsg:        string;
  rlPhase:      RlPhase;
  rlSpinAngle:  number;
  rlBetType:    RlBetType;
  rlBet:        number;
  rlNumber:     number;
  rlResult:     number;
  rlMsg:        string;
  ccPhase:         CcPhase;
  ccBet:           number;
  ccPlayerDice:    number[];
  ccPlayerRolls:   number;
  ccDealerDice:    number[];
  ccWin:           boolean | null;
  ccMsg:           string;
  /** チンチロのロールアニメ残時間（秒） — >0 の間はタンブル描画 */
  ccPlayerRollAnim?: number;
  ccDealerRollAnim?: number;
  /** スロット */
  slPhase?:       SlPhase;
  slBet?:         number;
  slReels?:       number[];       // 確定した3リール（symbol index）
  slReelOffsets?: number[];       // スピン中の縦スクロール量（ピクセル）
  slReelStopped?: boolean[];      // 各リール停止済みか
  slWin?:         boolean;
  slPayout?:      number;
  slMsg?:         string;
}

export interface LoanContext {
  player:          Player;
  loanRepayMode:   boolean;
  loanDebt:        number;
  loanQuestActive: boolean;
  loanRepayCursor: number;
  loanCursor:      number;
}

// ── 共通装飾ヘルパー ──────────────────────────

function drawFelt(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  radius = 8,
): void {
  roundRect(ctx, x, y, w, h, radius);
  const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, Math.max(w, h));
  g.addColorStop(0, '#0f4d2a');
  g.addColorStop(1, '#052416');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#000';
  for (let iy = 0; iy < h; iy += 4) {
    for (let ix = ((iy / 4) % 2) * 2; ix < w; ix += 4) {
      ctx.fillRect(x + ix, y + iy, 1, 1);
    }
  }
  ctx.restore();
  roundRect(ctx, x, y, w, h, radius);
  ctx.strokeStyle = 'rgba(251,191,36,0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  roundRect(ctx, x + 3, y + 3, w - 6, h - 6, Math.max(2, radius - 2));
  ctx.strokeStyle = 'rgba(251,191,36,0.15)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

function drawCornerDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#b45309';
  ctx.fillRect(-6, -6, 12, 12);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-4, -4, 8, 8);
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(-1.5, -1.5, 3, 3);
  ctx.restore();
}

function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number, alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.25, y - size * 0.25);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size * 0.25, y + size * 0.25);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.25, y + size * 0.25);
  ctx.lineTo(x - size, y);
  ctx.lineTo(x - size * 0.25, y - size * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── 大箱カジノ用ヘルパー ─────────────────────

function drawCurtain(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  side: 'left' | 'right',
): void {
  ctx.save();
  // 主布
  const g = ctx.createLinearGradient(x, y, x + w, y);
  if (side === 'left') {
    g.addColorStop(0, '#4c0519');
    g.addColorStop(0.55, '#7f1d1d');
    g.addColorStop(1, '#1c0308');
  } else {
    g.addColorStop(0, '#1c0308');
    g.addColorStop(0.45, '#7f1d1d');
    g.addColorStop(1, '#4c0519');
  }
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // ひだ
  const folds = 6;
  for (let i = 0; i < folds; i++) {
    const fx = x + ((i + 0.5) / folds) * w;
    const grad = ctx.createLinearGradient(fx - 10, y, fx + 10, y);
    grad.addColorStop(0,   'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.35)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(fx - 10, y, 20, h);
  }
  // 金糸トリム
  ctx.fillStyle = '#fbbf24';
  const trimX = side === 'left' ? x + w - 4 : x;
  ctx.fillRect(trimX, y, 4, h);
  // タッセル
  ctx.fillStyle = '#fde68a';
  const tasX = side === 'left' ? x + w - 8 : x + 4;
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(tasX - 4, y + 40 + i * ((h - 80) / 4), 12, 6);
  }
  ctx.restore();
}

function drawMarqueeSign(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  title: string, now: number,
): void {
  ctx.save();
  // 看板背板
  roundRect(ctx, x, y, w, h, 14);
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#4a1d05');
  bg.addColorStop(0.5, '#78350f');
  bg.addColorStop(1, '#2b0f02');
  ctx.fillStyle = bg; ctx.fill();
  // 金枠
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
  roundRect(ctx, x, y, w, h, 14); ctx.stroke();
  ctx.strokeStyle = 'rgba(253,230,138,0.6)'; ctx.lineWidth = 1;
  roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 10); ctx.stroke();

  // 上下LEDチェイス
  const ledCount = 28;
  for (let i = 0; i < ledCount; i++) {
    const lx = x + 10 + (i / (ledCount - 1)) * (w - 20);
    const phase = (Math.floor(now * 6) + i) % 4;
    const colors = ['#fde68a', '#fbbf24', '#dc2626', '#a21caf'];
    const col = colors[phase];
    // top
    ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(lx, y + 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(lx, y + h - 5, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;

  // 横LEDも左右に
  for (let i = 0; i < 6; i++) {
    const ly = y + 12 + (i / 5) * (h - 24);
    const phaseL = (Math.floor(now * 6) + i) % 4;
    const phaseR = (Math.floor(now * 6) + i + 2) % 4;
    const colors = ['#fde68a', '#fbbf24', '#dc2626', '#a21caf'];
    ctx.fillStyle = colors[phaseL];
    ctx.shadowColor = colors[phaseL]; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x + 5, ly, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colors[phaseR];
    ctx.shadowColor = colors[phaseR]; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x + w - 5, ly, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;

  // タイトル
  ctx.font = 'bold 30px "Noto Sans JP", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 14;
  const neonAlpha = 0.7 + 0.3 * Math.sin(now * 4);
  ctx.fillStyle = `rgba(253,230,138,${neonAlpha.toFixed(3)})`;
  ctx.fillText(title, x + w / 2, y + h / 2);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawSpotlight(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, angle: number, length: number,
  spread: number, color: string,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, 0, 0, length);
  g.addColorStop(0,   color);
  g.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-spread, length);
  ctx.lineTo( spread, length);
  ctx.closePath();
  ctx.globalCompositeOperation = 'screen';
  ctx.fill();
  ctx.restore();
}

function drawConfetti(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, now: number, density = 40,
): void {
  ctx.save();
  const colors = ['#fde68a', '#f87171', '#a78bfa', '#4ade80', '#60a5fa'];
  for (let i = 0; i < density; i++) {
    const seedX = (i * 73) % 1000 / 1000;
    const seedY = (i * 151) % 1000 / 1000;
    const speed = 0.3 + seedY * 0.6;
    const cx = x + ((seedX * w) + now * 28 * speed) % w;
    const cy = y + ((seedY * h) + now * 60 * speed) % h;
    const rot = now * (1.5 + seedY * 2) + i;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.8;
    ctx.fillRect(-3, -1.5, 6, 3);
    ctx.restore();
  }
  ctx.restore();
}

function drawBigDice(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number,
  value: number, rotation: number, glow: boolean,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  if (glow) {
    ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 24;
  }
  roundRect(ctx, -size / 2, -size / 2, size, size, size * 0.15);
  const g = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#f1f5f9');
  g.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowBlur = 0;
  // 枠
  roundRect(ctx, -size / 2, -size / 2, size, size, size * 0.15);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.stroke();
  // 内側ハイライト
  roundRect(ctx, -size / 2 + 5, -size / 2 + 5, size - 10, size * 0.3, size * 0.1);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();

  // ドット
  const dotsMap: Record<number, number[][]> = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  };
  const dots = dotsMap[value] ?? [];
  const sp = size * 0.26;
  const r  = size * 0.09;
  ctx.fillStyle = value === 1 ? '#dc2626' : '#111';
  for (const [ox, oy] of dots) {
    ctx.beginPath();
    ctx.arc(ox * sp, oy * sp, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBigCard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  card: BlackjackCard | null, hoverY = 0,
): void {
  ctx.save();
  ctx.translate(0, hoverY);
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = card ? '#f8fafc' : '#1e40af'; ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  roundRect(ctx, x, y, w, h, 8);
  ctx.strokeStyle = card ? '#1e293b' : '#1e3a8a'; ctx.lineWidth = 1.5; ctx.stroke();
  if (!card) {
    // 裏面パターン
    ctx.fillStyle = '#1d4ed8';
    for (let dy = 6; dy < h - 6; dy += 8) {
      for (let dx = 6; dx < w - 6; dx += 8) {
        ctx.fillRect(x + dx, y + dy, 3, 3);
      }
    }
    roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 5);
    ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    return;
  }
  const isRed = card.suit === '♥' || card.suit === '♦';
  ctx.fillStyle = isRed ? '#dc2626' : '#111827';
  // 左上小さいランク
  ctx.font = 'bold 14px serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(card.rank, x + 6, y + 5);
  ctx.font = '13px serif';
  ctx.fillText(card.suit, x + 6, y + 22);
  // 中央大きいスート
  ctx.font = `bold ${Math.floor(w * 0.55)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(card.suit, x + w / 2, y + h / 2);
  // 右下逆向き
  ctx.save();
  ctx.translate(x + w - 6, y + h - 5);
  ctx.rotate(Math.PI);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = 'bold 14px serif';
  ctx.fillText(card.rank, 0, 0);
  ctx.font = '13px serif';
  ctx.fillText(card.suit, 0, 17);
  ctx.restore();
  ctx.restore();
}

// ── スロット ──────────────────────────────────

export const SLOT_SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];
// payout multiplier when all 3 match
export const SLOT_PAYOUTS: Record<number, number> = {
  0: 3,   // cherry
  1: 5,   // lemon
  2: 8,   // bell
  3: 10,  // star
  4: 15,  // diamond
  5: 25,  // seven
};
// Partial cherry bonus (2x if cherry on reel0)
export const SLOT_PARTIAL_CHERRY = 1.5;

function drawSlotReel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  finalSymbolIdx: number, offset: number, stopped: boolean, now: number,
): void {
  ctx.save();
  // フレーム影
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  roundRect(ctx, x, y, w, h, 10);
  // リール奥の暗い背景
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0,   '#0b0d17');
  bg.addColorStop(0.5, '#1e2538');
  bg.addColorStop(1,   '#050710');
  ctx.fillStyle = bg; ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // クリップ内部
  ctx.save();
  roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 8);
  ctx.clip();

  const symH = h;
  const mid  = y + h / 2;
  const N = SLOT_SYMBOLS.length;

  // スピン中: 連続スクロールする帯を描く
  if (!stopped) {
    const scroll = offset % (symH * N);
    for (let k = -2; k < 4; k++) {
      const sy = mid - scroll + k * symH;
      const idx = ((k % N) + N) % N;
      const sym = SLOT_SYMBOLS[idx];
      ctx.font = `bold ${Math.floor(h * 0.55)}px "Noto Sans JP", serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // 縦ブラー感: 透明度を位置で減らす
      const d = Math.abs(sy - mid) / symH;
      ctx.globalAlpha = Math.max(0.1, 1 - d * 0.9);
      ctx.fillStyle = '#fde68a';
      ctx.fillText(sym, x + w / 2, sy);
    }
    ctx.globalAlpha = 1;
    // 動きのライン（モーションブラー代わり）
    ctx.strokeStyle = 'rgba(251,191,36,0.35)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      const ly = y + 8 + ((now * 600 + k * 16) % (h - 16));
      ctx.beginPath();
      ctx.moveTo(x + 6, ly);
      ctx.lineTo(x + w - 6, ly);
      ctx.stroke();
    }
  } else {
    // 停止中: 確定シンボルを真ん中 + 上下に隣接シンボル
    const centerSym = SLOT_SYMBOLS[finalSymbolIdx];
    const prevSym   = SLOT_SYMBOLS[(finalSymbolIdx - 1 + N) % N];
    const nextSym   = SLOT_SYMBOLS[(finalSymbolIdx + 1) % N];
    ctx.font = `bold ${Math.floor(h * 0.35)}px "Noto Sans JP", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(prevSym, x + w / 2, mid - symH * 0.6);
    ctx.fillText(nextSym, x + w / 2, mid + symH * 0.6);
    ctx.globalAlpha = 1;
    // 中央（大）
    ctx.font = `bold ${Math.floor(h * 0.6)}px "Noto Sans JP", serif`;
    // 7 やダイヤは強めに光らせる
    if (finalSymbolIdx >= 4) {
      ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 22;
    }
    ctx.fillStyle = '#fde68a';
    ctx.fillText(centerSym, x + w / 2, mid);
    ctx.shadowBlur = 0;
  }

  ctx.restore(); // clip

  // ガラスハイライト（縦）
  const gl = ctx.createLinearGradient(x, y, x, y + h);
  gl.addColorStop(0,    'rgba(255,255,255,0.18)');
  gl.addColorStop(0.2,  'rgba(255,255,255,0.05)');
  gl.addColorStop(0.5,  'rgba(0,0,0,0)');
  gl.addColorStop(0.8,  'rgba(0,0,0,0.25)');
  ctx.fillStyle = gl;
  roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 8); ctx.fill();

  // ペイライン枠
  roundRect(ctx, x, y, w, h, 10);
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3; ctx.stroke();
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 8);
  ctx.strokeStyle = 'rgba(251,191,36,0.35)'; ctx.lineWidth = 1; ctx.stroke();

  ctx.restore();
}

function drawFirework(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, t: number, color: string, seed: number,
): void {
  const progress = ((t + seed * 0.3) % 1.2);
  if (progress > 1) return;
  const rays = 12;
  const R = progress * 90;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color; ctx.shadowBlur = 10;
  for (let k = 0; k < rays; k++) {
    const a = (k / rays) * Math.PI * 2 + seed;
    const x1 = cx + Math.cos(a) * R * 0.55;
    const y1 = cy + Math.sin(a) * R * 0.55;
    const x2 = cx + Math.cos(a) * R;
    const y2 = cy + Math.sin(a) * R;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.restore();
}

function drawSlotScene(
  ctx: CanvasRenderingContext2D,
  px: number, py: number, pw: number, ph: number,
  c: CasinoContext, now: number,
): void {
  // 床フェルト
  drawFelt(ctx, px + 130, py + 150, pw - 260, ph - 240, 14);

  // タイトル
  ctx.font = 'bold 22px "Noto Sans JP", monospace'; ctx.fillStyle = '#fde68a';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.shadowColor = '#78350f'; ctx.shadowBlur = 8;
  ctx.fillText('🎰 スロットマシン', px + pw / 2, py + 158);
  ctx.shadowBlur = 0;

  // スロット筐体
  const cabW = 460, cabH = 340;
  const cabX = px + (pw - cabW) / 2;
  const cabY = py + 196;

  // 筐体外装（金→赤）
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10;
  roundRect(ctx, cabX, cabY, cabW, cabH, 18);
  const bodyG = ctx.createLinearGradient(cabX, cabY, cabX, cabY + cabH);
  bodyG.addColorStop(0,   '#a16207');
  bodyG.addColorStop(0.2, '#dc2626');
  bodyG.addColorStop(0.8, '#7f1d1d');
  bodyG.addColorStop(1,   '#3a0a10');
  ctx.fillStyle = bodyG; ctx.fill();
  ctx.restore();

  // 金フレーム
  roundRect(ctx, cabX, cabY, cabW, cabH, 18);
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3; ctx.stroke();
  roundRect(ctx, cabX + 6, cabY + 6, cabW - 12, cabH - 12, 14);
  ctx.strokeStyle = 'rgba(253,230,138,0.5)'; ctx.lineWidth = 1; ctx.stroke();

  // 筐体上部のLEDチェイス
  const ledTop = cabY + 18;
  for (let k = 0; k < 22; k++) {
    const lx = cabX + 30 + (k / 21) * (cabW - 60);
    const on = (Math.floor(now * 8) + k) % 3 === 0;
    ctx.beginPath(); ctx.arc(lx, ledTop, on ? 4 : 2.5, 0, Math.PI * 2);
    if (on) { ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 10; }
    ctx.fillStyle = on ? '#fde68a' : '#7c2d12';
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // JACKPOT ロゴ
  const logoY = cabY + 44;
  ctx.font = 'bold 22px "Noto Sans JP", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const alpha = 0.8 + 0.2 * Math.sin(now * 5);
  ctx.fillStyle = `rgba(253,230,138,${alpha.toFixed(3)})`;
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 14;
  ctx.fillText('★ JACKPOT ★', cabX + cabW / 2, logoY);
  ctx.shadowBlur = 0;

  // リール3本
  const reelW = 108, reelH = 148, reelG = 18;
  const reelsTotal = reelW * 3 + reelG * 2;
  const reelX0 = cabX + (cabW - reelsTotal) / 2;
  const reelY  = cabY + 90;
  const reels = c.slReels ?? [0, 0, 0];
  const stoppedFlags = c.slReelStopped ?? [true, true, true];
  const offsets = c.slReelOffsets ?? [0, 0, 0];

  for (let i = 0; i < 3; i++) {
    drawSlotReel(
      ctx,
      reelX0 + i * (reelW + reelG),
      reelY,
      reelW, reelH,
      reels[i] ?? 0,
      offsets[i] ?? 0,
      stoppedFlags[i] ?? true,
      now,
    );
  }

  // 中央当たりライン（横線）
  const lineY = reelY + reelH / 2;
  ctx.save();
  const lineAlpha = 0.5 + 0.5 * Math.sin(now * 6);
  ctx.strokeStyle = `rgba(239,68,68,${lineAlpha.toFixed(3)})`;
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(reelX0 - 10, lineY);
  ctx.lineTo(reelX0 + reelsTotal + 10, lineY);
  ctx.stroke();
  ctx.restore();

  // レバー（右外側）
  const leverX = cabX + cabW - 14;
  const leverBaseY = cabY + cabH * 0.55;
  const leverH = 48;
  const lowered = c.slPhase === 'spin';
  ctx.save();
  // 軸
  ctx.strokeStyle = '#4a4a4a'; ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(leverX, leverBaseY);
  ctx.lineTo(leverX, leverBaseY + (lowered ? leverH * 0.6 : -leverH));
  ctx.stroke();
  // 玉
  const kbY = leverBaseY + (lowered ? leverH * 0.6 : -leverH);
  const kg = ctx.createRadialGradient(leverX - 3, kbY - 3, 1, leverX, kbY, 10);
  kg.addColorStop(0, '#f87171'); kg.addColorStop(1, '#7f1d1d');
  ctx.beginPath(); ctx.arc(leverX, kbY, 10, 0, Math.PI * 2);
  ctx.fillStyle = kg; ctx.fill();
  ctx.strokeStyle = '#450a0a'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();

  // 筐体下部のベット表示
  const betY = cabY + cabH - 48;
  roundRect(ctx, cabX + 40, betY, cabW - 80, 36, 8);
  const bgB = ctx.createLinearGradient(cabX + 40, betY, cabX + 40, betY + 36);
  bgB.addColorStop(0, 'rgba(0,0,0,0.7)'); bgB.addColorStop(1, 'rgba(30,10,10,0.7)');
  ctx.fillStyle = bgB; ctx.fill();
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5;
  roundRect(ctx, cabX + 40, betY, cabW - 80, 36, 8); ctx.stroke();
  ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#fde68a';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`BET  ${c.slBet ?? 10} G`, cabX + cabW / 2, betY + 18);

  // ── フェーズ別の表示 ──
  if (c.slPhase === 'bet' || c.slPhase == null) {
    ctx.font = '12px monospace'; ctx.fillStyle = 'rgba(200,200,200,0.7)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('↑↓ ±5G    ←→ ±50G', px + pw / 2, py + ph - 118);
    ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#4ade80';
    ctx.fillText(`[E / Space] スピン！`, px + pw / 2, py + ph - 94);

    // ペイアウトテーブル
    ctx.font = '11px "Noto Sans JP", monospace'; ctx.fillStyle = 'rgba(253,230,138,0.75)';
    ctx.fillText('7️⃣×3 ×25   💎×3 ×15   ⭐×3 ×10   🔔×3 ×8   🍋×3 ×5   🍒×3 ×3', px + pw / 2, py + ph - 66);

  } else if (c.slPhase === 'spin') {
    ctx.font = 'bold 22px "Noto Sans JP", monospace';
    const a = 0.5 + 0.5 * Math.sin(now * 8);
    ctx.fillStyle = `rgba(251,191,36,${a.toFixed(3)})`;
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 14;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('— SPIN! —', px + pw / 2, py + ph - 96);
    ctx.shadowBlur = 0;

  } else if (c.slPhase === 'result') {
    const won = c.slWin === true;
    const bnW = 460, bnH = 54;
    const bnX = px + (pw - bnW) / 2;
    const bnY = py + ph - 116;

    // 勝ちなら派手な花火
    if (won) {
      drawFirework(ctx, px + pw * 0.25, py + 280, now,       '#fde68a', 0);
      drawFirework(ctx, px + pw * 0.75, py + 300, now + 0.4, '#f87171', 1);
      drawFirework(ctx, px + pw * 0.5,  py + 260, now + 0.2, '#60a5fa', 2);
      drawFirework(ctx, px + pw * 0.15, py + 400, now + 0.6, '#a78bfa', 3);
      drawFirework(ctx, px + pw * 0.85, py + 420, now + 0.1, '#4ade80', 4);
      drawConfetti(ctx, px + 140, py + 160, pw - 280, ph - 240, now, 90);
    }

    roundRect(ctx, bnX, bnY, bnW, bnH, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fill();
    ctx.strokeStyle = won ? '#fbbf24' : '#f87171'; ctx.lineWidth = 2.5;
    roundRect(ctx, bnX, bnY, bnW, bnH, 10); ctx.stroke();
    ctx.font = 'bold 22px "Noto Sans JP", monospace';
    ctx.fillStyle = won ? '#fde68a' : '#f87171';
    ctx.shadowColor = won ? '#fbbf24' : '#f87171'; ctx.shadowBlur = 14;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.slMsg ?? '', px + pw / 2, bnY + bnH / 2);
    ctx.shadowBlur = 0;
    ctx.font = '12px monospace'; ctx.fillStyle = '#c4b5fd';
    ctx.fillText('[E / Space] もう一度', px + pw / 2, py + ph - 50);
  }
}

// ── drawCasino ────────────────────────────────

export function drawCasino(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  c: CasinoContext,
): void {
  ctx.save();
  const now = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
  const pw = Math.min(W - 12, 1000);
  const ph = Math.min(H - 12, 700);
  const px = (W - pw) / 2, py = (H - ph) / 2;

  // 画面全体の暗幕
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, W, H);

  // スポットライト（背景で舞う光）
  drawSpotlight(ctx, W * 0.25, py - 8, 0.35 + 0.25 * Math.sin(now * 0.8), H * 0.9, 110, 'rgba(253,224,71,0.12)');
  drawSpotlight(ctx, W * 0.75, py - 8, -0.35 + 0.25 * Math.cos(now * 0.7), H * 0.9, 110, 'rgba(168,85,247,0.12)');
  drawSpotlight(ctx, W * 0.5,  py - 8,         0.15 * Math.sin(now * 1.1), H * 0.95, 140, 'rgba(251,191,36,0.14)');

  // メインパネル（劇場内部）
  roundRect(ctx, px, py, pw, ph, 16);
  const panelGrad = ctx.createLinearGradient(px, py, px, py + ph);
  panelGrad.addColorStop(0, '#1c0a05');
  panelGrad.addColorStop(0.5, '#0a0509');
  panelGrad.addColorStop(1, '#050209');
  ctx.fillStyle = panelGrad; ctx.fill();

  // 舞台奥（床）
  const stageY = py + 130;
  const stageH = ph - 230;
  const floorGrad = ctx.createLinearGradient(px, stageY, px, stageY + stageH);
  floorGrad.addColorStop(0, 'rgba(91,33,182,0.12)');
  floorGrad.addColorStop(0.4, 'rgba(20,5,40,0.25)');
  floorGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(px + 10, stageY, pw - 20, stageH);

  // 奥に浮かぶネオンシルエット（ダイヤ/ハート/スペード/クラブ）
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.font = 'bold 180px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#a855f7';
  ctx.fillText('♠', px + pw * 0.2, py + ph * 0.55);
  ctx.fillStyle = '#ef4444';
  ctx.fillText('♥', px + pw * 0.5, py + ph * 0.5);
  ctx.fillStyle = '#3b82f6';
  ctx.fillText('♦', px + pw * 0.8, py + ph * 0.55);
  ctx.restore();

  // 紙吹雪（舞台奥）
  drawConfetti(ctx, px + 12, py + 100, pw - 24, ph - 160, now, 50);

  // サイドカーテン
  const curtainW = 100;
  drawCurtain(ctx, px + 4,              py + 4, curtainW, ph - 8, 'left');
  drawCurtain(ctx, px + pw - curtainW - 4, py + 4, curtainW, ph - 8, 'right');

  // 二重金枠
  ctx.strokeStyle = 'rgba(251,191,36,0.95)'; ctx.lineWidth = 3;
  roundRect(ctx, px, py, pw, ph, 16); ctx.stroke();
  ctx.strokeStyle = 'rgba(251,191,36,0.35)'; ctx.lineWidth = 1;
  roundRect(ctx, px + 6, py + 6, pw - 12, ph - 12, 12); ctx.stroke();

  // 四隅ダイヤ装飾
  drawCornerDiamond(ctx, px + 18, py + 18);
  drawCornerDiamond(ctx, px + pw - 18, py + 18);
  drawCornerDiamond(ctx, px + 18, py + ph - 18);
  drawCornerDiamond(ctx, px + pw - 18, py + ph - 18);

  // ヘッダー: 大型マーキー看板
  const markW = pw - 260;
  const markH = 76;
  drawMarqueeSign(ctx, px + (pw - markW) / 2, py + 18, markW, markH,
                  '🎰 ロイヤル・カジノ 🎰', now);

  // アニメ★（左右外装）
  const blink = 0.5 + 0.5 * Math.sin(now * 3);
  drawSparkle(ctx, px + 50,       py + 56, 10, 0.55 + 0.45 * blink);
  drawSparkle(ctx, px + pw - 50,  py + 56, 10, 0.55 + 0.45 * (1 - blink));
  drawSparkle(ctx, px + 30,       py + 20, 6, 0.4 + 0.6 * blink);
  drawSparkle(ctx, px + pw - 30,  py + 20, 6, 0.4 + 0.6 * (1 - blink));

  // 所持金＆副題バー
  const subY = py + 108;
  roundRect(ctx, px + 30, subY, pw - 60, 26, 6);
  ctx.fillStyle = 'rgba(251,191,36,0.09)'; ctx.fill();
  ctx.strokeStyle = 'rgba(251,191,36,0.3)'; ctx.lineWidth = 1;
  roundRect(ctx, px + 30, subY, pw - 60, 26, 6); ctx.stroke();
  ctx.font = 'bold 13px "Noto Sans JP", monospace';
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`💰 所持金  ${c.player.gold} G`, px + 46, subY + 13);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(253,230,138,0.8)';
  const modeLabel: Record<CasinoMode, string> = {
    select: '🎭 メインホール',
    bj: '🃏 ブラックジャック・テーブル',
    roulette: '🎡 ルーレット・ウィング',
    chinchiro: '🎲 チンチロ・ピット',
    slot: '🎰 スロット・アーケード',
  };
  ctx.fillText(modeLabel[c.casinoMode], px + pw - 46, subY + 13);

  // ── モード選択 ──────────────────────────────
  if (c.casinoMode === 'select') {
    ctx.font = 'bold 15px "Noto Sans JP", monospace'; ctx.fillStyle = '#e9d5ff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(168,85,247,0.6)'; ctx.shadowBlur = 10;
    ctx.fillText('— 本日のテーブル・お好きなゲームをどうぞ —', px + pw / 2, py + 160);
    ctx.shadowBlur = 0;

    const cardW = 186, cardH = 340, gap = 16;
    const totalW = cardW * 4 + gap * 3;
    const bx0 = px + (pw - totalW) / 2;
    const by0 = py + 200;

    for (let i = 0; i < 4; i++) {
      const sel = c.casinoCursor === i;
      const hoverY = sel ? -6 - 3 * Math.sin(now * 3) : 0;
      const bx  = bx0 + i * (cardW + gap);
      const by  = by0 + hoverY;

      // 影 + 背景
      ctx.save();
      ctx.shadowColor = sel ? '#fbbf24' : 'rgba(0,0,0,0.9)';
      ctx.shadowBlur  = sel ? 36 : 14;
      roundRect(ctx, bx, by, cardW, cardH, 14);
      const cg = ctx.createLinearGradient(bx, by, bx, by + cardH);
      if (sel) {
        cg.addColorStop(0, '#3a1d0a');
        cg.addColorStop(0.5, '#1f0b04');
        cg.addColorStop(1, '#0a0401');
      } else {
        cg.addColorStop(0, '#181c35');
        cg.addColorStop(1, '#08091a');
      }
      ctx.fillStyle = cg; ctx.fill();
      ctx.restore();

      // 枠線（二重・金）
      roundRect(ctx, bx, by, cardW, cardH, 14);
      ctx.strokeStyle = sel ? '#fbbf24' : 'rgba(251,191,36,0.35)';
      ctx.lineWidth   = sel ? 3.5 : 1.5;
      ctx.stroke();
      roundRect(ctx, bx + 6, by + 6, cardW - 12, cardH - 12, 10);
      ctx.strokeStyle = sel ? 'rgba(253,230,138,0.65)' : 'rgba(251,191,36,0.18)';
      ctx.lineWidth   = 1; ctx.stroke();

      // 選択時のスポットライト
      if (sel) {
        const sp = ctx.createRadialGradient(bx + cardW / 2, by + 30, 4, bx + cardW / 2, by + 30, cardW * 0.9);
        sp.addColorStop(0, 'rgba(253,224,71,0.35)');
        sp.addColorStop(1, 'rgba(253,224,71,0)');
        ctx.fillStyle = sp;
        roundRect(ctx, bx + 2, by + 2, cardW - 4, cardH - 4, 12); ctx.fill();
      }

      // 四隅小ダイヤ
      drawCornerDiamond(ctx, bx + 14, by + 14);
      drawCornerDiamond(ctx, bx + cardW - 14, by + 14);
      drawCornerDiamond(ctx, bx + 14, by + cardH - 14);
      drawCornerDiamond(ctx, bx + cardW - 14, by + cardH - 14);

      // イラスト（中央）
      const ix = bx + cardW / 2;
      const iy = by + 120;

      if (i === 0) {
        // ブラックジャック: トランプの扇（中）
        const miniW = 46, miniH = 68;
        for (let k = -1; k <= 1; k++) {
          ctx.save();
          ctx.translate(ix + k * 26, iy + 10);
          ctx.rotate(k * 0.25);
          ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6;
          roundRect(ctx, -miniW / 2, -miniH / 2, miniW, miniH, 5);
          ctx.fillStyle = '#f8fafc'; ctx.fill();
          ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
          ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5; ctx.stroke();
          const rank = ['A', 'K', 'Q'][k + 1];
          const suit = ['♠', '♥', '♦'][k + 1];
          const redSuit = k !== -1;
          ctx.font = 'bold 15px serif';
          ctx.fillStyle = redSuit ? '#dc2626' : '#111827';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(rank, 0, -14);
          ctx.font = 'bold 22px serif';
          ctx.fillText(suit, 0, 8);
          ctx.restore();
        }
      } else if (i === 1) {
        // ルーレット: 回る中ホイール
        const R = 52;
        const spin = now * 0.8;
        for (let k = 0; k < 16; k++) {
          const a0 = spin + (k / 16) * Math.PI * 2;
          const a1 = spin + ((k + 1) / 16) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(ix, iy);
          ctx.arc(ix, iy, R, a0, a1);
          ctx.closePath();
          ctx.fillStyle = k === 0 ? '#16a34a' : (k % 2 ? '#dc2626' : '#111827');
          ctx.fill();
        }
        ctx.beginPath(); ctx.arc(ix, iy, R + 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#78350f'; ctx.lineWidth = 5; ctx.stroke();
        ctx.beginPath(); ctx.arc(ix, iy, R + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.stroke();
        for (let k = 0; k < 12; k++) {
          const a = spin + (k / 12) * Math.PI * 2;
          const lx = ix + Math.cos(a) * (R + 12);
          const ly = iy + Math.sin(a) * (R + 12);
          ctx.beginPath(); ctx.arc(lx, ly, 2, 0, Math.PI * 2);
          const on = (Math.floor(now * 8) + k) % 2;
          ctx.fillStyle = on ? '#fde68a' : '#7c2d12';
          if (on) { ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 5; }
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        const hub = ctx.createRadialGradient(ix - 3, iy - 3, 2, ix, iy, 10);
        hub.addColorStop(0, '#fde68a'); hub.addColorStop(1, '#b45309');
        ctx.beginPath(); ctx.arc(ix, iy, 10, 0, Math.PI * 2);
        ctx.fillStyle = hub; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ix - 7, iy - R - 9);
        ctx.lineTo(ix + 7, iy - R - 9);
        ctx.lineTo(ix,     iy - R + 4);
        ctx.closePath();
        ctx.fillStyle = '#fde68a'; ctx.fill();
      } else if (i === 2) {
        // チンチロ: 3つのダイス（タンブル）
        const D = 42;
        const faces = [1, 5, 6];
        for (let k = 0; k < 3; k++) {
          const dx = ix + (k - 1) * (D + 6);
          const dy = iy + Math.sin(now * 3 + k) * 3;
          const rot = Math.sin(now * 1.5 + k * 1.2) * 0.18;
          drawBigDice(ctx, dx, dy, D, faces[k], rot, sel && k === 1);
        }
      } else {
        // スロット: 3リールのミニプレビュー
        const symbols = ['7️⃣', '💎', '🍒'];
        const rw = 38, rh = 52, rg = 6;
        const startX = ix - (rw * 3 + rg * 2) / 2;
        for (let k = 0; k < 3; k++) {
          const rx = startX + k * (rw + rg);
          const ry = iy - rh / 2;
          // リール枠
          roundRect(ctx, rx, ry, rw, rh, 5);
          const rg2 = ctx.createLinearGradient(rx, ry, rx, ry + rh);
          rg2.addColorStop(0, '#111827');
          rg2.addColorStop(0.5, '#1f2937');
          rg2.addColorStop(1, '#0b0f1a');
          ctx.fillStyle = rg2; ctx.fill();
          roundRect(ctx, rx, ry, rw, rh, 5);
          ctx.strokeStyle = sel ? '#fbbf24' : 'rgba(251,191,36,0.5)';
          ctx.lineWidth = sel ? 2 : 1; ctx.stroke();
          // シンボル（アニメ回転）
          const sym = symbols[(k + Math.floor(now * 4)) % symbols.length];
          const bounceY = Math.sin(now * 6 + k) * 2;
          ctx.font = 'bold 26px serif';
          ctx.fillStyle = '#fde68a';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(sym, rx + rw / 2, ry + rh / 2 + bounceY);
        }
        // 当たりライン
        ctx.strokeStyle = sel ? '#dc2626' : 'rgba(220,38,38,0.5)';
        ctx.lineWidth = sel ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(startX - 4, iy);
        ctx.lineTo(startX + 3 * rw + 2 * rg + 4, iy);
        ctx.stroke();
      }

      // タイトル & 説明
      const labels  = ['ブラックジャック', 'ルーレット', 'チンチロ', 'スロット'];
      const subs    = ['21を超えず近づけろ', '赤・黒・数字を張れ', 'サイコロで役を作れ', 'リールを揃えろ'];
      const payouts = ['最大 ×2.5', '最大 ×36', '最大 ×5', '最大 ×25'];
      ctx.font = 'bold 16px "Noto Sans JP", monospace';
      ctx.fillStyle = sel ? '#fde68a' : '#e2e8f0';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      if (sel) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 10; }
      ctx.fillText(labels[i], ix, by + 210);
      ctx.shadowBlur = 0;
      ctx.font = '11px "Noto Sans JP", monospace';
      ctx.fillStyle = 'rgba(200,200,200,0.8)';
      ctx.fillText(subs[i], ix, by + 238);

      // 配当帯
      roundRect(ctx, bx + 16, by + 270, cardW - 32, 32, 6);
      const bg2 = ctx.createLinearGradient(bx + 16, by + 270, bx + 16, by + 302);
      if (sel) { bg2.addColorStop(0, 'rgba(251,191,36,0.35)'); bg2.addColorStop(1, 'rgba(180,83,9,0.25)'); }
      else     { bg2.addColorStop(0, 'rgba(251,191,36,0.12)'); bg2.addColorStop(1, 'rgba(251,191,36,0.04)'); }
      ctx.fillStyle = bg2; ctx.fill();
      ctx.strokeStyle = sel ? '#fbbf24' : 'rgba(251,191,36,0.3)'; ctx.lineWidth = sel ? 1.5 : 1;
      roundRect(ctx, bx + 16, by + 270, cardW - 32, 32, 6); ctx.stroke();
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = sel ? '#fde68a' : 'rgba(251,191,36,0.8)';
      ctx.textBaseline = 'middle';
      ctx.fillText(payouts[i], ix, by + 286);

      // 選択マーカー（▼ 点滅）
      if (sel) {
        const a = 0.5 + 0.5 * Math.sin(now * 5);
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = `rgba(251,191,36,${(0.5 + 0.5 * a).toFixed(3)})`;
        ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 12;
        ctx.textBaseline = 'middle';
        ctx.fillText('▼', ix, by - 22);
        ctx.shadowBlur = 0;
      }
    }

    // 足元の操作ヒント
    ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#4ade80';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('[←→] 選択    [E] 決定', px + pw / 2, py + ph - 62);
    ctx.font = '11px "Noto Sans JP", monospace'; ctx.fillStyle = 'rgba(200,200,200,0.55)';
    ctx.fillText('ようこそ、冒険者よ。今宵もよき賭けを。', px + pw / 2, py + ph - 42);

  // ── ブラックジャック ─────────────────────────
  } else if (c.casinoMode === 'bj') {
    // 大型フェルトテーブル（楕円風）
    const fx = px + 130, fy = py + 150, fw = pw - 260, fh = ph - 240;
    drawFelt(ctx, fx, fy, fw, fh, 140);

    // テーブルセンターロゴ
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.font = 'bold 120px serif';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('♠', fx + fw / 2, fy + fh / 2);
    ctx.restore();

    // タイトル
    ctx.font = 'bold 22px "Noto Sans JP", monospace'; ctx.fillStyle = '#fde68a';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.shadowColor = '#78350f'; ctx.shadowBlur = 8;
    ctx.fillText('🃏 ブラックジャック', px + pw / 2, py + 158);
    ctx.shadowBlur = 0;

    if (c.bjPhase === 'bet') {
      ctx.font = 'bold 18px "Noto Sans JP", monospace'; ctx.fillStyle = '#c4b5fd';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ベット額を設定してください', px + pw / 2, py + 230);

      // 大型ベット表示
      const bw = 260, bh = 96;
      const bxd = px + (pw - bw) / 2, byd = py + 260;
      roundRect(ctx, bxd, byd, bw, bh, 14);
      const bgrad = ctx.createLinearGradient(bxd, byd, bxd, byd + bh);
      bgrad.addColorStop(0, 'rgba(251,191,36,0.22)');
      bgrad.addColorStop(1, 'rgba(120,53,15,0.18)');
      ctx.fillStyle = bgrad; ctx.fill();
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5;
      roundRect(ctx, bxd, byd, bw, bh, 14); ctx.stroke();
      ctx.font = 'bold 56px monospace'; ctx.fillStyle = '#fde68a';
      ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 18;
      ctx.textBaseline = 'middle';
      ctx.fillText(`${c.bjBet}G`, px + pw / 2, byd + bh / 2);
      ctx.shadowBlur = 0;

      ctx.font = '13px monospace'; ctx.fillStyle = 'rgba(200,200,200,0.7)';
      ctx.fillText('↑↓ ±5G    ←→ ±50G', px + pw / 2, py + 390);
      if (c.player.gold >= 5) {
        ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#4ade80';
        ctx.fillText(`[E] ゲーム開始  (手持ち: ${c.player.gold}G)`, px + pw / 2, py + 440);
      } else {
        ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#f87171';
        ctx.fillText('所持金が足りません（最低 5G 必要）', px + pw / 2, py + 440);
      }
      ctx.font = '12px monospace'; ctx.fillStyle = 'rgba(180,180,180,0.55)';
      ctx.fillText('勝利: ×2  BJ: ×2.5  引分: 返却  敗北: 没収', px + pw / 2, py + 500);
    } else {
      const cardW = 84, cardH = 120, gap = 12;
      // ディーラー
      const dv = c.bjPhase === 'play' ? '?' : bjHandValue(c.bjDealerHand);
      ctx.font = 'bold 18px "Noto Sans JP", monospace'; ctx.fillStyle = '#fde68a';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(`— DEALER  ${dv} —`, px + pw / 2, py + 198);

      const dStartX = px + (pw - (cardW * c.bjDealerHand.length + gap * (c.bjDealerHand.length - 1))) / 2;
      c.bjDealerHand.forEach((card, i) => {
        const hidden = c.bjPhase === 'play' && i === 1;
        drawBigCard(ctx, dStartX + i * (cardW + gap), py + 228, cardW, cardH, hidden ? null : card);
      });

      // プレイヤー
      const pv = bjHandValue(c.bjHand);
      const pCol = pv > 21 ? '#f87171' : '#c4b5fd';
      ctx.font = 'bold 18px "Noto Sans JP", monospace'; ctx.fillStyle = pCol;
      ctx.fillText(`— YOU  ${pv} —`, px + pw / 2, py + 388);

      const pStartX = px + (pw - (cardW * c.bjHand.length + gap * (c.bjHand.length - 1))) / 2;
      c.bjHand.forEach((card, i) => {
        drawBigCard(ctx, pStartX + i * (cardW + gap), py + 418, cardW, cardH, card);
      });

      if (c.bjPhase === 'play') {
        ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#4ade80';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('[H / ←]  ヒット', px + pw * 0.35, py + ph - 78);
        ctx.fillStyle = '#60a5fa';
        ctx.fillText('[S / → / Space]  スタンド', px + pw * 0.65, py + ph - 78);
      } else {
        const col = c.bjResult === 'lose' ? '#f87171' : c.bjResult === 'push' ? '#94a3b8' : '#fbbf24';
        // 結果ネオンバナー
        const bnW = 460, bnH = 64;
        const bnX = px + (pw - bnW) / 2, bnY = py + ph - 128;
        roundRect(ctx, bnX, bnY, bnW, bnH, 12);
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2.5;
        roundRect(ctx, bnX, bnY, bnW, bnH, 12); ctx.stroke();
        ctx.font = 'bold 26px "Noto Sans JP", monospace'; ctx.fillStyle = col;
        ctx.shadowColor = col; ctx.shadowBlur = 14;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(c.bjMsg, px + pw / 2, bnY + bnH / 2);
        ctx.shadowBlur = 0;
        ctx.font = '13px monospace'; ctx.fillStyle = '#c4b5fd';
        ctx.fillText('[E / Space] もう一度', px + pw / 2, py + ph - 56);
      }
    }

  // ── ルーレット ──────────────────────────────
  } else if (c.casinoMode === 'roulette') {
    // フェルト
    drawFelt(ctx, px + 130, py + 150, pw - 260, ph - 240, 14);

    // 巨大ホイール
    const cx = px + pw / 2, cy = py + 295, R = 170;

    // タイトル
    ctx.font = 'bold 22px "Noto Sans JP", monospace'; ctx.fillStyle = '#fde68a';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.shadowColor = '#78350f'; ctx.shadowBlur = 8;
    ctx.fillText('🎡 ルーレット', px + pw / 2, py + 158);
    ctx.shadowBlur = 0;

    // 外装: 木製リム（広め）
    const rimGrad = ctx.createRadialGradient(cx, cy, R + 14, cx, cy, R + 42);
    rimGrad.addColorStop(0, '#a16207');
    rimGrad.addColorStop(0.5, '#78350f');
    rimGrad.addColorStop(1, '#3b1a08');
    ctx.beginPath(); ctx.arc(cx, cy, R + 42, 0, Math.PI * 2);
    ctx.fillStyle = rimGrad; ctx.fill();

    // LEDピン（大型・3列チェイス）
    const ledCount = 36;
    for (let k = 0; k < ledCount; k++) {
      const a = (k / ledCount) * Math.PI * 2;
      const lx = cx + Math.cos(a) * (R + 28);
      const ly = cy + Math.sin(a) * (R + 28);
      const on = (Math.floor(now * 10) + k) % 3 === 0;
      ctx.beginPath(); ctx.arc(lx, ly, on ? 4 : 2.6, 0, Math.PI * 2);
      if (on) {
        ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 14;
        ctx.fillStyle = '#fde68a';
      } else {
        ctx.fillStyle = '#7c2d12';
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 数字セグメント
    const nums = Array.from({length: 37}, (_, i) => i);
    nums.forEach((n, i) => {
      const a0 = c.rlSpinAngle + (i / 37) * Math.PI * 2;
      const a1 = c.rlSpinAngle + ((i + 1) / 37) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a1);
      ctx.closePath();
      ctx.fillStyle = n === 0 ? '#16a34a' : RL_RED.has(n) ? '#dc2626' : '#1a1a1a';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,0,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
      // 数字ラベル
      const am = c.rlSpinAngle + ((i + 0.5) / 37) * Math.PI * 2;
      const lx = cx + Math.cos(am) * R * 0.78;
      const ly = cy + Math.sin(am) * R * 0.78;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(am + Math.PI / 2);
      ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
    });

    // 外枠（金二重）
    ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R + 14, 0, Math.PI * 2);
    ctx.strokeStyle = '#b45309'; ctx.lineWidth = 3; ctx.stroke();

    // 中心ハブ
    const hubR = 22;
    const hubGrad = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, hubR);
    hubGrad.addColorStop(0, '#fde68a');
    hubGrad.addColorStop(1, '#78350f');
    ctx.beginPath(); ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
    ctx.fillStyle = hubGrad; ctx.fill();
    ctx.strokeStyle = '#451a03'; ctx.lineWidth = 2; ctx.stroke();

    // スポーク
    ctx.strokeStyle = 'rgba(251,191,36,0.55)'; ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) {
      const a = c.rlSpinAngle + (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * hubR, cy + Math.sin(a) * hubR);
      ctx.lineTo(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10));
      ctx.stroke();
    }

    // 動くボール（スピン中は外周、結果では該当数字）
    if (c.rlPhase === 'spin') {
      const ballA = -c.rlSpinAngle * 2.4;
      const bx = cx + Math.cos(ballA) * (R - 16);
      const by = cy + Math.sin(ballA) * (R - 16);
      ctx.save();
      ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2);
      const ballG = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, 7);
      ballG.addColorStop(0, '#ffffff'); ballG.addColorStop(1, '#cbd5e1');
      ctx.fillStyle = ballG; ctx.fill();
      ctx.restore();
    } else if (c.rlPhase === 'result') {
      const n = c.rlResult;
      const ballA = c.rlSpinAngle + ((n + 0.5) / 37) * Math.PI * 2;
      const bx = cx + Math.cos(ballA) * (R - 16);
      const by = cy + Math.sin(ballA) * (R - 16);
      ctx.save();
      ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.restore();
    }

    // ポインタ（金メッキ大三角）
    ctx.save();
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - R - 22);
    ctx.lineTo(cx + 14, cy - R - 22);
    ctx.lineTo(cx,     cy - R + 8);
    ctx.closePath();
    const ptGrad = ctx.createLinearGradient(cx, cy - R - 22, cx, cy - R + 8);
    ptGrad.addColorStop(0, '#fde68a');
    ptGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = ptGrad; ctx.fill();
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();

    if (c.rlPhase === 'bet') {
      // ベットタイプ選択（大型）
      const BET_TYPES: RlBetType[] = ['red','black','odd','even','low','high','number'];
      const BET_LABEL: Record<RlBetType, string> = { red:'🔴赤', black:'⚫黒', odd:'奇数', even:'偶数', low:'1-18', high:'19-36', number:`数字` };
      const BET_PAYOUT: Record<RlBetType, string> = { red:'×2', black:'×2', odd:'×2', even:'×2', low:'×2', high:'×2', number:'×36' };
      const bw = 104, bh = 56, bgap = 8;
      const totalBW = BET_TYPES.length * bw + (BET_TYPES.length - 1) * bgap;
      const bbx = px + (pw - totalBW) / 2;
      const bby = py + ph - 180;
      BET_TYPES.forEach((bt, i) => {
        const bx = bbx + i * (bw + bgap);
        const sel = c.rlBetType === bt;
        if (sel) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 14; }
        roundRect(ctx, bx, bby, bw, bh, 8);
        const bgg = ctx.createLinearGradient(bx, bby, bx, bby + bh);
        if (sel) {
          bgg.addColorStop(0, 'rgba(251,191,36,0.45)');
          bgg.addColorStop(1, 'rgba(180,83,9,0.35)');
        } else {
          bgg.addColorStop(0, 'rgba(30,41,59,0.7)');
          bgg.addColorStop(1, 'rgba(15,23,42,0.7)');
        }
        ctx.fillStyle = bgg; ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = sel ? '#fde68a' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = sel ? 2 : 1;
        roundRect(ctx, bx, bby, bw, bh, 8); ctx.stroke();
        ctx.font = `bold 14px "Noto Sans JP", monospace`; ctx.fillStyle = sel ? '#fde68a' : '#e2e8f0';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(BET_LABEL[bt], bx + bw / 2, bby + bh / 2 - 9);
        ctx.font = 'bold 12px monospace'; ctx.fillStyle = sel ? '#fbbf24' : 'rgba(180,220,180,0.7)';
        ctx.fillText(BET_PAYOUT[bt], bx + bw / 2, bby + bh / 2 + 11);
      });

      // ベット額 & 数字
      const infoY = py + ph - 104;
      if (c.rlBetType === 'number') {
        ctx.font = 'bold 22px monospace'; ctx.fillStyle = '#fde68a';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`数字: ${c.rlNumber}番`, px + pw * 0.3, infoY);
        ctx.font = 'bold 22px monospace'; ctx.fillStyle = '#fbbf24';
        ctx.fillText(`ベット: ${c.rlBet}G`, px + pw * 0.7, infoY);
      } else {
        ctx.font = 'bold 24px monospace'; ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`ベット: ${c.rlBet}G`, px + pw / 2, infoY);
      }
      ctx.font = '12px monospace'; ctx.fillStyle = 'rgba(200,200,200,0.55)';
      ctx.fillText('←→ ベット種  ↑↓ 数字/±5G  Q/Z ±50G  [E] スタート', px + pw / 2, py + ph - 72);

    } else if (c.rlPhase === 'spin') {
      const alpha = 0.6 + 0.4 * Math.sin(now * 6);
      ctx.font = 'bold 28px "Noto Sans JP", monospace';
      ctx.fillStyle = `rgba(251,191,36,${alpha.toFixed(3)})`;
      ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 18;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('— スピン中 —', px + pw / 2, py + ph - 90);
      ctx.shadowBlur = 0;

    } else if (c.rlPhase === 'result') {
      const n = c.rlResult;
      const nColor = n === 0 ? '#4ade80' : RL_RED.has(n) ? '#f87171' : '#e2e8f0';
      // 中央巨大数字（ホイール中央に重ねる）
      ctx.save();
      ctx.font = 'bold 48px monospace';
      ctx.fillStyle = nColor;
      ctx.shadowColor = nColor; ctx.shadowBlur = 24;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${n}`, cx, cy);
      ctx.restore();
      // 結果バナー
      const won = c.rlMsg.includes('当選');
      const col = won ? '#fbbf24' : '#f87171';
      const bnW = 460, bnH = 56;
      const bnX = px + (pw - bnW) / 2, bnY = py + ph - 120;
      roundRect(ctx, bnX, bnY, bnW, bnH, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2.2;
      roundRect(ctx, bnX, bnY, bnW, bnH, 10); ctx.stroke();
      ctx.font = 'bold 22px "Noto Sans JP", monospace'; ctx.fillStyle = col;
      ctx.shadowColor = col; ctx.shadowBlur = 12;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.rlMsg, px + pw / 2, bnY + bnH / 2);
      ctx.shadowBlur = 0;
      ctx.font = '12px monospace'; ctx.fillStyle = '#c4b5fd';
      ctx.fillText('[E / Space] もう一度', px + pw / 2, py + ph - 52);
    }

  // ── チンチロ ──────────────────────────────────
  } else if (c.casinoMode === 'chinchiro') {
    // フェルト（大）
    drawFelt(ctx, px + 130, py + 150, pw - 260, ph - 240, 14);

    ctx.font = 'bold 22px "Noto Sans JP", monospace'; ctx.fillStyle = '#fde68a';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.shadowColor = '#78350f'; ctx.shadowBlur = 8;
    ctx.fillText('🎲 チンチロ', px + pw / 2, py + 158);
    ctx.shadowBlur = 0;

    // サイコロ群描画ヘルパー（巨大版）
    const DS = 110, DG = 22;
    const drawDiceGroup = (
      dice: number[], label: string, labelColor: string,
      startX: number, startY: number, rollAnim: number, glow: boolean,
    ) => {
      const tumbling = rollAnim > 0;
      // ラベル（大）
      ctx.font = 'bold 15px "Noto Sans JP", monospace'; ctx.fillStyle = labelColor;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(label, startX, startY - 26);

      // 大型木製トレイ
      const trayW = dice.length * DS + (dice.length - 1) * DG + 48;
      const trayH = DS + 28;
      const tx = startX - 24, ty = startY - 14;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
      roundRect(ctx, tx, ty, trayW, trayH, 14);
      const woodGrad = ctx.createLinearGradient(tx, ty, tx, ty + trayH);
      woodGrad.addColorStop(0, '#a16207');
      woodGrad.addColorStop(0.4, '#78350f');
      woodGrad.addColorStop(1, '#3b1a08');
      ctx.fillStyle = woodGrad; ctx.fill();
      ctx.restore();
      // 木目
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = '#000';
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.moveTo(tx + 4, ty + 8 + k * (trayH / 6));
        ctx.lineTo(tx + trayW - 4, ty + 10 + k * (trayH / 6) + Math.sin(k) * 2);
        ctx.stroke();
      }
      ctx.restore();
      // 金枠
      roundRect(ctx, tx, ty, trayW, trayH, 14);
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
      ctx.stroke();
      roundRect(ctx, tx + 4, ty + 4, trayW - 8, trayH - 8, 10);
      ctx.strokeStyle = 'rgba(251,191,36,0.3)'; ctx.lineWidth = 1; ctx.stroke();

      // サイコロ（各個）
      dice.forEach((v, i) => {
        const dcx = startX + DS / 2 + i * (DS + DG);
        const dcy = startY + DS / 2;
        // ロール中: 激しい回転 + 上下バウンド + 毎フレーム違う目 + 残像
        if (tumbling) {
          // 残像（3枚）
          for (let t = 0; t < 3; t++) {
            const tAgo = t * 0.04;
            const bx = dcx + Math.sin(now * 20 + i * 2.4 - tAgo * 10) * (4 + i * 2);
            const by = dcy + Math.cos(now * 22 + i * 3.1 - tAgo * 12) * (10 + i * 2);
            const rot = (now * 22 + i * 1.7 - tAgo * 12) * 1.2;
            const fakeFace = 1 + (Math.floor((now - tAgo) * 40 + i * 7) % 6);
            ctx.save();
            ctx.globalAlpha = 0.14 - t * 0.04;
            drawBigDice(ctx, bx, by, DS, fakeFace, rot, false);
            ctx.restore();
          }
          // メイン
          const bx = dcx + Math.sin(now * 20 + i * 2.4) * (4 + i * 2);
          const by = dcy + Math.cos(now * 22 + i * 3.1) * (10 + i * 2);
          const rot = (now * 22 + i * 1.7) * 1.2;
          const fakeFace = 1 + (Math.floor(now * 40 + i * 7) % 6);
          drawBigDice(ctx, bx, by, DS, fakeFace, rot, true);
          // 衝撃波
          const ringT = (now * 3 + i * 0.3) % 1;
          ctx.save();
          ctx.globalAlpha = (1 - ringT) * 0.45;
          ctx.strokeStyle = '#fde68a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(dcx, dcy, DS * 0.4 + ringT * DS * 0.6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          return;
        }
        // 通常: ふわっと揺らぎ
        const rot = Math.sin(now * 1.5 + i) * 0.04;
        drawBigDice(ctx, dcx, dcy, DS, v, rot, glow);
      });
    };

    if (c.ccPhase === 'bet') {
      ctx.font = 'bold 18px "Noto Sans JP", monospace'; ctx.fillStyle = '#c4b5fd';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ベット額を設定してください', px + pw / 2, py + 220);

      // 大型ベット表示
      const bw = 260, bh = 96;
      const bxd = px + (pw - bw) / 2, byd = py + 250;
      roundRect(ctx, bxd, byd, bw, bh, 14);
      const bgrad = ctx.createLinearGradient(bxd, byd, bxd, byd + bh);
      bgrad.addColorStop(0, 'rgba(251,191,36,0.22)');
      bgrad.addColorStop(1, 'rgba(120,53,15,0.18)');
      ctx.fillStyle = bgrad; ctx.fill();
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5;
      roundRect(ctx, bxd, byd, bw, bh, 14); ctx.stroke();
      ctx.font = 'bold 56px monospace'; ctx.fillStyle = '#fde68a';
      ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 18;
      ctx.textBaseline = 'middle';
      ctx.fillText(`${c.ccBet}G`, px + pw / 2, byd + bh / 2);
      ctx.shadowBlur = 0;

      // 飾りダイス（プレビュー）
      drawBigDice(ctx, px + pw / 2 - 170, byd + bh / 2, 70, 1 + Math.floor((now * 2) % 6), Math.sin(now * 2) * 0.4, true);
      drawBigDice(ctx, px + pw / 2 + 170, byd + bh / 2, 70, 1 + Math.floor((now * 2 + 3) % 6), Math.cos(now * 2) * 0.4, true);

      ctx.font = '13px monospace'; ctx.fillStyle = 'rgba(200,200,200,0.7)';
      ctx.fillText('↑↓ ±5G    ←→ ±50G', px + pw / 2, py + 380);
      if (c.player.gold >= 5) {
        ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#4ade80';
        ctx.fillText(`[E] ゲーム開始  (手持ち: ${c.player.gold}G)`, px + pw / 2, py + 430);
      } else {
        ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#f87171';
        ctx.fillText('所持金が足りません（最低 5G 必要）', px + pw / 2, py + 430);
      }
      ctx.font = '12px monospace'; ctx.fillStyle = 'rgba(180,180,180,0.55)';
      ctx.fillText('ピンゾロ ×5    シゴロ ×3    ゾロ目 ×3    目あり ×2    ヒフミ 負け', px + pw / 2, py + 490);

    } else if (c.ccPhase === 'player_roll' || c.ccPhase === 'dealer_roll' || c.ccPhase === 'result') {
      const diceTotalW = DS * 3 + DG * 2;
      const diceStartX = px + (pw - diceTotalW) / 2;
      const pEv = ccEval(c.ccPlayerDice);
      const pGlow = pEv.rank >= 10; // ゾロ目以上で光る

      // プレイヤー
      drawDiceGroup(
        c.ccPlayerDice,
        `あなた（${c.ccPlayerRolls}/3回目）`,
        '#c4b5fd',
        diceStartX, py + 220,
        c.ccPlayerRollAnim ?? 0, pGlow,
      );

      // 役ラベル（大）
      ctx.font = 'bold 20px "Noto Sans JP", monospace';
      ctx.fillStyle = pEv.rank < 0 ? '#f87171' : pEv.rank > 1 ? '#fbbf24' : pEv.rank === 0 ? '#e2e8f0' : '#86efac';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      if (pEv.rank > 1) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 12; }
      ctx.fillText(ccRankLabel(pEv), px + pw / 2, py + 350);
      ctx.shadowBlur = 0;

      if (c.ccPhase === 'result') {
        const dEv = ccEval(c.ccDealerDice);
        const dGlow = dEv.rank >= 10;
        drawDiceGroup(
          c.ccDealerDice,
          'ディーラー',
          '#94a3b8',
          diceStartX, py + 390,
          c.ccDealerRollAnim ?? 0, dGlow,
        );
        ctx.font = 'bold 18px "Noto Sans JP", monospace';
        ctx.fillStyle = dEv.rank < 0 ? '#f87171' : dEv.rank > 1 ? '#fbbf24' : dEv.rank === 0 ? '#e2e8f0' : '#86efac';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(ccRankLabel(dEv), px + pw / 2, py + 520);

        // 結果バナー
        const col = c.ccWin === true ? '#fbbf24' : c.ccWin === false ? '#f87171' : '#94a3b8';
        const bnW = 460, bnH = 52;
        const bnX = px + (pw - bnW) / 2, bnY = py + ph - 118;
        roundRect(ctx, bnX, bnY, bnW, bnH, 10);
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2.2;
        roundRect(ctx, bnX, bnY, bnW, bnH, 10); ctx.stroke();
        ctx.font = 'bold 22px "Noto Sans JP", monospace'; ctx.fillStyle = col;
        ctx.shadowColor = col; ctx.shadowBlur = 12;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(c.ccMsg, px + pw / 2, bnY + bnH / 2);
        ctx.shadowBlur = 0;

        ctx.font = '12px monospace'; ctx.fillStyle = '#c4b5fd';
        ctx.fillText('[E / Space] もう一度', px + pw / 2, py + ph - 52);

        // 勝ちなら紙吹雪追加
        if (c.ccWin === true) {
          drawConfetti(ctx, px + 140, py + 140, pw - 280, ph - 220, now, 70);
        }
      } else {
        const canReroll = pEv.rank === 0 && c.ccPlayerRolls < 3;
        const hint = canReroll
          ? `[E / Space] 振り直す（あと ${3 - c.ccPlayerRolls} 回）`
          : '[E / Space] ディーラーと勝負！';
        ctx.font = 'bold 18px "Noto Sans JP", monospace'; ctx.fillStyle = '#4ade80';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 10;
        ctx.fillText(hint, px + pw / 2, py + ph - 96);
        ctx.shadowBlur = 0;
      }
    }

  // ── スロット ──────────────────────────────────
  } else if (c.casinoMode === 'slot') {
    drawSlotScene(ctx, px, py, pw, ph, c, now);
  }

  ctx.font = '11px monospace'; ctx.fillStyle = 'rgba(180,180,180,0.55)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  const escLabel = c.casinoMode === 'select' ? '[Esc / B] 閉じる' : '[Esc / B] 戻る';
  ctx.fillText(escLabel, px + pw / 2, py + ph - 14);
  ctx.restore();
}

// ── drawLoan ──────────────────────────────────

// 金貸しの顔（ミニ肖像画）
function drawLoanShark(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  angry: boolean, t: number,
): void {
  ctx.save();
  // 額縁
  ctx.fillStyle = '#78350f';
  roundRect(ctx, cx - r - 6, cy - r - 6, r * 2 + 12, r * 2 + 12, 6); ctx.fill();
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
  roundRect(ctx, cx - r - 6, cy - r - 6, r * 2 + 12, r * 2 + 12, 6); ctx.stroke();

  // 背景（不気味なグラデ）
  const bg = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
  if (angry) {
    bg.addColorStop(0, '#7f1d1d');
    bg.addColorStop(1, '#1e0505');
  } else {
    bg.addColorStop(0, '#3f2a0e');
    bg.addColorStop(1, '#0d0a05');
  }
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

  // シルクハット
  ctx.fillStyle = '#111';
  ctx.fillRect(cx - r * 0.55, cy - r * 0.95, r * 1.1, r * 0.35);
  ctx.fillRect(cx - r * 0.75, cy - r * 0.65, r * 1.5, r * 0.12);
  // 金のバンド
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(cx - r * 0.55, cy - r * 0.68, r * 1.1, 3);

  // 顔
  ctx.fillStyle = angry ? '#c2410c' : '#f5d0a9';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.05, r * 0.55, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 目（＄マーク）
  const eyeBob = Math.sin(t * 3) * 0.6;
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = angry ? '#fde68a' : '#16a34a';
  ctx.shadowColor = angry ? '#ef4444' : '#4ade80';
  ctx.shadowBlur = 6;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('$', cx - r * 0.22, cy + eyeBob);
  ctx.fillText('$', cx + r * 0.22, cy + eyeBob);
  ctx.shadowBlur = 0;

  // 口（ニヤリ or 怒り）
  ctx.strokeStyle = angry ? '#fde68a' : '#451a03';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (angry) {
    // ギザギザ
    for (let i = 0; i < 5; i++) {
      const mx = cx - r * 0.28 + i * r * 0.14;
      ctx.lineTo(mx, cy + r * 0.3 + (i % 2 === 0 ? 0 : -3));
    }
  } else {
    ctx.moveTo(cx - r * 0.3, cy + r * 0.25);
    ctx.quadraticCurveTo(cx, cy + r * 0.45, cx + r * 0.3, cy + r * 0.25);
  }
  ctx.stroke();

  // 葉巻
  ctx.fillStyle = '#78350f';
  ctx.fillRect(cx + r * 0.05, cy + r * 0.32, r * 0.3, 3);
  // 火
  ctx.fillStyle = '#f97316';
  ctx.shadowColor = '#f97316'; ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(cx + r * 0.38, cy + r * 0.335, 2 + Math.sin(t * 8) * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

// 大きな金貨（浮いてる）
function drawFloatingCoin(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, phase: number,
): void {
  ctx.save();
  const sw = Math.abs(Math.sin(phase));
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 10;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * sw, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1;
  ctx.stroke();
  // $ 記号
  if (sw > 0.4) {
    ctx.font = `bold ${Math.floor(r * 1.2)}px monospace`;
    ctx.fillStyle = '#78350f';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', cx, cy);
  }
  ctx.restore();
}

export function drawLoan(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  c: LoanContext,
): void {
  ctx.save();

  const now = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
  const pulse = 0.5 + 0.5 * Math.abs(Math.sin(now * 2));

  // 背景暗幕
  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  ctx.fillRect(0, 0, W, H);

  const pw = 520;
  const ph = c.loanRepayMode ? 320 : 460;
  const px = ((W - pw) / 2) | 0;
  const py = ((H - ph) / 2) | 0;

  const angry = c.loanDebt > 0 && !c.loanQuestActive;
  const friendly = c.loanQuestActive;

  // 背景（債務状態で色が変わる）
  const bgG = ctx.createLinearGradient(px, py, px, py + ph);
  if (angry) {
    bgG.addColorStop(0, '#2a0505');
    bgG.addColorStop(1, '#0f0202');
  } else if (friendly) {
    bgG.addColorStop(0, '#0a2a10');
    bgG.addColorStop(1, '#030a03');
  } else {
    bgG.addColorStop(0, '#1a0f28');
    bgG.addColorStop(1, '#05020f');
  }
  roundRect(ctx, px, py, pw, ph, 14);
  ctx.fillStyle = bgG; ctx.fill();
  const borderCol = friendly ? '#4ade80' : angry ? '#ef4444' : '#b45309';
  ctx.shadowColor = borderCol;
  ctx.shadowBlur = 18 * pulse;
  ctx.strokeStyle = borderCol; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.shadowBlur = 0;

  // 怒ってる時は血の雫を散らす
  if (angry) {
    for (let i = 0; i < 6; i++) {
      const dp = ((now * 0.6 + i * 0.17) % 1);
      const dx = px + 20 + (i * 91 % (pw - 40));
      const dy = py + 20 + dp * (ph - 40);
      ctx.fillStyle = `rgba(239,68,68,${(1 - dp) * 0.35})`;
      ctx.beginPath(); ctx.arc(dx, dy, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── ヘッダー：肖像画 + タイトル ──────────
  const portraitX = px + 52;
  const portraitY = py + 50;
  drawLoanShark(ctx, portraitX, portraitY, 30, angry, now);

  ctx.font = 'bold 18px "Noto Sans JP", monospace';
  ctx.fillStyle = angry ? '#fca5a5' : friendly ? '#86efac' : '#fde68a';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.shadowColor = borderCol; ctx.shadowBlur = 10;
  ctx.fillText('💸 金貸し', portraitX + 48, py + 26);
  ctx.shadowBlur = 0;

  // セリフ（状態で変わる）
  const line = friendly
    ? '"宝探しの首尾はどうだい？期待してるぜ…"'
    : angry
      ? '"おい、そろそろ払ってもらおうか…？"'
      : '"今日は何を借りていくんだ、旦那？"';
  ctx.font = '10px "Noto Sans JP", monospace';
  ctx.fillStyle = angry ? 'rgba(252,165,165,0.85)' : friendly ? 'rgba(134,239,172,0.8)' : 'rgba(253,230,138,0.75)';
  ctx.fillText(line, portraitX + 48, py + 48);

  // ── 債務メーター ──────────────────────
  const meterX = portraitX + 48;
  const meterY = py + 62;
  const meterW = pw - (meterX - px) - 24;
  const meterH = 22;

  roundRect(ctx, meterX, meterY, meterW, meterH, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
  ctx.strokeStyle = 'rgba(251,191,36,0.35)'; ctx.lineWidth = 1; ctx.stroke();

  if (c.loanDebt > 0) {
    // 借金が溜まるほど赤く
    const maxVis = 2000; // 視覚的な最大
    const ratio = Math.min(1, c.loanDebt / maxVis);
    const fillW = (meterW - 4) * ratio;
    const fg = ctx.createLinearGradient(meterX, meterY, meterX + fillW, meterY);
    fg.addColorStop(0, '#f59e0b');
    fg.addColorStop(0.6, '#ef4444');
    fg.addColorStop(1, '#7f1d1d');
    roundRect(ctx, meterX + 2, meterY + 2, fillW, meterH - 4, 3);
    ctx.fillStyle = fg; ctx.fill();
  }

  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = c.loanDebt > 0 ? '#fecaca' : '#86efac';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(
    c.loanDebt > 0 ? `借金残高: ${c.loanDebt} G` : '借金: なし（クリーン）',
    meterX + meterW / 2, meterY + meterH / 2,
  );

  // ── 区切り ───────────────────────────
  const topY = py + 100;
  ctx.strokeStyle = 'rgba(251,191,36,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + 20, topY); ctx.lineTo(px + pw - 20, topY); ctx.stroke();

  // 浮遊する金貨（所持金の横）
  const goldTxtY = py + ph - 28;
  drawFloatingCoin(ctx, px + 28, goldTxtY, 10, now * 3);

  if (c.loanRepayMode) {
    // ── 返済額選択モード ──
    ctx.font = 'bold 14px "Noto Sans JP", monospace';
    ctx.fillStyle = '#fca5a5';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('💰 返済額を選択', px + pw / 2, topY + 14);

    ctx.font = '10px "Noto Sans JP", monospace';
    ctx.fillStyle = 'rgba(252,165,165,0.65)';
    ctx.fillText('[←→] 移動   [Enter / R] 決定   [Esc] キャンセル', px + pw / 2, topY + 36);

    const btnW = 78, btnH = 46, btnGap = 10;
    const totalW = REPAY_AMOUNTS.length * btnW + (REPAY_AMOUNTS.length - 1) * btnGap;
    const bx0 = px + (pw - totalW) / 2;
    const by0 = topY + 62;

    REPAY_AMOUNTS.forEach((amt, i) => {
      const bx = bx0 + i * (btnW + btnGap);
      const sel = i === c.loanRepayCursor;
      const label = amt === -1 ? '全額' : `${amt}G`;
      const canAfford = amt === -1 ? c.player.gold > 0 : c.player.gold >= amt;

      // カード
      const g = ctx.createLinearGradient(bx, by0, bx, by0 + btnH);
      if (sel) {
        g.addColorStop(0, '#166534'); g.addColorStop(1, '#052e16');
      } else {
        g.addColorStop(0, 'rgba(22,101,52,0.3)');
        g.addColorStop(1, 'rgba(3,20,9,0.5)');
      }
      roundRect(ctx, bx, by0, btnW, btnH, 8); ctx.fillStyle = g; ctx.fill();
      if (sel) {
        ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 12 * pulse;
      }
      ctx.strokeStyle = sel ? '#4ade80' : canAfford ? 'rgba(74,222,128,0.4)' : 'rgba(107,114,128,0.3)';
      ctx.lineWidth = sel ? 2 : 1;
      roundRect(ctx, bx, by0, btnW, btnH, 8); ctx.stroke();
      ctx.shadowBlur = 0;

      // コイン小
      drawFloatingCoin(ctx, bx + 14, by0 + 14, 5, now * 2 + i);

      ctx.font = `bold ${sel ? 14 : 12}px monospace`;
      ctx.fillStyle = sel ? '#ffffff' : canAfford ? '#86efac' : '#6b7280';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + btnW / 2 + 4, by0 + btnH / 2);

      if (!canAfford && amt !== -1) {
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('✗', bx + btnW - 10, by0 + 10);
      }
    });

    // 所持金
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#fde68a';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`所持金: ${c.player.gold} G`, px + 44, goldTxtY);

    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(156,163,175,0.55)';
    ctx.textAlign = 'center';
    ctx.fillText('[Esc] 戻る', px + pw / 2, py + ph - 10);
    ctx.restore();
    return;
  }

  // ── 通常モード ──

  // 注記
  ctx.font = '10px "Noto Sans JP", monospace';
  ctx.fillStyle = 'rgba(248,113,113,0.75)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(
    `※ フロアごとに利息 ${Math.round(LOAN_INTEREST * 100)}% 加算。返済が遅れると借金取りが襲ってくる…`,
    px + pw / 2, topY + 10,
  );

  // 借入額ボタン
  ctx.font = 'bold 12px "Noto Sans JP", monospace';
  ctx.fillStyle = '#c4b5fd';
  ctx.fillText('借入額を選択  [←→] 移動  [Enter / E] 借りる',
    px + pw / 2, topY + 34);

  const btnW = 76, btnH = 44, btnGap = 10;
  const totalW = LOAN_AMOUNTS.length * btnW + (LOAN_AMOUNTS.length - 1) * btnGap;
  const bx0 = px + (pw - totalW) / 2;
  const by0 = topY + 60;

  LOAN_AMOUNTS.forEach((amt, i) => {
    const bx = bx0 + i * (btnW + btnGap);
    const sel = i === c.loanCursor;

    // カード（グラデーション）
    const g = ctx.createLinearGradient(bx, by0, bx, by0 + btnH);
    if (sel) {
      g.addColorStop(0, '#7c3aed'); g.addColorStop(1, '#3b0764');
    } else {
      g.addColorStop(0, 'rgba(91,33,182,0.38)');
      g.addColorStop(1, 'rgba(30,10,50,0.6)');
    }
    roundRect(ctx, bx, by0, btnW, btnH, 8); ctx.fillStyle = g; ctx.fill();
    if (sel) {
      ctx.shadowColor = '#c4b5fd'; ctx.shadowBlur = 14 * pulse;
    }
    ctx.strokeStyle = sel ? '#c4b5fd' : 'rgba(167,139,250,0.35)';
    ctx.lineWidth = sel ? 2 : 1;
    roundRect(ctx, bx, by0, btnW, btnH, 8); ctx.stroke();
    ctx.shadowBlur = 0;

    // 金貨アイコン
    drawFloatingCoin(ctx, bx + 14, by0 + 14, 6, now * 2.5 + i * 0.7);

    // 金額
    ctx.font = `bold ${sel ? 15 : 13}px monospace`;
    ctx.fillStyle = sel ? '#ffffff' : '#c4b5fd';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${amt}G`, bx + btnW / 2 + 4, by0 + btnH / 2);
  });

  // 仕切り線
  const midY = by0 + btnH + 18;
  ctx.strokeStyle = 'rgba(91,33,182,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + 20, midY); ctx.lineTo(px + pw - 20, midY); ctx.stroke();

  // 返済セクション
  if (c.loanDebt > 0) {
    const canPay = c.player.gold > 0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // [R] 返済ボタン風
    const rBtnW = 240, rBtnH = 30;
    const rBtnX = px + (pw - rBtnW) / 2, rBtnY = midY + 10;
    const rg = ctx.createLinearGradient(rBtnX, rBtnY, rBtnX, rBtnY + rBtnH);
    if (canPay) {
      rg.addColorStop(0, '#166534'); rg.addColorStop(1, '#052e16');
    } else {
      rg.addColorStop(0, 'rgba(55,65,81,0.4)'); rg.addColorStop(1, 'rgba(17,24,39,0.55)');
    }
    roundRect(ctx, rBtnX, rBtnY, rBtnW, rBtnH, 6); ctx.fillStyle = rg; ctx.fill();
    ctx.strokeStyle = canPay ? '#4ade80' : 'rgba(107,114,128,0.45)';
    ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = 'bold 12px "Noto Sans JP", monospace';
    ctx.fillStyle = canPay ? '#86efac' : '#6b7280';
    ctx.fillText(
      canPay ? `[R] 返済する  (所持金: ${c.player.gold}G)` : '[R] 返済する  (所持金不足)',
      rBtnX + rBtnW / 2, rBtnY + rBtnH / 2,
    );

    // 宝探し依頼セクション
    const divY = midY + 54;

    if (c.loanQuestActive) {
      // 依頼中カード（緑に光る）
      const qh = 62;
      const qg = ctx.createLinearGradient(px + 20, divY, px + 20, divY + qh);
      qg.addColorStop(0, 'rgba(22,101,52,0.55)');
      qg.addColorStop(1, 'rgba(3,20,9,0.7)');
      roundRect(ctx, px + 20, divY, pw - 40, qh, 8);
      ctx.fillStyle = qg; ctx.fill();
      ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 14 * pulse;
      ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1.6;
      roundRect(ctx, px + 20, divY, pw - 40, qh, 8); ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.font = 'bold 13px "Noto Sans JP", monospace';
      ctx.fillStyle = '#86efac';
      ctx.fillText('🗺 宝探し依頼 — 受注中', px + pw / 2, divY + 18);
      ctx.font = '10px "Noto Sans JP", monospace';
      ctx.fillStyle = 'rgba(134,239,172,0.8)';
      ctx.fillText(`${LOAN_QUEST_FLOORS} フロア以内のお宝が借金返済に充てられる`, px + pw / 2, divY + 38);
      ctx.fillStyle = 'rgba(134,239,172,0.6)';
      ctx.fillText('（借金取りは猶予中）', px + pw / 2, divY + 54);
    } else {
      ctx.font = 'bold 12px "Noto Sans JP", monospace';
      ctx.fillStyle = '#fde68a';
      ctx.fillText('[Q] 宝探し依頼を受ける', px + pw / 2, divY + 14);
      ctx.font = '10px "Noto Sans JP", monospace';
      ctx.fillStyle = 'rgba(253,230,138,0.7)';
      ctx.fillText(`→ ${LOAN_QUEST_FLOORS} フロア以内のお宝が自動で借金返済に充てられる`,
        px + pw / 2, divY + 32);
      ctx.fillStyle = 'rgba(253,230,138,0.45)';
      ctx.fillText('（依頼中は借金取りが来ない）', px + pw / 2, divY + 48);
    }
  }

  // プレイヤー所持金（左下）
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#fde68a';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`所持金: ${c.player.gold} G`, px + 44, goldTxtY);

  // フッター
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(156,163,175,0.55)';
  ctx.textAlign = 'center';
  ctx.fillText('[B / Esc] 閉じる', px + pw / 2, py + ph - 10);

  ctx.restore();
}
