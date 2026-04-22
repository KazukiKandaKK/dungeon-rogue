import { describe, it, expect } from 'vitest';
import {
  createCamera,
  tickCamera,
  beginFloorEntry,
  beginBossZoom,
  beginBaseFlyIn,
  clearCinematic,
} from '../../src/systems/camera.js';

const W = 800;
const H = 600;

describe('camera', () => {
  describe('createCamera', () => {
    it('初期状態はオフセット0・ズーム1・シネマティックなし', () => {
      const cam = createCamera();
      expect(cam.offX).toBe(0);
      expect(cam.offY).toBe(0);
      expect(cam.zoom).toBe(1);
      expect(cam.cinematic.kind).toBe('none');
      expect(cam.lerpHalfLife).toBeGreaterThan(0);
    });
  });

  describe('通常追従', () => {
    it('シネマティックなしでは画面中央へ緩やかに寄せる', () => {
      const cam = createCamera();
      // プレイヤーが (400, 300) にいるとき、目標 offset は (0, 0) になる。
      // 開始時に offset を大きめにずらしてから 1 ステップ進めて減る事を確認。
      cam.offX = 200;
      cam.offY = 100;
      tickCamera(cam, 0.016, 400, 300, W, H);
      // 1 フレーム (16ms) でも近づいているはず
      expect(Math.abs(cam.offX)).toBeLessThan(200);
      expect(Math.abs(cam.offY)).toBeLessThan(100);
    });

    it('half-life 経過でおおむね半分まで詰まる', () => {
      const cam = createCamera();
      cam.lerpHalfLife = 0.1;
      cam.offX = 100;
      cam.offY = 0;
      // 0.1 秒進める → 約半分（誤差許容）
      tickCamera(cam, 0.1, 400, 300, W, H);
      expect(cam.offX).toBeGreaterThan(45);
      expect(cam.offX).toBeLessThan(55);
    });

    it('十分な時間で目標（W/2 - playerWX, H/2 - playerWY）に収束する', () => {
      const cam = createCamera();
      // 例: playerWX=500, playerWY=200 → 目標 (-100, 100)
      for (let i = 0; i < 60; i++) tickCamera(cam, 0.05, 500, 200, W, H);
      expect(cam.offX).toBeCloseTo(-100, 1);
      expect(cam.offY).toBeCloseTo(100, 1);
    });

    it('シネマティックなしでは入力ロックを返さない', () => {
      const cam = createCamera();
      const locked = tickCamera(cam, 0.016, 400, 300, W, H);
      expect(locked).toBe(false);
    });
  });

  describe('beginFloorEntry', () => {
    it('duration 経過後にシネマティックが終了する', () => {
      const cam = createCamera();
      beginFloorEntry(cam, 'south');
      expect(cam.cinematic.kind).toBe('floor-entry');
      // ticks を積み上げて duration (0.6s) を超えるまで進める
      let locked = false;
      for (let i = 0; i < 50; i++) {
        locked = tickCamera(cam, 0.02, 400, 300, W, H);
      }
      expect(cam.cinematic.kind).toBe('none');
      expect(locked).toBe(false);
    });

    it('演出中は入力ロックを返す', () => {
      const cam = createCamera();
      beginFloorEntry(cam, 'north');
      const locked = tickCamera(cam, 0.01, 400, 300, W, H);
      expect(locked).toBe(true);
    });
  });

  describe('beginBossZoom', () => {
    it('演出中にズームが1を超え、終了後は1へ戻る', () => {
      const cam = createCamera();
      beginBossZoom(cam, 500, 350);
      // ピーク付近までステップ
      for (let i = 0; i < 30; i++) tickCamera(cam, 0.02, 400, 300, W, H);
      expect(cam.zoom).toBeGreaterThan(1.0);
      // 残りを消化
      for (let i = 0; i < 60; i++) tickCamera(cam, 0.02, 400, 300, W, H);
      expect(cam.cinematic.kind).toBe('none');
      expect(cam.zoom).toBeCloseTo(1, 1);
    });
  });

  describe('beginBaseFlyIn', () => {
    it('演出中は入力ロック、duration 後に解除', () => {
      const cam = createCamera();
      beginBaseFlyIn(cam);
      const lockedDuring = tickCamera(cam, 0.01, 400, 300, W, H);
      expect(lockedDuring).toBe(true);
      for (let i = 0; i < 80; i++) tickCamera(cam, 0.02, 400, 300, W, H);
      expect(cam.cinematic.kind).toBe('none');
    });
  });

  describe('clearCinematic', () => {
    it('進行中の演出を強制終了する', () => {
      const cam = createCamera();
      beginBossZoom(cam, 500, 350);
      clearCinematic(cam);
      expect(cam.cinematic.kind).toBe('none');
      expect(cam.zoom).toBe(1);
    });
  });
});
