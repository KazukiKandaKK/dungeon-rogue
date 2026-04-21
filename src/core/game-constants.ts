// ─────────────────────────────────────────────
// game-constants.ts  ゲーム定数（グローバル状態を持たない）
//
// main.js から段階的に移行した const 定義をすべてここに集約する。
// ─────────────────────────────────────────────

// ── キャンバス / マップ ──────────────────────────

export const CANVAS_W       = 1024;
export const CANVAS_H       = 720;
export const MAP_COLS       = 60;
export const MAP_ROWS       = 50;
export const ENEMY_COUNT    = 12;
export const MIN_SPAWN_DIST = 5;
/** フロアに最初から置かれるアイテム数 */
export const ITEM_PER_FLOOR = 4;
export const SAVE_SLOT_KEYS = ['dungeon_slot_0', 'dungeon_slot_1', 'dungeon_slot_2'] as const;

// ── 拠点マップ（統合フィールド 36×28） ─────────
//
// 北部：ダンジョン区（6ポータル）
// 中部：広場（モニュメント・噴水・酒場・行商人）
// 南部：商業/工房地区、裏路地、スポーン
// BASE と前線街を同一マップに統合したファンタジーシティ。

export const BASE_COLS  = 36;
export const BASE_ROWS  = 28;
export const BASE_SPAWN = { tx: 18, ty: 25 } as const;
export const BASE_CHEST_POS = { tx: 18, ty: 22 } as const;

export interface PortalDef {
  tx:        number;
  ty:        number;
  dungeonId: string;
}

/**
 * ダンジョン入口 6 基：
 *   北列 (y=3) … 通常4ダンジョン
 *   中列 (y=6) … 特殊2ポータル（ボスラッシュ／無限回廊）
 */
export const BASE_PORTALS: PortalDef[] = [
  { tx:  6, ty: 3, dungeonId: 'cave' },
  { tx: 13, ty: 3, dungeonId: 'goblin_nest' },
  { tx: 22, ty: 3, dungeonId: 'cursed_forest' },
  { tx: 29, ty: 3, dungeonId: 'abyss' },
  { tx: 13, ty: 6, dungeonId: 'boss_rush' },
  { tx: 22, ty: 6, dungeonId: 'infinite_abyss' },
];

/** 中央広場のモニュメント（装飾のみ） */
export const BASE_MONUMENT_POS = { tx: 17, ty: 10 } as const;

/** 酒場（中部西） */
export const BASE_TAVERN_POS = { tx:  5, ty: 10 } as const;
/** 流浪の行商人（中部東） */
export const BASE_TRADER_POS = { tx: 30, ty: 10 } as const;

/**
 * 施設（地区ごとに配置）:
 *   広場（中央 y=14-15）  : 冒険者ギルド受付・クエスト掲示板・魂の祠
 *   商業地区（西 y=18）    : ショップ・委託露店
 *   工房地区（東 y=18）    : 鍛冶屋・転職の祭壇
 *   裏路地（y=21）         : 金貸し・カジノ
 */
export const BASE_SHOP_POS      = { tx:  5, ty: 18 } as const;
export const BASE_STALL_POS     = { tx: 10, ty: 18 } as const;
export const BASE_CRAFT_POS     = { tx: 25, ty: 18 } as const;
export const BASE_RECLASS_POS   = { tx: 30, ty: 18 } as const;
export const BASE_LOAN_POS      = { tx:  4, ty: 21 } as const;
export const BASE_CASINO_POS    = { tx: 31, ty: 21 } as const;
export const BASE_SHRINE_POS    = { tx: 17, ty: 15 } as const;
export const BASE_QUEST_POS     = { tx: 13, ty: 15 } as const;
export const BASE_RECEPTION_POS = { tx: 21, ty: 15 } as const;

/** 中央噴水（2×2、通行不可） */
export const BASE_FOUNTAIN_POS = { tx: 17, ty: 12 } as const;

/** クラフト（武器合成）コスト：基礎 + 合成元合計 tier に比例 */
export const CRAFT_BASE_COST     = 120;
export const CRAFT_COST_PER_TIER = 80;

/** 転職コスト（レベルに比例） */
export const RECLASS_COST_PER_LV = 150;
/** 転職の最低コスト */
export const RECLASS_COST_MIN    = 300;

// ── ビルド定義 ────────────────────────────────

export interface BuildBonus {
  atkPerLv: number;
  defPerLv: number;
  hpPerLv:  number;
  mpPerLv:  number;
  spdEvery: number;
  lukEvery: number;
}

export interface BuildDef {
  id:    string;
  name:  string;
  icon:  string;
  color: string;
  desc:  string;
  bonus: BuildBonus;
}

export const BUILDS: Record<string, BuildDef> = {
  attacker: {
    id: 'attacker', name: 'アタッカー', icon: '⚔',
    color: '#ef4444', desc: 'ATKを重点強化。HPも安定して伸びる。',
    bonus: { atkPerLv: 2, defPerLv: 0, hpPerLv: 1, mpPerLv: 0, spdEvery: 0, lukEvery: 0 },
  },
  tank: {
    id: 'tank', name: 'タンク', icon: '🛡',
    color: '#3b82f6', desc: 'DEFとHPを重点強化。打たれ強さが光る。',
    bonus: { atkPerLv: 0, defPerLv: 2, hpPerLv: 2, mpPerLv: 0, spdEvery: 0, lukEvery: 0 },
  },
  speedster: {
    id: 'speedster', name: 'スピード', icon: '💨',
    color: '#fbbf24', desc: 'SPDを集中強化。ATKも伸び、連続攻撃・回避率が上がる。',
    bonus: { atkPerLv: 1, defPerLv: 0, hpPerLv: 1, mpPerLv: 0, spdEvery: 3, lukEvery: 0 },
  },
  lucky: {
    id: 'lucky', name: 'ラッキー', icon: '🍀',
    color: '#22c55e', desc: 'LUKを集中強化。クリティカル・レアドロップ・奇跡生存率UP。',
    bonus: { atkPerLv: 1, defPerLv: 0, hpPerLv: 1, mpPerLv: 1, spdEvery: 0, lukEvery: 2 },
  },
  mage_build: {
    id: 'mage_build', name: 'マジシャン', icon: '✨',
    color: '#a855f7', desc: 'MPを重点強化。ATKも伸び、魔法が存分に使える。',
    bonus: { atkPerLv: 1, defPerLv: 0, hpPerLv: 1, mpPerLv: 3, spdEvery: 0, lukEvery: 0 },
  },
  balanced: {
    id: 'balanced', name: 'バランス', icon: '⭐',
    color: '#94a3b8', desc: '全ステータスを均等に強化。弱点のない安定型。',
    bonus: { atkPerLv: 1, defPerLv: 1, hpPerLv: 1, mpPerLv: 1, spdEvery: 5, lukEvery: 5 },
  },
};

export const BUILD_IDS = Object.keys(BUILDS);

// ── 金貸し ────────────────────────────────────

/** 借入額の選択肢 */
export const LOAN_AMOUNTS: number[]  = [50, 100, 200, 500, 1000];
/** 返済額の選択肢（-1 = 全額返済） */
export const REPAY_AMOUNTS: number[] = [50, 100, 200, 500, -1];
/** フロアごとの利子率 */
export const LOAN_INTEREST     = 0.3;
/** 宝探し依頼の有効フロア数 */
export const LOAN_QUEST_FLOORS = 10;

// ── ルーレット ─────────────────────────────────

/** ルーレットの赤マス番号セット */
export const RL_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// ── 視野 ──────────────────────────────────────

export const VISION_RADIUS = 7;

// ── 増援・死神スポーン ─────────────────────────

/** 増援間隔（ターン数） */
export const WAVE_INTERVAL    = 25;
/** 第1警告ターン */
export const SHINIGAMI_WARN1  = 800;
/** 第2警告ターン */
export const SHINIGAMI_WARN2  = 900;
/** 最終警告ターン */
export const SHINIGAMI_WARN3  = 950;
/** 死神初回スポーンターン */
export const SHINIGAMI_SPAWN  = 1000;
/** 死神追加スポーン間隔 */
export const SHINIGAMI_RESPAWN = 200;

// ── インベントリ ──────────────────────────────

export const SLOTS      = ['weapon', 'head', 'chest', 'waist', 'legs', 'accessory'] as const;
export const SLOT_LABEL: Record<string, string> = {
  weapon: '武器', head: '頭', chest: '胸', waist: '腰', legs: '足', accessory: '装飾',
};
/** インベントリグリッド列数 */
export const INV_COLS = 8;

// ── 画面遷移フェード ──────────────────────────

export const FADE_OUT_SPEED = 3.0;
export const FADE_IN_SPEED  = 2.5;
