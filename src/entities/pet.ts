// ─────────────────────────────────────────────
// pet.ts  ペット同行（追従 / 隣接攻撃）
//
// プレイヤーの味方として常に1体だけ追従するシンプルな仲間。
// 自分のターンに：
//   1) 隣接する敵がいれば atk ぶんダメージを与える
//   2) いなければプレイヤーへ1マス近づく
//
// 描画は `assets/pet_*.svg` をスプライトとして読み込み、sprite キャッシュ経由で描く。
// ─────────────────────────────────────────────

import type { GameMap } from '../types.js';
import type { SpriteLoader } from '../core/sprites.js';

export type PetKind =
  | 'dog' | 'cat' | 'gorilla' | 'rabbit' | 'bird' | 'fox' | 'slime';

export interface PetDef {
  kind:       PetKind;
  name:       string;
  spriteName: string;  // sprites に登録するキー
  assetUrl:   string;  // ロード時の URL（バージョン付き）
  hp:         number;
  atk:        number;
  desc:       string;
}

/**
 * ペット定義。
 * spriteName は sprites.loadAll に渡すキー、assetUrl は実ファイルへのパス。
 * HP/ATK はバランス調整用のシンプルな数値（追従の戦闘力）。
 */
export const PETS: Record<PetKind, PetDef> = {
  dog:     { kind: 'dog',     name: 'こいぬ',   spriteName: 'pet_dog',     assetUrl: 'assets/pet_dog.svg?v=1',     hp: 8,  atk: 2, desc: '元気よく追従 / 隣接の敵を噛む' },
  cat:     { kind: 'cat',     name: 'こねこ',   spriteName: 'pet_cat',     assetUrl: 'assets/pet_cat.svg?v=1',     hp: 6,  atk: 3, desc: '軽やか・爪で引っ掻く' },
  gorilla: { kind: 'gorilla', name: 'ゴリラ',   spriteName: 'pet_gorilla', assetUrl: 'assets/pet_gorilla.svg?v=1', hp: 14, atk: 4, desc: '重い一撃 / タフ' },
  rabbit:  { kind: 'rabbit',  name: 'うさぎ',   spriteName: 'pet_rabbit',  assetUrl: 'assets/pet_rabbit.svg?v=1',  hp: 5,  atk: 2, desc: 'すばしこく蹴りを入れる' },
  bird:    { kind: 'bird',    name: 'ことり',   spriteName: 'pet_bird',    assetUrl: 'assets/pet_bird.svg?v=1',    hp: 4,  atk: 2, desc: '素早くつつく' },
  fox:     { kind: 'fox',     name: 'きつね',   spriteName: 'pet_fox',     assetUrl: 'assets/pet_fox.svg?v=1',     hp: 7,  atk: 3, desc: 'しなやかに噛みつく' },
  slime:   { kind: 'slime',   name: 'スライム', spriteName: 'pet_slime',   assetUrl: 'assets/slime.svg?v=6',       hp: 6,  atk: 2, desc: 'ぷるぷる・無害でかわいい' },
};

export const PET_KINDS: ReadonlyArray<PetKind> = ['dog', 'cat', 'gorilla', 'rabbit', 'bird', 'fox', 'slime'];

/** `sprites.loadAll()` にそのまま渡せる [name, url] 配列を返す */
export function petSpriteEntries(): Array<[string, string]> {
  return PET_KINDS.map((k) => [PETS[k].spriteName, PETS[k].assetUrl] as [string, string]);
}

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

  /**
   * ペット描画（SVG スプライトベース）。
   * facing/walking は呼び出し元からの情報で歩行中のバウンス表現に使う。
   */
  draw(
    ctx:     CanvasRenderingContext2D,
    sprites: SpriteLoader,
    cx:      number,
    cy:      number,
    sizePx:  number,
    _facing: 'front' | 'back' | 'side',
    walking: boolean,
  ): void {
    // 足元の影（スプライト側にもあるが、タイル統一感のためもう一枚）
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + sizePx * 0.38, sizePx * 0.28, sizePx * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 歩行中の軽い上下バウンス
    const bob = walking ? Math.sin((performance.now() / 120)) * sizePx * 0.03 : 0;

    const img = sprites.get(this.def.spriteName);
    if (img) {
      const a = this.alive ? 1 : 0.4;
      ctx.save();
      ctx.globalAlpha = a;
      sprites.draw(ctx, this.def.spriteName, cx, cy + bob, sizePx, sizePx);
      ctx.restore();
    } else {
      // スプライト未ロード時のフォールバック
      ctx.save();
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(cx, cy + bob, sizePx * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
