import { describe, it, expect, beforeEach } from 'vitest';
import {
  emitFootprint,
  tickFootprints,
  FOOTPRINT_CAP,
  _resetFootprintSerial,
  type Footprint,
} from '../../src/systems/footprints.js';

describe('footprints', () => {
  beforeEach(() => {
    _resetFootprintSerial();
  });

  it('emitFootprint adds entry with expected fields', () => {
    const list: Footprint[] = [];
    emitFootprint(list, 100, 200, 0, 1000);
    expect(list.length).toBe(1);
    expect(list[0].wx).toBe(100);
    expect(list[0].wy).toBe(200);
    expect(list[0].angle).toBe(0);
    expect(list[0].alpha).toBe(1);
    expect(list[0].bornAt).toBe(1000);
  });

  it('alternates L/R foot across multiple emits', () => {
    const list: Footprint[] = [];
    for (let i = 0; i < 4; i++) {
      emitFootprint(list, i * 16, 0, 0, 1000 + i);
    }
    expect(list.map(f => f.foot)).toEqual(['L', 'R', 'L', 'R']);
  });

  it('tickFootprints fades alpha proportional to age', () => {
    const list: Footprint[] = [];
    emitFootprint(list, 0, 0, 0, 1000);
    // 半分の寿命を経過 → alpha ≈ 0.5
    tickFootprints(list, 1000 + 4000, 8000);
    expect(list.length).toBe(1);
    expect(list[0].alpha).toBeCloseTo(0.5, 5);
  });

  it('tickFootprints prunes expired footprints', () => {
    const list: Footprint[] = [];
    emitFootprint(list, 0, 0, 0, 1000);
    emitFootprint(list, 16, 0, 0, 1000);
    // 寿命を超過 → 全て消える
    tickFootprints(list, 1000 + 9000, 8000);
    expect(list.length).toBe(0);
  });

  it('caps list at FOOTPRINT_CAP, evicting oldest', () => {
    const list: Footprint[] = [];
    for (let i = 0; i < FOOTPRINT_CAP + 5; i++) {
      emitFootprint(list, i * 16, 0, 0, 2000 + i);
    }
    expect(list.length).toBe(FOOTPRINT_CAP);
    // 最古（bornAt=2000..2004）が落ちて、bornAt=2005 以降が残る
    expect(list[0].bornAt).toBe(2005);
    expect(list[list.length - 1].bornAt).toBe(2000 + FOOTPRINT_CAP + 4);
  });

  it('emitFootprint with non-zero angle preserves angle', () => {
    const list: Footprint[] = [];
    emitFootprint(list, 0, 0, Math.PI / 2, 1000);
    expect(list[0].angle).toBeCloseTo(Math.PI / 2, 5);
  });
});
