// ─────────────────────────────────────────────
// casino.ts  カジノ・金貸し UI 描画
//
// main.js の _drawCasino / _drawLoan / _drawCard などを
// TypeScript に移行した Canvas 描画関数群。
// 依存する状態をすべて CasinoContext / LoanContext として明示する。
// ─────────────────────────────────────────────

import type { Player }       from '../entities/player.js';
import type {
  CasinoMode, BjPhase, BjResult, RlPhase, RlBetType, CcPhase, BlackjackCard,
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

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  card: BlackjackCard | null,
): void {
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = card ? '#f8fafc' : '#1e3a5f'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
  if (!card) {
    ctx.fillStyle = '#2563eb';
    for (let dy = 5; dy < h - 4; dy += 7)
      for (let dx = 5; dx < w - 4; dx += 7)
        ctx.fillRect(x + dx, y + dy, 2, 2);
    return;
  }
  const isRed = card.suit === '♥' || card.suit === '♦';
  ctx.fillStyle = isRed ? '#dc2626' : '#111827';
  ctx.font = `bold ${w > 40 ? 11 : 9}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(card.rank, x + w / 2, y + h * 0.35);
  ctx.font = `${w > 40 ? 13 : 11}px serif`;
  ctx.fillText(card.suit, x + w / 2, y + h * 0.68);
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
}

export interface LoanContext {
  player:          Player;
  loanRepayMode:   boolean;
  loanDebt:        number;
  loanQuestActive: boolean;
  loanRepayCursor: number;
  loanCursor:      number;
}

// ── drawCasino ────────────────────────────────

export function drawCasino(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  c: CasinoContext,
): void {
  ctx.save();
  const pw = 520, ph = 460;
  const px = (W - pw) / 2, py = (H - ph) / 2;

  roundRect(ctx, px, py, pw, ph, 14);
  ctx.fillStyle = 'rgba(2,10,6,0.98)'; ctx.fill();
  ctx.strokeStyle = 'rgba(251,191,36,0.9)'; ctx.lineWidth = 2.5; ctx.stroke();

  ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('🎰 カジノ', px + pw / 2, py + 10);
  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(200,200,200,0.6)';
  ctx.fillText(`所持金: ${c.player.gold}G`, px + pw / 2, py + 30);
  ctx.strokeStyle = 'rgba(251,191,36,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px+12, py+48); ctx.lineTo(px+pw-12, py+48); ctx.stroke();

  // ── モード選択 ──────────────────────────────
  if (c.casinoMode === 'select') {
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#c4b5fd';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ゲームを選んでください', px + pw / 2, py + 80);

    const btnW = 140, btnH = 80, gap = 20;
    const totalW = btnW * 3 + gap * 2;
    const bx0 = px + (pw - totalW) / 2;
    const by  = py + 120;
    const items = [
      { label: '🃏 BJ',       sub: '21に近い方が勝ち' },
      { label: '🎡 ルーレット', sub: '赤黒 or 数字に賭ける' },
      { label: '🎲 チンチロ',  sub: 'サイコロ3個で役を作る' },
    ];
    items.forEach((item, i) => {
      const bx = bx0 + i * (btnW + gap);
      const sel = c.casinoCursor === i;
      roundRect(ctx, bx, by, btnW, btnH, 8);
      ctx.fillStyle = sel ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)'; ctx.fill();
      ctx.strokeStyle = sel ? '#fbbf24' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = sel ? 2 : 1; ctx.stroke();
      ctx.font = `bold 13px monospace`; ctx.fillStyle = sel ? '#fbbf24' : '#e2e8f0';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(item.label, bx + btnW / 2, by + btnH / 2 - 10);
      ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(180,180,180,0.7)';
      ctx.fillText(item.sub, bx + btnW / 2, by + btnH / 2 + 14);
    });

    ctx.font = '10px monospace'; ctx.fillStyle = '#4ade80';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('[←→] 選択   [E] 決定', px + pw / 2, py + 270);

  // ── ブラックジャック ─────────────────────────
  } else if (c.casinoMode === 'bj') {
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('🃏 ブラックジャック', px + pw / 2, py + 55);

    if (c.bjPhase === 'bet') {
      ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#c4b5fd';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ベット額を設定してください', px + pw / 2, py + 105);
      ctx.font = 'bold 42px monospace'; ctx.fillStyle = '#fbbf24';
      ctx.fillText(`${c.bjBet}G`, px + pw / 2, py + 165);
      ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(200,200,200,0.6)';
      ctx.fillText('↑↓ ±5G    ←→ ±50G', px + pw / 2, py + 215);
      if (c.player.gold >= 5) {
        ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#4ade80';
        ctx.fillText('[E] ゲーム開始  (手持ち: ' + c.player.gold + 'G)', px + pw / 2, py + 252);
      } else {
        ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#f87171';
        ctx.fillText('所持金が足りません（最低 5G 必要）', px + pw / 2, py + 252);
      }
      ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(150,150,150,0.5)';
      ctx.fillText('勝利: ×2  BJ: ×2.5  引分: 返却  敗北: 没収', px + pw / 2, py + 310);
    } else {
      const cardW = 48, cardH = 68, gap = 8;
      ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const dv = c.bjPhase === 'play' ? '?' : bjHandValue(c.bjDealerHand);
      ctx.fillText(`ディーラー  ${dv}`, px + 24, py + 72);
      c.bjDealerHand.forEach((card, i) => {
        const hidden = c.bjPhase === 'play' && i === 1;
        drawCard(ctx, px + 24 + i * (cardW + gap), py + 90, cardW, cardH, hidden ? null : card);
      });
      const pv = bjHandValue(c.bjHand);
      ctx.fillStyle = pv > 21 ? '#f87171' : '#c4b5fd';
      ctx.fillText(`あなた  ${pv}`, px + 24, py + 200);
      c.bjHand.forEach((card, i) => {
        drawCard(ctx, px + 24 + i * (cardW + gap), py + 218, cardW, cardH, card);
      });
      if (c.bjPhase === 'play') {
        ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#4ade80';
        ctx.textAlign = 'center';
        ctx.fillText('[H / ←]  ヒット', px + pw / 2, py + 335);
        ctx.fillStyle = '#60a5fa';
        ctx.fillText('[S / → / Space]  スタンド', px + pw / 2, py + 358);
      } else {
        const col = c.bjResult === 'lose' ? '#f87171' : c.bjResult === 'push' ? '#94a3b8' : '#fbbf24';
        ctx.font = 'bold 18px monospace'; ctx.fillStyle = col; ctx.textAlign = 'center';
        ctx.fillText(c.bjMsg, px + pw / 2, py + 338);
        ctx.font = '10px monospace'; ctx.fillStyle = '#c4b5fd';
        ctx.fillText('[E / Space] もう一度', px + pw / 2, py + 368);
      }
    }

  // ── ルーレット ──────────────────────────────
  } else if (c.casinoMode === 'roulette') {
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('🎡 ルーレット', px + pw / 2, py + 55);

    // ホイール描画
    const cx = px + pw / 2, cy = py + 195, R = 90;
    const nums = Array.from({length: 37}, (_, i) => i);
    nums.forEach((n, i) => {
      const a0 = c.rlSpinAngle + (i / 37) * Math.PI * 2;
      const a1 = c.rlSpinAngle + ((i + 1) / 37) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a1);
      ctx.closePath();
      ctx.fillStyle = n === 0 ? '#16a34a' : RL_RED.has(n) ? '#dc2626' : '#1e1e1e';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,0,0.3)'; ctx.lineWidth = 0.5; ctx.stroke();
      // 数字ラベル
      const am = c.rlSpinAngle + ((i + 0.5) / 37) * Math.PI * 2;
      const lx = cx + Math.cos(am) * R * 0.72;
      const ly = cy + Math.sin(am) * R * 0.72;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(am + Math.PI / 2);
      ctx.font = '6px monospace'; ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
    });
    // 外枠
    ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.stroke();
    // 中心
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24'; ctx.fill();
    // ポインタ（上部固定）
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - R - 10);
    ctx.lineTo(cx + 8, cy - R - 10);
    ctx.lineTo(cx,     cy - R + 2);
    ctx.closePath();
    ctx.fillStyle = '#fbbf24'; ctx.fill();

    if (c.rlPhase === 'bet') {
      // ベットタイプ選択
      const BET_TYPES: RlBetType[] = ['red','black','odd','even','low','high','number'];
      const BET_LABEL: Record<RlBetType, string> = { red:'🔴赤', black:'⚫黒', odd:'奇数', even:'偶数', low:'1-18', high:'19-36', number:`数字` };
      const BET_PAYOUT: Record<RlBetType, string> = { red:'×2', black:'×2', odd:'×2', even:'×2', low:'×2', high:'×2', number:'×36' };
      const bw = 58, bh = 30, bgap = 4;
      const totalBW = BET_TYPES.length * bw + (BET_TYPES.length - 1) * bgap;
      const bbx = px + (pw - totalBW) / 2;
      const bby = py + 305;
      BET_TYPES.forEach((bt, i) => {
        const bx = bbx + i * (bw + bgap);
        const sel = c.rlBetType === bt;
        roundRect(ctx, bx, bby, bw, bh, 4);
        ctx.fillStyle = sel ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.06)'; ctx.fill();
        ctx.strokeStyle = sel ? '#fbbf24' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = sel ? 1.5 : 1; ctx.stroke();
        ctx.font = `bold 9px monospace`; ctx.fillStyle = sel ? '#fbbf24' : '#e2e8f0';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(BET_LABEL[bt], bx + bw / 2, bby + bh / 2 - 6);
        ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(180,220,180,0.7)';
        ctx.fillText(BET_PAYOUT[bt], bx + bw / 2, bby + bh / 2 + 7);
      });

      // 数字選択 or ベット額
      if (c.rlBetType === 'number') {
        ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`数字: ${c.rlNumber}番`, px + pw / 2, py + 360);
        ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(200,200,200,0.5)';
        ctx.fillText('↑↓ 数字変更', px + pw / 2, py + 380);
      }
      ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`ベット: ${c.rlBet}G`, px + pw / 2, py + (c.rlBetType === 'number' ? 400 : 360));
      ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(200,200,200,0.5)';
      ctx.fillText('←→ ベット種変更  ↑↓ ±5G  Q/Z ±50G  [E] スタート', px + pw / 2, py + 420);

    } else if (c.rlPhase === 'spin') {
      ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('スピン中…', px + pw / 2, py + 330);

    } else if (c.rlPhase === 'result') {
      const n = c.rlResult;
      const nColor = n === 0 ? '#4ade80' : RL_RED.has(n) ? '#f87171' : '#94a3b8';
      ctx.font = 'bold 28px monospace'; ctx.fillStyle = nColor;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${n}`, cx, cy);
      const won = c.rlMsg.includes('当選');
      ctx.font = 'bold 14px monospace'; ctx.fillStyle = won ? '#fbbf24' : '#f87171';
      ctx.fillText(c.rlMsg, px + pw / 2, py + 335);
      ctx.font = '10px monospace'; ctx.fillStyle = '#c4b5fd';
      ctx.fillText('[E / Space] もう一度', px + pw / 2, py + 360);
    }

  // ── チンチロ ──────────────────────────────────
  } else if (c.casinoMode === 'chinchiro') {
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('🎲 チンチロ', px + pw / 2, py + 55);

    // サイコロ描画ヘルパー
    const drawDice = (dice: number[], label: string, labelColor: string, startX: number, startY: number) => {
      const DS = 60, DG = 12;
      ctx.font = 'bold 10px monospace'; ctx.fillStyle = labelColor;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(label, startX, startY - 16);
      dice.forEach((v, i) => {
        const dx = startX + i * (DS + DG);
        const dy = startY;
        roundRect(ctx, dx, dy, DS, DS, 8);
        ctx.fillStyle = '#f8f8f2'; ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.stroke();
        // ドット
        ctx.fillStyle = '#1a1a1a';
        const dotsMap: Record<number, number[][]> = {
          1: [[0,0]],
          2: [[-1,-1],[1,1]],
          3: [[-1,-1],[0,0],[1,1]],
          4: [[-1,-1],[1,-1],[-1,1],[1,1]],
          5: [[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],
          6: [[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]],
        };
        const dots = dotsMap[v] ?? [];
        const cx2 = dx + DS / 2, cy2 = dy + DS / 2, r = DS * 0.12, sp = DS * 0.26;
        dots.forEach(([ox, oy]) => {
          ctx.beginPath();
          ctx.arc(cx2 + ox * sp, cy2 + oy * sp, r, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    };

    if (c.ccPhase === 'bet') {
      ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#c4b5fd';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ベット額を設定してください', px + pw / 2, py + 110);
      ctx.font = 'bold 42px monospace'; ctx.fillStyle = '#fbbf24';
      ctx.fillText(`${c.ccBet}G`, px + pw / 2, py + 170);
      ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(200,200,200,0.6)';
      ctx.fillText('↑↓ ±5G    ←→ ±50G', px + pw / 2, py + 218);
      if (c.player.gold >= 5) {
        ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#4ade80';
        ctx.fillText('[E] ゲーム開始  (手持ち: ' + c.player.gold + 'G)', px + pw / 2, py + 255);
      } else {
        ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#f87171';
        ctx.fillText('所持金が足りません（最低 5G 必要）', px + pw / 2, py + 255);
      }
      ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(150,150,150,0.5)';
      ctx.fillText('ピンゾロ×5  シゴロ×3  ゾロ目×3  目あり×2  ヒフミ負け', px + pw / 2, py + 310);

    } else if (c.ccPhase === 'player_roll' || c.ccPhase === 'dealer_roll' || c.ccPhase === 'result') {
      const diceStartX = px + (pw - (60 * 3 + 12 * 2)) / 2;
      drawDice(c.ccPlayerDice, `あなた（${c.ccPlayerRolls}/3回目）`, '#c4b5fd', diceStartX, py + 100);

      const pEv = ccEval(c.ccPlayerDice);
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = pEv.rank < 0 ? '#f87171' : pEv.rank > 1 ? '#fbbf24' : '#86efac';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(ccRankLabel(pEv), px + pw / 2, py + 185);

      if (c.ccPhase === 'result') {
        drawDice(c.ccDealerDice, 'ディーラー', '#94a3b8', diceStartX, py + 255);
        const dEv = ccEval(c.ccDealerDice);
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = dEv.rank < 0 ? '#f87171' : dEv.rank > 1 ? '#fbbf24' : '#86efac';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(ccRankLabel(dEv), px + pw / 2, py + 340);

        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = c.ccWin === true ? '#fbbf24' : c.ccWin === false ? '#f87171' : '#94a3b8';
        ctx.fillText(c.ccMsg, px + pw / 2, py + 370);
        ctx.font = '10px monospace'; ctx.fillStyle = '#c4b5fd';
        ctx.fillText('[E / Space] もう一度', px + pw / 2, py + 398);
      } else {
        const pEv2 = ccEval(c.ccPlayerDice);
        const canReroll = pEv2.rank === 0 && c.ccPlayerRolls < 3;
        const hint = canReroll
          ? `[E/Space] 振り直す（あと${3 - c.ccPlayerRolls}回）`
          : '[E/Space] ディーラーと勝負';
        ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#4ade80';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(hint, px + pw / 2, py + 215);
      }
    }
  }

  ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(150,150,150,0.4)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  const escLabel = c.casinoMode === 'select' ? '[Esc / B] 閉じる' : '[Esc / B] 戻る';
  ctx.fillText(escLabel, px + pw / 2, py + ph - 6);
  ctx.restore();
}

// ── drawLoan ──────────────────────────────────

export function drawLoan(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  c: LoanContext,
): void {
  ctx.save();
  const pw = 440, ph = c.loanRepayMode ? 280 : 390;
  const px = (W - pw) / 2, py = (H - ph) / 2;

  // 背景
  ctx.fillStyle = 'rgba(10,3,28,0.97)';
  roundRect(ctx, px, py, pw, ph, 10); ctx.fill();
  ctx.strokeStyle = c.loanQuestActive ? 'rgba(74,222,128,0.7)' : c.loanDebt > 0 ? 'rgba(239,68,68,0.7)' : 'rgba(180,83,9,0.7)';
  ctx.lineWidth = 2; roundRect(ctx, px, py, pw, ph, 10); ctx.stroke();

  // タイトル
  ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = c.loanDebt > 0 ? '#f87171' : '#fbbf24';
  ctx.fillText('💸 金貸し', px + pw / 2, py + 28);

  // 現在の借金
  ctx.font = '13px monospace'; ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`現在の借金: ${c.loanDebt > 0 ? c.loanDebt + 'G' : 'なし'}`, px + pw / 2, py + 55);

  if (c.loanRepayMode) {
    // ── 返済額選択モード ──
    ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(248,113,113,0.7)';
    ctx.fillText('返済額を選択してください', px + pw / 2, py + 78);

    ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#86efac';
    ctx.fillText('[←→] 移動  [Enter/R] 決定  [Esc] キャンセル', px + pw / 2, py + 100);

    const btnW = 68, btnH = 38, btnGap = 8;
    const totalW = REPAY_AMOUNTS.length * btnW + (REPAY_AMOUNTS.length - 1) * btnGap;
    const bx0 = px + (pw - totalW) / 2;
    const by0 = py + 118;

    REPAY_AMOUNTS.forEach((amt, i) => {
      const bx = bx0 + i * (btnW + btnGap);
      const sel = i === c.loanRepayCursor;
      const label = amt === -1 ? '全額' : `${amt}G`;
      const canAfford = amt === -1 ? c.player.gold > 0 : c.player.gold >= amt;
      ctx.fillStyle = sel ? '#166534' : 'rgba(22,101,52,0.25)';
      roundRect(ctx, bx, by0, btnW, btnH, 6); ctx.fill();
      ctx.strokeStyle = sel ? '#4ade80' : canAfford ? 'rgba(74,222,128,0.3)' : 'rgba(107,114,128,0.3)';
      ctx.lineWidth = sel ? 2 : 1; roundRect(ctx, bx, by0, btnW, btnH, 6); ctx.stroke();
      ctx.font = `bold ${sel ? 13 : 11}px monospace`;
      ctx.fillStyle = sel ? '#fff' : canAfford ? '#86efac' : '#6b7280';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + btnW / 2, by0 + btnH / 2);
    });

    ctx.font = '11px monospace'; ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`所持金: ${c.player.gold}G`, px + pw / 2, py + 200);

    ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(156,163,175,0.5)';
    ctx.fillText('[Esc] 戻る', px + pw / 2, py + ph - 10);
    ctx.restore();
    return;
  }

  // ── 通常モード ──

  // 注記
  ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(248,113,113,0.7)';
  ctx.fillText(`※ フロアごとに利息 ${Math.round(LOAN_INTEREST * 100)}% 加算。返せない場合は借金取りが来る。`, px + pw / 2, py + 78);

  // 借入額ボタン
  ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#c4b5fd';
  ctx.fillText('借入額を選択  [←→] 移動  [Enter/E] 借りる', px + pw / 2, py + 108);

  const btnW = 64, btnH = 36, btnGap = 8;
  const totalW = LOAN_AMOUNTS.length * btnW + (LOAN_AMOUNTS.length - 1) * btnGap;
  const bx0 = px + (pw - totalW) / 2;
  const by0 = py + 124;

  LOAN_AMOUNTS.forEach((amt, i) => {
    const bx = bx0 + i * (btnW + btnGap);
    const sel = i === c.loanCursor;
    ctx.fillStyle = sel ? '#7c3aed' : 'rgba(91,33,182,0.3)';
    roundRect(ctx, bx, by0, btnW, btnH, 6); ctx.fill();
    ctx.strokeStyle = sel ? '#c4b5fd' : 'rgba(167,139,250,0.3)';
    ctx.lineWidth = sel ? 2 : 1; roundRect(ctx, bx, by0, btnW, btnH, 6); ctx.stroke();
    ctx.font = `bold ${sel ? 13 : 11}px monospace`;
    ctx.fillStyle = sel ? '#fff' : '#c4b5fd';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${amt}G`, bx + btnW / 2, by0 + btnH / 2);
  });

  // 仕切り線
  const midY = by0 + btnH + 16;
  ctx.strokeStyle = 'rgba(91,33,182,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + 16, midY); ctx.lineTo(px + pw - 16, midY); ctx.stroke();

  // 返済セクション
  if (c.loanDebt > 0) {
    const canPay = c.player.gold > 0;
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = canPay ? '#4ade80' : '#6b7280';
    ctx.fillText(
      canPay ? `[R] 返済する  (所持金: ${c.player.gold}G)` : '[R] 返済する  (所持金不足)',
      px + pw / 2, midY + 20
    );

    // 宝探し依頼セクション
    const divY = midY + 38;
    ctx.strokeStyle = 'rgba(91,33,182,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px + 16, divY); ctx.lineTo(px + pw - 16, divY); ctx.stroke();

    if (c.loanQuestActive) {
      // 依頼中表示
      ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#4ade80';
      ctx.fillText('🗺️ 宝探し依頼中', px + pw / 2, divY + 22);
      ctx.font = '10px monospace'; ctx.fillStyle = '#86efac';
      ctx.fillText(`${LOAN_QUEST_FLOORS}フロア以内のお宝が借金返済に充てられます`, px + pw / 2, divY + 42);
      ctx.fillStyle = 'rgba(74,222,128,0.6)';
      ctx.fillText('借金取りは猶予中です', px + pw / 2, divY + 60);
    } else {
      ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#fde68a';
      ctx.fillText('[Q] 宝探し依頼を受ける', px + pw / 2, divY + 22);
      ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(253,230,138,0.65)';
      ctx.fillText(`→ ${LOAN_QUEST_FLOORS}フロア以内のお宝が借金返済に充てられる`, px + pw / 2, divY + 42);
      ctx.fillStyle = 'rgba(253,230,138,0.45)';
      ctx.fillText('（依頼中は借金取りが来ない）', px + pw / 2, divY + 60);
    }
  }

  // プレイヤー所持金
  ctx.font = '11px monospace'; ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`所持金: ${c.player.gold}G`, px + pw / 2, py + ph - 28);

  // フッター
  ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(156,163,175,0.5)';
  ctx.fillText('[B / Esc] 閉じる', px + pw / 2, py + ph - 10);
  ctx.restore();
}
