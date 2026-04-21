// ─────────────────────────────────────────────
// map.ts  GameMap クラス（2D トップダウン描画・テーマ対応）
// ─────────────────────────────────────────────

import { TILE_DEF, TILE, TILE_SIZE, THEMES } from './tiles.js';
import type { TileType, ThemeId } from './tiles.js';
import { DungeonGenerator, BossArenaGenerator, BaseRoomGenerator } from './dungeon.js';
import type { Room } from './dungeon.js';
import { ForestGenerator }  from './forest.js';
import type { ExitPos, ExitMap } from './forest.js';

const ARROW_PERIOD = 1.4;
const CULL_MARGIN  = TILE_SIZE * 2;
const CHUNK_TILES  = 8;  // 1チャンク 8×8 タイル = 768×768px = ~2.3MB

interface MapGeneratorResult {
  grid:             TileType[][];
  exits:            ExitMap;
  stairs?:          ExitPos | null;
  rooms?:           Room[];
  monsterHouseRoom?: Room | null;
}

interface GeneratorLike {
  generate(): MapGeneratorResult;
  trapDensity?: number;
}

export class GameMap {
  cols:             number;
  rows:             number;
  tileSize:         number;
  theme:            ThemeId;
  bossArena:        boolean;
  trapDensity:      number;
  grid:             TileType[][];
  exits:            ExitMap;
  stairs:           ExitPos | null;
  rooms:            Room[];
  monsterHouseRoom: Room | null;
  revealedTraps:    Set<string>;
  trapTypes:        Map<string, string>;
  // ── 静的タイル描画キャッシュ（チャンク単位） ────────────────
  private _chunks: Map<string, HTMLCanvasElement> = new Map();
  // ── 松明（壁掛け）座標。ダンジョン・街テーマで自動配置 ─────────
  torches: { tx: number; ty: number }[] = [];
  // ── プレイヤーが設置した壁の素材マップ（"tx,ty" → 'stone' | 'wood'） ──
  //    存在しない = 自然壁（単色黒で描画）。存在する = 素材別の見た目で描画
  placedMaterials: Map<string, 'stone' | 'wood'> = new Map();

  constructor(
    cols:        number,
    rows:        number,
    theme:       ThemeId = 'dungeon',
    bossArena    = false,
    trapDensity  = 1,
  ) {
    this.cols        = cols;
    this.rows        = rows;
    this.tileSize    = TILE_SIZE;
    this.theme       = theme;
    this.bossArena   = bossArena;
    this.trapDensity = trapDensity;

    const gen: GeneratorLike = bossArena
      ? new BossArenaGenerator(cols, rows)
      : this._makeGenerator(cols, rows, theme);
    if ('trapDensity' in gen) gen.trapDensity = trapDensity;
    const result = gen.generate();
    this.grid             = result.grid;
    this.exits            = result.exits ?? {}; // 後方互換（BossArena 等）
    this.stairs           = result.stairs ?? null; // {tx,ty} | null
    this.rooms            = result.rooms ?? [];
    this.monsterHouseRoom = result.monsterHouseRoom ?? null;
    this.revealedTraps = new Set(); // '${tx},${ty}' strings of triggered traps
    this.trapTypes     = new Map(); // '${tx},${ty}' → trapType string（main.jsで設定）
    this._collectTorches();
  }

  /**
   * 松明配置を計算する。
   * - dungeon / town テーマのみ対象
   * - 南が床/通路の壁タイル（前面に明かりが落ちる位置）
   * - 決定的なシード（tx*7+ty*11）で間引いて散らす
   */
  private _collectTorches(): void {
    if (this.theme !== 'dungeon') return;
    const list: { tx: number; ty: number }[] = [];
    for (let ty = 1; ty < this.rows - 1; ty++) {
      for (let tx = 1; tx < this.cols - 1; tx++) {
        if (this.grid[ty][tx] !== TILE.WALL) continue;
        const south = this.grid[ty + 1]?.[tx];
        if (south !== TILE.FLOOR && south !== TILE.CORRIDOR) continue;
        const seed = (tx * 7 + ty * 11) % 13;
        if (seed !== 0) continue;
        // 隣接松明の被り抑止
        if (list.some(t => Math.abs(t.tx - tx) <= 2 && t.ty === ty)) continue;
        list.push({ tx, ty });
      }
    }
    this.torches = list;
  }

  private _makeGenerator(cols: number, rows: number, theme: ThemeId): GeneratorLike {
    if (theme === 'base')   return new BaseRoomGenerator(cols, rows);
    if (theme === 'forest') return new ForestGenerator(cols, rows);
    return new DungeonGenerator(cols, rows);
  }

  isWalkable(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
    return TILE_DEF[this.grid[ty][tx]].walkable;
  }

  getExitDir(tx: number, ty: number): string | null {
    for (const [dir, pos] of Object.entries(this.exits)) {
      if (pos && pos.tx === tx && pos.ty === ty) return dir;
    }
    return null;
  }

  isStairs(tx: number, ty: number): boolean {
    return this.stairs !== null && this.stairs.tx === tx && this.stairs.ty === ty;
  }

  findSpawnTile(): ExitPos {
    // 中央から螺旋状に探索し、通路エンドや出口・階段を避ける
    const cx = Math.floor(this.cols / 2);
    const cy = Math.floor(this.rows / 2);
    for (let r = 0; r < Math.max(this.cols, this.rows); r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tx = cx + dx, ty = cy + dy;
          if (!this.isWalkable(tx, ty)) continue;
          if (this.getExitDir(tx, ty)) continue; // 出口タイルは避ける
          if (this.isStairs(tx, ty)) continue;   // 階段タイルは避ける
          const t = this.grid[ty]?.[tx];
          if (t === TILE.TRAP || t === TILE.WATER) continue; // 罠・水はスポーン除外
          // 境界付近（端5タイル以内）は避ける
          if (tx < 5 || ty < 5 || tx >= this.cols - 5 || ty >= this.rows - 5) continue;
          return { tx, ty };
        }
      }
    }
    return { tx: 0, ty: 0 };
  }

  getActorAt(tx: number, ty: number, actors: { alive: boolean; tx: number; ty: number }[]): typeof actors[0] | null {
    return actors.find(a => a.alive && a.tx === tx && a.ty === ty) ?? null;
  }

  /**
   * 2D トップダウン描画
   *
   * 静的タイル（壁・床・通路）はチャンク単位でオフスクリーンキャッシュし、
   * 描画時は drawImage で差分なくブリットする。動的な要素（階段の脈動・
   * 出口矢印・水・柱・露出した罠）はキャッシュ後に毎フレーム描き重ねる。
   */
  draw(
    ctx:           CanvasRenderingContext2D,
    camOffX:       number,
    camOffY:       number,
    now            = 0,
    _exploredTiles: unknown = null,
  ): void {
    const W  = ctx.canvas.width;
    const H  = ctx.canvas.height;
    const ts = TILE_SIZE;

    // 可視チャンク範囲を決定
    const tx0 = Math.max(0, Math.floor((-camOffX - CULL_MARGIN) / ts));
    const ty0 = Math.max(0, Math.floor((-camOffY - CULL_MARGIN) / ts));
    const tx1 = Math.min(this.cols - 1, Math.floor((W - camOffX + CULL_MARGIN) / ts));
    const ty1 = Math.min(this.rows - 1, Math.floor((H - camOffY + CULL_MARGIN) / ts));
    if (tx1 < 0 || ty1 < 0 || tx0 >= this.cols || ty0 >= this.rows) {
      this._drawExitArrows(ctx, camOffX, camOffY, now);
      this._drawStairs(ctx, camOffX, camOffY, now);
      this._drawObstacles(ctx, camOffX, camOffY, now);
      return;
    }
    const cx0 = Math.floor(tx0 / CHUNK_TILES);
    const cy0 = Math.floor(ty0 / CHUNK_TILES);
    const cx1 = Math.floor(tx1 / CHUNK_TILES);
    const cy1 = Math.floor(ty1 / CHUNK_TILES);

    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const chunk = this._getChunk(cx, cy);
        if (!chunk) continue;
        const dx = cx * CHUNK_TILES * ts + camOffX;
        const dy = cy * CHUNK_TILES * ts + camOffY;
        ctx.drawImage(chunk, dx, dy);
      }
    }

    this._drawTorchFlames(ctx, camOffX, camOffY, now);
    this._drawExitArrows(ctx, camOffX, camOffY, now);
    this._drawStairs(ctx, camOffX, camOffY, now);
    this._drawObstacles(ctx, camOffX, camOffY, now);
  }

  /** 松明の炎・床光だまりを毎フレーム描画 */
  private _drawTorchFlames(
    ctx:     CanvasRenderingContext2D,
    camOffX: number,
    camOffY: number,
    now:     number,
  ): void {
    if (this.torches.length === 0) return;
    const ts = TILE_SIZE;
    const W  = ctx.canvas.width;
    const H  = ctx.canvas.height;

    ctx.save();
    for (const t of this.torches) {
      const sx = t.tx * ts + camOffX;
      const sy = t.ty * ts + camOffY;
      if (sx + ts < 0 || sx > W || sy + ts < 0 || sy > H) continue;

      // 炎の中心：壁の南端中央付近（ブラケット先端）
      const fx     = sx + ts / 2;
      const fy     = sy + ts - Math.round(ts * 0.18);
      const seed   = t.tx * 17 + t.ty * 23;
      const flick  = 0.85 + 0.15 * Math.sin(now * 14 + seed) + 0.08 * Math.sin(now * 22 + seed * 1.7);
      const flameH = ts * 0.18 * flick;
      const flameW = ts * 0.10 * (0.9 + 0.1 * Math.sin(now * 18 + seed));

      // 床光だまり（加算）
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22 * flick;
      ctx.fillStyle   = 'rgba(255,160,60,1)';
      ctx.beginPath();
      ctx.ellipse(fx, sy + ts + ts * 0.18, ts * 0.55 * flick, ts * 0.22 * flick, 0, 0, Math.PI * 2);
      ctx.fill();

      // 外焔（オレンジ）
      ctx.globalAlpha = 0.85;
      ctx.fillStyle   = 'rgba(255,140,40,1)';
      ctx.beginPath();
      ctx.ellipse(fx, fy - flameH * 0.4, flameW * 1.2, flameH, 0, 0, Math.PI * 2);
      ctx.fill();

      // 内焔（黄）
      ctx.globalAlpha = 0.95;
      ctx.fillStyle   = 'rgba(255,230,140,1)';
      ctx.beginPath();
      ctx.ellipse(fx, fy - flameH * 0.55, flameW * 0.7, flameH * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // 芯（白）
      ctx.globalAlpha = 1;
      ctx.fillStyle   = 'rgba(255,255,230,1)';
      ctx.beginPath();
      ctx.ellipse(fx, fy - flameH * 0.6, flameW * 0.32, flameH * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 指定チャンクをキャッシュから取得（無ければ初期描画） */
  private _getChunk(cx: number, cy: number): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const key = `${cx},${cy}`;
    let chunk = this._chunks.get(key);
    if (chunk) return chunk;

    const ts  = TILE_SIZE;
    const tx0 = cx * CHUNK_TILES;
    const ty0 = cy * CHUNK_TILES;
    const tx1 = Math.min(tx0 + CHUNK_TILES, this.cols);
    const ty1 = Math.min(ty0 + CHUNK_TILES, this.rows);
    if (tx0 >= this.cols || ty0 >= this.rows) return null;

    chunk = document.createElement('canvas');
    chunk.width  = (tx1 - tx0) * ts;
    chunk.height = (ty1 - ty0) * ts;
    const cctx = chunk.getContext('2d');
    if (!cctx) return null;

    for (let ty = ty0; ty < ty1; ty++) {
      for (let tx = tx0; tx < tx1; tx++) {
        this._drawTile(cctx, (tx - tx0) * ts, (ty - ty0) * ts, this.grid[ty][tx], tx, ty);
      }
    }
    this._chunks.set(key, chunk);
    return chunk;
  }

  /** 静的タイルキャッシュを破棄（テスト・テーマ変更時など） */
  invalidateRenderCache(): void {
    this._chunks.clear();
  }

  /** 指定タイル（と隣接4方向）が属するチャンクキャッシュを破棄 */
  private _invalidateChunkAround(tx: number, ty: number): void {
    const touched = new Set<string>();
    const add = (ax: number, ay: number) => {
      if (ax < 0 || ay < 0 || ax >= this.cols || ay >= this.rows) return;
      touched.add(`${Math.floor(ax / CHUNK_TILES)},${Math.floor(ay / CHUNK_TILES)}`);
    };
    add(tx, ty);
    add(tx + 1, ty); add(tx - 1, ty);
    add(tx, ty + 1); add(tx, ty - 1);
    for (const key of touched) this._chunks.delete(key);
  }

  /**
   * 境界壁や外周は壊せない。階段・柱・水・罠・通路は対象外。
   * 破壊可能か判定する（外側2マスは不可＝マップ境界保護）。
   */
  canBreakWall(tx: number, ty: number): boolean {
    if (tx < 2 || ty < 2 || tx >= this.cols - 2 || ty >= this.rows - 2) return false;
    const t = this.grid[ty]?.[tx];
    return t === TILE.WALL;
  }

  /**
   * 壁を壊したときに得られる素材を判定する。
   * - 設置壁 → その素材そのまま
   * - 自然壁 → テーマから決定（forest=wood、それ以外=stone）
   */
  wallMaterialAt(tx: number, ty: number): 'stone' | 'wood' {
    const placed = this.placedMaterials.get(`${tx},${ty}`);
    if (placed) return placed;
    if (this.theme === 'forest') return 'wood';
    return 'stone';
  }

  /** 壁を床に変換する。成功時 true。 */
  breakWall(tx: number, ty: number): boolean {
    if (!this.canBreakWall(tx, ty)) return false;
    this.grid[ty][tx] = TILE.FLOOR;
    // 素材マップ・松明が乗っていた場合は除去
    this.placedMaterials.delete(`${tx},${ty}`);
    this.torches = this.torches.filter(t => !(t.tx === tx && t.ty === ty));
    this._invalidateChunkAround(tx, ty);
    return true;
  }

  /**
   * 壁を設置できるか判定する。
   * - 歩行可能な床/通路で、アクターや階段・出口が無い
   * - 外周2マスは不可
   */
  canPlaceWall(
    tx: number, ty: number,
    actors: { alive: boolean; tx: number; ty: number }[] = [],
    extras: { tx: number; ty: number }[] = [],
  ): boolean {
    if (tx < 2 || ty < 2 || tx >= this.cols - 2 || ty >= this.rows - 2) return false;
    const t = this.grid[ty]?.[tx];
    if (t !== TILE.FLOOR && t !== TILE.CORRIDOR) return false;
    if (this.isStairs(tx, ty)) return false;
    if (this.getExitDir(tx, ty)) return false;
    if (actors.some(a => a.alive && a.tx === tx && a.ty === ty)) return false;
    if (extras.some(p => p.tx === tx && p.ty === ty)) return false;
    return true;
  }

  /** 床を壁に変換する。素材を記録する。成功時 true。 */
  placeWall(tx: number, ty: number, material: 'stone' | 'wood' = 'stone'): boolean {
    const t = this.grid[ty]?.[tx];
    if (t !== TILE.FLOOR && t !== TILE.CORRIDOR) return false;
    this.grid[ty][tx] = TILE.WALL;
    this.placedMaterials.set(`${tx},${ty}`, material);
    this._invalidateChunkAround(tx, ty);
    return true;
  }

  /** 該当タイルに松明があるか（O(N) だが N は数十程度） */
  private _isTorchTile(tx: number, ty: number): boolean {
    if (this.torches.length === 0) return false;
    for (const t of this.torches) if (t.tx === tx && t.ty === ty) return true;
    return false;
  }

  // ─── 1タイル描画（テーマ別） ───────────────────
  private _drawTile(
    ctx:    CanvasRenderingContext2D,
    sx:     number,
    sy:     number,
    tileId: TileType,
    tx:     number,
    ty:     number,
  ): void {
    const th = THEMES[this.theme];
    const ts = TILE_SIZE;

    // プレイヤーが設置した壁はテーマに関係なく素材別の見た目で描画
    if (tileId === TILE.WALL && this.placedMaterials.has(`${tx},${ty}`)) {
      this._drawDungeonTile(ctx, sx, sy, tileId, th, ts, tx, ty);
      return;
    }

    if (this.theme === 'forest') {
      this._drawForestTile(ctx, sx, sy, tileId, tx, ty, th, ts);
    } else if (this.theme === 'cosmic') {
      this._drawCosmicTile(ctx, sx, sy, tileId, th, ts, tx, ty);
    } else {
      this._drawDungeonTile(ctx, sx, sy, tileId, th, ts, tx, ty);
    }
  }

  // ─── 宇宙テーマのタイル描画（星空＋星雲） ──────────────────────────
  private _drawCosmicTile(
    ctx:    CanvasRenderingContext2D,
    sx:     number,
    sy:     number,
    tileId: TileType,
    th:     typeof THEMES[ThemeId],
    ts:     number,
    tx:     number,
    ty:     number,
  ): void {
    // 障害物タイルはベースを床として描画
    if (tileId === TILE.PILLAR || tileId === TILE.TRAP || tileId === TILE.WATER) {
      tileId = TILE.FLOOR;
    }

    const seed = (tx * 29 + ty * 53);

    if (tileId === TILE.WALL) {
      const southTile    = this.grid[ty + 1]?.[tx];
      const southIsFloor = southTile === TILE.FLOOR || southTile === TILE.CORRIDOR;

      // 壁 = 星雲（紫／ピンクのグラデ）
      const grad = ctx.createLinearGradient(sx, sy, sx, sy + ts);
      grad.addColorStop(0,   '#3a0a6a');
      grad.addColorStop(0.6, '#1a0530');
      grad.addColorStop(1,   '#05000f');
      ctx.fillStyle = grad;
      ctx.fillRect(sx, sy, ts, ts);

      // ピンクのにじみ
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle   = '#ff6bd6';
      const nx = sx + ((seed * 11) % (ts - 16)) + 8;
      const ny = sy + ((seed * 17) % (ts - 16)) + 8;
      ctx.beginPath();
      ctx.ellipse(nx, ny, ts * 0.35, ts * 0.22, (seed % 7) * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 前面の縁を暗く（壁の立体感）
      if (southIsFloor) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#05000f';
        ctx.fillRect(sx, sy + ts - Math.round(ts * 0.38), ts, Math.round(ts * 0.38));
        ctx.restore();
      }

      // 壁の中の遠星
      for (let k = 0; k < 3; k++) {
        const rx = ((seed * (k + 1) * 7)  % (ts - 8)) + 4;
        const ry = ((seed * (k + 1) * 13) % (ts - 8)) + 4;
        ctx.save();
        ctx.globalAlpha = 0.55 + ((seed * (k + 3)) % 3) * 0.1;
        ctx.fillStyle   = '#f5e8ff';
        ctx.fillRect(sx + rx, sy + ry, 1, 1);
        ctx.restore();
      }
    } else {
      // 床 / 通路 = 深い宇宙空間
      const isCorr = tileId === TILE.CORRIDOR;
      ctx.fillStyle = isCorr ? th.corridor.base : th.floor.base;
      ctx.fillRect(sx, sy, ts, ts);

      // 青紫の淡いグロー
      ctx.save();
      ctx.globalAlpha = 0.08;
      const grad2 = ctx.createRadialGradient(
        sx + ts / 2, sy + ts / 2, ts * 0.1,
        sx + ts / 2, sy + ts / 2, ts * 0.7,
      );
      grad2.addColorStop(0, '#6a28c8');
      grad2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad2;
      ctx.fillRect(sx, sy, ts, ts);
      ctx.restore();

      // 星ドット（タイル内 6 点、決定的シード）
      const starCount = 6;
      for (let k = 0; k < starCount; k++) {
        const s2 = seed * (k + 3);
        const rx = (Math.abs(s2 * 7)  % (ts - 6)) + 3;
        const ry = (Math.abs(s2 * 11) % (ts - 6)) + 3;
        const rr = (Math.abs(s2) % 3 === 0) ? 1.5 : 1;
        const alpha = 0.45 + ((Math.abs(s2) % 5) * 0.1);
        ctx.save();
        ctx.globalAlpha = Math.min(1, alpha);
        // 大きい星は金色、小さい星は白
        if (rr > 1) {
          ctx.fillStyle = '#fde68a';
        } else {
          ctx.fillStyle = '#f5f5ff';
        }
        ctx.beginPath();
        ctx.arc(sx + rx, sy + ry, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // たまに輝く大きな星（4 光線）
      if (seed % 23 === 0) {
        const cx = sx + ts / 2;
        const cy = sy + ts / 2;
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = 'rgba(253,230,138,0.9)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
        ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
        ctx.stroke();
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 外周ライン（控えめな紫グリッド）
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.strokeStyle = th.floor.grid;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(sx + 0.5, sy + 0.5, ts - 1, ts - 1);
      ctx.restore();
    }
  }

  private _drawDungeonTile(
    ctx:    CanvasRenderingContext2D,
    sx:     number,
    sy:     number,
    tileId: TileType,
    th:     typeof THEMES[ThemeId],
    ts:     number,
    tx:     number,
    ty:     number,
  ): void {
    // 障害物タイルはベースを床として描画（再帰せずに tileId を上書き）
    if (tileId === TILE.PILLAR || tileId === TILE.TRAP || tileId === TILE.WATER) {
      tileId = TILE.FLOOR;
    }

    const seed = (tx * 17 + ty * 13);
    const northTile = this.grid[ty - 1]?.[tx];
    const southTile = this.grid[ty + 1]?.[tx];
    const westTile  = this.grid[ty]?.[tx - 1];
    // 柱も壁と同様に扱って影計算
    const northIsWall = northTile === TILE.WALL || northTile === TILE.PILLAR;
    const westIsWall  = westTile  === TILE.WALL || westTile  === TILE.PILLAR;

    if (tileId === TILE.WALL) {
      // ── 擬似 3D ブロック描画 ─────────────────────────────
      // 南が床/通路なら「上面 + 前面」、南も壁なら「上面のみ（深く奥まった内部壁）」
      const southIsFloor = southTile === TILE.FLOOR || southTile === TILE.CORRIDOR;
      const eastTile     = this.grid[ty]?.[tx + 1];
      const eastIsFloor  = eastTile === TILE.FLOOR || eastTile === TILE.CORRIDOR;
      const westIsFloor  = westTile === TILE.FLOOR || westTile === TILE.CORRIDOR;

      // top face は上半分、front face は下半分（south が床のときのみ）
      const topH   = southIsFloor ? Math.round(ts * 0.42) : ts;
      const frontH = ts - topH;

      const material = this.placedMaterials.get(`${tx},${ty}`);
      if (material === 'stone') {
        this._drawStoneWall(ctx, sx, sy, ts, topH, frontH, southIsFloor, westIsFloor, eastIsFloor, ty);
      } else if (material === 'wood') {
        this._drawWoodWall(ctx, sx, sy, ts, topH, frontH, southIsFloor, westIsFloor, eastIsFloor);
      } else {
        this._drawNaturalWall(ctx, sx, sy, ts, topH, frontH, southIsFloor, westIsFloor, eastIsFloor);
      }

      // ── 松明ブラケット（静的部分） ──────────────────────────────
      if (this._isTorchTile(tx, ty)) {
        const cx = sx + ts / 2;
        const by = sy + ts - Math.round(ts * 0.18);
        // 鉄ブラケット
        ctx.save();
        ctx.fillStyle = '#1a1410';
        ctx.fillRect(cx - 6, by - 2, 12, 6);
        ctx.fillStyle = '#3a2818';
        ctx.fillRect(cx - 5, by - 1, 10, 2);
        // 棒（壁から斜めに伸びる）
        ctx.strokeStyle = '#1a0e08';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(cx, by + 4);
        ctx.lineTo(cx, by + 10);
        ctx.stroke();
        // 焼け跡（壁の煤）
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(cx, by - Math.round(ts * 0.05), 8, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

    } else {
      const isCorr = tileId === TILE.CORRIDOR;

      // ── ベース色 ──────────────────────────────────────────────────
      ctx.fillStyle = isCorr ? th.corridor.base : th.floor.base;
      ctx.fillRect(sx, sy, ts, ts);

      // ── 石板の内側ハイライト（床タイル感） ───────────────────────
      if (!isCorr) {
        ctx.save();
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx + 2, sy + 2, ts - 4, ts - 4);
        ctx.restore();
      }

      // ── タイル外周グリッド線 ─────────────────────────────────────
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = isCorr ? th.corridor.grid : th.floor.grid;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(sx + 0.5, sy + 0.5, ts - 1, ts - 1);
      ctx.restore();

      // ── 石目地・ひび（seed で決定的に） ────────────────────────────
      const floorSeed = (tx * 29 + ty * 53);
      // 大まかな明暗ムラ（タイルごとに +/-）
      const mood = (floorSeed % 5) - 2;
      if (mood !== 0) {
        ctx.save();
        ctx.globalAlpha = Math.abs(mood) * 0.04;
        ctx.fillStyle = mood > 0 ? '#ffffff' : '#000000';
        ctx.fillRect(sx, sy, ts, ts);
        ctx.restore();
      }
      // 小さな石の粒（4 点、濃いめ）
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#1a140c';
      for (let k = 0; k < 4; k++) {
        const rx = ((floorSeed * (k + 1) * 7) % (ts - 16)) + 8;
        const ry = ((floorSeed * (k + 1) * 11) % (ts - 16)) + 8;
        const rr = ((floorSeed * (k + 2) * 3) % 3) + 1;
        ctx.fillRect(sx + rx, sy + ry, rr, rr);
      }
      ctx.restore();
      // たまにヒビ（1 本）
      if (!isCorr && floorSeed % 11 === 0) {
        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.strokeStyle = '#1a140c';
        ctx.lineWidth = 1;
        const cx0 = sx + 12 + (floorSeed % 18);
        const cy0 = sy + 14 + ((floorSeed * 5) % 20);
        ctx.beginPath();
        ctx.moveTo(cx0, cy0);
        ctx.lineTo(cx0 + 14, cy0 + 6);
        ctx.lineTo(cx0 + 20, cy0 + 18);
        ctx.stroke();
        ctx.restore();
      }

      // ── 北壁の落ち影 ──────────────────────────────────────────────
      if (northIsWall) {
        // 壁が高くなったぶん、北壁の落ち影を強く・長くする
        ctx.save();
        const shadowH = Math.round(ts * 0.42);
        const grad = ctx.createLinearGradient(sx, sy, sx, sy + shadowH);
        grad.addColorStop(0,   'rgba(0,0,0,0.78)');
        grad.addColorStop(0.4, 'rgba(0,0,0,0.40)');
        grad.addColorStop(1,   'rgba(0,0,0,0.00)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx, sy, ts, shadowH);
        ctx.restore();
      }

      // ── 西壁の落ち影 ──────────────────────────────────────────────
      if (westIsWall) {
        ctx.save();
        const wShadow = Math.round(ts * 0.22);
        const grad = ctx.createLinearGradient(sx, sy, sx + wShadow, sy);
        grad.addColorStop(0,   'rgba(0,0,0,0.42)');
        grad.addColorStop(1,   'rgba(0,0,0,0.00)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx, sy, wShadow, ts);
        ctx.restore();
      }

      // ── 内角 AO（北西両方が壁の内側） ─────────────────────────────
      if (northIsWall && westIsWall) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + ts * 0.35, sy);
        ctx.lineTo(sx, sy + ts * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // ── モンスターハウス赤みオーバーレイ ─────────────────────────
      const mh = this.monsterHouseRoom;
      if (mh && tx >= mh.x && tx < mh.x + mh.w && ty >= mh.y && ty < mh.y + mh.h) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#ff1010';
        ctx.fillRect(sx, sy, ts, ts);
        ctx.restore();
      }
    }
  }

  // ─── 自然壁：単色の黒（最小限の3Dベベルのみ） ───────────
  private _drawNaturalWall(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number, ts: number,
    topH: number, frontH: number,
    southIsFloor: boolean, westIsFloor: boolean, eastIsFloor: boolean,
  ): void {
    // 上面：単色（ほぼ黒）
    ctx.fillStyle = '#0b0b0d';
    ctx.fillRect(sx, sy, ts, topH);

    // 上面の上端ハイライトと南端の境界線（3D感を残す最小限）
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(sx, sy, ts, 1);

    if (southIsFloor) {
      // 上面の南端：明縁 + 影
      ctx.fillStyle = 'rgba(60,60,60,0.45)';
      ctx.fillRect(sx, sy + topH - 1, ts, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(sx, sy + topH, ts, 1);

      // 前面：単色さらに暗く
      const fy = sy + topH;
      ctx.fillStyle = '#020203';
      ctx.fillRect(sx, fy, ts, frontH);

      // 前面の左右フチ
      ctx.fillStyle = westIsFloor ? 'rgba(40,40,40,0.40)' : 'rgba(0,0,0,0.50)';
      ctx.fillRect(sx, fy, 1, frontH);
      ctx.fillStyle = eastIsFloor ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.45)';
      ctx.fillRect(sx + ts - 1, fy, 1, frontH);

      // 接地影
      ctx.fillStyle = 'rgba(0,0,0,0.70)';
      ctx.fillRect(sx, sy + ts - 2, ts, 2);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(sx, sy + ts - 1, ts, 1);
    }

    // 上面の左右ベベル（控えめ）
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(sx, sy, 1, topH);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(sx + ts - 1, sy, 1, topH);
  }

  // ─── 設置：石ブロック（cobblestone 風グレー） ─────────────
  private _drawStoneWall(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number, ts: number,
    topH: number, frontH: number,
    southIsFloor: boolean, westIsFloor: boolean, eastIsFloor: boolean,
    ty: number,
  ): void {
    // 上面ベース
    ctx.fillStyle = '#7a7a7a';
    ctx.fillRect(sx, sy, ts, topH);

    // 石ブロック目地（行で半幅オフセット）
    ctx.save();
    ctx.strokeStyle = 'rgba(20,20,20,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (topH >= 18) {
      ctx.moveTo(sx, sy + Math.round(topH * 0.5));
      ctx.lineTo(sx + ts, sy + Math.round(topH * 0.5));
    }
    const bwTop = Math.round(ts / 2);
    const parityT = ty % 2;
    const offT = parityT === 0 ? bwTop : Math.round(bwTop / 2);
    for (let col = sx + offT; col < sx + ts; col += bwTop) {
      ctx.moveTo(col, sy); ctx.lineTo(col, sy + topH);
    }
    ctx.stroke();
    ctx.restore();

    // 上面の上端ハイライト
    ctx.fillStyle = 'rgba(220,220,220,0.30)';
    ctx.fillRect(sx, sy, ts, 2);

    if (southIsFloor) {
      // 上面の南端：明縁 + 影
      ctx.fillStyle = 'rgba(220,220,220,0.30)';
      ctx.fillRect(sx, sy + topH - 2, ts, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.70)';
      ctx.fillRect(sx, sy + topH, ts, 1);

      // 前面：少し暗いグレー
      const fy = sy + topH;
      const grad = ctx.createLinearGradient(sx, fy, sx, sy + ts);
      grad.addColorStop(0, '#5e5e5e');
      grad.addColorStop(1, '#2c2c2c');
      ctx.fillStyle = grad;
      ctx.fillRect(sx, fy, ts, frontH);

      // 前面の石ブロックパターン
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const fbh = Math.round(frontH / 2);
      ctx.moveTo(sx, fy + fbh); ctx.lineTo(sx + ts, fy + fbh);
      const bwF = Math.round(ts / 2);
      const offFA = parityT === 0 ? bwF : Math.round(bwF / 2);
      const offFB = parityT === 0 ? Math.round(bwF / 2) : bwF;
      for (let col = sx + offFA; col < sx + ts; col += bwF) {
        ctx.moveTo(col, fy); ctx.lineTo(col, fy + fbh);
      }
      for (let col = sx + offFB; col < sx + ts; col += bwF) {
        ctx.moveTo(col, fy + fbh); ctx.lineTo(col, fy + frontH);
      }
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = westIsFloor ? 'rgba(220,220,220,0.18)' : 'rgba(0,0,0,0.45)';
      ctx.fillRect(sx, fy, 1, frontH);
      ctx.fillStyle = eastIsFloor ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.45)';
      ctx.fillRect(sx + ts - 1, fy, 1, frontH);

      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(sx, sy + ts - 2, ts, 2);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(sx, sy + ts - 1, ts, 1);
    }

    ctx.fillStyle = 'rgba(220,220,220,0.18)';
    ctx.fillRect(sx, sy, 2, topH);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(sx + ts - 2, sy, 2, topH);
  }

  // ─── 設置：木の壁（plank 風ブラウン） ─────────────────
  private _drawWoodWall(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number, ts: number,
    topH: number, frontH: number,
    southIsFloor: boolean, westIsFloor: boolean, eastIsFloor: boolean,
  ): void {
    // 上面：明るい木目
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(sx, sy, ts, topH);

    // 板の継ぎ目（横線3本）
    ctx.save();
    ctx.strokeStyle = 'rgba(40,20,8,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const lineCount = 3;
    for (let i = 1; i <= lineCount; i++) {
      const ly = sy + Math.round((topH * i) / (lineCount + 1));
      ctx.moveTo(sx, ly); ctx.lineTo(sx + ts, ly);
    }
    ctx.stroke();
    ctx.restore();

    // 上端ハイライト
    ctx.fillStyle = 'rgba(255,210,160,0.25)';
    ctx.fillRect(sx, sy, ts, 2);

    if (southIsFloor) {
      ctx.fillStyle = 'rgba(255,200,140,0.25)';
      ctx.fillRect(sx, sy + topH - 2, ts, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.70)';
      ctx.fillRect(sx, sy + topH, ts, 1);

      // 前面：暗めの木目
      const fy = sy + topH;
      const grad = ctx.createLinearGradient(sx, fy, sx, sy + ts);
      grad.addColorStop(0, '#6b3f1c');
      grad.addColorStop(1, '#2a1608');
      ctx.fillStyle = grad;
      ctx.fillRect(sx, fy, ts, frontH);

      // 前面：縦の木目線
      ctx.save();
      ctx.strokeStyle = 'rgba(20,10,4,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const cols = 3;
      for (let i = 1; i <= cols; i++) {
        const cx = sx + Math.round((ts * i) / (cols + 1));
        ctx.moveTo(cx, fy); ctx.lineTo(cx, fy + frontH);
      }
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = westIsFloor ? 'rgba(255,200,140,0.18)' : 'rgba(0,0,0,0.45)';
      ctx.fillRect(sx, fy, 1, frontH);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(sx + ts - 1, fy, 1, frontH);
      void eastIsFloor;

      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(sx, sy + ts - 2, ts, 2);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(sx, sy + ts - 1, ts, 1);
    }

    ctx.fillStyle = 'rgba(255,210,160,0.18)';
    ctx.fillRect(sx, sy, 2, topH);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(sx + ts - 2, sy, 2, topH);
  }

  private _drawForestTile(
    ctx:    CanvasRenderingContext2D,
    sx:     number,
    sy:     number,
    tileId: TileType,
    tx:     number,
    ty:     number,
    th:     typeof THEMES[ThemeId],
    ts:     number,
  ): void {
    if (tileId === TILE.PILLAR || tileId === TILE.TRAP || tileId === TILE.WATER) {
      tileId = TILE.FLOOR;
    }
    if (tileId === TILE.WALL) {
      // ── 背景 ──────────────────────────────────────────────────────
      ctx.fillStyle = th.wall.base;
      ctx.fillRect(sx, sy, ts, ts);

      const tcx  = sx + ts / 2;
      const tcy  = sy + ts / 2;
      const seed = (tx * 31 + ty * 17) % 100;

      // ── 葉っぱ（メイン） ──────────────────────────────────────────
      const r1 = ts * 0.34 + (seed % 4);
      ctx.fillStyle = seed > 50 ? '#2a5a12' : '#3a7018';
      ctx.beginPath();
      ctx.ellipse(tcx, tcy - ts * 0.08, r1, r1 * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();

      // ── 葉っぱ（サブ・クラスター）─────────────────────────────────
      if (seed > 25) {
        ctx.fillStyle = seed > 65 ? '#1e4a0e' : '#2e6010';
        ctx.beginPath();
        ctx.ellipse(tcx - ts * 0.2, tcy - ts * 0.1, r1 * 0.68, r1 * 0.58, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(tcx + ts * 0.18, tcy - ts * 0.05, r1 * 0.62, r1 * 0.54, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── ハイライト（光） ──────────────────────────────────────────
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#80e840';
      ctx.beginPath();
      ctx.ellipse(tcx - ts * 0.08, tcy - ts * 0.18, r1 * 0.4, r1 * 0.3, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ── 幹 ────────────────────────────────────────────────────────
      const trunkW = Math.round(ts * 0.14);
      const trunkH = Math.round(ts * 0.22);
      ctx.fillStyle = '#3d2010';
      ctx.fillRect(tcx - trunkW / 2, sy + ts - trunkH, trunkW, trunkH);
      // 幹ハイライト
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#8b5020';
      ctx.fillRect(tcx - trunkW / 2 + 1, sy + ts - trunkH + 2, Math.round(trunkW * 0.4), trunkH - 4);
      ctx.restore();

      // ── 外枠 ──────────────────────────────────────────────────────
      ctx.fillStyle = th.wall.hi;
      ctx.fillRect(sx, sy, ts, 1);
      ctx.fillRect(sx, sy, 1, ts);

    } else {
      const isCorr = tileId === TILE.CORRIDOR;
      ctx.fillStyle = isCorr ? th.corridor.base : th.floor.base;
      ctx.fillRect(sx, sy, ts, ts);

      // ── 草の色むら ────────────────────────────────────────────────
      const seed = (tx * 13 + ty * 29) % 10;
      if (!isCorr && seed < 4) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#50b41e';
        ctx.fillRect(sx + ts * 0.1, sy + ts * 0.1, ts * 0.8, ts * 0.8);
        ctx.restore();
      }

      // ── 草のドット ────────────────────────────────────────────────
      if (!isCorr) {
        const ds = (tx * 7 + ty * 11) % 20;
        ctx.save();
        ctx.fillStyle = '#4da018';
        ctx.globalAlpha = 0.22;
        for (let d = 0; d < 4; d++) {
          const gx = sx + ((ds * (d + 1) * 7) % (ts - 10)) + 5;
          const gy = sy + ((ds * (d + 1) * 5) % (ts - 10)) + 5;
          ctx.fillRect(gx, gy,     2, 4);
          ctx.fillRect(gx + 1, gy - 1, 1, 2);
        }
        ctx.restore();

        // ── 落ち葉・小石（seed で決定的に 2〜3 個） ──────────────────
        const fs2 = (tx * 19 + ty * 41);
        ctx.save();
        for (let k = 0; k < 3; k++) {
          const lx = sx + ((fs2 * (k + 1) * 13) % (ts - 12)) + 6;
          const ly = sy + ((fs2 * (k + 1) * 17) % (ts - 12)) + 6;
          const pick = (fs2 * (k + 2)) % 3;
          ctx.globalAlpha = 0.5;
          if (pick === 0)       ctx.fillStyle = '#6a4a18'; // 枯れ葉
          else if (pick === 1)  ctx.fillStyle = '#3a2a14'; // 小石
          else                  ctx.fillStyle = '#1a3810'; // 濃い草
          ctx.fillRect(lx, ly, 3, 2);
        }
        ctx.restore();
      }

      // ── 土道の轍（左右に 2 本の溝） ───────────────────────────────
      if (isCorr) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#4a3418';
        ctx.fillRect(sx + ts * 0.2,  sy, 2, ts);
        ctx.fillRect(sx + ts * 0.78, sy, 2, ts);
        ctx.restore();
      }

      // ── 土道のライン ─────────────────────────────────────────────
      if (isCorr) {
        ctx.strokeStyle = th.corridor.grid;
        ctx.lineWidth = 1;
        const t1 = Math.round(ts * 0.2), t2 = Math.round(ts * 0.8);
        ctx.beginPath();
        ctx.moveTo(sx + t1, sy); ctx.lineTo(sx + t1, sy + ts);
        ctx.moveTo(sx + t2, sy); ctx.lineTo(sx + t2, sy + ts);
        ctx.stroke();
      }
    }
  }

  // ─── 障害物描画 ────────────────────────────────
  private _drawObstacles(
    ctx:     CanvasRenderingContext2D,
    camOffX: number,
    camOffY: number,
    now:     number,
  ): void {
    const ts = TILE_SIZE;
    const W  = ctx.canvas.width;
    const H  = ctx.canvas.height;

    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const tileId = this.grid[ty][tx];
        if (tileId !== TILE.PILLAR && tileId !== TILE.WATER &&
            tileId !== TILE.ICE && tileId !== TILE.MAGMA &&
            !(tileId === TILE.TRAP && this.revealedTraps.has(`${tx},${ty}`))) continue;

        const sx = tx * ts + camOffX;
        const sy = ty * ts + camOffY;
        if (sx + ts < -TILE_SIZE * 2 || sx > W + TILE_SIZE * 2) continue;
        if (sy + ts < -TILE_SIZE * 2 || sy > H + TILE_SIZE * 2) continue;

        if (tileId === TILE.PILLAR) {
          this._drawPillar(ctx, sx, sy, ts, now);
        } else if (tileId === TILE.WATER) {
          this._drawWater(ctx, sx, sy, ts, tx, ty, now);
        } else if (tileId === TILE.ICE) {
          this._drawIce(ctx, sx, sy, ts, tx, ty, now);
        } else if (tileId === TILE.MAGMA) {
          this._drawMagma(ctx, sx, sy, ts, tx, ty, now);
        } else if (tileId === TILE.TRAP) {
          this._drawRevealedTrap(ctx, sx, sy, ts);
        }
      }
    }
  }

  private _drawPillar(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number, ts: number, _now: number,
  ): void {
    ctx.save();
    const cx = sx + ts / 2, cy = sy + ts / 2;
    const r  = ts * 0.22;
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy + ts * 0.18, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    // 柱ベース（円柱下面）
    ctx.fillStyle = '#4a4040';
    ctx.beginPath();
    ctx.ellipse(cx, cy + ts * 0.12, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // 柱胴体
    const grad = ctx.createLinearGradient(cx - r, cy - ts * 0.3, cx + r, cy - ts * 0.3);
    grad.addColorStop(0, '#8a7a70');
    grad.addColorStop(0.35, '#c0b0a0');
    grad.addColorStop(0.65, '#a09080');
    grad.addColorStop(1, '#5a5050');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - ts * 0.34, r * 2, ts * 0.46);
    // 柱トップ（円柱上面）
    ctx.fillStyle = '#b0a090';
    ctx.beginPath();
    ctx.ellipse(cx, cy - ts * 0.34, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // 頭頂ハイライト
    ctx.fillStyle = 'rgba(255,240,220,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.2, cy - ts * 0.34, r * 0.55, r * 0.18, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private _drawWater(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number, ts: number, tx: number, ty: number, now: number,
  ): void {
    ctx.save();
    const seed = tx * 13 + ty * 7;
    // 水面ベース
    const grad = ctx.createRadialGradient(
      sx + ts / 2, sy + ts / 2, 2,
      sx + ts / 2, sy + ts / 2, ts * 0.6
    );
    grad.addColorStop(0, 'rgba(80,160,220,0.88)');
    grad.addColorStop(1, 'rgba(30,80,160,0.75)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, ts, ts);
    // 波紋アニメ
    const t = now * 1.2 + seed * 0.8;
    ctx.strokeStyle = 'rgba(160,210,255,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      const phase = (t + i * Math.PI) % (Math.PI * 2);
      const rr = ts * 0.15 + ts * 0.18 * (phase / (Math.PI * 2));
      const alpha = 0.4 * (1 - phase / (Math.PI * 2));
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(sx + ts / 2 + (seed % 6 - 3) * 3,
                  sy + ts / 2 + (seed % 5 - 2) * 3,
                  rr, rr * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 光沢
    ctx.fillStyle = 'rgba(200,235,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(sx + ts * 0.35, sy + ts * 0.32, ts * 0.12, ts * 0.06, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private _drawIce(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number, ts: number, tx: number, ty: number, _now: number,
  ): void {
    ctx.save();
    const seed = tx * 11 + ty * 17;
    // ベース：薄い水色
    const grad = ctx.createLinearGradient(sx, sy, sx + ts, sy + ts);
    grad.addColorStop(0, 'rgba(180,230,255,0.85)');
    grad.addColorStop(1, 'rgba(120,190,230,0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, ts, ts);
    // ひび模様（結晶ライン）
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const phase = (seed + i * 37) % 13;
      ctx.beginPath();
      ctx.moveTo(sx + (phase * 7) % ts, sy);
      ctx.lineTo(sx + ((phase * 3) % ts), sy + ts);
      ctx.stroke();
    }
    // キラッと光沢
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx + ts * 0.3, sy + ts * 0.28, ts * 0.12, ts * 0.045, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // 外縁の冷気グロー
    ctx.strokeStyle = 'rgba(220,245,255,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, ts - 1, ts - 1);
    ctx.restore();
  }

  private _drawMagma(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number, ts: number, tx: number, ty: number, now: number,
  ): void {
    ctx.save();
    const seed = tx * 23 + ty * 29;
    const t = now * 1.2 + seed * 0.5;
    // ベース：赤-黒のグラデ
    const grad = ctx.createRadialGradient(
      sx + ts / 2, sy + ts / 2, 2,
      sx + ts / 2, sy + ts / 2, ts * 0.7,
    );
    const pulse = 0.85 + 0.15 * Math.sin(t);
    grad.addColorStop(0, `rgba(255,${160 + Math.round(40 * pulse)},40,0.95)`);
    grad.addColorStop(0.5, 'rgba(220,60,20,0.88)');
    grad.addColorStop(1, 'rgba(60,8,4,0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, ts, ts);
    // ひび（黒い割れ目）
    ctx.strokeStyle = 'rgba(20,10,8,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx + (seed % 7),        sy + ts * 0.4);
    ctx.lineTo(sx + ts * 0.5,          sy + ts * 0.55);
    ctx.lineTo(sx + ts - (seed % 5),   sy + ts * 0.3);
    ctx.stroke();
    // 泡（時間でぽこぽこ）
    for (let i = 0; i < 2; i++) {
      const phase = (t * 0.6 + i * 1.7 + seed * 0.1) % 1;
      const bx = sx + ts * (0.25 + ((seed + i * 31) % 5) / 10);
      const by = sy + ts * (0.95 - phase * 0.7);
      const br = ts * (0.05 + 0.04 * (1 - phase));
      ctx.fillStyle = `rgba(255,230,120,${0.3 + 0.5 * (1 - phase)})`;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    // 縁の焦げ
    ctx.strokeStyle = 'rgba(40,10,5,0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, ts - 1, ts - 1);
    ctx.restore();
  }

  private _drawRevealedTrap(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number, ts: number,
  ): void {
    ctx.save();
    const cx = sx + ts / 2, cy = sy + ts / 2;
    // 穴の影
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, ts * 0.35, ts * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    // スパイク群
    const spikeCount = 6;
    ctx.fillStyle = '#888';
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2;
      const bx = cx + Math.cos(angle) * ts * 0.18;
      const by = cy + Math.sin(angle) * ts * 0.14;
      ctx.beginPath();
      ctx.moveTo(bx - ts * 0.045, by + ts * 0.06);
      ctx.lineTo(bx + ts * 0.045, by + ts * 0.06);
      ctx.lineTo(bx, by - ts * 0.14);
      ctx.closePath();
      ctx.fill();
    }
    // 中央スパイク（大）
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.moveTo(cx - ts * 0.055, cy + ts * 0.08);
    ctx.lineTo(cx + ts * 0.055, cy + ts * 0.08);
    ctx.lineTo(cx, cy - ts * 0.2);
    ctx.closePath();
    ctx.fill();
    // 血飛沫（赤点）
    ctx.fillStyle = '#c0392b';
    for (let i = 0; i < 4; i++) {
      const angle2 = i * 1.4;
      const r = ts * 0.06 + (i % 2) * ts * 0.04;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle2) * r * 1.8, cy + Math.sin(angle2) * r, ts * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ─── 階段（アニメ付きベクター）────────────────
  private _drawStairs(
    ctx:     CanvasRenderingContext2D,
    camOffX: number,
    camOffY: number,
    now:     number,
  ): void {
    if (!this.stairs) return;
    const ts = TILE_SIZE;
    const { tx, ty } = this.stairs;
    const sx = tx * ts + camOffX;
    const sy = ty * ts + camOffY;

    const W = ctx.canvas.width, H = ctx.canvas.height;
    if (sx + ts < -ts || sx > W + ts || sy + ts < -ts || sy > H + ts) return;

    const cx = sx + ts / 2;
    const cy = sy + ts / 2;

    // パルスアニメ（ゆっくり点滅）
    const pulse = 0.5 + 0.5 * Math.sin((now / 1.6) * Math.PI * 2);

    ctx.save();

    // ── 台座（暗い石床）
    ctx.fillStyle = '#5c4a2a';
    ctx.strokeStyle = '#3a2e18';
    ctx.lineWidth = 1.5;
    const pw = 52, ph = 48;
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, 5);
    ctx.fill();
    ctx.stroke();

    // ── 階段ステップ（4段）
    const steps  = 4;
    const stepW  = 44;
    const stepH  = 7;
    const totalH = steps * stepH;
    const startY = cy - totalH / 2 + stepH / 2;

    for (let i = 0; i < steps; i++) {
      const progress = i / (steps - 1); // 0 → 1
      const w  = stepW * (1 - progress * 0.30); // 上に行くほど細くなる
      const ey = startY + i * stepH;

      // 影
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(cx - w / 2 + 2, ey - stepH / 2 + 2, w, stepH - 1);

      // ステップ本体（明→暗グラデ）
      const bright = Math.round(180 - i * 20);
      ctx.fillStyle = `rgb(${bright + 20},${Math.round(bright * 0.85)},${Math.round(bright * 0.55)})`;
      ctx.fillRect(cx - w / 2, ey - stepH / 2, w, stepH - 1);

      // ハイライト（上端）
      ctx.fillStyle = `rgba(255,255,200,0.18)`;
      ctx.fillRect(cx - w / 2, ey - stepH / 2, w, 2);
    }

    // ── グロウ（パルス）
    const glowAlpha = (0.25 + 0.25 * pulse).toFixed(2);
    ctx.shadowColor  = `rgba(250,200,80,${glowAlpha})`;
    ctx.shadowBlur   = 14 + 6 * pulse;
    ctx.strokeStyle  = `rgba(250,200,80,${(0.5 + 0.3 * pulse).toFixed(2)})`;
    ctx.lineWidth    = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2 + 1, cy - ph / 2 + 1, pw - 2, ph - 2, 4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  // ─── エグジット矢印（アニメ風グロウ）─────────
  private _drawExitArrows(
    ctx:     CanvasRenderingContext2D,
    camOffX: number,
    camOffY: number,
    now:     number,
  ): void {
    const DIRS: Record<string, [number, number]> = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
    const ts   = TILE_SIZE;

    for (const [dir, pos] of Object.entries(this.exits)) {
      if (!pos) continue;
      const sx = pos.tx * ts + ts / 2 + camOffX;
      const sy = pos.ty * ts + ts / 2 + camOffY;

      const W = ctx.canvas.width, H = ctx.canvas.height;
      if (sx < -ts || sx > W + ts || sy < -ts || sy > H + ts) continue;

      const [ddx, ddy] = DIRS[dir] ?? [0, 0];
      const pulse  = 0.6 + 0.4 * Math.abs(Math.sin((now / ARROW_PERIOD) * Math.PI));
      const alpha  = (0.6 + 0.35 * pulse).toFixed(2);
      const angle  = Math.atan2(ddy, ddx);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle);
      ctx.shadowColor = `rgba(250,204,21,${alpha})`;
      ctx.shadowBlur  = 12;
      ctx.fillStyle   = `rgba(250,204,21,${alpha})`;
      ctx.strokeStyle = `rgba(255,255,200,${(+alpha * 0.7).toFixed(2)})`;
      ctx.lineWidth   = 1.2;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-5, -6);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur  = 0;
      ctx.restore();
    }
  }
}
