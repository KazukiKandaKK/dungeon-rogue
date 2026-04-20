// ─────────────────────────────────────────────
// game-context.ts  ゲーム全状態の型定義
//
// main.js のグローバル let 変数をすべて型付けする。
// 現段階は型定義のみ。関数の移行が進むにつれて
// 実体 (GameContext クラス) に育てていく予定。
// ─────────────────────────────────────────────

// ── 画面状態（gameState 変数） ────────────────────

export type GameState =
  | 'LOADING'
  | 'TITLE'
  | 'SAVE_SLOT'
  | 'CHAR_CREATE'
  | 'CLASS_SELECT'
  | 'BUILD_SELECT'
  | 'PLAYER_TURN'
  | 'ENEMY_TURN'
  | 'PLAYER_WIN'
  | 'PLAYER_DEAD'
  | 'DUNGEON_CLEAR'
  | 'GAME_OVER';

export type GamePhase = 'BASE' | 'DUNGEON';
export type SaveSlotMode = 'load' | 'save';

// ── カジノ関連 ────────────────────────────────

export type CasinoMode = 'select' | 'bj' | 'roulette' | 'chinchiro' | 'slot';
export type BjPhase    = 'bet' | 'play' | 'result';
export type BjResult   = 'win' | 'lose' | 'push' | 'blackjack' | '';
export type RlPhase    = 'bet' | 'spin' | 'result';
export type RlBetType  = 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' | 'number';
export type CcPhase    = 'bet' | 'player_roll' | 'dealer_roll' | 'result';
export type SlPhase    = 'bet' | 'spin' | 'result';

export interface BlackjackCard {
  rank:  string;
  suit:  string;
  value: number;
}

// ── アニメーション・エフェクト ─────────────────

export interface Arrow {
  wx:       number;
  wy:       number;
  twx:      number;
  twy:      number;
  progress: number;
  color:    string;
}

export interface AoeFlash {
  tx:    number;
  ty:    number;
  alpha: number;
  color: string;
}

export interface FloatingText {
  text:    string;
  x:       number;
  y:       number;
  alpha:   number;
  scale:   number;
  color:   string;
  life:    number;
  maxLife: number;
  big?:    boolean;
}

// ── フロアオブジェクト ────────────────────────

export interface FloorItem {
  tx:   number;
  ty:   number;
  item: Record<string, unknown>;
}

export interface FloorChest {
  tx:     number;
  ty:     number;
  opened: boolean;
}

export interface ShopEntry {
  itemId: string;
  price:  number;
  item:   Record<string, unknown>;
}

export interface StallEntry {
  item:  Record<string, unknown>;
  price: number;
}

export interface BaseShopEntry {
  itemId: string;
  price:  number;
  item:   Record<string, unknown>;
  tier:   number;
}

// ── 画面遷移 ──────────────────────────────────

export type TransPhase = 'none' | 'fade-out' | 'fade-in';
