// ─────────────────────────────────────────────
// craft.ts  武器合成ロジック
//
// クラフト屋（鍛冶）で 2 本の武器を合成し、1 本の強化武器にする。
// 基本ルール:
//   - どちらも slot === 'weapon' であること
//   - 結果の atk = max(a.atk, b.atk) + floor(min(a.atk, b.atk) * 0.5)
//   - tier     = min(3, max(a.tier, b.tier) + 1)
//   - 耐久     = maxDurability の合計
//   - range / spd は 大きい方を引き継ぐ
//   - aoe / aoeRange / lifeSteal / stunOnHit / poisonOnHit / evasion は
//     どちらかが持っていれば 強い方を引き継ぐ
//   - 名前は「◯ + △（合成名）」。アイコンは atk 大きい方のものを採用
//   - コスト = CRAFT_BASE_COST + (a.tier + b.tier) * CRAFT_COST_PER_TIER
// ─────────────────────────────────────────────
// @ts-check

import type { ItemDef, Tier } from '../data/equipment.js';
import { CRAFT_BASE_COST, CRAFT_COST_PER_TIER } from '../core/game-constants.js';

/** 合成可能か判定する（両方 weapon であればOK） */
export function canCraft(a: ItemDef, b: ItemDef): boolean {
  if (!a || !b) return false;
  if (a === b) return false; // 同一実体は不可
  return a.slot === 'weapon' && b.slot === 'weapon';
}

/** 合成コスト（ゴールド） */
export function craftCost(a: ItemDef, b: ItemDef): number {
  const tierSum = (a.tier ?? 0) + (b.tier ?? 0);
  return CRAFT_BASE_COST + tierSum * CRAFT_COST_PER_TIER;
}

/** undefined を避けて数値を取る */
function _n(v: number | undefined): number {
  return typeof v === 'number' ? v : 0;
}

/** 2本の武器を合成して新しい ItemDef を返す */
export function combineWeapons(a: ItemDef, b: ItemDef): ItemDef {
  const aAtk = _n(a.atk);
  const bAtk = _n(b.atk);
  const hi   = Math.max(aAtk, bAtk);
  const lo   = Math.min(aAtk, bAtk);
  const newAtk = hi + Math.floor(lo * 0.5);

  const tierMax: Tier = Math.min(3, Math.max(a.tier ?? 0, b.tier ?? 0) + 1) as Tier;

  const maxDur = _n(a.maxDurability) + _n(b.maxDurability);
  const newMaxDur = maxDur > 0 ? maxDur : undefined;

  // 強い方のベース（atk が高い方）を選ぶ
  const base = aAtk >= bAtk ? a : b;
  const sub  = aAtk >= bAtk ? b : a;

  // aoe: どちらかにあれば引き継ぐ（base 優先）
  const aoe      = base.aoe      ?? sub.aoe;
  const aoeRange = Math.max(_n(base.aoeRange), _n(sub.aoeRange)) || undefined;
  const range    = Math.max(_n(base.range),    _n(sub.range))    || undefined;
  const spd      = Math.max(_n(base.spd),      _n(sub.spd))      || undefined;

  const lifeSteal = Math.max(_n(base.lifeSteal), _n(sub.lifeSteal));
  const stunOnHit = Math.max(_n(base.stunOnHit), _n(sub.stunOnHit));
  const evasion   = Math.max(_n(base.evasion),   _n(sub.evasion));
  const poison    = base.poisonOnHit || sub.poisonOnHit;

  // 名前: ベースの名前に「＋」を付けて強化を示す
  const newName = `強化 ${base.name}`;
  const newId   = `crafted_${base.id}_${sub.id}_${Date.now().toString(36)}`;

  const result: ItemDef = {
    id:    newId,
    name:  newName,
    icon:  base.icon,
    color: base.color,
    slot:  'weapon',
    tier:  tierMax,
    atk:   newAtk,
  };

  if (base.spriteName) result.spriteName = base.spriteName;
  if (newMaxDur !== undefined) {
    result.maxDurability = newMaxDur;
    result.durability    = newMaxDur;
  }
  if (aoe)            result.aoe          = aoe;
  if (aoeRange)       result.aoeRange     = aoeRange;
  if (range && range > 1) result.range    = range;
  if (spd)            result.spd          = spd;
  if (lifeSteal > 0)  result.lifeSteal    = lifeSteal;
  if (stunOnHit > 0)  result.stunOnHit    = stunOnHit;
  if (evasion > 0)    result.evasion      = evasion;
  if (poison)         result.poisonOnHit  = true;

  // def / maxHp / maxMp は装備特性として継承（武器でも保持する）
  const def   = Math.max(_n(base.def), _n(sub.def));
  const maxHp = _n(base.maxHp) + _n(sub.maxHp);
  const maxMp = _n(base.maxMp) + _n(sub.maxMp);
  if (def   > 0) result.def   = def;
  if (maxHp > 0) result.maxHp = maxHp;
  if (maxMp > 0) result.maxMp = maxMp;

  return result;
}
