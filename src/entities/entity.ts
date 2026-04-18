// ─────────────────────────────────────────────
// entity.ts  Entity 基底クラス
//   ピクセル座標ベースの物理エンティティ（ノックバック・無敵時間）
//   ※ ターン制ローグライクでは Actor を使用。本クラスは未使用。
// ─────────────────────────────────────────────

import type { GameMap } from '../types.js';

const KNOCKBACK_DECAY = 7;

export class Entity {
  x:     number;
  y:     number;
  maxHP: number;
  hp:    number;
  hitW:  number;
  hitH:  number;

  vx:            number;
  vy:            number;
  knockbackTimer: number;

  invTimer:    number;
  INV_DURATION: number;

  alive:          boolean;
  deathTimer:     number;
  DEATH_DURATION: number;

  constructor(x: number, y: number, maxHP: number, hitW: number, hitH: number) {
    this.x     = x;
    this.y     = y;
    this.maxHP = maxHP;
    this.hp    = maxHP;
    this.hitW  = hitW;
    this.hitH  = hitH;

    this.vx             = 0;
    this.vy             = 0;
    this.knockbackTimer = 0;

    this.invTimer     = 0;
    this.INV_DURATION = 0.8;

    this.alive          = true;
    this.deathTimer     = 0;
    this.DEATH_DURATION = 0.5;
  }

  update(dt: number, map: GameMap | null = null): void {
    if (this.knockbackTimer > 0) {
      const decay = Math.exp(-KNOCKBACK_DECAY * dt);
      const nx    = this.x + this.vx * dt;
      const ny    = this.y + this.vy * dt;

      if (map) {
        if (this.canMoveTo(nx, this.y, map)) this.x = nx; else this.vx = 0;
        if (this.canMoveTo(this.x, ny, map)) this.y = ny; else this.vy = 0;
      } else {
        this.x = nx;
        this.y = ny;
      }
      this.vx *= decay;
      this.vy *= decay;
      this.knockbackTimer -= dt;
    }

    if (this.invTimer > 0)                    this.invTimer   -= dt;
    if (!this.alive && this.deathTimer > 0)   this.deathTimer -= dt;
  }

  canMoveTo(nx: number, ny: number, map: GameMap): boolean {
    const hw = this.hitW / 2;
    const hh = this.hitH / 2;
    const ts = map.tileSize;
    return (
      [
        [nx - hw, ny - hh],
        [nx + hw, ny - hh],
        [nx - hw, ny + hh],
        [nx + hw, ny + hh],
      ] as [number, number][]
    ).every(([cx, cy]) =>
      map.isWalkable(Math.floor(cx / ts), Math.floor(cy / ts))
    );
  }

  takeDamage(amount: number, fromX: number, fromY: number): boolean {
    if (this.invTimer > 0 || !this.alive) return false;

    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.alive      = false;
      this.deathTimer = this.DEATH_DURATION;
    }

    const dx    = this.x - fromX;
    const dy    = this.y - fromY;
    const dist  = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = 320;
    this.vx             = (dx / dist) * force;
    this.vy             = (dy / dist) * force;
    this.knockbackTimer = 0.25;
    this.invTimer       = this.INV_DURATION;

    return true;
  }

  isKnockedBack(): boolean { return this.knockbackTimer > 0; }

  isFullyDead(): boolean { return !this.alive && this.deathTimer <= 0; }
}
