// ─────────────────────────────────────────────
// ambient-creatures.ts  街にいる小動物（ニワトリ・猫・犬・ネズミ）
//
// 純粋に視覚的な存在であり、ゲームロジックには一切影響しない。
// 役割：街並みに「生活感」を追加する。
//   ・10匹までプール固定
//   ・3秒おきにのんびり1マス動く（0.6秒で補間）
//   ・夜（getNightFactor>0.5）はその場で寝る
//   ・描画は 12〜18px の小さな手描き（Canvas プリミティブ）
// ─────────────────────────────────────────────

'use strict';

import { hash2, seededRand } from './base-realism.js';

export type CreatureKind = 'chicken' | 'cat' | 'dog' | 'mouse';

export interface AmbientCreature {
  kind:    CreatureKind;
  /** 現在のタイル座標（整数） */
  tx: number;
  ty: number;
  /** 移動補間元 */
  fromTx: number;
  fromTy: number;
  /** 0..1 で 1=停止 */
  moveT: number;
  /** 次に判断する時刻（performance.now ベース） */
  nextActAt: number;
  /** バウンドや尻尾用の位相シード */
  phaseT: number;
  /** 横向きの向き（+1=右, -1=左） */
  facingDir: 1 | -1;
}

/**
 * 拠点の決定論的な「初期配置候補」。広場や噴水・壁を避けて散らばる。
 * 実際にここから歩行可能な位置だけを採用する。
 */
const SEED_POSITIONS: Array<[CreatureKind, number, number]> = [
  ['chicken', 4,  19],
  ['chicken', 12, 18],
  ['chicken', 8,  22],
  ['cat',     27, 14],
  ['cat',     6,  14],
  ['cat',     21, 22],
  ['dog',     18, 22],
  ['dog',     30, 19],
  ['mouse',   14, 21],
  ['mouse',   3,  24],
];

/**
 * 小動物プールを初期化する。歩行可能なタイルだけを採用する。
 * @param isWalkable (tx,ty) → bool
 * @param cols / rows マップサイズ（フォールバック探索の上限）
 */
export function createAmbientCreatures(
  isWalkable: (tx: number, ty: number) => boolean,
  cols: number,
  rows: number,
): AmbientCreature[] {
  const list: AmbientCreature[] = [];
  for (const [kind, tx, ty] of SEED_POSITIONS) {
    let px = tx, py = ty;
    // 万一壁になっていれば近隣 8 タイルから歩行可能な代替を決定論的に探す
    if (!_isSafe(isWalkable, px, py, cols, rows)) {
      let found = false;
      for (let r = 1; r <= 2 && !found; r++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          for (let dx = -r; dx <= r && !found; dx++) {
            const nx = tx + dx, ny = ty + dy;
            if (_isSafe(isWalkable, nx, ny, cols, rows)) {
              px = nx; py = ny; found = true;
            }
          }
        }
      }
      if (!found) continue; // どうしても置けない種は捨てる
    }
    list.push({
      kind,
      tx: px, ty: py,
      fromTx: px, fromTy: py,
      moveT: 1,
      nextActAt: 1500 + hash2(px, py) % 2000,
      phaseT: (hash2(px, py) % 1000) / 1000,
      facingDir: hash2(px, py) % 2 === 0 ? 1 : -1,
    });
  }
  return list;
}

/** 噴水・壁・地区境界を避けるためのチェック。 */
function _isSafe(
  isWalkable: (tx: number, ty: number) => boolean,
  tx: number, ty: number, cols: number, rows: number,
): boolean {
  if (tx < 1 || ty < 1 || tx >= cols - 1 || ty >= rows - 1) return false;
  return isWalkable(tx, ty);
}

/**
 * 1フレーム更新。徘徊ロジックは Math.random() で OK（描画じゃないので）。
 * @param dt 秒
 */
export function updateAmbientCreatures(
  list:       AmbientCreature[],
  dt:         number,
  isWalkable: (tx: number, ty: number) => boolean,
  cols:       number,
  rows:       number,
  nightFactor: number = 0,
): void {
  // 夜は完全停止（その場で眠る）
  const sleeping = nightFactor > 0.5;
  const now = (typeof performance !== 'undefined' && performance.now)
    ? performance.now() : Date.now();
  for (const c of list) {
    // 補間進行（0.6秒で1マス）
    if (c.moveT < 1) {
      c.moveT = Math.min(1, c.moveT + dt * 1.6);
    }
    // 位相（しっぽ・羽ばたき・呼吸）
    c.phaseT = (c.phaseT + dt * 0.7) % 1;

    if (sleeping) continue;
    if (now < c.nextActAt) continue;
    if (c.moveT < 1) continue;

    // 60% は休む（その場でじっとしている）。残り 40% で1マス動く。
    if (Math.random() < 0.6) {
      c.nextActAt = now + 1800 + Math.random() * 2200;
      continue;
    }
    const dirs: Array<[number, number]> = [[1,0],[-1,0],[0,1],[0,-1]];
    // シャッフル
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    let moved = false;
    for (const [dx, dy] of dirs) {
      const nx = c.tx + dx, ny = c.ty + dy;
      if (!_isSafe(isWalkable, nx, ny, cols, rows)) continue;
      c.fromTx = c.tx; c.fromTy = c.ty;
      c.tx = nx; c.ty = ny;
      c.moveT = 0;
      if (dx > 0) c.facingDir = 1;
      else if (dx < 0) c.facingDir = -1;
      moved = true;
      break;
    }
    const baseDelay = c.kind === 'mouse' ? 800 : c.kind === 'chicken' ? 1500 : 2200;
    c.nextActAt = now + baseDelay + Math.random() * 1500;
    if (!moved) {
      // 動けなかったら少し短めに次の判断
      c.nextActAt = now + 700 + Math.random() * 800;
    }
  }
}

// ─── 描画 ─────────────────────────────────────

/**
 * 全小動物を描画する。BASE 描画パスから呼ぶ。
 * @param TILE_SIZE main.js 側のタイルサイズ
 * @param nightFactor 夜の強さ（0..1）。>0.5 で寝姿を描く
 */
export function drawAmbientCreatures(
  ctx:        CanvasRenderingContext2D,
  list:       AmbientCreature[],
  camOffX:    number,
  camOffY:    number,
  now:        number,
  TILE_SIZE:  number,
  nightFactor: number = 0,
): void {
  const sleeping = nightFactor > 0.5;
  for (const c of list) {
    const t  = c.moveT;
    const px = ((1 - t) * c.fromTx + t * c.tx + 0.5) * TILE_SIZE + camOffX;
    const py = ((1 - t) * c.fromTy + t * c.ty + 0.5) * TILE_SIZE + camOffY;
    // 影
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(px, py + TILE_SIZE * 0.3, TILE_SIZE * 0.18, TILE_SIZE * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (sleeping) {
      _drawSleeping(ctx, c, px, py, TILE_SIZE, now);
    } else {
      switch (c.kind) {
        case 'chicken': _drawChicken(ctx, c, px, py, TILE_SIZE, now); break;
        case 'cat':     _drawCat(ctx, c, px, py, TILE_SIZE, now);     break;
        case 'dog':     _drawDog(ctx, c, px, py, TILE_SIZE, now);     break;
        case 'mouse':   _drawMouse(ctx, c, px, py, TILE_SIZE, now);   break;
      }
    }
  }
}

/** 共通：軽くバウンド（停止中の呼吸） */
function _bob(c: AmbientCreature, now: number): number {
  if (c.moveT < 1) return 0;
  return Math.sin(now * 0.004 + c.phaseT * 6.28) * 0.7;
}

function _drawChicken(
  ctx: CanvasRenderingContext2D, c: AmbientCreature,
  cx: number, cy: number, ts: number, now: number,
): void {
  const dir = c.facingDir;
  const bob = _bob(c, now);
  // 地面をついばむ動作（停止中にだけ）：cos の鋭いパルス
  const peck = c.moveT >= 1
    ? Math.max(0, Math.sin(now * 0.003 + c.phaseT * 4)) ** 4
    : 0;
  ctx.save();
  ctx.translate(cx, cy + bob);
  // 胴
  ctx.fillStyle = '#fafaf9';
  ctx.beginPath();
  ctx.ellipse(0, 0, ts * 0.16, ts * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  // 尻尾の羽
  ctx.fillStyle = '#e7e5e4';
  ctx.beginPath();
  ctx.ellipse(-dir * ts * 0.13, -ts * 0.04, ts * 0.07, ts * 0.10, 0, 0, Math.PI * 2);
  ctx.fill();
  // 頭（ついばみで下がる）
  const headY = -ts * 0.10 + peck * ts * 0.10;
  ctx.fillStyle = '#fafaf9';
  ctx.beginPath();
  ctx.arc(dir * ts * 0.12, headY, ts * 0.06, 0, Math.PI * 2);
  ctx.fill();
  // とさか（赤）
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(dir * ts * 0.10, headY - ts * 0.06, ts * 0.025, 0, Math.PI * 2);
  ctx.arc(dir * ts * 0.13, headY - ts * 0.07, ts * 0.022, 0, Math.PI * 2);
  ctx.fill();
  // くちばし
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(dir * ts * 0.17, headY);
  ctx.lineTo(dir * ts * 0.20, headY + ts * 0.02);
  ctx.lineTo(dir * ts * 0.17, headY + ts * 0.03);
  ctx.closePath(); ctx.fill();
  // 目
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(dir * ts * 0.13, headY - ts * 0.005, 0.8, 0, Math.PI * 2); ctx.fill();
  // 脚（小さな線）
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-ts * 0.02, ts * 0.10); ctx.lineTo(-ts * 0.02, ts * 0.16);
  ctx.moveTo( ts * 0.04, ts * 0.10); ctx.lineTo( ts * 0.04, ts * 0.16);
  ctx.stroke();
  ctx.restore();
}

function _drawCat(
  ctx: CanvasRenderingContext2D, c: AmbientCreature,
  cx: number, cy: number, ts: number, now: number,
): void {
  const dir = c.facingDir;
  const bob = _bob(c, now);
  // しっぽが揺れる
  const tail = Math.sin(now * 0.003 + c.phaseT * 6.28) * 0.4;
  ctx.save();
  ctx.translate(cx, cy + bob);
  // 胴
  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.ellipse(-dir * ts * 0.05, ts * 0.02, ts * 0.16, ts * 0.10, 0, 0, Math.PI * 2);
  ctx.fill();
  // 頭
  ctx.beginPath();
  ctx.arc(dir * ts * 0.12, -ts * 0.04, ts * 0.08, 0, Math.PI * 2);
  ctx.fill();
  // 耳（三角×2）
  ctx.beginPath();
  ctx.moveTo(dir * ts * 0.08, -ts * 0.10);
  ctx.lineTo(dir * ts * 0.10, -ts * 0.16);
  ctx.lineTo(dir * ts * 0.13, -ts * 0.10);
  ctx.moveTo(dir * ts * 0.13, -ts * 0.10);
  ctx.lineTo(dir * ts * 0.16, -ts * 0.16);
  ctx.lineTo(dir * ts * 0.18, -ts * 0.10);
  ctx.fill();
  // しっぽ（揺れる S）
  ctx.strokeStyle = '#a16207'; ctx.lineWidth = ts * 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-dir * ts * 0.18, ts * 0.02);
  ctx.quadraticCurveTo(
    -dir * ts * 0.28, -ts * 0.05 + tail * ts * 0.05,
    -dir * ts * 0.22, -ts * 0.14 + tail * ts * 0.06,
  );
  ctx.stroke();
  // 目
  ctx.fillStyle = '#22c55e';
  ctx.beginPath(); ctx.arc(dir * ts * 0.14, -ts * 0.05, 1.0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(dir * ts * 0.10, -ts * 0.05, 1.0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function _drawDog(
  ctx: CanvasRenderingContext2D, c: AmbientCreature,
  cx: number, cy: number, ts: number, now: number,
): void {
  const dir = c.facingDir;
  const bob = _bob(c, now);
  // 尻尾を振る
  const wag = Math.sin(now * 0.012 + c.phaseT * 6.28) * 0.6;
  ctx.save();
  ctx.translate(cx, cy + bob);
  // 胴
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(-dir * ts * 0.04, ts * 0.04, ts * 0.18, ts * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  // 頭
  ctx.beginPath();
  ctx.arc(dir * ts * 0.14, -ts * 0.05, ts * 0.09, 0, Math.PI * 2);
  ctx.fill();
  // 耳（垂れ）
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.ellipse(dir * ts * 0.08, -ts * 0.06, ts * 0.04, ts * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  // 鼻
  ctx.fillStyle = '#0c0a09';
  ctx.beginPath(); ctx.arc(dir * ts * 0.21, -ts * 0.04, 1.5, 0, Math.PI * 2); ctx.fill();
  // 目
  ctx.beginPath(); ctx.arc(dir * ts * 0.16, -ts * 0.07, 1.0, 0, Math.PI * 2); ctx.fill();
  // しっぽ（振る）
  ctx.strokeStyle = '#78350f'; ctx.lineWidth = ts * 0.06;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-dir * ts * 0.20, ts * 0.00);
  ctx.lineTo(-dir * ts * 0.27 - dir * wag * ts * 0.05, -ts * 0.10 + wag * ts * 0.04);
  ctx.stroke();
  ctx.restore();
}

function _drawMouse(
  ctx: CanvasRenderingContext2D, c: AmbientCreature,
  cx: number, cy: number, ts: number, now: number,
): void {
  const dir = c.facingDir;
  const bob = _bob(c, now) * 0.5;
  ctx.save();
  ctx.translate(cx, cy + bob);
  // 胴（小さい）
  ctx.fillStyle = '#71717a';
  ctx.beginPath();
  ctx.ellipse(-dir * ts * 0.03, ts * 0.05, ts * 0.10, ts * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  // 頭
  ctx.beginPath();
  ctx.arc(dir * ts * 0.07, ts * 0.02, ts * 0.05, 0, Math.PI * 2);
  ctx.fill();
  // 耳
  ctx.fillStyle = '#a1a1aa';
  ctx.beginPath();
  ctx.arc(dir * ts * 0.05, -ts * 0.02, ts * 0.025, 0, Math.PI * 2);
  ctx.arc(dir * ts * 0.09, -ts * 0.02, ts * 0.025, 0, Math.PI * 2);
  ctx.fill();
  // しっぽ（細い線）
  ctx.strokeStyle = '#a1a1aa'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-dir * ts * 0.13, ts * 0.05);
  ctx.quadraticCurveTo(-dir * ts * 0.22, ts * 0.03, -dir * ts * 0.20, -ts * 0.04);
  ctx.stroke();
  // 目
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(dir * ts * 0.09, ts * 0.02, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** 夜の寝姿：ぺたっと地面に伏せる。「Zzz」を控えめに浮かべる。 */
function _drawSleeping(
  ctx: CanvasRenderingContext2D, c: AmbientCreature,
  cx: number, cy: number, ts: number, now: number,
): void {
  const breath = Math.sin(now * 0.002 + c.phaseT * 6.28) * 0.4;
  const color =
    c.kind === 'chicken' ? '#fafaf9' :
    c.kind === 'cat'     ? '#a16207' :
    c.kind === 'dog'     ? '#78350f' :
                           '#71717a';
  ctx.save();
  ctx.translate(cx, cy + ts * 0.05);
  // 寝そべる楕円（呼吸でわずかに上下）
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, breath, ts * 0.18, ts * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  // 小さな耳/とさか/しっぽの一部
  if (c.kind === 'chicken') {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(-ts * 0.10, -ts * 0.02, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Zzz
  if (Math.floor(now / 1200) % 3 === 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(226,232,240,0.7)';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('z', cx + ts * 0.18, cy - ts * 0.10);
    ctx.restore();
  }
}
