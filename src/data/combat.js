// ─────────────────────────────────────────────
// combat.js  CombatSystem
//   プレイヤー攻撃・敵の自動攻撃の解決を担う
// ─────────────────────────────────────────────

import { ATTACK_RANGE, ATTACK_ARC } from '../entities/player.js';
import { STATE }                     from '../entities/enemy.js';

const PLAYER_ATTACK_DAMAGE = 2;

export class CombatSystem {
  /**
   * @param {import('./particle.js').ParticleSystem} particles
   */
  constructor(particles) {
    this.particles = particles;
  }

  /**
   * プレイヤーの近接攻撃を解決する
   * 呼び出し側（main.js）が「攻撃キーが押された瞬間」に 1 回だけ呼ぶ
   *
   * @param {import('./player.js').Player}  player
   * @param {import('./enemy.js').Enemy[]}  enemies
   */
  resolvePlayerAttack(player, enemies) {
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (!this._inPlayerArc(player, enemy)) continue;

      const hit = enemy.takeDamage(PLAYER_ATTACK_DAMAGE, player.x, player.y);
      if (hit) {
        // 黄色い火花
        this.particles.spawn(enemy.x, enemy.y - enemy.hitH / 2, '#ffcc00', 10);
      }
    }
  }

  /**
   * ATTACK 状態の敵がプレイヤーへ自動攻撃する（毎フレーム呼ぶ）
   *
   * @param {import('./enemy.js').Enemy[]}  enemies
   * @param {import('./player.js').Player}  player
   */
  resolveEnemyAttacks(enemies, player) {
    if (!player.alive) return;

    for (const enemy of enemies) {
      if (!enemy.alive)                    continue;
      if (enemy.state !== STATE.ATTACK)   continue;
      if (enemy.attackCooldown > 0)       continue;

      const dx   = player.x - enemy.x;
      const dy   = player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > enemy.attackRadius)      continue;

      const hit = player.takeDamage(enemy.attackDmg, enemy.x, enemy.y);
      if (hit) {
        // 赤い火花
        this.particles.spawn(player.x, player.y, '#ff6b6b', 8);
        enemy.attackCooldown = enemy.ATTACK_COOLDOWN;
      }
    }
  }

  // ── 内部ユーティリティ ──────────────────────────

  /** target がプレイヤーの攻撃扇形の中に入っているか */
  _inPlayerArc(player, target) {
    const dx   = target.x - player.x;
    const dy   = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > ATTACK_RANGE) return false;

    // 向いている方向との内積 → 角度チェック
    const mag = Math.sqrt(player.dirX ** 2 + player.dirY ** 2) || 1;
    const dot = (dx / dist) * (player.dirX / mag)
              + (dy / dist) * (player.dirY / mag);

    return dot > Math.cos(ATTACK_ARC); // ATTACK_ARC 以内なら true
  }
}
