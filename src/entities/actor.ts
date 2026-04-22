// ─────────────────────────────────────────────
// actor.ts  Actor 基底クラス（ターン制・タイル座標）
// ─────────────────────────────────────────────

import { TILE_SIZE } from '../world/tiles.js';
import type { SpriteManager } from '../types.js';
import type { SunVec } from '../ui/daylight.js';

const LERP_K = 14;

export class Actor {
  tx:      number;
  ty:      number;
  renderX: number;
  renderY: number;
  maxHP:   number;
  hp:      number;
  alive:   boolean;
  dirX:    number;
  dirY:    number;
  bumpX:   number;
  bumpY:   number;
  /** HP バー演出: 実 HP より遅れて減る残像 HP */
  displayHp:     number;
  /** HP バー演出: 減少時に残像が動き出すまでのディレイ秒 */
  displayHpWait: number;
  /** 武器振りアニメ: 攻撃方向 X */
  swipeDirX: number;
  /** 武器振りアニメ: 攻撃方向 Y */
  swipeDirY: number;
  /** 武器振りアニメ: 残り秒 (0 で非表示) */
  swipeTime: number;
  /** 武器振りアニメ: 初期値（0〜1 の進行計算用） */
  swipeMax:  number;

  constructor(tx: number, ty: number, maxHP: number) {
    this.tx = tx;
    this.ty = ty;

    this.renderX = (tx + 0.5) * TILE_SIZE;
    this.renderY = (ty + 0.5) * TILE_SIZE;

    this.maxHP = maxHP;
    this.hp    = maxHP;
    this.alive = true;

    this.dirX = 0;
    this.dirY = 1;

    this.bumpX = 0;
    this.bumpY = 0;

    this.displayHp     = maxHP;
    this.displayHpWait = 0;

    this.swipeDirX = 0;
    this.swipeDirY = 0;
    this.swipeTime = 0;
    this.swipeMax  = 0.22;
  }

  updateRender(dt: number): void {
    const k  = 1 - Math.exp(-LERP_K * dt);
    const tx = (this.tx + 0.5) * TILE_SIZE;
    const ty = (this.ty + 0.5) * TILE_SIZE;
    this.renderX += (tx - this.renderX) * k;
    this.renderY += (ty - this.renderY) * k;
    this.bumpX   *= 0.65;
    this.bumpY   *= 0.65;

    if (this.swipeTime > 0) {
      this.swipeTime = Math.max(0, this.swipeTime - dt);
    }

    // ── HP バー残像 ──────────────────────────
    if (this.displayHp < this.hp) {
      // 回復は即追従
      this.displayHp = this.hp;
    } else if (this.displayHp > this.hp) {
      // 被弾: 少しディレイを挟んでから滑らかに追従
      if (this.displayHpWait > 0) {
        this.displayHpWait -= dt;
      } else {
        const dropSpeed = Math.max(this.maxHP * 1.2, 8);
        this.displayHp = Math.max(this.hp, this.displayHp - dropSpeed * dt);
      }
    }
  }

  moveTo(tx: number, ty: number): void {
    this.dirX = tx - this.tx;
    this.dirY = ty - this.ty;
    this.tx   = tx;
    this.ty   = ty;
  }

  takeDamage(amount: number, fromDirX = 0, fromDirY = 0): number {
    if (!this.alive) return 0;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) this.alive = false;
    this.bumpX = -fromDirX * TILE_SIZE * 0.35;
    this.bumpY = -fromDirY * TILE_SIZE * 0.35;
    this.displayHpWait = 0.25;  // 残像バーを 250ms 停滞させてから減らす
    return amount;
  }

  attackBump(dirX: number, dirY: number): void {
    this.bumpX = dirX * TILE_SIZE * 0.3;
    this.bumpY = dirY * TILE_SIZE * 0.3;
    // 武器の振り抜きアニメも同時にトリガー
    if (dirX !== 0 || dirY !== 0) {
      this.swipeDirX = dirX;
      this.swipeDirY = dirY;
      this.swipeTime = this.swipeMax;
    }
  }

  isAdjacentTo(target: { tx: number; ty: number }): boolean {
    return Math.abs(this.tx - target.tx) <= 1 &&
           Math.abs(this.ty - target.ty) <= 1;
  }

  screenPos(camOffX: number, camOffY: number): { sx: number; sy: number } {
    return {
      sx: this.renderX + this.bumpX + camOffX,
      sy: this.renderY + this.bumpY + camOffY,
    };
  }

  /**
   * 影の描画。sun（太陽ベクトル）を渡すと方向と長さが時間帯で変化し、
   * 引数を省略すると従来どおり真下の小さな固定影を描く。
   */
  drawShadow(
    ctx: CanvasRenderingContext2D,
    camOffX: number, camOffY: number,
    sun?: SunVec,
  ): void {
    const { sx, sy } = this.screenPos(camOffX, camOffY);
    const footY = sy + TILE_SIZE * 0.22;
    ctx.save();

    if (sun) {
      // ── 指向性の長い影 ──
      // 長軸：太陽高度が低いほど長い。短軸は一定。
      const rx = TILE_SIZE * 0.30 * sun.lengthMult;
      const ry = TILE_SIZE * 0.10;
      // 中心を太陽反対方向に少しずらす（足元から伸びるように）
      const offset = rx * 0.55;
      const cx = sx + sun.dx * offset;
      const cy = footY + sun.dy * offset * 0.35;
      const angle = Math.atan2(sun.dy, sun.dx);
      ctx.fillStyle = sun.tint;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, angle, 0, Math.PI * 2);
      ctx.fill();
      // 足元の小さな接地影（影をキャラに繋げる）
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(sx, footY, TILE_SIZE * 0.18, TILE_SIZE * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // ── 互換：フォールバック（ダンジョン内など sun が無い場面）──
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(sx, footY, TILE_SIZE * 0.32, TILE_SIZE * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// SpriteManager を actor.ts からも re-export して利用しやすくする
export type { SpriteManager };
