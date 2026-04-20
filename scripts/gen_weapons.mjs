// ─────────────────────────────────────────────
// gen_weapons.mjs  100種の武器SVGとTSデータを自動生成
//   使用法: node scripts/gen_weapons.mjs
//   出力 :
//     - game/assets/weapons/<id>.svg (×100)
//     - game/src/data/weapons.ts  (ITEMS に結合される GENERATED_WEAPONS)
//   特徴:
//     - 決定論的な擬似乱数（シード固定）で冪等
//     - 既存手作りtier3武器（sword_dragon等）には触れない
// ─────────────────────────────────────────────

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const SVG_DIR   = resolve(ROOT, 'assets/weapons');
const TS_OUT    = resolve(ROOT, 'src/data/weapons.ts');

mkdirSync(SVG_DIR, { recursive: true });

// ── 決定論的 PRNG（mulberry32） ───────────────
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// ── 素材・色テーマ ───────────────────────────
const MATERIALS = [
  { id: 'bronze',   jp: '青銅',   base: '#b45309', hi: '#fbbf24', dk: '#78350f', hue: 30 },
  { id: 'iron',     jp: '鉄',     base: '#64748b', hi: '#cbd5e1', dk: '#334155', hue: 220 },
  { id: 'silver',   jp: '銀',     base: '#cbd5e1', hi: '#f1f5f9', dk: '#64748b', hue: 210 },
  { id: 'gold',     jp: '黄金',   base: '#fbbf24', hi: '#fde68a', dk: '#a16207', hue: 45 },
  { id: 'crystal',  jp: '水晶',   base: '#67e8f9', hi: '#cffafe', dk: '#0891b2', hue: 190 },
  { id: 'obsidian', jp: '黒曜',   base: '#1e293b', hi: '#475569', dk: '#020617', hue: 240 },
  { id: 'flame',    jp: '炎',     base: '#ef4444', hi: '#fecaca', dk: '#7f1d1d', hue: 10 },
  { id: 'frost',    jp: '氷',     base: '#7dd3fc', hi: '#e0f2fe', dk: '#075985', hue: 200 },
  { id: 'thunder',  jp: '雷',     base: '#facc15', hi: '#fef9c3', dk: '#854d0e', hue: 50 },
  { id: 'shadow',   jp: '影',     base: '#4c1d95', hi: '#8b5cf6', dk: '#1e1b4b', hue: 270 },
  { id: 'holy',     jp: '聖',     base: '#fde68a', hi: '#ffffff', dk: '#ca8a04', hue: 50 },
  { id: 'blood',    jp: '血',     base: '#9f1239', hi: '#fb7185', dk: '#4c0519', hue: 350 },
  { id: 'venom',    jp: '毒',     base: '#22c55e', hi: '#bbf7d0', dk: '#14532d', hue: 120 },
  { id: 'ancient',  jp: '古代',   base: '#a16207', hi: '#eab308', dk: '#422006', hue: 40 },
  { id: 'cosmic',   jp: '星辰',   base: '#7c3aed', hi: '#c4b5fd', dk: '#2e1065', hue: 260 },
];

// ── 武器アーキタイプ ─────────────────────────
const ARCHETYPES = ['sword', 'dagger', 'axe', 'spear', 'bow', 'crossbow', 'staff', 'hammer', 'scythe', 'katana'];
const TYPE_JP = {
  sword: '剣', dagger: '短剣', axe: '斧', spear: '槍', bow: '弓',
  crossbow: 'クロスボウ', staff: '杖', hammer: '鎚', scythe: '鎌', katana: '刀',
};
const TYPE_ICON = {
  sword: '⚔', dagger: '🗡', axe: '🪓', spear: '🔱', bow: '🏹',
  crossbow: '🎯', staff: '✨', hammer: '🔨', scythe: '🌒', katana: '⚔',
};

// ── SVGテンプレート（type別） ─────────────────
function svgWrap(inner, bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${inner}</svg>`;
}

function gradDef(id, base, hi, dk) {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="0.5" stop-color="${base}"/><stop offset="1" stop-color="${dk}"/></linearGradient></defs>`;
}

function svgSword(m) {
  return svgWrap(`${gradDef('g', m.base, m.hi, m.dk)}<path d="M32 6 L36 40 L32 46 L28 40 Z" fill="url(#g)" stroke="${m.dk}" stroke-width="1"/><rect x="22" y="40" width="20" height="4" fill="#78350f"/><rect x="30" y="44" width="4" height="12" fill="#92400e"/><circle cx="32" cy="58" r="3" fill="${m.hi}"/>`);
}
function svgDagger(m) {
  return svgWrap(`${gradDef('g', m.base, m.hi, m.dk)}<path d="M32 14 L35 36 L32 40 L29 36 Z" fill="url(#g)" stroke="${m.dk}" stroke-width="1"/><rect x="25" y="36" width="14" height="3" fill="#78350f"/><rect x="30" y="39" width="4" height="10" fill="#92400e"/>`);
}
function svgAxe(m) {
  return svgWrap(`${gradDef('g', m.base, m.hi, m.dk)}<rect x="30" y="10" width="4" height="44" fill="#78350f"/><path d="M34 14 Q54 18 54 32 Q54 46 34 38 Z" fill="url(#g)" stroke="${m.dk}" stroke-width="1"/><path d="M30 14 Q10 18 10 32 Q10 46 30 38 Z" fill="url(#g)" stroke="${m.dk}" stroke-width="1"/>`);
}
function svgSpear(m) {
  return svgWrap(`${gradDef('g', m.base, m.hi, m.dk)}<rect x="30" y="18" width="4" height="38" fill="#78350f"/><path d="M32 4 L38 18 L32 22 L26 18 Z" fill="url(#g)" stroke="${m.dk}" stroke-width="1"/>`);
}
function svgBow(m) {
  return svgWrap(`${gradDef('g', m.base, m.hi, m.dk)}<path d="M20 8 Q4 32 20 56" stroke="url(#g)" stroke-width="4" fill="none"/><line x1="20" y1="8" x2="20" y2="56" stroke="#e5e7eb" stroke-width="1"/><path d="M20 32 L34 32" stroke="${m.hi}" stroke-width="1.5"/>`);
}
function svgCrossbow(m) {
  return svgWrap(`${gradDef('g', m.base, m.hi, m.dk)}<rect x="10" y="30" width="44" height="4" fill="url(#g)"/><path d="M14 22 Q4 32 14 42" stroke="${m.dk}" stroke-width="3" fill="none"/><path d="M50 22 Q60 32 50 42" stroke="${m.dk}" stroke-width="3" fill="none"/><rect x="28" y="34" width="8" height="14" fill="#78350f"/>`);
}
function svgStaff(m) {
  return svgWrap(`${gradDef('g', m.base, m.hi, m.dk)}<rect x="30" y="18" width="4" height="40" fill="#78350f"/><circle cx="32" cy="14" r="10" fill="url(#g)" stroke="${m.dk}" stroke-width="1"/><circle cx="29" cy="11" r="3" fill="${m.hi}" opacity="0.8"/>`);
}
function svgHammer(m) {
  return svgWrap(`${gradDef('g', m.base, m.hi, m.dk)}<rect x="30" y="26" width="4" height="32" fill="#78350f"/><rect x="16" y="10" width="32" height="20" rx="3" fill="url(#g)" stroke="${m.dk}" stroke-width="1"/><rect x="20" y="14" width="10" height="4" fill="${m.hi}" opacity="0.6"/>`);
}
function svgScythe(m) {
  return svgWrap(`${gradDef('g', m.base, m.hi, m.dk)}<rect x="30" y="10" width="4" height="48" fill="#78350f"/><path d="M32 10 Q58 12 50 34 Q42 22 32 18 Z" fill="url(#g)" stroke="${m.dk}" stroke-width="1"/>`);
}
function svgKatana(m) {
  return svgWrap(`${gradDef('g', m.base, m.hi, m.dk)}<path d="M14 52 Q22 30 50 10 L52 12 Q26 32 16 54 Z" fill="url(#g)" stroke="${m.dk}" stroke-width="1"/><rect x="13" y="52" width="8" height="5" fill="#78350f" transform="rotate(-30 17 54)"/>`);
}
const SVG_FN = {
  sword: svgSword, dagger: svgDagger, axe: svgAxe, spear: svgSpear,
  bow: svgBow, crossbow: svgCrossbow, staff: svgStaff, hammer: svgHammer,
  scythe: svgScythe, katana: svgKatana,
};

// ── ステータス生成 ────────────────────────────
function rollStats(rng, tier) {
  if (tier === 0) return { atk: 2 + Math.floor(rng() * 2), dur: 15 + Math.floor(rng() * 11) };
  if (tier === 1) return { atk: 4 + Math.floor(rng() * 3), dur: 25 + Math.floor(rng() * 11) };
  if (tier === 2) return { atk: 7 + Math.floor(rng() * 3), dur: 35 + Math.floor(rng() * 11) };
  return { atk: 10 + Math.floor(rng() * 7), dur: 40 + Math.floor(rng() * 16) };
}

function applyArchetype(rng, type, stats, tier) {
  const w = { atk: stats.atk, durability: stats.dur, maxDurability: stats.dur };
  if (type === 'sword') {
    if (rng() < 0.30) w.aoe = 'sweep';
  } else if (type === 'axe') {
    w.aoe = 'sweep';
  } else if (type === 'spear') {
    w.range = 2;
  } else if (type === 'bow') {
    w.range = 4 + Math.floor(rng() * 2);
  } else if (type === 'crossbow') {
    w.range = 5 + Math.floor(rng() * 2);
  } else if (type === 'staff') {
    if (rng() < 0.50) { w.aoe = 'cross'; w.aoeRange = 1; }
  } else if (type === 'hammer') {
    w.aoe = 'burst'; w.aoeRange = 1;
  } else if (type === 'scythe') {
    w.aoe = 'cross'; w.aoeRange = 2;
    if (tier === 3) w.lifeSteal = 0.2;
  } else if (type === 'katana') {
    if (rng() < 0.30) w.aoe = 'sweep';
  } else if (type === 'dagger') {
    // no aoe
  }

  // tier3 特別効果
  if (tier === 3 && rng() < 0.60) {
    const effects = ['lifeSteal', 'stunOnHit', 'poisonOnHit', 'aoe'];
    const eff = pick(rng, effects);
    if (eff === 'lifeSteal' && !w.lifeSteal)       w.lifeSteal   = 0.2 + rng() * 0.15;
    else if (eff === 'stunOnHit')                  w.stunOnHit   = 0.2 + rng() * 0.15;
    else if (eff === 'poisonOnHit')                w.poisonOnHit = true;
    else if (eff === 'aoe' && !w.aoe) { w.aoe = 'sweep'; }
  }
  return w;
}

// ── 生成処理 ──────────────────────────────────
const RNG = makeRng(0xC0FFEE);

// tier分布: 25/30/25/20 = 100
const tierCounts = [25, 30, 25, 20];
const generated = [];
const usedIds   = new Set();

for (let tier = 0; tier <= 3; tier++) {
  for (let i = 0; i < tierCounts[tier]; i++) {
    const type = ARCHETYPES[(tier * 7 + i) % ARCHETYPES.length]; // バラけさせる
    const mat  = MATERIALS[(tier * 3 + i) % MATERIALS.length];
    let baseId = `gen_${type}_${mat.id}_t${tier}`;
    let id = baseId;
    let suffix = 1;
    while (usedIds.has(id)) { id = `${baseId}_${suffix++}`; }
    usedIds.add(id);

    const stats = rollStats(RNG, tier);
    const props = applyArchetype(RNG, type, stats, tier);

    const jpName = `${mat.jp}の${TYPE_JP[type]}`;
    const icon   = TYPE_ICON[type];
    const color  = mat.base;

    // SVG 書き出し
    const svg = SVG_FN[type](mat);
    writeFileSync(resolve(SVG_DIR, `${id}.svg`), svg, 'utf8');

    generated.push({
      id,
      name:  jpName,
      icon,
      color,
      slot:  'weapon',
      tier,
      spriteName: `weapon_${id}`,
      ...props,
    });
  }
}

// ── TSファイル出力 ────────────────────────────
function jsonLiteral(obj) {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    let val;
    if (typeof v === 'string')      val = JSON.stringify(v);
    else if (typeof v === 'number') val = String(v);
    else if (typeof v === 'boolean')val = String(v);
    else                            val = JSON.stringify(v);
    parts.push(`${k}: ${val}`);
  }
  return `{ ${parts.join(', ')} }`;
}

const header = `// ─────────────────────────────────────────────
// weapons.ts  自動生成（scripts/gen_weapons.mjs）
//   このファイルは手動編集しない。再生成で上書きされる。
//   生成数: ${generated.length}
// ─────────────────────────────────────────────
import type { ItemDef } from './equipment.js';

export const GENERATED_WEAPONS: ItemDef[] = [
`;
const body = generated.map(w => `  ${jsonLiteral(w)},`).join('\n');
const footer = `
];
`;
writeFileSync(TS_OUT, header + body + footer, 'utf8');

// ── サマリー ──────────────────────────────────
const byTier = [0, 0, 0, 0];
for (const w of generated) byTier[w.tier]++;
console.log(`✓ 生成: ${generated.length}個`);
console.log(`  tier0: ${byTier[0]}, tier1: ${byTier[1]}, tier2: ${byTier[2]}, tier3: ${byTier[3]}`);
console.log(`  SVG  : ${SVG_DIR}`);
console.log(`  TS   : ${TS_OUT}`);
