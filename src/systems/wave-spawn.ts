import { Enemy }        from '../entities/enemy.js';
import type { Logger }  from '../core/logger.js';
import type { FloatingText, GamePhase } from '../core/game-context.js';
import type { DungeonDef } from '../world/dungeon_defs.js';
import {
  SHINIGAMI_WARN1, SHINIGAMI_WARN2, SHINIGAMI_WARN3,
  SHINIGAMI_SPAWN, SHINIGAMI_RESPAWN,
  WAVE_INTERVAL,
  CANVAS_W, CANVAS_H,
} from '../core/game-constants.js';

export interface WaveSpawnMap {
  cols:      number;
  rows:      number;
  isWalkable(tx: number, ty: number): boolean;
  isStairs(tx: number, ty: number): boolean;
}

export interface WaveSpawnContext {
  gamePhase:      GamePhase;
  currentDungeon: DungeonDef | null;
  floorNumber:    number;
  turnCount:      number;
  map:            WaveSpawnMap;
  player:         { tx: number; ty: number };
  enemies:        Enemy[];   // mutable — push で追加する
  logger:         Logger;
  onFlash:        (color: string) => void;
  onFloatingText: (text: FloatingText) => void;
}

export function tickWaveSpawn(ctx: WaveSpawnContext): void {
  if (ctx.gamePhase !== 'DUNGEON') return;
  const isBossFloor = ctx.currentDungeon?.bossRush
    || (ctx.currentDungeon?.infinite ? ctx.floorNumber % 10 === 0 : ctx.floorNumber === (ctx.currentDungeon?.maxFloors ?? 99));
  if (isBossFloor) return;

  // ── 警告 ──────────────────────────────────
  if (ctx.turnCount === SHINIGAMI_WARN1) {
    ctx.logger.add('💨 どこからか足音が聞こえる…', 'warn');
  }
  if (ctx.turnCount === SHINIGAMI_WARN2) {
    ctx.logger.add('👁 この場所に何かが近づいている…', 'warn');
    ctx.onFlash('rgba(60,0,80,0.3)');
  }
  if (ctx.turnCount === SHINIGAMI_WARN3) {
    ctx.logger.add('💀 死神が来る前に早く階段を降りろ！', 'warn');
    ctx.onFlash('rgba(100,0,0,0.4)');
    ctx.onFloatingText({
      text: '⚠ 死神接近 ⚠',
      x: CANVAS_W / 2, y: CANVAS_H / 2 - 80,
      alpha: 1, scale: 1, color: '#ff4444', life: 3.0, maxLife: 3.0, big: true,
    });
  }

  // ── 死神スポーン ───────────────────────────
  const isShinigamiTurn = ctx.turnCount >= SHINIGAMI_SPAWN &&
    (ctx.turnCount === SHINIGAMI_SPAWN ||
     (ctx.turnCount - SHINIGAMI_SPAWN) % SHINIGAMI_RESPAWN === 0);
  if (isShinigamiTurn) {
    spawnShinigami(ctx);
    ctx.logger.add('💀 死神が現れた！逃げろ！', 'warn');
    ctx.onFloatingText({
      text: '💀  死  神  💀',
      x: CANVAS_W / 2, y: CANVAS_H / 2 - 60,
      alpha: 1, scale: 1, color: '#cc00ff', life: 3.5, maxLife: 3.5, big: true,
    });
    ctx.onFlash('rgba(60,0,100,0.55)');
    return;
  }

  // ── ランダム増援 ──────────────────────────
  if (ctx.turnCount > 0 && ctx.turnCount % WAVE_INTERVAL === 0) {
    const count = ctx.turnCount >= SHINIGAMI_SPAWN ? 2 : 1;
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      if (spawnWaveEnemy(ctx)) spawned++;
    }
    if (spawned > 0) ctx.logger.add(`👣 敵の増援が現れた！(${spawned}体)`);
  }
}

export function spawnWaveEnemy(ctx: WaveSpawnContext): boolean {
  let tx = 0, ty = 0, att = 0;
  do {
    tx = Math.floor(Math.random() * ctx.map.cols);
    ty = Math.floor(Math.random() * ctx.map.rows);
    att++;
  } while (att < 500 && (
    !ctx.map.isWalkable(tx, ty) ||
    ctx.map.isStairs(tx, ty) ||
    ctx.enemies.some(e => e.alive && e.tx === tx && e.ty === ty) ||
    Math.max(Math.abs(tx - ctx.player.tx), Math.abs(ty - ctx.player.ty)) < 8
  ));
  if (att >= 500) return false;

  const diffMult = ctx.currentDungeon?.diffMult ?? 1.0;
  const pool = ctx.floorNumber >= 5
    ? ['goblin', 'archer', 'wizard', 'slime']
    : ctx.floorNumber >= 3
    ? ['goblin', 'archer', 'slime']
    : ['slime', 'goblin'];
  const type = pool[Math.floor(Math.random() * pool.length)];
  const e = new Enemy(tx, ty, type);
  const scale = (ctx.floorNumber - 1) * diffMult;
  e.maxHP  = Math.round(e.maxHP  * (1 + scale * 0.25));
  e.hp     = e.maxHP;
  e.atk    = Math.round(e.atk   * (1 + scale * 0.20));
  e.def    = Math.round(e.def   * (1 + scale * 0.15));
  ctx.enemies.push(e);
  return true;
}

export function spawnShinigami(ctx: WaveSpawnContext): void {
  // プレイヤーから遠い場所に生成（最低12タイル離れる）
  let tx = 0, ty = 0, att = 0;
  do {
    tx = Math.floor(Math.random() * ctx.map.cols);
    ty = Math.floor(Math.random() * ctx.map.rows);
    att++;
  } while (att < 600 && (
    !ctx.map.isWalkable(tx, ty) ||
    ctx.map.isStairs(tx, ty) ||
    ctx.enemies.some(e => e.alive && e.tx === tx && e.ty === ty) ||
    Math.max(Math.abs(tx - ctx.player.tx), Math.abs(ty - ctx.player.ty)) < 12
  ));
  // フォールバック：対角コーナー
  if (att >= 600) {
    tx = ctx.player.tx < ctx.map.cols / 2 ? ctx.map.cols - 2 : 1;
    ty = ctx.player.ty < ctx.map.rows / 2 ? ctx.map.rows - 2 : 1;
  }
  const s = new Enemy(tx, ty, 'shinigami');
  s.alerted = true;
  ctx.enemies.push(s);
}
