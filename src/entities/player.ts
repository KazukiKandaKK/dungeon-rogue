// ─────────────────────────────────────────────
// player.ts  Player クラス（ターン制・パラメータ・装備システム）
// ─────────────────────────────────────────────

import { Actor }             from './actor.js';
import { TILE_SIZE }         from '../world/tiles.js';
import { CLASSES }           from '../data/classes.js';
import type { ClassId }      from '../data/classes.js';
import type { ItemDef }      from '../data/equipment.js';
import type { StatusEffectEntry, SpriteManager } from '../types.js';

// ── 型定義 ────────────────────────────────────

export interface BuildBonus {
  atkPerLv: number;
  defPerLv: number;
  hpPerLv:  number;
  mpPerLv:  number;
  spdEvery: number;
  lukEvery: number;
}

type EquipSlotName = 'weapon' | 'armor' | 'accessory';

interface Equipment {
  weapon:    ItemDef | null;
  armor:     ItemDef | null;
  accessory: ItemDef | null;
}

// ── 定数 ─────────────────────────────────────

export const BASE_MAX_HP = 10;
const SZ = TILE_SIZE + 10;

// ── Player クラス ─────────────────────────────

export class Player extends Actor {
  name:       string;
  buildBonus: BuildBonus;

  classType: string;
  atkPerLv:  number;
  defPerLv:  number;
  hpPerLv:   number;
  mpPerLv:   number;
  baseMaxHP: number;

  lv:      number;
  exp:     number;
  expNext: number;

  baseAtk: number;
  baseDef: number;
  baseSpd: number;
  baseLuk: number;

  baseMp: number;
  mp:     number;
  _stepsSinceMpRegen: number;

  spells:        string[];
  statusEffects: StatusEffectEntry[];

  gold: number;

  equip:        Equipment;
  inventory:    ItemDef[];
  maxInventory: number;

  constructor(tx: number, ty: number, classType: ClassId = 'warrior', buildBonus: BuildBonus | null = null) {
    const cls = CLASSES[classType] ?? CLASSES.warrior;
    super(tx, ty, cls.baseHP);
    this.name       = '勇者';
    this.buildBonus = buildBonus ?? { atkPerLv: 0, defPerLv: 0, hpPerLv: 0, mpPerLv: 0, spdEvery: 0, lukEvery: 0 };

    this.classType = classType;
    this.atkPerLv  = cls.atkPerLv;
    this.defPerLv  = cls.defPerLv;
    this.hpPerLv   = cls.hpPerLv;
    this.mpPerLv   = cls.mpPerLv ?? 1;
    this.baseMaxHP = cls.baseHP;

    this.lv      = 1;
    this.exp     = 0;
    this.expNext = 10;

    this.baseAtk = cls.baseAtk;
    this.baseDef = cls.baseDef;
    this.baseSpd = cls.baseSpd ?? 0;
    this.baseLuk = cls.baseLuk ?? 0;

    this.baseMp              = cls.baseMpMax ?? 10;
    this.mp                  = this.baseMp;
    this._stepsSinceMpRegen  = 0;

    this.spells        = [...(cls.startSpells ?? [])];
    this.statusEffects = [];

    this.gold = 0;

    this.equip        = { weapon: null, armor: null, accessory: null };
    this.inventory    = [];
    this.maxInventory = 20;
  }

  // ── 計算済みステータス ─────────────────────────

  get atk(): number {
    const atkBuff = (this.statusEffects.find(e => e.type === 'war_cry')?.power  ?? 0)
                  + (this.statusEffects.find(e => e.type === 'berserk')?.power  ?? 0);
    return this.baseAtk
      + (this.equip.weapon?.atk    ?? 0)
      + (this.equip.accessory?.atk ?? 0)
      + atkBuff;
  }

  get def(): number {
    const barrierBonus   = this.statusEffects.find(e => e.type === 'barrier')?.power      ?? 0;
    const ironSkinBonus  = this.statusEffects.find(e => e.type === 'iron_skin')?.power     ?? 0;
    const berserkPenalty = this.statusEffects.find(e => e.type === 'berserk')?.defPenalty  ?? 0;
    return this.baseDef
      + (this.equip.armor?.def     ?? 0)
      + (this.equip.accessory?.def ?? 0)
      + barrierBonus
      + ironSkinBonus
      - berserkPenalty;
  }

  get spd(): number {
    const hasteBonus = this.statusEffects.find(e => e.type === 'haste')?.power ?? 0;
    return this.baseSpd + hasteBonus;
  }

  get luk(): number { return this.baseLuk; }

  get totalMaxHP(): number {
    return this.baseMaxHP
      + (this.lv - 1) * (this.hpPerLv + (this.buildBonus?.hpPerLv ?? 0))
      + (this.equip.armor?.maxHp     ?? 0)
      + (this.equip.accessory?.maxHp ?? 0);
  }

  get totalMaxMp(): number {
    return this.baseMp + (this.lv - 1) * this.mpPerLv;
  }

  // ── 装備 ───────────────────────────────────────

  equipItem(item: ItemDef): ItemDef | null {
    const slot = item.slot;
    if (slot === 'consumable') return null;
    const old = this.equip[slot as EquipSlotName];
    this.equip[slot as EquipSlotName] = item;
    this.hp    = Math.min(this.hp, this.totalMaxHP);
    this.maxHP = this.totalMaxHP;
    return old;
  }

  unequipSlot(slot: EquipSlotName): ItemDef | null {
    const old = this.equip[slot];
    if (!old) return null;
    this.equip[slot] = null;
    this.hp    = Math.min(this.hp, this.totalMaxHP);
    this.maxHP = this.totalMaxHP;
    return old;
  }

  addToInventory(item: ItemDef): boolean {
    if (this.inventory.length >= this.maxInventory) return false;
    this.inventory.push(item);
    return true;
  }

  removeFromInventory(index: number): ItemDef | null {
    return this.inventory.splice(index, 1)[0] ?? null;
  }

  useItem(item: ItemDef): number {
    if (item.slot !== 'consumable') return 0;
    const maxH   = this.maxHP;
    const before = this.hp;
    if (item.heal === 'full') {
      this.hp = maxH;
    } else if (item.healMp === 'full') {
      const beforeMp = this.mp;
      this.mp = this.totalMaxMp;
      return this.mp - beforeMp;
    } else if (item.healMp) {
      this.mp = Math.min(this.totalMaxMp, this.mp + (item.healMp as number));
      return item.healMp as number;
    } else {
      this.hp = Math.min(maxH, this.hp + ((item.heal as number | undefined) ?? 0));
    }
    return this.hp - before;
  }

  // ── 歩行時 MP 回復 ─────────────────────────────

  onStep(): boolean {
    this._stepsSinceMpRegen++;
    if (this._stepsSinceMpRegen >= 5) {
      this._stepsSinceMpRegen = 0;
      const maxMp = this.totalMaxMp;
      if (this.mp < maxMp) {
        this.mp = Math.min(maxMp, this.mp + 1);
        return true;
      }
    }
    return false;
  }

  // ── ターン終了時：状態異常処理 ─────────────────

  tickStatusEffects(
    onHeal?:   (amount: number) => void,
    onPoison?: (amount: number) => void,
  ): void {
    for (const ef of this.statusEffects) {
      if (ef.type === 'regen') {
        const healed = Math.min(ef.power ?? 0, this.totalMaxHP - this.hp);
        if (healed > 0) { this.hp += healed; onHeal?.(healed); }
      }
      if (ef.type === 'poison') {
        const dmg = ef.power ?? 1;
        this.hp = Math.max(1, this.hp - dmg);
        onPoison?.(dmg);
      }
      ef.turnsLeft = (ef.turnsLeft ?? 1) - 1;
    }
    this.statusEffects = this.statusEffects.filter(e => (e.turnsLeft ?? 0) > 0);
  }

  // ── 魔法習得 ────────────────────────────────────

  learnSpell(spellId: string): boolean {
    if (!this.spells.includes(spellId)) {
      this.spells.push(spellId);
      return true;
    }
    return false;
  }

  // ── 経験値・レベルアップ ──────────────────────

  gainExp(amount: number): number[] {
    this.exp += amount;
    const gained: number[] = [];
    while (this.exp >= this.expNext) {
      this.exp      -= this.expNext;
      this.lv       += 1;
      this.expNext   = Math.floor(this.expNext * 1.5);
      const bb = this.buildBonus;
      this.baseAtk  += this.atkPerLv  + (bb.atkPerLv  ?? 0);
      this.baseDef  += this.defPerLv  + (bb.defPerLv  ?? 0);
      this.baseMp   += (bb.mpPerLv    ?? 0);
      const spdEvery = bb.spdEvery ?? 0;
      this.baseSpd  += (this.lv % 5 === 0 ? 1 : 0)
                     + (spdEvery > 0 && this.lv % spdEvery === 0 ? 1 : 0);
      const lukEvery = bb.lukEvery ?? 0;
      this.baseLuk  += (this.lv % 4 === 0 ? 1 : 0)
                     + (lukEvery > 0 && this.lv % lukEvery === 0 ? 1 : 0);
      this.maxHP     = this.totalMaxHP;
      this.hp        = this.maxHP;
      this.mp        = this.totalMaxMp;
      gained.push(this.lv);
    }
    return gained;
  }

  // ── 描画 ───────────────────────────────────────

  draw(
    ctx:      CanvasRenderingContext2D,
    sprites:  SpriteManager,
    camOffX:  number,
    camOffY:  number,
  ): void {
    if (!this.alive) return;

    const { sx, sy } = this.screenPos(camOffX, camOffY);

    let spriteName = 'player_front';
    if (this.dirY < 0 && this.dirX === 0) {
      spriteName = 'player_back';
    } else if (this.dirX !== 0) {
      spriteName = 'player_side';
    }

    ctx.save();

    if (this.statusEffects.some(e => e.type === 'haste')) {
      ctx.shadowColor = 'rgba(250,204,21,0.9)';
      ctx.shadowBlur  = 16;
    } else if (this.statusEffects.some(e => e.type === 'barrier')) {
      ctx.shadowColor = 'rgba(147,197,253,0.9)';
      ctx.shadowBlur  = 16;
    } else if (this.equip?.weapon?.color) {
      ctx.shadowColor = this.equip.weapon.color;
      ctx.shadowBlur  = 12;
    } else if (this.equip?.armor?.color) {
      ctx.shadowColor = this.equip.armor.color;
      ctx.shadowBlur  = 10;
    } else {
      ctx.shadowColor = 'rgba(180,210,255,0.6)';
      ctx.shadowBlur  = 6;
    }

    if (sprites.get(spriteName)) {
      if (this.dirX < 0) {
        ctx.translate(sx, sy);
        ctx.scale(-1, 1);
        sprites.draw(ctx, 'player_side', 0, 0, SZ, SZ);
      } else {
        sprites.draw(ctx, spriteName, sx, sy, SZ, SZ);
      }
    } else {
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(sx - SZ / 2, sy - SZ / 2, SZ, SZ);
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // ── 装備アイコン ───────────────────────────────
    {
      const slots    = ['weapon', 'armor', 'accessory'] as EquipSlotName[];
      const equipped = slots.map(s => this.equip?.[s]).filter((i): i is ItemDef => i !== null);
      if (equipped.length > 0) {
        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';

        const cellW  = 20;
        const cellH  = 20;
        const pad    = 2;
        const totalW = equipped.length * cellW + (equipped.length - 1) * pad;
        const baseY  = sy + SZ / 2 + 6;
        const startX = sx - totalW / 2 + cellW / 2;

        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        const rx = sx - totalW / 2 - 2;
        const ry = baseY - cellH / 2 - 2;
        const rw = totalW + 4;
        const rh = cellH + 4;
        const rr = 4;
        ctx.beginPath();
        ctx.moveTo(rx + rr, ry);
        ctx.lineTo(rx + rw - rr, ry);
        ctx.arcTo(rx + rw, ry, rx + rw, ry + rr, rr);
        ctx.lineTo(rx + rw, ry + rh - rr);
        ctx.arcTo(rx + rw, ry + rh, rx + rw - rr, ry + rh, rr);
        ctx.lineTo(rx + rr, ry + rh);
        ctx.arcTo(rx, ry + rh, rx, ry + rh - rr, rr);
        ctx.lineTo(rx, ry + rr);
        ctx.arcTo(rx, ry, rx + rr, ry, rr);
        ctx.closePath();
        ctx.fill();

        equipped.forEach((item, i) => {
          const ix = startX + i * (cellW + pad);
          const iy = baseY;

          ctx.fillStyle   = (item.color ?? '#64748b') + '44';
          ctx.strokeStyle = (item.color ?? '#94a3b8') + 'aa';
          ctx.lineWidth   = 1;
          ctx.beginPath();
          ctx.roundRect(ix - cellW / 2, iy - cellH / 2, cellW, cellH, 3);
          ctx.fill();
          ctx.stroke();

          ctx.font      = '13px serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(item.icon, ix, iy);
        });

        ctx.restore();
      }
    }

    ctx.restore();

    _drawHPBar(ctx, sx, sy - SZ / 2 - 8,  SZ, this.hp, this.maxHP,      '#34d399');
    _drawHPBar(ctx, sx, sy - SZ / 2 - 15, SZ, this.mp, this.totalMaxMp, '#818cf8');
  }
}

// ── 共通 HP バー ────────────────────────────────

export function _drawHPBar(
  ctx:   CanvasRenderingContext2D,
  cx:    number,
  barY:  number,
  width: number,
  hp:    number,
  maxHP: number,
  color: string,
): void {
  const bw = width;
  const bh = 5;
  const bx = cx - bw / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(bx - 1, barY - 1, bw + 2, bh + 2);
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(bx, barY, bw, bh);
  ctx.fillStyle = color;
  ctx.fillRect(bx, barY, bw * Math.max(0, hp / maxHP), bh);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(bx, barY, bw * Math.max(0, hp / maxHP), bh / 2);
}
