import { describe, it, expect } from 'vitest';
import {
  ITEMS,
  randomDrop,
  chestDrop,
  treasureDrop,
  itemStatText,
  type ItemDef,
  type Tier,
} from '../../src/data/equipment.js';

describe('ITEMS', () => {

  it('すべてのアイテムに必須フィールドがある', () => {
    for (const [key, item] of Object.entries(ITEMS)) {
      expect(item.id,    `${key}.id`).toBe(key);
      expect(item.name,  `${key}.name`).toBeTypeOf('string');
      expect(item.icon,  `${key}.icon`).toBeTypeOf('string');
      expect(item.color, `${key}.color`).toBeTypeOf('string');
      expect(['consumable', 'weapon', 'armor', 'accessory']).toContain(item.slot);
      expect([0, 1, 2, 3]).toContain(item.tier);
    }
  });

  it('武器・防具は durability を持つ', () => {
    const equipped = Object.values(ITEMS).filter(i => i.slot === 'weapon' || i.slot === 'armor');
    for (const item of equipped) {
      expect(item.durability,    `${item.id}.durability`).toBeTypeOf('number');
      expect(item.maxDurability, `${item.id}.maxDurability`).toBeTypeOf('number');
      expect(item.durability).toBe(item.maxDurability);  // 未使用は満タン
    }
  });

  it('アクセサリーは耐久値を持たない', () => {
    const accessories = Object.values(ITEMS).filter(i => i.slot === 'accessory');
    for (const item of accessories) {
      expect(item.durability).toBeUndefined();
    }
  });

});

describe('randomDrop', () => {

  it('フロア1でtier0のアイテムだけ返す（1000回）', () => {
    const results = Array.from({ length: 1000 }, () => randomDrop(1, 1)); // lukBonus=1で必ずドロップ
    const nonNull = results.filter((r): r is ItemDef => r !== null);
    expect(nonNull.length).toBeGreaterThan(0);
    for (const item of nonNull) {
      expect(item.tier).toBe(0);
    }
  });

  it('lukBonus=0なら約42%のドロップ率', () => {
    const n    = 10000;
    const hits = Array.from({ length: n }, () => randomDrop(1, 0)).filter(r => r !== null).length;
    expect(hits / n).toBeGreaterThan(0.30);
    expect(hits / n).toBeLessThan(0.55);
  });

  it('深いフロアでは高tierアイテムが出る（フロア20）', () => {
    const results = Array.from({ length: 500 }, () => randomDrop(20, 1)).filter((r): r is ItemDef => r !== null);
    const maxTier = Math.max(...results.map(r => r.tier)) as Tier;
    expect(maxTier).toBeGreaterThan(0);
  });

  it('返すのは元データのコピーであること', () => {
    const drop = randomDrop(1, 1);
    if (drop) {
      drop.name = '改ざん';
      const id = drop.id;
      expect(ITEMS[id].name).not.toBe('改ざん');
    }
  });

});

describe('chestDrop', () => {

  it('必ず ItemDef を返す（null にならない）', () => {
    for (let i = 0; i < 100; i++) {
      const drop = chestDrop(1);
      expect(drop).not.toBeNull();
      expect(drop.id).toBeTypeOf('string');
    }
  });

  it('フロア1では tier2+ が出ない', () => {
    const drops = Array.from({ length: 500 }, () => chestDrop(1));
    for (const d of drops) {
      expect(d.tier).toBeLessThanOrEqual(1);
    }
  });

});

describe('itemStatText', () => {

  it('ヒールアイテムは HP+n を返す', () => {
    expect(itemStatText(ITEMS['herb'])).toBe('HP+5');
  });

  it('エリクサーは HP全回復 を返す', () => {
    expect(itemStatText(ITEMS['elixir'])).toBe('HP全回復');
  });

  it('マナ薬は MP+n を返す', () => {
    expect(itemStatText(ITEMS['ether_sm'])).toBe('MP+8');
  });

  it('武器は ATK と耐久を含む', () => {
    const text = itemStatText(ITEMS['dagger']);
    expect(text).toContain('ATK+2');
    expect(text).toContain('耐久');
  });

  it('竜の剣は吸血を含む', () => {
    const text = itemStatText(ITEMS['sword_dragon']);
    expect(text).toContain('吸血30%');
  });

  it('巻物は魔法IDを返す', () => {
    expect(itemStatText(ITEMS['scroll_fire'])).toBe('魔法: fireball');
  });

});
