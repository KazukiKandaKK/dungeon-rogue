import { describe, it, expect, vi } from 'vitest';
import {
  SPELLS,
  SPELL_IDS,
  resolveSpell,
  type Player,
  type Enemy,
  type MapGrid,
  type SpellCallbacks,
} from '../../src/data/magic.js';

// ── テスト用スタブ ────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    tx: 5, ty: 5,
    mp: 99, hp: 20, maxHP: 20,
    dirX: 0, dirY: -1,
    renderX: 5.5 * 32, renderY: 5.5 * 32,
    statusEffects: [],
    ...overrides,
  };
}

function makeEnemy(tx: number, ty: number): Enemy {
  return {
    alive: true,
    tx, ty,
    hp: 30, maxHP: 30,
    def: 0,
    name: 'スライム',
    statusEffects: [],
    takeDamage: vi.fn(() => true),
  };
}

function makeOpenMap(): MapGrid {
  return { isWalkable: () => true };
}

function makeCb(): SpellCallbacks {
  return {
    addLog:         vi.fn(),
    spawnParticle:  vi.fn(),
    spawnSelfEffect:vi.fn(),
    findSpawn:      vi.fn(() => ({ tx: 3, ty: 3 })),
  };
}

// ── テスト ────────────────────────────────────

describe('SPELLS', () => {

  it('SPELL_IDS に全スペルが含まれる', () => {
    for (const id of SPELL_IDS) {
      expect(SPELLS[id]).toBeDefined();
    }
  });

  it('各スペルに必須フィールドがある', () => {
    for (const [id, sp] of Object.entries(SPELLS)) {
      expect(sp.id,       `${id}.id`).toBe(id);
      expect(sp.name,     `${id}.name`).toBeTypeOf('string');
      expect(sp.mp,       `${id}.mp`).toBeTypeOf('number');
      expect(sp.power,    `${id}.power`).toBeTypeOf('number');
      expect(sp.rangeVal, `${id}.rangeVal`).toBeTypeOf('number');
    }
  });

});

describe('resolveSpell – MPチェック', () => {

  it('MP不足ならok:falseを返し、MPを消費しない', () => {
    const player = makePlayer({ mp: 0 });
    const cb = makeCb();
    const result = resolveSpell('fireball', player, makeOpenMap(), [], cb);
    expect(result.ok).toBe(false);
    expect(player.mp).toBe(0);
    expect(cb.addLog).toHaveBeenCalledWith(expect.stringContaining('MPが足りない'), 'warn');
  });

  it('存在しないスペルIDはok:falseを返す', () => {
    const result = resolveSpell('no_such_spell', makePlayer(), makeOpenMap(), [], makeCb());
    expect(result.ok).toBe(false);
  });

});

describe('resolveSpell – ヒール', () => {

  it('HP を power 分回復する', () => {
    const player = makePlayer({ hp: 5, maxHP: 30 });
    resolveSpell('heal', player, makeOpenMap(), [], makeCb());
    expect(player.hp).toBe(25); // 5 + 20
    expect(player.mp).toBe(99 - SPELLS['heal'].mp);
  });

  it('maxHP を超えて回復しない', () => {
    const player = makePlayer({ hp: 18, maxHP: 20 });
    resolveSpell('heal', player, makeOpenMap(), [], makeCb());
    expect(player.hp).toBe(20);
  });

});

describe('resolveSpell – テレポート', () => {

  it('findSpawn が返す位置にプレイヤーが移動する', () => {
    const player = makePlayer();
    const cb = makeCb();
    vi.mocked(cb.findSpawn).mockReturnValue({ tx: 9, ty: 2 });
    resolveSpell('teleport', player, makeOpenMap(), [], cb);
    expect(player.tx).toBe(9);
    expect(player.ty).toBe(2);
  });

});

describe('resolveSpell – 範囲攻撃（burst）', () => {

  it('射程内の敵に takeDamage を呼ぶ', () => {
    const player  = makePlayer({ tx: 5, ty: 5, dirX: 0, dirY: -1 }); // 上向き
    const enemy   = makeEnemy(5, 3);  // プレイヤーの前方2マス
    const result  = resolveSpell('fireball', player, makeOpenMap(), [enemy], makeCb());
    expect(result.ok).toBe(true);
    expect(enemy.takeDamage).toHaveBeenCalled();
  });

  it('射程外の敵は無視する', () => {
    const player = makePlayer({ tx: 5, ty: 5, dirX: 0, dirY: -1 });
    const enemy  = makeEnemy(5, 0);  // はるか遠く
    resolveSpell('fireball', player, makeOpenMap(), [enemy], makeCb());
    expect(enemy.takeDamage).not.toHaveBeenCalled();
  });

});

describe('resolveSpell – gravity（%ダメージ）', () => {

  it('maxHP の30%ダメージを floor全敵に与える', () => {
    const player = makePlayer();
    const e1 = makeEnemy(1, 1);
    const e2 = makeEnemy(2, 2);
    resolveSpell('gravity', player, makeOpenMap(), [e1, e2], makeCb());
    expect(e1.takeDamage).toHaveBeenCalledWith(9, expect.any(Number), expect.any(Number)); // 30*0.3=9
    expect(e2.takeDamage).toHaveBeenCalledWith(9, expect.any(Number), expect.any(Number));
  });

});

describe('resolveSpell – ドレイン（drain）', () => {

  it('敵から吸収したHP分だけ回復する', () => {
    const player = makePlayer({ hp: 10, maxHP: 30 });
    const enemy  = makeEnemy(5, 4);  // 隣接（ring:1）
    // takeDamage は常に true を返すが、回復量はdamageの計算値
    resolveSpell('drain', player, makeOpenMap(), [enemy], makeCb());
    expect(player.hp).toBeGreaterThan(10);  // 何かしら回復した
  });

});
