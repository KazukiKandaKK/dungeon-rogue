// ─────────────────────────────────────────────
// enemy-ai.ts  敵 AI ロジック（main.js から抽出）
// ─────────────────────────────────────────────

import { Enemy }  from '../entities/enemy.js';
import type { Player } from '../entities/player.js';
import type { GameMap } from '../types.js';

// ── 公開インターフェース ──────────────────────

export interface FloatingText {
  text:    string;
  x:       number;
  y:       number;
  alpha:   number;
  scale:   number;
  color:   string;
  life:    number;
  maxLife: number;
  big?:    boolean;
}

export interface ArrowEntry {
  wx:      number;
  wy:      number;
  twx:     number;
  twy:     number;
  progress: number;
  color:   string;
  isMagic?: boolean;
}

export interface AoeFlashEntry {
  tx:    number;
  ty:    number;
  alpha: number;
  color: string;
}

export interface EnemyAIContext {
  map:      GameMap;
  player:   Player;
  enemies:  Enemy[];
  camOffX:  number;
  camOffY:  number;
  canvasW:  number;
  canvasH:  number;
  loanDebt: number;
  logger:   { add(msg: string, type?: string): void };
  onFloatingText: (t: FloatingText) => void;
  onFlash:        (color: string) => void;
  onAoeFlash:     (entry: AoeFlashEntry) => void;
  onArrow:        (arrow: ArrowEntry) => void;
  attack:         (attacker: Enemy | Player, defender: Enemy | Player, rawAtk: number) => number;
  hasLOS:         (x0: number, y0: number, x1: number, y1: number) => boolean;
  isEnemyOnLine:  (x0: number, y0: number, x1: number, y1: number, exclude: Enemy) => boolean;
}

// ── ステータス異常の内部型（slow の _skip フラグを含む） ──

interface StatusEffectInternal {
  type:      string;
  turns?:    number;
  turnsLeft?: number;
  power?:    number;
  _skip?:    boolean;
}

// ── doEnemyTurn ───────────────────────────────

export function doEnemyTurn(enemy: Enemy, ctx: EnemyAIContext): void {
  const { player, camOffX, camOffY } = ctx;

  // ── ステータス異常処理 ──────────────────────────────
  if (enemy.statusEffects?.length) {
    let skipTurn = false;
    for (const eff of enemy.statusEffects as StatusEffectInternal[]) {
      if (eff.type === 'poison') {
        const dmg = eff.power ?? 2;
        enemy.hp = Math.max(0, enemy.hp - dmg);
        if (enemy.hp <= 0) enemy.alive = false;
        const { sx, sy } = enemy.screenPos(camOffX, camOffY);
        ctx.onFloatingText({ text: `☠${dmg}`, x: sx, y: sy - 16, alpha: 1, scale: 1, color: '#4ade80', life: 0.8, maxLife: 0.8 });
      }
      if (eff.type === 'sleep' || eff.type === 'stun') skipTurn = true;
      if (eff.type === 'slow') { eff._skip = !eff._skip; if (eff._skip) skipTurn = true; }
      eff.turns = (eff.turns ?? 1) - 1;
    }
    enemy.statusEffects = (enemy.statusEffects as StatusEffectInternal[]).filter(e => (e.turns ?? 0) > 0) as typeof enemy.statusEffects;
    if (!enemy.alive) return;
    if (skipTurn) return;
  }

  // ── HP 再生 ─────────────────────────────────────
  if (enemy.hpRegen > 0 && enemy.hp < enemy.maxHP) {
    const regen = Math.min(enemy.hpRegen, enemy.maxHP - enemy.hp);
    enemy.hp += regen;
    const { sx: rsx, sy: rsy } = enemy.screenPos(camOffX, camOffY);
    ctx.onFloatingText({ text: `+${regen}`, x: rsx, y: rsy - 14, alpha: 1, scale: 0.9, color: '#86efac', life: 0.7, maxLife: 0.7 });
  }

  const result = enemy.takeTurn(ctx.map, player, ctx.enemies);

  // ── 高速移動（1ターン2マス） ──────────────────────
  if (result === 'move' && enemy.fastMove) {
    enemy.takeTurn(ctx.map, player, ctx.enemies);
  }

  if (result === 'casting') {
    const { sx, sy } = enemy.screenPos(camOffX, camOffY);
    const remaining = enemy._castCharge;
    ctx.onFloatingText({
      text:    remaining > 0 ? `✨詠唱中…(${remaining})` : '✨詠唱中…',
      x: sx, y: sy - 28,
      alpha: 1, scale: 1, color: '#e879f9',
      life: 0.9, maxLife: 0.9,
    });
    return;
  } else if (result === 'attack') {
    if (!ctx.hasLOS(enemy.tx, enemy.ty, player.tx, player.ty)) return;
    const dodgeChance = (player.spd ?? 0) * 0.07;
    if (Math.random() < dodgeChance) {
      ctx.logger.add(`${enemy.name} の攻撃を回避した！`, 'warn');
      const { sx, sy } = player.screenPos(camOffX, camOffY);
      ctx.onFloatingText({ text: 'DODGE!', x: sx, y: sy - 28, alpha: 1, scale: 1, color: '#fcd34d', life: 1.0, maxLife: 1.0 });
    } else {
      const dmgDealt = ctx.attack(enemy, player, enemy.atk);
      applyEnemyTraits(enemy, dmgDealt, ctx);
    }
    const dirX = player.tx - enemy.tx;
    const dirY = player.ty - enemy.ty;
    enemy.attackBump(Math.sign(dirX), Math.sign(dirY));
  } else if (result === 'rangedAttack') {
    const dmgDealt = ctx.attack(enemy, player, enemy.atk);
    applyEnemyTraits(enemy, dmgDealt, ctx);
    const projColor = enemy.projectileColor ?? enemy.glowColor ?? '#fcd34d';
    ctx.onArrow({
      wx: enemy.renderX, wy: enemy.renderY,
      twx: player.renderX, twy: player.renderY,
      progress: 0, color: projColor,
      isMagic: !!enemy.projectileColor,
    });
  } else if (result === 'areaAttack') {
    if (!ctx.hasLOS(enemy.tx, enemy.ty, player.tx, player.ty)) return;
    ctx.attack(enemy, player, Math.ceil(enemy.atk * 1.5));
    ctx.logger.add(`${enemy.name} の衝撃波！`, 'warn');
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 2) {
          ctx.onAoeFlash({ tx: enemy.tx + dx, ty: enemy.ty + dy, alpha: 1, color: 'rgba(138,0,255,' });
        }
      }
    }
    ctx.onFlash('rgba(138,0,255,0.25)');
  } else if (result === 'magicFire') {
    bossMagicAttack(enemy, '🔥 ファイアボール', enemy.atk * 1.3, 'rgba(249,115,22,', 2, ctx);
  } else if (result === 'magicIce') {
    bossMagicBolt(enemy, '❄ アイスボルト', enemy.atk * 1.1, '#7dd3fc', ctx);
  } else if (result === 'magicLightning') {
    bossMagicBolt(enemy, '⚡ サンダー', enemy.atk * 1.2, '#fbbf24', ctx);
  }
}

// ── applyEnemyTraits ──────────────────────────

export function applyEnemyTraits(enemy: Enemy, dmgDealt: number, ctx: EnemyAIContext): void {
  const { player, camOffX, camOffY } = ctx;

  if (!player.alive || dmgDealt <= 0) return;

  if (enemy.poisonAttack) {
    const existing = player.statusEffects.find(e => e.type === 'poison');
    if (existing) {
      existing.turnsLeft = Math.max(existing.turnsLeft ?? 0, 5);
    } else {
      player.statusEffects.push({ type: 'poison', turnsLeft: 5, power: 1 });
    }
    const { sx, sy } = player.screenPos(camOffX, camOffY);
    ctx.onFloatingText({ text: '☠毒！', x: sx, y: sy - 36, alpha: 1, scale: 1, color: '#4ade80', life: 1.2, maxLife: 1.2 });
    ctx.logger.add(`${enemy.name} の毒攻撃！毒状態になった！`, 'warn');
  }

  if (enemy.lifeSteal) {
    const steal = Math.max(1, Math.floor(dmgDealt * 0.5));
    enemy.hp = Math.min(enemy.maxHP, enemy.hp + steal);
    const { sx, sy } = enemy.screenPos(camOffX, camOffY);
    ctx.onFloatingText({ text: `🩸+${steal}`, x: sx, y: sy - 16, alpha: 1, scale: 0.9, color: '#f43f5e', life: 0.8, maxLife: 0.8 });
  }

  if ((enemy as any).isDebtCollector) {
    const steal = Math.min(Math.floor(ctx.loanDebt * 0.1 + 20), player.gold);
    const { sx, sy } = player.screenPos(camOffX, camOffY);
    if (steal > 0) {
      player.gold -= steal;
      ctx.onFloatingText({ text: `-${steal}G 奪われた！`, x: sx, y: sy - 36, alpha: 1, scale: 1, color: '#f87171', life: 1.5, maxLife: 1.5 });
      ctx.logger.add(`💸 借金取りに ${steal}G 奪われた！`, 'warn');
    } else if (player.inventory.length > 0) {
      const idx = Math.floor(Math.random() * player.inventory.length);
      const stolen = player.inventory.splice(idx, 1)[0];
      ctx.onFloatingText({ text: `${stolen.icon} 奪われた！`, x: sx, y: sy - 36, alpha: 1, scale: 1, color: '#f87171', life: 1.5, maxLife: 1.5 });
      ctx.logger.add(`💸 借金取りに ${stolen.icon}${stolen.name} を奪われた！`, 'warn');
    }
  }
}

// ── processEnemyDeathTraits ───────────────────

export function processEnemyDeathTraits(dead: Enemy[], ctx: EnemyAIContext): void {
  const { player, camOffX, camOffY } = ctx;

  for (const e of dead) {
    if (e.deathExplode) {
      const explodeDmg = Math.max(3, Math.floor(e.atk * 1.2));
      const dist = Math.sqrt((e.tx - player.tx) ** 2 + (e.ty - player.ty) ** 2);
      if (dist <= 2) {
        player.hp = Math.max(1, player.hp - explodeDmg);
        ctx.logger.add(`💥 ${e.name} が爆発した！ ${explodeDmg} ダメージ！`, 'warn');
        ctx.onFlash('rgba(249,115,22,0.35)');
      }
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= 2) {
            ctx.onAoeFlash({ tx: e.tx + dx, ty: e.ty + dy, alpha: 1, color: 'rgba(249,115,22,' });
          }
        }
      }
    }

    if (e.isShopShinigami) {
      ctx.logger.add('💀 番人の死神を倒した！…しかし100体の死神が現れた！', 'warn');
      ctx.onFlash('rgba(139,0,139,0.5)');
      ctx.onFloatingText({
        text:    '💀 100体の死神！',
        x:       ctx.canvasW / 2,
        y:       ctx.canvasH / 2 - 60,
        alpha:   1,
        scale:   1,
        color:   '#aa44ff',
        life:    3.5,
        maxLife: 3.5,
        big:     true,
      });
      for (let i = 0; i < 100; i++) {
        let nx = 0, ny = 0, na = 0;
        do {
          nx = Math.floor(Math.random() * ctx.map.cols);
          ny = Math.floor(Math.random() * ctx.map.rows);
          na++;
        } while (
          na < 30 &&
          (!ctx.map.isWalkable(nx, ny) || ctx.enemies.some(en => en.alive && en.tx === nx && en.ty === ny))
        );
        if (na < 30) {
          const s = new Enemy(nx, ny, 'shop_shinigami');
          ctx.enemies.push(s);
        }
      }
    }

    if (e.splitOnDeath) {
      const offsets: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      let spawned = 0;
      for (const [ox, oy] of offsets) {
        if (spawned >= 2) break;
        const nx = e.tx + ox;
        const ny = e.ty + oy;
        if (
          ctx.map.isWalkable(nx, ny) &&
          !ctx.enemies.some(en => en.alive && en.tx === nx && en.ty === ny)
        ) {
          const baby = new Enemy(nx, ny, 'slime');
          baby.alerted = true;
          ctx.enemies.push(baby);
          spawned++;
        }
      }
      if (spawned > 0) ctx.logger.add(`💦 ${e.name} が ${spawned} 体のスライムに分裂した！`, 'warn');
    }
  }
}

// ── bossMagicAttack ───────────────────────────

export function bossMagicAttack(
  boss:      Enemy,
  name:      string,
  power:     number,
  colorBase: string,
  radius:    number,
  ctx:       EnemyAIContext,
): void {
  const { player } = ctx;
  const px = player.tx, py = player.ty;
  const dist = Math.sqrt((boss.tx - px) ** 2 + (boss.ty - py) ** 2);
  if (dist > 8) return;
  if (!ctx.hasLOS(boss.tx, boss.ty, px, py)) return;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        ctx.onAoeFlash({ tx: px + dx, ty: py + dy, alpha: 1, color: colorBase });
      }
    }
  }
  ctx.attack(boss, player, Math.floor(power));
  ctx.logger.add(`${boss.name} の ${name}！`, 'warn');
  ctx.onFlash(`${colorBase}0.28)`);
}

// ── bossMagicBolt ─────────────────────────────

export function bossMagicBolt(
  boss:  Enemy,
  name:  string,
  power: number,
  color: string,
  ctx:   EnemyAIContext,
): void {
  const { player } = ctx;
  const dist = Math.sqrt((boss.tx - player.tx) ** 2 + (boss.ty - player.ty) ** 2);
  if (dist > 10) return;
  if (!ctx.hasLOS(boss.tx, boss.ty, player.tx, player.ty)) return;
  if (ctx.isEnemyOnLine(boss.tx, boss.ty, player.tx, player.ty, boss)) return;
  ctx.attack(boss, player, Math.floor(power));
  ctx.onArrow({
    wx:  boss.renderX,
    wy:  boss.renderY,
    twx: player.renderX,
    twy: player.renderY,
    progress: 0,
    color,
    isMagic: true,
  });
  ctx.logger.add(`${boss.name} の ${name}！`, 'warn');
}
