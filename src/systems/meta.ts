// ─────────────────────────────────────────────
// meta.ts  メタ進行（魂と恒久強化）
//
// プレイヤーが死亡 / クリアするたびに「魂」を獲得し、
// 拠点の魂の祠で恒久強化を購入する。新規ゲーム時に強化が反映される。
// localStorage に独立して保存される（セーブスロットとは別）。
// ─────────────────────────────────────────────

import type { Player } from '../entities/player.js';

const KEY_SOULS    = 'meta_souls_v1';
const KEY_UPGRADES = 'meta_upgrades_v1';

// ── 強化定義 ───────────────────────────────────

export interface MetaUpgradeDef {
  id:        string;
  name:      string;
  desc:      string;
  /** 各 lv 必要な魂数 */
  costs:     number[];
  /** 強化適用関数（lv 0 のときも呼ばれることがあるので 0 ガードする） */
  apply(p: Player, lv: number): void;
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  {
    id: 'maxhp',
    name: '生命の刻印',
    desc: '基礎最大HPが lv×5 増える',
    costs: [3, 6, 12, 20, 30],
    apply: (p, lv) => { if (lv > 0) p.baseMaxHP += lv * 5; },
  },
  {
    id: 'gold',
    name: '黄金の予兆',
    desc: '冒険開始時に lv×50 ゴールドを所持',
    costs: [2, 4, 8, 14, 22],
    apply: (p, lv) => { if (lv > 0) p.gold += lv * 50; },
  },
  {
    id: 'atk',
    name: '闘志の刻印',
    desc: '基礎ATKが lv×1 増える',
    costs: [4, 8, 16, 28, 42],
    apply: (p, lv) => { if (lv > 0) p.baseAtk += lv; },
  },
  {
    id: 'def',
    name: '盾の刻印',
    desc: '基礎DEFが lv×1 増える',
    costs: [4, 8, 16, 28, 42],
    apply: (p, lv) => { if (lv > 0) p.baseDef += lv; },
  },
  {
    id: 'starter_potion',
    name: '初心者の祝福',
    desc: '冒険開始時にHP回復薬を lv 個所持',
    costs: [3, 6, 12],
    apply: (_p, _lv) => { /* main.js 側でアイテム付与 */ },
  },
];

export const MAX_UPGRADE_LV: Record<string, number> = Object.fromEntries(
  META_UPGRADES.map(u => [u.id, u.costs.length]),
);

// ── 永続ストレージ ──────────────────────────────

export function getSouls(): number {
  try {
    const raw = localStorage.getItem(KEY_SOULS);
    return raw ? Math.max(0, parseInt(raw, 10) | 0) : 0;
  } catch { return 0; }
}

export function setSouls(n: number): void {
  try { localStorage.setItem(KEY_SOULS, String(Math.max(0, n | 0))); } catch { /* ignore */ }
}

export function getUpgrades(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY_UPGRADES);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, number>;
    return obj && typeof obj === 'object' ? obj : {};
  } catch { return {}; }
}

export function setUpgrades(u: Record<string, number>): void {
  try { localStorage.setItem(KEY_UPGRADES, JSON.stringify(u)); } catch { /* ignore */ }
}

/** 指定強化の現在 lv を返す */
export function getUpgradeLv(id: string): number {
  return getUpgrades()[id] ?? 0;
}

/** 1 段階購入を試みる。成功なら true、魂不足や上限到達は false。 */
export function purchaseUpgrade(id: string): boolean {
  const def = META_UPGRADES.find(u => u.id === id);
  if (!def) return false;
  const ups   = getUpgrades();
  const curLv = ups[id] ?? 0;
  if (curLv >= def.costs.length) return false;
  const cost = def.costs[curLv]!;
  const souls = getSouls();
  if (souls < cost) return false;
  setSouls(souls - cost);
  ups[id] = curLv + 1;
  setUpgrades(ups);
  return true;
}

// ── 報酬計算 ────────────────────────────────────

/**
 * 冒険終了時に獲得する魂の数。
 * クリアでない場合（死亡 / 拠点帰還）も到達フロアに応じて少量獲得する。
 */
export function calcSoulsReward(maxFloorReached: number, cleared: boolean): number {
  const base = Math.max(0, Math.floor(maxFloorReached / 3));
  return cleared ? base + 5 : base;
}

/** 魂を加算する。負値は受け付けない。 */
export function addSouls(n: number): void {
  if (n <= 0) return;
  setSouls(getSouls() + n);
}

// ── プレイヤーへの適用 ──────────────────────────

/**
 * 新規キャラ生成直後の Player に対し、購入済みのメタ強化をすべて適用する。
 * 戻り値は「starter_potion の付与個数」など、main.js 側で使う追加情報。
 */
export function applyMetaUpgrades(p: Player): { starterPotions: number } {
  const ups = getUpgrades();
  for (const def of META_UPGRADES) {
    const lv = ups[def.id] ?? 0;
    if (lv > 0) def.apply(p, lv);
  }
  // baseMaxHP を変えたので現在 HP / maxHP も更新
  p.maxHP = p.totalMaxHP;
  p.hp    = p.maxHP;
  p.mp    = p.totalMaxMp;
  return { starterPotions: ups['starter_potion'] ?? 0 };
}
