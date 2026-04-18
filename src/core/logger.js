// ─────────────────────────────────────────────
// logger.js  メッセージログ
// ─────────────────────────────────────────────

const MAX_LINES = 10;

const ICON_MAP = {
  normal: '·',
  damage: '⚔',
  heal:   '♥',
  warn:   '!',
};

export class Logger {
  /** @param {HTMLElement} el  ログを表示する DOM 要素 */
  constructor(el) {
    this._el    = el;
    this._lines = [];
  }

  /**
   * メッセージを 1 行追加する
   * @param {string} msg
   * @param {'normal'|'damage'|'heal'|'warn'} type
   */
  add(msg, type = 'normal') {
    this._lines.push({ msg, type });
    if (this._lines.length > MAX_LINES) this._lines.shift();
    this._render();
  }

  clear() {
    this._lines = [];
    this._render();
  }

  _render() {
    const total = this._lines.length;
    this._el.innerHTML = this._lines
      .map(({ msg, type }, i) => {
        const age   = total - 1 - i;           // 0=最新, 古いほど大きい
        const alpha = age === 0 ? 1 : Math.max(0.28, 1 - age * 0.13);
        const icon  = ICON_MAP[type] ?? '·';
        return `<div class="log-row type-${type}" style="opacity:${alpha.toFixed(2)}">`
          + `<span class="log-icon">${icon}</span>`
          + `<span class="log-text">${msg}</span>`
          + `</div>`;
      })
      .join('');
    this._el.scrollTop = this._el.scrollHeight;
  }
}
