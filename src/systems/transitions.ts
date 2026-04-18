// ─────────────────────────────────────────────
// transitions.ts  画面フェード遷移ロジック
//
// フェードアルファ値の更新（純粋計算）のみを担う。
// _doSwitch など state 変更を伴う処理は main.js 側が行う。
// ─────────────────────────────────────────────

import { FADE_OUT_SPEED, FADE_IN_SPEED } from '../core/game-constants.js';
import type { TransPhase } from '../core/game-context.js';

// ── 遷移状態（値オブジェクト） ─────────────────────

export interface TransitionState {
  phase: TransPhase;
  alpha: number;
}

// ── アルファ更新結果 ──────────────────────────────

export type TransitionTick =
  | { done: false; alpha: number; phase: TransPhase }
  | { done: true;  event: 'do-switch' | 'finish' };

/**
 * フレームごとにフェードアルファ値を更新する純粋関数。
 *
 * @param state  現在の遷移状態
 * @param dt     経過時間（秒）
 * @returns      更新結果。event='do-switch' のとき main.js が _doSwitch() を呼ぶ。
 *               event='finish' のとき gameState を 'PLAYER_TURN' に戻す。
 */
export function tickTransition(
  state: TransitionState,
  dt:    number,
): TransitionTick {
  if (state.phase === 'fade-out') {
    const alpha = Math.min(1, state.alpha + dt * FADE_OUT_SPEED);
    if (alpha >= 1) return { done: true, event: 'do-switch' };
    return { done: false, alpha, phase: 'fade-out' };
  }

  if (state.phase === 'fade-in') {
    const alpha = Math.max(0, state.alpha - dt * FADE_IN_SPEED);
    if (alpha <= 0) return { done: true, event: 'finish' };
    return { done: false, alpha, phase: 'fade-in' };
  }

  // 'none' の場合は何もしない
  return { done: false, alpha: state.alpha, phase: state.phase };
}
