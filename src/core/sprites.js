// ─────────────────────────────────────────────
// sprites.js  SVG スプライトのロード & 描画
// ─────────────────────────────────────────────

export class SpriteLoader {
  constructor() {
    this._cache = new Map(); // name → HTMLImageElement
  }

  /**
   * SVG ファイルを非同期でロードしてキャッシュ
   * @param {string} name  識別名
   * @param {string} url   ファイルパス
   */
  load(name, url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => { this._cache.set(name, img); resolve(img); };
      img.onerror = () => reject(new Error(`Sprite load failed: ${url}`));
      img.src = url;
    });
  }

  /**
   * 複数スプライトを並行ロード
   * @param {Array<[string, string]>} entries  [[name, url], ...]
   */
  async loadAll(entries) {
    await Promise.all(entries.map(([n, u]) => this.load(n, u)));
  }

  /** キャッシュ済み Image を取得（未ロードなら null） */
  get(name) { return this._cache.get(name) ?? null; }

  /**
   * スプライトを Canvas に描画（中心座標指定）
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} name
   * @param {number} cx  中心 X（px）
   * @param {number} cy  中心 Y（px）
   * @param {number} w   描画幅
   * @param {number} h   描画高さ
   */
  draw(ctx, name, cx, cy, w, h) {
    const img = this._cache.get(name);
    if (!img) return;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  }
}
