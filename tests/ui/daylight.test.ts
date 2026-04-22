import { describe, it, expect } from 'vitest';
import { getSunVector, getNightGlowBoost } from '../../src/ui/daylight.js';

describe('getSunVector', () => {

  it('真昼（phase=0.45）は影が最も短い', () => {
    const noon = getSunVector(0.45);
    const dawn = getSunVector(0.10);
    expect(noon.lengthMult).toBeLessThan(dawn.lengthMult);
    expect(noon.elevation).toBeGreaterThan(0.85);
  });

  it('朝（phase=0.10）の影は西向き（dx < 0）', () => {
    const s = getSunVector(0.10);
    expect(s.dx).toBeLessThan(0);
  });

  it('夕（phase=0.60）の影は東向き（dx > 0）', () => {
    const s = getSunVector(0.60);
    expect(s.dx).toBeGreaterThan(0);
  });

  it('夜帯（phase=0.90）は月光相当の弱い影', () => {
    const n = getSunVector(0.90);
    expect(n.alpha).toBeLessThan(0.30);
    expect(n.elevation).toBeLessThan(0.30);
  });

  it('返される方向ベクトルは単位長さに近い', () => {
    for (const p of [0.10, 0.30, 0.50, 0.70, 0.90]) {
      const s = getSunVector(p);
      const mag = Math.hypot(s.dx, s.dy);
      expect(mag).toBeGreaterThan(0.99);
      expect(mag).toBeLessThan(1.01);
    }
  });

  it('tint は rgba 文字列', () => {
    for (const p of [0.00, 0.15, 0.40, 0.60, 0.80]) {
      const s = getSunVector(p);
      expect(s.tint).toMatch(/^rgba\(/);
    }
  });
});

describe('getNightGlowBoost', () => {
  it('昼は 0', () => {
    expect(getNightGlowBoost(0.40)).toBe(0);
  });
  it('夜は 1', () => {
    expect(getNightGlowBoost(0.90)).toBe(1);
  });
  it('夕方は 0..1 の遷移', () => {
    const g = getNightGlowBoost(0.77);
    expect(g).toBeGreaterThan(0);
    expect(g).toBeLessThan(1);
  });
});
