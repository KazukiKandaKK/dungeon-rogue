// ─────────────────────────────────────────────
// titles.ts  称号システム
//
// 累計プレイ実績から二つ名を付与する。プレイヤー名の上に表示され、
// 拠点NPC もランダム称号持ちで出歩く。選択UIは簡易（一覧とEnterで装備）。
//
// 実績データは localStorage（titles_stats_v1）に永続化。
// ─────────────────────────────────────────────

export type TitleCondKey = 'kills' | 'bossKills' | 'maxFloor' | 'goldEarned' | 'soulsEarned';

export interface TitleDef {
  id:    string;
  name:  string;
  icon:  string;
  color: string;
  desc:  string;
  cond: {
    key:       TitleCondKey;
    threshold: number;
  };
  /** 希少度：大きいほどレア（デフォルトの自動装備で優先） */
  rarity: number;
}

export const TITLES: readonly TitleDef[] = [
  // 討伐系
  { id: 'newbie_slayer', name: '新米の剣',     icon: '🔰', color: '#9ca3af', desc: '討伐 10 体',          cond: { key: 'kills',       threshold: 10   }, rarity: 1 },
  { id: 'beast_hunter',  name: '魔物狩り',     icon: '⚔',  color: '#f59e0b', desc: '討伐 100 体',         cond: { key: 'kills',       threshold: 100  }, rarity: 2 },
  { id: 'carnage_lord',  name: '千騎駆け',     icon: '🗡', color: '#ef4444', desc: '討伐 1000 体',        cond: { key: 'kills',       threshold: 1000 }, rarity: 4 },
  // ボス系
  { id: 'boss_slayer',   name: '竜殺し',       icon: '🐉', color: '#be123c', desc: 'ボス撃破 3 体',       cond: { key: 'bossKills',   threshold: 3    }, rarity: 3 },
  { id: 'boss_king',     name: '覇王',         icon: '👑', color: '#fde047', desc: 'ボス撃破 20 体',      cond: { key: 'bossKills',   threshold: 20   }, rarity: 5 },
  // 到達系
  { id: 'depth_10',      name: '階層の探究者', icon: '🔦', color: '#60a5fa', desc: '10F 到達',            cond: { key: 'maxFloor',    threshold: 10   }, rarity: 2 },
  { id: 'depth_30',      name: '深淵の歩行者', icon: '🕯', color: '#6366f1', desc: '30F 到達',            cond: { key: 'maxFloor',    threshold: 30   }, rarity: 3 },
  { id: 'depth_50',      name: '奈落の主',     icon: '🌀', color: '#a855f7', desc: '50F 到達',            cond: { key: 'maxFloor',    threshold: 50   }, rarity: 5 },
  // 金策
  { id: 'coin_hoarder',  name: '蓄財家',       icon: '💰', color: '#facc15', desc: '累計 1,000G 獲得',    cond: { key: 'goldEarned',  threshold: 1000 }, rarity: 2 },
  { id: 'tycoon',        name: '豪商',         icon: '💎', color: '#fbbf24', desc: '累計 10,000G 獲得',   cond: { key: 'goldEarned',  threshold: 10000}, rarity: 4 },
  // 魂
  { id: 'soul_collector',name: '魂の集い',     icon: '👻', color: '#c084fc', desc: '累計 30 魂 獲得',     cond: { key: 'soulsEarned', threshold: 30   }, rarity: 3 },
];

// ── 永続化 ──────────────────────────────────

const STATS_KEY  = 'titles_stats_v1';
const EQUIP_KEY  = 'titles_equip_v1';

interface TitleStats {
  kills:       number;
  bossKills:   number;
  maxFloor:    number;
  goldEarned:  number;
  soulsEarned: number;
}

function _loadStats(): TitleStats {
  const base: TitleStats = { kills: 0, bossKills: 0, maxFloor: 0, goldEarned: 0, soulsEarned: 0 };
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    return { ...base, ...(parsed as Partial<TitleStats>) };
  } catch { return base; }
}

function _saveStats(s: TitleStats): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {}
}

function _loadEquip(): string | null {
  try { return localStorage.getItem(EQUIP_KEY); } catch { return null; }
}

function _saveEquip(id: string | null): void {
  try {
    if (id) localStorage.setItem(EQUIP_KEY, id);
    else    localStorage.removeItem(EQUIP_KEY);
  } catch {}
}

// ── イベント ────────────────────────────────

function _bump(key: TitleCondKey, amount: number): void {
  const s = _loadStats();
  if (key === 'maxFloor') {
    if (amount > s.maxFloor) s.maxFloor = amount;
  } else {
    (s as unknown as Record<TitleCondKey, number>)[key] += amount;
  }
  _saveStats(s);
  // 新規達成があれば自動で最レアに切り替え（未選択または今の装備が下位の場合）
  _maybeAutoEquipTop();
}

export function reportKill(isBoss: boolean = false): void {
  _bump('kills', 1);
  if (isBoss) _bump('bossKills', 1);
}
export function reportFloor(floor: number): void { _bump('maxFloor', floor); }
export function reportGoldEarned(n: number): void { if (n > 0) _bump('goldEarned', n); }
export function reportSoulsEarned(n: number): void { if (n > 0) _bump('soulsEarned', n); }

// ── 取得系 ──────────────────────────────────

export function getStats(): TitleStats {
  return _loadStats();
}

/** 解放済み称号一覧（レア度降順） */
export function getUnlockedTitles(): TitleDef[] {
  const s = _loadStats();
  const v: Record<TitleCondKey, number> = {
    kills:       s.kills,
    bossKills:   s.bossKills,
    maxFloor:    s.maxFloor,
    goldEarned:  s.goldEarned,
    soulsEarned: s.soulsEarned,
  };
  return TITLES.filter(t => v[t.cond.key] >= t.cond.threshold)
               .sort((a, b) => b.rarity - a.rarity);
}

/** 現在装備中の称号。未装備なら null */
export function getActiveTitle(): TitleDef | null {
  const id = _loadEquip();
  if (!id) return null;
  const t = TITLES.find(x => x.id === id);
  if (!t) return null;
  // 条件を満たしていない古い装備は無効化
  const s = _loadStats();
  const v: Record<TitleCondKey, number> = {
    kills: s.kills, bossKills: s.bossKills, maxFloor: s.maxFloor,
    goldEarned: s.goldEarned, soulsEarned: s.soulsEarned,
  };
  if (v[t.cond.key] < t.cond.threshold) return null;
  return t;
}

/** 装備変更 */
export function setActiveTitle(id: string | null): void {
  _saveEquip(id);
}

function _maybeAutoEquipTop(): void {
  const cur = getActiveTitle();
  const top = getUnlockedTitles()[0] ?? null;
  if (!top) return;
  if (!cur) { _saveEquip(top.id); return; }
  if (top.rarity > cur.rarity) _saveEquip(top.id);
}

// ── NPC 用：決定的にランダム称号を割り当てる ──

/**
 * NPC の名前＋種族から決まるランダム称号（30% 未付与）。
 * プレイヤーのプレイ実績は反映しない（街の通行人用）。
 */
export function pickNpcTitle(seedKey: string): TitleDef | null {
  // 軽量ハッシュ → 0..999
  let h = 5381;
  for (let i = 0; i < seedKey.length; i++) h = (((h << 5) + h) + seedKey.charCodeAt(i)) | 0;
  const v = ((h >>> 0) % 1000) / 1000;
  if (v < 0.30) return null;
  // ランク付き重み: レア度が高いほど出にくい
  const pool = TITLES;
  const weights = pool.map(t => 1 / Math.max(1, t.rarity * t.rarity));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = ((h >>> 3) >>> 0) % 10000 / 10000 * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[0];
}
