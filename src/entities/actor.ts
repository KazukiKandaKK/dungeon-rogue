// ─────────────────────────────────────────────
// actor.ts  Actor 基底クラス（ターン制・タイル座標）
// ─────────────────────────────────────────────

import { TILE_SIZE } from '../world/tiles.js';
import type { SpriteManager } from '../types.js';

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

  drawShadow(ctx: CanvasRenderingContext2D, camOffX: number, camOffY: number): void {
    const { sx, sy } = this.screenPos(camOffX, camOffY);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + TILE_SIZE * 0.22, TILE_SIZE * 0.32, TILE_SIZE * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// SpriteManager を actor.ts からも re-export して利用しやすくする
export type { SpriteManager };
