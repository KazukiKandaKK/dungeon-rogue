import { describe, it, expect } from 'vitest';
import { CLASSES, CLASS_IDS, type ClassId } from '../../src/data/classes.js';

describe('CLASSES', () => {

  it('CLASS_IDS の全職業が CLASSES に存在する', () => {
    for (const id of CLASS_IDS) {
      expect(CLASSES[id]).toBeDefined();
      expect(CLASSES[id].id).toBe(id);
    }
  });

  it('各職業に必須フィールドがある', () => {
    for (const id of CLASS_IDS) {
      const c = CLASSES[id];
      expect(c.name).toBeTypeOf('string');
      expect(c.icon).toBeTypeOf('string');
      expect(c.baseAtk).toBeTypeOf('number');
      expect(c.baseDef).toBeTypeOf('number');
      expect(c.baseHP).toBeGreaterThan(0);
      expect(c.baseMp).toBeGreaterThan(0);
      expect(c.startSpells.length).toBeGreaterThan(0);
    }
  });

  it('spellProgression のキーは正の整数', () => {
    for (const id of CLASS_IDS) {
      const prog = CLASSES[id].spellProgression;
      for (const [lvStr, spells] of Object.entries(prog)) {
        const lv = Number(lvStr);
        expect(lv).toBeGreaterThan(1);  // Lv1 習得なし（スタートスペルで代替）
        expect(Array.isArray(spells)).toBe(true);
        expect(spells.length).toBeGreaterThan(0);
      }
    }
  });

  it('魔法士は最もMPが高い', () => {
    const mages   = CLASSES['mage'].baseMp;
    const others  = (CLASS_IDS as ClassId[])
      .filter(id => id !== 'mage')
      .map(id => CLASSES[id].baseMp);
    expect(mages).toBeGreaterThan(Math.max(...others));
  });

  it('盗賊は最も素早さが高い', () => {
    const rogueSpd  = CLASSES['rogue'].baseSpd;
    const otherSpd  = (CLASS_IDS as ClassId[])
      .filter(id => id !== 'rogue')
      .map(id => CLASSES[id].baseSpd);
    expect(rogueSpd).toBeGreaterThan(Math.max(...otherSpd));
  });

  it('守護者は最もHPが高い', () => {
    const guardianHp = CLASSES['guardian'].baseHP;
    const otherHp    = (CLASS_IDS as ClassId[])
      .filter(id => id !== 'guardian')
      .map(id => CLASSES[id].baseHP);
    expect(guardianHp).toBeGreaterThan(Math.max(...otherHp));
  });

});
