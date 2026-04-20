// ─────────────────────────────────────────────
// dungeon_defs.ts  ダンジョン定義
// ─────────────────────────────────────────────

import type { ThemeId } from './tiles.js';

/**
 * ボス封印の定義。
 * - 'guards'   : 護衛モブを count 体倒すと封印解除
 * - 'statues'  : 石像を count 体破壊すると封印解除
 * - 'key'      : フロア上に落ちている鍵を拾うと封印解除
 */
export interface BossSealDef {
  type:   'guards' | 'statues' | 'key';
  count?: number;     // guards / statues 数（key では無視）
  label:  string;     // 表示名（'封魔の結晶', '樹霊の鍵' など）
  spawnType?: string; // guards の場合の敵タイプ名（例: 'hobgoblin'）
}

export interface DungeonDef {
  id:             string;
  name:           string;
  emoji:          string;
  maxFloors:      number;
  theme:          ThemeId;
  enemyTypes:     string[];
  enemyCountBase: number;
  diffMult:       number;
  bossName:       string;
  /** ボス専用スプライト名（sprites にロードされているキー）。未指定なら既定 'boss'。 */
  bossSprite?:    string;
  color:          string;
  desc:           string;
  infinite?:      boolean;
  bossRush?:      boolean;
  /** 敵タイプごとの最低出現フロア。未指定なら 1。 */
  enemyMinFloor?: Record<string, number>;
  /** ボス封印（クイズに代わるゲームプレイ解除条件）。未指定なら封印なし。 */
  bossSeal?:      BossSealDef;
}

// ボスラッシュ専用ボス名（12 星座と対峙）
export const BOSS_RUSH_NAMES: string[] = [
  '♈ 白羊宮アリエス',   '♉ 金牛宮タウルス',     '♊ 双児宮ジェミニ',
  '♋ 巨蟹宮キャンサー', '♌ 獅子宮レオ',         '♍ 処女宮ヴィルゴ',
  '♎ 天秤宮リブラ',     '♏ 天蠍宮スコーピオン', '♐ 人馬宮サジタリウス',
  '♑ 磨羯宮カプリコーン', '♒ 宝瓶宮アクエリアス', '♓ 双魚宮ピスケス',
];

// 12 星座ボスの専用スプライト名（sprites にロードされているキー）
export const BOSS_RUSH_SPRITES: string[] = [
  'zodiac_aries',       'zodiac_taurus',        'zodiac_gemini',
  'zodiac_cancer',      'zodiac_leo',           'zodiac_virgo',
  'zodiac_libra',       'zodiac_scorpio',       'zodiac_sagittarius',
  'zodiac_capricorn',   'zodiac_aquarius',      'zodiac_pisces',
];

// ボスの種別 ID（bossVariant フィールドに格納し、AI が技プールを切り替える）
export const BOSS_RUSH_VARIANTS: string[] = [
  'aries',       'taurus',      'gemini',
  'cancer',      'leo',         'virgo',
  'libra',       'scorpio',     'sagittarius',
  'capricorn',   'aquarius',    'pisces',
];

// 各星座ボスが summon で呼び出す子分の種類（2〜3 体）
export const BOSS_SUMMON_TYPES: Record<string, string[]> = {
  aries:       ['goblin', 'goblin'],
  taurus:      ['orc', 'orc'],
  gemini:      ['wizard', 'wizard'],
  cancer:      ['rock_crab', 'rock_crab', 'rock_crab'],
  leo:         ['wolf', 'dire_wolf'],
  virgo:       ['ghost', 'ghost'],
  libra:       ['skeleton', 'skeleton'],
  scorpio:     ['poison_spider', 'poison_spider'],
  sagittarius: ['archer', 'skeleton_archer'],
  capricorn:   ['ice_elemental', 'ice_elemental'],
  aquarius:    ['ice_elemental', 'thunder_elemental'],
  pisces:      ['dark_slime', 'dark_slime'],
};

export const DUNGEONS: DungeonDef[] = [
  {
    id: 'cave',
    name: '初心者の洞窟',
    emoji: '🕳',
    maxFloors: 5,
    theme: 'dungeon',
    enemyTypes: ['slime', 'giant_rat', 'bat', 'kobold', 'goblin', 'cave_spider', 'skeleton', 'rock_crab', 'poison_slime'],
    enemyMinFloor: {
      // 1階: slime / giant_rat / bat / kobold / goblin (低HP・低ATK中心)
      cave_spider:  2,   // poison 攻撃あり
      poison_slime: 2,   // poison 攻撃あり
      skeleton:     3,   // DEF2 で前半は固い
      rock_crab:    4,   // DEF6 — 低ATK職だと貫通できない
    },
    enemyCountBase: 5,
    diffMult: 0.6,
    bossName: '巨大スライム',
    bossSprite: 'giant_slime',
    color: '#94a3b8',
    desc: '洞窟の基本モンスター。5階まで。初心者向け。',
    bossSeal: { type: 'statues', count: 2, label: '封魔の結晶' },
  },
  {
    id: 'goblin_nest',
    name: 'ゴブリンの巣',
    emoji: '👺',
    maxFloors: 8,
    theme: 'dungeon',
    enemyTypes: ['goblin', 'archer', 'hobgoblin', 'goblin_shaman', 'goblin_bomber', 'wolf', 'orc', 'gnoll', 'goblin_chief', 'bandit', 'skeleton_archer'],
    enemyMinFloor: {
      hobgoblin:       3,
      goblin_shaman:   3,
      goblin_bomber:   3,
      gnoll:           4,
      bandit:          4,
      skeleton_archer: 4,
      orc:             5,
      goblin_chief:    6,   // HP30/ATK8/DEF4 — 後半ボス前で
    },
    enemyCountBase: 10,
    diffMult: 1.0,
    bossName: 'ゴブリンキング',
    bossSprite: 'goblin_king',
    color: '#22c55e',
    desc: 'ゴブリン族の巣。8階まで。中級者向け。',
    bossSeal: { type: 'guards', count: 3, label: '護衛ゴブリン', spawnType: 'hobgoblin' },
  },
  {
    id: 'cursed_forest',
    name: '呪われた森',
    emoji: '🌲',
    maxFloors: 10,
    theme: 'forest',
    enemyTypes: ['zombie', 'ghost', 'forest_witch', 'werewolf', 'treant', 'poison_spider', 'giant_bat', 'skeleton_archer', 'dark_elf', 'shadow_assassin', 'cultist', 'dire_wolf', 'wraith'],
    enemyCountBase: 12,
    diffMult: 1.4,
    bossName: '呪いの樹霊',
    bossSprite: 'cursed_treant',
    color: '#4ade80',
    desc: '呪われた生き物が潜む森。10階まで。上級者向け。',
    bossSeal: { type: 'key', label: '樹霊の鍵' },
  },
  {
    id: 'abyss',
    name: '奈落の城',
    emoji: '🏰',
    maxFloors: 15,
    theme: 'dungeon',
    enemyTypes: ['death_knight', 'void_crawler', 'fire_elemental', 'ice_elemental', 'thunder_elemental', 'vampire', 'lich', 'soul_eater', 'void_stalker', 'iron_golem', 'nightmare', 'chaos_mage', 'stone_golem', 'gargoyle', 'dark_slime', 'sniper', 'crossbowman', 'demon'],
    enemyCountBase: 15,
    diffMult: 2.2,
    bossName: '深淵魔王',
    bossSprite: 'abyss_demon',
    color: '#f87171',
    desc: '最難関。強力な魔族と精霊が出現。15階まで。',
    bossSeal: { type: 'statues', count: 3, label: '封魔の祭壇' },
  },
  {
    id: 'boss_rush',
    name: '十二宮の試練',
    emoji: '✨',
    maxFloors: 12,
    theme: 'cosmic',
    enemyTypes: [],
    enemyCountBase: 0,
    diffMult: 1.0,
    bossRush: true,
    bossName: '黄道十二宮の守護者',
    color: '#f0abfc',
    desc: '12 星座の守護者と連戦。12 波クリアで天界の頂へ。',
  },
  {
    id: 'infinite_abyss',
    name: '奈落の底',
    emoji: '♾',
    maxFloors: 9999,
    infinite: true,       // 無限フロア
    theme: 'dungeon',
    enemyTypes: ['death_knight', 'void_crawler', 'fire_elemental', 'ice_elemental', 'thunder_elemental',
                 'vampire', 'lich', 'soul_eater', 'void_stalker', 'iron_golem', 'nightmare',
                 'chaos_mage', 'stone_golem', 'gargoyle', 'dark_slime', 'sniper', 'crossbowman',
                 'demon', 'goblin', 'archer', 'skeleton', 'skeleton_archer', 'zombie', 'wraith'],
    enemyCountBase: 12,
    diffMult: 1.0,        // フロアに応じて動的スケール
    bossName: '奈落の番人',
    bossSprite: 'abyss_warden',
    color: '#a855f7',
    desc: '終わりなき深淵。フロアが深くなるほど敵が強くなる。レジェンダリ装備が出やすい。',
    bossSeal: { type: 'guards', count: 3, label: '奈落の守護者', spawnType: 'wraith' },
  },
];
