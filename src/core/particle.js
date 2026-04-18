// ─────────────────────────────────────────────
// particle.js  ParticleSystem（ヒットエフェクト）
// ─────────────────────────────────────────────

class Particle {
  constructor(x, y, color) {
    const angle  = Math.random() * Math.PI * 2;
    const speed  = 80 + Math.random() * 180;

    this.x       = x;
    this.y       = y;
    this.vx      = Math.cos(angle) * speed;
    this.vy      = Math.sin(angle) * speed;
    this.color   = color;
    this.size    = 2 + Math.random() * 3;
    this.life    = 0.22 + Math.random() * 0.18;
    this.maxLife = this.life;
  }
}

export class ParticleSystem {
  constructor() {
    this._list = [];
  }

  /**
   * ヒットエフェクトを生成する
   * @param {number} x
   * @param {number} y
   * @param {string} color  CSS カラー
   * @param {number} count
   */
  spawn(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      this._list.push(new Particle(x, y, color));
    }
  }

  update(dt) {
    for (const p of this._list) {
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vx   *= 0.88;
      p.vy   *= 0.88;
      p.life -= dt;
    }
    this._list = this._list.filter(p => p.life > 0);
  }

  draw(ctx) {
    for (const p of this._list) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife) + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear() { this._list = []; }
}
