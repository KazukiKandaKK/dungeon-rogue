import { RL_RED } from '../core/game-constants.js';

// ---------------------------------------------------------------------------
// Shared interfaces
// ---------------------------------------------------------------------------

export interface BJCard { rank: string; suit: string; value: number; }
export type CCDice = [number, number, number];
export interface CCResult { rank: number; point: number; }

export interface FloatingTextEntry {
  text: string; x: number; y: number;
  alpha: number; scale: number; color: string;
  life: number; maxLife: number;
}

export interface CasinoPlayerRef {
  gold: number;
  screenPos(camOffX: number, camOffY: number): { sx: number; sy: number };
}

// Mutable BJ state - functions mutate this in place
export interface BJState {
  bjPhase: string;
  bjResult: string;
  bjMsg: string;
  bjBet: number;
  bjDeck: BJCard[];
  bjHand: BJCard[];
  bjDealerHand: BJCard[];
}

export interface BJContext extends BJState {
  player: CasinoPlayerRef;
  camOffX: number;
  camOffY: number;
  onFloatingText: (t: FloatingTextEntry) => void;
}

// Mutable RL state
export interface RLState {
  rlResult: number;
  rlBetType: string;
  rlBet: number;
  rlNumber: number;
  rlMsg: string;
}

export interface RLContext extends RLState {
  player: CasinoPlayerRef;
  camOffX: number;
  camOffY: number;
  onFloatingText: (t: FloatingTextEntry) => void;
  logger: { add(msg: string, type?: string): void };
}

// Mutable CC state
export interface CCState {
  ccPhase: string;
  ccBet: number;
  ccPlayerDice: CCDice;
  ccDealerDice: CCDice;
  ccWin: boolean | null;
  ccMsg: string;
}

export interface CCContext extends CCState {
  player: CasinoPlayerRef;
  camOffX: number;
  camOffY: number;
  onFloatingText: (t: FloatingTextEntry) => void;
  logger: { add(msg: string, type?: string): void };
}

// ---------------------------------------------------------------------------
// Blackjack constants
// ---------------------------------------------------------------------------

const BJ_RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const BJ_SUITS = ['♠','♥','♦','♣'];

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

export function bjNewDeck(): BJCard[] {
  const deck: BJCard[] = [];
  for (const suit of BJ_SUITS) {
    for (const rank of BJ_RANKS) {
      const value = rank === 'A' ? 11 : isNaN(Number(rank)) ? 10 : Number(rank);
      deck.push({ rank, suit, value });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function bjHandValue(hand: BJCard[]): number {
  let total = hand.reduce((s, c) => s + c.value, 0);
  let aces  = hand.filter(c => c.rank === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

export function ccRoll(): CCDice {
  return [1, 2, 3].map(() => Math.ceil(Math.random() * 6)) as CCDice;
}

export function ccEval(dice: CCDice): CCResult {
  const d = [...dice].sort((a, b) => a - b) as CCDice;
  if (d[0] === 1 && d[1] === 1 && d[2] === 1) return { rank: 100, point: 1 };
  if (d[0] === 4 && d[1] === 5 && d[2] === 6) return { rank: 50,  point: 6 };
  if (d[0] === 1 && d[1] === 2 && d[2] === 3) return { rank: -1,  point: 0 };
  if (d[0] === d[1] && d[1] === d[2])          return { rank: 10,  point: d[0] };
  if (d[0] === d[1])                            return { rank: 1,   point: d[2] };
  if (d[1] === d[2])                            return { rank: 1,   point: d[0] };
  if (d[0] === d[2])                            return { rank: 1,   point: d[1] };
  return { rank: 0, point: 0 };
}

export function ccCompare(p: CCResult, d: CCResult): -1 | 0 | 1 {
  if (p.rank === 100) return -1;
  if (d.rank === 100) return 1;
  if (p.rank === 50)  return -1;
  if (d.rank === 50)  return 1;
  if (p.rank === -1)  return 1;
  if (d.rank === -1)  return -1;
  if (p.rank === 10 && d.rank === 10) {
    if (p.point > d.point) return -1;
    if (p.point < d.point) return 1;
    return 0;
  }
  if (p.rank === 10) return -1;
  if (d.rank === 10) return 1;
  if (p.rank === 1 && d.rank === 1) {
    if (p.point > d.point) return -1;
    if (p.point < d.point) return 1;
    return 0;
  }
  if (p.rank === 1) return -1;
  if (d.rank === 1) return 1;
  return 0;
}

export function ccRankLabel(ev: CCResult): string {
  if (ev.rank === 100) return 'ピンゾロ！';
  if (ev.rank === 50)  return 'シゴロ！';
  if (ev.rank === -1)  return 'ヒフミ…';
  if (ev.rank === 10)  return `ゾロ目(${ev.point})`;
  if (ev.rank === 1)   return `${ev.point}の目`;
  return '役なし';
}

// ---------------------------------------------------------------------------
// Stateful functions (mutate context bag)
// ---------------------------------------------------------------------------

export function bjFinish(ctx: BJContext, result: 'win' | 'lose' | 'push' | 'blackjack'): void {
  ctx.bjPhase  = 'result';
  ctx.bjResult = result;

  const payoutMap: Record<string, number> = {
    win:       ctx.bjBet * 2,
    blackjack: Math.floor(ctx.bjBet * 2.5),
    push:      ctx.bjBet,
    lose:      0,
  };
  const payout = payoutMap[result] ?? 0;
  ctx.player.gold = Math.max(0, ctx.player.gold + payout);

  const winGain: Record<string, number> = {
    win:       ctx.bjBet,
    blackjack: Math.floor(ctx.bjBet * 1.5),
  };
  const msgs: Record<string, string> = {
    win:       `勝利！ +${ctx.bjBet}G 獲得！（${ctx.bjBet * 2}G 返還）`,
    blackjack: `ブラックジャック！ +${Math.floor(ctx.bjBet * 1.5)}G！（${Math.floor(ctx.bjBet * 2.5)}G 返還）`,
    push:      `引き分け。ベット返却。 (${ctx.bjBet}G 戻し)`,
    lose:      `敗北… ${ctx.bjBet}G を失った`,
  };
  ctx.bjMsg = msgs[result] ?? '';

  const color = result === 'lose' ? '#f87171' : '#fbbf24';
  const sign  = result === 'lose'
    ? `-${ctx.bjBet}G`
    : result === 'push'
      ? '±0G'
      : `+${winGain[result]}G`;

  if (result !== 'push') {
    const { sx, sy } = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
    ctx.onFloatingText({ text: sign, x: sx, y: sy - 40, alpha: 1, scale: 1, color, life: 2.0, maxLife: 2.0 });
  }
}

export function bjDeal(ctx: BJContext): void {
  ctx.bjDeck       = bjNewDeck();
  ctx.bjHand       = [ctx.bjDeck.pop()!, ctx.bjDeck.pop()!];
  ctx.bjDealerHand = [ctx.bjDeck.pop()!, ctx.bjDeck.pop()!];
  ctx.bjPhase      = 'play';
  if (bjHandValue(ctx.bjHand) === 21) bjFinish(ctx, 'blackjack');
}

export function bjDealerPlay(ctx: BJContext): void {
  while (bjHandValue(ctx.bjDealerHand) < 17) ctx.bjDealerHand.push(ctx.bjDeck.pop()!);
  const pv = bjHandValue(ctx.bjHand);
  const dv = bjHandValue(ctx.bjDealerHand);
  if (dv > 21 || pv > dv)  bjFinish(ctx, 'win');
  else if (pv === dv)       bjFinish(ctx, 'push');
  else                      bjFinish(ctx, 'lose');
}

export function rlFinish(ctx: RLContext): void {
  const n       = ctx.rlResult;
  const isRed   = RL_RED.has(n);
  const isBlack = n > 0 && !isRed;
  const isOdd   = n > 0 && n % 2 === 1;
  const isEven  = n > 0 && n % 2 === 0;
  const isLow   = n >= 1  && n <= 18;
  const isHigh  = n >= 19 && n <= 36;

  let won    = false;
  let payout = 0;
  switch (ctx.rlBetType) {
    case 'red':    won = isRed;              payout = ctx.rlBet * 2;  break;
    case 'black':  won = isBlack;            payout = ctx.rlBet * 2;  break;
    case 'odd':    won = isOdd;              payout = ctx.rlBet * 2;  break;
    case 'even':   won = isEven;             payout = ctx.rlBet * 2;  break;
    case 'low':    won = isLow;              payout = ctx.rlBet * 2;  break;
    case 'high':   won = isHigh;             payout = ctx.rlBet * 2;  break;
    case 'number': won = n === ctx.rlNumber; payout = ctx.rlBet * 36; break;
  }

  const color = n === 0 ? '#4ade80' : RL_RED.has(n) ? '#f87171' : '#94a3b8';

  if (won) {
    ctx.player.gold += payout;
    const gain = payout - ctx.rlBet;
    ctx.rlMsg = `当選！ ${n}番（${isRed ? '赤' : '黒'}）  +${gain}G 獲得！`;
    ctx.logger.add(`🎡 ルーレット 当選！ ${n}番  +${gain}G`, 'warn');
    const { sx, sy } = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
    ctx.onFloatingText({ text: `+${gain}G`, x: sx, y: sy - 40, alpha: 1, scale: 1, color: '#fbbf24', life: 2.0, maxLife: 2.0 });
  } else {
    ctx.rlMsg = `${n}番（${n === 0 ? '0' : isRed ? '赤' : '黒'}）  外れ… -${ctx.rlBet}G`;
    ctx.logger.add(`🎡 ルーレット 外れ。${n}番  -${ctx.rlBet}G`, 'info');
    const { sx, sy } = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
    ctx.onFloatingText({ text: `-${ctx.rlBet}G`, x: sx, y: sy - 40, alpha: 1, scale: 1, color: '#f87171', life: 2.0, maxLife: 2.0 });
  }
  // color is referenced in the original for potential use; suppress unused-var warning via void
  void color;
}

export function ccFinish(ctx: CCContext): void {
  const pEv = ccEval(ctx.ccPlayerDice);
  const dEv = ccEval(ctx.ccDealerDice);
  const cmp = ccCompare(pEv, dEv);

  let payout = 0;
  if (cmp < 0) {
    const mult = pEv.rank === 100 ? 5 : pEv.rank === 50 ? 3 : pEv.rank === 10 ? 3 : 2;
    payout = ctx.ccBet * mult;
    ctx.player.gold += payout;
    ctx.ccWin = true;
    ctx.ccMsg = `あなたの勝ち！ +${payout - ctx.ccBet}G（×${mult}）`;
    ctx.logger.add(`🎲 チンチロ 勝利！ +${payout - ctx.ccBet}G`, 'warn');
    const { sx, sy } = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
    ctx.onFloatingText({ text: `+${payout - ctx.ccBet}G`, x: sx, y: sy - 40, alpha: 1, scale: 1, color: '#fbbf24', life: 2.0, maxLife: 2.0 });
  } else if (cmp > 0) {
    ctx.ccWin = false;
    ctx.ccMsg = `ディーラーの勝ち… -${ctx.ccBet}G`;
    ctx.logger.add(`🎲 チンチロ 敗北。 -${ctx.ccBet}G`, 'info');
    const { sx, sy } = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
    ctx.onFloatingText({ text: `-${ctx.ccBet}G`, x: sx, y: sy - 40, alpha: 1, scale: 1, color: '#f87171', life: 2.0, maxLife: 2.0 });
  } else {
    ctx.player.gold += ctx.ccBet;
    ctx.ccWin = null;
    ctx.ccMsg = '引き分け。賭け金を返却。';
    ctx.logger.add('🎲 チンチロ 引き分け。', 'info');
  }
  ctx.ccPhase = 'result';
}
