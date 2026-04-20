// ─────────────────────────────────────────────
// combat.ts  攻撃解決ロジック（DEF・クリティカル・1HP生存）
//
// main.js から段階的に移行した戦闘コア関数。
// グローバル変数を引数で受け取り、副作用を返り値や
// コールバックで表現することで、純粋に近い設計を目指す。
// ─────────────────────────────────────────────

import type { Player }          from '../entities/player.js';
import type { Actor }           from '../entities/actor.js';
import type { Logger }          from '../core/logger.js';
import type { ParticleSystem }  from '../core/particle.js';
import type { StatusEffectEntry } from '../types.js';
import type { FloatingText }    from '../core/game-context.js';

// ── 戦闘に参加できるアクターの最小インターフェース ────────

/**
 * Player・Enemy 双方が満たすべき戦闘インターフェース。
 * Enemy は statusEffects を持たない場合があるため optional にしている。
 */
export interface CombatActor {
  name:            string;
  def:             number;
  hp:              number;
  maxHP:           number;
  tx:              number;
  ty:              number;
  alive:           boolean;
  statusEffects?:  StatusEffectEntry[];
  /** 謎の結界が有効な間、プレイヤーの攻撃は無効化される（ボス専用）。 */
  riddleActive?:   boolean;
  takeDamage(amount: number, fromDirX?: number, fromDirY?: number): number;
  screenPos(camOffX: number, camOffY: number): { sx: number; sy: number };
}

// ── 戦闘コンテキスト（依存する外部サービス） ─────────────

export interface CombatContext {
  /** プレイヤー本体（attacker/defender との同一性チェックに使う） */
  player:    Player;
  logger:    Logger;
  particles: ParticleSystem;
  camOffX:   number;
  camOffY:   number;
  /**
   * 画面フラッシュを更新するコールバック。
   * @param color   CSS color 文字列（例: 'rgba(250,204,21,0.18)'）
   */
  onFlash:   (color: string) => void;
  /** スクリーンシェイク（強度 px / 継続秒） */
  onShake?:       (intensity: number, duration: number) => void;
  /** ヒットストップ（継続秒） */
  onHitStop?:     (seconds: number) => void;
  /** ダメージ数値などのフローティングテキスト */
  onFloatingText?: (ft: FloatingText) => void;
}

// ── 攻撃結果 ─────────────────────────────────────

export interface AttackResult {
  damage:   number;
  isCrit:   boolean;
  survived: boolean;
}

// ── 攻撃解決 ─────────────────────────────────────

/**
 * 攻撃を解決する（DEF軽減・クリティカル・1HP生存・武器耐久・吸血・スタン・毒）
 *
 * @param attacker 攻撃する側（Player or Enemy）
 * @param defender 攻撃を受ける側（Player or Enemy）
 * @param rawAtk   装備込みの攻撃力
 * @param ctx      依存するゲームサービス群
 * @returns 実際に与えたダメージ量
 */
export function attack(
  attacker: CombatActor,
  defender: CombatActor,
  rawAtk:   number,
  ctx:      CombatContext,
): number {
  const { player, logger, particles, camOffX, camOffY, onFlash, onShake, onHitStop, onFloatingText } = ctx;
  const isPlayerAttacking = (attacker === (player as unknown as CombatActor));
  const isPlayerDefending = (defender === (player as unknown as CombatActor));

  // ── 結界（謎を解いていないボス）: プレイヤーの攻撃は通らない ──
  if (isPlayerAttacking && defender.riddleActive) {
    const { sx, sy } = defender.screenPos(camOffX, camOffY);
    particles.spawn(sx, sy, '#fde047', 8);
    onFlash('rgba(253,224,71,0.18)');
    if (onShake) onShake(3, 0.10);
    if (onFloatingText) {
      onFloatingText({
        text:  '🛡 結界',
        x: sx, y: sy - 18,
        alpha: 1, scale: 1.1,
        color: '#fde047',
        life:  0.7, maxLife: 0.7,
        big:   false,
      });
    }
    const sealLabel = (defender as { sealLabel?: string | null }).sealLabel ?? null;
    if (sealLabel) {
      logger.add(`🛡 ${defender.name} の封印（${sealLabel}）を先に解け！`, 'warn');
    } else {
      logger.add(`🛡 ${defender.name} は封印に守られている！封印を解け！`, 'warn');
    }
    return 0;
  }

  const def    = defender.def ?? 0;
  let damage   = Math.max(1, rawAtk - def);

  // ── クリティカル（攻撃者がプレイヤーのとき） ──────────
  let isCrit = false;
  if (isPlayerAttacking) {
    const critChance = 0.05 + (player.luk ?? 0) * 0.03;
    if (Math.random() < critChance) {
      damage = Math.floor(damage * 1.5);
      isCrit = true;
    }
  }

  // ── 1HP 生存（防御者がプレイヤーのとき） ────────────
  let survived = false;
  if (isPlayerDefending && defender.hp - damage <= 0 && defender.hp > 1) {
    const surviveChance = (player.luk ?? 0) * 0.05;
    if (Math.random() < surviveChance) {
      damage   = defender.hp - 1;
      survived = true;
    }
  }

  // ── ダメージ適用 ─────────────────────────────────
  const dir = {
    x: Math.sign(defender.tx - attacker.tx),
    y: Math.sign(defender.ty - attacker.ty),
  };
  defender.takeDamage(damage, dir.x, dir.y);

  // ── 武器耐久（攻撃者がプレイヤーのとき） ────────────
  if (isPlayerAttacking) {
    const w = player.equip?.weapon;
    if (w?.durability !== undefined) {
      w.durability--;
      if (w.durability <= 0) {
        logger.add(`${w.icon}${w.name} が壊れた！`, 'warn');
        player.equip.weapon = null;
      }
    }

    // 吸血（武器 or アクセサリ）
    const lifeStealRate = (w?.lifeSteal ?? 0) + (player.equip?.accessory?.lifeSteal ?? 0);
    if (lifeStealRate > 0 && damage > 0 && !isPlayerDefending) {
      const stolen = Math.max(1, Math.floor(damage * lifeStealRate));
      player.hp = Math.min(player.maxHP, player.hp + stolen);
      logger.add(`🩸 吸血 +${stolen}HP`, 'heal');
    }

    // スタン付与
    const stunChance = w?.stunOnHit ?? 0;
    if (stunChance > 0 && Math.random() < stunChance && !isPlayerDefending) {
      if (!defender.statusEffects) (defender as { statusEffects: StatusEffectEntry[] }).statusEffects = [];
      const ex = defender.statusEffects!.find(e => e.type === 'stun');
      if (!ex) defender.statusEffects!.push({ type: 'stun', turns: 2, power: 0 });
      logger.add(`⚡ スタン！`, 'warn');
    }

    // 毒付与
    if (w?.poisonOnHit && !isPlayerDefending) {
      if (!defender.statusEffects) (defender as { statusEffects: StatusEffectEntry[] }).statusEffects = [];
      const ex = defender.statusEffects!.find(e => e.type === 'poison');
      if (!ex) defender.statusEffects!.push({ type: 'poison', turnsLeft: 6, power: 2 });
    }
  }

  // ── 防具耐久（防御者がプレイヤーのとき） ────────────
  //   head / chest / waist / legs のうち「装備中かつ耐久値がある」枠から
  //   ランダムに1つ選んで耐久を1消費。0になったら解除。
  if (isPlayerDefending) {
    const armorSlots: Array<'head' | 'chest' | 'waist' | 'legs'> = ['head', 'chest', 'waist', 'legs'];
    const candidates = armorSlots.filter(s => {
      const it = player.equip?.[s];
      return it && it.durability !== undefined;
    });
    if (candidates.length > 0) {
      const slot = candidates[Math.floor(Math.random() * candidates.length)];
      const a    = player.equip[slot];
      if (a && a.durability !== undefined) {
        a.durability--;
        if (a.durability <= 0) {
          logger.add(`${a.icon}${a.name} が壊れた！`, 'warn');
          player.equip[slot] = null;
        }
      }
    }
  }

  // ── 視覚エフェクト（軽量化）────────────────────────
  const { sx, sy } = defender.screenPos(camOffX, camOffY);
  const hitColor   = isPlayerAttacking ? '#fde68a' : '#fca5a5';
  particles.spawn(sx, sy, hitColor, isCrit ? 10 : 5);
  // 撃破時の追加バースト
  if (!defender.alive) {
    particles.spawn(sx, sy, hitColor, 7);
  }

  if (isPlayerAttacking) {
    onFlash(isCrit ? 'rgba(255,210,80,0.20)' : 'rgba(250,204,21,0.08)');
  } else if (isPlayerDefending) {
    onFlash(isCrit ? 'rgba(255,80,80,0.22)' : 'rgba(239,68,68,0.12)');
  }
  // クリティカル：被弾位置に小バースト（フラッシュは上で既に強化済）
  if (isCrit) {
    particles.spawn(sx, sy, '#ffd24a', 6);
  }

  // ── シェイク / ヒットストップ（控えめに） ─────────
  const killed = !defender.alive;
  if (onShake) {
    if (killed)                 onShake(7, 0.18);
    else if (isCrit)            onShake(5, 0.14);
    else if (isPlayerDefending) onShake(3, 0.10);
    else                        onShake(2, 0.07);
  }
  if (onHitStop) {
    if (killed)      onHitStop(0.07);
    else if (isCrit) onHitStop(0.04);
  }

  // ── ダメージ数値（寿命短め・揺れ無し）──────────────
  if (onFloatingText) {
    const dmgColor = isCrit
      ? '#fca5a5'
      : isPlayerDefending ? '#f87171' : '#fef3c7';
    const life = isCrit ? 0.7 : 0.5;
    onFloatingText({
      text:   isCrit ? `${damage}!` : `${damage}`,
      x:      sx,
      y:      sy - 18,
      alpha:  1,
      scale:  1,
      color:  dmgColor,
      life, maxLife: life,
      big:    isCrit,
    });
  }

  // ── ログ ─────────────────────────────────────────
  if (survived) {
    logger.add(`…奇跡的に1HPで生き残った！（運が良かった！）`, 'warn');
  }

  if (!defender.alive) {
    logger.add(`${attacker.name} が ${defender.name} を倒した！`, 'warn');
  } else if (isPlayerAttacking) {
    const critText = isCrit ? ' 【クリティカル！】' : '';
    const defText  = def > 0 ? `（DEF${def}軽減）` : '';
    logger.add(`${defender.name} に ${damage} ダメージ！${defText}${critText}（残HP: ${defender.hp}）`, 'damage');
  } else {
    const defText = def > 0 ? `（DEF${def}軽減）` : '';
    logger.add(`${attacker.name} の攻撃！ ${damage} ダメージ${defText}（残HP: ${defender.hp}）`, 'damage');
  }

  return damage;
}
