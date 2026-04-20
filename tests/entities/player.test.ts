import { describe, it, expect } from 'vitest';
import { Player } from '../../src/entities/player.js';
import { ITEMS }  from '../../src/data/equipment.js';

function makePlayer(classType: 'warrior' | 'guardian' | 'mage' | 'rogue' = 'warrior'): Player {
  return new Player(5, 5, classType);
}

describe('Player', () => {

  describe('コンストラクタ', () => {
    it('戦士の初期値が正しい', () => {
      const p = makePlayer('warrior');
      expect(p.classType).toBe('warrior');
      expect(p.lv).toBe(1);
      expect(p.exp).toBe(0);
      expect(p.alive).toBe(true);
      expect(p.spells).toContain('war_cry');
      expect(p.gold).toBe(0);
      expect(p.inventory).toHaveLength(0);
    });

    it('職業ごとにステータスが異なる', () => {
      const mage    = makePlayer('mage');
      const warrior = makePlayer('warrior');
      expect(mage.baseMp).toBeGreaterThan(warrior.baseMp);
      expect(warrior.baseAtk).toBeGreaterThan(mage.baseAtk);
    });
  });

  describe('atk / def getter（装備込み）', () => {
    it('装備なしは baseAtk と等しい', () => {
      const p = makePlayer('warrior');
      expect(p.atk).toBe(p.baseAtk);
    });

    it('武器装備で atk が増える', () => {
      const p      = makePlayer('warrior');
      const sword  = { ...ITEMS['sword_iron'] };
      p.equipItem(sword);
      expect(p.atk).toBe(p.baseAtk + sword.atk!);
    });

    it('バーサーク中は DEF が下がる', () => {
      const p = makePlayer('warrior');
      const baseDef = p.def;
      p.statusEffects.push({ type: 'berserk', turnsLeft: 5, power: 10, defPenalty: 4 });
      expect(p.def).toBe(baseDef - 4);
    });
  });

  describe('totalMaxHP', () => {
    it('レベルアップで増える（守護者：4/lv）', () => {
      const p  = makePlayer('guardian');
      const h1 = p.totalMaxHP;
      p.lv = 2;
      expect(p.totalMaxHP).toBeGreaterThan(h1);
    });

    it('HP ボーナス装備でさらに増える', () => {
      const p    = makePlayer('warrior');
      const base = p.totalMaxHP;
      p.equipItem({ ...ITEMS['amulet_hp'] }); // maxHp: 8
      expect(p.totalMaxHP).toBe(base + 8);
    });
  });

  describe('equipItem', () => {
    it('武器をセットして古い装備を返す', () => {
      const p     = makePlayer('warrior');
      const dagger = { ...ITEMS['dagger'] };
      const old1   = p.equipItem(dagger);
      expect(old1).toBeNull();        // 最初は空
      const sword = { ...ITEMS['sword_iron'] };
      const old2  = p.equipItem(sword);
      expect(old2?.id).toBe('dagger'); // 前の装備が返る
    });

    it('consumable を渡すと null を返してスロットを変更しない', () => {
      const p    = makePlayer('warrior');
      const herb = { ...ITEMS['herb'] };
      const result = p.equipItem(herb);
      expect(result).toBeNull();
      expect(p.equip.weapon).toBeNull();
    });
  });

  describe('addToInventory / removeFromInventory', () => {
    it('装備品は 40 枠まで追加できる（非スタック）', () => {
      const p = makePlayer('warrior');
      for (let i = 0; i < 40; i++) {
        expect(p.addToInventory({ ...ITEMS['dagger'] })).toBe(true);
      }
      expect(p.addToInventory({ ...ITEMS['dagger'] })).toBe(false);
      expect(p.inventory).toHaveLength(40);
    });

    it('消耗品は同じ ID ならスタックする', () => {
      const p = makePlayer('warrior');
      for (let i = 0; i < 10; i++) {
        expect(p.addToInventory({ ...ITEMS['herb'] })).toBe(true);
      }
      // 1 スロットに 10 個スタック
      expect(p.inventory).toHaveLength(1);
      expect(p.inventory[0]?.id).toBe('herb');
      expect(p.inventory[0]?.count).toBe(10);
    });

    it('インベントリ満杯でも既存スタックへは加算できる', () => {
      const p = makePlayer('warrior');
      // 最初に 1 個だけ herb を入れ、残り 39 枠を別装備で埋める
      p.addToInventory({ ...ITEMS['herb'] });
      for (let i = 0; i < 39; i++) {
        p.addToInventory({ ...ITEMS['dagger'] });
      }
      expect(p.inventory).toHaveLength(40);
      // 満杯だが herb はスタックできる
      expect(p.addToInventory({ ...ITEMS['herb'] })).toBe(true);
      expect(p.inventory[0]?.count).toBe(2);
    });

    it('インデックスで 1 個ずつ取り出せる（スタック減）', () => {
      const p = makePlayer('warrior');
      p.addToInventory({ ...ITEMS['herb'] });
      p.addToInventory({ ...ITEMS['herb'] });
      p.addToInventory({ ...ITEMS['herb'] });
      expect(p.inventory[0]?.count).toBe(3);
      const r1 = p.removeFromInventory(0);
      expect(r1?.id).toBe('herb');
      expect(r1?.count).toBe(1);
      expect(p.inventory[0]?.count).toBe(2);
      p.removeFromInventory(0);
      p.removeFromInventory(0);
      expect(p.inventory).toHaveLength(0);
    });

    it('単発アイテムは従来どおり splice で消える', () => {
      const p = makePlayer('warrior');
      p.addToInventory({ ...ITEMS['dagger'] });
      const removed = p.removeFromInventory(0);
      expect(removed?.id).toBe('dagger');
      expect(p.inventory).toHaveLength(0);
    });
  });

  describe('useItem', () => {
    it('HP 回復アイテムで HP が増える（maxHP でキャップ）', () => {
      const p     = makePlayer('warrior');
      p.hp        = 5;
      const delta = p.useItem({ ...ITEMS['potion_sm'] }); // heal: 12, warrior maxHP: 12
      expect(delta).toBeGreaterThan(0);
      expect(p.hp).toBe(p.maxHP); // min(maxHP, 5+12) = maxHP
    });

    it('HP 全回復アイテム', () => {
      const p = makePlayer('warrior');
      p.hp = 1;
      p.useItem({ ...ITEMS['elixir'] });
      expect(p.hp).toBe(p.maxHP);
    });

    it('装備品を渡すと 0 を返す', () => {
      const p = makePlayer('warrior');
      expect(p.useItem({ ...ITEMS['sword_iron'] })).toBe(0);
    });
  });

  describe('gainExp / レベルアップ', () => {
    it('経験値を溜めるとレベルが上がる', () => {
      const p      = makePlayer('warrior');
      const gained = p.gainExp(10); // expNext は 10
      expect(gained).toEqual([2]);
      expect(p.lv).toBe(2);
    });

    it('レベルアップで HP が全回復する', () => {
      const p = makePlayer('warrior');
      p.hp = 1;
      p.gainExp(10);
      expect(p.hp).toBe(p.maxHP);
    });

    it('複数レベルアップ', () => {
      const p      = makePlayer('warrior');
      const gained = p.gainExp(9999);
      expect(gained.length).toBeGreaterThan(1);
    });
  });

  describe('learnSpell', () => {
    it('新しいスペルを習得する', () => {
      const p = makePlayer('warrior');
      expect(p.learnSpell('fireball')).toBe(true);
      expect(p.spells).toContain('fireball');
    });

    it('既知のスペルを再習得しない', () => {
      const p = makePlayer('warrior');
      p.learnSpell('fireball');
      expect(p.learnSpell('fireball')).toBe(false);
    });
  });

  describe('tickStatusEffects', () => {
    it('リジェネで HP が回復する', () => {
      const p = makePlayer('warrior');
      p.hp = 5;
      p.statusEffects.push({ type: 'regen', turnsLeft: 3, power: 4 });
      let healed = 0;
      p.tickStatusEffects((h) => { healed = h; });
      expect(p.hp).toBe(9);
      expect(healed).toBe(4);
    });

    it('ターン経過で効果が切れる', () => {
      const p = makePlayer('warrior');
      p.statusEffects.push({ type: 'haste', turnsLeft: 1, power: 3 });
      p.tickStatusEffects();
      expect(p.statusEffects).toHaveLength(0);
    });

    it('毒は最低 1HP を残す', () => {
      const p = makePlayer('warrior');
      p.hp = 1;
      p.statusEffects.push({ type: 'poison', turnsLeft: 5, power: 99 });
      p.tickStatusEffects();
      expect(p.hp).toBe(1); // 死なない
    });
  });

});
