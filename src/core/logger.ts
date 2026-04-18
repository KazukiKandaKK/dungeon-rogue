// ─────────────────────────────────────────────
// logger.ts  メッセージログ
// ─────────────────────────────────────────────

const MAX_LINES = 10;

type LogType = 'normal' | 'damage' | 'heal' | 'warn';

const ICON_MAP: Record<LogType, string> = {
  normal: '·',
  damage: '⚔',
  heal:   '♥',
  warn:   '!',
};

interface LogLine {
  msg:  string;
  type: LogType;
}

export class Logger {
  private _el:    HTMLElement;
  private _lines: LogLine[];

  /** @param el ログを表示する DOM 要素 */
  constructor(el: HTMLElement) {
    this._el    = el;
    this._lines = [];
  }

  /** メッセージを 1 行追加する */
  add(msg: string, type: LogType = 'normal'): void {
    this._lines.push({ msg, type });
    if (this._lines.length > MAX_LINES) this._lines.shift();
    this._render();
  }

  clear(): void {
    this._lines = [];
    this._render();
  }

  private _render(): void {
    const total = this._lines.length;
    this._el.innerHTML = this._lines
      .map(({ msg, type }, i) => {
        const age   = total - 1 - i; // 0=最新, 古いほど大きい
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
