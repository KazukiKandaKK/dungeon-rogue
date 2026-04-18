// ─────────────────────────────────────────────
// enemy.ts  Enemy クラス（ターン制・A* AI）
// ─────────────────────────────────────────────

import { Actor }      from './actor.js';
import { TILE_SIZE }  from '../world/tiles.js';
import { _drawHPBar } from './player.js';
import { findPath }   from '../world/astar.js';
import { randomDrop } from '../data/equipment.js';
import type { ItemDef }         from '../data/equipment.js';
import type { GameMap, SpriteManager, StatusEffectEntry } from '../types.js';

// ── 敵タイプ定義 ──────────────────────────────

interface EnemyTypeDef {
  name:         string;
  sprite:       string | null;
  maxHP:        number;
  atk:          number;
  def:          number;
  expValue:     number;
  detectRadius: number;
  color:        string;
  hpBarColor:   string;
  glowColor:    string;
  // オプションフラグ
  isRanged?:       boolean;
  preferRange?:    number;
  isBoss?:         boolean;
  isShinigami?:    boolean;
  isShopShinigami?: boolean;
  isDebtCollector?: boolean;
  projectileColor?: string;
  castTime?:       number;
  poisonAttack?:   boolean;
  lifeSteal?:      boolean;
  hpRegen?:        number;
  deathExplode?:   boolean;
  splitOnDeath?:   boolean;
  fastMove?:       boolean;
}

/** takeTurn() の返値型 */
export type TurnAction =
  | 'wait' | 'move' | 'attack' | 'rangedAttack' | 'casting'
  | 'areaAttack' | 'magicFire' | 'magicIce' | 'magicLightning';

const ENEMY_TYPES: Record<string, EnemyTypeDef> = {
  // ══ スライム系 ═══════════════════════════════════════
  slime: {
    name: 'スライム', sprite: 'slime',
    maxHP: 5, atk: 1, def: 0, expValue: 3, detectRadius: 4,
    color: '#38bdf8', hpBarColor: '#7dd3fc', glowColor: 'rgba(56,189,248,0.85)',
  },
  poison_slime: {
    name: '毒スライム', sprite: 'slime',
    maxHP: 8, atk: 2, def: 0, expValue: 6, detectRadius: 5,
    poisonAttack: true,
    color: '#4ade80', hpBarColor: '#86efac', glowColor: 'rgba(74,222,128,0.85)',
  },
  fire_slime: {
    name: '炎スライム', sprite: 'slime',
    maxHP: 7, atk: 4, def: 0, expValue: 8, detectRadius: 5,
    deathExplode: true,
    color: '#f97316', hpBarColor: '#fed7aa', glowColor: 'rgba(249,115,22,0.85)',
  },
  mega_slime: {
    name: 'メガスライム', sprite: 'slime',
    maxHP: 28, atk: 3, def: 3, expValue: 16, detectRadius: 4,
    splitOnDeath: true,
    color: '#0ea5e9', hpBarColor: '#bae6fd', glowColor: 'rgba(14,165,233,0.9)',
  },
  dark_slime: {
    name: '闇スライム', sprite: 'slime',
    maxHP: 12, atk: 5, def: 1, expValue: 18, detectRadius: 6,
    isRanged: true, preferRange: 2,
    color: '#7c3aed', hpBarColor: '#c4b5fd', glowColor: 'rgba(124,58,237,0.85)',
    projectileColor: '#c4b5fd',
  },

  // ══ コウモリ・虫系 ════════════════════════════════════
  bat: {
    name: 'コウモリ', sprite: 'bat',
    maxHP: 4, atk: 2, def: 0, expValue: 4, detectRadius: 8,
    fastMove: true,
    color: '#a8a29e', hpBarColor: '#d6d3d1', glowColor: 'rgba(168,162,158,0.7)',
  },
  giant_bat: {
    name: '大コウモリ', sprite: 'giant_bat',
    maxHP: 10, atk: 4, def: 1, expValue: 10, detectRadius: 9,
    fastMove: true,
    color: '#57534e', hpBarColor: '#a8a29e', glowColor: 'rgba(87,83,78,0.8)',
  },
  cave_spider: {
    name: '洞窟クモ', sprite: 'cave_spider',
    maxHP: 6, atk: 3, def: 1, expValue: 7, detectRadius: 5,
    poisonAttack: true,
    color: '#ca8a04', hpBarColor: '#fde047', glowColor: 'rgba(202,138,4,0.8)',
  },
  poison_spider: {
    name: '毒グモ', sprite: 'poison_spider',
    maxHP: 9, atk: 4, def: 1, expValue: 12, detectRadius: 6,
    isRanged: true, preferRange: 3, poisonAttack: true,
    color: '#65a30d', hpBarColor: '#a3e635', glowColor: 'rgba(101,163,13,0.85)',
    projectileColor: '#a3e635',
  },
  giant_scorpion: {
    name: 'ジャイアントスコーピオン', sprite: 'giant_scorpion',
    maxHP: 18, atk: 5, def: 3, expValue: 20, detectRadius: 5,
    color: '#b45309', hpBarColor: '#d97706', glowColor: 'rgba(180,83,9,0.85)',
  },

  // ══ ゴブリン系 ═══════════════════════════════════════
  goblin: {
    name: 'ゴブリン', sprite: 'goblin',
    maxHP: 8, atk: 2, def: 1, expValue: 6, detectRadius: 8,
    color: '#22c55e', hpBarColor: '#86efac', glowColor: 'rgba(34,197,94,0.8)',
  },
  hobgoblin: {
    name: 'ホブゴブリン', sprite: 'goblin',
    maxHP: 16, atk: 5, def: 2, expValue: 14, detectRadius: 8,
    color: '#16a34a', hpBarColor: '#4ade80', glowColor: 'rgba(22,163,74,0.8)',
  },
  goblin_chief: {
    name: 'ゴブリン族長', sprite: 'goblin',
    maxHP: 30, atk: 8, def: 4, expValue: 35, detectRadius: 10,
    color: '#15803d', hpBarColor: '#22c55e', glowColor: 'rgba(21,128,61,0.9)',
  },
  goblin_shaman: {
    name: 'ゴブリンシャーマン', sprite: 'wizard',
    maxHP: 10, atk: 6, def: 0, expValue: 18, detectRadius: 9,
    isRanged: true, preferRange: 4, castTime: 1,
    color: '#84cc16', hpBarColor: '#bef264', glowColor: 'rgba(132,204,22,0.85)',
    projectileColor: '#bef264',
  },
  goblin_bomber: {
    name: 'ゴブリン爆弾兵', sprite: 'goblin',
    maxHP: 8, atk: 7, def: 0, expValue: 16, detectRadius: 7,
    isRanged: true, preferRange: 3, deathExplode: true,
    color: '#ca8a04', hpBarColor: '#fde047', glowColor: 'rgba(202,138,4,0.85)',
    projectileColor: '#fde047',
  },
  kobold: {
    name: 'コボルト', sprite: 'goblin',
    maxHP: 5, atk: 2, def: 0, expValue: 4, detectRadius: 6,
    color: '#b45309', hpBarColor: '#d97706', glowColor: 'rgba(180,83,9,0.7)',
  },

  // ══ 弓・投擲系 ═══════════════════════════════════════
  archer: {
    name: '弓使いゴブリン', sprite: 'archer',
    maxHP: 6, atk: 3, def: 0, expValue: 8, detectRadius: 8,
    isRanged: true, preferRange: 3,
    color: '#f59e0b', hpBarColor: '#fcd34d', glowColor: 'rgba(245,158,11,0.8)',
  },
  dark_elf: {
    name: 'ダークエルフ', sprite: 'archer',
    maxHP: 14, atk: 7, def: 1, expValue: 22, detectRadius: 10,
    isRanged: true, preferRange: 5,
    color: '#6d28d9', hpBarColor: '#a78bfa', glowColor: 'rgba(109,40,217,0.85)',
    projectileColor: '#a78bfa',
  },
  crossbowman: {
    name: 'クロスボウ兵', sprite: 'archer',
    maxHP: 18, atk: 9, def: 3, expValue: 28, detectRadius: 9,
    isRanged: true, preferRange: 4,
    color: '#b45309', hpBarColor: '#d97706', glowColor: 'rgba(180,83,9,0.85)',
  },
  sniper: {
    name: 'スナイパー', sprite: 'archer',
    maxHP: 12, atk: 14, def: 1, expValue: 35, detectRadius: 12,
    isRanged: true, preferRange: 7,
    color: '#1d4ed8', hpBarColor: '#60a5fa', glowColor: 'rgba(29,78,216,0.85)',
    projectileColor: '#60a5fa',
  },
  bandit: {
    name: '山賊', sprite: 'archer',
    maxHP: 15, atk: 6, def: 2, expValue: 16, detectRadius: 8,
    isRanged: true, preferRange: 3,
    color: '#854d0e', hpBarColor: '#d97706', glowColor: 'rgba(133,77,14,0.8)',
  },

  // ══ 魔法使い系 ═══════════════════════════════════════
  wizard: {
    name: '闇魔術師', sprite: 'wizard',
    maxHP: 8, atk: 5, def: 0, expValue: 12, detectRadius: 10,
    isRanged: true, preferRange: 4, castTime: 2,
    color: '#a855f7', hpBarColor: '#d8b4fe', glowColor: 'rgba(168,85,247,0.9)',
    projectileColor: '#e879f9',
  },
  forest_witch: {
    name: '森の魔女', sprite: 'wizard',
    maxHP: 14, atk: 8, def: 0, expValue: 25, detectRadius: 9,
    isRanged: true, preferRange: 4, castTime: 2,
    color: '#15803d', hpBarColor: '#4ade80', glowColor: 'rgba(21,128,61,0.9)',
    projectileColor: '#4ade80',
  },
  cultist: {
    name: 'カルト信者', sprite: 'wizard',
    maxHP: 11, atk: 6, def: 1, expValue: 16, detectRadius: 8,
    isRanged: true, preferRange: 3, castTime: 1,
    color: '#7f1d1d', hpBarColor: '#f87171', glowColor: 'rgba(127,29,29,0.85)',
    projectileColor: '#f87171',
  },
  chaos_mage: {
    name: 'カオス魔導士', sprite: 'wizard',
    maxHP: 18, atk: 14, def: 2, expValue: 45, detectRadius: 11,
    isRanged: true, preferRange: 5, castTime: 2,
    color: '#dc2626', hpBarColor: '#fca5a5', glowColor: 'rgba(220,38,38,0.9)',
    projectileColor: '#fca5a5',
  },
  lich: {
    name: 'リッチ', sprite: 'wizard',
    maxHP: 28, atk: 16, def: 3, expValue: 60, detectRadius: 12,
    isRanged: true, preferRange: 5, castTime: 2,
    color: '#312e81', hpBarColor: '#818cf8', glowColor: 'rgba(49,46,129,0.95)',
    projectileColor: '#a5b4fc',
  },

  // ══ アンデッド系 ══════════════════════════════════════
  skeleton: {
    name: 'スケルトン', sprite: 'skeleton',
    maxHP: 7, atk: 3, def: 2, expValue: 9, detectRadius: 7,
    color: '#e7e5e4', hpBarColor: '#d6d3d1', glowColor: 'rgba(231,229,228,0.7)',
  },
  skeleton_archer: {
    name: '骸骨弓兵', sprite: 'archer',
    maxHP: 8, atk: 5, def: 1, expValue: 14, detectRadius: 9,
    isRanged: true, preferRange: 4,
    color: '#d6d3d1', hpBarColor: '#e7e5e4', glowColor: 'rgba(214,211,209,0.8)',
  },
  zombie: {
    name: 'ゾンビ', sprite: 'zombie',
    maxHP: 22, atk: 4, def: 2, expValue: 12, detectRadius: 4,
    color: '#4d7c0f', hpBarColor: '#84cc16', glowColor: 'rgba(77,124,15,0.7)',
  },
  ghost: {
    name: 'ゴースト', sprite: 'ghost',
    maxHP: 10, atk: 6, def: 0, expValue: 20, detectRadius: 10,
    isRanged: true, preferRange: 3,
    color: '#e0f2fe', hpBarColor: '#bae6fd', glowColor: 'rgba(224,242,254,0.9)',
    projectileColor: '#e0f2fe',
  },
  wraith: {
    name: 'レイス', sprite: 'wraith',
    maxHP: 16, atk: 10, def: 1, expValue: 32, detectRadius: 11,
    isRanged: true, preferRange: 4, castTime: 1, lifeSteal: true,
    color: '#1e293b', hpBarColor: '#475569', glowColor: 'rgba(148,163,184,0.85)',
    projectileColor: '#7dd3fc',
  },

  // ══ 獣・野生系 ═══════════════════════════════════════
  giant_rat: {
    name: '大ネズミ', sprite: 'giant_rat',
    maxHP: 6, atk: 2, def: 0, expValue: 5, detectRadius: 6,
    color: '#78716c', hpBarColor: '#a8a29e', glowColor: 'rgba(120,113,108,0.7)',
  },
  wolf: {
    name: 'ウルフ', sprite: 'wolf',
    maxHP: 12, atk: 5, def: 1, expValue: 11, detectRadius: 9,
    color: '#6b7280', hpBarColor: '#9ca3af', glowColor: 'rgba(107,114,128,0.8)',
  },
  dire_wolf: {
    name: 'ダイアウルフ', sprite: 'dire_wolf',
    maxHP: 24, atk: 9, def: 2, expValue: 26, detectRadius: 10,
    color: '#374151', hpBarColor: '#6b7280', glowColor: 'rgba(55,65,81,0.85)',
  },
  werewolf: {
    name: 'ワーウルフ', sprite: 'werewolf',
    maxHP: 32, atk: 13, def: 3, expValue: 40, detectRadius: 10,
    color: '#78350f', hpBarColor: '#b45309', glowColor: 'rgba(120,53,15,0.9)',
  },
  gnoll: {
    name: 'グノール', sprite: 'goblin',
    maxHP: 14, atk: 6, def: 2, expValue: 15, detectRadius: 8,
    color: '#92400e', hpBarColor: '#d97706', glowColor: 'rgba(146,64,14,0.8)',
  },

  // ══ 重装兵・人型系 ════════════════════════════════════
  orc: {
    name: 'オーク', sprite: 'goblin',
    maxHP: 20, atk: 6, def: 3, expValue: 18, detectRadius: 7,
    color: '#166534', hpBarColor: '#16a34a', glowColor: 'rgba(22,101,52,0.85)',
  },
  berserker: {
    name: 'バーサーカー', sprite: 'berserker',
    maxHP: 22, atk: 12, def: 1, expValue: 28, detectRadius: 9,
    color: '#b91c1c', hpBarColor: '#f87171', glowColor: 'rgba(185,28,28,0.9)',
  },
  death_knight: {
    name: 'デスナイト', sprite: 'boss',
    maxHP: 40, atk: 12, def: 6, expValue: 55, detectRadius: 10,
    color: '#1e1b4b', hpBarColor: '#4338ca', glowColor: 'rgba(30,27,75,0.95)',
  },
  shadow_assassin: {
    name: 'シャドウ暗殺者', sprite: 'shadow_assassin',
    maxHP: 16, atk: 15, def: 1, expValue: 38, detectRadius: 12,
    fastMove: true,
    color: '#27272a', hpBarColor: '#52525b', glowColor: 'rgba(39,39,42,0.9)',
  },

  // ══ 岩・ゴーレム系 ════════════════════════════════════
  rock_crab: {
    name: '岩ガニ', sprite: 'rock_crab',
    maxHP: 16, atk: 3, def: 6, expValue: 14, detectRadius: 4,
    color: '#78716c', hpBarColor: '#a8a29e', glowColor: 'rgba(120,113,108,0.8)',
  },
  stone_golem: {
    name: 'ストーンゴーレム', sprite: 'stone_golem',
    maxHP: 45, atk: 8, def: 8, expValue: 50, detectRadius: 5,
    hpRegen: 2,
    color: '#57534e', hpBarColor: '#78716c', glowColor: 'rgba(87,83,78,0.85)',
  },
  iron_golem: {
    name: 'アイアンゴーレム', sprite: 'iron_golem',
    maxHP: 60, atk: 12, def: 12, expValue: 70, detectRadius: 5,
    hpRegen: 3,
    color: '#374151', hpBarColor: '#4b5563', glowColor: 'rgba(55,65,81,0.9)',
  },
  treant: {
    name: 'トレント', sprite: 'treant',
    maxHP: 50, atk: 7, def: 5, expValue: 45, detectRadius: 6,
    hpRegen: 2,
    color: '#166534', hpBarColor: '#4ade80', glowColor: 'rgba(22,101,52,0.85)',
  },
  gargoyle: {
    name: 'ガーゴイル', sprite: 'gargoyle',
    maxHP: 28, atk: 9, def: 7, expValue: 42, detectRadius: 8,
    color: '#44403c', hpBarColor: '#78716c', glowColor: 'rgba(68,64,60,0.9)',
  },

  // ══ エレメンタル系 ════════════════════════════════════
  fire_elemental: {
    name: '炎の精霊', sprite: 'fire_elemental',
    maxHP: 18, atk: 11, def: 0, expValue: 30, detectRadius: 8,
    isRanged: true, preferRange: 4,
    color: '#dc2626', hpBarColor: '#fca5a5', glowColor: 'rgba(239,68,68,0.95)',
    projectileColor: '#f97316',
  },
  ice_elemental: {
    name: '氷の精霊', sprite: 'ice_elemental',
    maxHP: 20, atk: 8, def: 4, expValue: 28, detectRadius: 8,
    isRanged: true, preferRange: 4,
    color: '#0ea5e9', hpBarColor: '#bae6fd', glowColor: 'rgba(14,165,233,0.95)',
    projectileColor: '#bae6fd',
  },
  thunder_elemental: {
    name: '雷の精霊', sprite: 'thunder_elemental',
    maxHP: 16, atk: 13, def: 1, expValue: 34, detectRadius: 10,
    isRanged: true, preferRange: 5,
    color: '#fbbf24', hpBarColor: '#fde68a', glowColor: 'rgba(251,191,36,0.95)',
    projectileColor: '#fde68a',
  },
  void_crawler: {
    name: 'ヴォイドクローラー', sprite: 'void_crawler',
    maxHP: 24, atk: 10, def: 5, expValue: 42, detectRadius: 9,
    color: '#4c1d95', hpBarColor: '#7c3aed', glowColor: 'rgba(76,29,149,0.9)',
  },

  // ══ 魔族・深淵系 ══════════════════════════════════════
  vampire: {
    name: 'ヴァンパイア', sprite: 'vampire',
    maxHP: 36, atk: 14, def: 4, expValue: 65, detectRadius: 11,
    isRanged: true, preferRange: 3, castTime: 1, lifeSteal: true,
    color: '#881337', hpBarColor: '#f43f5e', glowColor: 'rgba(136,19,55,0.9)',
    projectileColor: '#f43f5e',
  },
  soul_eater: {
    name: 'ソウルイーター', sprite: 'soul_eater',
    maxHP: 30, atk: 18, def: 2, expValue: 72, detectRadius: 11,
    isRanged: true, preferRange: 4, castTime: 1, lifeSteal: true,
    color: '#1c1917', hpBarColor: '#44403c', glowColor: 'rgba(139,0,139,0.95)',
    projectileColor: '#a21caf',
  },
  void_stalker: {
    name: 'ヴォイドストーカー', sprite: 'void_stalker',
    maxHP: 40, atk: 18, def: 6, expValue: 85, detectRadius: 13,
    color: '#0c0a09', hpBarColor: '#292524', glowColor: 'rgba(109,40,217,0.95)',
  },
  nightmare: {
    name: 'ナイトメア', sprite: 'nightmare',
    maxHP: 35, atk: 20, def: 3, expValue: 90, detectRadius: 12,
    isRanged: true, preferRange: 5, castTime: 2,
    color: '#09090b', hpBarColor: '#3f3f46', glowColor: 'rgba(168,85,247,0.95)',
    projectileColor: '#c026d3',
  },
  demon: {
    name: 'デーモン', sprite: 'boss',
    maxHP: 50, atk: 16, def: 7, expValue: 80, detectRadius: 12,
    color: '#7f1d1d', hpBarColor: '#ef4444', glowColor: 'rgba(127,29,29,0.95)',
  },
  abyssal_demon: {
    name: '深淵魔王', sprite: 'boss',
    maxHP: 75, atk: 22, def: 10, expValue: 120, detectRadius: 14,
    color: '#450a0a', hpBarColor: '#7f1d1d', glowColor: 'rgba(69,10,10,0.98)',
  },
  mimic: {
    name: 'ミミック', sprite: 'mimic',
    maxHP: 25, atk: 16, def: 4, expValue: 55, detectRadius: 1,
    color: '#d97706', hpBarColor: '#fbbf24', glowColor: 'rgba(217,119,6,0.9)',
  },

  // ══ ボスタイプ ════════════════════════════════════════
  boss: {
    name: '暗黒騎士', sprite: 'boss',
    maxHP: 60, atk: 10, def: 5, expValue: 100,
    detectRadius: 20, isBoss: true,
    color: '#7c3aed', hpBarColor: '#a855f7', glowColor: 'rgba(138,0,255,0.9)',
  },

  // ══ 死神（不死・即死攻撃） ════════════════════════════
  shinigami: {
    name: '死神', sprite: null,
    maxHP: 9999, atk: 9999, def: 999, expValue: 0,
    detectRadius: 99, isShinigami: true,
    color: '#1a0030', hpBarColor: '#8800ff', glowColor: 'rgba(120,0,200,0.95)',
  },

  // ══ 借金取り ═════════════════════════════════════════
  debt_collector: {
    name: '借金取り', sprite: 'debt_collector',
    maxHP: 35, atk: 10, def: 3, expValue: 0, detectRadius: 15,
    fastMove: true, isDebtCollector: true,
    color: '#7f1d1d', hpBarColor: '#f87171', glowColor: 'rgba(127,29,29,0.9)',
  },

  // ══ 露店番人の死神 ════════════════════════════════════
  shop_shinigami: {
    name: '番人の死神', sprite: null,
    maxHP: 120, atk: 22, def: 6, expValue: 500,
    detectRadius: 99, isShinigami: true, isShopShinigami: true,
    color: '#330066', hpBarColor: '#aa44ff', glowColor: 'rgba(100,0,200,0.95)',
  },
};

// ── フロア番号からボス名を決定 ─────────────────

export function getBossName(floorNum: number): string {
  const names = [
    '暗黒騎士',    // floor 5
    'オーガキング', // floor 10
    '骸骨魔導士',  // floor 15
    '鉄の巨人',    // floor 20
    '竜王',        // floor 25+
  ];
  return names[Math.min(Math.floor((floorNum - 5) / 5), names.length - 1)];
}

// ── 描画ヘルパー ──────────────────────────────

const SZ      = TILE_SIZE + 8;
const SZ_BOSS = TILE_SIZE * 2 + 8;

function _drawShinigamiSprite(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, sz: number, now: number,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(now * 2.5);
  const r = sz * 0.45;
  ctx.save();

  for (let i = 3; i >= 0; i--) {
    const a = (0.08 + 0.07 * pulse) * (4 - i) / 4;
    ctx.beginPath();
    ctx.arc(sx, sy, r + 10 + i * 8 + pulse * 6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80,0,120,${a.toFixed(2)})`;
    ctx.fill();
  }

  ctx.shadowColor = `rgba(140,0,200,${(0.7 + 0.3 * pulse).toFixed(2)})`;
  ctx.shadowBlur  = 20 + 10 * pulse;
  ctx.fillStyle = '#0a0010';
  ctx.beginPath();
  ctx.moveTo(sx, sy - r * 0.9);
  ctx.lineTo(sx - r * 0.85, sy + r * 0.7);
  ctx.bezierCurveTo(sx - r * 0.4, sy + r * 0.95, sx + r * 0.4, sy + r * 0.95, sx + r * 0.85, sy + r * 0.7);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(sx, sy - r * 0.45, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  const eyeY = sy - r * 0.42;
  const eyeGlow = `rgba(255,0,60,${(0.8 + 0.2 * pulse).toFixed(2)})`;
  for (const ex of [sx - r * 0.22, sx + r * 0.22]) {
    ctx.shadowColor = eyeGlow;
    ctx.shadowBlur  = 14;
    ctx.strokeStyle = '#cc88ff';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(ex + r * 0.3, eyeY + r * 0.6);
    ctx.lineTo(ex + r * 0.8, eyeY - r * 0.9);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(ex + r * 0.4, eyeY - r * 0.6, r * 0.5, -Math.PI * 0.9, -Math.PI * 0.1);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Enemy クラス ──────────────────────────────

export class Enemy extends Actor {
  type:           string;
  name:           string;
  atk:            number;
  def:            number;
  expValue:       number;
  spriteName:     string | null;
  detectRadius:   number;
  color:          string;
  hpBarColor:     string;
  glowColor:      string;

  alerted:         boolean;
  isRanged:        boolean;
  preferRange:     number;
  isBoss:          boolean;
  isShinigami:     boolean;
  isShopShinigami: boolean;
  projectileColor: string | null;
  castTime:        number;
  _castCharge:     number;

  poisonAttack: boolean;
  lifeSteal:    boolean;
  hpRegen:      number;
  deathExplode: boolean;
  splitOnDeath: boolean;
  fastMove:     boolean;

  statusEffects: StatusEffectEntry[];

  constructor(tx: number, ty: number, type = 'slime') {
    const cfg = ENEMY_TYPES[type] ?? ENEMY_TYPES['slime'];
    super(tx, ty, cfg.maxHP);
    this.type         = type;
    this.name         = cfg.name;
    this.atk          = cfg.atk;
    this.def          = cfg.def;
    this.expValue     = cfg.expValue;
    this.spriteName   = cfg.sprite;
    this.detectRadius = cfg.detectRadius;
    this.color        = cfg.color;
    this.hpBarColor   = cfg.hpBarColor;
    this.glowColor    = cfg.glowColor;

    this.alerted         = false;
    this.isRanged        = cfg.isRanged        ?? false;
    this.preferRange     = cfg.preferRange     ?? 3;
    this.isBoss          = cfg.isBoss          ?? false;
    this.isShinigami     = cfg.isShinigami     ?? false;
    this.isShopShinigami = cfg.isShopShinigami ?? false;
    this.projectileColor = cfg.projectileColor ?? null;
    this.castTime        = cfg.castTime        ?? 0;
    this._castCharge     = 0;

    this.poisonAttack = cfg.poisonAttack ?? false;
    this.lifeSteal    = cfg.lifeSteal    ?? false;
    this.hpRegen      = cfg.hpRegen      ?? 0;
    this.deathExplode = cfg.deathExplode ?? false;
    this.splitOnDeath = cfg.splitOnDeath ?? false;
    this.fastMove     = cfg.fastMove     ?? false;

    this.statusEffects = [];
  }

  takeTurn(
    map:     GameMap,
    player:  { tx: number; ty: number },
    enemies: Enemy[],
  ): TurnAction {
    const dist = Math.max(
      Math.abs(this.tx - player.tx),
      Math.abs(this.ty - player.ty)
    );
    if (!this.alerted && dist <= this.detectRadius) this.alerted = true;
    if (!this.alerted) return 'wait';

    if (this.isRanged) {
      const dx = player.tx - this.tx;
      const dy = player.ty - this.ty;
      const onAxis     = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
      const euclidDist = Math.sqrt(dx * dx + dy * dy);
      const inRange    = onAxis && euclidDist <= 2 && this._hasLOSClear(player.tx, player.ty, map, enemies);

      if (inRange) {
        if (this.castTime > 0) {
          if (this._castCharge > 0) {
            this._castCharge--;
            return this._castCharge === 0 ? 'rangedAttack' : 'casting';
          } else {
            this._castCharge = this.castTime;
            this._castCharge--;
            return this._castCharge === 0 ? 'rangedAttack' : 'casting';
          }
        }
        return 'rangedAttack';
      }
      this._castCharge = 0;
      if (euclidDist <= 1.5) return 'attack';
      return this._moveToward(player.tx, player.ty, map, enemies) ? 'move' : 'wait';
    }

    if (this.isBoss) {
      const rand = Math.random();
      if (dist <= 2 && rand < 0.25) return 'areaAttack';
      if (dist <= 6 && this._hasLOSClear(player.tx, player.ty, map, enemies)) {
        if (rand < 0.45) {
          const magic = ['magicFire', 'magicIce', 'magicLightning'] as TurnAction[];
          return magic[Math.floor(Math.random() * 3)];
        }
      }
    }
    if (this.isAdjacentTo(player)) return 'attack';
    return this._moveToward(player.tx, player.ty, map, enemies) ? 'move' : 'wait';
  }

  private _hasLOS(tx: number, ty: number, map: GameMap): boolean {
    let x0 = this.tx, y0 = this.ty;
    const x1 = tx, y1 = ty;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (let iter = 0; iter < 256; iter++) {
      if (x0 === x1 && y0 === y1) return true;
      if (!map.isWalkable(x0, y0)) return false;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 <  dx) { err += dx; y0 += sy; }
    }
    return false;
  }

  private _hasLOSClear(tx: number, ty: number, map: GameMap, allies: Enemy[]): boolean {
    if (!this._hasLOS(tx, ty, map)) return false;
    let cx = this.tx, cy = this.ty;
    const adx = Math.abs(tx - cx), ady = Math.abs(ty - cy);
    const sx = cx < tx ? 1 : -1, sy = cy < ty ? 1 : -1;
    let err = adx - ady;
    for (let i = 0; i < 256; i++) {
      if (cx === tx && cy === ty) return true;
      const e2 = 2 * err;
      if (e2 > -ady) { err -= ady; cx += sx; }
      if (e2 <  adx) { err += adx; cy += sy; }
      if ((cx !== tx || cy !== ty) && allies.some(a => a !== this && a.alive && a.tx === cx && a.ty === cy)) return false;
    }
    return false;
  }

  private _moveToward(tx: number, ty: number, map: GameMap, enemies: Enemy[]): boolean {
    const path = findPath(
      map.cols, map.rows,
      (x, y) => map.isWalkable(x, y),
      this.tx, this.ty, tx, ty
    );
    if (path.length < 2) return false;
    const next = path[1];
    if (enemies.some(e => e !== this && e.alive && e.tx === next.x && e.ty === next.y)) return false;
    this.moveTo(next.x, next.y);
    return true;
  }

  dropItem(floorNum: number): ItemDef | null {
    return randomDrop(floorNum);
  }

  draw(
    ctx:     CanvasRenderingContext2D,
    sprites: SpriteManager,
    camOffX: number,
    camOffY: number,
    now      = 0,
  ): void {
    if (!this.alive) return;

    const sz = this.isBoss ? SZ_BOSS : SZ;
    const { sx, sy } = this.screenPos(camOffX, camOffY);

    if (this.isBoss) {
      for (let i = 0; i < 3; i++) {
        const phase  = (now * 0.8 + i * (Math.PI * 2 / 3));
        const radius = sz * 0.55 + i * 6 + Math.sin(phase) * 4;
        const alpha  = 0.25 + 0.15 * Math.sin(phase + i);
        ctx.save();
        ctx.strokeStyle = `rgba(138,0,255,${alpha.toFixed(2)})`;
        ctx.lineWidth   = 2.5 - i * 0.5;
        ctx.shadowColor = 'rgba(138,0,255,0.6)';
        ctx.shadowBlur  = 10;
        ctx.beginPath();
        ctx.ellipse(sx, sy, radius, radius * 0.6, now * 0.3 + i, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.save();
    if (this.isShinigami) {
      _drawShinigamiSprite(ctx, sx, sy, sz, now);
    } else if (sprites.get(this.spriteName)) {
      ctx.shadowColor = this.glowColor;
      ctx.shadowBlur  = this.isBoss ? 28 : 10;
      sprites.draw(ctx, this.spriteName!, sx, sy, sz, sz);
      ctx.shadowBlur  = 0;
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(sx, sy, sz / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (!this.isBoss && !this.isShinigami) {
      _drawHPBar(ctx, sx, sy - sz / 2 - 8,  sz, this.hp, this.maxHP, this.hpBarColor);
    }
    if (this.isBoss) {
      _drawHPBar(ctx, sx, sy - sz / 2 - 10, sz, this.hp, this.maxHP, this.hpBarColor);
    }
  }
}
