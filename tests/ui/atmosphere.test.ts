import { describe, it, expect } from 'vitest';
import { drawGodRays, drawDustMotes, drawEdgeFog } from '../../src/ui/atmosphere.js';
import { drawSkyline } from '../../src/ui/skyline.js';

describe('atmosphere & skyline (smoke tests)', () => {
  it('drawGodRays / drawDustMotes / drawEdgeFog / drawSkyline are callable functions', () => {
    expect(typeof drawGodRays).toBe('function');
    expect(typeof drawDustMotes).toBe('function');
    expect(typeof drawEdgeFog).toBe('function');
    expect(typeof drawSkyline).toBe('function');
  });

  it('drawGodRays bails out gracefully when ctx has no canvas', () => {
    expect(() => drawGodRays({} as any, 800, 600, 0, 0.55, 1)).not.toThrow();
  });

  it('drawSkyline bails out gracefully when ctx has no canvas', () => {
    expect(() => drawSkyline({} as any, 800, 600, 0, 0, 0, 0.3, null)).not.toThrow();
  });
});
