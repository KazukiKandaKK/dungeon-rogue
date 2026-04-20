// ─────────────────────────────────────────────
// appearances.ts  主人公の種族（雪だるま系のキャラ）定義
//
// プレイヤーのスプライトをこの procedural 描画に差し替える。
// 装備オーバーレイ（_drawEquipmentSkin）はそのまま上に重なる。
//
// 人間は出さず、雪だるまっぽい丸くて愛嬌のある生き物のみ。
// ─────────────────────────────────────────────

export type FacingKind = 'front' | 'back' | 'side';

export interface AppearanceDef {
  id:   string;
  /** カード表示名 */
  name: string;
  /** カード下の説明（全角12文字前後×2行） */
  desc: string;
  /** キャラの固有色（tint と混ぜられる） */
  base: string;
  /**
   * procedural 描画。cx/cy を足元やや上の中心として、サイズ s のボックスに収める。
   * facing: 正面・背面・横向き。
   * tint:  プレイヤーが選んだ体色。
   * phase: アイドルアニメ用位相（0〜1 で繰り返す）。
   * dirX:  横向き時の向き（+1 が右）。内部で必要に応じて反転する。
   */
  draw(
    ctx:    CanvasRenderingContext2D,
    cx:     number,
    cy:     number,
    s:      number,
    facing: FacingKind,
    tint:   string,
    phase:  number,
    dirX?:  number,
  ): void;
}

// ── 色パレット（ティント候補） ────────────────────

export interface TintDef {
  id:    string;
  name:  string;
  color: string;
}

export const TINTS: TintDef[] = [
  { id: 'snow',    name: 'ふゆのしろ', color: '#f1f5f9' },
  { id: 'sky',     name: 'そらのあお', color: '#7dd3fc' },
  { id: 'mint',    name: 'もりのみどり', color: '#86efac' },
  { id: 'sakura',  name: 'さくらいろ', color: '#f9a8d4' },
  { id: 'mango',   name: 'きつねいろ', color: '#fbbf24' },
  { id: 'grape',   name: 'ぶどういろ', color: '#c084fc' },
];

// ── 色ユーティリティ ────────────────────────────

function lighten(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const r = Math.min(255, parseInt(h.slice(0, 2), 16) + amt * 255);
  const g = Math.min(255, parseInt(h.slice(2, 4), 16) + amt * 255);
  const b = Math.min(255, parseInt(h.slice(4, 6), 16) + amt * 255);
  return `rgb(${r|0},${g|0},${b|0})`;
}
function darken(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const r = Math.max(0, parseInt(h.slice(0, 2), 16) - amt * 255);
  const g = Math.max(0, parseInt(h.slice(2, 4), 16) - amt * 255);
  const b = Math.max(0, parseInt(h.slice(4, 6), 16) - amt * 255);
  return `rgb(${r|0},${g|0},${b|0})`;
}

// ── 共通パーツ ──────────────────────────────────

function drawShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.36, s * 0.22, s * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 共通の目を描く（正面・横向き用） */
function drawEyes(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, s: number,
  facing: FacingKind, dirX: number,
  opts: { spread?: number; dotR?: number; y?: number; sparkle?: boolean } = {},
): void {
  if (facing === 'back') return;
  const spread = opts.spread ?? 0.07;
  const dotR   = opts.dotR   ?? 2.2;
  const ey     = cy + (opts.y ?? 0);
  ctx.save();
  ctx.fillStyle = '#0b0b0f';
  if (facing === 'side') {
    const sign = dirX >= 0 ? 1 : -1;
    ctx.beginPath();
    ctx.arc(cx + sign * s * 0.04, ey, dotR, 0, Math.PI * 2);
    ctx.fill();
    if (opts.sparkle) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx + sign * s * 0.045, ey - 1, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.arc(cx - s * spread, ey, dotR, 0, Math.PI * 2);
    ctx.arc(cx + s * spread, ey, dotR, 0, Math.PI * 2);
    ctx.fill();
    if (opts.sparkle) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx - s * spread + 0.7, ey - 0.9, 0.8, 0, Math.PI * 2);
      ctx.arc(cx + s * spread + 0.7, ey - 0.9, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ── 各種族の描画 ─────────────────────────────────

// 1) 雪だるま：3段の球、スカーフ、枝の腕
function drawSnowman(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, s: number,
  facing: FacingKind, tint: string, phase: number, dirX = 1,
): void {
  drawShadow(ctx, cx, cy, s);
  const bob = Math.sin(phase * Math.PI * 2) * s * 0.012;
  const body = tint;
  const shade = darken(body, 0.18);

  ctx.save();
  // 下段
  ctx.fillStyle = body;
  ctx.strokeStyle = shade; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy + s * 0.22 + bob, s * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 中段
  ctx.beginPath(); ctx.arc(cx, cy + s * 0.02 + bob, s * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 頭
  ctx.beginPath(); ctx.arc(cx, cy - s * 0.18 + bob, s * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // スカーフ
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(cx - s * 0.13, cy - s * 0.08 + bob, s * 0.26, s * 0.04);
  ctx.fillRect(cx - s * 0.03, cy - s * 0.08 + bob, s * 0.06, s * 0.1);

  // 枝の腕
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.16, cy + s * 0.02 + bob);
  ctx.lineTo(cx - s * 0.27, cy - s * 0.03 + bob);
  ctx.moveTo(cx - s * 0.24, cy - s * 0.03 + bob);
  ctx.lineTo(cx - s * 0.28, cy - s * 0.08 + bob);
  ctx.moveTo(cx + s * 0.16, cy + s * 0.02 + bob);
  ctx.lineTo(cx + s * 0.27, cy - s * 0.03 + bob);
  ctx.moveTo(cx + s * 0.24, cy - s * 0.03 + bob);
  ctx.lineTo(cx + s * 0.28, cy - s * 0.08 + bob);
  ctx.stroke();

  // 顔（ニンジン鼻＋目）
  if (facing !== 'back') {
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    const nx = facing === 'side' ? cx + (dirX >= 0 ? s * 0.1 : -s * 0.1) : cx;
    ctx.moveTo(nx, cy - s * 0.17 + bob);
    ctx.lineTo(nx + (facing === 'side' ? (dirX >= 0 ? s * 0.07 : -s * 0.07) : 0), cy - s * 0.18 + bob);
    ctx.lineTo(nx, cy - s * 0.13 + bob);
    ctx.closePath();
    ctx.fill();
  }
  drawEyes(ctx, cx, cy - s * 0.2 + bob, s, facing, dirX, { spread: 0.05, dotR: 2 });

  // ボタン
  if (facing === 'front') {
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.04 + bob, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.1 + bob, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// 2) まるスライム：ぷるぷる揺れる水滴
function drawSlimeling(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, s: number,
  facing: FacingKind, tint: string, phase: number, dirX = 1,
): void {
  drawShadow(ctx, cx, cy, s);
  const body = tint;
  const bodyL = lighten(body, 0.25);
  const wob = Math.sin(phase * Math.PI * 2) * s * 0.015;

  ctx.save();
  // 本体（ドーム）
  const rx = s * 0.22, ry = s * 0.18 + wob;
  const cyB = cy + s * 0.1;
  const grad = ctx.createRadialGradient(cx - s * 0.06, cyB - s * 0.06, 1, cx, cyB, rx);
  grad.addColorStop(0, bodyL);
  grad.addColorStop(1, body);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cyB, rx, ry, 0, Math.PI, 0);
  ctx.lineTo(cx + rx, cyB + s * 0.06);
  ctx.lineTo(cx - rx, cyB + s * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = darken(body, 0.25); ctx.lineWidth = 1;
  ctx.stroke();

  // 下の影反射
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.05, cyB - s * 0.05, s * 0.07, s * 0.035, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // 目
  drawEyes(ctx, cx, cyB - s * 0.02, s, facing, dirX, { spread: 0.06, dotR: 2.4, sparkle: true });

  // 口（正面のみ）
  if (facing === 'front') {
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cyB + s * 0.06, s * 0.035, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

// 3) きのこ人：ぽってり傘付き
function drawMushroom(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, s: number,
  facing: FacingKind, tint: string, phase: number, dirX = 1,
): void {
  drawShadow(ctx, cx, cy, s);
  const cap = tint;
  const bob = Math.sin(phase * Math.PI * 2) * s * 0.01;

  ctx.save();
  // 胴体（白いきのこ柄）
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.2 + bob, s * 0.12, s * 0.15, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // 傘
  ctx.fillStyle = cap;
  ctx.strokeStyle = darken(cap, 0.2); ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.22, cy + bob);
  ctx.quadraticCurveTo(cx, cy - s * 0.26 + bob, cx + s * 0.22, cy + bob);
  ctx.quadraticCurveTo(cx, cy + s * 0.04 + bob, cx - s * 0.22, cy + bob);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // 斑点
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const spots = [[-0.12, -0.08], [0.08, -0.14], [0.13, -0.02], [-0.05, -0.18]];
  for (const [sxOff, syOff] of spots) {
    ctx.beginPath();
    ctx.arc(cx + s * sxOff, cy + s * syOff + bob, s * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }

  // 顔
  drawEyes(ctx, cx, cy + s * 0.16 + bob, s, facing, dirX, { spread: 0.05, dotR: 1.8 });
  if (facing === 'front') {
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.arc(cx - s * 0.05, cy + s * 0.22 + bob, 1.4, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.05, cy + s * 0.22 + bob, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 4) いわ人：ごつごつした岩
function drawRockling(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, s: number,
  facing: FacingKind, tint: string, phase: number, dirX = 1,
): void {
  drawShadow(ctx, cx, cy, s);
  const body = darken(tint, 0.05);
  const bob = Math.sin(phase * Math.PI * 2) * s * 0.006;

  ctx.save();
  ctx.fillStyle = body;
  ctx.strokeStyle = darken(body, 0.3); ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.2, cy + s * 0.26 + bob);
  ctx.lineTo(cx - s * 0.22, cy + s * 0.06 + bob);
  ctx.lineTo(cx - s * 0.14, cy - s * 0.14 + bob);
  ctx.lineTo(cx - s * 0.02, cy - s * 0.22 + bob);
  ctx.lineTo(cx + s * 0.14, cy - s * 0.18 + bob);
  ctx.lineTo(cx + s * 0.22, cy - s * 0.02 + bob);
  ctx.lineTo(cx + s * 0.22, cy + s * 0.2 + bob);
  ctx.lineTo(cx + s * 0.08, cy + s * 0.28 + bob);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // ひび
  ctx.strokeStyle = darken(body, 0.4); ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.1, cy - s * 0.15 + bob);
  ctx.lineTo(cx - s * 0.02, cy + s * 0.04 + bob);
  ctx.lineTo(cx - s * 0.1, cy + s * 0.15 + bob);
  ctx.moveTo(cx + s * 0.08, cy - s * 0.02 + bob);
  ctx.lineTo(cx + s * 0.14, cy + s * 0.12 + bob);
  ctx.stroke();

  // 苔のハイライト
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.1, cy - s * 0.14 + bob, s * 0.06, s * 0.022, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // 目
  drawEyes(ctx, cx, cy - s * 0.02 + bob, s, facing, dirX, { spread: 0.07, dotR: 2.2 });
  ctx.restore();
}

// 5) おばけ：半透明のふわふわ
function drawGhostling(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, s: number,
  facing: FacingKind, tint: string, phase: number, dirX = 1,
): void {
  drawShadow(ctx, cx, cy, s);
  const body = tint;
  const float = Math.sin(phase * Math.PI * 2) * s * 0.025;

  ctx.save();
  ctx.globalAlpha = 0.86;
  ctx.shadowColor = body; ctx.shadowBlur = 12;
  ctx.fillStyle = body;
  ctx.strokeStyle = darken(body, 0.2); ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.05 + float, s * 0.2, Math.PI, 0);
  // 波打つ裾
  const baseY = cy + s * 0.22 + float;
  const pts = 5;
  for (let i = 0; i <= pts; i++) {
    const t = i / pts;
    const wx = cx + s * 0.2 - s * 0.4 * t;
    const wy = baseY + (i % 2 === 0 ? -s * 0.03 : s * 0.02) * Math.sin(phase * Math.PI * 2 + i);
    ctx.lineTo(wx, wy);
  }
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // ぽっかり目
  if (facing !== 'back') {
    ctx.fillStyle = '#0b0b0f';
    if (facing === 'side') {
      const sign = dirX >= 0 ? 1 : -1;
      ctx.beginPath();
      ctx.ellipse(cx + sign * s * 0.04, cy - s * 0.08 + float, 2.2, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(cx - s * 0.06, cy - s * 0.08 + float, 2.2, 3.2, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + s * 0.06, cy - s * 0.08 + float, 2.2, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 口
  if (facing === 'front') {
    ctx.fillStyle = '#0b0b0f';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.02 + float, 2.4, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 6) ちびロボ：四角い頭とアンテナ
function drawBotling(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, s: number,
  facing: FacingKind, tint: string, phase: number, dirX = 1,
): void {
  drawShadow(ctx, cx, cy, s);
  const body = tint;
  const metal = lighten(body, 0.15);
  const blink = (Math.sin(phase * Math.PI * 2) + 1) * 0.5;

  ctx.save();
  // 足
  ctx.fillStyle = darken(body, 0.3);
  ctx.fillRect(cx - s * 0.1, cy + s * 0.22, s * 0.06, s * 0.1);
  ctx.fillRect(cx + s * 0.04, cy + s * 0.22, s * 0.06, s * 0.1);
  // 胴体（トレープ形）
  ctx.fillStyle = metal;
  ctx.strokeStyle = darken(body, 0.35); ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.16, cy - s * 0.05);
  ctx.lineTo(cx + s * 0.16, cy - s * 0.05);
  ctx.lineTo(cx + s * 0.18, cy + s * 0.22);
  ctx.lineTo(cx - s * 0.18, cy + s * 0.22);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // 胸のパネル
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(cx - s * 0.08, cy + s * 0.02, s * 0.16, s * 0.08);
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(cx - s * 0.06, cy + s * 0.04, s * 0.04 * blink, s * 0.02);

  // 頭（四角）
  ctx.fillStyle = body;
  ctx.strokeStyle = darken(body, 0.35); ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(cx - s * 0.14, cy - s * 0.22, s * 0.28, s * 0.18, 4);
  ctx.fill(); ctx.stroke();

  // アンテナ
  ctx.strokeStyle = darken(body, 0.4); ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.22);
  ctx.lineTo(cx, cy - s * 0.32);
  ctx.stroke();
  ctx.fillStyle = '#f87171';
  ctx.shadowColor = '#f87171'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(cx, cy - s * 0.33, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // LED の目
  if (facing !== 'back') {
    ctx.fillStyle = '#22d3ee';
    ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 8;
    if (facing === 'side') {
      const sign = dirX >= 0 ? 1 : -1;
      ctx.fillRect(cx + sign * s * 0.03, cy - s * 0.16, s * 0.05, s * 0.035);
    } else {
      ctx.fillRect(cx - s * 0.09, cy - s * 0.16, s * 0.05, s * 0.035);
      ctx.fillRect(cx + s * 0.04, cy - s * 0.16, s * 0.05, s * 0.035);
    }
    ctx.shadowBlur = 0;
  }
  // 口スリット
  if (facing === 'front') {
    ctx.fillStyle = darken(body, 0.5);
    ctx.fillRect(cx - s * 0.04, cy - s * 0.08, s * 0.08, s * 0.015);
  }
  ctx.restore();
}

// ── レジストリ ──────────────────────────────────

export const APPEARANCES: Record<string, AppearanceDef> = {
  snowman: {
    id: 'snowman', name: 'ゆきだるま', desc: '3段雪玉の\nほっこり担当',
    base: '#f1f5f9', draw: drawSnowman,
  },
  slimeling: {
    id: 'slimeling', name: 'すらりん',   desc: 'ぷるぷる\n水っぽい民',
    base: '#7dd3fc', draw: drawSlimeling,
  },
  mushroom: {
    id: 'mushroom', name: 'きのこん',   desc: '傘をかぶった\nほだ木の民',
    base: '#f87171', draw: drawMushroom,
  },
  rockling: {
    id: 'rockling', name: 'いわっこ',   desc: 'ごつごつ\n岩石の民',
    base: '#a8a29e', draw: drawRockling,
  },
  ghostling: {
    id: 'ghostling', name: 'おばっち',  desc: 'ふわふわ\n半透明の民',
    base: '#c084fc', draw: drawGhostling,
  },
  botling: {
    id: 'botling', name: 'ちびロボ',    desc: 'ピコピコ\n金属の民',
    base: '#fbbf24', draw: drawBotling,
  },
};

export const APPEARANCE_IDS: string[] = Object.keys(APPEARANCES);
