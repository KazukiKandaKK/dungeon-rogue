import { describe, it, expect } from 'vitest';
import { Pet, PETS } from '../../src/entities/pet.js';
import type { StatusEffectEntry } from '../../src/types.js';

function makePlayer(tx: number, ty: number) {
  const statusEffects: StatusEffectEntry[] = [];
  return { tx, ty, statusEffects };
}

describe('Pet.maybeBuffPlayer', () => {

  it('チェビシェフ距離 <= 2 の時、対応するバフを新規付与する', () => {
    const pet    = new Pet('dog', 5, 5); // regen
    const player = makePlayer(6, 7); // cheb = max(1,2) = 2
    const res    = pet.maybeBuffPlayer(player);
    expect(res.applied).toBe(true);
    expect(res.buff.type).toBe('regen');
    expect(player.statusEffects).toHaveLength(1);
    expect(player.statusEffects[0].type).toBe('regen');
    expect(player.statusEffects[0].turnsLeft).toBe(PETS.dog.buff.turns);
    expect(player.statusEffects[0].power).toBe(PETS.dog.buff.power);
  });

  it('チェビシェフ距離 > 2 の時は付与しない', () => {
    const pet    = new Pet('cat', 5, 5); // haste
    const player = makePlayer(8, 8);     // cheb = 3
    const res    = pet.maybeBuffPlayer(player);
    expect(res.applied).toBe(false);
    expect(player.statusEffects).toHaveLength(0);
  });

  it('ペットが死亡していると付与しない', () => {
    const pet    = new Pet('gorilla', 5, 5);
    pet.alive    = false;
    const player = makePlayer(5, 5);
    const res    = pet.maybeBuffPlayer(player);
    expect(res.applied).toBe(false);
    expect(player.statusEffects).toHaveLength(0);
  });

  it('同種バフが残り 2 ターン以上あると再付与しない（スパム防止）', () => {
    const pet    = new Pet('slime', 5, 5); // barrier power=2
    const player = makePlayer(5, 5);
    player.statusEffects.push({ type: 'barrier', turnsLeft: 5, power: 2 });
    const res = pet.maybeBuffPlayer(player);
    expect(res.applied).toBe(false);
    expect(player.statusEffects).toHaveLength(1);
    expect(player.statusEffects[0].turnsLeft).toBe(5);
  });

  it('同種バフが残り 1 ターンなら延長（置き換え）する', () => {
    const pet    = new Pet('fox', 5, 5); // war_cry power=1
    const player = makePlayer(5, 6);
    player.statusEffects.push({ type: 'war_cry', turnsLeft: 1, power: 1 });
    const res = pet.maybeBuffPlayer(player);
    expect(res.applied).toBe(true);
    expect(player.statusEffects).toHaveLength(1);
    expect(player.statusEffects[0].turnsLeft).toBe(PETS.fox.buff.turns);
  });

  it('別種のバフは保持したまま新規バフを追加する', () => {
    const pet    = new Pet('bird', 5, 5); // haste power=2
    const player = makePlayer(5, 5);
    player.statusEffects.push({ type: 'poison', turnsLeft: 3, power: 2 });
    const res = pet.maybeBuffPlayer(player);
    expect(res.applied).toBe(true);
    expect(player.statusEffects).toHaveLength(2);
    const poison = player.statusEffects.find(e => e.type === 'poison');
    const haste  = player.statusEffects.find(e => e.type === 'haste');
    expect(poison?.turnsLeft).toBe(3);
    expect(haste?.power).toBe(PETS.bird.buff.power);
  });

  it('全ペット種が buff 定義を持つ', () => {
    for (const kind of Object.keys(PETS) as Array<keyof typeof PETS>) {
      const def = PETS[kind];
      expect(def.buff).toBeDefined();
      expect(def.buff.turns).toBeGreaterThan(0);
      expect(def.buff.power).toBeGreaterThan(0);
      expect(def.buff.label.length).toBeGreaterThan(0);
    }
  });
});
