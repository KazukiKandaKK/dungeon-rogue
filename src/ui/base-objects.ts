// ─────────────────────────────────────────────
// base-objects.ts  拠点オブジェクト描画
//
// main.js から移行した拠点オブジェクト（宝箱・ショップ・カジノ・ポータル等）の
// 描画ヘルパー関数群。
// ─────────────────────────────────────────────

'use strict';

import { roundRect } from '../ui/hud.js';
import { TILE_SIZE } from '../world/tiles.js';
import {
  BASE_CHEST_POS,
  BASE_SHOP_POS,
  BASE_CASINO_POS,
  BASE_STALL_POS,
  BASE_LOAN_POS,
  BASE_RECLASS_POS,
  BASE_CRAFT_POS,
  BASE_FOUNTAIN_POS,
  BASE_PORTALS,
  BASE_SHRINE_POS,
  BASE_QUEST_POS,
  BASE_RECEPTION_POS,
  BASE_TAVERN_POS,
  BASE_TRADER_POS,
  BASE_MONUMENT_POS,
} from '../core/game-constants.js';
import { DUNGEONS } from '../world/dungeon_defs.js';
import {
  drawDungeonPortal as drawGrandDungeonPortal,
  drawTavern as drawGrandTavern,
  drawTrader as drawGrandTrader,
  drawMonument as drawGrandMonument,
  drawAmbientMotes as drawGrandAmbientMotes,
} from './grand-props.js';
import {
  drawWeather,
  nextWeatherState,
  type WeatherState,
  type WeatherType,
} from './weather.js';
import type { SpriteLoader } from '../core/sprites.js';
import type { DungeonDef } from '../world/dungeon_defs.js';

// ─── 昼夜サイクル（BASE 拠点のみ適用） ────────────
//
// 朝→昼→夕→夜→朝と巡るサイクル。位相（phase）は 0..1 の連続値で、
// now（Date.now 相当のミリ秒）から純関数的に算出する。
// 1 サイクル = 実時間 4 分（開発中は短めで挙動確認しやすく）。

/** 1 サイクルの長さ（ミリ秒）。開発中は 4 分に設定。 */
export const TIME_OF_DAY_CYCLE_MS = 4 * 60 * 1000;

/** 現在の位相（0..1）を now から算出する純関数。 */
export function getTimeOfDayPhase(now: number): number {
  const t = ((now % TIME_OF_DAY_CYCLE_MS) + TIME_OF_DAY_CYCLE_MS) % TIME_OF_DAY_CYCLE_MS;
  return t / TIME_OF_DAY_CYCLE_MS;
}

/** 時刻ラベル（朝・昼・夕・夜）を位相から得る。 */
export function getTimeOfDayLabel(phase: number): '朝' | '昼' | '夕' | '夜' {
  // 正規化
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.20) return '朝';
  if (p < 0.50) return '昼';
  if (p < 0.70) return '夕';
  return '夜';
}

/** 時刻ラベルに絵文字を付与した HUD 用の短い表記を返す。 */
export function getTimeOfDayIcon(label: '朝' | '昼' | '夕' | '夜'): string {
  if (label === '朝') return '🌅';
  if (label === '昼') return '☀';
  if (label === '夕') return '🌇';
  return '🌙';
}

/** 線形補間。 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** smoothstep：edge0..edge1 の間を滑らかに 0→1 へ遷移。edge0 > edge1 の場合は逆向き。 */
function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * 夜の強さ（0..1）。昼ほど 0、夜ほど 1 に近づく。
 * phase=0（朝の入り口）と phase=1（夜の終わり）は夜のピーク近辺とし、
 * 位相が 0 と 1 を跨ぐ際の不連続を避けるように組んでいる。
 */
export function getNightFactor(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  // 0.0 付近（朝手前）と 0.9 付近（深夜）が暗い。
  const dusk  = smoothstep(0.6, 0.9, p);       // 夕→夜
  const dawn  = smoothstep(0.1, 0.0, p);       // 夜明け側（0 に近いほど濃い）
  const lateNight = smoothstep(0.9, 1.0, p);   // 深夜→朝直前
  // いずれか強い方を採用（最大値でブレンド）。
  return Math.max(dusk, dawn, lateNight);
}

/**
 * 時間帯ごとの基底色（rgba 文字列）を位相から線形補間して返す。
 * BASE 拠点の最上層オーバーレイ 1 枚用。
 *
 * アンカー：
 *   0.00 朝の peach
 *   0.20 朝→昼の橋渡し（ほぼ透明の薄桃）
 *   0.35 昼（ほぼ透明）
 *   0.55 夕の橙
 *   0.65 夕の赤橙（濃）
 *   0.80 夜（濃紺）
 *   0.95 深夜（更に濃紺）
 */
function getTimeOfDayOverlayColor(phase: number): string {
  const p = ((phase % 1) + 1) % 1;
  // アンカー（位相, r, g, b, a）
  const anchors: Array<[number, number, number, number, number]> = [
    [0.00, 255, 200, 150, 0.12],
    [0.20, 255, 220, 180, 0.04],
    [0.35, 255, 245, 220, 0.02],
    [0.55, 255, 140,  60, 0.18],
    [0.65, 180,  80,  30, 0.12],
    [0.80,  20,  30,  80, 0.32],
    [0.95,  10,  15,  40, 0.42],
    [1.00, 255, 200, 150, 0.12], // 終端を先頭に接続
  ];
  // 位相を挟む 2 点を見つけて補間
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (p >= a[0] && p <= b[0]) {
      const tt = (p - a[0]) / Math.max(1e-6, b[0] - a[0]);
      const r = Math.round(lerp(a[1], b[1], tt));
      const g = Math.round(lerp(a[2], b[2], tt));
      const bl = Math.round(lerp(a[3], b[3], tt));
      const al = lerp(a[4], b[4], tt);
      return `rgba(${r},${g},${bl},${al.toFixed(3)})`;
    }
  }
  // フォールバック（理論上不達）
  return 'rgba(255,245,220,0.02)';
}

/**
 * 画面全体に時間帯オーバーレイを 1 枚塗る。BASE 拠点の drawCityDecor 末尾から呼ばれる。
 * キャンバス全域を覆うため、camOffX/Y には依存せず ctx.canvas.width/height を使う。
 */
function drawTimeOfDayOverlay(
  ctx: CanvasRenderingContext2D,
  _camOffX: number, _camOffY: number, now: number,
): void {
  const phase = getTimeOfDayPhase(now);
  const color = getTimeOfDayOverlayColor(phase);
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);

  // 昼間のみ、太陽光の加算層（温かい黄色）を薄く足して映える演出。
  // 0.20..0.50 が昼帯。中央（0.35）で最大。
  const p = ((phase % 1) + 1) % 1;
  const sun = smoothstep(0.20, 0.35, p) * (1 - smoothstep(0.35, 0.50, p));
  if (sun > 0.01) {
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(255,240,180,${(0.06 * sun).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}

/**
 * BASE 拠点専用の時刻ラベルを画面右上に描画する簡易 HUD。
 * drawHUD 側で右上に拠点パネルが出るため、その下に小さく時刻チップを重ねる。
 */
function drawTimeOfDayBadge(
  ctx: CanvasRenderingContext2D,
  now: number,
): void {
  const phase = getTimeOfDayPhase(now);
  const label = getTimeOfDayLabel(phase);
  const icon = getTimeOfDayIcon(label);
  const text = `${icon} ${label}`;

  const W = ctx.canvas.width;

  ctx.save();
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  // 右上のフロア情報パネル（y=10, h=62）の真下に配置
  const pad = 8;
  const tw = ctx.measureText(text).width + pad * 2;
  const th = 22;
  const x = W - tw - 10;
  const y = 10 + 62 + 6;

  // 背景チップ
  ctx.fillStyle = 'rgba(15,5,40,0.85)';
  ctx.strokeStyle = 'rgba(253,230,138,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const r = 6;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + tw - r, y);
  ctx.arcTo(x + tw, y,      x + tw, y + r,      r);
  ctx.lineTo(x + tw, y + th - r);
  ctx.arcTo(x + tw, y + th, x + tw - r, y + th, r);
  ctx.lineTo(x + r, y + th);
  ctx.arcTo(x,      y + th, x,      y + th - r, r);
  ctx.lineTo(x,      y + r);
  ctx.arcTo(x,      y,      x + r,      y,      r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fde68a';
  ctx.fillText(text, x + tw - pad, y + 5);
  ctx.restore();
}

// ─── SVG Path2D 建造物テンプレート（論理座標 -1..+1） ───

/** 切妻屋根（標準） */
const ROOF_GABLED = new Path2D(
  'M -0.55 0.00 L -0.45 -0.10 L 0.00 -0.85 L 0.45 -0.10 L 0.55 0.00 ' +
  'L 0.50 0.05 L -0.50 0.05 Z'
);

/** マンサード屋根（二段勾配） */
const ROOF_MANSARD = new Path2D(
  'M -0.55 0.00 L -0.45 -0.35 L -0.25 -0.60 L 0.25 -0.60 L 0.45 -0.35 L 0.55 0.00 ' +
  'L 0.50 0.05 L -0.50 0.05 Z'
);

/** 円錐塔の屋根 */
const ROOF_CONE = new Path2D(
  'M -0.45 0.00 L -0.35 -0.20 L 0.00 -1.10 L 0.35 -0.20 L 0.45 0.00 Z'
);

/** 煙突 */
const CHIMNEY_PATH = new Path2D(
  'M -0.06 0.00 L -0.06 -0.45 L -0.09 -0.50 L 0.09 -0.50 L 0.06 -0.45 L 0.06 0.00 Z'
);

/** アーチ窓 */
const WINDOW_ARCH = new Path2D(
  'M -0.30 0.45 L -0.30 -0.10 ' +
  'C -0.30 -0.45 0.30 -0.45 0.30 -0.10 ' +
  'L 0.30 0.45 Z'
);

/** 十字ムリオン */
const WINDOW_MULLION = new Path2D(
  'M 0 -0.45 L 0 0.45 M -0.30 0 L 0.30 0'
);

/** ダイヤモンド鉛格子 */
const WINDOW_LEAD = new Path2D(
  'M 0 -0.45 L -0.30 -0.15 L 0 0.15 L 0.30 -0.15 Z ' +
  'M 0 -0.15 L -0.30 0.15 L 0 0.45 L 0.30 0.15 Z'
);

/** バラ窓（大きめ） */
const ROSE_WINDOW = (() => {
  const p = new Path2D();
  p.arc(0, 0, 1, 0, Math.PI * 2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.moveTo(0, 0);
    p.lineTo(Math.cos(a), Math.sin(a));
  }
  p.moveTo(0.5, 0); p.arc(0, 0, 0.5, 0, Math.PI * 2);
  return p;
})();

/** 木組み装飾：X 型 */
const TIMBER_X = new Path2D('M -0.45 -0.35 L 0.45 0.35 M -0.45 0.35 L 0.45 -0.35');

/** 木組み装飾：V 型 */
const TIMBER_V = new Path2D('M -0.45 -0.35 L 0.00 0.35 L 0.45 -0.35');

/** ドア（アーチ型） */
const DOOR_ARCH = new Path2D(
  'M -0.25 0.45 L -0.25 -0.10 ' +
  'C -0.25 -0.40 0.25 -0.40 0.25 -0.10 ' +
  'L 0.25 0.45 Z'
);

/** 吊り看板（ブラケット含む） */
const SHOP_SIGN = new Path2D(
  'M -0.05 -0.50 L -0.05 -0.20 M -0.05 -0.20 L 0.35 -0.20 ' +
  'M 0.05 -0.30 L 0.25 -0.30 ' +
  'M 0.35 -0.20 L 0.35 0.10 L 0.30 0.20 L -0.20 0.20 L -0.25 0.10 L -0.25 -0.20 Z'
);

/** 風見鶏（鶏のシルエット） */
const WEATHERVANE = new Path2D(
  // 矢
  'M -0.80 0 L 0.80 0 ' +
  'M -0.80 0 L -0.65 -0.10 M -0.80 0 L -0.65 0.10 ' +
  'M 0.80 0 L 0.55 -0.20 L 0.55 0.20 Z ' +
  // 鶏本体
  'M 0 -0.30 C 0.15 -0.35 0.25 -0.20 0.20 -0.10 ' +
  'C 0.25 -0.05 0.20 0.05 0.10 0.05 ' +
  'C 0.00 0.05 -0.05 -0.10 0.00 -0.30 Z ' +
  // 尾
  'M -0.10 -0.15 L -0.25 -0.25 L -0.15 -0.05 Z ' +
  // とさか
  'M 0.12 -0.32 L 0.08 -0.42 L 0.18 -0.35 Z'
);

/** 花枠（窓下の花箱） */
const FLOWER_BOX = new Path2D(
  'M -0.40 0.20 L -0.35 -0.05 L 0.35 -0.05 L 0.40 0.20 Z'
);

/** ガーゴイル（壁面装飾） */
const GARGOYLE = new Path2D(
  // 頭部
  'M -0.20 -0.10 L -0.25 -0.30 L -0.10 -0.45 L 0.10 -0.45 L 0.25 -0.30 L 0.20 -0.10 ' +
  // 顎
  'L 0.15 0.10 L 0.00 0.15 L -0.15 0.10 Z ' +
  // 角
  'M -0.15 -0.35 L -0.25 -0.55 L -0.05 -0.40 Z ' +
  'M  0.15 -0.35 L  0.25 -0.55 L  0.05 -0.40 Z ' +
  // 翼
  'M -0.20 -0.05 L -0.65 -0.25 L -0.55 0.05 L -0.30 0.00 Z ' +
  'M  0.20 -0.05 L  0.65 -0.25 L  0.55 0.05 L  0.30 0.00 Z'
);

// ─── 公開インターフェース ──────────────────────

export interface BaseObjectsContext {
  player:          { tx: number; ty: number };
  baseChestCount:  number;
  baseShopCount:   number;
  stallCount:      number;
  loanDebt:        number;
  sprites:         SpriteLoader;
  clearedDungeons: Set<string>;
  /** 今日のクエスト件数（undefined なら未実装扱いで掲示板を出さない） */
  questActive?:     number;
  questClaimable?:  number;
}

// ─── 内部純粋関数 ──────────────────────────────

function isDungeonUnlocked(dungeonId: string, clearedDungeons: Set<string>): boolean {
  const idx = DUNGEONS.findIndex(d => d.id === dungeonId);
  if (idx <= 0) return true;
  return clearedDungeons.has(DUNGEONS[idx - 1].id);
}

// ─── 内部描画ヘルパー ──────────────────────────

function objChest(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ts: number,
  itemCount: number,
  onPlayer: boolean,
): void {
  ctx.save();
  const w = ts - 6, h = ts - 4;
  const x = cx - w / 2, y = cy - h / 2;
  const glow = onPlayer || itemCount > 0;
  if (glow) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = onPlayer ? 16 : 8; }

  const bodyY = y + h * 0.42, bodyH = h * 0.58;
  const bg = ctx.createLinearGradient(x, bodyY, x, bodyY + bodyH);
  bg.addColorStop(0, '#78350f'); bg.addColorStop(1, '#451a03');
  roundRect(ctx, x, bodyY, w, bodyH, 3); ctx.fillStyle = bg; ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(x + 3, bodyY + bodyH * i / 3);
    ctx.lineTo(x + w - 3, bodyY + bodyH * i / 3); ctx.stroke();
  }
  ctx.fillStyle = '#92400e';
  ctx.fillRect(x, bodyY + bodyH * 0.3, w, bodyH * 0.22);
  ctx.fillStyle = '#fbbf24'; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 4;
  ([[w * 0.2, bodyH * 0.41], [w * 0.8, bodyH * 0.41]] as [number, number][]).forEach(([rx, ry]) => {
    ctx.beginPath(); ctx.arc(x + rx, bodyY + ry, 2, 0, Math.PI * 2); ctx.fill();
  });

  const lidW = w + 4, lidX = cx - lidW / 2, lidY = y, lidH = h * 0.44;
  const lidG = ctx.createLinearGradient(lidX, lidY, lidX + lidW, lidY + lidH);
  lidG.addColorStop(0, '#92400e'); lidG.addColorStop(1, '#78350f');
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(lidX, lidY + lidH);
  ctx.lineTo(lidX + lidW, lidY + lidH);
  ctx.lineTo(lidX + lidW, lidY + lidH * 0.5);
  ctx.arc(cx, lidY + lidH * 0.5, lidW / 2, 0, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = lidG; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.ellipse(cx, lidY + lidH * 0.35, lidW * 0.35, lidH * 0.18, 0, 0, Math.PI * 2); ctx.fill();

  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 6;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(cx, bodyY + 3, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#92400e';
  ctx.beginPath(); ctx.arc(cx, bodyY + 2.5, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(cx - 1.2, bodyY + 2.5, 2.4, 4);

  ctx.shadowBlur = 0; ctx.restore();
}

function drawPortalGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  dungeonId: string,
  color: string,
  pulse: number,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.7 + 0.3 * pulse;
  switch (dungeonId) {
    case 'cave':
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy + r * 0.6);
      ctx.lineTo(cx - r, cy + r * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#05000f';
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.2); ctx.lineTo(cx + r * 0.5, cy + r * 0.6);
      ctx.lineTo(cx - r * 0.5, cy + r * 0.6); ctx.closePath(); ctx.fill();
      break;
    case 'goblin_nest':
      ctx.fillRect(cx - r * 0.15, cy - r, r * 0.3, r * 2);
      ctx.fillRect(cx - r * 0.7, cy - r * 0.15, r * 1.4, r * 0.3);
      break;
    case 'cursed_forest':
      ctx.fillRect(cx - r * 0.15, cy, r * 0.3, r);
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.7, cy + r * 0.1);
      ctx.lineTo(cx - r * 0.7, cy + r * 0.1); ctx.closePath(); ctx.fill();
      break;
    case 'abyss':
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2, true); ctx.fill();
      break;
    case 'boss_rush':
      ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#05000f';
      ctx.beginPath(); ctx.arc(cx - r * 0.28, cy - r * 0.15, r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + r * 0.28, cy - r * 0.15, r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.fillRect(cx - r * 0.35, cy + r * 0.55, r * 0.7, r * 0.5);
      ctx.fillStyle = '#05000f';
      for (let i = 0; i < 3; i++) ctx.fillRect(cx - r * 0.25 + i * r * 0.25, cy + r * 0.56, r * 0.15, r * 0.35);
      break;
    default:
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.restore();
}

// ─── 装飾：噴水・たいまつ・地区看板・ポータル祭壇 ──

/** 中央広場の噴水（2×2 ブロック相当、左上タイルを基準に描画） */
function drawFountain(
  ctx: CanvasRenderingContext2D,
  cx: number,   // 2×2 ブロックの中心
  cy: number,
  ts: number,
  now: number,
): void {
  ctx.save();
  const r1 = ts * 0.9;   // 外周石
  const r2 = ts * 0.62;  // 水面
  const r3 = ts * 0.2;   // 中央台座

  // 石の外周
  const stoneG = ctx.createRadialGradient(cx, cy, r2, cx, cy, r1);
  stoneG.addColorStop(0, '#52525b');
  stoneG.addColorStop(1, '#1c1917');
  ctx.fillStyle = stoneG;
  ctx.beginPath(); ctx.ellipse(cx, cy, r1, r1 * 0.68, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#78716c'; ctx.lineWidth = 1.5;
  ctx.stroke();

  // 水面（青緑のグラデ）
  const waterG = ctx.createRadialGradient(cx, cy - r2 * 0.1, r2 * 0.2, cx, cy, r2);
  waterG.addColorStop(0, 'rgba(147,197,253,0.85)');
  waterG.addColorStop(0.6, 'rgba(56,189,248,0.6)');
  waterG.addColorStop(1, 'rgba(14,116,144,0.75)');
  ctx.fillStyle = waterG;
  ctx.beginPath(); ctx.ellipse(cx, cy, r2, r2 * 0.68, 0, 0, Math.PI * 2); ctx.fill();

  // さざ波
  ctx.strokeStyle = 'rgba(186,230,253,0.55)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const phase = (now * 0.6 + i * 0.33) % 1;
    const rr = r2 * (0.3 + 0.6 * phase);
    ctx.globalAlpha = (1 - phase) * 0.6;
    ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.68, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 中央台座（石柱）
  ctx.fillStyle = '#a8a29e';
  ctx.beginPath(); ctx.ellipse(cx, cy, r3, r3 * 0.68, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#78716c';
  ctx.fillRect(cx - r3 * 0.4, cy - r2 * 0.42, r3 * 0.8, r2 * 0.42);
  ctx.fillStyle = '#d6d3d1';
  ctx.beginPath(); ctx.ellipse(cx, cy - r2 * 0.42, r3 * 0.45, r3 * 0.18, 0, 0, Math.PI * 2); ctx.fill();

  // 噴き上がる水柱
  const jetH = ts * 0.55 * (0.85 + 0.15 * Math.sin(now * 2.8));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const jetG = ctx.createLinearGradient(cx, cy - r2 * 0.42 - jetH, cx, cy - r2 * 0.42);
  jetG.addColorStop(0, 'rgba(224,242,254,0)');
  jetG.addColorStop(0.4, 'rgba(186,230,253,0.8)');
  jetG.addColorStop(1, 'rgba(56,189,248,0.9)');
  ctx.fillStyle = jetG;
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy - r2 * 0.42);
  ctx.quadraticCurveTo(cx, cy - r2 * 0.42 - jetH * 1.2, cx + 3, cy - r2 * 0.42);
  ctx.closePath();
  ctx.fill();

  // 水しぶき
  for (let i = 0; i < 6; i++) {
    const pa = ((now * 0.9 + i * 0.17) % 1);
    const angle = (i / 6) * Math.PI * 2;
    const sx = cx + Math.cos(angle) * ts * 0.3 * pa;
    const sy = cy - r2 * 0.42 - jetH * 0.5 + pa * ts * 0.3;
    ctx.fillStyle = `rgba(224,242,254,${(1 - pa) * 0.9})`;
    ctx.beginPath(); ctx.arc(sx, sy, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // コイン（願い事）
  ctx.fillStyle = '#fbbf24';
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 4;
  ([
    [-r2 * 0.4,  r2 * 0.15],
    [ r2 * 0.35, r2 * 0.28],
    [-r2 * 0.15, r2 * 0.38],
    [ r2 * 0.1, -r2 * 0.05],
  ] as [number, number][]).forEach(([ox, oy]) => {
    ctx.beginPath(); ctx.ellipse(cx + ox, cy + oy, 2.4, 1.6, 0, 0, Math.PI * 2); ctx.fill();
  });

  ctx.restore();
}

/** たいまつ（柱に設置したものをイメージ） */
function drawTorch(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  now: number,
  phase: number,
): void {
  ctx.save();
  const flicker = 0.7 + 0.3 * Math.sin(now * 8 + phase * 3);
  // 取り付け金具
  ctx.fillStyle = '#44403c';
  ctx.fillRect(cx - 2, cy - 2, 4, 14);
  // 燃料
  ctx.fillStyle = '#78350f';
  ctx.fillRect(cx - 3, cy - 8, 6, 8);
  // 炎
  const fG = ctx.createRadialGradient(cx, cy - 10, 1, cx, cy - 14 * flicker, 10 * flicker);
  fG.addColorStop(0, `rgba(254,240,138,${0.95 * flicker})`);
  fG.addColorStop(0.45, `rgba(251,146,60,${0.85 * flicker})`);
  fG.addColorStop(1, 'rgba(185,28,28,0)');
  ctx.fillStyle = fG;
  ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 14 * flicker;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy - 8);
  ctx.quadraticCurveTo(cx - 2, cy - 16 * flicker, cx, cy - 20 * flicker);
  ctx.quadraticCurveTo(cx + 2, cy - 16 * flicker, cx + 5, cy - 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 地区看板（釣り下げ式の木札） */
function drawDistrictBanner(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  text: string,
  color: string,
): void {
  ctx.save();
  const w = text.length * 11 + 20;
  const h = 22;
  // 吊りロープ
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - w * 0.35, cy - h * 0.5 - 6); ctx.lineTo(cx - w * 0.35, cy - h * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + w * 0.35, cy - h * 0.5 - 6); ctx.lineTo(cx + w * 0.35, cy - h * 0.5); ctx.stroke();
  // 木板
  const g = ctx.createLinearGradient(cx, cy - h / 2, cx, cy + h / 2);
  g.addColorStop(0, '#92400e'); g.addColorStop(1, '#451a03');
  ctx.fillStyle = g;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 3); ctx.fill();
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1; ctx.stroke();
  // 釘
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(cx - w / 2 + 4, cy - h / 2 + 4, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + w / 2 - 4, cy - h / 2 + 4, 1.5, 0, Math.PI * 2); ctx.fill();
  // 文字
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

/** ポータル足元の魔法陣＋祭壇階段 */
function drawPortalPedestal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ts: number,
  color: string,
  pulse: number,
  unlocked: boolean,
  now: number,
): void {
  ctx.save();
  // 石の台座（階段状）
  ctx.fillStyle = '#1c1917';
  ctx.beginPath(); ctx.ellipse(cx, cy + ts * 0.35, ts * 0.55, ts * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3f3f46';
  ctx.beginPath(); ctx.ellipse(cx, cy + ts * 0.33, ts * 0.5, ts * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#52525b';
  ctx.beginPath(); ctx.ellipse(cx, cy + ts * 0.30, ts * 0.42, ts * 0.1, 0, 0, Math.PI * 2); ctx.fill();

  if (!unlocked) { ctx.restore(); return; }

  // 魔法陣（回転）
  ctx.save();
  ctx.translate(cx, cy + ts * 0.3);
  ctx.rotate(now * 0.3);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35 + 0.35 * pulse;
  ctx.lineWidth = 1.2;
  ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.ellipse(0, 0, ts * 0.38, ts * 0.09, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, ts * 0.28, ts * 0.068, 0, 0, Math.PI * 2); ctx.stroke();
  // 三角ルーン
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const x = Math.cos(a) * ts * 0.34, y = Math.sin(a) * ts * 0.08;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function objPortal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ts: number,
  dungeon: DungeonDef,
  pulse: number,
  onPlayer: boolean,
): void {
  ctx.save();
  const c = dungeon.color;
  const pw = ts * 0.14;
  const gateW = ts * 0.9;
  const gateH = ts * 1.05;
  const gx = cx - gateW / 2;
  const gy = cy - gateH * 0.72;
  const archCY = gy + gateH * 0.32;
  const innerW = gateW - pw * 2;

  ctx.shadowColor = c; ctx.shadowBlur = 12 + 10 * pulse;

  ctx.fillStyle = '#05000f';
  ctx.beginPath();
  ctx.arc(cx, archCY, innerW / 2, Math.PI, 0);
  ctx.rect(cx - innerW / 2, archCY, innerW, gateH * 0.62);
  ctx.fill();

  const ig = ctx.createRadialGradient(cx, archCY, 0, cx, archCY, innerW * 0.52);
  ig.addColorStop(0, c + 'bb');
  ig.addColorStop(0.35, c + '44');
  ig.addColorStop(0.75, c + '11');
  ig.addColorStop(1, 'transparent');
  ctx.fillStyle = ig;
  ctx.globalAlpha = 0.45 + 0.55 * pulse;
  ctx.beginPath();
  ctx.arc(cx, archCY, innerW / 2, Math.PI, 0);
  ctx.rect(cx - innerW / 2, archCY, innerW, gateH * 0.62);
  ctx.fill();
  ctx.globalAlpha = 1;

  const pilG_l = ctx.createLinearGradient(gx, 0, gx + pw, 0);
  pilG_l.addColorStop(0, '#111118'); pilG_l.addColorStop(0.5, c + '60'); pilG_l.addColorStop(1, '#1e1e28');
  ctx.shadowBlur = 0; ctx.fillStyle = pilG_l;
  ctx.fillRect(gx, gy + gateH * 0.3, pw, gateH * 0.72);

  const pilG_r = ctx.createLinearGradient(gx + gateW - pw, 0, gx + gateW, 0);
  pilG_r.addColorStop(0, '#1e1e28'); pilG_r.addColorStop(0.5, c + '60'); pilG_r.addColorStop(1, '#111118');
  ctx.fillStyle = pilG_r;
  ctx.fillRect(gx + gateW - pw, gy + gateH * 0.3, pw, gateH * 0.72);

  ctx.shadowColor = c; ctx.shadowBlur = 8;
  ctx.fillStyle = c + 'aa';
  ctx.fillRect(gx - 1, gy + gateH * 0.3, pw + 2, 4);
  ctx.fillRect(gx + gateW - pw - 1, gy + gateH * 0.3, pw + 2, 4);

  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(cx - 5, gy + gateH * 0.28);
  ctx.lineTo(cx + 5, gy + gateH * 0.28);
  ctx.lineTo(cx + 3, gy + gateH * 0.34);
  ctx.lineTo(cx - 3, gy + gateH * 0.34);
  ctx.closePath(); ctx.fill();

  ctx.shadowBlur = 10; ctx.shadowColor = c;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  drawPortalGlyph(ctx, cx, archCY, ts * 0.22, dungeon.id, c, pulse);

  if (dungeon.bossRush) {
    ctx.shadowColor = c; ctx.shadowBlur = 6;
    ctx.strokeStyle = c + '99'; ctx.lineWidth = 1;
    ctx.strokeRect(gx - 1, gy + gateH * 0.3, gateW + 2, gateH * 0.72);
  }

  ctx.shadowBlur = 0; ctx.restore();
}

// ─────────────────────────────────────────────
// 3×2 タイル占有の建物描画
//   (cx, cy) は入口タイル中心。建物は上方と左右に広がる
//     w = 3 * ts, h = 2 * ts, bottom = cy + ts/2
// ─────────────────────────────────────────────

/** ショップ：赤屋根の木造店舗 */
function drawShopBuilding(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean, itemCount: number,
): void {
  ctx.save();
  const w = ts * 3, h = ts * 2;
  const x = cx - w / 2;
  const y = cy + ts / 2 - h;

  if (on) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 22; }

  // 本体：板壁
  const wallG = ctx.createLinearGradient(x, y + h * 0.3, x, y + h);
  wallG.addColorStop(0, '#7c2d12'); wallG.addColorStop(1, '#431407');
  ctx.fillStyle = wallG;
  roundRect(ctx, x + 4, y + h * 0.3, w - 8, h * 0.7, 3); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const ly = y + h * 0.3 + (h * 0.7) * i / 5;
    ctx.beginPath(); ctx.moveTo(x + 8, ly); ctx.lineTo(x + w - 8, ly); ctx.stroke();
  }

  // 三角屋根
  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.moveTo(x - 2, y + h * 0.3);
  ctx.lineTo(x + w / 2, y - 4);
  ctx.lineTo(x + w + 2, y + h * 0.3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#450a0a'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const ly = y + (h * 0.3) * i / 4;
    const dx = (w / 2 + 2) * (1 - i / 4);
    ctx.beginPath(); ctx.moveTo(x + w / 2 - dx, ly); ctx.lineTo(x + w / 2 + dx, ly); ctx.stroke();
  }

  // 庇（紅白しま）
  const awY = y + h * 0.33, awH = h * 0.1;
  const stripes = 9, sw = (w - 16) / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#b91c1c' : '#fde68a';
    ctx.beginPath();
    ctx.moveTo(x + 8 + i * sw, awY);
    ctx.lineTo(x + 8 + (i + 1) * sw, awY);
    ctx.lineTo(x + 8 + (i + 0.5) * sw, awY + awH + 4);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x + 8, awY - 2, w - 16, 3);

  // 看板
  ctx.fillStyle = '#1c0a01';
  roundRect(ctx, cx - ts * 0.55, y + h * 0.14, ts * 1.1, h * 0.13, 3); ctx.fill();
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#fde68a'; ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 4;
  ctx.fillText('SHOP', cx, y + h * 0.205);
  ctx.shadowBlur = 0;

  // 扉（中央）
  const doorW = ts * 0.55, doorH = ts * 0.95;
  const doorX = cx - doorW / 2, doorY = cy + ts / 2 - doorH;
  const doorG = ctx.createLinearGradient(doorX, doorY, doorX, doorY + doorH);
  doorG.addColorStop(0, '#451a03'); doorG.addColorStop(1, '#1c0a01');
  ctx.fillStyle = doorG;
  roundRect(ctx, doorX, doorY, doorW, doorH, 3); ctx.fill();
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.moveTo(doorX + doorW / 2, doorY); ctx.lineTo(doorX + doorW / 2, doorY + doorH); ctx.stroke();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(doorX + doorW * 0.82, doorY + doorH * 0.55, 2.5, 0, Math.PI * 2); ctx.fill();

  // 窓ディスプレイ（左右）
  const winW = ts * 0.55, winH = ts * 0.45, winY = cy - ts * 0.28;
  ([-ts * 1.05, ts * 1.05] as number[]).forEach((ox, i) => {
    const wx = cx + ox - winW / 2;
    ctx.fillStyle = '#78350f';
    roundRect(ctx, wx - 3, winY - 3, winW + 6, winH + 6, 3); ctx.fill();
    const gG = ctx.createLinearGradient(wx, winY, wx, winY + winH);
    gG.addColorStop(0, '#fcd34d'); gG.addColorStop(1, '#f59e0b');
    ctx.fillStyle = gG;
    roundRect(ctx, wx, winY, winW, winH, 2); ctx.fill();
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(wx + winW / 2, winY); ctx.lineTo(wx + winW / 2, winY + winH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx, winY + winH / 2); ctx.lineTo(wx + winW, winY + winH / 2); ctx.stroke();
    if (i === 0) {
      // 剣
      ctx.fillStyle = 'rgba(20,8,1,0.85)';
      ctx.fillRect(wx + winW * 0.47, winY + winH * 0.12, 4, winH * 0.7);
      ctx.fillRect(wx + winW * 0.28, winY + winH * 0.32, winW * 0.48, 4);
    } else {
      // ポーション
      ctx.fillStyle = 'rgba(239,68,68,0.9)';
      ctx.beginPath(); ctx.ellipse(wx + winW * 0.5, winY + winH * 0.65, winW * 0.2, winH * 0.24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(28,10,1,0.85)';
      ctx.fillRect(wx + winW * 0.44, winY + winH * 0.22, winW * 0.12, winH * 0.27);
    }
  });

  // 煙突（屋根右）
  ctx.fillStyle = '#44403c';
  ctx.fillRect(x + w * 0.72, y + h * 0.05, ts * 0.14, h * 0.22);
  ctx.fillStyle = '#27272a';
  ctx.fillRect(x + w * 0.72 - 2, y + h * 0.05, ts * 0.14 + 4, 4);
  // 煙
  for (let i = 0; i < 3; i++) {
    const ph = ((now * 0.6 + i * 0.33) % 1);
    const sx = x + w * 0.78 + Math.sin((now + i) * 1.6) * 4;
    const sy = y + h * 0.05 - ph * 24;
    ctx.fillStyle = `rgba(200,200,200,${(1 - ph) * 0.5})`;
    ctx.beginPath(); ctx.arc(sx, sy, 3 + ph * 4, 0, Math.PI * 2); ctx.fill();
  }

  // 商品点数バッジ
  if (itemCount > 0) {
    ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(x + w - 18, y + h * 0.12, 12, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'white'; ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(itemCount), x + w - 18, y + h * 0.12);
  }

  ctx.restore();
}

/** 委託露店：布屋根＋木の棚、樽・箱・売り物 */
function drawStallBuilding(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean, stallCount: number,
): void {
  ctx.save();
  const w = ts * 3, h = ts * 2;
  const x = cx - w / 2;
  const y = cy + ts / 2 - h;

  if (on) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 20; }

  // 布屋根（緑黄しま、たわむ）
  const canvasY = y + h * 0.12, canvasH = h * 0.32;
  const stripes = 7, sw = w / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#065f46' : '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(x + i * sw, canvasY);
    ctx.lineTo(x + (i + 1) * sw, canvasY);
    ctx.lineTo(x + (i + 1) * sw, canvasY + canvasH - 4 - 3 * Math.sin(((i + 1) / stripes) * Math.PI));
    ctx.lineTo(x + i * sw, canvasY + canvasH - 4 - 3 * Math.sin((i / stripes) * Math.PI));
    ctx.closePath(); ctx.fill();
  }
  // 屋根縁
  ctx.fillStyle = '#052e2a';
  ctx.beginPath();
  for (let i = 0; i <= stripes; i++) {
    const px = x + i * sw;
    const py = canvasY + canvasH - 3 * Math.sin((i / stripes) * Math.PI);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  for (let i = stripes; i >= 0; i--) {
    const px = x + i * sw;
    const py = canvasY + canvasH + 4 - 3 * Math.sin((i / stripes) * Math.PI);
    ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();

  // 支柱
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x + 4,      canvasY + canvasH, 6, h * 0.52);
  ctx.fillRect(x + w - 10, canvasY + canvasH, 6, h * 0.52);

  // 木のカウンター
  const ctY = y + h * 0.62, ctH = h * 0.16;
  const ctG = ctx.createLinearGradient(x, ctY, x, ctY + ctH);
  ctG.addColorStop(0, '#92400e'); ctG.addColorStop(1, '#451a03');
  ctx.fillStyle = ctG;
  roundRect(ctx, x + 10, ctY, w - 20, ctH, 3); ctx.fill();
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const ly = ctY + ctH * i / 4;
    ctx.beginPath(); ctx.moveTo(x + 12, ly); ctx.lineTo(x + w - 12, ly); ctx.stroke();
  }

  // カウンター上の売り物（3点）
  const itemY = ctY - 8;
  // ポーション
  ctx.fillStyle = '#a855f7';
  ctx.beginPath(); ctx.ellipse(x + w * 0.22, itemY, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x + w * 0.22 - 3, itemY - 10, 6, 6);
  // 巻物
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(x + w * 0.5 - 10, itemY - 4, 20, 8);
  ctx.fillStyle = '#92400e';
  ctx.beginPath(); ctx.arc(x + w * 0.5 - 10, itemY, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.5 + 10, itemY, 4, 0, Math.PI * 2); ctx.fill();
  // 宝石
  ctx.fillStyle = '#22d3ee';
  ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.78, itemY - 5);
  ctx.lineTo(x + w * 0.82, itemY);
  ctx.lineTo(x + w * 0.78, itemY + 5);
  ctx.lineTo(x + w * 0.74, itemY);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;

  // 樽（左下）
  const barX = x + 8, barY = y + h * 0.82, barW = ts * 0.4, barH = ts * 0.4;
  const barG = ctx.createLinearGradient(barX, barY, barX + barW, barY);
  barG.addColorStop(0, '#451a03'); barG.addColorStop(0.5, '#78350f'); barG.addColorStop(1, '#451a03');
  ctx.fillStyle = barG;
  roundRect(ctx, barX, barY, barW, barH, 4); ctx.fill();
  ctx.strokeStyle = '#1c0a01'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(barX, barY + barH * 0.3); ctx.lineTo(barX + barW, barY + barH * 0.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(barX, barY + barH * 0.7); ctx.lineTo(barX + barW, barY + barH * 0.7); ctx.stroke();

  // 木箱（右下）
  const boxX = x + w - ts * 0.45, boxY = y + h * 0.82, boxW = ts * 0.38, boxH = ts * 0.4;
  ctx.fillStyle = '#92400e';
  roundRect(ctx, boxX, boxY, boxW, boxH, 2); ctx.fill();
  ctx.strokeStyle = '#451a03'; ctx.lineWidth = 1.5;
  ctx.strokeRect(boxX, boxY, boxW, boxH);
  ctx.beginPath(); ctx.moveTo(boxX, boxY + boxH / 2); ctx.lineTo(boxX + boxW, boxY + boxH / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(boxX + boxW / 2, boxY); ctx.lineTo(boxX + boxW / 2, boxY + boxH); ctx.stroke();

  // 委託数バッジ
  if (stallCount > 0) {
    const bx = x + w - 16, by = y + h * 0.16;
    ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 6;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'white'; ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(stallCount), bx, by);
  }

  // 点滅の小旗
  const flagX = x + w * 0.5, flagY = y + h * 0.03;
  ctx.fillStyle = '#dc2626';
  const flagW = 12 + 2 * Math.sin(now * 4);
  ctx.beginPath();
  ctx.moveTo(flagX, flagY);
  ctx.lineTo(flagX + flagW, flagY + 3);
  ctx.lineTo(flagX, flagY + 8);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#78350f';
  ctx.fillRect(flagX - 1, flagY, 2, 14);

  ctx.restore();
}

/** カジノ：ネオン輝く店舗、マーキー・トランプ柄・両開きドア */
function drawCasinoBuilding(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean,
): void {
  ctx.save();
  const w = ts * 3, h = ts * 2;
  const x = cx - w / 2;
  const y = cy + ts / 2 - h;
  const pulse = 0.5 + 0.5 * Math.abs(Math.sin(now * 2.5));
  const col = '#f59e0b';

  ctx.shadowColor = col; ctx.shadowBlur = (on ? 22 : 12) + 10 * pulse;

  // 本体
  const bodyG = ctx.createLinearGradient(x, y + h * 0.2, x, y + h);
  bodyG.addColorStop(0, '#1e1b3a'); bodyG.addColorStop(1, '#0d0a20');
  ctx.fillStyle = bodyG;
  roundRect(ctx, x + 6, y + h * 0.2, w - 12, h * 0.8, 4); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5 + 0.5 * pulse; ctx.stroke(); ctx.globalAlpha = 1;

  // 上部マーキー屋根
  ctx.shadowBlur = 0;
  const roofG = ctx.createLinearGradient(x, y, x, y + h * 0.22);
  roofG.addColorStop(0, '#4c1d95'); roofG.addColorStop(1, '#1e1b3a');
  ctx.fillStyle = roofG;
  roundRect(ctx, x, y, w, h * 0.22, 4); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();

  // "CASINO" ネオン文字
  ctx.font = 'bold 20px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = col; ctx.shadowBlur = 12 + 6 * pulse;
  ctx.fillStyle = '#fde68a';
  ctx.fillText('CASINO', cx, y + h * 0.11);

  // マーキーの電球（屋根縁を一周）
  ctx.shadowBlur = 0;
  const nBulbsTop = 14;
  for (let i = 0; i < nBulbsTop; i++) {
    const bx = x + (w - 8) * (i + 0.5) / nBulbsTop + 4;
    const alpha = ((pulse + i * 0.12) % 1);
    const hues = [col, '#ef4444', '#fde68a', '#22d3ee'];
    ctx.fillStyle = hues[i % hues.length];
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 5;
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(alpha * Math.PI));
    ctx.beginPath(); ctx.arc(bx, y + h * 0.22 - 2, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.shadowBlur = 0;

  // 側面の縦電球列
  for (let i = 0; i < 5; i++) {
    const ly = y + h * (0.3 + i * 0.12);
    const alpha = ((pulse + i * 0.3) % 1);
    ctx.fillStyle = '#fde68a';
    ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(alpha * Math.PI));
    ctx.beginPath(); ctx.arc(x + 4, ly, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w - 4, ly, 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 大型ディスプレイ（スート）
  const dispY = y + h * 0.3, dispH = h * 0.32;
  roundRect(ctx, x + w * 0.12, dispY, w * 0.76, dispH, 4);
  ctx.fillStyle = '#0f172a'; ctx.fill();
  ctx.strokeStyle = col + '88'; ctx.lineWidth = 1; ctx.stroke();
  // 仕切り
  ctx.strokeStyle = col + '44'; ctx.lineWidth = 1;
  ([1/3, 2/3] as number[]).forEach(f => {
    const lx = x + w * 0.12 + w * 0.76 * f;
    ctx.beginPath(); ctx.moveTo(lx, dispY + 4); ctx.lineTo(lx, dispY + dispH - 4); ctx.stroke();
  });
  const suits = ['♠', '♥', '♦'], sCol = ['#e2e8f0', '#f87171', '#f87171'];
  suits.forEach((s, i) => {
    ctx.font = `bold ${Math.floor(ts * 0.32)}px serif`;
    ctx.fillStyle = sCol[i];
    ctx.shadowColor = i === 0 ? col : '#f87171'; ctx.shadowBlur = 6;
    ctx.fillText(s, x + w * 0.12 + w * 0.76 * (i + 0.5) / 3, dispY + dispH * 0.5);
  });
  ctx.shadowBlur = 0;

  // 両開きの金扉（中央・下）
  const doorW = ts * 0.9, doorH = ts * 0.95;
  const doorX = cx - doorW / 2, doorY = cy + ts / 2 - doorH;
  const doorG = ctx.createLinearGradient(doorX, doorY, doorX, doorY + doorH);
  doorG.addColorStop(0, '#78350f'); doorG.addColorStop(1, '#451a03');
  ctx.fillStyle = doorG;
  roundRect(ctx, doorX, doorY, doorW, doorH, 4); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke();
  // 観音扉の中央線
  ctx.strokeStyle = col + 'cc'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, doorY + 4); ctx.lineTo(cx, doorY + doorH - 4); ctx.stroke();
  // 取っ手
  ctx.fillStyle = col;
  ctx.shadowColor = col; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(cx - 8, doorY + doorH * 0.55, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 8, doorY + doorH * 0.55, 3, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // 扉の窓（♥ のステンドグラス）
  ctx.fillStyle = '#ef4444';
  ctx.font = `bold ${Math.floor(ts * 0.28)}px serif`;
  ctx.fillText('♥', cx, doorY + doorH * 0.3);

  ctx.restore();
}

/** 金貸し：薄暗い路地の店、鉄格子窓から NPC が覗く */
function drawLoanBuilding(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean, debt: number,
  sprite: HTMLImageElement | null,
): void {
  ctx.save();
  const w = ts * 3, h = ts * 2;
  const x = cx - w / 2;
  const y = cy + ts / 2 - h;
  const angry = debt > 0;
  const glow = angry ? 'rgba(239,68,68,0.8)' : 'rgba(180,83,9,0.55)';

  ctx.shadowColor = glow; ctx.shadowBlur = on ? 22 : 12;

  // 左右の暗い路地壁
  ctx.fillStyle = '#1c1917';
  roundRect(ctx, x, y + h * 0.1, ts * 0.55, h * 0.9, 3); ctx.fill();
  roundRect(ctx, x + w - ts * 0.55, y + h * 0.1, ts * 0.55, h * 0.9, 3); ctx.fill();
  // レンガ模様（側壁）
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const ly = y + h * 0.15 + i * h * 0.17;
    ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(x + ts * 0.55, ly); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w - ts * 0.55, ly); ctx.lineTo(x + w, ly); ctx.stroke();
    for (let j = 0; j < 2; j++) {
      const bx = x + (j + (i % 2) * 0.5) * ts * 0.27;
      ctx.beginPath(); ctx.moveTo(bx, ly); ctx.lineTo(bx, ly + h * 0.085); ctx.stroke();
      const bx2 = x + w - ts * 0.55 + (j + (i % 2) * 0.5) * ts * 0.27;
      ctx.beginPath(); ctx.moveTo(bx2, ly); ctx.lineTo(bx2, ly + h * 0.085); ctx.stroke();
    }
  }

  // 中央の店の本体（幅 w*0.52）
  const bodyX = x + ts * 0.55, bodyY = y + h * 0.15, bodyW = w - ts * 1.1, bodyH = h * 0.85;
  const bodyG = ctx.createLinearGradient(bodyX, bodyY, bodyX, bodyY + bodyH);
  bodyG.addColorStop(0, '#3f1a0a'); bodyG.addColorStop(1, '#1a0905');
  ctx.fillStyle = bodyG;
  roundRect(ctx, bodyX, bodyY, bodyW, bodyH, 3); ctx.fill();
  ctx.strokeStyle = angry ? '#7f1d1d' : '#78350f';
  ctx.lineWidth = 1.5; ctx.stroke();

  // 屋根の庇（木板）
  ctx.fillStyle = '#292524';
  ctx.beginPath();
  ctx.moveTo(bodyX - 6, bodyY + 4);
  ctx.lineTo(bodyX + bodyW + 6, bodyY + 4);
  ctx.lineTo(bodyX + bodyW + 2, bodyY - 10);
  ctx.lineTo(bodyX - 2, bodyY - 10);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#0c0a09'; ctx.lineWidth = 1; ctx.stroke();

  // $ ランプ（揺れる）
  const lampX = bodyX + bodyW * 0.5;
  const lampY = bodyY + 2 + Math.sin(now * 1.5) * 1.2;
  ctx.strokeStyle = '#44403c'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(lampX, bodyY - 10); ctx.lineTo(lampX, lampY); ctx.stroke();
  ctx.shadowColor = angry ? '#ef4444' : '#fbbf24';
  ctx.shadowBlur = 10;
  const lampG = ctx.createRadialGradient(lampX, lampY + 8, 1, lampX, lampY + 8, 14);
  lampG.addColorStop(0, angry ? '#fecaca' : '#fef3c7');
  lampG.addColorStop(1, angry ? 'rgba(239,68,68,0)' : 'rgba(251,191,36,0)');
  ctx.fillStyle = lampG;
  ctx.beginPath(); ctx.arc(lampX, lampY + 8, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = angry ? '#ef4444' : '#fde68a';
  ctx.font = 'bold 14px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('$', lampX, lampY + 8);
  ctx.shadowBlur = 0;

  // 鉄格子の窓（中央上、NPC が見える）
  const winX = bodyX + bodyW * 0.15, winY = bodyY + bodyH * 0.2;
  const winW = bodyW * 0.7, winH = bodyH * 0.38;
  // 窓ガラス（暖色）
  const gG = ctx.createLinearGradient(winX, winY, winX, winY + winH);
  gG.addColorStop(0, angry ? '#7c2d12' : '#78350f');
  gG.addColorStop(1, angry ? '#450a0a' : '#451a03');
  ctx.fillStyle = gG;
  roundRect(ctx, winX, winY, winW, winH, 2); ctx.fill();
  ctx.strokeStyle = '#1c0a01'; ctx.lineWidth = 2; ctx.strokeRect(winX, winY, winW, winH);

  // NPC スプライト（窓の奥）
  if (sprite) {
    ctx.save();
    ctx.beginPath(); roundRect(ctx, winX + 2, winY + 2, winW - 4, winH - 4, 1); ctx.clip();
    ctx.drawImage(sprite, winX + winW * 0.1, winY - winH * 0.2, winW * 0.8, winH * 1.2);
    ctx.restore();
  } else {
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath(); ctx.arc(winX + winW * 0.5, winY + winH * 0.65, winH * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#292524';
    ctx.beginPath(); ctx.arc(winX + winW * 0.42, winY + winH * 0.6, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(winX + winW * 0.58, winY + winH * 0.6, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // 鉄格子（縦棒）
  ctx.strokeStyle = '#292524'; ctx.lineWidth = 2.5;
  for (let i = 1; i < 5; i++) {
    const bx = winX + winW * i / 5;
    ctx.beginPath(); ctx.moveTo(bx, winY); ctx.lineTo(bx, winY + winH); ctx.stroke();
  }
  // 鉄格子（横棒）
  ctx.beginPath(); ctx.moveTo(winX, winY + winH * 0.5); ctx.lineTo(winX + winW, winY + winH * 0.5); ctx.stroke();

  // 扉（右側、窓口カウンター付き）
  const doorW = bodyW * 0.9, doorH = bodyH * 0.35;
  const doorX = bodyX + (bodyW - doorW) / 2;
  const doorY = bodyY + bodyH - doorH;
  ctx.fillStyle = '#1c0a01';
  roundRect(ctx, doorX, doorY, doorW, doorH, 2); ctx.fill();
  ctx.strokeStyle = '#44403c'; ctx.lineWidth = 1.5; ctx.stroke();
  // カウンタースロット
  ctx.fillStyle = '#0c0a09';
  ctx.fillRect(doorX + doorW * 0.25, doorY + doorH * 0.3, doorW * 0.5, 4);
  // 札束（スロットから覗く）
  ctx.fillStyle = '#166534';
  ctx.fillRect(doorX + doorW * 0.35, doorY + doorH * 0.25, doorW * 0.3, 4);

  // 血のしずく（怒り時）
  if (angry) {
    for (let i = 0; i < 3; i++) {
      const ph = ((now * 0.7 + i * 0.33) % 1);
      const dx = bodyX + bodyW * (0.25 + i * 0.25);
      const dy = bodyY + bodyH * 0.04 + ph * bodyH * 0.2;
      ctx.fillStyle = `rgba(220,38,38,${(1 - ph) * 0.85})`;
      ctx.beginPath(); ctx.ellipse(dx, dy, 1.8, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  ctx.restore();
}

/** 鍛冶屋：石造りの炉＋煙突、外に鉄床とハンマー */
function drawForgeBuilding(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean,
): void {
  ctx.save();
  const w = ts * 3, h = ts * 2;
  const x = cx - w / 2;
  const y = cy + ts / 2 - h;
  const flicker = 0.6 + 0.4 * Math.abs(Math.sin(now * 5));

  ctx.shadowColor = `rgba(251,146,60,${0.55 + 0.35 * flicker})`;
  ctx.shadowBlur = on ? 22 : 14;

  // 石壁
  const wallG = ctx.createLinearGradient(x, y + h * 0.18, x, y + h);
  wallG.addColorStop(0, '#52525b'); wallG.addColorStop(1, '#27272a');
  ctx.fillStyle = wallG;
  roundRect(ctx, x + 4, y + h * 0.18, w - 8, h * 0.82, 3); ctx.fill();

  // 石ブロックのテクスチャ
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const ly = y + h * 0.18 + (h * 0.82) * i / 6;
    ctx.beginPath(); ctx.moveTo(x + 8, ly); ctx.lineTo(x + w - 8, ly); ctx.stroke();
    const off = (i % 2) * (w - 16) / 8;
    for (let j = 0; j < 4; j++) {
      const bx = x + 8 + off + j * (w - 16) / 4;
      if (bx < x + w - 8) {
        ctx.beginPath(); ctx.moveTo(bx, ly); ctx.lineTo(bx, ly + (h * 0.82) / 6); ctx.stroke();
      }
    }
  }

  // 屋根（三角、瓦）
  ctx.fillStyle = '#3f3f46';
  ctx.beginPath();
  ctx.moveTo(x - 2, y + h * 0.18);
  ctx.lineTo(x + w / 2, y - 4);
  ctx.lineTo(x + w + 2, y + h * 0.18);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#18181b'; ctx.lineWidth = 1.5; ctx.stroke();

  // 煙突
  const chX = x + w * 0.15, chY = y - ts * 0.35, chW = ts * 0.28, chH = ts * 0.55;
  const chG = ctx.createLinearGradient(chX, chY, chX + chW, chY);
  chG.addColorStop(0, '#18181b'); chG.addColorStop(0.5, '#3f3f46'); chG.addColorStop(1, '#18181b');
  ctx.fillStyle = chG;
  ctx.fillRect(chX, chY, chW, chH);
  ctx.fillStyle = '#09090b';
  ctx.fillRect(chX - 3, chY, chW + 6, 5);
  // 煙（大きめ）
  for (let i = 0; i < 5; i++) {
    const ph = ((now * 0.3 + i * 0.2) % 1);
    const sx = chX + chW * 0.5 + Math.sin((now + i) * 1.2) * 6;
    const sy = chY - 4 - ph * 50;
    ctx.fillStyle = `rgba(120,113,108,${(1 - ph) * 0.6})`;
    ctx.beginPath(); ctx.arc(sx, sy, 5 + ph * 8, 0, Math.PI * 2); ctx.fill();
  }

  // 炉の口（中央、光る）
  const furX = cx - ts * 0.55, furY = y + h * 0.4;
  const furW = ts * 1.1, furH = ts * 0.58;
  // 枠
  ctx.fillStyle = '#18181b';
  roundRect(ctx, furX - 4, furY - 4, furW + 8, furH + 8, 4); ctx.fill();
  // 炉内（炎）
  const mg = ctx.createRadialGradient(
    cx, furY + furH * 0.55, 2,
    cx, furY + furH * 0.55, furW * 0.55,
  );
  mg.addColorStop(0,    `rgba(255,250,200,${0.95 * flicker})`);
  mg.addColorStop(0.3,  `rgba(253,224,71,${0.9 * flicker})`);
  mg.addColorStop(0.6,  `rgba(251,146,60,${0.8 * flicker})`);
  mg.addColorStop(0.85, `rgba(185,28,28,${0.55 * flicker})`);
  mg.addColorStop(1,    'rgba(40,8,4,0)');
  ctx.fillStyle = mg;
  roundRect(ctx, furX, furY, furW, furH, 4); ctx.fill();
  // 炉内 薪
  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(furX + furW * 0.25, furY + furH * 0.75, furW * 0.1, 4);
  ctx.fillRect(furX + furW * 0.5, furY + furH * 0.78, furW * 0.12, 4);
  ctx.fillRect(furX + furW * 0.7, furY + furH * 0.73, furW * 0.1, 4);

  // 火の粉
  ctx.shadowBlur = 0;
  for (let i = 0; i < 6; i++) {
    const fa = ((now * 1.6 + i * 0.17) % 1);
    const spx = cx + Math.sin((now * 2.5 + i * 1.3)) * ts * 0.5;
    const spy = furY + furH * 0.2 - fa * ts * 0.9;
    ctx.fillStyle = `rgba(253,224,71,${(1 - fa) * 0.9})`;
    ctx.beginPath(); ctx.arc(spx, spy, 1.6, 0, Math.PI * 2); ctx.fill();
  }

  // 鉄床（手前・左）
  const anvX = x + ts * 0.2, anvY = y + h * 0.88, anvW = ts * 0.7, anvH = ts * 0.22;
  ctx.fillStyle = '#52525b';
  roundRect(ctx, anvX + anvW * 0.2, anvY + anvH * 0.75, anvW * 0.6, anvH * 0.25, 2); ctx.fill();
  ctx.fillStyle = '#27272a';
  ctx.fillRect(anvX + anvW * 0.35, anvY + anvH * 0.4, anvW * 0.3, anvH * 0.35);
  ctx.fillStyle = '#3f3f46';
  roundRect(ctx, anvX, anvY, anvW, anvH * 0.4, 2); ctx.fill();
  ctx.fillStyle = '#a1a1aa';
  ctx.fillRect(anvX + 4, anvY + 1, anvW - 8, 3);

  // ハンマー（右手前、叩き動作）
  const hX = x + w - ts * 0.65, hY = y + h * 0.86;
  ctx.save();
  ctx.translate(hX, hY);
  ctx.rotate(-0.35 + 0.25 * Math.sin(now * 3.2));
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-2, 0, 4, ts * 0.42);
  ctx.fillStyle = '#a1a1aa';
  roundRect(ctx, -9, -8, 18, 12, 2); ctx.fill();
  ctx.fillStyle = '#f4f4f5';
  ctx.fillRect(-7, -7, 5, 3);
  ctx.restore();

  // 看板（「鍛冶」文字入り）
  ctx.fillStyle = '#1c0a01';
  roundRect(ctx, cx - ts * 0.6, y + h * 0.06, ts * 1.2, h * 0.1, 3); ctx.fill();
  ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#fb923c';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 4;
  ctx.fillText('FORGE', cx, y + h * 0.11);
  ctx.shadowBlur = 0;

  ctx.restore();
}

/** 転職の祭壇：2 本の石柱＋中央祭壇、浮遊結晶、床の魔法陣 */
function drawReclassShrine(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean,
): void {
  ctx.save();
  const w = ts * 3, h = ts * 2;
  const x = cx - w / 2;
  const y = cy + ts / 2 - h;
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(now * 1.6));

  ctx.shadowColor = `rgba(168,85,247,${(on ? 0.9 : 0.55) * pulse + 0.2})`;
  ctx.shadowBlur = on ? 26 : 16;

  // 背面壁（淡紫のカーテン / 夜空）
  const bgG = ctx.createLinearGradient(x, y, x, y + h * 0.75);
  bgG.addColorStop(0, '#1e1b4b'); bgG.addColorStop(1, '#0f0a2a');
  ctx.fillStyle = bgG;
  roundRect(ctx, x + ts * 0.1, y + h * 0.12, w - ts * 0.2, h * 0.55, 4); ctx.fill();

  // 背面に浮かぶ星
  ctx.shadowBlur = 0;
  for (let i = 0; i < 8; i++) {
    const phase = (now * 0.4 + i * 0.19) % 1;
    const sx2 = x + ts * 0.2 + (w - ts * 0.4) * ((i * 0.37) % 1);
    const sy2 = y + h * 0.2 + h * 0.35 * ((i * 0.53) % 1);
    ctx.fillStyle = `rgba(221,214,254,${0.3 + 0.5 * Math.abs(Math.sin(phase * Math.PI))})`;
    ctx.beginPath(); ctx.arc(sx2, sy2, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  // 石柱×2（左右）
  ctx.shadowColor = `rgba(168,85,247,${0.5 * pulse + 0.2})`;
  ctx.shadowBlur = on ? 18 : 10;
  const colYTop = y + h * 0.1, colH = h * 0.78, colW = ts * 0.35;
  ([x + ts * 0.15, x + w - ts * 0.15 - colW] as number[]).forEach(pxLeft => {
    const pg = ctx.createLinearGradient(pxLeft, 0, pxLeft + colW, 0);
    pg.addColorStop(0, '#312e81'); pg.addColorStop(0.5, '#6366f1'); pg.addColorStop(1, '#312e81');
    ctx.fillStyle = pg;
    ctx.fillRect(pxLeft, colYTop + colH * 0.08, colW, colH * 0.82);
    // 柱頭
    ctx.fillStyle = '#a5b4fc';
    roundRect(ctx, pxLeft - 4, colYTop, colW + 8, colH * 0.1, 2); ctx.fill();
    // 柱底
    roundRect(ctx, pxLeft - 4, colYTop + colH * 0.9, colW + 8, colH * 0.1, 2); ctx.fill();
    // ルーン
    ctx.fillStyle = `rgba(253,224,255,${0.6 + 0.4 * pulse})`;
    ctx.font = `bold ${Math.floor(ts * 0.2)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#c4b5fd'; ctx.shadowBlur = 6;
    ctx.fillText('✧', pxLeft + colW / 2, colYTop + colH * 0.3);
    ctx.fillText('⚝', pxLeft + colW / 2, colYTop + colH * 0.55);
  });
  ctx.shadowBlur = 0;

  // 中央祭壇（台座）
  const altarCx = cx;
  const altarY = y + h * 0.7;
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.moveTo(altarCx - ts * 0.55, altarY + ts * 0.32);
  ctx.lineTo(altarCx + ts * 0.55, altarY + ts * 0.32);
  ctx.lineTo(altarCx + ts * 0.42, altarY + ts * 0.08);
  ctx.lineTo(altarCx - ts * 0.42, altarY + ts * 0.08);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 1.5; ctx.stroke();

  // 祭壇天面
  ctx.fillStyle = '#312e81';
  ctx.beginPath();
  ctx.ellipse(altarCx, altarY + ts * 0.08, ts * 0.42, ts * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a5b4fc'; ctx.stroke();

  // 床の魔法陣（回転）
  ctx.save();
  ctx.translate(altarCx, altarY + ts * 0.22);
  ctx.rotate(now * 0.4);
  ctx.strokeStyle = `rgba(192,132,252,${0.5 + 0.4 * pulse})`;
  ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 10;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, ts * 0.45, ts * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, ts * 0.32, ts * 0.072, 0, 0, Math.PI * 2); ctx.stroke();
  // 星型
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const rx = Math.cos(a) * ts * 0.4, ry = Math.sin(a) * ts * 0.09;
    if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
    const a2 = a + Math.PI / 5;
    ctx.lineTo(Math.cos(a2) * ts * 0.18, Math.sin(a2) * ts * 0.04);
  }
  ctx.closePath(); ctx.stroke();
  ctx.restore();

  // 浮遊結晶（祭壇上）
  const floatY = Math.sin(now * 1.8) * 4;
  const crysCy = altarY - ts * 0.05 + floatY;
  ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 18 * pulse;
  ctx.fillStyle = '#c084fc';
  ctx.beginPath();
  ctx.moveTo(altarCx,               crysCy - ts * 0.3);
  ctx.lineTo(altarCx + ts * 0.18,   crysCy - ts * 0.05);
  ctx.lineTo(altarCx + ts * 0.12,   crysCy + ts * 0.22);
  ctx.lineTo(altarCx - ts * 0.12,   crysCy + ts * 0.22);
  ctx.lineTo(altarCx - ts * 0.18,   crysCy - ts * 0.05);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#f0abfc'; ctx.lineWidth = 1; ctx.stroke();

  // ハイライト
  ctx.fillStyle = 'rgba(253,224,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(altarCx - ts * 0.06, crysCy - ts * 0.22);
  ctx.lineTo(altarCx + ts * 0.02, crysCy - ts * 0.05);
  ctx.lineTo(altarCx - ts * 0.07, crysCy + ts * 0.05);
  ctx.closePath(); ctx.fill();

  // 結晶の周囲を回るオーブ
  ctx.shadowBlur = 10;
  for (let i = 0; i < 3; i++) {
    const ang = now * 1.2 + i * (Math.PI * 2 / 3);
    const ox = altarCx + Math.cos(ang) * ts * 0.4;
    const oy = crysCy  + Math.sin(ang) * ts * 0.15;
    ctx.fillStyle = '#f0abfc';
    ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

// ─── 魂の祠（小さな浮遊結晶） ───────────────────
function drawSoulShrine(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean,
): void {
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(now * 1.4));
  const float = Math.sin(now * 1.6) * 4;
  ctx.save();
  // 台座
  ctx.shadowColor = `rgba(168,85,247,${(on ? 0.9 : 0.5) * pulse + 0.2})`;
  ctx.shadowBlur = on ? 24 : 14;
  ctx.fillStyle = '#1e1b4b';
  ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy + ts * 0.25, ts * 0.35, ts * 0.1, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#312e81';
  ctx.fillRect(cx - ts * 0.28, cy + ts * 0.05, ts * 0.56, ts * 0.18);
  ctx.strokeRect(cx - ts * 0.28, cy + ts * 0.05, ts * 0.56, ts * 0.18);

  // 浮遊する魂結晶
  const sy = cy - ts * 0.05 + float;
  ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 18 * pulse;
  ctx.fillStyle = '#c084fc';
  ctx.beginPath();
  ctx.moveTo(cx,             sy - ts * 0.28);
  ctx.lineTo(cx + ts * 0.16, sy - ts * 0.04);
  ctx.lineTo(cx + ts * 0.10, sy + ts * 0.18);
  ctx.lineTo(cx - ts * 0.10, sy + ts * 0.18);
  ctx.lineTo(cx - ts * 0.16, sy - ts * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f0abfc'; ctx.lineWidth = 1; ctx.stroke();
  // ハイライト
  ctx.fillStyle = 'rgba(253,224,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(cx - ts * 0.05, sy - ts * 0.20);
  ctx.lineTo(cx + ts * 0.02, sy - ts * 0.05);
  ctx.lineTo(cx - ts * 0.06, sy + ts * 0.05);
  ctx.closePath(); ctx.fill();

  // 周囲を回るオーブ（魂の粒）
  ctx.shadowBlur = 8;
  for (let i = 0; i < 4; i++) {
    const ang = now * 1.0 + i * (Math.PI * 2 / 4);
    const ox = cx + Math.cos(ang) * ts * 0.32;
    const oy = sy + Math.sin(ang) * ts * 0.12;
    ctx.fillStyle = '#e9d5ff';
    ctx.beginPath(); ctx.arc(ox, oy, 1.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawQuestSignboard(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean,
  claimable: number,
): void {
  ctx.save();
  const sway = Math.sin(now * 1.8) * 1.4;

  // 土に刺さった木の杭（左右2本）
  const postW = ts * 0.08;
  const postH = ts * 0.58;
  const postY = cy - ts * 0.04;
  ctx.fillStyle = '#78350f';
  ctx.fillRect(cx - ts * 0.30 - postW / 2, postY, postW, postH);
  ctx.fillRect(cx + ts * 0.30 - postW / 2, postY, postW, postH);

  // 掲示板本体
  const bw = ts * 0.82;
  const bh = ts * 0.52;
  const bx = cx - bw / 2;
  const by = cy - ts * 0.34 + sway * 0.3;
  const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
  grad.addColorStop(0, '#a16207'); grad.addColorStop(1, '#713f12');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1.5;
  if (on) { ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 12; }
  roundRect(ctx, bx, by, bw, bh, 4);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;

  // 木目
  ctx.strokeStyle = 'rgba(68,26,3,0.45)';
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 3; i++) {
    const ly = by + (bh * i) / 3;
    ctx.beginPath();
    ctx.moveTo(bx + 4, ly); ctx.lineTo(bx + bw - 4, ly);
    ctx.stroke();
  }

  // ── 小屋根（雨避け）：板の上に三角の小さな屋根を乗せる ──
  const roofH = ts * 0.10;
  const roofOverhang = ts * 0.06;
  const roofY = by - roofH;
  const roofGrad = ctx.createLinearGradient(bx, roofY, bx, roofY + roofH);
  roofGrad.addColorStop(0, '#4b2408');
  roofGrad.addColorStop(1, '#2a1304');
  ctx.fillStyle   = roofGrad;
  ctx.strokeStyle = '#1c0a01';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(bx - roofOverhang,      roofY + roofH);
  ctx.lineTo(cx,                     roofY);
  ctx.lineTo(bx + bw + roofOverhang, roofY + roofH);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 屋根の瓦目（横線）
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth   = 0.6;
  ctx.beginPath();
  ctx.moveTo(bx - roofOverhang * 0.6, roofY + roofH * 0.7);
  ctx.lineTo(bx + bw + roofOverhang * 0.6, roofY + roofH * 0.7);
  ctx.stroke();

  // ── 羊皮紙3枚（手書き風縞線・画鋲留め）──
  const scrollW = bw * 0.22;
  const scrollH = bh * 0.6;
  for (let i = 0; i < 3; i++) {
    const sx = bx + bw * 0.12 + i * (scrollW + bw * 0.05);
    const sy = by + bh * 0.18 + Math.sin(now * 2 + i) * 0.8;

    // 紙の微回転（端が少し折れた雰囲気）
    ctx.save();
    const tilt = Math.sin(i * 1.3) * 0.04;
    ctx.translate(sx + scrollW / 2, sy + scrollH / 2);
    ctx.rotate(tilt);
    ctx.translate(-(sx + scrollW / 2), -(sy + scrollH / 2));

    // 羊皮紙グラデ（中央やや明るく）
    const paperGrad = ctx.createLinearGradient(sx, sy, sx, sy + scrollH);
    paperGrad.addColorStop(0,   '#fef3c7');
    paperGrad.addColorStop(0.5, '#fde68a');
    paperGrad.addColorStop(1,   '#f0d48a');
    ctx.fillStyle = paperGrad;
    roundRect(ctx, sx, sy, scrollW, scrollH, 1.5);
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // 手書き風の縞線（Path2D でまとめて描く）
    const lines = new Path2D();
    for (let li = 0; li < 4; li++) {
      const ly = sy + 3 + li * ((scrollH - 6) / 4);
      const wob = Math.sin(li * 1.7 + i) * 0.6;
      lines.moveTo(sx + 2, ly + wob);
      // 途中に1点だけわずかに波打たせる
      lines.quadraticCurveTo(
        sx + scrollW / 2, ly + wob + 0.8,
        sx + scrollW - 2, ly + wob,
      );
    }
    ctx.strokeStyle = 'rgba(120,53,15,0.7)';
    ctx.lineWidth   = 0.6;
    ctx.stroke(lines);

    // 画鋲（上端中央に小さな赤丸＋ハイライト）
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.arc(sx + scrollW / 2, sy + 1.5, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(sx + scrollW / 2 - 0.4, sy + 1.1, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 完了可能な紙にはキラッとしたハイライトを重ねる
    if (claimable > i) {
      const sparkle = 0.4 + 0.6 * Math.abs(Math.sin(now * 3 + i * 1.1));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(253,224,71,${0.25 * sparkle})`;
      roundRect(ctx, sx, sy, scrollW, scrollH, 1.5);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  // 受取可能バッジ
  if (claimable > 0) {
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(now * 4));
    const badgeX = bx + bw - 4;
    const badgeY = by + 4;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 10 * pulse;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(claimable), badgeX, badgeY + 0.5);
  }
  ctx.restore();
}

function drawReception(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number,
  now: number, on: boolean,
): void {
  ctx.save();
  // 受付カウンター（木の台）
  const cw = ts * 0.72;
  const ch = ts * 0.28;
  const bx = cx - cw / 2;
  const by = cy + ts * 0.06;
  const grad = ctx.createLinearGradient(bx, by, bx, by + ch);
  grad.addColorStop(0, '#92400e'); grad.addColorStop(1, '#451a03');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#1c0a01'; ctx.lineWidth = 1;
  if (on) { ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 10; }
  roundRect(ctx, bx, by, cw, ch, 3);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;

  // 台の模様（仕切り）
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(bx + cw / 3, by); ctx.lineTo(bx + cw / 3, by + ch);
  ctx.moveTo(bx + cw * 2 / 3, by); ctx.lineTo(bx + cw * 2 / 3, by + ch);
  ctx.stroke();

  // 受付嬢（小さめキャラクター）
  const headY = cy - ts * 0.16;
  // 髪の毛（赤いポニーテール）
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(cx - ts * 0.04, headY - ts * 0.04, ts * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // 顔
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(cx, headY, ts * 0.10, 0, Math.PI * 2);
  ctx.fill();
  // 目
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(cx - ts * 0.04, headY - ts * 0.01, 2, 2);
  ctx.fillRect(cx + ts * 0.02, headY - ts * 0.01, 2, 2);
  // 笑顔
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx - ts * 0.01, headY + ts * 0.03, ts * 0.025, 0, Math.PI);
  ctx.stroke();
  // 上半身（制服）
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(cx - ts * 0.10, headY + ts * 0.08, ts * 0.20, ts * 0.12);
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(cx - ts * 0.02, headY + ts * 0.10, ts * 0.04, ts * 0.08); // ネクタイ

  // 台の上に小さいトロフィー
  const trophyPulse = 0.7 + 0.3 * Math.abs(Math.sin(now * 2));
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 8 * trophyPulse;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(cx + ts * 0.22, by + 4);
  ctx.lineTo(cx + ts * 0.30, by + 4);
  ctx.lineTo(cx + ts * 0.28, by + 14);
  ctx.lineTo(cx + ts * 0.24, by + 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx + ts * 0.23, by + 14, ts * 0.08, 3);
  ctx.restore();
}

// ─── エクスポート関数 ──────────────────────────

// ─── 街の装飾：石畳・街灯・ベンチ・街路樹・市場の荷車 ───

/** 石畳の大通り（タイル群をまとめて暖色の石床として塗る） */
function drawCobblestoneStrip(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, w: number, h: number,
): void {
  ctx.save();
  const g = ctx.createLinearGradient(x0, y0, x0, y0 + h);
  g.addColorStop(0, '#3f3a32');
  g.addColorStop(0.5, '#4a433a');
  g.addColorStop(1, '#322d27');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, w, h);
  // 石目（千鳥）
  ctx.strokeStyle = 'rgba(0,0,0,0.32)';
  ctx.lineWidth = 1;
  const cell = 18;
  for (let py = 0; py < h; py += cell) {
    const offset = ((py / cell) | 0) % 2 === 0 ? 0 : cell / 2;
    for (let px = -cell; px < w + cell; px += cell) {
      const rx = x0 + px + offset;
      const ry = y0 + py;
      ctx.strokeRect(rx, ry, cell - 1, cell - 1);
    }
  }
  // ハイライト（縁石）
  ctx.strokeStyle = 'rgba(251,191,36,0.12)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x0 + 1, y0); ctx.lineTo(x0 + 1, y0 + h);
  ctx.moveTo(x0 + w - 1, y0); ctx.lineTo(x0 + w - 1, y0 + h);
  ctx.stroke();
  ctx.restore();
}

/** 装飾の街灯（ランタン付き鉄柱） */
function drawStreetLamp(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, now: number, seed: number,
): void {
  const flick = 0.8 + 0.2 * Math.sin(now * 6 + seed * 1.7);
  ctx.save();
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // 台座
  ctx.fillStyle = '#1f1d1b';
  ctx.fillRect(cx - 6, cy + 2, 12, 8);
  ctx.fillStyle = '#3a3631';
  ctx.fillRect(cx - 5, cy + 3, 10, 6);
  // 柱
  ctx.fillStyle = '#2a2724';
  ctx.fillRect(cx - 2, cy - 30, 4, 34);
  // 装飾のリング
  ctx.fillStyle = '#5a4024';
  ctx.fillRect(cx - 4, cy - 14, 8, 2);
  // 吊り下げ腕
  ctx.strokeStyle = '#2a2724';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 30);
  ctx.quadraticCurveTo(cx + 4, cy - 34, cx + 6, cy - 30);
  ctx.stroke();
  // ランタン枠
  ctx.fillStyle = '#2a2724';
  ctx.fillRect(cx + 3, cy - 30, 6, 10);
  // ランタン光
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 18 * flick;
  const lg = ctx.createRadialGradient(cx + 6, cy - 25, 1, cx + 6, cy - 25, 8);
  lg.addColorStop(0, `rgba(254,240,138,${0.95 * flick})`);
  lg.addColorStop(0.6, `rgba(251,191,36,${0.6 * flick})`);
  lg.addColorStop(1, 'rgba(251,191,36,0)');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.arc(cx + 6, cy - 25, 8, 0, Math.PI * 2);
  ctx.fill();
  // 地面の光だまり
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'lighter';
  const gg = ctx.createRadialGradient(cx + 2, cy + 4, 2, cx + 2, cy + 4, 38);
  gg.addColorStop(0, `rgba(253,224,71,${0.28 * flick})`);
  gg.addColorStop(1, 'rgba(253,224,71,0)');
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 4, 38, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 石のベンチ（噴水や広場の縁に置く） */
function drawStoneBench(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, horizontal: boolean,
): void {
  ctx.save();
  if (!horizontal) {
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 2);
    ctx.translate(-cx, -cy);
  }
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 28, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // 脚
  ctx.fillStyle = '#3a3631';
  ctx.fillRect(cx - 22, cy, 6, 8);
  ctx.fillRect(cx + 16, cy, 6, 8);
  // 座面
  const sg = ctx.createLinearGradient(cx, cy - 3, cx, cy + 4);
  sg.addColorStop(0, '#6b625a');
  sg.addColorStop(1, '#3a3631');
  ctx.fillStyle = sg;
  roundRect(ctx, cx - 26, cy - 3, 52, 7, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 2); ctx.lineTo(cx - 10, cy + 3);
  ctx.moveTo(cx + 10, cy - 2); ctx.lineTo(cx + 10, cy + 3);
  ctx.stroke();
  ctx.restore();
}

/** 街路樹（シルエット） */
function drawStreetTree(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, now: number, seed: number,
): void {
  const sway = Math.sin(now * 1.2 + seed) * 2;
  ctx.save();
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 12, 22, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 幹
  const tg = ctx.createLinearGradient(cx, cy - 10, cx, cy + 12);
  tg.addColorStop(0, '#5a3d1e');
  tg.addColorStop(1, '#2d1c0c');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy + 10);
  ctx.lineTo(cx - 2, cy - 8);
  ctx.lineTo(cx + 2, cy - 8);
  ctx.lineTo(cx + 3, cy + 10);
  ctx.closePath();
  ctx.fill();
  // 樹冠（3層）
  const cg = ctx.createRadialGradient(cx + sway, cy - 18, 2, cx + sway, cy - 16, 24);
  cg.addColorStop(0, '#4ade80');
  cg.addColorStop(0.6, '#166534');
  cg.addColorStop(1, '#14532d');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(cx + sway, cy - 20, 14, 0, Math.PI * 2);
  ctx.arc(cx + sway - 10, cy - 14, 11, 0, Math.PI * 2);
  ctx.arc(cx + sway + 10, cy - 14, 11, 0, Math.PI * 2);
  ctx.arc(cx + sway, cy - 10, 12, 0, Math.PI * 2);
  ctx.fill();
  // ハイライト
  ctx.fillStyle = 'rgba(134,239,172,0.35)';
  ctx.beginPath();
  ctx.arc(cx + sway - 4, cy - 22, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 市場の荷車（樽と木箱を積む） */
function drawMarketCart(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, flipX: boolean,
): void {
  ctx.save();
  if (flipX) {
    ctx.translate(cx, cy); ctx.scale(-1, 1); ctx.translate(-cx, -cy);
  }
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 14, 26, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 車輪
  ctx.fillStyle = '#1c1917';
  ctx.beginPath(); ctx.arc(cx - 16, cy + 10, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 16, cy + 10, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#78350f';
  ctx.beginPath(); ctx.arc(cx - 16, cy + 10, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 16, cy + 10, 4.5, 0, Math.PI * 2); ctx.fill();
  // スポーク
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 0.8;
  for (const wx of [-16, 16]) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx + wx, cy + 10);
      ctx.lineTo(cx + wx + Math.cos(a) * 4, cy + 10 + Math.sin(a) * 4);
      ctx.stroke();
    }
  }
  // 荷台
  const bg = ctx.createLinearGradient(cx, cy - 2, cx, cy + 10);
  bg.addColorStop(0, '#a16207');
  bg.addColorStop(1, '#78350f');
  ctx.fillStyle = bg;
  roundRect(ctx, cx - 22, cy - 2, 44, 12, 2);
  ctx.fill();
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 0.8;
  for (let i = -18; i <= 18; i += 6) {
    ctx.beginPath(); ctx.moveTo(cx + i, cy - 1); ctx.lineTo(cx + i, cy + 9); ctx.stroke();
  }
  // 樽
  const barG = ctx.createLinearGradient(cx - 16, cy - 16, cx - 16, cy - 2);
  barG.addColorStop(0, '#92400e');
  barG.addColorStop(1, '#451a03');
  ctx.fillStyle = barG;
  roundRect(ctx, cx - 22, cy - 16, 12, 14, 2); ctx.fill();
  ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(cx - 22, cy - 12); ctx.lineTo(cx - 10, cy - 12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 22, cy - 6); ctx.lineTo(cx - 10, cy - 6); ctx.stroke();
  // 木箱
  ctx.fillStyle = '#b45309';
  roundRect(ctx, cx - 6, cy - 14, 14, 12, 2); ctx.fill();
  ctx.strokeStyle = '#451a03'; ctx.lineWidth = 0.8;
  ctx.strokeRect(cx - 6, cy - 14, 14, 12);
  // りんご
  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.arc(cx + 12, cy - 5, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 16, cy - 4, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 14, cy - 7, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#166534';
  ctx.beginPath(); ctx.arc(cx + 12, cy - 7, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** 樽・木箱のクラスタ（裏路地用） */
function drawAlleyClutter(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, seed: number,
): void {
  ctx.save();
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, 22, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // 木箱（奥）
  ctx.fillStyle = '#854d0e';
  roundRect(ctx, cx - 16, cy - 8, 14, 16, 2); ctx.fill();
  ctx.strokeStyle = '#451a03'; ctx.lineWidth = 0.8;
  ctx.strokeRect(cx - 16, cy - 8, 14, 16);
  ctx.beginPath(); ctx.moveTo(cx - 16, cy); ctx.lineTo(cx - 2, cy); ctx.stroke();
  // 樽（手前）
  const bg = ctx.createLinearGradient(cx, cy - 6, cx, cy + 10);
  bg.addColorStop(0, '#92400e');
  bg.addColorStop(1, '#3f1f04');
  ctx.fillStyle = bg;
  roundRect(ctx, cx - 2, cy - 8, 16, 18, 3); ctx.fill();
  ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 2, cy - 3); ctx.lineTo(cx + 14, cy - 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 2, cy + 3); ctx.lineTo(cx + 14, cy + 3); ctx.stroke();
  // フタ
  ctx.fillStyle = '#78350f';
  roundRect(ctx, cx - 2, cy - 9, 16, 3, 1); ctx.fill();
  // 猫目の光（雰囲気）
  if ((seed | 0) % 3 === 0) {
    ctx.fillStyle = '#fde68a';
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(cx + 18, cy + 4, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 21, cy + 4, 0.9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** 建物間に渡す吊り旗 */
function drawBuntingLine(
  ctx: CanvasRenderingContext2D,
  x0: number, x1: number, y: number, now: number, color: string,
): void {
  ctx.save();
  const flags = 7;
  // ロープ
  ctx.strokeStyle = '#44403c';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + 6, x1, y);
  ctx.stroke();
  // 三角旗
  for (let i = 0; i < flags; i++) {
    const t = (i + 0.5) / flags;
    const px = x0 + (x1 - x0) * t;
    const py = y + 6 * (1 - Math.pow(2 * t - 1, 2));
    const sway = Math.sin(now * 2 + i) * 1.5;
    ctx.fillStyle = i % 2 === 0 ? color : '#fde68a';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 2;
    ctx.beginPath();
    ctx.moveTo(px - 4, py);
    ctx.lineTo(px + 4, py);
    ctx.lineTo(px + sway, py + 10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** 道標 */
function drawSignPost(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, labels: string[],
): void {
  ctx.save();
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 14, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // 柱
  ctx.fillStyle = '#5a4024';
  ctx.fillRect(cx - 2, cy - 16, 4, 30);
  // 矢印看板
  for (let i = 0; i < labels.length; i++) {
    const py = cy - 10 + i * 10;
    const dir = i % 2 === 0 ? 1 : -1;
    ctx.fillStyle = i % 2 === 0 ? '#a16207' : '#854d0e';
    ctx.beginPath();
    const bx = cx + (dir > 0 ? 0 : -28);
    ctx.moveTo(bx, py);
    ctx.lineTo(bx + 24 * dir, py);
    ctx.lineTo(bx + 28 * dir, py + 3);
    ctx.lineTo(bx + 24 * dir, py + 6);
    ctx.lineTo(bx, py + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3f1f04'; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 7px "Noto Sans JP", monospace';
    ctx.textAlign = dir > 0 ? 'center' : 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[i], bx + 12 * dir, py + 3);
  }
  ctx.restore();
}

// ─── 地区別の舗装基盤（大通りの下に敷く） ───

/** 中央広場：放射状の磨石パターン */
function drawPlazaSubstrate(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
): void {
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, '#6b625a');
  g.addColorStop(0.55, '#524a42');
  g.addColorStop(1, '#2f2a25');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // 放射目地
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.15, cy + Math.sin(a) * r * 0.15);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  // 同心円
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  for (const rr of [0.3, 0.55, 0.8]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 金色の縁取り
  ctx.strokeStyle = 'rgba(251,191,36,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** 市場の煉瓦ブロック（暖色のヘリンボーン） */
function drawBrickArea(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, w: number, h: number,
): void {
  ctx.save();
  const g = ctx.createLinearGradient(x0, y0, x0, y0 + h);
  g.addColorStop(0, '#7c3a0e');
  g.addColorStop(1, '#4a1f04');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, w, h);
  // ヘリンボーン
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  const bw = 22, bh = 11;
  for (let py = 0; py < h; py += bh) {
    const rowOffset = ((py / bh) | 0) % 2 === 0 ? 0 : bw / 2;
    for (let pxo = -bw; pxo < w + bw; pxo += bw) {
      const rx = x0 + pxo + rowOffset;
      const ry = y0 + py;
      ctx.strokeRect(rx, ry, bw - 1, bh - 1);
    }
  }
  // 縁石（黄土色）
  ctx.strokeStyle = 'rgba(251,191,36,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 + 1, y0 + 1, w - 2, h - 2);
  ctx.restore();
}

/** 裏路地の荒れた石床 */
function drawAlleySubstrate(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, w: number, h: number,
): void {
  ctx.save();
  ctx.fillStyle = '#1c1a17';
  ctx.fillRect(x0, y0, w, h);
  // ひび割れ
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  const rnd = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 18; i++) {
    const sx = x0 + rnd(i * 3.1) * w;
    const sy = y0 + rnd(i * 5.7) * h;
    const ex = sx + (rnd(i * 7.3) - 0.5) * 30;
    const ey = sy + (rnd(i * 9.1) - 0.5) * 24;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  }
  // 暗いシミ
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let i = 0; i < 6; i++) {
    const cx = x0 + rnd(i * 11.3) * w;
    const cy = y0 + rnd(i * 13.7) * h;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 14 + rnd(i) * 8, 6 + rnd(i * 2) * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** ダンジョン区の黒玄武岩（ルーンが明滅） */
function drawDungeonDistrictFloor(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, w: number, h: number, now: number,
): void {
  ctx.save();
  const g = ctx.createLinearGradient(x0, y0, x0, y0 + h);
  g.addColorStop(0, '#1a0f2a');
  g.addColorStop(1, '#0a0615');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, w, h);
  // 大きな石板
  ctx.strokeStyle = 'rgba(124,58,237,0.15)';
  ctx.lineWidth = 1;
  const cell = 48;
  for (let py = 0; py < h; py += cell) {
    for (let pxo = 0; pxo < w; pxo += cell) {
      ctx.strokeRect(x0 + pxo + 1, y0 + py + 1, cell - 2, cell - 2);
    }
  }
  // ルーン（浮かぶ光）
  ctx.fillStyle = 'rgba(168,85,247,0.5)';
  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur = 10;
  for (let i = 0; i < 12; i++) {
    const rx = x0 + ((i * 97) % (w - 16)) + 8;
    const ry = y0 + ((i * 53) % (h - 16)) + 8;
    const alpha = 0.3 + 0.4 * Math.abs(Math.sin(now * 1.5 + i));
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(rx, ry, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 井戸（小さな共同井戸） */
function drawWell(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
): void {
  ctx.save();
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 14, 22, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 石壁
  ctx.fillStyle = '#52525b';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 20, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a3631';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 水面
  ctx.fillStyle = '#1e40af';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 14, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(147,197,253,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx - 3, cy + 1, 5, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // 支柱
  ctx.fillStyle = '#5a4024';
  ctx.fillRect(cx - 16, cy - 14, 3, 16);
  ctx.fillRect(cx + 13, cy - 14, 3, 16);
  // 横木（屋根の梁）
  ctx.fillStyle = '#3f1f04';
  ctx.fillRect(cx - 18, cy - 16, 36, 3);
  // 屋根
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy - 14);
  ctx.lineTo(cx, cy - 24);
  ctx.lineTo(cx + 22, cy - 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#451a03'; ctx.lineWidth = 0.8;
  ctx.stroke();
  // ロープと釣瓶
  ctx.strokeStyle = '#a16207'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, cy - 13); ctx.lineTo(cx, cy - 4); ctx.stroke();
  ctx.fillStyle = '#78350f';
  roundRect(ctx, cx - 3, cy - 4, 6, 5, 1); ctx.fill();
  ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 0.6;
  ctx.strokeRect(cx - 3, cy - 4, 6, 5);
  ctx.restore();
}

/** 花のプランター */
function drawFlowerPlanter(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, color: string,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, 18, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // 木箱
  const g = ctx.createLinearGradient(cx, cy, cx, cy + 10);
  g.addColorStop(0, '#92400e');
  g.addColorStop(1, '#451a03');
  ctx.fillStyle = g;
  roundRect(ctx, cx - 16, cy, 32, 10, 2);
  ctx.fill();
  ctx.strokeStyle = '#3f1f04'; ctx.lineWidth = 0.8;
  for (let i = -12; i <= 12; i += 6) {
    ctx.beginPath(); ctx.moveTo(cx + i, cy + 1); ctx.lineTo(cx + i, cy + 9); ctx.stroke();
  }
  // 葉
  ctx.fillStyle = '#166534';
  ctx.beginPath();
  ctx.ellipse(cx - 10, cy - 2, 4, 3, 0.3, 0, Math.PI * 2);
  ctx.ellipse(cx + 10, cy - 2, 4, 3, -0.3, 0, Math.PI * 2);
  ctx.ellipse(cx, cy - 2, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 花
  for (const [dx, dy] of [[-10, -3], [-3, -5], [4, -4], [10, -3]] as [number, number][]) {
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 0.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** 小さな篝火台 */
function drawSmallBrazier(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, now: number, seed: number,
): void {
  const flick = 0.75 + 0.25 * Math.sin(now * 8 + seed);
  ctx.save();
  // 三脚
  ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy + 10); ctx.lineTo(cx - 2, cy - 2);
  ctx.moveTo(cx + 10, cy + 10); ctx.lineTo(cx + 2, cy - 2);
  ctx.moveTo(cx, cy + 12); ctx.lineTo(cx, cy - 2);
  ctx.stroke();
  // 鉢
  ctx.fillStyle = '#3a3631';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 2, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 3, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // 炎
  ctx.shadowColor = '#fb923c';
  ctx.shadowBlur = 18 * flick;
  const fg = ctx.createRadialGradient(cx, cy - 4, 1, cx, cy - 10 * flick, 10 * flick);
  fg.addColorStop(0, `rgba(254,240,138,${flick})`);
  fg.addColorStop(0.5, `rgba(251,146,60,${0.9 * flick})`);
  fg.addColorStop(1, 'rgba(185,28,28,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 3);
  ctx.quadraticCurveTo(cx - 2, cy - 14 * flick, cx, cy - 16 * flick);
  ctx.quadraticCurveTo(cx + 2, cy - 14 * flick, cx + 6, cy - 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 地区入口の石門アーチ */
function drawArchway(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number, label: string, color: string,
): void {
  ctx.save();
  const h = w * 0.8;
  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.45, w * 0.6, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  // 柱
  const pg = ctx.createLinearGradient(cx - w / 2, cy, cx + w / 2, cy);
  pg.addColorStop(0, '#52525b');
  pg.addColorStop(0.5, '#78716c');
  pg.addColorStop(1, '#3f3f46');
  ctx.fillStyle = pg;
  ctx.fillRect(cx - w * 0.5, cy - h * 0.1, w * 0.12, h * 0.55);
  ctx.fillRect(cx + w * 0.38, cy - h * 0.1, w * 0.12, h * 0.55);
  // 柱頭・台座
  ctx.fillStyle = '#44403c';
  ctx.fillRect(cx - w * 0.55, cy - h * 0.12, w * 0.22, h * 0.04);
  ctx.fillRect(cx + w * 0.33, cy - h * 0.12, w * 0.22, h * 0.04);
  ctx.fillRect(cx - w * 0.55, cy + h * 0.39, w * 0.22, h * 0.06);
  ctx.fillRect(cx + w * 0.33, cy + h * 0.39, w * 0.22, h * 0.06);
  // アーチ
  ctx.fillStyle = '#52525b';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, cy - h * 0.1);
  ctx.arc(cx, cy - h * 0.1, w * 0.5, Math.PI, 0);
  ctx.lineTo(cx + w * 0.5, cy - h * 0.3);
  ctx.arc(cx, cy - h * 0.3, w * 0.5, 0, Math.PI, true);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 1; ctx.stroke();
  // キーストーン
  ctx.fillStyle = color;
  ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - h * 0.55);
  ctx.lineTo(cx + 8, cy - h * 0.55);
  ctx.lineTo(cx + 5, cy - h * 0.4);
  ctx.lineTo(cx - 5, cy - h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // 銘文
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 10px "Noto Sans JP", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 2;
  ctx.fillText(label, cx, cy - h * 0.22);
  ctx.restore();
}

// ─── SVG Path2D を活用したリッチな建物 ───

function withTransform(
  ctx: CanvasRenderingContext2D,
  tx: number, ty: number, sx: number, sy: number,
  fn: () => void,
): void {
  ctx.save();
  ctx.translate(tx, ty);
  ctx.scale(sx, sy);
  fn();
  ctx.restore();
}

/** リッチな煙（煙突から立ち昇る） */
function drawChimneySmoke(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, now: number, seed: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 5; i++) {
    const t = ((now * 0.4 + i * 0.2 + seed * 0.13) % 1);
    const r = 4 + t * 18;
    const y = cy - t * 42;
    const x = cx + Math.sin(t * Math.PI * 2 + seed) * 6;
    const alpha = (1 - t) * 0.5;
    ctx.fillStyle = `rgba(200,200,200,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * リッチな町屋（SVG Path2D ベース）
 * kind:
 *   0 = 切妻・石造（赤茶屋根）
 *   1 = マンサード・漆喰（青屋根）
 *   2 = 切妻・木組み Tudor
 *   3 = 円錐塔（小塔）
 *   4 = 大聖堂風（バラ窓）
 *   5 = 切妻・商店（看板あり）
 */
function drawRichHouse(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number, h: number,
  kind: number, now: number, seed: number,
): void {
  const wallPalettes: [string, string, string, string][] = [
    ['#8c6d58', '#5c4433', '#a08670', '#3a2818'], // 石（暖）
    ['#d4c5a9', '#8a7a60', '#e8dcc0', '#4a3d2a'], // 漆喰
    ['#9b6b3f', '#5a3817', '#b88655', '#3f1f04'], // 煉瓦
    ['#6c7281', '#3f4451', '#8a93a3', '#1f232b'], // 灰石
    ['#b25534', '#6d2e13', '#d16e45', '#3d1506'], // 赤煉瓦
    ['#7c6f56', '#4a4435', '#9b8e70', '#2d291e'], // 漆喰（暗）
  ];
  const roofPalettes: [string, string][] = [
    ['#7f1d1d', '#450a0a'], // 深紅瓦
    ['#1e3a8a', '#0c1e4a'], // 青瓦
    ['#166534', '#052e16'], // 緑瓦
    ['#7c2d12', '#3f1f04'], // 茶瓦
    ['#3730a3', '#1e1b4b'], // 紫瓦
  ];
  const pal = wallPalettes[seed % wallPalettes.length];
  const roof = roofPalettes[(seed * 3 + 1) % roofPalettes.length];
  const isTall = kind === 3 || kind === 4;
  const useTower = kind === 3;
  const useCathedral = kind === 4;
  const effectiveH = isTall ? h * 1.6 : h;

  ctx.save();

  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.5 + 4, w * 0.6, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── 本体 ──
  const bodyTop = cy - effectiveH * 0.25;
  const bodyBot = cy + h * 0.5;
  const bodyH = bodyBot - bodyTop;
  const bodyW = w;
  const bodyX = cx - bodyW / 2;

  // 壁下地
  const bg = ctx.createLinearGradient(cx, bodyTop, cx, bodyBot);
  bg.addColorStop(0, pal[0]);
  bg.addColorStop(0.5, pal[0]);
  bg.addColorStop(1, pal[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(bodyX, bodyTop, bodyW, bodyH);

  // 石組みのテクスチャ（千鳥）
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.6;
  const stoneH = 9;
  for (let py = 0; py < bodyH; py += stoneH) {
    const offset = ((py / stoneH) | 0) % 2 === 0 ? 0 : 10;
    ctx.beginPath();
    ctx.moveTo(bodyX, bodyTop + py);
    ctx.lineTo(bodyX + bodyW, bodyTop + py);
    ctx.stroke();
    for (let sx = bodyX - 20 + offset; sx < bodyX + bodyW; sx += 20) {
      ctx.beginPath();
      ctx.moveTo(sx, bodyTop + py);
      ctx.lineTo(sx, bodyTop + py + stoneH);
      ctx.stroke();
    }
  }
  // ハイライト
  ctx.fillStyle = `rgba(255,255,255,0.08)`;
  ctx.fillRect(bodyX, bodyTop, 3, bodyH);

  // コーナーストーン（角石）
  ctx.fillStyle = pal[2];
  for (const [dx, dy] of [[0, 0], [bodyW - 7, 0], [0, bodyH - 7], [bodyW - 7, bodyH - 7]] as [number, number][]) {
    ctx.fillRect(bodyX + dx, bodyTop + dy, 7, 7);
  }

  // 木組み（Tudor）装飾
  if (kind === 2) {
    ctx.save();
    ctx.strokeStyle = pal[3];
    ctx.lineWidth = 2;
    // 縦梁
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.4, bodyTop + bodyH * 0.1);
    ctx.lineTo(cx - bodyW * 0.4, bodyBot);
    ctx.moveTo(cx + bodyW * 0.4, bodyTop + bodyH * 0.1);
    ctx.lineTo(cx + bodyW * 0.4, bodyBot);
    // 横梁
    ctx.moveTo(bodyX, bodyTop + bodyH * 0.55);
    ctx.lineTo(bodyX + bodyW, bodyTop + bodyH * 0.55);
    ctx.stroke();
    // 斜め
    withTransform(ctx, cx, bodyTop + bodyH * 0.3, bodyW * 0.35, bodyH * 0.2, () => {
      ctx.strokeStyle = pal[3]; ctx.lineWidth = 0.12;
      ctx.stroke(TIMBER_V);
    });
    withTransform(ctx, cx, bodyTop + bodyH * 0.75, bodyW * 0.35, bodyH * 0.15, () => {
      ctx.strokeStyle = pal[3]; ctx.lineWidth = 0.12;
      ctx.stroke(TIMBER_X);
    });
    ctx.restore();
  }

  // ── 窓 ──
  if (useCathedral) {
    // バラ窓（大聖堂）
    withTransform(ctx, cx, bodyTop + bodyH * 0.3, bodyW * 0.20, bodyW * 0.20, () => {
      ctx.save();
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(253,224,71,0.75)';
      ctx.beginPath(); ctx.arc(0, 0, 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 0.07;
      ctx.stroke(ROSE_WINDOW);
      ctx.restore();
    });
    // アーチ窓左右
    for (const dxPct of [-0.32, 0.32]) {
      withTransform(ctx, cx + dxPct * bodyW, bodyTop + bodyH * 0.65, bodyW * 0.11, bodyH * 0.22, () => {
        ctx.fillStyle = '#1c1917';
        ctx.fill(WINDOW_ARCH);
        ctx.fillStyle = `rgba(254,240,138,${0.5 + 0.3 * Math.abs(Math.sin(now * 2 + seed))})`;
        ctx.fill(WINDOW_ARCH);
        ctx.strokeStyle = '#0c0a09'; ctx.lineWidth = 0.08;
        ctx.stroke(WINDOW_ARCH);
      });
    }
  } else if (useTower) {
    // 塔：縦に2個のアーチ窓
    for (const dyPct of [0.20, 0.55, 0.85]) {
      withTransform(ctx, cx, bodyTop + bodyH * dyPct, bodyW * 0.15, bodyH * 0.14, () => {
        ctx.fillStyle = '#0c0a09';
        ctx.fill(WINDOW_ARCH);
        ctx.fillStyle = `rgba(253,224,71,${0.55 + 0.3 * Math.abs(Math.sin(now * 1.5 + seed * 0.7))})`;
        ctx.fill(WINDOW_ARCH);
        ctx.strokeStyle = '#0c0a09'; ctx.lineWidth = 0.1;
        ctx.stroke(WINDOW_ARCH);
      });
    }
  } else {
    // 標準：2列×2〜3段
    const rows = kind === 0 ? 2 : (kind % 2 === 0 ? 1 : 2);
    const cols = 2;
    const winWScale = bodyW * 0.18;
    const winHScale = bodyH * 0.17;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = cx + (c - 0.5) * bodyW * 0.45;
        const wy = bodyTop + bodyH * (0.2 + r * 0.35);
        // 窓枠
        ctx.fillStyle = pal[3];
        ctx.fillRect(wx - winWScale * 0.58, wy - winHScale * 0.58, winWScale * 1.16, winHScale * 1.16);
        // 窓ガラス
        const flick = 0.5 + 0.3 * Math.abs(Math.sin(now * (1 + r * 0.4) + c + seed));
        const glass = ctx.createLinearGradient(wx, wy - winHScale, wx, wy + winHScale);
        glass.addColorStop(0, `rgba(254,240,138,${flick * 0.9})`);
        glass.addColorStop(1, `rgba(251,146,60,${flick * 0.6})`);
        ctx.fillStyle = glass;
        ctx.fillRect(wx - winWScale * 0.5, wy - winHScale * 0.5, winWScale, winHScale);
        // ムリオン or 鉛格子
        withTransform(ctx, wx, wy, winWScale, winHScale, () => {
          ctx.strokeStyle = pal[3]; ctx.lineWidth = 0.15;
          ctx.stroke(kind === 2 ? WINDOW_LEAD : WINDOW_MULLION);
        });
        // 鎧戸
        ctx.fillStyle = pal[1];
        ctx.fillRect(wx - winWScale * 0.75, wy - winHScale * 0.58, winWScale * 0.15, winHScale * 1.16);
        ctx.fillRect(wx + winWScale * 0.60, wy - winHScale * 0.58, winWScale * 0.15, winHScale * 1.16);
        // 鎧戸の板目
        ctx.strokeStyle = pal[3]; ctx.lineWidth = 0.5;
        for (let k = 0; k < 3; k++) {
          const shy = wy + (-0.45 + k * 0.35) * winHScale;
          ctx.beginPath();
          ctx.moveTo(wx - winWScale * 0.73, shy);
          ctx.lineTo(wx - winWScale * 0.62, shy);
          ctx.moveTo(wx + winWScale * 0.63, shy);
          ctx.lineTo(wx + winWScale * 0.74, shy);
          ctx.stroke();
        }
        // 窓下の花箱（最下段）
        if (r === rows - 1 && c === 0 && kind !== 2) {
          withTransform(ctx, wx, wy + winHScale * 0.65, winWScale * 0.7, winHScale * 0.5, () => {
            ctx.fillStyle = '#5a3817';
            ctx.fill(FLOWER_BOX);
            ctx.fillStyle = '#ef4444';
            ctx.beginPath(); ctx.arc(-0.2, -0.05, 0.12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fde047';
            ctx.beginPath(); ctx.arc(0.0, -0.08, 0.11, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ec4899';
            ctx.beginPath(); ctx.arc(0.2, -0.05, 0.11, 0, Math.PI * 2); ctx.fill();
          });
        }
      }
    }
  }

  // ── ドア ──
  if (!useCathedral) {
    withTransform(ctx, cx, bodyBot - bodyH * 0.12, bodyW * 0.14, bodyH * 0.24, () => {
      ctx.fillStyle = pal[3];
      ctx.fill(DOOR_ARCH);
      ctx.strokeStyle = pal[1]; ctx.lineWidth = 0.1; ctx.stroke(DOOR_ARCH);
      // 木目
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.05;
      for (let k = -0.15; k <= 0.2; k += 0.1) {
        ctx.beginPath();
        ctx.moveTo(k, -0.15); ctx.lineTo(k, 0.4);
        ctx.stroke();
      }
      // ノブ
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(0.15, 0.15, 0.06, 0, Math.PI * 2); ctx.fill();
    });
  } else {
    // 大聖堂の大扉
    withTransform(ctx, cx, bodyBot - bodyH * 0.1, bodyW * 0.22, bodyH * 0.35, () => {
      ctx.fillStyle = '#3f1f04';
      ctx.fill(DOOR_ARCH);
      ctx.strokeStyle = '#78350f'; ctx.lineWidth = 0.08;
      ctx.stroke(DOOR_ARCH);
      // 鉄飾り
      ctx.strokeStyle = '#78350f'; ctx.lineWidth = 0.08;
      ctx.beginPath(); ctx.moveTo(-0.20, 0.10); ctx.lineTo(0.20, 0.10); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 0.12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(0, 0, 0.06, 0, Math.PI * 2); ctx.fill();
    });
  }

  // ── 屋根 ──
  const roofY = bodyTop;
  const roofPath = useTower ? ROOF_CONE : (kind === 1 ? ROOF_MANSARD : ROOF_GABLED);
  const roofH = useTower ? bodyW * 0.7 : bodyW * 0.35;
  const useCathedralSpires = useCathedral;

  withTransform(ctx, cx, roofY, bodyW * 0.5, roofH, () => {
    const rg = ctx.createLinearGradient(0, -1, 0, 0.1);
    rg.addColorStop(0, roof[0]);
    rg.addColorStop(1, roof[1]);
    ctx.fillStyle = rg;
    ctx.fill(roofPath);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.015;
    ctx.stroke(roofPath);
  });
  // 瓦ライン
  if (!useTower) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.6;
    const roofPeak = roofY - roofH * (kind === 1 ? 0.6 : 0.85);
    for (let y = roofPeak; y < roofY; y += 5) {
      const t = (y - roofPeak) / (roofY - roofPeak);
      const half = t * bodyW * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - half, y);
      ctx.lineTo(cx + half, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 大聖堂の左右塔
  if (useCathedralSpires) {
    for (const side of [-1, 1]) {
      const sx = cx + side * bodyW * 0.45;
      // 塔の本体
      ctx.fillStyle = pal[0];
      ctx.fillRect(sx - bodyW * 0.08, roofY - bodyH * 0.3, bodyW * 0.16, bodyH * 0.6);
      ctx.strokeStyle = pal[1]; ctx.lineWidth = 0.6;
      ctx.strokeRect(sx - bodyW * 0.08, roofY - bodyH * 0.3, bodyW * 0.16, bodyH * 0.6);
      // 塔の尖塔
      withTransform(ctx, sx, roofY - bodyH * 0.3, bodyW * 0.10, bodyW * 0.28, () => {
        ctx.fillStyle = roof[0]; ctx.fill(ROOF_CONE);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.02;
        ctx.stroke(ROOF_CONE);
      });
      // 塔の窓
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(sx - bodyW * 0.03, roofY - bodyH * 0.15, bodyW * 0.06, bodyH * 0.1);
      ctx.fillStyle = `rgba(253,224,71,${0.6 + 0.3 * Math.abs(Math.sin(now + seed + side))})`;
      ctx.fillRect(sx - bodyW * 0.025, roofY - bodyH * 0.145, bodyW * 0.05, bodyH * 0.09);
    }
  }

  // ── 煙突 ──
  const hasChimney = !useCathedral && !useTower && kind !== 4;
  if (hasChimney) {
    const chimX = cx + bodyW * 0.22;
    const chimBase = roofY - bodyW * 0.12;
    withTransform(ctx, chimX, chimBase, bodyW * 0.08, bodyW * 0.25, () => {
      ctx.fillStyle = pal[1];
      ctx.fill(CHIMNEY_PATH);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.06;
      ctx.stroke(CHIMNEY_PATH);
    });
    // 煙
    drawChimneySmoke(ctx, chimX, chimBase - bodyW * 0.32, now, seed);
  }

  // ── 風見鶏（高い建物だけ） ──
  if (useTower || useCathedral || kind === 1) {
    const vaneX = cx;
    const vaneY = useTower ? roofY - roofH : roofY - roofH * 0.9;
    const rot = Math.sin(now * 0.5 + seed) * 0.3;
    ctx.save();
    ctx.translate(vaneX, vaneY);
    ctx.rotate(rot);
    ctx.scale(10, 10);
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 0.08;
    ctx.fillStyle = '#1c1917';
    ctx.fill(WEATHERVANE);
    ctx.stroke(WEATHERVANE);
    ctx.restore();
    // 柱
    ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(vaneX, vaneY);
    ctx.lineTo(vaneX, vaneY + 8);
    ctx.stroke();
  }

  // ── ガーゴイル（大聖堂のみ、左右） ──
  if (useCathedral) {
    for (const side of [-1, 1]) {
      withTransform(ctx, cx + side * bodyW * 0.3, roofY + bodyH * 0.05, 12 * side, 12, () => {
        ctx.fillStyle = '#44403c';
        ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 0.05;
        ctx.fill(GARGOYLE);
        ctx.stroke(GARGOYLE);
      });
    }
  }

  // ── 吊り看板（商店タイプ） ──
  if (kind === 5) {
    const signColors = ['#7f1d1d', '#1e40af', '#166534', '#6b21a8'];
    const sc = signColors[seed % signColors.length];
    const icons = ['⚔', '🍺', '🍞', '📜', '💎', '🛡'];
    const icon = icons[seed % icons.length];
    const signX = cx + bodyW * 0.3;
    const signY = bodyTop + bodyH * 0.1;
    withTransform(ctx, signX, signY, 20, 20, () => {
      ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 0.08;
      ctx.fillStyle = sc;
      ctx.fill(SHOP_SIGN);
      ctx.stroke(SHOP_SIGN);
    });
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde68a';
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 4;
    ctx.fillText(icon, signX + 1, signY + 3);
  }

  ctx.restore();
}

/** 武器の展示台（鍛冶屋横） */
function drawWeaponRack(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 14, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
  // 横板
  ctx.fillStyle = '#5a4024';
  ctx.fillRect(cx - 18, cy + 4, 36, 4);
  ctx.fillStyle = '#3f1f04';
  ctx.fillRect(cx - 18, cy - 14, 36, 2);
  // 支柱
  ctx.fillStyle = '#78350f';
  ctx.fillRect(cx - 18, cy - 14, 3, 22);
  ctx.fillRect(cx + 15, cy - 14, 3, 22);
  // 剣
  ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 12); ctx.lineTo(cx - 10, cy + 4);
  ctx.stroke();
  ctx.fillStyle = '#44403c';
  ctx.fillRect(cx - 13, cy + 3, 6, 2);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(cx - 11, cy - 14, 2, 3);
  // 斧
  ctx.fillStyle = '#5a4024';
  ctx.fillRect(cx - 2, cy - 12, 3, 18);
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(cx + 1, cy - 12);
  ctx.lineTo(cx + 8, cy - 14);
  ctx.lineTo(cx + 8, cy - 4);
  ctx.lineTo(cx + 1, cy - 6);
  ctx.closePath();
  ctx.fill();
  // 盾
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.moveTo(cx + 11, cy - 12);
  ctx.lineTo(cx + 17, cy - 12);
  ctx.lineTo(cx + 17, cy - 2);
  ctx.lineTo(cx + 14, cy + 4);
  ctx.lineTo(cx + 11, cy - 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(cx + 14, cy - 4, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** 建物間に渡す吊り旗 */

// ─── アンビエントイベント状態（モジュールスコープ） ──────────────
// 街上空を横切る鳥の群れを一時的に管理する。進捗 0..1 で画面を横断し、
// 終端に達したら次のサイクル（色・高さ・向きをランダム化）に切り替える。
interface FlockRoute {
  startX: number;   // 画面内タイル座標 x
  endX:   number;
  y:      number;   // タイル座標 y
  count:  number;   // 鳥の数
  hue:    number;   // HSL hue
  startedAt: number;
  durationMs: number;
  scatter: number;  // V字隊形の広がり
}
let _flocks: FlockRoute[] = [];
let _lastFlockCheckAt = 0;

/** 街の鐘（1分おきに響く） */
interface BellRing {
  startedAt: number;
  x: number;
  y: number;
}
let _bells: BellRing[] = [];
let _lastBellAt = 0;

// ─── 天候レイヤ（BASE 拠点） ──────────────────
//
// 2 分ごとに次の天候を抽選する。確率は clear 60% / rain 15% / snow 10%
// / fog 10% / petals 5%。state は drawWeather 側が純関数で使うだけなので、
// ここでは「現在どの天候か」を持つだけで良い。
let _currentWeather: WeatherState | null = null;
let _lastWeatherCheckAt = 0;

/** BASE 向けの抽選プール（確率分布を反映するため同じ要素を複数回入れる） */
const BASE_WEATHER_POOL: WeatherType[] = [
  // 60%（×12）
  'clear', 'clear', 'clear', 'clear', 'clear', 'clear',
  'clear', 'clear', 'clear', 'clear', 'clear', 'clear',
  // 15%（×3）
  'rain', 'rain', 'rain',
  // 10%（×2）
  'snow', 'snow',
  // 10%（×2）
  'fog', 'fog',
  // 5%（×1）
  'petals',
];

/** 天候切り替え時の雰囲気ログ（console のみ。logger 本体は循環回避のため不使用） */
function logWeatherChange(type: WeatherType): void {
  // 循環 import を避けるため Logger クラスは直接参照しない。
  // 開発時確認用に console.log だけ出す（本番でも邪魔にならない程度）。
  let msg = '';
  switch (type) {
    case 'rain':   msg = '☔ 雨が降り始めた';   break;
    case 'snow':   msg = '❄ 雪が舞い始めた';   break;
    case 'fog':    msg = '🌫 霧が立ち込めた';   break;
    case 'petals': msg = '🌸 花弁が舞い始めた'; break;
    case 'clear':  msg = '☀ 空が晴れた';        break;
  }
  // eslint-disable-next-line no-console
  console.log(`[weather] ${msg}`);
}

/**
 * BASE 拠点の天候を更新し、描画する。drawCityDecor の末尾から呼ばれる。
 * 2 分おきに「次の天候へ切り替えるか」を判定。現在の天候の durationMs を
 * 過ぎたら次を抽選する。
 */
function updateAndDrawBaseWeather(
  ctx: CanvasRenderingContext2D,
  camOffX: number, camOffY: number, now: number,
): void {
  // 2 分おきに「durationMs を超えたか」をチェック（チェック自体はもう少し細かく）。
  const CHECK_INTERVAL_MS = 15_000;
  if (now - _lastWeatherCheckAt > CHECK_INTERVAL_MS) {
    _lastWeatherCheckAt = now;
    const expired = _currentWeather == null
      ? true
      : (now - _currentWeather.startedAt) >= _currentWeather.durationMs;
    if (expired) {
      const next = nextWeatherState(_currentWeather, now, BASE_WEATHER_POOL);
      // 切り替わりが同じ天候ならログは省略
      if (_currentWeather == null || _currentWeather.type !== next.type) {
        logWeatherChange(next.type);
      }
      _currentWeather = next;
    }
  }
  // 初回のみ：まだ _currentWeather が無ければ無音で clear を設定（ランダム開始）。
  if (_currentWeather == null) {
    _currentWeather = nextWeatherState(null, now, BASE_WEATHER_POOL);
  }

  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  drawWeather(ctx, camOffX, camOffY, now, W, H, _currentWeather);
}

/** アンビエントイベント層（鳥の群れ・鐘の響き・時々舞う花弁など） */
function drawAmbientEvents(
  ctx: CanvasRenderingContext2D,
  camOffX: number, camOffY: number, now: number,
): void {
  const ts = TILE_SIZE;

  // ── 鳥の群れ管理 ──
  // 一定間隔（20〜35秒）で新しい群れを仕込む。同時最大2群。
  if (now - _lastFlockCheckAt > 1000) {
    _lastFlockCheckAt = now;
    // 期限切れを整理
    _flocks = _flocks.filter(f => now - f.startedAt < f.durationMs + 500);
    if (_flocks.length < 2 && Math.random() < 0.06) {
      // ランダムに新しい群れ
      const leftToRight = Math.random() < 0.5;
      const hue = [28, 44, 200, 320, 260][Math.floor(Math.random() * 5)];
      _flocks.push({
        startX:     leftToRight ? -2 : 38,
        endX:       leftToRight ? 38 : -2,
        y:          1 + Math.random() * 5,
        count:      5 + Math.floor(Math.random() * 4),
        hue,
        startedAt:  now,
        durationMs: 7000 + Math.random() * 4000,
        scatter:    0.8 + Math.random() * 0.6,
      });
    }
  }
  // 描画
  for (const f of _flocks) {
    const t = (now - f.startedAt) / f.durationMs;
    if (t < 0 || t > 1.1) continue;
    const leaderX = f.startX + (f.endX - f.startX) * t;
    const leaderY = f.y + Math.sin(t * Math.PI * 2.5) * 0.3;
    const leaderPx = (leaderX + 0.5) * ts + camOffX;
    const leaderPy = (leaderY + 0.5) * ts + camOffY;
    const dir = Math.sign(f.endX - f.startX);

    ctx.save();
    ctx.fillStyle = `hsla(${f.hue}, 55%, 68%, 0.85)`;
    ctx.strokeStyle = `hsla(${f.hue}, 70%, 75%, 0.9)`;
    ctx.lineWidth = 1;
    for (let i = 0; i < f.count; i++) {
      const lag = i * 0.35;
      const row = i % 2 === 0 ? 1 : -1;
      const bx = leaderPx - dir * lag * ts * f.scatter;
      const by = leaderPy + row * Math.ceil(i / 2) * ts * 0.2 * f.scatter;
      // 羽ばたきフェーズ
      const wPhase = (now * 0.012 + i * 0.4) % (Math.PI * 2);
      const wingSpan = ts * 0.22 * (0.7 + 0.3 * Math.sin(wPhase));
      const wingLift = ts * 0.07 * Math.sin(wPhase + 0.8);
      ctx.beginPath();
      // 体
      ctx.arc(bx, by, ts * 0.05, 0, Math.PI * 2);
      ctx.fill();
      // 翼（M字）
      ctx.beginPath();
      ctx.moveTo(bx - wingSpan, by + wingLift);
      ctx.quadraticCurveTo(bx - wingSpan * 0.45, by - ts * 0.07, bx, by - ts * 0.02);
      ctx.quadraticCurveTo(bx + wingSpan * 0.45, by - ts * 0.07, bx + wingSpan, by + wingLift);
      ctx.stroke();
      // 影（地面に薄く落ちる影。群れのすぐ真下にふんわり）
      const sy = (f.y + 1.3) * ts + camOffY;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(bx, sy, ts * 0.07, ts * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ── 大聖堂の鐘：60秒おきに鳴らす（波紋で視覚化） ──
  if (now - _lastBellAt > 60000) {
    _lastBellAt = now;
    _bells.push({ startedAt: now, x: 17.5, y: 0.2 });
  }
  _bells = _bells.filter(b => now - b.startedAt < 3000);
  for (const b of _bells) {
    const t = (now - b.startedAt) / 3000;
    const bx = (b.x + 0.5) * ts + camOffX;
    const by = (b.y + 0.5) * ts + camOffY;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let ring = 0; ring < 3; ring++) {
      const tt = t - ring * 0.2;
      if (tt < 0 || tt > 1) continue;
      const r = ts * (0.5 + tt * 4.5);
      const alpha = (1 - tt) * 0.35;
      const grad = ctx.createRadialGradient(bx, by, r * 0.85, bx, by, r);
      grad.addColorStop(0, 'rgba(255,235,180,0)');
      grad.addColorStop(0.5, `rgba(255,225,160,${alpha})`);
      grad.addColorStop(1, 'rgba(255,210,120,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── 大聖堂から舞い散る光の花弁（常時、控えめ） ──
  {
    const baseX = (17.5 + 0.5) * ts + camOffX;
    const baseY = (1.5) * ts + camOffY;
    for (let i = 0; i < 6; i++) {
      const phase = (now * 0.00025 + i * 0.166) % 1;
      const ang = (i * 1.234 + Math.sin(now * 0.0003 + i) * 0.5);
      const r = ts * 0.6 + phase * ts * 3.4;
      const px = baseX + Math.cos(ang) * r;
      const py = baseY + phase * ts * 2.4 + Math.sin(now * 0.0015 + i) * ts * 0.2;
      const alpha = (1 - phase) * 0.75;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255,215,170,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(px, py, ts * 0.035, ts * 0.06, ang, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/** 街全体の装飾レイヤ（舗装・道路網・街灯・ベンチ・街路樹・市場・裏路地） */
function drawCityDecor(
  ctx: CanvasRenderingContext2D,
  camOffX: number, camOffY: number, now: number,
): void {
  const ts = TILE_SIZE;
  const px = (tx: number): number => tx * ts + camOffX;
  const py = (ty: number): number => ty * ts + camOffY;
  const cx = (tx: number): number => (tx + 0.5) * ts + camOffX;
  const cy = (ty: number): number => (ty + 0.5) * ts + camOffY;

  // ═════ 1. 地区別の舗装基盤（最下層） ═════

  // ダンジョン区（y=2-7）：黒玄武岩＋ルーン
  drawDungeonDistrictFloor(ctx, px(1), py(2), ts * 34, ts * 6, now);

  // 中央広場（モニュメント・噴水の周囲）：円形の磨石
  drawPlazaSubstrate(ctx, cx(17) + ts * 0.5, cy(12) + ts * 0.5, ts * 4.5);

  // 市場（西・商業地区）：煉瓦
  drawBrickArea(ctx, px(2) + ts * 0.1, py(17) + ts * 0.2, ts * 11 - ts * 0.2, ts * 3 - ts * 0.4);
  // 市場（東・工房地区）：煉瓦
  drawBrickArea(ctx, px(22) + ts * 0.1, py(17) + ts * 0.2, ts * 11 - ts * 0.2, ts * 3 - ts * 0.4);

  // 裏路地（y=20-22）：荒れた石
  drawAlleySubstrate(ctx, px(2), py(20) + ts * 0.5, ts * 12, ts * 2.5);
  drawAlleySubstrate(ctx, px(22), py(20) + ts * 0.5, ts * 12, ts * 2.5);

  // ═════ 2. 主要道路網（石畳） ═════

  // 南北メインストリート（スポーン→噴水→ポータル）
  drawCobblestoneStrip(ctx, px(16) + ts * 0.1, py(2), ts * 2 - ts * 0.2, ts * 24);

  // 南北サブスパイン（西側・商業地区を縦断）
  drawCobblestoneStrip(ctx, px(9) + ts * 0.15, py(8), ts - ts * 0.3, ts * 17);
  // 南北サブスパイン（東側）
  drawCobblestoneStrip(ctx, px(26) + ts * 0.15, py(8), ts - ts * 0.3, ts * 17);

  // 東西：ポータル前通り（y=7）
  drawCobblestoneStrip(ctx, px(2), py(7) + ts * 0.35, ts * 32, ts * 0.4);

  // 東西：酒場〜行商人（y=11）
  drawCobblestoneStrip(ctx, px(2), py(10) + ts * 0.2, ts * 32, ts * 0.55);

  // 東西：プラザ（y=14-15）
  drawCobblestoneStrip(ctx, px(2), py(14) + ts * 0.2, ts * 32, ts * 0.65);

  // 東西：プラザ南（y=16-17 の境界直前）
  drawCobblestoneStrip(ctx, px(8), py(16) + ts * 0.25, ts * 18, ts * 0.5);

  // 東西：商業大通り（y=19）
  drawCobblestoneStrip(ctx, px(2), py(19) + ts * 0.1, ts * 32, ts * 0.8);

  // 東西：裏路地の通路（y=21-22）
  drawCobblestoneStrip(ctx, px(10), py(22) + ts * 0.25, ts * 15, ts * 0.5);

  // 東西：スポーン前の通り（y=24-25）
  drawCobblestoneStrip(ctx, px(10), py(24) + ts * 0.25, ts * 15, ts * 0.55);

  // ═════ 3. 地区入口アーチ ═════

  // 転移の間への門（北側）
  drawArchway(ctx, cx(17) + ts * 0.5, cy(7), ts * 1.6, '転移の間', '#c4b5fd');
  // 市場の門（西）
  drawArchway(ctx, cx(7) + ts * 0.2, cy(17), ts * 1.4, '市場', '#fde68a');
  // 工房の門（東）
  drawArchway(ctx, cx(27) - ts * 0.2, cy(17), ts * 1.4, '工房', '#fb923c');
  // 裏路地の門
  drawArchway(ctx, cx(17) + ts * 0.5, cy(21) + ts * 0.2, ts * 1.3, '裏路地', '#94a3b8');

  // ═════ 4. 建物ファサード（壁タイル上にのみ配置） ═════
  //
  // 実際の壁タイル：
  //   y=0 の外周壁（x=0..35）
  //   y=27 の外周壁（x=0..35）
  //   x=0, x=35 の左右外周壁
  //   y=8 の x=2..6, x=29..33（ダンジョン区境界）
  //   y=17 の x=2..7, x=28..33（広場と商業地区の境界）
  //   y=20 の x=10, x=25（裏路地の門柱）

  // ── 北辺の家並み（y=0）：大聖堂と町屋の連なり ──
  // 中央に大聖堂（kind=4）、両脇に町屋
  const northRow: [number, number, number, number][] = [
    [1, 0, 0, 11], [3, 0, 1, 13], [5, 0, 2, 17], [7, 0, 5, 19],
    [10, 0, 0, 23], [12, 0, 5, 29], [14, 0, 1, 31], [16, 0, 3, 37],
    [20, 0, 3, 41], [22, 0, 5, 43], [24, 0, 2, 47], [26, 0, 0, 53],
    [29, 0, 1, 59], [31, 0, 5, 61], [33, 0, 2, 67], [34, 0, 0, 71],
  ];
  for (const [tx, ty, kind, seed] of northRow) {
    drawRichHouse(ctx, cx(tx), cy(ty) + ts * 0.2, ts * 1.15, ts * 1.35, kind, now, seed);
  }
  // 北辺中央は大聖堂（kind=4, 幅広）
  drawRichHouse(ctx, cx(17) + ts * 0.5, cy(0) + ts * 0.0, ts * 3.2, ts * 1.8, 4, now, 7);

  // ── ダンジョン区境界の家並み（y=8, x=2..6 と x=29..33） ──
  const northGateRow: [number, number, number, number][] = [
    [2, 8, 0, 101], [3, 8, 2, 103], [4, 8, 5, 107], [5, 8, 1, 109], [6, 8, 0, 113],
    [29, 8, 1, 127], [30, 8, 5, 131], [31, 8, 2, 137], [32, 8, 0, 139], [33, 8, 3, 149],
  ];
  for (const [tx, ty, kind, seed] of northGateRow) {
    drawRichHouse(ctx, cx(tx), cy(ty), ts * 1.0, ts * 1.2, kind, now, seed);
  }

  // ── 広場境界壁の家並み（y=17, x=2..7 と x=28..33） ──
  const midRow: [number, number, number, number][] = [
    [2, 17, 2, 151], [3, 17, 5, 157], [4, 17, 0, 163], [5, 17, 2, 167],
    [6, 17, 1, 173], [7, 17, 5, 179],
    [28, 17, 0, 181], [29, 17, 5, 191], [30, 17, 2, 193], [31, 17, 1, 197],
    [32, 17, 5, 199], [33, 17, 0, 211],
  ];
  for (const [tx, ty, kind, seed] of midRow) {
    drawRichHouse(ctx, cx(tx), cy(ty), ts * 1.0, ts * 1.2, kind, now, seed);
  }

  // ── 裏路地の門柱（y=20, x=10, 25）：小塔 ──
  drawRichHouse(ctx, cx(10), cy(20), ts * 0.9, ts * 1.0, 3, now, 223);
  drawRichHouse(ctx, cx(25), cy(20), ts * 0.9, ts * 1.0, 3, now, 227);

  // ── 南辺の家並み（y=27）：住宅街 ──
  const southRow: [number, number, number, number][] = [
    [1, 27, 0, 229], [3, 27, 2, 233], [5, 27, 1, 239], [7, 27, 5, 241],
    [9, 27, 0, 251], [11, 27, 5, 257], [13, 27, 1, 263], [15, 27, 2, 269],
    [17, 27, 3, 271], [19, 27, 5, 277], [21, 27, 2, 281], [23, 27, 0, 283],
    [25, 27, 1, 293], [27, 27, 5, 307], [29, 27, 2, 311], [31, 27, 0, 313],
    [33, 27, 1, 317], [34, 27, 5, 331],
  ];
  for (const [tx, ty, kind, seed] of southRow) {
    drawRichHouse(ctx, cx(tx), cy(ty) - ts * 0.15, ts * 1.15, ts * 1.35, kind, now, seed);
  }

  // ── 西辺と東辺（x=0, x=35）の建物：縦並び ──
  for (let ty = 2; ty <= 25; ty += 3) {
    drawRichHouse(ctx, cx(0), cy(ty), ts * 1.0, ts * 1.2, ty % 4, now, ty * 7);
    drawRichHouse(ctx, cx(35), cy(ty), ts * 1.0, ts * 1.2, (ty + 1) % 4, now, ty * 11);
  }

  // ═════ 5. 街灯（大通り沿いの格子配置） ═════

  const lamps: [number, number, number][] = [
    // メイン通り（x=17-18 に沿って左右交互）
    [15.5, 8, 0], [19.5, 8, 1],
    [15.5, 11, 2], [19.5, 11, 3],
    [15.5, 15, 4], [19.5, 15, 5],
    [15.5, 20, 6], [19.5, 20, 7],
    [15.5, 24, 8], [19.5, 24, 9],
    // 商業通り（y=19 に等間隔）
    [3, 19, 10], [8, 19, 11], [13, 19, 12], [23, 19, 13], [28, 19, 14], [33, 19, 15],
    // 酒場・行商人通り（y=11）
    [3, 11, 16], [14, 11, 17], [22, 11, 18], [33, 11, 19],
    // プラザ東西通り（y=15）
    [4, 15, 20], [9, 15, 21], [26, 15, 22], [32, 15, 23],
    // 西・東サブスパイン
    [9.5, 12, 24], [9.5, 22, 25], [26.5, 12, 26], [26.5, 22, 27],
  ];
  for (const [tx, ty, seed] of lamps) {
    drawStreetLamp(ctx, cx(tx) - ts * 0.5, cy(ty), now, seed);
  }

  // ═════ 6. 噴水・井戸 ═════

  // 噴水まわりのベンチ（4脚）
  drawStoneBench(ctx, cx(15), cy(13) + ts * 0.05, true);
  drawStoneBench(ctx, cx(20), cy(13) + ts * 0.05, true);
  drawStoneBench(ctx, cx(16) + ts * 0.2, cy(11) + ts * 0.3, true);
  drawStoneBench(ctx, cx(19) - ts * 0.2, cy(11) + ts * 0.3, true);

  // サブ広場の井戸（西・東に1基ずつ）
  drawWell(ctx, cx(8), cy(13));
  drawWell(ctx, cx(27), cy(13));

  // ═════ 7. 花のプランター（広場・道沿いを彩る） ═════

  const planters: [number, number, string][] = [
    [3, 15, '#f472b6'], [33, 15, '#60a5fa'],
    [6, 16, '#fde047'], [29, 16, '#fde047'],
    [12, 14, '#f87171'], [23, 14, '#a78bfa'],
    [11, 24, '#fbbf24'], [22, 24, '#34d399'],
    [16, 16, '#f0abfc'], [19, 16, '#f0abfc'],
  ];
  for (const [tx, ty, color] of planters) {
    drawFlowerPlanter(ctx, cx(tx), cy(ty) + ts * 0.15, color);
  }

  // ═════ 8. 街路樹（随所に配置） ═════

  const trees: [number, number, number][] = [
    [2, 11, 0], [33, 11, 1],
    [7, 14, 4], [27, 14, 5],
    [11, 23, 6], [24, 23, 7],
    [2, 24, 8], [33, 24, 9],
    [14, 8, 10], [21, 8, 11],
    [2, 15, 12], [33, 15, 13],
    [2, 20, 14], [33, 20, 15],
  ];
  for (const [tx, ty, s] of trees) {
    drawStreetTree(ctx, cx(tx), cy(ty) + ts * 0.15, now, s);
  }

  // ═════ 9. 市場の荷車と武器展示 ═════

  drawMarketCart(ctx, cx(7), cy(19) + ts * 0.15, false);
  drawMarketCart(ctx, cx(12), cy(19) + ts * 0.15, true);
  drawMarketCart(ctx, cx(23), cy(19) + ts * 0.15, false);
  drawMarketCart(ctx, cx(28), cy(19) + ts * 0.15, true);

  // 鍛冶屋の横に武器展示
  drawWeaponRack(ctx, cx(24) + ts * 0.2, cy(19) - ts * 0.2);
  drawWeaponRack(ctx, cx(26) - ts * 0.2, cy(19) - ts * 0.2);

  // ═════ 10. 裏路地の樽・木箱 ═════

  drawAlleyClutter(ctx, cx(7), cy(21) + ts * 0.15, 1);
  drawAlleyClutter(ctx, cx(15), cy(21) + ts * 0.15, 2);
  drawAlleyClutter(ctx, cx(20), cy(21) + ts * 0.15, 3);
  drawAlleyClutter(ctx, cx(28), cy(21) + ts * 0.15, 4);

  // 裏路地の小さな篝火
  drawSmallBrazier(ctx, cx(11), cy(22), now, 0);
  drawSmallBrazier(ctx, cx(24), cy(22), now, 1);

  // ═════ 11. 吊り旗（祭りの飾り） ═════

  drawBuntingLine(ctx, cx(5), cx(10), cy(16) - ts * 0.35, now, '#ef4444');
  drawBuntingLine(ctx, cx(25), cx(30), cy(16) - ts * 0.35, now, '#3b82f6');
  drawBuntingLine(ctx, cx(13), cx(21), cy(13) - ts * 0.35, now, '#a855f7');
  drawBuntingLine(ctx, cx(3), cx(8), cy(9) - ts * 0.35, now, '#fbbf24');
  drawBuntingLine(ctx, cx(27), cx(32), cy(9) - ts * 0.35, now, '#22c55e');
  drawBuntingLine(ctx, cx(13), cx(22), cy(26) - ts * 0.35, now, '#ec4899');

  // ═════ 12. 道標 ═════

  drawSignPost(ctx, cx(17.5), cy(23) - ts * 0.1, ['ダンジョン↑', 'カジノ↓']);
  drawSignPost(ctx, cx(9.5), cy(17) - ts * 0.2, ['市場←', 'ギルド→']);
  drawSignPost(ctx, cx(26.5), cy(17) - ts * 0.2, ['工房→', 'ギルド←']);

  // ═════ 13. ライティング層（加算合成で温かな光を重ねる） ═════
  drawCityLighting(ctx, camOffX, camOffY, now);

  // ═════ 14. アンビエントイベント（鳥の群れ・大聖堂の鐘・花弁） ═════
  drawAmbientEvents(ctx, camOffX, camOffY, now);

  // ═════ 15. 天候レイヤ（雨・雪・霧・花吹雪。2 分おきに抽選） ═════
  updateAndDrawBaseWeather(ctx, camOffX, camOffY, now);

  // ═════ 16. 時間帯オーバーレイ（朝・昼・夕・夜の空気色） ═════
  drawTimeOfDayOverlay(ctx, camOffX, camOffY, now);
}

/**
 * 街全体のライティング。
 * 加算合成で家の窓・街灯・篝火・噴水まわりの光を一括オーバーレイする。
 * drawCityDecor の最後に呼ぶ前提。
 */
function drawCityLighting(
  ctx: CanvasRenderingContext2D,
  camOffX: number, camOffY: number, now: number,
): void {
  const ts = TILE_SIZE;
  const cx = (tx: number): number => (tx + 0.5) * ts + camOffX;
  const cy = (ty: number): number => (ty + 0.5) * ts + camOffY;

  // 低周期のロウソク揺らぎ（全体に掛けるフェーズ）
  const flick = (seed: number, rate = 0.004): number => {
    // 0..1 の滑らかな揺らぎ
    const t = now * rate + seed * 1.7;
    return 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3.1) * Math.cos(t * 2.3));
  };

  // 時間帯に応じた光源スケール：夜ほど強く、昼ほど弱い（0.35〜1.0 の範囲でくすぶらせる）
  const phase = getTimeOfDayPhase(now);
  const nightFactor = getNightFactor(phase);
  const lightScale = 0.35 + 0.65 * nightFactor;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // ── 街灯の広いグレア（既存の drawStreetLamp の halo にさらに外殻を重ねる） ──
  const lampCenters: [number, number, number][] = [
    [15.5, 8, 0], [19.5, 8, 1],
    [15.5, 11, 2], [19.5, 11, 3],
    [15.5, 15, 4], [19.5, 15, 5],
    [15.5, 20, 6], [19.5, 20, 7],
    [15.5, 24, 8], [19.5, 24, 9],
    [3, 19, 10], [8, 19, 11], [13, 19, 12], [23, 19, 13], [28, 19, 14], [33, 19, 15],
    [3, 11, 16], [14, 11, 17], [22, 11, 18], [33, 11, 19],
    [4, 15, 20], [9, 15, 21], [26, 15, 22], [32, 15, 23],
    [9.5, 12, 24], [9.5, 22, 25], [26.5, 12, 26], [26.5, 22, 27],
  ];
  for (const [tx, ty, seed] of lampCenters) {
    const lx = cx(tx) - ts * 0.5;
    // 光源はランプの頭あたり
    const ly = cy(ty) - ts * 0.45;
    const intensity = flick(seed, 0.006) * lightScale;
    const r = ts * 2.8 * intensity;
    const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
    grad.addColorStop(0,    `rgba(255,225,140,${0.52 * intensity})`);
    grad.addColorStop(0.35, `rgba(255,190,100,${0.22 * intensity})`);
    grad.addColorStop(0.75, `rgba(255,160,60,${(0.04 * intensity).toFixed(3)})`);
    grad.addColorStop(1,    'rgba(255,140,40,0.00)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lx, ly, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 家の窓からこぼれる光（家の位置に温かい矩形と外側ハロー） ──
  // 実際の壁タイル座標に沿って配置
  const windowRows: Array<{ tx: number; ty: number; w: number; h: number; seed: number }> = [
    // 北辺（y=0 の家並み・中央の大聖堂）
    ...[1,3,5,7,10,12,14,16,20,22,24,26,29,31,33,34].map((tx, i) => ({
      tx, ty: 0, w: 1.15, h: 1.35, seed: 11 + i * 13,
    })),
    // 大聖堂（北中央）
    { tx: 17.5, ty: 0,  w: 3.2,  h: 1.8,  seed: 7 },
    // ダンジョン区境界（y=8）
    ...[2,3,4,5,6,29,30,31,32,33].map((tx, i) => ({
      tx, ty: 8, w: 1.0, h: 1.2, seed: 101 + i * 11,
    })),
    // 広場境界壁（y=17）
    ...[2,3,4,5,6,7,28,29,30,31,32,33].map((tx, i) => ({
      tx, ty: 17, w: 1.0, h: 1.2, seed: 151 + i * 17,
    })),
    // 裏路地の門柱
    { tx: 10, ty: 20, w: 0.9, h: 1.0, seed: 223 },
    { tx: 25, ty: 20, w: 0.9, h: 1.0, seed: 227 },
    // 南辺の住宅街（y=27）
    ...[1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,34].map((tx, i) => ({
      tx, ty: 27, w: 1.15, h: 1.35, seed: 229 + i * 11,
    })),
    // 東西の外周（x=0, x=35）
    ...Array.from({ length: 8 }, (_, i) => {
      const ty = 2 + i * 3;
      return [
        { tx: 0,  ty, w: 1.0, h: 1.2, seed: ty * 7 },
        { tx: 35, ty, w: 1.0, h: 1.2, seed: ty * 11 },
      ];
    }).flat(),
  ];
  for (const { tx, ty, w, h, seed } of windowRows) {
    const hx = cx(tx);
    const hy = cy(ty) + ts * 0.1;
    const intensity = flick(seed * 0.7, 0.0035);
    // ── 窓から漏れる温かい矩形ブロック（本体） ──
    // 小さな2〜3個の窓として表現
    const winCount = (seed % 3) + 2;
    const winW = ts * w * 0.16;
    const winH = ts * h * 0.22;
    for (let i = 0; i < winCount; i++) {
      const ox = (i - (winCount - 1) / 2) * ts * w * 0.32;
      const oy = -ts * h * 0.15;
      const wx = hx + ox;
      const wy = hy + oy;
      // フリッカーに加えて窓ごとの位相差、さらに時間帯スケール
      const wIntensity = intensity * (0.8 + 0.2 * Math.sin(now * 0.008 + seed + i)) * lightScale;
      // 窓矩形
      ctx.fillStyle = `rgba(255,210,130,${0.55 * wIntensity})`;
      ctx.fillRect(wx - winW * 0.5, wy - winH * 0.5, winW, winH);
      // 周囲ハロー
      const hr = ts * 0.75;
      const hg = ctx.createRadialGradient(wx, wy, 0, wx, wy, hr);
      hg.addColorStop(0,   `rgba(255,200,120,${0.22 * wIntensity})`);
      hg.addColorStop(0.5, `rgba(255,170,80,${0.08 * wIntensity})`);
      hg.addColorStop(1,   'rgba(255,140,40,0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(wx, wy, hr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── 噴水まわりのクール青グロー ──
  {
    const fx = cx(17) + ts * 0.5;
    const fy = cy(12) + ts * 0.5;
    const r = ts * 3.0;
    const pulse = 0.85 + 0.15 * Math.sin(now * 0.002);
    const grad = ctx.createRadialGradient(fx, fy, ts * 0.4, fx, fy, r);
    grad.addColorStop(0,   `rgba(140,200,255,${0.32 * pulse})`);
    grad.addColorStop(0.5, `rgba(100,170,240,${0.12 * pulse})`);
    grad.addColorStop(1,   'rgba(80,140,220,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 裏路地の小篝火の赤橙グロー ──
  const braziers: [number, number, number][] = [
    [11, 22, 0], [24, 22, 1],
  ];
  for (const [tx, ty, seed] of braziers) {
    const bx = cx(tx);
    const by = cy(ty);
    const intensity = flick(seed * 3 + 5, 0.012) * lightScale;
    const r = ts * 1.8 * intensity;
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    grad.addColorStop(0,    `rgba(255,180,80,${0.55 * intensity})`);
    grad.addColorStop(0.35, `rgba(255,120,40,${0.30 * intensity})`);
    grad.addColorStop(0.7,  `rgba(220,70,20,${0.08 * intensity})`);
    grad.addColorStop(1,    'rgba(180,40,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── モニュメント（オベリスク周辺）の紫グロー ──
  {
    const mx = cx(17) + ts * 0.5;
    const my = cy(10);
    const pulse = 0.7 + 0.3 * Math.sin(now * 0.0015);
    const r = ts * 2.2;
    const grad = ctx.createRadialGradient(mx, my, 0, mx, my, r);
    grad.addColorStop(0,    `rgba(196,181,253,${0.35 * pulse})`);
    grad.addColorStop(0.5,  `rgba(168,85,247,${0.12 * pulse})`);
    grad.addColorStop(1,    'rgba(126,34,206,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 大聖堂（北中央）薔薇窓からの神秘的な光 ──
  {
    const mx = cx(17) + ts * 0.5;
    const my = cy(0) + ts * 0.1;
    const pulse = 0.8 + 0.2 * Math.sin(now * 0.0018);
    const r = ts * 2.6;
    const grad = ctx.createRadialGradient(mx, my, 0, mx, my, r);
    grad.addColorStop(0,   `rgba(255,230,200,${0.38 * pulse})`);
    grad.addColorStop(0.5, `rgba(253,186,116,${0.14 * pulse})`);
    grad.addColorStop(1,   'rgba(217,119,6,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawBaseObjects(
  ctx: CanvasRenderingContext2D,
  camOffX: number,
  camOffY: number,
  now: number,
  c: BaseObjectsContext,
): void {
  const ts = TILE_SIZE;

  const _label = (text: string, x: number, y: number, color = '#fbbf24', size = 9) => {
    ctx.font = `bold ${size}px monospace`;
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  };
  const _prompt = (text: string, x: number, y: number) => _label(text, x, y, '#ffffff', 11);

  // ── アンビエント：街全体に舞う光の粒 ──
  drawGrandAmbientMotes(ctx, camOffX, camOffY, now);

  // ── 街の装飾レイヤ（石畳・街灯・ベンチ・街路樹・市場・裏路地） ──
  drawCityDecor(ctx, camOffX, camOffY, now);

  // ── 装飾：中央モニュメント（オベリスク＋浮遊クリスタル） ──
  {
    const cx = (BASE_MONUMENT_POS.tx + 0.5) * ts + camOffX;
    const cy = (BASE_MONUMENT_POS.ty + 0.5) * ts + camOffY;
    drawGrandMonument(ctx, cx, cy, ts, now);
  }

  // ── 装飾：中央噴水（2×2 ブロックの中心は BASE_FOUNTAIN_POS の右下角） ──
  {
    const cx = (BASE_FOUNTAIN_POS.tx + 1) * ts + camOffX;
    const cy = (BASE_FOUNTAIN_POS.ty + 1) * ts + camOffY;
    drawFountain(ctx, cx, cy, ts, now);
  }

  // ── 装飾：ポータルの間の四隅にたいまつ ──
  {
    const torches: [number, number, number][] = [
      [1, 2, 0],  [26, 2, 1],
      [1, 6, 2],  [26, 6, 3],
    ];
    for (const [tx, ty, phase] of torches) {
      const tcx = tx * ts + ts / 2 + camOffX;
      const tcy = ty * ts + ts / 2 + camOffY;
      drawTorch(ctx, tcx, tcy, now, phase);
    }
  }

  // ── 装飾：地区看板 ──
  {
    // ポータルの間（中央アーチ上）
    drawDistrictBanner(
      ctx,
      13 * ts + ts + camOffX, 7 * ts + ts * 0.2 + camOffY,
      '転移の間', '#c4b5fd',
    );
    // 商業地区（西）— 建物の上方
    drawDistrictBanner(
      ctx,
      6 * ts + ts / 2 + camOffX, 9 * ts + ts * 0.7 + camOffY,
      '市場', '#fde68a',
    );
    // 工房地区（東）— 建物の上方
    drawDistrictBanner(
      ctx,
      21 * ts + ts / 2 + camOffX, 9 * ts + ts * 0.7 + camOffY,
      '工房', '#fdba74',
    );
    // 裏路地 — 背の低い看板、建物の間にぶら下げる
    drawDistrictBanner(
      ctx,
      13 * ts + ts + camOffX, 13 * ts + ts * 0.4 + camOffY,
      '裏路地', '#94a3b8',
    );
  }

  // 宝箱
  {
    const cx = BASE_CHEST_POS.tx * ts + ts / 2 + camOffX;
    const cy = BASE_CHEST_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_CHEST_POS.tx && c.player.ty === BASE_CHEST_POS.ty;
    objChest(ctx, cx, cy, ts, c.baseChestCount, on);
    _label(`宝箱 (${c.baseChestCount}件)`, cx, cy - ts / 2 - 8);
    if (on) _prompt('[E] 宝箱を開ける', cx, cy + ts / 2 + 14);
  }

  // ショップ（3×2 タイル建物）
  {
    const sx = BASE_SHOP_POS.tx * ts + ts / 2 + camOffX;
    const sy = BASE_SHOP_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_SHOP_POS.tx && c.player.ty === BASE_SHOP_POS.ty;
    drawShopBuilding(ctx, sx, sy, ts, now, on, c.baseShopCount);
    _label(`ショップ (${c.baseShopCount}点)`, sx, sy - ts * 1.55);
    if (on) _prompt('[E] ショップを開く', sx, sy + ts / 2 + 14);
  }

  // カジノ（3×2 タイル建物）
  {
    const cx = BASE_CASINO_POS.tx * ts + ts / 2 + camOffX;
    const cy = BASE_CASINO_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_CASINO_POS.tx && c.player.ty === BASE_CASINO_POS.ty;
    drawCasinoBuilding(ctx, cx, cy, ts, now, on);
    _label('カジノ', cx, cy - ts * 1.55, '#f59e0b');
    if (on) _prompt('[E] カジノへ入る', cx, cy + ts / 2 + 14);
  }

  // 委託露店（3×2 タイル建物）
  {
    const stx = BASE_STALL_POS.tx * ts + ts / 2 + camOffX;
    const sty = BASE_STALL_POS.ty * ts + ts / 2 + camOffY;
    const on  = c.player.tx === BASE_STALL_POS.tx && c.player.ty === BASE_STALL_POS.ty;
    drawStallBuilding(ctx, stx, sty, ts, now, on, c.stallCount);
    _label(`委託露店 (${c.stallCount}件)`, stx, sty - ts * 1.55, '#fde68a');
    if (on) _prompt('[E] 露店を開く', stx, sty + ts / 2 + 14);
  }

  // 金貸し（3×2 タイル建物）
  {
    const lx = BASE_LOAN_POS.tx * ts + ts / 2 + camOffX;
    const ly = BASE_LOAN_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_LOAN_POS.tx && c.player.ty === BASE_LOAN_POS.ty;
    const spr = c.sprites.get('debt_collector') ?? null;
    drawLoanBuilding(ctx, lx, ly, ts, now, on, c.loanDebt, spr);
    const debtLabel = c.loanDebt > 0 ? `借金: ${c.loanDebt}G` : '金貸し';
    _label(debtLabel, lx, ly - ts * 1.55, c.loanDebt > 0 ? '#f87171' : '#fbbf24');
    if (on) _prompt('[E] 借りる  [R] 返済', lx, ly + ts / 2 + 14);
  }

  // 転職の祭壇（3×2 タイル建物）
  {
    const rx = BASE_RECLASS_POS.tx * ts + ts / 2 + camOffX;
    const ry = BASE_RECLASS_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_RECLASS_POS.tx && c.player.ty === BASE_RECLASS_POS.ty;
    drawReclassShrine(ctx, rx, ry, ts, now, on);
    _label('転職の祭壇', rx, ry - ts * 1.55, '#e9d5ff');
    if (on) _prompt('[E] 転職する', rx, ry + ts / 2 + 14);
  }

  // 鍛冶屋（3×2 タイル建物）
  {
    const fx = BASE_CRAFT_POS.tx * ts + ts / 2 + camOffX;
    const fy = BASE_CRAFT_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_CRAFT_POS.tx && c.player.ty === BASE_CRAFT_POS.ty;
    drawForgeBuilding(ctx, fx, fy, ts, now, on);
    _label('鍛冶屋', fx, fy - ts * 1.55, '#fb923c');
    if (on) _prompt('[E] 武器を合成する', fx, fy + ts / 2 + 14);
  }

  // 魂の祠（1×1 タイル）
  {
    const sx = BASE_SHRINE_POS.tx * ts + ts / 2 + camOffX;
    const sy = BASE_SHRINE_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_SHRINE_POS.tx && c.player.ty === BASE_SHRINE_POS.ty;
    drawSoulShrine(ctx, sx, sy, ts, now, on);
    _label('魂の祠', sx, sy - ts * 0.85, '#c084fc');
    if (on) _prompt('[E] 魂を捧げる', sx, sy + ts * 0.55);
  }

  // クエスト掲示板（1×1 タイル）
  if (typeof c.questActive === 'number') {
    const qx = BASE_QUEST_POS.tx * ts + ts / 2 + camOffX;
    const qy = BASE_QUEST_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_QUEST_POS.tx && c.player.ty === BASE_QUEST_POS.ty;
    const claimable = c.questClaimable ?? 0;
    drawQuestSignboard(ctx, qx, qy, ts, now, on, claimable);
    _label(`掲示板 (${c.questActive}件)`, qx, qy - ts * 0.85, '#fbbf24');
    if (on) _prompt('[E] 依頼を確認', qx, qy + ts * 0.55);
  }

  // 冒険者ギルド受付（1×1 タイル）
  {
    const rx = BASE_RECEPTION_POS.tx * ts + ts / 2 + camOffX;
    const ry = BASE_RECEPTION_POS.ty * ts + ts / 2 + camOffY;
    const on = c.player.tx === BASE_RECEPTION_POS.tx && c.player.ty === BASE_RECEPTION_POS.ty;
    drawReception(ctx, rx, ry, ts, now, on);
    _label('ギルド受付', rx, ry - ts * 0.85, '#fde68a');
    if (on) _prompt('[E] ランキングを見る', rx, ry + ts * 0.55);
  }

  // 酒場（壮大版・2階建て＋煙突＋看板）
  {
    const tx = (BASE_TAVERN_POS.tx + 0.5) * ts + camOffX;
    const ty = (BASE_TAVERN_POS.ty + 0.5) * ts + camOffY;
    const on = c.player.tx === BASE_TAVERN_POS.tx && c.player.ty === BASE_TAVERN_POS.ty;
    drawGrandTavern(ctx, tx, ty, ts, now, on);
  }

  // 流浪の行商人（壮大版・キャラバン＋焚き火）
  {
    const tx = (BASE_TRADER_POS.tx + 0.5) * ts + camOffX;
    const ty = (BASE_TRADER_POS.ty + 0.5) * ts + camOffY;
    const on = c.player.tx === BASE_TRADER_POS.tx && c.player.ty === BASE_TRADER_POS.ty;
    drawGrandTrader(ctx, tx, ty, ts, now, on);
  }

  // ダンジョンポータル（壮大版・3タイル高の大聖堂門）
  BASE_PORTALS.forEach((portal, i) => {
    const dungeon = DUNGEONS.find(d => d.id === portal.dungeonId);
    if (!dungeon) return;
    const px = (portal.tx + 0.5) * ts + camOffX;
    const py = (portal.ty + 0.5) * ts + camOffY;
    const unlocked = isDungeonUnlocked(portal.dungeonId, c.clearedDungeons);
    const on = c.player.tx === portal.tx && c.player.ty === portal.ty;
    drawGrandDungeonPortal(ctx, px, py, ts, now, dungeon, unlocked, on, i * 1.7);
  });

  // ── 時刻バッジ（BASE 専用・右上のフロアパネル直下） ──
  drawTimeOfDayBadge(ctx, now);
}
