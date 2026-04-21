// ─────────────────────────────────────────────
// player.ts  Player クラス（ターン制・パラメータ・装備システム）
// ─────────────────────────────────────────────

import { Actor }             from './actor.js';
import { TILE_SIZE }         from '../world/tiles.js';
import { CLASSES }           from '../data/classes.js';
import type { ClassId }      from '../data/classes.js';
import type { ItemDef }      from '../data/equipment.js';
import { ARMOR_SLOTS }        from '../data/equipment.js';
import type { StatusEffectEntry, SpriteManager } from '../types.js';
import { APPEARANCES, APPEARANCE_IDS } from '../data/appearances.js';
import type { SpeciesTraits } from '../data/appearances.js';

const EMPTY_TRAITS: SpeciesTraits = {};

// ── 型定義 ────────────────────────────────────

export interface BuildBonus {
  atkPerLv: number;
  defPerLv: number;
  hpPerLv:  number;
  mpPerLv:  number;
  spdEvery: number;
  lukEvery: number;
}

type EquipSlotName = 'weapon' | 'head' | 'chest' | 'waist' | 'legs' | 'accessory';

export interface Appearance {
  species: string;  // APPEARANCE_IDS のいずれか
  tint:    string;  // #rrggbb
}

interface Equipment {
  weapon:    ItemDef | null;
  head:      ItemDef | null;
  chest:     ItemDef | null;
  waist:     ItemDef | null;
  legs:      ItemDef | null;
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
  /** 採掘で得た石（マイクラ風素材）。石の壁を1つ建てるのに1個使用 */
  stones: number;
  /** 伐採で得た木材。木の壁を1つ建てるのに1個使用 */
  wood: number;

  equip:        Equipment;
  inventory:    ItemDef[];
  maxInventory: number;

  /** キャラクリで選んだ見た目。未指定なら SVG スプライトを使う。 */
  appearance: Appearance | null;

  constructor(tx: number, ty: number, classType: ClassId = 'warrior', buildBonus: BuildBonus | null = null, appearance: Appearance | null = null) {
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

    this.gold   = 0;
    this.stones = 0;
    this.wood   = 0;

    this.equip        = { weapon: null, head: null, chest: null, waist: null, legs: null, accessory: null };
    this.inventory    = [];
    this.maxInventory = 40;

    this.appearance = appearance;
  }

  // ── 計算済みステータス ─────────────────────────

  /** 種族特性。appearance 未指定なら空オブジェクトを返す。 */
  get traits(): SpeciesTraits {
    if (!this.appearance) return EMPTY_TRAITS;
    return APPEARANCES[this.appearance.species]?.traits ?? EMPTY_TRAITS;
  }

  get atk(): number {
    const atkBuff = (this.statusEffects.find(e => e.type === 'war_cry')?.power  ?? 0)
                  + (this.statusEffects.find(e => e.type === 'berserk')?.power  ?? 0);
    return this.baseAtk
      + (this.equip.weapon?.atk    ?? 0)
      + (this.equip.accessory?.atk ?? 0)
      + atkBuff
      + (this.traits.atkBonus ?? 0);
  }

  get def(): number {
    const barrierBonus   = this.statusEffects.find(e => e.type === 'barrier')?.power      ?? 0;
    const ironSkinBonus  = this.statusEffects.find(e => e.type === 'iron_skin')?.power     ?? 0;
    const berserkPenalty = this.statusEffects.find(e => e.type === 'berserk')?.defPenalty  ?? 0;
    let armorDef = 0;
    for (const s of ARMOR_SLOTS) armorDef += (this.equip[s]?.def ?? 0);
    return this.baseDef
      + armorDef
      + (this.equip.accessory?.def ?? 0)
      + barrierBonus
      + ironSkinBonus
      - berserkPenalty
      + (this.traits.defBonus ?? 0);
  }

  get spd(): number {
    const hasteBonus = this.statusEffects.find(e => e.type === 'haste')?.power ?? 0;
    return this.baseSpd + hasteBonus + (this.traits.spdBonus ?? 0);
  }

  get luk(): number { return this.baseLuk; }

  get totalMaxHP(): number {
    let armorHp = 0;
    for (const s of ARMOR_SLOTS) armorHp += (this.equip[s]?.maxHp ?? 0);
    return this.baseMaxHP
      + (this.lv - 1) * (this.hpPerLv + (this.buildBonus?.hpPerLv ?? 0))
      + armorHp
      + (this.equip.accessory?.maxHp ?? 0)
      + (this.traits.hpBonus ?? 0);
  }

  /** 被ダメ倍率を取得する（属性ごとの種族耐性／弱点を反映）。 */
  damageRecvMul(kind: 'phys' | 'fire' = 'phys'): number {
    const t = this.traits;
    if (kind === 'fire') return t.fireRecv ?? 1;
    return t.physRecv ?? 1;
  }

  get totalMaxMp(): number {
    return this.baseMp + (this.lv - 1) * this.mpPerLv;
  }

  // ── 装備 ───────────────────────────────────────

  equipItem(item: ItemDef): ItemDef | null {
    const slot = item.slot;
    if (slot === 'consumable') return null;
    // 装備した瞬間に自動鑑定（呪いの存在も判明する）
    item.identified = true;
    const old = this.equip[slot as EquipSlotName];
    // 既存装備が呪いだったら外れない
    if (old && old.cursed) return null;
    this.equip[slot as EquipSlotName] = item;
    this.hp    = Math.min(this.hp, this.totalMaxHP);
    this.maxHP = this.totalMaxHP;
    return old;
  }

  unequipSlot(slot: EquipSlotName): ItemDef | null {
    const old = this.equip[slot];
    if (!old) return null;
    if (old.cursed) return null;  // 呪いは外せない
    this.equip[slot] = null;
    this.hp    = Math.min(this.hp, this.totalMaxHP);
    this.maxHP = this.totalMaxHP;
    return old;
  }

  /** 全装備の呪いを解く（浄化の巻物） */
  uncurseAll(): number {
    let n = 0;
    for (const s of ['weapon', ...ARMOR_SLOTS, 'accessory'] as EquipSlotName[]) {
      const it = this.equip[s];
      if (it && it.cursed) {
        it.cursed = false;
        n++;
      }
    }
    return n;
  }

  /** インベントリ全体を鑑定する（鑑定の巻物） */
  identifyAll(): number {
    let n = 0;
    for (const it of this.inventory) {
      if (it.slot !== 'consumable' && !it.identified) {
        it.identified = true;
        n++;
      }
    }
    return n;
  }

  /**
   * アイテムをインベントリに追加する。
   * 消耗品（slot === 'consumable'）は同じ id があれば個数加算（スタック）。
   * 装備品は耐久値などが異なるため常に新規スロットを使う。
   */
  addToInventory(item: ItemDef): boolean {
    const addCount = item.count ?? 1;
    if (item.slot === 'consumable') {
      const existing = this.inventory.find(
        i => i.slot === 'consumable' && i.id === item.id,
      );
      if (existing) {
        existing.count = (existing.count ?? 1) + addCount;
        return true;
      }
    }
    if (this.inventory.length >= this.maxInventory) return false;
    this.inventory.push({ ...item, count: addCount });
    return true;
  }

  /**
   * スロットから1個取り出す。スタック >1 のときは個数を1減らしてスロットを残す。
   * 返り値の item は常に count=1 のコピー。
   */
  removeFromInventory(index: number): ItemDef | null {
    const it = this.inventory[index];
    if (!it) return null;
    const c = it.count ?? 1;
    if (c > 1) {
      it.count = c - 1;
      return { ...it, count: 1 };
    }
    return this.inventory.splice(index, 1)[0] ?? null;
  }

  useItem(item: ItemDef): number {
    if (item.slot !== 'consumable') return 0;
    // 鑑定 / 浄化の巻物（戻り値は対象数）
    if (item.identifyScroll) return this.identifyAll();
    if (item.uncurseScroll)  return this.uncurseAll();
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
      // ちびロボ：HP回復薬の効果半減
      const heal0 = (item.heal as number | undefined) ?? 0;
      const mul   = this.traits.hpHealMul ?? 1;
      const heal  = Math.max(0, Math.floor(heal0 * mul));
      this.hp = Math.min(maxH, this.hp + heal);
    }
    return this.hp - before;
  }

  // ── 歩行時 MP 回復 ─────────────────────────────

  onStep(): boolean {
    this._stepsSinceMpRegen++;
    const stepsNeeded = this.traits.mpRegenSteps ?? 5;
    if (this._stepsSinceMpRegen >= stepsNeeded) {
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
    const t = this.traits;
    for (const ef of this.statusEffects) {
      if (ef.type === 'regen') {
        const healed = Math.min(ef.power ?? 0, this.totalMaxHP - this.hp);
        if (healed > 0) { this.hp += healed; onHeal?.(healed); }
      }
      if (ef.type === 'poison') {
        if (t.poisonImmune) continue;
        const dmg = ef.power ?? 1;
        this.hp = Math.max(1, this.hp - dmg);
        onPoison?.(dmg);
      }
      if (ef.type === 'burn') {
        const dmg = ef.power ?? 2;
        this.hp = Math.max(1, this.hp - dmg);
        onPoison?.(dmg);
      }
      ef.turnsLeft = (ef.turnsLeft ?? 1) - 1;
    }
    this.statusEffects = this.statusEffects.filter(e => (e.turnsLeft ?? 0) > 0);
    if (t.poisonImmune) {
      this.statusEffects = this.statusEffects.filter(e => e.type !== 'poison');
    }
    if (t.passiveRegen && this.hp < this.totalMaxHP) {
      this.hp += 1;
      onHeal?.(1);
    }
  }

  // ── 魔法習得 ────────────────────────────────────

  learnSpell(spellId: string): boolean {
    if (!this.spells.includes(spellId)) {
      this.spells.push(spellId);
      return true;
    }
    return false;
  }

  // ── 転職 ─────────────────────────────────────
  /**
   * 職業を変更する。レベル・経験値・装備・インベントリ・所持金（変更前後で別途コスト処理）は保持し、
   * baseAtk / baseDef / baseMp / hpPerLv などの成長係数を新職業の数値で再計算する。
   * spells は新職業の startSpells + 現在レベル以下の progression をすべて習得した状態に置き換える。
   * HP / MP は新しい最大値まで全回復。
   */
  reclassTo(newClassId: ClassId): boolean {
    const cls = CLASSES[newClassId];
    if (!cls) return false;
    if (this.classType === newClassId) return false;

    const bb = this.buildBonus;
    const lv = this.lv;

    this.classType = newClassId;
    this.atkPerLv  = cls.atkPerLv;
    this.defPerLv  = cls.defPerLv;
    this.hpPerLv   = cls.hpPerLv;
    this.mpPerLv   = cls.mpPerLv ?? 1;
    this.baseMaxHP = cls.baseHP;

    // 累積ステータス再計算（初期値 + レベル成長 + ビルドボーナス累積）
    this.baseAtk = cls.baseAtk + (lv - 1) * (cls.atkPerLv + (bb.atkPerLv ?? 0));
    this.baseDef = cls.baseDef + (lv - 1) * (cls.defPerLv + (bb.defPerLv ?? 0));
    this.baseMp  = (cls.baseMpMax ?? 10) + (lv - 1) * (bb.mpPerLv ?? 0);

    // SPD / LUK はレベルアップ時の累積ボーナスを再現
    let spd = cls.baseSpd ?? 0;
    let luk = cls.baseLuk ?? 0;
    const spdEvery = bb.spdEvery ?? 0;
    const lukEvery = bb.lukEvery ?? 0;
    for (let l = 2; l <= lv; l++) {
      if (l % 5 === 0) spd += 1;
      if (spdEvery > 0 && l % spdEvery === 0) spd += 1;
      if (l % 4 === 0) luk += 1;
      if (lukEvery > 0 && l % lukEvery === 0) luk += 1;
    }
    this.baseSpd = spd;
    this.baseLuk = luk;

    // スペルを新職業で置き換え
    const learned: string[] = [...(cls.startSpells ?? [])];
    const prog = cls.spellProgression ?? {};
    for (const key of Object.keys(prog)) {
      const at = Number(key);
      if (at <= lv) {
        for (const s of prog[at] ?? []) {
          if (!learned.includes(s)) learned.push(s);
        }
      }
    }
    this.spells = learned;

    // HP/MP を新しい最大値まで全回復
    this.maxHP = this.totalMaxHP;
    this.hp    = this.maxHP;
    this.mp    = this.totalMaxMp;

    return true;
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
    } else if (this.equip?.chest?.color) {
      ctx.shadowColor = this.equip.chest.color;
      ctx.shadowBlur  = 10;
    } else {
      ctx.shadowColor = 'rgba(180,210,255,0.6)';
      ctx.shadowBlur  = 6;
    }

    // アクセサリのマント（スプライトの後ろ側）
    if (this.equip.accessory) {
      this._drawAccessoryCape(ctx, sx, sy, spriteName);
    }

    if (this.appearance && APPEARANCES[this.appearance.species]) {
      // キャラクリで選んだ見た目（procedural）
      const def = APPEARANCES[this.appearance.species];
      const facing: 'front' | 'back' | 'side' =
        spriteName === 'player_back' ? 'back' :
        spriteName === 'player_side' ? 'side' : 'front';
      // 歩行アイドル位相（歩行中はテンポよく、停止時はゆっくり揺れる）
      const moving = Math.abs(this.bumpX) + Math.abs(this.bumpY) > 0.01;
      const speed  = moving ? 1.6 : 0.7;
      const phase  = ((Date.now() * 0.001 * speed) % 1 + 1) % 1;
      def.draw(ctx, sx, sy, SZ, facing, this.appearance.tint, phase, this.dirX);
    } else if (sprites.get(spriteName)) {
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

    // 装備スキンのオーバーレイ（スプライトの上に鎧・兜・武器などを重ねる）
    this._drawEquipmentSkin(ctx, sx, sy, spriteName, this.dirX);

    // ── 武器振り抜きアーク（攻撃時のみ） ───────────
    if (this.swipeTime > 0 && this.swipeMax > 0) {
      const t = 1 - this.swipeTime / this.swipeMax; // 0 → 1
      const baseAngle = Math.atan2(this.swipeDirY, this.swipeDirX);
      const arcSpan   = Math.PI * 0.9;
      const start     = baseAngle - arcSpan / 2 + arcSpan * t;
      const end       = start + arcSpan * 0.35;
      const radius    = SZ * 0.55;
      const alpha     = Math.sin(t * Math.PI); // 0 → 1 → 0
      const color     = this.equip?.weapon?.color ?? '#e0e7ff';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 5;
      ctx.lineCap     = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur  = 14;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, start, end);
      ctx.stroke();
      // 白い芯
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 2;
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, start, end);
      ctx.stroke();
      ctx.restore();
    }

    // ── 装備アイコン ───────────────────────────────
    {
      const slots    = ['weapon', 'head', 'chest', 'waist', 'legs', 'accessory'] as EquipSlotName[];
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

          // スプライト優先（14px 程度の小さなバッジ）、未ロードなら絵文字
          ctx.fillStyle = '#ffffff';
          if (item.spriteName && sprites.get(item.spriteName)) {
            sprites.draw(ctx, item.spriteName, ix, iy, 14, 14);
          } else {
            ctx.font = '13px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.icon, ix, iy);
          }
        });

        ctx.restore();
      }
    }

    ctx.restore();

    _drawHPBar(ctx, sx, sy - SZ / 2 - 8,  SZ, this.hp, this.maxHP,      '#34d399', this.displayHp);
    _drawHPBar(ctx, sx, sy - SZ / 2 - 15, SZ, this.mp, this.totalMaxMp, '#818cf8');
  }

  // ─── 装備スキンのオーバーレイ ─────────────────
  // 装備アイテムの色・ティア・名前（武器種判定）に応じて、スプライトの上に
  // 兜・胸当て・ベルト・脛当て・武器などを procedural に描画する。
  private _drawEquipmentSkin(
    ctx: CanvasRenderingContext2D,
    sx:  number,
    sy:  number,
    spriteName: string,
    dirX: number,
  ): void {
    const s = SZ;
    const facing: 'front' | 'back' | 'side' =
      spriteName === 'player_back' ? 'back' :
      spriteName === 'player_side' ? 'side' : 'front';
    const handSign = facing === 'side' ? (dirX >= 0 ? 1 : -1) : 1;

    // ── 脛当て & ブーツ（legs） ──
    if (this.equip.legs) {
      const c = this.equip.legs.color ?? '#475569';
      const tier = this.equip.legs.tier ?? 0;
      ctx.save();
      ctx.shadowColor = c; ctx.shadowBlur = 4;
      ctx.fillStyle = c + 'd8';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1;
      // 左脚
      ctx.fillRect(sx - s * 0.14, sy + s * 0.14, s * 0.1, s * 0.17);
      ctx.strokeRect(sx - s * 0.14, sy + s * 0.14, s * 0.1, s * 0.17);
      // 右脚
      ctx.fillRect(sx + s * 0.04, sy + s * 0.14, s * 0.1, s * 0.17);
      ctx.strokeRect(sx + s * 0.04, sy + s * 0.14, s * 0.1, s * 0.17);
      // 膝飾り（tier ≥ 2）
      if (tier >= 2) {
        ctx.fillStyle = '#fde68a';
        ctx.beginPath(); ctx.arc(sx - s * 0.09, sy + s * 0.2, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + s * 0.09, sy + s * 0.2, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      // ブーツ
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(sx - s * 0.15, sy + s * 0.31, s * 0.12, s * 0.05);
      ctx.fillRect(sx + s * 0.03, sy + s * 0.31, s * 0.12, s * 0.05);
      ctx.fillStyle = '#44403c';
      ctx.fillRect(sx - s * 0.15, sy + s * 0.34, s * 0.12, s * 0.02);
      ctx.fillRect(sx + s * 0.03, sy + s * 0.34, s * 0.12, s * 0.02);
      ctx.restore();
    }

    // ── 胸当て（chest） ──
    if (this.equip.chest) {
      const c = this.equip.chest.color ?? '#94a3b8';
      const tier = this.equip.chest.tier ?? 0;
      const name = this.equip.chest.name ?? '';
      const isRobe = /ローブ|robe|法衣/i.test(name);
      ctx.save();
      ctx.shadowColor = c; ctx.shadowBlur = 6;
      ctx.fillStyle = c + 'd8';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1.2;
      const cy = sy - s * 0.02;
      if (isRobe) {
        // ローブ（裾が広がる）
        ctx.beginPath();
        ctx.moveTo(sx - s * 0.17, cy - s * 0.09);
        ctx.lineTo(sx + s * 0.17, cy - s * 0.09);
        ctx.lineTo(sx + s * 0.22, cy + s * 0.14);
        ctx.lineTo(sx - s * 0.22, cy + s * 0.14);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // 襟
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(sx - s * 0.07, cy - s * 0.09);
        ctx.lineTo(sx, cy - s * 0.03);
        ctx.lineTo(sx + s * 0.07, cy - s * 0.09);
        ctx.closePath();
        ctx.fill();
      } else {
        // 胸当て（プレート）
        ctx.beginPath();
        ctx.moveTo(sx - s * 0.16, cy - s * 0.09);
        ctx.lineTo(sx + s * 0.16, cy - s * 0.09);
        ctx.lineTo(sx + s * 0.19, cy + s * 0.1);
        ctx.lineTo(sx - s * 0.19, cy + s * 0.1);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // 中央のライン
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.moveTo(sx, cy - s * 0.09); ctx.lineTo(sx, cy + s * 0.1); ctx.stroke();
        // 肩パッド（tier ≥ 2）
        if (tier >= 2) {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.ellipse(sx - s * 0.19, cy - s * 0.06, s * 0.06, s * 0.045, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(sx + s * 0.19, cy - s * 0.06, s * 0.06, s * 0.045, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // 中央エンブレム（tier ≥ 1）
      if (tier >= 1) {
        ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 6;
        ctx.fillStyle = '#fde68a';
        ctx.beginPath(); ctx.arc(sx, cy, 2.8, 0, Math.PI * 2); ctx.fill();
      }
      // tier 3 の追加輝き
      if (tier >= 3) {
        ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(sx, cy, 5.5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }

    // ── ベルト（waist） ──
    if (this.equip.waist) {
      const c = this.equip.waist.color ?? '#78350f';
      ctx.save();
      ctx.fillStyle = c;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.fillRect(sx - s * 0.2, sy + s * 0.08, s * 0.4, s * 0.045);
      ctx.strokeRect(sx - s * 0.2, sy + s * 0.08, s * 0.4, s * 0.045);
      // バックル
      ctx.fillStyle = '#fde68a';
      ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 4;
      ctx.fillRect(sx - 5, sy + s * 0.087, 10, s * 0.029);
      ctx.restore();
    }

    // ── 兜・フード・帽子（head） ──
    if (this.equip.head) {
      const c = this.equip.head.color ?? '#94a3b8';
      const tier = this.equip.head.tier ?? 0;
      const name = this.equip.head.name ?? '';
      const isHood   = /フード|hood|帽子|ハット|hat/i.test(name);
      const isCrown  = /王冠|crown|ティアラ|tiara/i.test(name);
      const isHorned = /角|horn|兜/i.test(name);
      ctx.save();
      ctx.shadowColor = c; ctx.shadowBlur = 7;
      ctx.fillStyle = c;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5;
      const hx = sx, hy = sy - s * 0.32;
      if (isCrown) {
        // 王冠
        ctx.beginPath();
        ctx.moveTo(hx - s * 0.18, hy + s * 0.06);
        ctx.lineTo(hx - s * 0.18, hy - s * 0.02);
        ctx.lineTo(hx - s * 0.10, hy + s * 0.02);
        ctx.lineTo(hx - s * 0.06, hy - s * 0.1);
        ctx.lineTo(hx,             hy);
        ctx.lineTo(hx + s * 0.06, hy - s * 0.1);
        ctx.lineTo(hx + s * 0.10, hy + s * 0.02);
        ctx.lineTo(hx + s * 0.18, hy - s * 0.02);
        ctx.lineTo(hx + s * 0.18, hy + s * 0.06);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.arc(hx, hy + s * 0.01, 3, 0, Math.PI * 2); ctx.fill();
      } else if (isHood) {
        // フード（背中まで伸びる）
        ctx.beginPath();
        ctx.moveTo(hx - s * 0.22, hy + s * 0.16);
        ctx.quadraticCurveTo(hx - s * 0.25, hy - s * 0.02, hx, hy - s * 0.16);
        ctx.quadraticCurveTo(hx + s * 0.25, hy - s * 0.02, hx + s * 0.22, hy + s * 0.16);
        ctx.lineTo(hx + s * 0.12, hy + s * 0.16);
        ctx.quadraticCurveTo(hx, hy - s * 0.04, hx - s * 0.12, hy + s * 0.16);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        // ヘルメット（ドーム＋面頬）
        ctx.beginPath();
        ctx.arc(hx, hy + s * 0.05, s * 0.21, Math.PI, 0);
        ctx.lineTo(hx + s * 0.22, hy + s * 0.13);
        ctx.lineTo(hx - s * 0.22, hy + s * 0.13);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // バイザーの隙間
        if (facing !== 'back') {
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(hx - s * 0.1, hy + s * 0.06, s * 0.2, 2);
          ctx.fillRect(hx - s * 0.03, hy - s * 0.01, s * 0.06, 2);
        }
        // 角（isHorned or tier ≥ 2）
        if (isHorned || tier >= 2) {
          ctx.fillStyle = tier >= 3 ? '#fde68a' : c;
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          // 左角
          ctx.beginPath();
          ctx.moveTo(hx - s * 0.15, hy - s * 0.06);
          ctx.quadraticCurveTo(hx - s * 0.22, hy - s * 0.16, hx - s * 0.1, hy - s * 0.18);
          ctx.quadraticCurveTo(hx - s * 0.1, hy - s * 0.1, hx - s * 0.12, hy - s * 0.04);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
          // 右角
          ctx.beginPath();
          ctx.moveTo(hx + s * 0.15, hy - s * 0.06);
          ctx.quadraticCurveTo(hx + s * 0.22, hy - s * 0.16, hx + s * 0.1, hy - s * 0.18);
          ctx.quadraticCurveTo(hx + s * 0.1, hy - s * 0.1, hx + s * 0.12, hy - s * 0.04);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
        }
      }
      // tier 3 光輪
      if (tier >= 3) {
        ctx.strokeStyle = 'rgba(253,224,71,0.9)';
        ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 10;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(hx, hy - s * 0.18, s * 0.14, s * 0.04, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── 武器（weapon） ──
    if (this.equip.weapon) {
      const c = this.equip.weapon.color ?? '#94a3b8';
      const tier = this.equip.weapon.tier ?? 0;
      const name = this.equip.weapon.name ?? '';
      const isStaff = /杖|staff|wand|ロッド|rod/i.test(name);
      const isBow   = /弓|bow|crossbow/i.test(name);
      const isAxe   = /斧|axe|マサカリ/i.test(name);
      const isDagger = /短剣|dagger|ナイフ|knife/i.test(name);
      ctx.save();
      ctx.shadowColor = c; ctx.shadowBlur = 10;
      const wx = sx + handSign * s * 0.28;
      const wy = sy + s * 0.04;
      if (isStaff) {
        // 杖
        ctx.fillStyle = '#78350f';
        ctx.fillRect(wx - 2, wy - s * 0.3, 4, s * 0.45);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(wx - 2, wy - s * 0.3, 4, s * 0.45);
        // 宝玉
        ctx.fillStyle = c;
        ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(wx, wy - s * 0.33, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 1;
        ctx.stroke();
        // 宝玉ハイライト
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(wx - 2, wy - s * 0.35, 1.5, 0, Math.PI * 2); ctx.fill();
      } else if (isBow) {
        // 弓
        ctx.strokeStyle = c; ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        const bowR = s * 0.25;
        ctx.beginPath();
        ctx.arc(wx, wy, bowR, Math.PI * 0.72, Math.PI * 1.28);
        ctx.stroke();
        // 弦
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
        const y1 = wy + Math.sin(Math.PI * 0.72) * bowR;
        const y2 = wy + Math.sin(Math.PI * 1.28) * bowR;
        const bxE = wx + Math.cos(Math.PI * 0.72) * bowR;
        ctx.beginPath(); ctx.moveTo(bxE, y1); ctx.lineTo(bxE, y2); ctx.stroke();
        // 握り
        ctx.fillStyle = '#78350f';
        ctx.fillRect(wx - handSign * bowR - 2, wy - 4, 5, 8);
      } else if (isAxe) {
        // 斧
        ctx.fillStyle = '#78350f';
        ctx.fillRect(wx - 2, wy - s * 0.3, 4, s * 0.4);
        // 刃（扇形）
        ctx.fillStyle = c;
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wx + handSign * 2, wy - s * 0.26);
        ctx.quadraticCurveTo(wx + handSign * s * 0.13, wy - s * 0.24, wx + handSign * s * 0.12, wy - s * 0.1);
        ctx.lineTo(wx + handSign * 2, wy - s * 0.15);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else if (isDagger) {
        // 短剣
        ctx.fillStyle = c;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wx, wy - s * 0.18);
        ctx.lineTo(wx + 2, wy + s * 0.02);
        ctx.lineTo(wx - 2, wy + s * 0.02);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#78350f';
        ctx.fillRect(wx - 3, wy + s * 0.02, 6, s * 0.06);
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(wx - 5, wy, 10, 2);
      } else {
        // 剣（デフォルト）
        // 刃
        ctx.fillStyle = c;
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1;
        ctx.fillRect(wx - 2, wy - s * 0.3, 4, s * 0.3);
        ctx.strokeRect(wx - 2, wy - s * 0.3, 4, s * 0.3);
        // 刃先
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(wx - 1, wy - s * 0.3, 2, 4);
        // つば
        ctx.fillStyle = tier >= 2 ? '#fde68a' : '#d4a574';
        ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 4;
        ctx.fillRect(wx - 7, wy - 2, 14, 3);
        // 柄
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#78350f';
        ctx.fillRect(wx - 3, wy + 1, 6, s * 0.09);
        // 柄頭
        ctx.fillStyle = c;
        ctx.shadowColor = c; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.arc(wx, wy + s * 0.11, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // ── アクセサリの補助表示（頭上のオーラリング） ──
    if (this.equip.accessory) {
      const c = this.equip.accessory.color ?? '#a855f7';
      const tier = this.equip.accessory.tier ?? 0;
      ctx.save();
      ctx.shadowColor = c; ctx.shadowBlur = 10;
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(Date.now() * 0.004);
      // 頭上の光輪
      ctx.beginPath();
      ctx.ellipse(sx, sy - s * 0.48, s * 0.15, s * 0.04, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (tier >= 2) {
        // 二重リング
        ctx.beginPath();
        ctx.ellipse(sx, sy - s * 0.48, s * 0.19, s * 0.05, 0, 0, Math.PI * 2);
        ctx.globalAlpha *= 0.5;
        ctx.stroke();
      }
      // 浮遊オーブ（アクセサリ色の輝点が頭の周りを回る）
      const t = Date.now() * 0.002;
      const orbN = tier >= 2 ? 3 : 2;
      for (let i = 0; i < orbN; i++) {
        const ang = t + (i / orbN) * Math.PI * 2;
        const ox = sx + Math.cos(ang) * s * 0.28;
        const oy = sy - s * 0.4 + Math.sin(ang) * s * 0.06;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(ox, oy, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  /** アクセサリ（tier ≥ 1）装備時の背面マント */
  private _drawAccessoryCape(
    ctx: CanvasRenderingContext2D,
    sx:  number,
    sy:  number,
    spriteName: string,
  ): void {
    const acc = this.equip.accessory;
    if (!acc) return;
    const tier = acc.tier ?? 0;
    if (tier < 1) return;
    if (spriteName !== 'player_front' && spriteName !== 'player_back') return;
    const c = acc.color ?? '#a855f7';
    const s = SZ;
    ctx.save();
    ctx.shadowColor = c; ctx.shadowBlur = 8;
    const wave = Math.sin(Date.now() * 0.003) * s * 0.02;
    // マント本体
    const mg = ctx.createLinearGradient(sx, sy - s * 0.1, sx, sy + s * 0.4);
    mg.addColorStop(0, c + 'd0');
    mg.addColorStop(1, c + '60');
    ctx.fillStyle = mg;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - s * 0.2, sy - s * 0.1);
    ctx.lineTo(sx + s * 0.2, sy - s * 0.1);
    ctx.quadraticCurveTo(sx + s * 0.24 - wave, sy + s * 0.15, sx + s * 0.14 - wave, sy + s * 0.38);
    ctx.quadraticCurveTo(sx + wave, sy + s * 0.42, sx - s * 0.14 + wave, sy + s * 0.38);
    ctx.quadraticCurveTo(sx - s * 0.24 + wave, sy + s * 0.15, sx - s * 0.2, sy - s * 0.1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 首元の留め金
    ctx.fillStyle = '#fde68a';
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.arc(sx, sy - s * 0.11, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ── 共通 HP バー ────────────────────────────────

export function _drawHPBar(
  ctx:       CanvasRenderingContext2D,
  cx:        number,
  barY:      number,
  width:     number,
  hp:        number,
  maxHP:     number,
  color:     string,
  displayHp: number = hp,
): void {
  const bw = width;
  const bh = 5;
  const bx = cx - bw / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(bx - 1, barY - 1, bw + 2, bh + 2);
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(bx, barY, bw, bh);

  // 残像（白っぽく、現在値より遅れて追従）
  const ghostW = bw * Math.max(0, displayHp / maxHP);
  const hpW    = bw * Math.max(0, hp / maxHP);
  if (ghostW > hpW + 0.5) {
    ctx.fillStyle = 'rgba(250,250,250,0.65)';
    ctx.fillRect(bx + hpW, barY, ghostW - hpW, bh);
  }

  // 現在値
  ctx.fillStyle = color;
  ctx.fillRect(bx, barY, hpW, bh);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(bx, barY, hpW, bh / 2);
}
