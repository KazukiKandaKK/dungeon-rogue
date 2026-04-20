// ─────────────────────────────────────────────
// gen_icons.mjs  手作りアイテム + UI/ワールドアイコンの SVG と TS データを自動生成
//   使用法: node scripts/gen_icons.mjs
//   出力 :
//     - game/assets/icons/<id>.svg
//     - game/src/data/icon_sprites.ts  （GENERATED_ICONS を export）
//   特徴:
//     - 冪等（決定論的）
//     - 64×64 viewBox、32×32 タイルでも読みやすいクリーンなシルエット
//     - equipment.ts の HANDCRAFTED に定義された id・color と対応する
// ─────────────────────────────────────────────

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const SVG_DIR   = resolve(ROOT, 'assets/icons');
const TS_OUT    = resolve(ROOT, 'src/data/icon_sprites.ts');

mkdirSync(SVG_DIR, { recursive: true });

// ── ユーティリティ ─────────────────────────────
function svgWrap(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${inner}</svg>`;
}
function linearGrad(id, c1, c2) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
}
function radialGrad(id, c1, c2) {
  return `<radialGradient id="${id}" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`;
}
function shade(hex, f) {
  // f in [-1,1], negative = darker, positive = lighter
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  const r = parseInt(n.substring(0, 2), 16);
  const g = parseInt(n.substring(2, 4), 16);
  const b = parseInt(n.substring(4, 6), 16);
  const mix = (c) => {
    const t = f < 0 ? 0 : 255;
    const p = Math.abs(f);
    return Math.round(c + (t - c) * p);
  };
  const toHex = (c) => c.toString(16).padStart(2, '0');
  return '#' + toHex(mix(r)) + toHex(mix(g)) + toHex(mix(b));
}

// ── 個別アイコン描画関数 ──────────────────────
function svgPotion(color) {
  // 小さな丸い薬瓶
  const dk = shade(color, -0.35);
  const hi = shade(color, 0.35);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <rect x="27" y="12" width="10" height="6" fill="#78350f"/>
    <rect x="28" y="8" width="8" height="5" fill="#92400e"/>
    <path d="M22 24 Q20 24 20 28 L20 52 Q20 58 26 58 L38 58 Q44 58 44 52 L44 28 Q44 24 42 24 Z" fill="url(#g)" stroke="${dk}" stroke-width="1.2"/>
    <rect x="26" y="18" width="12" height="8" fill="rgba(255,255,255,0.2)"/>
    <ellipse cx="28" cy="38" rx="3" ry="7" fill="rgba(255,255,255,0.35)"/>
  `);
}

function svgFlask(color) {
  // 円錐フラスコ（マナ系）
  const dk = shade(color, -0.35);
  const hi = shade(color, 0.35);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <rect x="28" y="8" width="8" height="4" fill="#78350f"/>
    <path d="M26 12 L26 24 L14 54 Q12 60 20 60 L44 60 Q52 60 50 54 L38 24 L38 12 Z" fill="url(#g)" stroke="${dk}" stroke-width="1.2"/>
    <path d="M22 38 Q32 34 42 38 L46 52 Q32 55 18 52 Z" fill="rgba(255,255,255,0.18)"/>
    <circle cx="28" cy="46" r="2" fill="rgba(255,255,255,0.35)"/>
    <circle cx="36" cy="50" r="1.5" fill="rgba(255,255,255,0.35)"/>
  `);
}

function svgHerb(color) {
  const dk = shade(color, -0.35);
  return svgWrap(`
    <path d="M32 58 L32 34" stroke="#78350f" stroke-width="3"/>
    <path d="M32 34 Q14 28 12 14 Q28 18 32 34 Z" fill="${color}" stroke="${dk}" stroke-width="1"/>
    <path d="M32 34 Q50 28 52 14 Q36 18 32 34 Z" fill="${color}" stroke="${dk}" stroke-width="1"/>
    <path d="M32 30 Q26 20 28 10 Q36 14 32 30 Z" fill="${shade(color, 0.2)}" stroke="${dk}" stroke-width="1"/>
  `);
}

function svgElixir(color) {
  // 星型の輝き
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${radialGrad('g', hi, dk)}</defs>
    <rect x="28" y="8" width="8" height="4" fill="#fbbf24"/>
    <path d="M22 14 L22 52 Q22 60 32 60 Q42 60 42 52 L42 14 Z" fill="url(#g)" stroke="${dk}" stroke-width="1.2"/>
    <path d="M32 22 L34 30 L42 32 L34 34 L32 42 L30 34 L22 32 L30 30 Z" fill="rgba(255,255,255,0.8)"/>
  `);
}

function svgScroll(color) {
  const dk = shade(color, -0.3);
  return svgWrap(`
    <rect x="8" y="20" width="48" height="24" rx="2" fill="#fef3c7" stroke="#b45309" stroke-width="1"/>
    <ellipse cx="10" cy="32" rx="4" ry="12" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
    <ellipse cx="54" cy="32" rx="4" ry="12" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
    <line x1="18" y1="26" x2="46" y2="26" stroke="${color}" stroke-width="1.5"/>
    <line x1="18" y1="32" x2="46" y2="32" stroke="${color}" stroke-width="1.5"/>
    <line x1="18" y1="38" x2="40" y2="38" stroke="${color}" stroke-width="1.5"/>
    <circle cx="32" cy="14" r="3" fill="${color}" stroke="${dk}" stroke-width="1"/>
  `);
}

function svgBomb(color) {
  const dk = shade(color, -0.4);
  return svgWrap(`
    <circle cx="32" cy="40" r="18" fill="${color}" stroke="${dk}" stroke-width="1.5"/>
    <circle cx="26" cy="34" r="4" fill="rgba(255,255,255,0.3)"/>
    <rect x="30" y="16" width="4" height="8" fill="#78350f"/>
    <path d="M34 18 Q42 12 40 6" stroke="#fbbf24" stroke-width="2" fill="none"/>
    <circle cx="40" cy="6" r="3" fill="#f97316"/>
    <circle cx="40" cy="6" r="1.5" fill="#fde68a"/>
  `);
}

function svgGem(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <path d="M32 8 L52 26 L32 58 L12 26 Z" fill="url(#g)" stroke="${dk}" stroke-width="1.5"/>
    <path d="M32 8 L52 26 L32 26 L12 26 Z" fill="rgba(255,255,255,0.3)"/>
    <path d="M20 26 L32 58 L32 26 Z" fill="rgba(0,0,0,0.15)"/>
  `);
}

// 武器系
function svgSword(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <path d="M32 4 L36 38 L32 44 L28 38 Z" fill="url(#g)" stroke="${dk}" stroke-width="1"/>
    <rect x="20" y="38" width="24" height="4" fill="#78350f"/>
    <rect x="30" y="42" width="4" height="14" fill="#92400e"/>
    <circle cx="32" cy="58" r="3.5" fill="${hi}"/>
  `);
}
function svgDagger(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <path d="M32 10 L35 34 L32 40 L29 34 Z" fill="url(#g)" stroke="${dk}" stroke-width="1"/>
    <rect x="25" y="34" width="14" height="3" fill="#78350f"/>
    <rect x="30" y="37" width="4" height="14" fill="#92400e"/>
  `);
}
function svgAxe(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <rect x="30" y="6" width="4" height="52" fill="#78350f"/>
    <path d="M34 12 Q54 16 54 32 Q54 44 34 38 Z" fill="url(#g)" stroke="${dk}" stroke-width="1"/>
  `);
}
function svgHammer(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <rect x="30" y="22" width="4" height="36" fill="#78350f"/>
    <rect x="14" y="8" width="36" height="22" rx="3" fill="url(#g)" stroke="${dk}" stroke-width="1"/>
    <rect x="18" y="12" width="10" height="6" fill="rgba(255,255,255,0.3)"/>
  `);
}
function svgSpear(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <rect x="30" y="18" width="4" height="40" fill="#78350f"/>
    <path d="M32 2 L38 18 L32 22 L26 18 Z" fill="url(#g)" stroke="${dk}" stroke-width="1"/>
  `);
}
function svgBow(color) {
  const dk = shade(color, -0.3);
  return svgWrap(`
    <path d="M18 6 Q4 32 18 58" stroke="${color}" stroke-width="4" fill="none"/>
    <path d="M18 6 Q4 32 18 58" stroke="${dk}" stroke-width="1" fill="none"/>
    <line x1="18" y1="6" x2="18" y2="58" stroke="#e5e7eb" stroke-width="1"/>
    <path d="M18 32 L40 32" stroke="#78350f" stroke-width="1.5"/>
    <path d="M36 28 L42 32 L36 36 Z" fill="#e5e7eb"/>
  `);
}
function svgCrossbow(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <rect x="8" y="30" width="48" height="4" fill="url(#g)"/>
    <path d="M12 22 Q2 32 12 42" stroke="${dk}" stroke-width="3" fill="none"/>
    <path d="M52 22 Q62 32 52 42" stroke="${dk}" stroke-width="3" fill="none"/>
    <rect x="28" y="34" width="8" height="16" fill="#78350f"/>
  `);
}
function svgStaff(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${radialGrad('g', hi, dk)}</defs>
    <rect x="30" y="18" width="4" height="44" fill="#78350f"/>
    <circle cx="32" cy="14" r="12" fill="url(#g)" stroke="${dk}" stroke-width="1"/>
    <circle cx="29" cy="11" r="3" fill="rgba(255,255,255,0.7)"/>
  `);
}
function svgScythe(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <rect x="30" y="8" width="4" height="52" fill="#78350f"/>
    <path d="M32 8 Q58 10 50 34 Q42 20 32 16 Z" fill="url(#g)" stroke="${dk}" stroke-width="1"/>
  `);
}

// 防具系
function svgHelm(color) {
  // 兜
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <path d="M12 34 Q12 12 32 10 Q52 12 52 34 L52 42 L48 42 L48 50 L40 50 L40 42 L36 42 L36 46 L28 46 L28 42 L24 42 L24 50 L16 50 L16 42 L12 42 Z" fill="url(#g)" stroke="${dk}" stroke-width="1.2"/>
    <path d="M26 22 L26 36 L38 36 L38 22 Z" fill="#1f2937"/>
    <path d="M28 26 L28 32 L36 32 L36 26 Z" fill="#fef3c7"/>
  `);
}
function svgCrown(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <path d="M10 46 L14 18 L22 30 L32 14 L42 30 L50 18 L54 46 Z" fill="url(#g)" stroke="${dk}" stroke-width="1.2"/>
    <rect x="10" y="46" width="44" height="8" fill="${shade(color, -0.1)}" stroke="${dk}" stroke-width="1"/>
    <circle cx="14" cy="18" r="3" fill="#ef4444"/>
    <circle cx="32" cy="14" r="3" fill="#60a5fa"/>
    <circle cx="50" cy="18" r="3" fill="#4ade80"/>
  `);
}
function svgDragonHelm(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <path d="M10 44 Q10 14 32 10 Q54 14 54 44 L48 50 L40 44 L32 50 L24 44 L16 50 Z" fill="url(#g)" stroke="${dk}" stroke-width="1.2"/>
    <path d="M18 8 L24 18 M32 4 L32 16 M46 8 L40 18" stroke="${dk}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="24" cy="28" r="3" fill="#facc15"/>
    <circle cx="40" cy="28" r="3" fill="#facc15"/>
  `);
}
function svgArmor(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <path d="M16 14 L24 10 L32 14 L40 10 L48 14 L52 22 L48 58 L40 54 L32 58 L24 54 L16 58 L12 22 Z" fill="url(#g)" stroke="${dk}" stroke-width="1.2"/>
    <path d="M32 14 L32 58" stroke="${dk}" stroke-width="1"/>
    <circle cx="26" cy="28" r="2" fill="${shade(color, -0.2)}"/>
    <circle cx="38" cy="28" r="2" fill="${shade(color, -0.2)}"/>
    <circle cx="26" cy="42" r="2" fill="${shade(color, -0.2)}"/>
    <circle cx="38" cy="42" r="2" fill="${shade(color, -0.2)}"/>
  `);
}
function svgCloak(color) {
  const dk = shade(color, -0.3);
  return svgWrap(`
    <path d="M12 12 L32 8 L52 12 L56 58 L40 54 L32 58 L24 54 L8 58 Z" fill="${color}" stroke="${dk}" stroke-width="1.2"/>
    <path d="M28 10 L28 58 M36 10 L36 58" stroke="${dk}" stroke-width="0.8" opacity="0.5"/>
  `);
}
function svgBelt(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <rect x="4" y="24" width="56" height="16" rx="2" fill="url(#g)" stroke="${dk}" stroke-width="1.2"/>
    <rect x="26" y="20" width="12" height="24" rx="2" fill="${shade(color, -0.15)}" stroke="${dk}" stroke-width="1.2"/>
    <circle cx="32" cy="32" r="3" fill="#fbbf24" stroke="${dk}" stroke-width="1"/>
  `);
}
function svgBoots(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <path d="M20 10 L32 10 L32 42 L52 42 L52 54 L10 54 L10 42 L20 42 Z" fill="url(#g)" stroke="${dk}" stroke-width="1.2"/>
    <rect x="10" y="48" width="42" height="6" fill="${shade(color, -0.3)}"/>
    <path d="M20 20 L32 20" stroke="${dk}" stroke-width="1"/>
    <path d="M20 28 L32 28" stroke="${dk}" stroke-width="1"/>
  `);
}
function svgSwiftBoots(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <path d="M18 10 L30 10 L30 42 L52 42 L52 54 L8 54 L8 42 L18 42 Z" fill="url(#g)" stroke="${dk}" stroke-width="1.2"/>
    <path d="M52 14 L60 18 M48 22 L60 26 M44 30 L56 34" stroke="${shade(color, 0.5)}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
  `);
}

// アクセサリ
function svgRing(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${radialGrad('g', hi, dk)}</defs>
    <circle cx="32" cy="40" r="16" fill="none" stroke="${shade(color, -0.1)}" stroke-width="5"/>
    <circle cx="32" cy="40" r="16" fill="none" stroke="${hi}" stroke-width="1.2"/>
    <path d="M32 20 L38 12 L26 12 Z" fill="url(#g)" stroke="${dk}" stroke-width="1"/>
    <circle cx="32" cy="16" r="2" fill="rgba(255,255,255,0.8)"/>
  `);
}
function svgAmulet(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${radialGrad('g', hi, dk)}</defs>
    <path d="M20 10 Q32 6 44 10" stroke="#78350f" stroke-width="2" fill="none"/>
    <path d="M22 18 L42 18 L44 26 L32 48 L20 26 Z" fill="url(#g)" stroke="${dk}" stroke-width="1.2"/>
    <circle cx="32" cy="28" r="5" fill="${shade(color, -0.2)}"/>
  `);
}
function svgCharm(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${radialGrad('g', hi, dk)}</defs>
    <path d="M32 6 L38 24 L58 24 L42 36 L48 56 L32 44 L16 56 L22 36 L6 24 L26 24 Z" fill="url(#g)" stroke="${dk}" stroke-width="1.2"/>
  `);
}
function svgBrooch(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${radialGrad('g', hi, dk)}</defs>
    <circle cx="32" cy="32" r="22" fill="${shade(color, -0.3)}" stroke="${dk}" stroke-width="1.5"/>
    <circle cx="32" cy="32" r="14" fill="url(#g)" stroke="${dk}" stroke-width="1"/>
    <circle cx="26" cy="26" r="3" fill="rgba(255,255,255,0.7)"/>
  `);
}
function svgCape(color) {
  const dk = shade(color, -0.3);
  return svgWrap(`
    <path d="M20 8 L32 6 L44 8 L56 56 L44 52 L32 58 L20 52 L8 56 Z" fill="${color}" stroke="${dk}" stroke-width="1.2"/>
    <path d="M20 8 L24 22 L20 52 M44 8 L40 22 L44 52" stroke="${dk}" stroke-width="0.8" opacity="0.5" fill="none"/>
    <circle cx="32" cy="14" r="3" fill="${shade(color, -0.3)}"/>
  `);
}
function svgWing(color) {
  // 疾風の指輪 (風)
  const dk = shade(color, -0.3);
  return svgWrap(`
    <circle cx="32" cy="40" r="14" fill="none" stroke="${color}" stroke-width="4"/>
    <path d="M8 22 Q18 20 24 24 M6 30 Q16 28 22 32 M10 38 Q20 36 26 40" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M40 22 L44 18 L40 14 Z" fill="${dk}"/>
  `);
}
function svgFireFist(color) {
  // 戦鬼の腕輪
  const dk = shade(color, -0.3);
  return svgWrap(`
    <rect x="14" y="28" width="36" height="18" rx="4" fill="${shade(color, -0.1)}" stroke="${dk}" stroke-width="1.5"/>
    <path d="M20 28 Q16 16 24 8 Q26 20 28 24 Q30 14 34 8 Q36 20 38 24 Q40 14 44 8 Q46 20 44 28" fill="${color}" stroke="${dk}" stroke-width="1"/>
    <circle cx="32" cy="37" r="4" fill="${shade(color, 0.3)}"/>
  `);
}
function svgTitanBelt(color) {
  const dk = shade(color, -0.3);
  const hi = shade(color, 0.4);
  return svgWrap(`
    <defs>${linearGrad('g', hi, dk)}</defs>
    <rect x="2" y="22" width="60" height="20" rx="2" fill="url(#g)" stroke="${dk}" stroke-width="1.5"/>
    <rect x="24" y="16" width="16" height="32" rx="2" fill="${shade(color, -0.2)}" stroke="${dk}" stroke-width="1.2"/>
    <circle cx="32" cy="32" r="5" fill="#fbbf24" stroke="${dk}" stroke-width="1.2"/>
    <path d="M32 28 L32 36 M28 32 L36 32" stroke="${dk}" stroke-width="1.5"/>
  `);
}

// UI/ワールド
function svgShop() {
  return svgWrap(`
    <rect x="6" y="22" width="52" height="36" fill="#78350f" stroke="#451a03" stroke-width="1.2"/>
    <path d="M4 22 L60 22 L60 16 Q60 12 56 12 L8 12 Q4 12 4 16 Z" fill="#b91c1c"/>
    <path d="M4 12 Q12 12 12 22 Q12 12 20 12 Q20 22 28 22 Q28 12 36 12 Q36 22 44 22 Q44 12 52 12 Q52 22 60 22 L60 16 Q60 12 56 12 L8 12 Q4 12 4 16 Z" fill="#f59e0b"/>
    <rect x="14" y="30" width="12" height="14" fill="#1e293b" stroke="#0f172a" stroke-width="1"/>
    <rect x="32" y="30" width="18" height="20" fill="#1e293b" stroke="#0f172a" stroke-width="1"/>
    <rect x="36" y="34" width="4" height="6" fill="#fde68a"/>
    <rect x="42" y="34" width="4" height="6" fill="#fde68a"/>
    <rect x="18" y="34" width="4" height="6" fill="#fde68a"/>
    <rect x="6" y="56" width="52" height="4" fill="#451a03"/>
  `);
}
function svgCasino() {
  return svgWrap(`
    <rect x="6" y="10" width="52" height="48" rx="4" fill="#1c1510" stroke="#f59e0b" stroke-width="1.5"/>
    <rect x="12" y="18" width="40" height="20" rx="3" fill="#0f172a" stroke="#f59e0b" stroke-width="1"/>
    <text x="22" y="34" font-family="serif" font-size="14" fill="#e2e8f0" font-weight="bold">♠</text>
    <text x="32" y="34" font-family="serif" font-size="14" fill="#f87171" font-weight="bold">♥</text>
    <text x="42" y="34" font-family="serif" font-size="14" fill="#f87171" font-weight="bold">♦</text>
    <circle cx="18" cy="48" r="3" fill="#f59e0b"/>
    <circle cx="32" cy="48" r="3" fill="#ef4444"/>
    <circle cx="46" cy="48" r="3" fill="#4ade80"/>
  `);
}
function svgStall() {
  return svgWrap(`
    <rect x="6" y="30" width="52" height="28" fill="#78350f" stroke="#451a03" stroke-width="1.2"/>
    <path d="M4 28 L60 28 L54 14 L10 14 Z" fill="#b91c1c" stroke="#7f1d1d" stroke-width="1"/>
    <path d="M4 28 L10 14 M16 14 L14 28 M26 14 L22 28 M38 14 L36 28 M48 14 L46 28 M54 14 L56 28" stroke="#fbbf24" stroke-width="1.5"/>
    <rect x="14" y="36" width="10" height="14" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
    <rect x="28" y="36" width="10" height="14" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
    <rect x="42" y="36" width="10" height="14" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
  `);
}
function svgLoan() {
  return svgWrap(`
    <rect x="6" y="22" width="52" height="34" fill="#92400e" stroke="#451a03" stroke-width="1.2"/>
    <path d="M4 22 L60 22 L56 14 L8 14 Z" fill="#7f1d1d" stroke="#451a03" stroke-width="1"/>
    <rect x="14" y="28" width="6" height="22" fill="#fde68a"/>
    <rect x="24" y="28" width="6" height="22" fill="#fde68a"/>
    <rect x="34" y="28" width="6" height="22" fill="#fde68a"/>
    <rect x="44" y="28" width="6" height="22" fill="#fde68a"/>
    <text x="32" y="20" font-family="serif" font-size="10" fill="#fbbf24" font-weight="bold" text-anchor="middle">$</text>
  `);
}
function svgPortal() {
  return svgWrap(`
    <defs>${radialGrad('gp', '#c084fc', '#1e1b4b')}</defs>
    <ellipse cx="32" cy="32" rx="22" ry="26" fill="url(#gp)" stroke="#7c3aed" stroke-width="2"/>
    <ellipse cx="32" cy="32" rx="14" ry="18" fill="#1e1b4b" opacity="0.6"/>
    <circle cx="28" cy="24" r="2" fill="#fde047"/>
    <circle cx="38" cy="36" r="1.5" fill="#fde047"/>
    <circle cx="30" cy="42" r="1.2" fill="#fde047"/>
  `);
}
function svgStairs() {
  return svgWrap(`
    <rect x="8" y="44" width="48" height="12" fill="#475569" stroke="#1e293b" stroke-width="1"/>
    <rect x="16" y="32" width="40" height="12" fill="#64748b" stroke="#1e293b" stroke-width="1"/>
    <rect x="24" y="20" width="32" height="12" fill="#94a3b8" stroke="#1e293b" stroke-width="1"/>
    <rect x="32" y="8" width="24" height="12" fill="#cbd5e1" stroke="#1e293b" stroke-width="1"/>
    <path d="M8 44 L56 20 L56 8" stroke="#0f172a" stroke-width="0.8" fill="none" opacity="0.5"/>
  `);
}
function svgBoss() {
  const dk = '#1e293b';
  return svgWrap(`
    <path d="M32 6 L40 16 L54 14 L50 28 L58 38 L44 42 L40 56 L32 50 L24 56 L20 42 L6 38 L14 28 L10 14 L24 16 Z" fill="#dc2626" stroke="${dk}" stroke-width="1.5"/>
    <circle cx="26" cy="28" r="3" fill="#fde047"/>
    <circle cx="38" cy="28" r="3" fill="#fde047"/>
    <path d="M24 38 L40 38 L36 44 L28 44 Z" fill="${dk}"/>
  `);
}

// ── 手作りアイテム定義 ─────────────────────────
// equipment.ts の HANDCRAFTED と同期した id → (描画関数, color)
const ITEMS = [
  // 消費（ポーション系）
  ['herb',         svgHerb,    '#4ade80'],
  ['potion_sm',    svgPotion,  '#86efac'],
  ['potion_md',    svgPotion,  '#34d399'],
  ['potion_lg',    svgPotion,  '#10b981'],
  ['elixir',       svgElixir,  '#fbbf24'],
  ['antidote',     svgHerb,    '#86efac'],
  ['ether_sm',     svgFlask,   '#818cf8'],
  ['ether_md',     svgFlask,   '#6366f1'],
  ['ether_lg',     svgFlask,   '#4f46e5'],
  ['full_ether',   svgFlask,   '#818cf8'],
  ['bomb',         svgBomb,    '#dc2626'],
  ['revival_gem',  svgGem,     '#34d399'],
  ['power_potion', svgPotion,  '#f97316'],
  // 巻物
  ['scroll_fire',     svgScroll, '#f97316'],
  ['scroll_thunder',  svgScroll, '#fbbf24'],
  ['scroll_blizzard', svgScroll, '#7dd3fc'],
  ['scroll_teleport', svgScroll, '#c084fc'],
  ['scroll_meteor',   svgScroll, '#ef4444'],
  ['scroll_dark',     svgScroll, '#7c3aed'],
  ['scroll_frost',    svgScroll, '#7dd3fc'],
  ['scroll_poison',   svgScroll, '#4ade80'],
  ['scroll_drain',    svgScroll, '#f43f5e'],
  ['scroll_sleep',    svgScroll, '#a78bfa'],
  ['scroll_holy',     svgScroll, '#fde68a'],
  ['scroll_quake',    svgScroll, '#92400e'],
  ['scroll_chain',    svgScroll, '#fbbf24'],
  ['scroll_wind',     svgScroll, '#d1fae5'],
  ['scroll_gravity',  svgScroll, '#6366f1'],
  // 武器（近接）
  ['dagger',       svgDagger, '#94a3b8'],
  ['sword_bronze', svgSword,  '#b45309'],
  ['sword_iron',   svgSword,  '#78716c'],
  ['sword_silver', svgSword,  '#cbd5e1'],
  ['staff_magic',  svgStaff,  '#c084fc'],
  ['axe_iron',     svgAxe,    '#64748b'],
  ['hammer',       svgHammer, '#94a3b8'],
  ['spear',        svgSpear,  '#7c3aed'],
  ['bow',          svgBow,    '#92400e'],
  ['crossbow',     svgCrossbow,'#7c3aed'],
  ['longbow',      svgBow,    '#78350f'],
  // 武器 tier3
  ['sword_dragon',  svgSword,  '#ef4444'],
  ['chaos_blade',   svgSword,  '#7c3aed'],
  ['divine_bow',    svgBow,    '#fde68a'],
  ['thunder_spear', svgSpear,  '#fbbf24'],
  ['death_scythe',  svgScythe, '#334155'],
  ['holy_sword',    svgSword,  '#fef9c3'],
  // 胴鎧
  ['armor_cloth',   svgCloak, '#fde68a'],
  ['armor_leather', svgArmor, '#92400e'],
  ['armor_iron',    svgArmor, '#475569'],
  ['armor_mithril', svgArmor, '#67e8f9'],
  ['armor_magic',   svgArmor, '#a855f7'],
  ['armor_dragon',  svgArmor, '#dc2626'],
  ['armor_shadow',  svgCloak, '#1e1b4b'],
  ['armor_holy',    svgArmor, '#fef3c7'],
  // 頭防具
  ['helm_leather', svgHelm,       '#92400e'],
  ['helm_iron',    svgHelm,       '#64748b'],
  ['helm_mithril', svgHelm,       '#67e8f9'],
  ['helm_holy',    svgCrown,      '#fde68a'],
  ['helm_dragon',  svgDragonHelm, '#dc2626'],
  // 腰防具
  ['belt_cloth',   svgBelt,      '#fde68a'],
  ['belt_leather', svgBelt,      '#92400e'],
  ['belt_iron',    svgBelt,      '#64748b'],
  ['belt_mithril', svgBelt,      '#67e8f9'],
  ['belt_titan',   svgTitanBelt, '#a16207'],
  // 脚防具
  ['boots_cloth',   svgBoots,       '#fde68a'],
  ['boots_leather', svgBoots,       '#92400e'],
  ['boots_iron',    svgBoots,       '#64748b'],
  ['boots_swift',   svgSwiftBoots,  '#67e8f9'],
  ['boots_dragon',  svgBoots,       '#dc2626'],
  // 装飾品
  ['ring_atk',        svgRing,     '#f59e0b'],
  ['ring_def',        svgRing,     '#3b82f6'],
  ['amulet_hp',       svgAmulet,   '#10b981'],
  ['charm_lucky',     svgCharm,    '#fbbf24'],
  ['brooch_mana',     svgBrooch,   '#e879f9'],
  ['vampire_cape',    svgCape,     '#7c3aed'],
  ['ring_speed',      svgWing,     '#67e8f9'],
  ['amulet_mana',     svgAmulet,   '#6366f1'],
  ['berserker_band',  svgFireFist, '#f97316'],
  ['titan_belt',      svgTitanBelt,'#a16207'],
];

// ── UI アイコン ────────────────────────────────
const UI_ICONS = [
  ['ui_shop',   svgShop],
  ['ui_casino', svgCasino],
  ['ui_stall',  svgStall],
  ['ui_loan',   svgLoan],
  ['ui_portal', svgPortal],
  ['ui_stairs', svgStairs],
  ['ui_debug_boss', svgBoss],
];

// ── 書き出し ──────────────────────────────────
const generated = [];
for (const [id, fn, color] of ITEMS) {
  const svg = fn(color);
  writeFileSync(resolve(SVG_DIR, `${id}.svg`), svg, 'utf8');
  generated.push({ spriteName: `item_${id}`, url: `assets/icons/${id}.svg` });
}
for (const [name, fn] of UI_ICONS) {
  const svg = fn();
  writeFileSync(resolve(SVG_DIR, `${name}.svg`), svg, 'utf8');
  generated.push({ spriteName: name, url: `assets/icons/${name}.svg` });
}

// ── TSファイル出力 ────────────────────────────
const header = `// ─────────────────────────────────────────────
// icon_sprites.ts  自動生成（scripts/gen_icons.mjs）
//   このファイルは手動編集しない。再生成で上書きされる。
//   生成数: ${generated.length}
// ─────────────────────────────────────────────

export interface IconSprite {
  spriteName: string;
  url:        string;
}

export const GENERATED_ICONS: IconSprite[] = [
`;
const body = generated
  .map(g => `  { spriteName: ${JSON.stringify(g.spriteName)}, url: ${JSON.stringify(g.url)} },`)
  .join('\n');
const footer = `
];
`;
writeFileSync(TS_OUT, header + body + footer, 'utf8');

// ── サマリー ──────────────────────────────────
console.log(`✓ 生成: ${generated.length}個 (アイテム ${ITEMS.length}, UI ${UI_ICONS.length})`);
console.log(`  SVG  : ${SVG_DIR}`);
console.log(`  TS   : ${TS_OUT}`);
