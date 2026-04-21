// ─────────────────────────────────────────────
// pet.ts  ペット同行（追従 / 隣接攻撃）
//
// プレイヤーの味方として常に1体だけ追従するシンプルな仲間。
// 自分のターンに：
//   1) 隣接する敵がいれば atk ぶんダメージを与える
//   2) いなければプレイヤーへ1マス近づく
// ─────────────────────────────────────────────

import { APPEARANCES } from '../data/appearances.js';
import type { AppearanceDef } from '../data/appearances.js';
import type { GameMap } from '../types.js';

export type PetKind = 'slime' | 'mush' | 'rock';

export interface PetDef {
  kind:    PetKind;
  name:    string;
  species: string; // APPEARANCE id
  tint:    string;
  hp:      number;
  atk:     number;
  desc:    string;
}

export const PETS: Record<PetKind, PetDef> = {
  slime: { kind: 'slime', name: 'スライムの友',  species: 'slimeling', tint: '#86efac', hp: 6, atk: 2, desc: '柔軟・素早く隣接の敵を打つ' },
  mush:  { kind: 'mush',  name: 'マッシュの友',  species: 'mushroom',  tint: '#fbcfe8', hp: 8, atk: 1, desc: 'タフで地味に削る' },
  rock:  { kind: 'rock',  name: 'ロックの友',    species: 'rockling',  tint: '#a8a29e', hp: 12, atk: 3, desc: '硬く重く、強く殴る' },
};

export const PET_KINDS: ReadonlyArray<PetKind> = ['slime', 'mush', 'rock'];

export interface PetActor {
  hp: number;
  atk: number;
  alive: boolean;
  tx: number; ty: number;
  takeDamage(d: number): void;
  isPet: true;
}

export class Pet implements PetActor {
  readonly kind: PetKind;
  readonly def:  PetDef;
  readonly appearance: AppearanceDef;
  hp:    number;
  maxHp: number;
  atk:   number;
  alive: boolean = true;
  tx:    number;
  ty:    number;
  /** 描画用：歩行アニメ位相 */
  walkPhase = 0;
  /** 描画用：移動補間 */
  fromTx:  number;
  fromTy:  number;
  moveT:   number = 1; // 0..1（1で停止）
  readonly isPet: true = true;

  constructor(kind: PetKind, tx: number, ty: number) {
    this.kind  = kind;
    this.def   = PETS[kind];
    this.appearance = APPEARANCES[this.def.species];
    this.maxHp = this.def.hp;
    this.hp    = this.def.hp;
    this.atk   = this.def.atk;
    this.tx    = tx;
    this.ty    = ty;
    this.fromTx = tx;
    this.fromTy = ty;
  }

  takeDamage(d: number): void {
    this.hp = Math.max(0, this.hp - Math.max(0, d));
    if (this.hp === 0) this.alive = false;
  }

  /** 隣接（4方向）に敵がいれば最初に見つけた1体を返す */
  findAdjacentEnemy<E extends { tx: number; ty: number; alive: boolean }>(enemies: E[]): E | null {
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = Math.abs(e.tx - this.tx);
      const dy = Math.abs(e.ty - this.ty);
      if ((dx + dy) === 1) return e;
    }
    return null;
  }

  /**
   * ペットの1ターン。
   * 隣接の敵を殴る → なければプレイヤーへ1マス寄る → どちらも不要なら待機。
   */
  takeTurn<E extends { tx: number; ty: number; alive: boolean; hp: number; takeDamage?: (d: number) => void }>(
    map:   GameMap,
    player: { tx: number; ty: number },
    enemies: E[],
    isOccupied: (tx: number, ty: number) => boolean,
    onAttack: (target: E, dmg: number) => void,
  ): void {
    if (!this.alive) return;
    // 1) 隣接攻撃
    const target = this.findAdjacentEnemy(enemies);
    if (target) {
      const dmg = this.atk;
      if (target.takeDamage) target.takeDamage(dmg);
      else target.hp = Math.max(0, target.hp - dmg);
      if (target.hp <= 0) target.alive = false;
      onAttack(target, dmg);
      return;
    }
    // 2) プレイヤーに寄る（既に隣接なら何もしない）
    const dxp = player.tx - this.tx;
    const dyp = player.ty - this.ty;
    const distP = Math.abs(dxp) + Math.abs(dyp);
    if (distP <= 1) return;

    const tries: Array<[number, number]> = [];
    // 距離が大きい方の軸を優先
    if (Math.abs(dxp) >= Math.abs(dyp)) {
      if (dxp !== 0) tries.push([Math.sign(dxp), 0]);
      if (dyp !== 0) tries.push([0, Math.sign(dyp)]);
    } else {
      if (dyp !== 0) tries.push([0, Math.sign(dyp)]);
      if (dxp !== 0) tries.push([Math.sign(dxp), 0]);
    }
    for (const [dx, dy] of tries) {
      const nx = this.tx + dx;
      const ny = this.ty + dy;
      if (nx < 0 || ny < 0 || nx >= map.cols || ny >= map.rows) continue;
      if (!map.isWalkable(nx, ny)) continue;
      if (isOccupied(nx, ny)) continue;
      this.fromTx = this.tx;
      this.fromTy = this.ty;
      this.tx = nx;
      this.ty = ny;
      this.moveT = 0;
      this.walkPhase = (this.walkPhase + 0.5) % 1;
      return;
    }
  }

  /** 補間更新（1tickあたり0.25進む程度） */
  advanceAnim(dt: number): void {
    if (this.moveT < 1) this.moveT = Math.min(1, this.moveT + dt * 8);
  }

  /** 拠点／ダンジョンで使う描画。プレイヤーと同じ APPEARANCES.draw を流用 */
  draw(
    ctx:     CanvasRenderingContext2D,
    cx:      number,
    cy:      number,
    sizePx:  number,
    facing:  'front' | 'back' | 'side',
    walking: boolean,
  ): void {
    const phase = walking ? (performance.now() / 200) % 1 : 0;
    this.appearance.draw(ctx, cx, cy, sizePx, facing, this.def.tint, phase, this.alive ? 1 : 0.4);
  }
}
