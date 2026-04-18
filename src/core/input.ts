// ─────────────────────────────────────────────
// input.ts  InputManager クラス
//   isDown()      : キーが押し続けられているか
//   justPressed() : そのフレームで押した瞬間か（flush() 呼び出しまで有効）
//   heldRepeat()  : 押した瞬間 or 長押しリピートか
// ─────────────────────────────────────────────

export class InputManager {
  private _down:        Set<string>;
  private _justPressed: Set<string>;
  private _holdStart:   Map<string, number>;
  private _lastRepeat:  Map<string, number>;

  constructor() {
    this._down        = new Set();
    this._justPressed = new Set();
    this._holdStart   = new Map();
    this._lastRepeat  = new Map();

    window.addEventListener('keydown', e => {
      // Cmd/Ctrl 修飾付きはブラウザがショートカット処理し keyup が来ないためスキップ
      if (e.metaKey || e.ctrlKey) {
        // 矢印キー + Cmd はブラウザの履歴ナビゲーション（← 戻る / → 進む）を防ぐ
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
          e.preventDefault();
        }
        this._releaseAll();
        return;
      }

      if (!this._down.has(e.code)) {
        this._justPressed.add(e.code);
        this._holdStart.set(e.code, performance.now());
        this._lastRepeat.delete(e.code);
      }
      this._down.add(e.code);

      // ページスクロール・スペース動作を抑制
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', e => {
      this._down.delete(e.code);
      this._holdStart.delete(e.code);
      this._lastRepeat.delete(e.code);

      // Meta キーが離されたとき、他のキーの keyup が来ていない可能性があるので全解放
      if (e.code === 'MetaLeft' || e.code === 'MetaRight') {
        this._releaseAll();
      }
    });

    // ウィンドウがフォーカスを失ったときも全解放
    window.addEventListener('blur', () => this._releaseAll());
  }

  /** 全キー状態をリセット（Cmd/blur 対策） */
  private _releaseAll(): void {
    this._down.clear();
    this._holdStart.clear();
    this._lastRepeat.clear();
  }

  /** キーが押し続けられているか */
  isDown(code: string): boolean { return this._down.has(code); }

  /** そのフレームで初めて押されたか（ループの最後に flush() を呼ぶこと） */
  justPressed(code: string): boolean { return this._justPressed.has(code); }

  /**
   * 押した瞬間、または長押しリピートタイミングか
   * @param code         KeyboardEvent.code
   * @param initialDelay 最初のリピートまでの待機時間 (ms)  default 220
   * @param interval     リピート間隔 (ms)                   default 80
   */
  heldRepeat(code: string, initialDelay = 220, interval = 80): boolean {
    if (this._justPressed.has(code)) return true;
    if (!this._down.has(code)) return false;
    const now     = performance.now();
    const start   = this._holdStart.get(code) ?? now;
    const elapsed = now - start;
    if (elapsed < initialDelay) return false;
    const last = this._lastRepeat.get(code) ?? (start + initialDelay - interval);
    if (now - last >= interval) {
      this._lastRepeat.set(code, now);
      return true;
    }
    return false;
  }

  /** フレーム末に呼び出す。justPressed をクリアする */
  flush(): void { this._justPressed.clear(); }
}
