// ─────────────────────────────────────────────
// equipment.ts  アイテム・装備定義  v=3
// ─────────────────────────────────────────────

export type EquipSlot = 'consumable' | 'weapon' | 'armor' | 'accessory';
export type AoeType   = 'cross' | 'sweep' | 'burst';
export type Tier      = 0 | 1 | 2 | 3;

export interface ItemDef {
  id:    string;
  name:  string;
  icon:  string;
  color: string;
  slot:  EquipSlot;
  tier:  Tier;
  // ── 消費アイテム専用 ──
  heal?:      number | 'full';
  healMp?:    number | 'full';
  spellId?:   string;
  bombDmg?:   number;
  revive?:    boolean;
  tempAtk?:   number;
  tempTurns?: number;
  // ── 装備共通 ──
  atk?:          number;
  def?:          number;
  maxHp?:        number;
  maxMp?:        number;
  spd?:          number;
  range?:        number;
  aoe?:          AoeType;
  aoeRange?:     number;
  lifeSteal?:    number;
  stunOnHit?:    number;
  poisonOnHit?:  boolean;
  evasion?:      number;
  durability?:   number;
  maxDurability?: number;
}

export interface ShopEntry {
  itemId: string;
  price:  number;
  tier:   Tier;
}

export const ITEMS: Record<string, ItemDef> = {
  // ── 消費アイテム ───────────────────────────────
  herb:         { id: 'herb',         name: '薬草',       slot: 'consumable', heal: 5,      icon: '🌿', color: '#4ade80', tier: 0 },
  potion_sm:    { id: 'potion_sm',    name: '小回復薬',   slot: 'consumable', heal: 12,     icon: '🧪', color: '#86efac', tier: 0 },
  potion_md:    { id: 'potion_md',    name: '回復薬',     slot: 'consumable', heal: 25,     icon: '💊', color: '#34d399', tier: 1 },
  potion_lg:    { id: 'potion_lg',    name: '大回復薬',   slot: 'consumable', heal: 50,     icon: '🍶', color: '#10b981', tier: 1 },
  elixir:       { id: 'elixir',       name: 'エリクサー', slot: 'consumable', heal: 'full', icon: '✨', color: '#fbbf24', tier: 2 },
  antidote:     { id: 'antidote',     name: '毒消し草',   slot: 'consumable', heal: 3,      icon: '🌱', color: '#86efac', tier: 0 },
  ether_sm:     { id: 'ether_sm',     name: '小マナ薬',   slot: 'consumable', healMp: 8,    icon: '🔮', color: '#818cf8', tier: 0 },
  ether_md:     { id: 'ether_md',     name: 'マナ薬',     slot: 'consumable', healMp: 18,   icon: '💙', color: '#6366f1', tier: 1 },
  ether_lg:     { id: 'ether_lg',     name: '大マナ薬',   slot: 'consumable', healMp: 35,   icon: '🫧', color: '#4f46e5', tier: 2 },

  // ── 魔法の巻物 ────────────────────────────────
  scroll_fire:    { id: 'scroll_fire',    name: '火炎の巻物',   slot: 'consumable', spellId: 'fireball',   icon: '📜', color: '#f97316', tier: 1 },
  scroll_thunder: { id: 'scroll_thunder', name: '雷鳴の巻物',   slot: 'consumable', spellId: 'thunder',    icon: '📜', color: '#fbbf24', tier: 1 },
  scroll_blizzard:{ id: 'scroll_blizzard',name: '吹雪の巻物',   slot: 'consumable', spellId: 'blizzard',   icon: '📜', color: '#7dd3fc', tier: 2 },
  scroll_teleport:{ id: 'scroll_teleport',name: '転移の巻物',   slot: 'consumable', spellId: 'teleport',   icon: '📜', color: '#c084fc', tier: 0 },
  scroll_meteor:  { id: 'scroll_meteor',  name: 'メテオの巻物', slot: 'consumable', spellId: 'meteor',     icon: '📜', color: '#ef4444', tier: 2 },
  scroll_dark:    { id: 'scroll_dark',    name: '闇の巻物',     slot: 'consumable', spellId: 'dark_bolt',  icon: '📜', color: '#7c3aed', tier: 1 },
  scroll_frost:   { id: 'scroll_frost',   name: '氷結の巻物',   slot: 'consumable', spellId: 'frost_nova', icon: '📜', color: '#7dd3fc', tier: 1 },
  scroll_poison:  { id: 'scroll_poison',  name: '毒霧の巻物',   slot: 'consumable', spellId: 'poison_mist',icon: '📜', color: '#4ade80', tier: 0 },
  scroll_drain:   { id: 'scroll_drain',   name: '吸収の巻物',   slot: 'consumable', spellId: 'drain',      icon: '📜', color: '#f43f5e', tier: 1 },
  scroll_sleep:   { id: 'scroll_sleep',   name: '眠りの巻物',   slot: 'consumable', spellId: 'sleep_gas',  icon: '📜', color: '#a78bfa', tier: 1 },
  scroll_holy:    { id: 'scroll_holy',    name: '聖域の巻物',   slot: 'consumable', spellId: 'holy_nova',  icon: '📜', color: '#fde68a', tier: 2 },
  scroll_quake:   { id: 'scroll_quake',   name: '地震の巻物',   slot: 'consumable', spellId: 'quake',      icon: '📜', color: '#92400e', tier: 2 },
  scroll_chain:   { id: 'scroll_chain',   name: '連鎖の巻物',   slot: 'consumable', spellId: 'chain_bolt', icon: '📜', color: '#fbbf24', tier: 1 },
  scroll_wind:    { id: 'scroll_wind',    name: '風刃の巻物',   slot: 'consumable', spellId: 'wind_cross', icon: '📜', color: '#d1fae5', tier: 1 },
  scroll_gravity: { id: 'scroll_gravity', name: '重力の巻物',   slot: 'consumable', spellId: 'gravity',    icon: '📜', color: '#6366f1', tier: 2 },

  // ── 武器（近接） ─────────────────────────────────
  dagger:       { id: 'dagger',       name: '短剣',       slot: 'weapon', atk: 2, icon: '🗡', color: '#94a3b8', tier: 0, maxDurability: 20, durability: 20 },
  sword_bronze: { id: 'sword_bronze', name: '青銅剣',     slot: 'weapon', atk: 3, icon: '⚔', color: '#b45309', tier: 0, maxDurability: 25, durability: 25 },
  sword_iron:   { id: 'sword_iron',   name: '鉄剣',       slot: 'weapon', atk: 5, icon: '⚔', color: '#78716c', tier: 1, maxDurability: 35, durability: 35 },
  sword_silver: { id: 'sword_silver', name: '銀剣',       slot: 'weapon', atk: 7, icon: '⚔', color: '#cbd5e1', tier: 2, maxDurability: 40, durability: 40 },
  staff_magic:  { id: 'staff_magic',  name: '魔法の杖',   slot: 'weapon', atk: 6, aoe: 'cross', aoeRange: 2, icon: '✨', color: '#c084fc', tier: 2, maxDurability: 25, durability: 25 },
  axe_iron:     { id: 'axe_iron',     name: '鉄の斧',     slot: 'weapon', atk: 6, aoe: 'sweep',              icon: '🪓', color: '#64748b', tier: 1, maxDurability: 30, durability: 30 },
  hammer:       { id: 'hammer',       name: '大ハンマー', slot: 'weapon', atk: 8, aoe: 'burst', aoeRange: 1, icon: '🔨', color: '#94a3b8', tier: 2, maxDurability: 35, durability: 35 },

  // ── 武器（遠距離） ─────────────────────────────
  spear:    { id: 'spear',    name: '槍',          slot: 'weapon', atk: 4, range: 2, icon: '🔱', color: '#7c3aed', tier: 1, maxDurability: 30, durability: 30 },
  bow:      { id: 'bow',      name: '短弓',        slot: 'weapon', atk: 3, range: 4, icon: '🏹', color: '#92400e', tier: 1, maxDurability: 25, durability: 25 },
  crossbow: { id: 'crossbow', name: 'クロスボウ',  slot: 'weapon', atk: 6, range: 5, icon: '🎯', color: '#7c3aed', tier: 2, maxDurability: 22, durability: 22 },
  longbow:  { id: 'longbow',  name: '長弓',        slot: 'weapon', atk: 5, range: 6, icon: '🏹', color: '#78350f', tier: 2, maxDurability: 25, durability: 25 },

  // ── 鎧 ────────────────────────────────────────
  armor_cloth:   { id: 'armor_cloth',   name: '布の服',     slot: 'armor', def: 1,            icon: '👘', color: '#fde68a', tier: 0, maxDurability: 18, durability: 18 },
  armor_leather: { id: 'armor_leather', name: '革鎧',       slot: 'armor', def: 2,            icon: '🛡', color: '#92400e', tier: 0, maxDurability: 28, durability: 28 },
  armor_iron:    { id: 'armor_iron',    name: '鉄鎧',       slot: 'armor', def: 4,            icon: '⚙', color: '#475569', tier: 1, maxDurability: 45, durability: 45 },
  armor_mithril: { id: 'armor_mithril', name: 'ミスリル鎧', slot: 'armor', def: 5, maxHp: 3,  icon: '💎', color: '#67e8f9', tier: 2, maxDurability: 50, durability: 50 },
  armor_magic:   { id: 'armor_magic',   name: '魔法鎧',     slot: 'armor', def: 3, maxHp: 5,  icon: '💜', color: '#a855f7', tier: 2, maxDurability: 38, durability: 38 },

  // ── 装飾品 ─────────────────────────────────────
  ring_atk:    { id: 'ring_atk',    name: '力の指輪',       slot: 'accessory', atk: 2,          icon: '💍', color: '#f59e0b', tier: 1 },
  ring_def:    { id: 'ring_def',    name: '守りの指輪',     slot: 'accessory', def: 2,          icon: '💍', color: '#3b82f6', tier: 1 },
  amulet_hp:   { id: 'amulet_hp',   name: '命のお守り',     slot: 'accessory', maxHp: 8,        icon: '📿', color: '#10b981', tier: 1 },
  charm_lucky: { id: 'charm_lucky', name: '幸運符',         slot: 'accessory', atk: 1, def: 1,  icon: '⭐', color: '#fbbf24', tier: 2 },
  brooch_mana: { id: 'brooch_mana', name: '魔力のブローチ', slot: 'accessory', atk: 3, maxHp: 3,icon: '🔮', color: '#e879f9', tier: 2 },

  // ── 武器（tier3 レジェンダリ） ────────────────────
  sword_dragon:  { id: 'sword_dragon',  name: '竜の剣',     slot: 'weapon', atk: 15, lifeSteal: 0.3, icon: '🐉', color: '#ef4444', tier: 3, maxDurability: 50, durability: 50 },
  chaos_blade:   { id: 'chaos_blade',   name: '魔剣カオス', slot: 'weapon', atk: 12, aoe: 'sweep', poisonOnHit: true, icon: '🌀', color: '#7c3aed', tier: 3, maxDurability: 40, durability: 40 },
  divine_bow:    { id: 'divine_bow',    name: '神弓',       slot: 'weapon', atk: 11, range: 7, icon: '🌟', color: '#fde68a', tier: 3, maxDurability: 35, durability: 35 },
  thunder_spear: { id: 'thunder_spear', name: '雷槍',       slot: 'weapon', atk: 10, range: 3, stunOnHit: 0.4, icon: '⚡', color: '#fbbf24', tier: 3, maxDurability: 38, durability: 38 },
  death_scythe:  { id: 'death_scythe',  name: '死神の大鎌', slot: 'weapon', atk: 13, aoe: 'cross', aoeRange: 2, lifeSteal: 0.2, icon: '💀', color: '#334155', tier: 3, maxDurability: 42, durability: 42 },
  holy_sword:    { id: 'holy_sword',    name: '聖剣エクス', slot: 'weapon', atk: 18, stunOnHit: 0.25, icon: '✝', color: '#fef9c3', tier: 3, maxDurability: 55, durability: 55 },

  // ── 鎧（tier3） ───────────────────────────────────
  armor_dragon:  { id: 'armor_dragon',  name: '竜鱗の鎧',   slot: 'armor', def: 8, maxHp: 5,  icon: '🐲', color: '#dc2626', tier: 3, maxDurability: 60, durability: 60 },
  armor_shadow:  { id: 'armor_shadow',  name: '影の外套',   slot: 'armor', def: 4, spd: 2, evasion: 0.15, icon: '🌑', color: '#1e1b4b', tier: 3, maxDurability: 35, durability: 35 },
  armor_holy:    { id: 'armor_holy',    name: '聖騎士の鎧', slot: 'armor', def: 6, maxHp: 10, icon: '🕊', color: '#fef3c7', tier: 3, maxDurability: 55, durability: 55 },

  // ── 装飾品（tier3） ──────────────────────────────
  vampire_cape:    { id: 'vampire_cape',    name: '吸血マント',   slot: 'accessory', lifeSteal: 0.25,          icon: '🦇', color: '#7c3aed', tier: 3 },
  ring_speed:      { id: 'ring_speed',      name: '疾風の指輪',   slot: 'accessory', spd: 3,                   icon: '💨', color: '#67e8f9', tier: 3 },
  amulet_mana:     { id: 'amulet_mana',     name: '魔力の首飾り', slot: 'accessory', maxMp: 15, atk: 2,        icon: '🔵', color: '#6366f1', tier: 3 },
  berserker_band:  { id: 'berserker_band',  name: '戦鬼の腕輪',   slot: 'accessory', atk: 5, def: -2,          icon: '🔥', color: '#f97316', tier: 3 },
  titan_belt:      { id: 'titan_belt',      name: '巨人の帯',     slot: 'accessory', atk: 3, def: 3, maxHp: 5, icon: '🏋', color: '#a16207', tier: 3 },

  // ── 消耗品（tier3） ──────────────────────────────
  bomb:           { id: 'bomb',           name: '爆弾',         slot: 'consumable', bombDmg: 30,  icon: '💣', color: '#dc2626', tier: 2 },
  revival_gem:    { id: 'revival_gem',    name: '蘇生の宝玉',   slot: 'consumable', revive: true, icon: '💎', color: '#34d399', tier: 3 },
  power_potion:   { id: 'power_potion',   name: '力の秘薬',     slot: 'consumable', tempAtk: 5, tempTurns: 15, icon: '💪', color: '#f97316', tier: 2 },
  full_ether:     { id: 'full_ether',     name: '完全マナ薬',   slot: 'consumable', healMp: 'full', icon: '🌀', color: '#818cf8', tier: 3 },
};

// 装備品プール（tier別）
const EQUIP_POOL: ReadonlyArray<readonly string[]> = [
  ['dagger', 'sword_bronze', 'armor_cloth', 'armor_leather'],
  ['sword_iron', 'axe_iron', 'spear', 'bow', 'armor_iron', 'ring_atk', 'ring_def', 'amulet_hp'],
  ['sword_silver', 'staff_magic', 'hammer', 'crossbow', 'longbow', 'armor_mithril', 'armor_magic', 'charm_lucky', 'brooch_mana'],
  ['sword_dragon', 'chaos_blade', 'divine_bow', 'thunder_spear', 'death_scythe', 'holy_sword',
   'armor_dragon', 'armor_shadow', 'armor_holy', 'vampire_cape', 'ring_speed', 'amulet_mana', 'berserker_band', 'titan_belt'],
];

// 消費アイテムプール（tier別）
const CONSUM_POOL: ReadonlyArray<readonly string[]> = [
  ['herb', 'herb', 'potion_sm', 'antidote', 'ether_sm', 'scroll_teleport', 'scroll_poison'],
  ['potion_sm', 'potion_md', 'herb', 'ether_sm', 'ether_md', 'scroll_fire', 'scroll_thunder',
   'scroll_dark', 'scroll_frost', 'scroll_drain', 'scroll_sleep', 'scroll_chain', 'scroll_wind'],
  ['potion_md', 'potion_lg', 'elixir', 'ether_md', 'ether_lg', 'scroll_blizzard', 'scroll_meteor',
   'scroll_holy', 'scroll_quake', 'scroll_gravity', 'bomb', 'power_potion'],
  ['revival_gem', 'full_ether', 'elixir', 'bomb', 'power_potion'],
];

function _pickFromPool(pool: ReadonlyArray<readonly string[]>, maxTier: number): string {
  const merged: string[] = [];
  for (let t = 0; t <= maxTier; t++) merged.push(...pool[t]);
  return merged[Math.floor(Math.random() * merged.length)];
}

/**
 * 敵ドロップ：50%消費 / 50%装備、(42% + lukBonus)の確率で発生
 */
export function randomDrop(floorNum: number, lukBonus = 0): ItemDef | null {
  if (Math.random() > 0.42 + lukBonus) return null;
  const maxTier = Math.min(3, Math.floor((floorNum - 1) / 4));
  const id = Math.random() < 0.5
    ? _pickFromPool(CONSUM_POOL, maxTier)
    : _pickFromPool(EQUIP_POOL, maxTier);
  return { ...ITEMS[id] };
}

/**
 * 宝箱ドロップ：高レアバイアス（tier2: 60%、tier1: 30%、tier0: 10%）
 * 装備寄り（55%装備 / 45%消費）
 */
export function chestDrop(floorNum: number): ItemDef {
  const maxTier = Math.min(3, Math.floor((floorNum - 1) / 3));
  const r = Math.random();
  let tier: number;
  if      (maxTier >= 2 && r < 0.60) tier = 2;
  else if (maxTier >= 1 && r < 0.90) tier = Math.min(1, maxTier);
  else                                tier = 0;
  const pool    = Math.random() < 0.55 ? EQUIP_POOL : CONSUM_POOL;
  const tierPool = pool[tier] ?? pool[0];
  const id = tierPool[Math.floor(Math.random() * tierPool.length)];
  return { ...ITEMS[id] };
}

/**
 * フロア配置アイテム：60%消費 / 40%装備
 */
export function treasureDrop(floorNum: number): ItemDef {
  const maxTier = Math.min(3, Math.floor((floorNum - 1) / 3));
  const id = Math.random() < 0.6
    ? _pickFromPool(CONSUM_POOL, maxTier)
    : _pickFromPool(EQUIP_POOL, maxTier);
  return { ...ITEMS[id] };
}

/** 露店カタログ（tier 別） */
export const SHOP_CATALOG: ShopEntry[] = [
  // tier 0
  { itemId: 'herb',           price: 8,   tier: 0 },
  { itemId: 'potion_sm',      price: 18,  tier: 0 },
  { itemId: 'ether_sm',       price: 18,  tier: 0 },
  { itemId: 'scroll_teleport',price: 15,  tier: 0 },
  { itemId: 'antidote',       price: 8,   tier: 0 },
  { itemId: 'dagger',         price: 22,  tier: 0 },
  { itemId: 'armor_cloth',    price: 20,  tier: 0 },
  { itemId: 'armor_leather',  price: 28,  tier: 0 },
  { itemId: 'scroll_poison',  price: 15,  tier: 0 },
  // tier 1
  { itemId: 'potion_md',      price: 40,  tier: 1 },
  { itemId: 'ether_md',       price: 42,  tier: 1 },
  { itemId: 'scroll_fire',    price: 35,  tier: 1 },
  { itemId: 'scroll_thunder', price: 35,  tier: 1 },
  { itemId: 'scroll_dark',    price: 38,  tier: 1 },
  { itemId: 'scroll_frost',   price: 40,  tier: 1 },
  { itemId: 'scroll_drain',   price: 38,  tier: 1 },
  { itemId: 'scroll_sleep',   price: 42,  tier: 1 },
  { itemId: 'scroll_chain',   price: 42,  tier: 1 },
  { itemId: 'scroll_wind',    price: 40,  tier: 1 },
  { itemId: 'sword_iron',     price: 55,  tier: 1 },
  { itemId: 'axe_iron',       price: 58,  tier: 1 },
  { itemId: 'spear',          price: 52,  tier: 1 },
  { itemId: 'bow',            price: 50,  tier: 1 },
  { itemId: 'armor_iron',     price: 55,  tier: 1 },
  { itemId: 'ring_atk',       price: 50,  tier: 1 },
  { itemId: 'ring_def',       price: 50,  tier: 1 },
  { itemId: 'amulet_hp',      price: 55,  tier: 1 },
  // tier 2
  { itemId: 'potion_lg',      price: 75,  tier: 2 },
  { itemId: 'elixir',         price: 120, tier: 2 },
  { itemId: 'ether_lg',       price: 80,  tier: 2 },
  { itemId: 'scroll_blizzard',price: 65,  tier: 2 },
  { itemId: 'scroll_meteor',  price: 90,  tier: 2 },
  { itemId: 'scroll_holy',    price: 70,  tier: 2 },
  { itemId: 'scroll_quake',   price: 75,  tier: 2 },
  { itemId: 'scroll_gravity', price: 80,  tier: 2 },
  { itemId: 'sword_silver',   price: 95,  tier: 2 },
  { itemId: 'staff_magic',    price: 100, tier: 2 },
  { itemId: 'hammer',         price: 105, tier: 2 },
  { itemId: 'crossbow',       price: 95,  tier: 2 },
  { itemId: 'longbow',        price: 90,  tier: 2 },
  { itemId: 'armor_mithril',  price: 105, tier: 2 },
  { itemId: 'armor_magic',    price: 100, tier: 2 },
  { itemId: 'charm_lucky',    price: 90,  tier: 2 },
  { itemId: 'brooch_mana',    price: 88,  tier: 2 },
  { itemId: 'bomb',           price: 60,  tier: 2 },
  { itemId: 'power_potion',   price: 70,  tier: 2 },
  // tier 3
  { itemId: 'sword_dragon',   price: 280, tier: 3 },
  { itemId: 'chaos_blade',    price: 260, tier: 3 },
  { itemId: 'divine_bow',     price: 250, tier: 3 },
  { itemId: 'thunder_spear',  price: 240, tier: 3 },
  { itemId: 'death_scythe',   price: 270, tier: 3 },
  { itemId: 'holy_sword',     price: 320, tier: 3 },
  { itemId: 'armor_dragon',   price: 260, tier: 3 },
  { itemId: 'armor_shadow',   price: 220, tier: 3 },
  { itemId: 'armor_holy',     price: 240, tier: 3 },
  { itemId: 'vampire_cape',   price: 200, tier: 3 },
  { itemId: 'ring_speed',     price: 180, tier: 3 },
  { itemId: 'amulet_mana',    price: 190, tier: 3 },
  { itemId: 'berserker_band', price: 175, tier: 3 },
  { itemId: 'titan_belt',     price: 210, tier: 3 },
  { itemId: 'revival_gem',    price: 350, tier: 3 },
  { itemId: 'full_ether',     price: 160, tier: 3 },
];

/** 不思議ダンジョン用ランダム初期装備 */
export function mysteryStartItems(): ItemDef[] {
  const weapons = ['dagger', 'sword_bronze', 'sword_iron', 'axe_iron', 'spear', 'bow'];
  const armors  = ['armor_cloth', 'armor_leather', 'armor_iron'];
  const consum  = ['herb', 'potion_sm', 'ether_sm', 'scroll_teleport', 'potion_md'];
  const pick = (arr: string[]): ItemDef => ({ ...ITEMS[arr[Math.floor(Math.random() * arr.length)]] });
  return [pick(weapons), pick(armors), pick(consum), pick(consum)];
}

/** アイテムの効果説明文 */
export function itemStatText(item: ItemDef): string {
  if (item.slot === 'consumable') {
    if (item.spellId)            return `魔法: ${item.spellId}`;
    if (item.healMp === 'full')  return 'MP全回復';
    if (item.healMp)             return `MP+${item.healMp}`;
    if (item.bombDmg)            return `爆発ダメージ${item.bombDmg}`;
    if (item.revive)             return '次の死亡時に復活';
    if (item.tempAtk)            return `ATK+${item.tempAtk}(${item.tempTurns}ターン)`;
    return item.heal === 'full' ? 'HP全回復' : `HP+${item.heal}`;
  }
  const parts: string[] = [];
  if (item.atk)               parts.push(`ATK${item.atk > 0 ? '+' : ''}${item.atk}`);
  if (item.def)               parts.push(`DEF${item.def > 0 ? '+' : ''}${item.def}`);
  if (item.maxHp)             parts.push(`MAXHP+${item.maxHp}`);
  if (item.maxMp)             parts.push(`MAXMP+${item.maxMp}`);
  if (item.spd)               parts.push(`SPD+${item.spd}`);
  if (item.lifeSteal)         parts.push(`吸血${Math.round(item.lifeSteal * 100)}%`);
  if (item.stunOnHit)         parts.push(`スタン${Math.round(item.stunOnHit * 100)}%`);
  if (item.poisonOnHit)       parts.push(`毒付与`);
  if (item.evasion)           parts.push(`回避${Math.round(item.evasion * 100)}%`);
  if (item.range && item.range > 1) parts.push(`射程${item.range}`);
  const aoeLabel: Record<AoeType, string> = { sweep: '薙払', cross: '十字', burst: '爆発' };
  if (item.aoe)               parts.push(`[${aoeLabel[item.aoe]}]`);
  if (item.durability !== undefined) {
    parts.push(`耐久${item.durability}/${item.maxDurability}`);
  }
  return parts.join(' ') || '—';
}
