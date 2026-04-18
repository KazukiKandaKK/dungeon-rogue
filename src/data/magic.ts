// ─────────────────────────────────────────────
// magic.ts  魔法定義・解決ロジック
// ─────────────────────────────────────────────

import type { TilePos, StatusEffectEntry, MapGrid } from '../types.js';

// ── 型定義 ────────────────────────────────────

export type SpellRange   = 'self' | 'line' | 'burst' | 'cross' | 'ring' | 'floor' | 'chain';
export type StatusEffect = 'poison' | 'slow' | 'sleep' | 'stun';

export interface SpellDef {
  id:       string;
  name:     string;
  mp:       number;
  power:    number;
  range:    SpellRange;
  rangeVal: number;
  color:    string;
  icon:     string;
  desc:     string;
  // オプション
  status?:      StatusEffect;
  statusTurns?: number;
  statusPow?:   number;
  drain?:       boolean;   // ドレイン（HP吸収）
  pct?:         number;    // 最大HP%ダメージ（gravity / void_rift）
  selfHeal?:    number;    // 自身回復（sanctuary）
}

// ── 外部依存の最小インターフェース ─────────────────

export interface Player extends TilePos {
  mp:      number;
  hp:      number;
  maxHP:   number;
  dirX:    number;
  dirY:    number;
  renderX: number;
  renderY: number;
  statusEffects: StatusEffectEntry[];
}

export interface Enemy extends TilePos {
  alive:          boolean;
  def?:           number;
  hp:             number;
  maxHP?:         number;
  name:           string;
  statusEffects:  StatusEffectEntry[];
  takeDamage(damage: number, dx: number, dy: number): boolean;
}

export type { MapGrid, TilePos, StatusEffectEntry };

export interface SpellCallbacks {
  addLog(msg: string, type?: string): void;
  spawnParticle(e: Enemy, color: string): void;
  spawnSelfEffect(color: string): void;
  findSpawn(): TilePos | null;
  findSpawnNear?(tx: number, ty: number): TilePos | null;
  tauntEnemies?(): void;
  timeStopEnemies?(turns: number): void;
  getEnemies?(): Enemy[];
}

export interface SpellResult {
  ok:            boolean;
  affectedTiles: TilePos[];
}

// ── 魔法定義データ ────────────────────────────

export const SPELLS: Record<string, SpellDef> = {
  // ── 既存：攻撃魔法 ──────────────────────────────
  fireball: {
    id: 'fireball', name: 'ファイアボール', mp: 4, power: 12,
    range: 'burst', rangeVal: 2,
    color: '#f97316', icon: '🔥', desc: '前方2マス中心に半径2爆発',
  },
  thunder: {
    id: 'thunder', name: 'サンダー', mp: 3, power: 10,
    range: 'line', rangeVal: 8,
    color: '#fbbf24', icon: '⚡', desc: '向いた方向に直進貫通8マス',
  },
  blizzard: {
    id: 'blizzard', name: 'ブリザード', mp: 5, power: 14,
    range: 'cross', rangeVal: 3,
    color: '#7dd3fc', icon: '❄', desc: '四方向に3マス攻撃',
  },
  meteor: {
    id: 'meteor', name: 'メテオ', mp: 12, power: 22,
    range: 'floor', rangeVal: 0,
    color: '#ef4444', icon: '☄', desc: 'フロア全敵に大ダメージ',
  },

  // ── 既存：回復・補助 ──────────────────────────
  heal: {
    id: 'heal', name: 'ヒール', mp: 3, power: 20,
    range: 'self', rangeVal: 0,
    color: '#4ade80', icon: '💚', desc: 'HP +20 回復',
  },
  regen: {
    id: 'regen', name: 'リジェネ', mp: 4, power: 4,
    range: 'self', rangeVal: 5,
    color: '#86efac', icon: '🌿', desc: '5ターン毎ターン HP+4 回復',
  },
  haste: {
    id: 'haste', name: 'ヘイスト', mp: 4, power: 3,
    range: 'self', rangeVal: 4,
    color: '#fcd34d', icon: '💨', desc: '4ターン速度+3・回避率大幅UP',
  },
  barrier: {
    id: 'barrier', name: 'バリア', mp: 5, power: 5,
    range: 'self', rangeVal: 4,
    color: '#93c5fd', icon: '🔵', desc: '4ターン DEF+5',
  },
  teleport: {
    id: 'teleport', name: 'テレポート', mp: 2, power: 0,
    range: 'self', rangeVal: 0,
    color: '#c084fc', icon: '🌀', desc: 'ランダムな床にワープ',
  },

  // ── 新規：強力単体/貫通攻撃 ─────────────────────
  dark_bolt: {
    id: 'dark_bolt', name: '闇の矢', mp: 6, power: 22,
    range: 'line', rangeVal: 6,
    color: '#7c3aed', icon: '★', desc: '暗黒エネルギーの矢 直進貫通6マス',
  },
  wind_cross: {
    id: 'wind_cross', name: '風刃十字', mp: 5, power: 11,
    range: 'cross', rangeVal: 5,
    color: '#d1fae5', icon: '✦', desc: '四方向に5マス風刃',
  },

  // ── 新規：周囲範囲攻撃（ring） ───────────────────
  frost_nova: {
    id: 'frost_nova', name: 'フロストノヴァ', mp: 4, power: 8,
    range: 'ring', rangeVal: 2,
    status: 'slow', statusTurns: 3,
    color: '#7dd3fc', icon: '❄', desc: '周囲半径2マス凍結・鈍化',
  },
  holy_nova: {
    id: 'holy_nova', name: '聖域爆発', mp: 8, power: 16,
    range: 'ring', rangeVal: 3,
    color: '#fde68a', icon: '✸', desc: '周囲半径3マス聖なる爆発',
  },
  drain: {
    id: 'drain', name: 'ドレイン', mp: 3, power: 10,
    range: 'ring', rangeVal: 1,
    drain: true,
    color: '#f43f5e', icon: '♥', desc: '隣接敵からHP吸収',
  },

  // ── 新規：前方範囲＋デバフ ───────────────────────
  poison_mist: {
    id: 'poison_mist', name: '毒霧', mp: 3, power: 5,
    range: 'burst', rangeVal: 2,
    status: 'poison', statusTurns: 4, statusPow: 3,
    color: '#86efac', icon: '☠', desc: '前方爆発半径2・毒状態',
  },
  sleep_gas: {
    id: 'sleep_gas', name: '眠り霧', mp: 6, power: 3,
    range: 'burst', rangeVal: 3,
    status: 'sleep', statusTurns: 4,
    color: '#a78bfa', icon: 'z', desc: '前方爆発半径3・眠り状態',
  },

  // ── 新規：フロア全体 ─────────────────────────────
  gravity: {
    id: 'gravity', name: 'グラビティ', mp: 10, power: 0,
    range: 'floor', rangeVal: 0,
    pct: 0.3,
    color: '#6366f1', icon: '◎', desc: '全敵の最大HP30%ダメージ',
  },
  quake: {
    id: 'quake', name: '地震', mp: 8, power: 10,
    range: 'floor', rangeVal: 0,
    status: 'stun', statusTurns: 1,
    color: '#92400e', icon: '~', desc: 'フロア全敵ダメージ＋行動不能1T',
  },

  // ── 新規：連鎖電撃 ───────────────────────────────
  chain_bolt: {
    id: 'chain_bolt', name: '連鎖雷', mp: 6, power: 12,
    range: 'chain', rangeVal: 5,
    color: '#fbbf24', icon: '⚡', desc: '最大4体に連鎖する電撃',
  },

  // ── 戦士系 ─────────────────────────────────────
  war_cry: {
    id: 'war_cry', name: '雄叫び', mp: 4, power: 5,
    range: 'self', rangeVal: 4,
    color: '#ef4444', icon: '📢', desc: '4ターン ATK+5',
  },
  shield_bash: {
    id: 'shield_bash', name: 'シールドバッシュ', mp: 3, power: 14,
    range: 'line', rangeVal: 1,
    status: 'stun', statusTurns: 2,
    color: '#f97316', icon: '🛡', desc: '前方1マス スタン+ダメージ',
  },
  whirlwind: {
    id: 'whirlwind', name: '旋風斬', mp: 5, power: 11,
    range: 'ring', rangeVal: 1,
    color: '#fbbf24', icon: '🌪', desc: '周囲1マス全方向に斬撃',
  },
  berserk: {
    id: 'berserk', name: 'バーサーク', mp: 6, power: 10,
    range: 'self', rangeVal: 5,
    color: '#dc2626', icon: '😤', desc: '5ターン ATK+10 DEF-4 猛攻態勢',
  },
  war_stomp: {
    id: 'war_stomp', name: '大地踏み', mp: 7, power: 16,
    range: 'ring', rangeVal: 2,
    status: 'stun', statusTurns: 1,
    color: '#b45309', icon: '👊', desc: '周囲2マスに衝撃波＋スタン',
  },

  // ── 守護者系 ────────────────────────────────────
  cure: {
    id: 'cure', name: 'キュア', mp: 3, power: 0,
    range: 'self', rangeVal: 0,
    color: '#6ee7b7', icon: '🌸', desc: '全状態異常を解除する',
  },
  iron_skin: {
    id: 'iron_skin', name: '鋼の肌', mp: 5, power: 8,
    range: 'self', rangeVal: 5,
    color: '#64748b', icon: '🔩', desc: '5ターン DEF+8',
  },
  holy_strike: {
    id: 'holy_strike', name: '聖なる一撃', mp: 5, power: 18,
    range: 'line', rangeVal: 5,
    color: '#fde68a', icon: '✝', desc: '前方5マス 聖属性貫通光線',
  },
  sanctuary: {
    id: 'sanctuary', name: 'サンクチュアリ', mp: 8, power: 10,
    range: 'ring', rangeVal: 2,
    color: '#fef3c7', icon: '☀', desc: '周囲2マス聖ダメージ＋自身HP回復',
    selfHeal: 12,
  },
  taunt: {
    id: 'taunt', name: '挑発', mp: 3, power: 0,
    range: 'self', rangeVal: 3,
    color: '#ef4444', icon: '⚡', desc: '3ターン 全敵をこちらに向ける',
  },

  // ── 盗賊系 ──────────────────────────────────────
  venom_blade: {
    id: 'venom_blade', name: '毒刃', mp: 4, power: 8,
    range: 'line', rangeVal: 4,
    status: 'poison', statusTurns: 5, statusPow: 4,
    color: '#4ade80', icon: '🗡', desc: '前方4マス 毒ダメージ+毒付与',
  },
  smoke_bomb: {
    id: 'smoke_bomb', name: '煙幕弾', mp: 4, power: 2,
    range: 'ring', rangeVal: 2,
    status: 'slow', statusTurns: 4,
    color: '#94a3b8', icon: '💨', desc: '周囲2マス 鈍化4ターン',
  },
  assassinate: {
    id: 'assassinate', name: 'アサシネイト', mp: 7, power: 32,
    range: 'line', rangeVal: 2,
    color: '#1e1b4b', icon: '☽', desc: '前方2マス 急所を狙う超高威力',
  },
  shadow_step: {
    id: 'shadow_step', name: '影踏み', mp: 5, power: 0,
    range: 'self', rangeVal: 0,
    color: '#7c3aed', icon: '👤', desc: '最も近い敵の背後に瞬間移動',
  },
  caltrops: {
    id: 'caltrops', name: '撒菱', mp: 3, power: 6,
    range: 'ring', rangeVal: 3,
    status: 'poison', statusTurns: 3, statusPow: 2,
    color: '#6b7280', icon: '🪤', desc: '周囲3マスに撒菱 毒付与',
  },

  // ── 魔法士強化 ──────────────────────────────────
  arcane_ray: {
    id: 'arcane_ray', name: 'アルカンレイ', mp: 7, power: 28,
    range: 'line', rangeVal: 10,
    color: '#e879f9', icon: '✦', desc: '前方10マス 純粋魔力の光線',
  },
  mana_burst: {
    id: 'mana_burst', name: 'マナバースト', mp: 9, power: 20,
    range: 'ring', rangeVal: 3,
    color: '#a855f7', icon: '💥', desc: '自身周囲3マスに魔力爆発',
  },
  time_stop: {
    id: 'time_stop', name: 'タイムストップ', mp: 12, power: 0,
    range: 'self', rangeVal: 3,
    color: '#6366f1', icon: '⏱', desc: '3ターン 全敵行動停止',
  },
  void_rift: {
    id: 'void_rift', name: 'ヴォイドリフト', mp: 14, power: 0,
    range: 'floor', rangeVal: 0,
    pct: 0.45,
    color: '#4c1d95', icon: '🕳', desc: '全敵の最大HP45%ダメージ',
  },
};

export const SPELL_IDS = Object.keys(SPELLS);

// ── 魔法解決ロジック ──────────────────────────

/**
 * 魔法を解決する
 */
export function resolveSpell(
  spellId: string,
  player:  Player,
  map:     MapGrid,
  enemies: Enemy[],
  cb:      SpellCallbacks,
): SpellResult {
  const spell = SPELLS[spellId];
  if (!spell) return { ok: false, affectedTiles: [] };
  if (player.mp < spell.mp) {
    cb.addLog(`MPが足りない！（必要: ${spell.mp}）`, 'warn');
    return { ok: false, affectedTiles: [] };
  }

  player.mp -= spell.mp;

  const affected = _getAffectedTiles(spell, player, map, enemies);

  // ── 連鎖系（chain）────────────────────────────
  if (spell.range === 'chain') {
    let current: TilePos = { tx: player.tx, ty: player.ty };
    const used   = new Set<Enemy>();
    let hitCount = 0;
    for (let jump = 0; jump < 4; jump++) {
      let best: Enemy | null = null;
      let bestDist = Infinity;
      for (const e of enemies) {
        if (!e.alive || used.has(e)) continue;
        const dist = Math.abs(e.tx - current.tx) + Math.abs(e.ty - current.ty);
        if (dist <= spell.rangeVal && dist < bestDist) { best = e; bestDist = dist; }
      }
      if (!best) break;
      used.add(best);
      const damage = Math.max(1, spell.power - (best.def ?? 0));
      const dir = { x: Math.sign(best.tx - current.tx), y: Math.sign(best.ty - current.ty) };
      best.takeDamage(damage, dir.x, dir.y);
      cb.spawnParticle(best, spell.color);
      affected.push({ tx: best.tx, ty: best.ty });
      current = { tx: best.tx, ty: best.ty };
      hitCount++;
    }
    if (hitCount > 0) cb.addLog(`${spell.icon} ${spell.name}！ ${hitCount}体に連鎖！`, 'warn');
    else              cb.addLog(`${spell.icon} ${spell.name}を放ったが外れた…`);
    return { ok: true, affectedTiles: affected };
  }

  // ── ダメージ系（burst/line/cross/floor/ring）──────
  if (['burst', 'line', 'cross', 'floor', 'ring'].includes(spell.range)) {
    const targets: Enemy[] = spell.range === 'floor'
      ? enemies.filter(e => e.alive)
      : affected
          .map(({ tx, ty }) => enemies.find(e => e.alive && e.tx === tx && e.ty === ty))
          .filter((e): e is Enemy => e !== undefined);

    if (spell.range === 'floor') {
      for (const e of targets) affected.push({ tx: e.tx, ty: e.ty });
    }

    let hitCount     = 0;
    let totalDrained = 0;

    for (const e of targets) {
      const def    = e.def ?? 0;
      const damage = spell.pct
        ? Math.max(1, Math.floor((e.maxHP ?? e.hp) * spell.pct))
        : Math.max(1, spell.power - def);
      const dir = { x: Math.sign(e.tx - player.tx), y: Math.sign(e.ty - player.ty) };
      e.takeDamage(damage, dir.x, dir.y);
      if (spell.drain) totalDrained += damage;

      // ステータス異常付与
      if (spell.status) {
        if (!e.statusEffects) e.statusEffects = [];
        const ex = e.statusEffects.find(ef => ef.type === spell.status);
        if (ex) {
          ex.turns = Math.max(ex.turns ?? 0, spell.statusTurns ?? 3);
        } else {
          e.statusEffects.push({
            type:  spell.status,
            turns: spell.statusTurns ?? 3,
            power: spell.statusPow  ?? 2,
          });
        }
      }

      cb.spawnParticle(e, spell.color);
      hitCount++;
    }

    if (spell.drain && totalDrained > 0) {
      player.hp = Math.min(player.maxHP, player.hp + totalDrained);
      cb.spawnSelfEffect(spell.color);
      cb.addLog(`${spell.icon} ${spell.name}！ ${hitCount}体から ${totalDrained} HP吸収！`, 'warn');
    } else if (hitCount > 0) {
      const STATUS_NAME: Record<string, string> = { poison: '毒', slow: '鈍化', sleep: '眠り', stun: '行動不能' };
      const statusTag   = spell.status ? ` [${STATUS_NAME[spell.status] ?? spell.status}]` : '';
      const dmgStr      = spell.pct ? `${Math.round(spell.pct * 100)}%` : String(spell.power);
      cb.addLog(`${spell.icon} ${spell.name}！ ${hitCount}体に ${dmgStr} ダメージ！${statusTag}`, 'warn');
      // selfHeal（sanctuary 等）
      if (spell.selfHeal) {
        const healed = Math.min(spell.selfHeal, player.maxHP - player.hp);
        if (healed > 0) { player.hp += healed; cb.addLog(`💚 HP +${healed} 回復。`); }
        cb.spawnSelfEffect('#6ee7b7');
      }
    } else {
      cb.addLog(`${spell.icon} ${spell.name}を放ったが外れた…`);
    }
  }

  // ── 自己対象系（self）──────────────────────────
  if (spell.range === 'self') {
    switch (spellId) {
      case 'heal': {
        const healed = Math.min(spell.power, player.maxHP - player.hp);
        player.hp += healed;
        cb.addLog(`${spell.icon} ヒール！ HP +${healed} 回復。`);
        cb.spawnSelfEffect(spell.color);
        break;
      }
      case 'regen':
        _addOrRefreshEffect(player, 'regen', spell.rangeVal, spell.power);
        cb.addLog(`${spell.icon} リジェネ！ ${spell.rangeVal}ターン HP 回復が続く。`);
        cb.spawnSelfEffect(spell.color);
        break;
      case 'haste':
        _addOrRefreshEffect(player, 'haste', spell.rangeVal, spell.power);
        cb.addLog(`${spell.icon} ヘイスト！ ${spell.rangeVal}ターン 速度が上がった！`);
        cb.spawnSelfEffect(spell.color);
        break;
      case 'barrier':
        _addOrRefreshEffect(player, 'barrier', spell.rangeVal, spell.power);
        cb.addLog(`${spell.icon} バリア！ ${spell.rangeVal}ターン DEF+${spell.power}。`);
        cb.spawnSelfEffect(spell.color);
        break;
      case 'teleport': {
        const pos = cb.findSpawn();
        if (pos) {
          player.tx = pos.tx; player.ty = pos.ty;
          player.renderX = (pos.tx + 0.5) * 32;
          player.renderY = (pos.ty + 0.5) * 32;
          cb.addLog(`${spell.icon} テレポート！ 見知らぬ場所へ飛んだ。`);
          cb.spawnSelfEffect(spell.color);
        }
        break;
      }
      case 'war_cry':
        _addOrRefreshEffect(player, 'war_cry', spell.rangeVal, spell.power);
        cb.addLog(`${spell.icon} 雄叫び！ ${spell.rangeVal}ターン ATK+${spell.power}！`);
        cb.spawnSelfEffect(spell.color);
        break;
      case 'berserk':
        _addOrRefreshEffect(player, 'berserk', spell.rangeVal, spell.power, { defPenalty: 4 });
        cb.addLog(`${spell.icon} バーサーク！ ${spell.rangeVal}ターン ATK+${spell.power} / DEF-4！`);
        cb.spawnSelfEffect(spell.color);
        break;
      case 'iron_skin':
        _addOrRefreshEffect(player, 'iron_skin', spell.rangeVal, spell.power);
        cb.addLog(`${spell.icon} 鋼の肌！ ${spell.rangeVal}ターン DEF+${spell.power}。`);
        cb.spawnSelfEffect(spell.color);
        break;
      case 'cure':
        player.statusEffects = player.statusEffects.filter(e =>
          ['regen', 'haste', 'barrier', 'war_cry', 'berserk', 'iron_skin', 'taunt'].includes(e.type)
        );
        cb.addLog(`${spell.icon} キュア！ 状態異常を解除した。`);
        cb.spawnSelfEffect(spell.color);
        break;
      case 'taunt':
        _addOrRefreshEffect(player, 'taunt', spell.rangeVal, 0);
        cb.addLog(`${spell.icon} 挑発！ ${spell.rangeVal}ターン 敵の注意を引きつける！`);
        cb.spawnSelfEffect(spell.color);
        cb.tauntEnemies?.();
        break;
      case 'shadow_step': {
        const living = cb.getEnemies?.().filter(e => e.alive) ?? [];
        if (living.length === 0) {
          cb.addLog(`${spell.icon} 影踏み… 敵がいない。`);
          break;
        }
        const nearest = living.reduce((a, b) => {
          const da = Math.abs(a.tx - player.tx) + Math.abs(a.ty - player.ty);
          const db = Math.abs(b.tx - player.tx) + Math.abs(b.ty - player.ty);
          return da < db ? a : b;
        });
        const behindTx = nearest.tx + Math.sign(nearest.tx - player.tx);
        const behindTy = nearest.ty + Math.sign(nearest.ty - player.ty);
        const pos2 = cb.findSpawnNear?.(behindTx, behindTy) ?? cb.findSpawn();
        if (pos2) {
          player.tx = pos2.tx; player.ty = pos2.ty;
          player.renderX = (pos2.tx + 0.5) * 32;
          player.renderY = (pos2.ty + 0.5) * 32;
          cb.addLog(`${spell.icon} 影踏み！ ${nearest.name}の背後に瞬間移動！`);
          cb.spawnSelfEffect(spell.color);
        }
        break;
      }
      case 'time_stop':
        _addOrRefreshEffect(player, 'time_stop', spell.rangeVal, 0);
        cb.addLog(`${spell.icon} タイムストップ！ ${spell.rangeVal}ターン 時が止まった！`);
        cb.spawnSelfEffect(spell.color);
        cb.timeStopEnemies?.(spell.rangeVal);
        break;
    }
  }

  return { ok: true, affectedTiles: affected };
}

// ── 内部ヘルパー ──────────────────────────────

function _getAffectedTiles(
  spell:   SpellDef,
  player:  Player,
  map:     MapGrid,
  enemies: Enemy[],
): TilePos[] {
  const tiles: TilePos[] = [];
  const { tx, ty, dirX = 0, dirY = -1 } = player;
  const range = spell.rangeVal;

  switch (spell.range) {
    case 'burst': {
      const cx = tx + dirX * 2;
      const cy = ty + dirY * 2;
      for (let dy = -range; dy <= range; dy++)
        for (let dx = -range; dx <= range; dx++)
          if (Math.sqrt(dx * dx + dy * dy) <= range)
            tiles.push({ tx: cx + dx, ty: cy + dy });
      break;
    }
    case 'line': {
      const ddx = dirX || 0, ddy = dirY || 0;
      const fx = (Math.abs(ddx) === 0 && Math.abs(ddy) === 0) ? 0  : ddx;
      const fy = (Math.abs(ddx) === 0 && Math.abs(ddy) === 0) ? -1 : ddy;
      for (let r = 1; r <= range; r++) {
        const ttx = tx + fx * r, tty = ty + fy * r;
        if (!map.isWalkable(ttx, tty)) break;
        tiles.push({ tx: ttx, ty: tty });
        if (enemies && enemies.some(e => e.alive && e.tx === ttx && e.ty === tty)) break;
      }
      break;
    }
    case 'cross': {
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
        for (let r = 1; r <= range; r++) {
          const ttx = tx + dx * r, tty = ty + dy * r;
          if (!map.isWalkable(ttx, tty)) break;
          tiles.push({ tx: ttx, ty: tty });
          if (enemies && enemies.some(e => e.alive && e.tx === ttx && e.ty === tty)) break;
        }
      }
      break;
    }
    case 'ring': {
      for (let dy = -range; dy <= range; dy++)
        for (let dx = -range; dx <= range; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (Math.sqrt(dx * dx + dy * dy) <= range + 0.5)
            tiles.push({ tx: tx + dx, ty: ty + dy });
        }
      break;
    }
    case 'chain':
    case 'floor':
      break; // caller で解決
  }
  return tiles;
}

function _addOrRefreshEffect(
  player: Player,
  type:   string,
  turns:  number,
  power:  number,
  extra:  Record<string, unknown> = {},
): void {
  const existing = player.statusEffects.find(e => e.type === type);
  if (existing) {
    existing.turnsLeft = Math.max(existing.turnsLeft ?? 0, turns);
    Object.assign(existing, extra);
  } else {
    player.statusEffects.push({ type, turnsLeft: turns, power, ...extra });
  }
}
