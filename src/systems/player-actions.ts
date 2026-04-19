// ─────────────────────────────────────────────
// player-actions.ts  プレイヤーターン処理
//   main.js の _processTurn / _doPlayerAction などを移植
// ─────────────────────────────────────────────

import type { Player }  from '../entities/player.js';
import type { Enemy }   from '../entities/enemy.js';
import type { ItemDef } from '../data/equipment.js';
import { SPELLS, resolveSpell } from '../data/magic.js';
import { TILE, TILE_SIZE }      from '../world/tiles.js';
import { LOAN_QUEST_FLOORS }    from '../core/game-constants.js';

// ── 共通型 ────────────────────────────────────

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
  wx:       number;
  wy:       number;
  twx:      number;
  twy:      number;
  progress: number;
  color:    string;
  life?:    number;
}

export interface AoeFlashEntry {
  tx:    number;
  ty:    number;
  alpha: number;
  color: string;
}

export interface FloorItem {
  tx:   number;
  ty:   number;
  item: ItemDef;
}

export interface FloorChest {
  tx:     number;
  ty:     number;
  opened: boolean;
}

export interface ShopEntry {
  itemId: string;
  price:  number;
  tier:   number;
  item:   ItemDef;
}

export interface PlayerActionMap {
  cols:          number;
  rows:          number;
  grid:          number[][];
  isWalkable(tx: number, ty: number): boolean;
  isStairs(tx: number, ty: number): boolean;
  revealedTraps: Set<string>;
  trapTypes:     Map<string, string>;
  stairs:        { tx: number; ty: number } | null;
  // ── 壁の採掘・設置（マイクラ風） ─────────────────
  canBreakWall?: (tx: number, ty: number) => boolean;
  breakWall?:    (tx: number, ty: number) => boolean;
  canPlaceWall?: (
    tx: number, ty: number,
    actors?: { alive: boolean; tx: number; ty: number }[],
    extras?: { tx: number; ty: number }[],
  ) => boolean;
  placeWall?:       (tx: number, ty: number, material?: 'stone' | 'wood') => boolean;
  wallMaterialAt?:  (tx: number, ty: number) => 'stone' | 'wood';
  getExitDir?:      (tx: number, ty: number) => string | null;
}

// ── コンテキスト型 ─────────────────────────────

export interface PlayerActionContext {
  // ゲーム状態（一部関数が読み書き）
  player:       Player;
  enemies:      Enemy[];          // mutated in place
  map:          PlayerActionMap;
  floorItems:   FloorItem[];      // mutated (push / splice)
  floorChests:  FloorChest[];     // read
  floorNumber:  number;
  gamePhase:    string;
  gameState:    string;           // read; write via onGameOver
  currentDungeon: { bossRush?: boolean; infinite?: boolean; maxFloors?: number } | null;
  loanDebt:       number;         // mutated
  loanQuestActive: boolean;       // mutated
  shopPos:        { tx: number; ty: number } | null;
  shopItems:      ShopEntry[];    // read
  camOffX:  number;
  camOffY:  number;
  canvasW:  number;
  canvasH:  number;
  turnCount: number;              // mutated (incremented)

  // 出力配列（push される）
  floatingTexts: FloatingText[];
  aoeFlash:      AoeFlashEntry[];
  arrows:        ArrowEntry[];

  // ロガー
  logger: { add(msg: string, type?: string): void };

  // コールバック（副作用）
  onFlash:              (color: string) => void;
  onSpellVfx?:          (type: string, params: Record<string, unknown>, life?: number) => void;
  onShake?:             (intensity: number, duration: number) => void;
  onHitStop?:           (seconds: number) => void;
  onGameOver:           () => void;
  onTransition:         () => void;
  onUpdateExplored:     () => void;
  onOpenChest:          (tx: number, ty: number) => void;
  onTriggerTrap:        (type: string) => void;
  onShopOpen:           () => void;
  onLevelUps:           (levels: number[]) => void;
  onEnemyTurn:          (enemy: Enemy) => void;
  onProcessDeathTraits: (dead: Enemy[]) => void;
  onTickWaveSpawn:      () => void;

  // パーティクル
  particles: { spawn(x: number, y: number, color: string, count: number): void };

  // 戦闘ヘルパー（main.js から注入）
  hasLOS:        (x0: number, y0: number, x1: number, y1: number) => boolean;
  isEnemyOnLine: (x0: number, y0: number, x1: number, y1: number, exclude: Enemy) => boolean;
  attack:        (attacker: Player | Enemy, defender: Player | Enemy, rawAtk: number) => number;

  // フラグ（mutated）
  shopOpen:       boolean;
  shopCursor:     number;
  gameOverTimer:  number;
}

// ── ターン処理 ─────────────────────────────────

export function processTurn(
  action: { type: string; dx?: number; dy?: number; material?: 'stone' | 'wood' },
  ctx:    PlayerActionContext,
): void {
  const acted = doPlayerAction(action, ctx);
  if (!acted) return;
  if (ctx.gameState === 'TRANSITIONING') return;

  ctx.turnCount++;

  ctx.player.tickStatusEffects(
    (healed) => {
      if (healed > 0) {
        const { sx, sy } = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
        ctx.floatingTexts.push({ text: `+${healed} HP`, x: sx, y: sy - 20, alpha: 1, scale: 1, color: '#86efac', life: 1.0, maxLife: 1.0 });
      }
    },
    (dmg) => {
      const { sx, sy } = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
      ctx.floatingTexts.push({ text: `☠${dmg}`, x: sx, y: sy - 20, alpha: 1, scale: 1, color: '#4ade80', life: 0.9, maxLife: 0.9 });
      ctx.logger.add(`毒でHPが ${dmg} 減った！（残HP: ${ctx.player.hp}）`, 'damage');
      ctx.onFlash('rgba(74,222,128,0.15)');
    },
  );

  const prevEnemyCount = ctx.enemies.length;
  for (const e of [...ctx.enemies]) {
    if (!e.alive) continue;
    ctx.onEnemyTurn(e);
  }

  // 死神は不死 — ダメージを受けても HP 1 で復活
  for (const e of ctx.enemies) {
    if (!e.alive && e.isShinigami) {
      e.hp    = 1;
      e.alive = true;
      ctx.logger.add('💀 死神はダメージを受けない！逃げろ！', 'warn');
    }
  }

  ctx.onTickWaveSpawn();

  const dead   = ctx.enemies.filter(e => !e.alive);
  const alive  = ctx.enemies.filter(e => e.alive);
  ctx.enemies.length = 0;
  ctx.enemies.push(...alive);

  ctx.onProcessDeathTraits(dead);

  for (const e of dead) {
    const expGained = e.expValue;
    const levels    = ctx.player.gainExp(expGained);
    const ex = e.renderX + ctx.camOffX;
    const ey = e.renderY + ctx.camOffY;
    ctx.floatingTexts.push({ text: `+${expGained} EXP`, x: ex, y: ey - 20, alpha: 1, scale: 1, color: '#818cf8', life: 1.4, maxLife: 1.4 });

    const goldDrop = Math.max(1, Math.floor(e.expValue * (0.5 + Math.random() * 0.8) + ctx.floorNumber * 1.5));
    ctx.floatingTexts.push({ text: `+${goldDrop}G`, x: ex + 20, y: ey - 30, alpha: 1, scale: 1, color: '#fbbf24', life: 1.2, maxLife: 1.2 });
    applyGoldWithQuest(goldDrop, ex + 20, ey - 30, ctx);

    if (e.isBoss) {
      ctx.logger.add(`🎉 ボス「${e.name}」を倒した！階段が現れた！`, 'warn');
      ctx.floatingTexts.push({ text: 'BOSS DEFEATED!', x: ctx.canvasW / 2, y: ctx.canvasH / 2 - 60, alpha: 1, scale: 1, color: '#fde68a', life: 3.5, maxLife: 3.5, big: true });
      ctx.onFlash('rgba(250,204,21,0.5)');
      ctx.map.stairs = { tx: e.tx, ty: e.ty };
      ctx.map.grid[e.ty][e.tx] = TILE.STAIRS;
    }

    ctx.onLevelUps(levels);

    const drop = e.dropItem(ctx.floorNumber);
    if (drop) {
      const dp = _findDropTile(e.tx, e.ty, ctx);
      ctx.floorItems.push({ tx: dp.tx, ty: dp.ty, item: drop });
      ctx.logger.add(`${e.name} が ${drop.icon}${drop.name} を落とした！`);
    }
  }

  if (!ctx.player.alive) {
    ctx.onGameOver();
    if (ctx.enemies.some(e => e.isShinigami)) {
      ctx.logger.add('💀 死神に魂を刈り取られた…', 'warn');
    } else {
      ctx.logger.add('あなたは倒れた…', 'warn');
    }
  }

  if (prevEnemyCount > 0 && ctx.enemies.length === 0) {
    ctx.logger.add('フロアの敵を全滅させた！', 'warn');
  }
}

// ── 金の適用（借金返済込み） ───────────────────

export function applyGoldWithQuest(
  amount:  number,
  floatX:  number | null,
  floatY:  number | null,
  ctx:     PlayerActionContext,
): void {
  if (!ctx.loanQuestActive || ctx.loanDebt <= 0 || ctx.floorNumber > LOAN_QUEST_FLOORS) {
    ctx.player.gold += amount;
    return;
  }

  const apply  = Math.min(ctx.loanDebt, amount);
  ctx.loanDebt -= apply;
  const remain = amount - apply;
  if (remain > 0) ctx.player.gold += remain;

  const { sx, sy } = (floatX != null && floatY != null)
    ? { sx: floatX, sy: floatY }
    : ctx.player.screenPos(ctx.camOffX, ctx.camOffY);

  if (apply > 0) {
    ctx.floatingTexts.push({ text: `🗺️ -${apply}G 返済`, x: sx, y: sy - 44, alpha: 1, scale: 1, color: '#f87171', life: 1.4, maxLife: 1.4 });
    ctx.logger.add(`🗺️ 宝探し: ${apply}G が借金返済に充てられた。残債: ${ctx.loanDebt}G`, ctx.loanDebt > 0 ? 'warn' : 'info');
  }

  if (ctx.loanDebt <= 0) {
    ctx.loanDebt        = 0;
    ctx.loanQuestActive = false;
    ctx.logger.add('🎉 宝探し依頼で借金を完済した！', 'warn');
    ctx.floatingTexts.push({ text: '✅ 借金完済！', x: ctx.canvasW / 2, y: ctx.canvasH / 2 - 50, alpha: 1, scale: 1, color: '#4ade80', life: 2.5, maxLife: 2.5, big: true });
  }
}

// ── アイテムピックアップ ──────────────────────

export function pickupItem(ntx: number, nty: number, ctx: PlayerActionContext): void {
  const itemIdx = ctx.floorItems.findIndex(fi => fi.tx === ntx && fi.ty === nty);
  if (itemIdx >= 0) {
    const { item } = ctx.floorItems[itemIdx];
    if ((item.slot as string) === 'gold') {
      ctx.floorItems.splice(itemIdx, 1);
      const { sx, sy } = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
      ctx.floatingTexts.push({ text: `+${(item as ItemDef & { amount?: number }).amount ?? 0}G`, x: sx, y: sy - 28, alpha: 1, scale: 1, color: '#fbbf24', life: 1.2, maxLife: 1.2 });
      applyGoldWithQuest((item as ItemDef & { amount?: number }).amount ?? 0, sx, sy - 28, ctx);
      ctx.logger.add(`💰 ${(item as ItemDef & { amount?: number }).amount ?? 0}G を拾った！`);
    } else if (ctx.player.addToInventory(item)) {
      ctx.floorItems.splice(itemIdx, 1);
      ctx.logger.add(`${item.icon}${item.name} を拾った！`);
    }
  }

  if (
    ctx.shopPos &&
    ntx === ctx.shopPos.tx &&
    nty === ctx.shopPos.ty &&
    !ctx.shopOpen &&
    ctx.shopItems.length > 0
  ) {
    ctx.shopOpen   = true;
    ctx.shopCursor = 0;
    ctx.logger.add('🏪 露店に立ち寄った！ [B/Esc]で閉じる', 'warn');
    ctx.onShopOpen();
  }
}

// ── プレイヤー矢生成 ──────────────────────────

export function spawnPlayerArrow(
  target: Enemy,
  weapon: ItemDef | null | undefined,
  ctx:    PlayerActionContext,
): void {
  const { sx: psx, sy: psy } = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
  const { sx: tsx, sy: tsy } = target.screenPos(ctx.camOffX, ctx.camOffY);
  ctx.arrows.push({ wx: psx, wy: psy, twx: tsx, twy: tsy, progress: 0, color: weapon?.color ?? '#fbbf24', life: 0.35 });
}

// ── プレイヤーアクション実行 ──────────────────

export function doPlayerAction(
  action: { type: string; dx?: number; dy?: number; material?: 'stone' | 'wood' },
  ctx:    PlayerActionContext,
): boolean {
  if (action.type === 'TURN') {
    ctx.player.dirX = action.dx ?? 0;
    ctx.player.dirY = action.dy ?? 0;
    return false;
  }

  if (action.type === 'WAIT') {
    ctx.logger.add('その場で待機した。');
    return true;
  }

  if (action.type === 'BREAK_WALL') {
    const dx  = ctx.player.dirX ?? 0;
    const dy  = ctx.player.dirY ?? 1;
    if (dx === 0 && dy === 0) {
      ctx.logger.add('向きを決めてから壁を掘る。');
      return false;
    }
    const ntx = ctx.player.tx + dx;
    const nty = ctx.player.ty + dy;
    if (!ctx.map.canBreakWall || !ctx.map.canBreakWall(ntx, nty)) {
      ctx.logger.add('そこは掘れない。', 'warn');
      return false;
    }
    // 素材を判定してから破壊（破壊後は素材情報が消える）
    const material = ctx.map.wallMaterialAt
      ? ctx.map.wallMaterialAt(ntx, nty)
      : 'stone';
    if (!ctx.map.breakWall || !ctx.map.breakWall(ntx, nty)) {
      ctx.logger.add('そこは掘れない。', 'warn');
      return false;
    }
    const matLabel = material === 'wood' ? '木材' : '石';
    const matIcon  = material === 'wood' ? '🪵'   : '⛏';
    const matColor = material === 'wood' ? '#b45309' : '#cbd5e1';
    if (material === 'wood') {
      ctx.player.wood = (ctx.player.wood ?? 0) + 1;
    } else {
      ctx.player.stones = (ctx.player.stones ?? 0) + 1;
    }
    ctx.player.attackBump(dx, dy);
    const { sx, sy } = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
    ctx.floatingTexts.push({
      text: `${matIcon} +1 ${matLabel}`, x: sx + dx * 18, y: sy + dy * 18 - 12,
      alpha: 1, scale: 1, color: matColor, life: 0.9, maxLife: 0.9,
    });
    ctx.particles.spawn(sx + dx * 28, sy + dy * 28, material === 'wood' ? '#92400e' : '#a8a29e', 8);
    const total = material === 'wood' ? (ctx.player.wood ?? 0) : (ctx.player.stones ?? 0);
    ctx.logger.add(`${matIcon} 壁を壊して${matLabel}を1個手に入れた（所持: ${total}）`, 'info');
    return true;
  }

  if (action.type === 'PLACE_WALL') {
    const dx  = ctx.player.dirX ?? 0;
    const dy  = ctx.player.dirY ?? 1;
    if (dx === 0 && dy === 0) {
      ctx.logger.add('向きを決めてから壁を置く。');
      return false;
    }
    const material: 'stone' | 'wood' = action.material ?? 'stone';
    const have = material === 'wood' ? (ctx.player.wood ?? 0) : (ctx.player.stones ?? 0);
    const matLabel = material === 'wood' ? '木材' : '石';
    if (have <= 0) {
      ctx.logger.add(`${matLabel}が無い。壁を壊して集めよう。`, 'warn');
      return false;
    }
    const ntx = ctx.player.tx + dx;
    const nty = ctx.player.ty + dy;
    const extras = [
      ...ctx.floorItems.map(fi => ({ tx: fi.tx, ty: fi.ty })),
      ...ctx.floorChests.filter(c => !c.opened).map(c => ({ tx: c.tx, ty: c.ty })),
    ];
    if (!ctx.map.canPlaceWall || !ctx.map.canPlaceWall(ntx, nty, ctx.enemies, extras)) {
      ctx.logger.add('そこには置けない。', 'warn');
      return false;
    }
    if (!ctx.map.placeWall || !ctx.map.placeWall(ntx, nty, material)) {
      ctx.logger.add('そこには置けない。', 'warn');
      return false;
    }
    if (material === 'wood') ctx.player.wood   -= 1;
    else                     ctx.player.stones -= 1;
    const matIcon = material === 'wood' ? '🪵' : '🧱';
    const matColor = material === 'wood' ? '#b45309' : '#fcd34d';
    const remain = material === 'wood' ? (ctx.player.wood ?? 0) : (ctx.player.stones ?? 0);
    const { sx, sy } = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
    ctx.floatingTexts.push({
      text: `${matIcon} 設置`, x: sx + dx * 18, y: sy + dy * 18 - 12,
      alpha: 1, scale: 1, color: matColor, life: 0.8, maxLife: 0.8,
    });
    ctx.particles.spawn(sx + dx * 28, sy + dy * 28, material === 'wood' ? '#92400e' : '#a8a29e', 6);
    ctx.logger.add(`${matIcon} ${matLabel}の壁を設置した（残り${matLabel}: ${remain}）`, 'info');
    return true;
  }

  if (action.type === 'ATTACK_DIR') {
    const weapon0 = ctx.player.equip?.weapon;
    const range0  = weapon0?.range ?? 1;

    const targets0 = ctx.enemies
      .filter(e => {
        if (!e.alive) return false;
        const cdist = Math.max(Math.abs(e.tx - ctx.player.tx), Math.abs(e.ty - ctx.player.ty));
        if (cdist > range0) return false;
        return ctx.hasLOS(ctx.player.tx, ctx.player.ty, e.tx, e.ty);
      })
      .sort((a, b) =>
        Math.max(Math.abs(a.tx - ctx.player.tx), Math.abs(a.ty - ctx.player.ty)) -
        Math.max(Math.abs(b.tx - ctx.player.tx), Math.abs(b.ty - ctx.player.ty))
      );

    if (targets0.length > 0) {
      const nearest0 = targets0[0];
      const ndx = Math.sign(nearest0.tx - ctx.player.tx);
      const ndy = Math.sign(nearest0.ty - ctx.player.ty);
      if (ndx !== 0 || ndy !== 0) { ctx.player.dirX = ndx; ctx.player.dirY = ndy; }

      if (weapon0?.aoe) {
        playerAOEAttack(weapon0, nearest0.tx, nearest0.ty, ndx, ndy, ctx);
      } else {
        for (const e of targets0) {
          if (!e.alive) continue;
          ctx.attack(ctx.player, e, ctx.player.atk);
          const doubleChance = (ctx.player.spd ?? 0) * 0.10;
          if (e.alive && Math.random() < doubleChance) {
            ctx.attack(ctx.player, e, ctx.player.atk);
            ctx.logger.add('連続攻撃！', 'warn');
          }
        }
      }

      const dist0 = Math.max(Math.abs(nearest0.tx - ctx.player.tx), Math.abs(nearest0.ty - ctx.player.ty));
      if (dist0 > 1) {
        spawnPlayerArrow(nearest0, weapon0, ctx);
      } else {
        ctx.player.attackBump(ndx, ndy);
      }
      return true;
    }

    ctx.player.attackBump(ctx.player.dirX ?? 0, ctx.player.dirY ?? 1);
    ctx.logger.add('空振り！');
    return true;
  }

  if (action.type === 'MOVE') {
    const dx  = action.dx ?? 0;
    const dy  = action.dy ?? 0;
    ctx.player.dirX = dx;
    ctx.player.dirY = dy;
    const ntx = ctx.player.tx + dx;
    const nty = ctx.player.ty + dy;

    const chestHere = ctx.floorChests.find(c => c.tx === ntx && c.ty === nty && !c.opened);
    if (chestHere) { ctx.onOpenChest(ntx, nty); return true; }
    if (!ctx.map.isWalkable(ntx, nty)) return false;
    if (ctx.enemies.some(e => e.alive && e.tx === ntx && e.ty === nty)) return false;

    ctx.player.moveTo(ntx, nty);
    ctx.player.onStep();
    ctx.onUpdateExplored();
    pickupItem(ntx, nty, ctx);

    const landTile = ctx.map.grid[ctx.player.ty]?.[ctx.player.tx];
    if (landTile === TILE.TRAP && !ctx.map.revealedTraps.has(`${ctx.player.tx},${ctx.player.ty}`)) {
      ctx.map.revealedTraps.add(`${ctx.player.tx},${ctx.player.ty}`);
      const trapType = ctx.map.trapTypes.get(`${ctx.player.tx},${ctx.player.ty}`) ?? 'damage';
      ctx.onTriggerTrap(trapType);
    }

    if (landTile === TILE.WATER) {
      ctx.logger.add('💧 水の中を歩いた', 'info');
    }

    if (ctx.map.isStairs(ntx, nty)) {
      const isBossFlr = ctx.currentDungeon?.bossRush
        || (ctx.currentDungeon?.infinite
          ? ctx.floorNumber % 10 === 0
          : ctx.floorNumber === (ctx.currentDungeon?.maxFloors ?? 99));
      if (isBossFlr && ctx.enemies.some(e => e.alive && e.isBoss)) {
        ctx.logger.add('ボスを倒さないと先に進めない！', 'warn');
        return true;
      }
      ctx.onTransition();
    }
    return true;
  }

  if (action.type === 'DASH') {
    const dx = action.dx ?? 0;
    const dy = action.dy ?? 0;
    ctx.player.dirX = dx;
    ctx.player.dirY = dy;

    const MAX_DASH = 30;
    let moved = 0;

    for (let step = 0; step < MAX_DASH; step++) {
      const ntx = ctx.player.tx + dx;
      const nty = ctx.player.ty + dy;

      const dashEnemy = ctx.enemies.find(e => e.alive && e.tx === ntx && e.ty === nty);
      if (dashEnemy) break;
      if (!ctx.map.isWalkable(ntx, nty)) break;

      const curTile  = ctx.map.grid[ctx.player.ty]?.[ctx.player.tx]  ?? TILE.WALL;
      const nextTile = ctx.map.grid[nty]?.[ntx] ?? TILE.WALL;
      const crossing = (curTile === TILE.FLOOR    && nextTile === TILE.CORRIDOR)
                    || (curTile === TILE.CORRIDOR && nextTile === TILE.FLOOR);

      ctx.player.moveTo(ntx, nty);
      ctx.player.onStep();
      ctx.onUpdateExplored();
      moved++;
      pickupItem(ntx, nty, ctx);

      if (ctx.map.isStairs(ntx, nty)) {
        const isBossFlr2 = ctx.currentDungeon?.bossRush
          || (ctx.currentDungeon?.infinite
            ? ctx.floorNumber % 10 === 0
            : ctx.floorNumber === (ctx.currentDungeon?.maxFloors ?? 99));
        if (isBossFlr2 && ctx.enemies.some(e => e.alive && e.isBoss)) {
          ctx.logger.add('ボスを倒さないと先に進めない！', 'warn');
          return true;
        }
        ctx.onTransition();
        return true;
      }
      if (crossing) break;
    }

    if (moved > 1) ctx.logger.add(`ダッシュ ${moved}マス！`, 'warn');
    return moved > 0;
  }

  return false;
}

// ── プレイヤー呪文詠唱 ─────────────────────────

export function castPlayerSpell(spellId: string, ctx: PlayerActionContext): void {
  const cb = {
    addLog:    (msg: string, type?: string) => ctx.logger.add(msg, type),
    spawnParticle: (e: Enemy, color: string) => {
      const { sx, sy } = e.screenPos(ctx.camOffX, ctx.camOffY);
      ctx.particles.spawn(sx, sy, color, 14);
    },
    spawnSelfEffect: (color: string) => {
      const { sx, sy } = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
      ctx.particles.spawn(sx, sy, color, 16);
      ctx.onFlash(color.replace(/[\d.]+\)$/, '0.2)'));
    },
    findSpawn: (): { tx: number; ty: number } | null => {
      for (let att = 0; att < 500; att++) {
        const tx = Math.floor(Math.random() * ctx.map.cols);
        const ty = Math.floor(Math.random() * ctx.map.rows);
        if (!ctx.map.isWalkable(tx, ty)) continue;
        if (Math.abs(tx - ctx.player.tx) + Math.abs(ty - ctx.player.ty) < 5) continue;
        return { tx, ty };
      }
      return null;
    },
    findSpawnNear: (tx: number, ty: number): { tx: number; ty: number } | null => {
      for (let r = 0; r <= 3; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const nx = tx + dx, ny = ty + dy;
            if (ctx.map.isWalkable(nx, ny) && !ctx.enemies.some(e => e.alive && e.tx === nx && e.ty === ny)) {
              return { tx: nx, ty: ny };
            }
          }
        }
      }
      return null;
    },
    getEnemies:      () => ctx.enemies,
    tauntEnemies:    () => { for (const e of ctx.enemies) if (e.alive) e.alerted = true; },
    timeStopEnemies: (turns: number) => {
      for (const e of ctx.enemies) {
        if (!e.alive) continue;
        // statusEffects is defined on the magic.Enemy interface but not on the
        // entity Enemy class — use a runtime-safe dynamic access here.
        const ea = e as unknown as { statusEffects?: Array<{ type: string; turns?: number; power: number }> };
        if (!ea.statusEffects) ea.statusEffects = [];
        const ex = ea.statusEffects.find(ef => ef.type === 'stun');
        if (ex) ex.turns = Math.max(ex.turns ?? 0, turns);
        else     ea.statusEffects.push({ type: 'stun', turns, power: 0 });
      }
    },
  };

  const spell  = SPELLS[spellId];
  // The magic module's Enemy interface is a structural subset of the entity Enemy class.
  // The SpellCallbacks.spawnParticle parameter type causes a mismatch, so we cast through
  // unknown here. The structural contract is satisfied at runtime.
  const result = resolveSpell(
    spellId,
    ctx.player as unknown as Parameters<typeof resolveSpell>[1],
    ctx.map    as unknown as Parameters<typeof resolveSpell>[2],
    ctx.enemies as unknown as Parameters<typeof resolveSpell>[3],
    cb as unknown as Parameters<typeof resolveSpell>[4],
  );

  if (result.ok && result.affectedTiles.length > 0) {
    const hexToRgba = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},`;
    };
    const flashCol = spell?.color ? hexToRgba(spell.color) : 'rgba(255,255,255,';
    for (const t of result.affectedTiles) {
      ctx.aoeFlash.push({ tx: t.tx, ty: t.ty, alpha: 1, color: flashCol });
    }
  }

  // ── 豪華魔法VFX ディスパッチ ─────────────────────
  if (result.ok && ctx.onSpellVfx) {
    _dispatchSpellVfx(spellId, ctx, result.affectedTiles);
  }

  const justDied = ctx.enemies.filter(e => !e.alive);
  if (justDied.length > 0) {
    ctx.onProcessDeathTraits(justDied);

    for (const e of justDied) {
      const expGained = e.expValue;
      const levels    = ctx.player.gainExp(expGained);
      const ex = e.renderX + ctx.camOffX;
      const ey = e.renderY + ctx.camOffY;
      ctx.floatingTexts.push({ text: `+${expGained} EXP`, x: ex, y: ey - 20, alpha: 1, scale: 1, color: '#818cf8', life: 1.4, maxLife: 1.4 });

      const goldDrop = Math.max(1, Math.floor(e.expValue * (0.5 + Math.random() * 0.8) + ctx.floorNumber * 1.5));
      ctx.floatingTexts.push({ text: `+${goldDrop}G`, x: ex + 20, y: ey - 30, alpha: 1, scale: 1, color: '#fbbf24', life: 1.2, maxLife: 1.2 });
      applyGoldWithQuest(goldDrop, ex + 20, ey - 30, ctx);

      ctx.onLevelUps(levels);

      const drop = e.dropItem(ctx.floorNumber);
      if (drop) {
        const dp = _findDropTile(e.tx, e.ty, ctx);
        ctx.floorItems.push({ tx: dp.tx, ty: dp.ty, item: drop });
        ctx.logger.add(`${e.name} が ${drop.icon}${drop.name} を落とした！`);
      }
    }

    const aliveAfter = ctx.enemies.filter(e => e.alive);
    ctx.enemies.length = 0;
    ctx.enemies.push(...aliveAfter);
  }
}

// ── 呪文詠唱後のターン処理 ───────────────────

export function processTurnAfterCast(ctx: PlayerActionContext): void {
  if (ctx.gameState === 'TRANSITIONING') return;

  ctx.turnCount++;

  ctx.player.tickStatusEffects(
    (healed) => {
      if (healed > 0) {
        const { sx, sy } = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
        ctx.floatingTexts.push({ text: `+${healed} HP`, x: sx, y: sy - 20, alpha: 1, scale: 1, color: '#86efac', life: 1.0, maxLife: 1.0 });
      }
    },
    (dmg) => {
      const { sx, sy } = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
      ctx.floatingTexts.push({ text: `☠${dmg}`, x: sx, y: sy - 20, alpha: 1, scale: 1, color: '#4ade80', life: 0.9, maxLife: 0.9 });
      ctx.logger.add(`毒でHPが ${dmg} 減った！（残HP: ${ctx.player.hp}）`, 'damage');
      ctx.onFlash('rgba(74,222,128,0.15)');
    },
  );

  for (const e of [...ctx.enemies]) {
    if (!e.alive) continue;
    ctx.onEnemyTurn(e);
  }

  const aliveAfter = ctx.enemies.filter(e => e.alive);
  ctx.enemies.length = 0;
  ctx.enemies.push(...aliveAfter);

  if (!ctx.player.alive) {
    const reviveBuff = ctx.player.statusEffects?.find(e => e.type === 'revive');
    if (reviveBuff) {
      ctx.player.statusEffects = ctx.player.statusEffects.filter(e => e.type !== 'revive');
      ctx.player.hp    = Math.ceil(ctx.player.maxHP * 0.3);
      ctx.player.alive = true;
      ctx.logger.add('💎 蘇生の宝玉が発動！ HP30%で復活！', 'warn');
      ctx.onFlash('rgba(52,211,153,0.5)');
    } else {
      ctx.onGameOver();
    }
  }

  if (ctx.player.statusEffects?.length) {
    ctx.player.statusEffects = ctx.player.statusEffects.filter(eff => {
      if (eff.type === 'power_up') {
        eff.turns = (eff.turns ?? 1) - 1;
        if ((eff.turns ?? 0) <= 0) {
          // atk is a computed getter; subtract the buff from the underlying baseAtk
          ctx.player.baseAtk = Math.max(0, ctx.player.baseAtk - (eff.power ?? 0));
          ctx.logger.add('💪 力の秘薬の効果が切れた。', 'info');
          return false;
        }
      }
      return true;
    });
  }
}

// ── AOE 攻撃 ──────────────────────────────────

export function playerAOEAttack(
  weapon:   ItemDef,
  targetTx: number,
  targetTy: number,
  dx:       number,
  dy:       number,
  ctx:      PlayerActionContext,
): void {
  const aoe   = weapon.aoe;
  const range = weapon.aoeRange ?? 1;
  const hitTiles: { tx: number; ty: number }[] = [];

  if (aoe === 'sweep') {
    for (let ady = -1; ady <= 1; ady++) {
      for (let adx = -1; adx <= 1; adx++) {
        if (adx === 0 && ady === 0) continue;
        hitTiles.push({ tx: ctx.player.tx + adx, ty: ctx.player.ty + ady });
      }
    }
  } else if (aoe === 'cross') {
    const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [rdx, rdy] of dirs) {
      for (let r = 1; r <= range; r++) {
        const ttx = ctx.player.tx + rdx * r;
        const tty = ctx.player.ty + rdy * r;
        if (!ctx.map.isWalkable(ttx, tty)) break;
        hitTiles.push({ tx: ttx, ty: tty });
        if (ctx.enemies.some(e => e.alive && e.tx === ttx && e.ty === tty)) break;
      }
    }
  } else if (aoe === 'burst') {
    for (let ady = -range; ady <= range; ady++) {
      for (let adx = -range; adx <= range; adx++) {
        if (Math.abs(adx) + Math.abs(ady) <= range + 1) {
          hitTiles.push({ tx: targetTx + adx, ty: targetTy + ady });
        }
      }
    }
  }

  const aoeColor = aoe === 'cross'
    ? 'rgba(192,132,252,'
    : aoe === 'burst'
      ? 'rgba(251,191,36,'
      : 'rgba(148,163,184,';

  for (const t of hitTiles) {
    ctx.aoeFlash.push({ tx: t.tx, ty: t.ty, alpha: 1, color: aoeColor });
  }

  let hitCount = 0;
  for (const { tx, ty } of hitTiles) {
    const e = ctx.enemies.find(e => e.alive && e.tx === tx && e.ty === ty);
    if (e) { ctx.attack(ctx.player, e, ctx.player.atk); hitCount++; }
  }

  const aoeNames: Record<string, string> = { sweep: '薙ぎ払い', cross: '魔法十字', burst: 'バースト' };
  if (hitCount > 1) {
    ctx.logger.add(`${aoeNames[aoe ?? ''] ?? '範囲攻撃'}！ ${hitCount}体を攻撃！`, 'warn');
  }

  // dx / dy are accepted for future directional AOE use; suppress unused-var warning
  void dx; void dy;
}

// ── 内部ヘルパー ──────────────────────────────

/** アイテムを落とす空きタイルを探す（敵・壁を避ける） */
function _findDropTile(
  startTx: number,
  startTy: number,
  ctx:     PlayerActionContext,
): { tx: number; ty: number } {
  for (let r = 0; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = startTx + dx;
        const ny = startTy + dy;
        if (!ctx.map.isWalkable(nx, ny)) continue;
        if (ctx.enemies.some(e => e.alive && e.tx === nx && e.ty === ny)) continue;
        if (ctx.floorItems.some(fi => fi.tx === nx && fi.ty === ny)) continue;
        return { tx: nx, ty: ny };
      }
    }
  }
  return { tx: startTx, ty: startTy };
}

// ═══════════════════════════════════════════════
// 魔法 VFX ディスパッチャ
// ═══════════════════════════════════════════════

function _dispatchSpellVfx(
  spellId:        string,
  ctx:            PlayerActionContext,
  affectedTiles:  Array<{ tx: number; ty: number }>,
): void {
  const onVfx = ctx.onSpellVfx;
  if (!onVfx) return;
  const spell = SPELLS[spellId];
  if (!spell) return;

  const ps = ctx.player.screenPos(ctx.camOffX, ctx.camOffY);
  const sx0 = ps.sx;
  const sy0 = ps.sy;
  const dirX = ctx.player.dirX ?? 0;
  const dirY = ctx.player.dirY ?? 1;

  switch (spellId) {
    case 'meteor': {
      // 生存中の敵を中心に、さらに周囲床タイルを追加
      const targets: Array<{ tx: number; ty: number }> = [];
      for (const e of ctx.enemies) {
        if (e.alive) targets.push({ tx: e.tx, ty: e.ty });
      }
      // 最低 3 発・最大 4 発に抑制（描画負荷）
      const MAX_METEORS = 4;
      if (targets.length > MAX_METEORS) targets.length = MAX_METEORS;
      const need = Math.max(3, targets.length);
      for (let tries = 0; targets.length < need && tries < 40; tries++) {
        const tx = Math.floor(Math.random() * ctx.map.cols);
        const ty = Math.floor(Math.random() * ctx.map.rows);
        if (ctx.map.isWalkable(tx, ty)) targets.push({ tx, ty });
      }
      const delays = targets.map((_, i) => i * 0.1 + Math.random() * 0.06);
      onVfx('meteor', { impacts: targets, delays }, 1.5);
      ctx.onShake?.(12, 0.35);
      ctx.onFlash('rgba(255,180,80,0.25)');
      break;
    }

    case 'fireball': {
      const cx = ctx.player.tx + dirX * 2;
      const cy = ctx.player.ty + dirY * 2;
      onVfx('fireball', { sx: sx0, sy: sy0, tx: cx, ty: cy }, 0.6);
      ctx.onShake?.(6, 0.16);
      break;
    }

    case 'thunder':
    case 'chain_bolt': {
      if (affectedTiles.length > 0) {
        // 多すぎると重いので最大 4 体に
        const tiles = affectedTiles.slice(0, 4);
        for (const t of tiles) {
          const sx1 = (t.tx + 0.5) * TILE_SIZE + ctx.camOffX;
          const sy1 = (t.ty + 0.5) * TILE_SIZE + ctx.camOffY;
          onVfx('thunder', { sx0, sy0, tx: t.tx, ty: t.ty, seed: Math.random() * 1000 }, 0.22);
        }
        ctx.onShake?.(4, 0.12);
      }
      break;
    }

    case 'blizzard':
    case 'wind_cross': {
      onVfx('blizzard', { sx0, sy0 }, 0.45);
      break;
    }

    case 'frost_nova': {
      onVfx('frost_nova', { sx0, sy0, range: spell.rangeVal }, 0.4);
      break;
    }

    case 'holy_nova':
    case 'sanctuary':
    case 'mana_burst':
    case 'war_stomp':
    case 'whirlwind':
    case 'drain':
    case 'smoke_bomb':
    case 'caltrops':
    case 'quake': {
      // 各呪文に合った色のリング
      if (spellId === 'holy_nova' || spellId === 'sanctuary') {
        onVfx('holy_nova', { sx0, sy0, range: spell.rangeVal }, 0.45);
      } else if (spellId === 'mana_burst') {
        onVfx('mana_burst', { sx0, sy0, range: spell.rangeVal }, 0.6);
        ctx.onShake?.(6, 0.16);
      } else if (spellId === 'quake') {
        // 画面に地割れを数本（8→5）
        const cracks: number[] = [];
        for (let i = 0; i < 5; i++) {
          const x0 = Math.random() * ctx.canvasW;
          const y0 = Math.random() * ctx.canvasH;
          const x1 = x0 + (Math.random() - 0.5) * 160;
          const y1 = y0 + (Math.random() - 0.5) * 160;
          cracks.push(x0, y0, x1, y1);
        }
        onVfx('quake', { cracks }, 0.55);
        ctx.onShake?.(10, 0.4);
      } else {
        onVfx('generic_ring', { sx0, sy0, color: spell.color, range: spell.rangeVal }, 0.35);
      }
      break;
    }

    case 'holy_strike': {
      onVfx('holy_strike', { tiles: affectedTiles }, 0.55);
      ctx.onFlash('rgba(255,250,180,0.25)');
      break;
    }

    case 'arcane_ray': {
      // 直線末端の画面座標を出す
      const last = affectedTiles[affectedTiles.length - 1] ?? { tx: ctx.player.tx + dirX, ty: ctx.player.ty + dirY };
      const sx1 = (last.tx + 0.5) * TILE_SIZE + ctx.camOffX;
      const sy1 = (last.ty + 0.5) * TILE_SIZE + ctx.camOffY;
      onVfx('arcane_ray', { sx0, sy0, sx1, sy1 }, 0.5);
      ctx.onFlash('rgba(232,121,249,0.22)');
      break;
    }

    case 'dark_bolt':
    case 'assassinate': {
      const last = affectedTiles[affectedTiles.length - 1] ?? { tx: ctx.player.tx + dirX, ty: ctx.player.ty + dirY };
      const sx1 = (last.tx + 0.5) * TILE_SIZE + ctx.camOffX;
      const sy1 = (last.ty + 0.5) * TILE_SIZE + ctx.camOffY;
      onVfx('dark_bolt', { sx0, sy0, sx1, sy1 }, 0.4);
      break;
    }

    case 'venom_blade':
    case 'shield_bash': {
      const last = affectedTiles[affectedTiles.length - 1] ?? { tx: ctx.player.tx + dirX, ty: ctx.player.ty + dirY };
      const sx1 = (last.tx + 0.5) * TILE_SIZE + ctx.camOffX;
      const sy1 = (last.ty + 0.5) * TILE_SIZE + ctx.camOffY;
      onVfx('arcane_ray', { sx0, sy0, sx1, sy1 }, 0.3);
      break;
    }

    case 'gravity':
    case 'void_rift': {
      if (spellId === 'void_rift') {
        // 画面全体にランダムな裂け目を 4 本
        const rifts: number[] = [];
        for (let i = 0; i < 4; i++) {
          const x0 = Math.random() * ctx.canvasW;
          const y0 = Math.random() * ctx.canvasH;
          const ang = Math.random() * Math.PI * 2;
          const len = 80 + Math.random() * 160;
          rifts.push(x0, y0, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len);
        }
        onVfx('void_rift', { rifts }, 0.6);
        ctx.onShake?.(9, 0.3);
      } else {
        onVfx('gravity', {}, 0.6);
        ctx.onShake?.(5, 0.25);
      }
      break;
    }

    // 自己対象系 → 光のリング
    case 'heal':
    case 'regen':
    case 'haste':
    case 'barrier':
    case 'war_cry':
    case 'berserk':
    case 'iron_skin':
    case 'cure':
    case 'taunt':
    case 'teleport':
    case 'shadow_step':
    case 'time_stop': {
      onVfx('generic_ring', { sx0, sy0, color: spell.color, range: 2 }, 0.6);
      break;
    }

    case 'poison_mist':
    case 'sleep_gas': {
      // 広がる霧のリング
      const cx = ctx.player.tx + dirX * 2;
      const cy = ctx.player.ty + dirY * 2;
      const csx = (cx + 0.5) * TILE_SIZE + ctx.camOffX;
      const csy = (cy + 0.5) * TILE_SIZE + ctx.camOffY;
      onVfx('generic_ring', { sx0: csx, sy0: csy, color: spell.color, range: spell.rangeVal }, 0.8);
      break;
    }

    default: {
      // 未定義の呪文はリング
      onVfx('generic_ring', { sx0, sy0, color: spell.color, range: Math.max(1, spell.rangeVal) }, 0.5);
    }
  }
}
