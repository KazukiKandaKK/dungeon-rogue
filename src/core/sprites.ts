// ─────────────────────────────────────────────
// sprites.ts  SVG スプライトのロード & 描画
// ─────────────────────────────────────────────

export class SpriteLoader {
  private _cache: Map<string, HTMLImageElement>;

  constructor() {
    this._cache = new Map();
  }

  /**
   * SVG ファイルを非同期でロードしてキャッシュ
   * @param name 識別名
   * @param url  ファイルパス
   */
  load(name: string, url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => { this._cache.set(name, img); resolve(img); };
      img.onerror = () => reject(new Error(`Sprite load failed: ${url}`));
      img.src = url;
    });
  }

  /**
   * 複数スプライトを並行ロード
   * @param entries [[name, url], ...]
   */
  async loadAll(entries: [string, string][]): Promise<void> {
    await Promise.all(entries.map(([n, u]) => this.load(n, u)));
  }

  /** キャッシュ済み Image を取得（未ロードなら null） */
  get(name: string | null): HTMLImageElement | null {
    if (!name) return null;
    return this._cache.get(name) ?? null;
  }

  /**
   * スプライトを Canvas に描画（中心座標指定）
   * @param ctx
   * @param name 識別名
   * @param cx   中心 X（px）
   * @param cy   中心 Y（px）
   * @param w    描画幅
   * @param h    描画高さ
   */
  draw(
    ctx:  CanvasRenderingContext2D,
    name: string,
    cx:   number,
    cy:   number,
    w:    number,
    h:    number,
  ): void {
    const img = this._cache.get(name);
    if (!img) return;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  }
}
