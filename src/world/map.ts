// ─────────────────────────────────────────────
// map.ts  GameMap クラス（2D トップダウン描画・テーマ対応）
// ─────────────────────────────────────────────

import { TILE_DEF, TILE, TILE_SIZE, THEMES } from './tiles.js';
import type { TileType, ThemeId } from './tiles.js';
import { DungeonGenerator, BossArenaGenerator, BaseRoomGenerator } from './dungeon.js';
import type { Room } from './dungeon.js';
import { ForestGenerator }  from './forest.js';
import type { ExitPos, ExitMap } from './forest.js';
import { TownGenerator }    from './town.js';

const ARROW_PERIOD = 1.4;
const CULL_MARGIN  = TILE_SIZE * 2;

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
  }

  private _makeGenerator(cols: number, rows: number, theme: ThemeId): GeneratorLike {
    if (theme === 'base')   return new BaseRoomGenerator(cols, rows);
    if (theme === 'forest') return new ForestGenerator(cols, rows);
    if (theme === 'town')   return new TownGenerator(cols, rows);
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

    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const sx = tx * ts + camOffX;
        const sy = ty * ts + camOffY;

        if (sx + ts < -CULL_MARGIN || sx > W + CULL_MARGIN) continue;
        if (sy + ts < -CULL_MARGIN || sy > H + CULL_MARGIN) continue;

          this._drawTile(ctx, sx, sy, this.grid[ty][tx], tx, ty);
      }
    }

    this._drawExitArrows(ctx, camOffX, camOffY, now);
    this._drawStairs(ctx, camOffX, camOffY, now);
    this._drawObstacles(ctx, camOffX, camOffY, now);
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

    if (this.theme === 'forest') {
      this._drawForestTile(ctx, sx, sy, tileId, tx, ty, th, ts);
    } else if (this.theme === 'town') {
      this._drawTownTile(ctx, sx, sy, tileId, tx, ty, th, ts);
    } else {
      this._drawDungeonTile(ctx, sx, sy, tileId, th, ts, tx, ty);
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
      // ── ベース + 明暗バリエーション ─────────────────────────────
      ctx.fillStyle = th.wall.base;
      ctx.fillRect(sx, sy, ts, ts);
      const tileVar = (seed % 5) - 2;
      if (tileVar !== 0) {
        ctx.save();
        ctx.globalAlpha = Math.abs(tileVar) * 0.06;
        ctx.fillStyle = tileVar > 0 ? '#ffffff' : '#000000';
        ctx.fillRect(sx, sy, ts, ts);
        ctx.restore();
      }

      // ── 石ブロック目地（水平・垂直） ─────────────────────────────
      const mh = Math.round(ts / 3); // 水平目地間隔
      const bw = Math.round(ts / 2); // 垂直目地幅
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // 水平目地（2本）
      ctx.moveTo(sx,      sy + mh);     ctx.lineTo(sx + ts, sy + mh);
      ctx.moveTo(sx,      sy + mh * 2); ctx.lineTo(sx + ts, sy + mh * 2);
      ctx.stroke();
      // 垂直目地（行ごとにずらして石積みパターン）
      ctx.beginPath();
      const parity = ty % 2;
      const offA = parity === 0 ? bw : Math.round(bw / 2);
      const offB = parity === 0 ? Math.round(bw / 2) : bw;
      for (let col = sx + offA; col < sx + ts; col += bw) {
        ctx.moveTo(col, sy);       ctx.lineTo(col, sy + mh);
      }
      for (let col = sx + offB; col < sx + ts; col += bw) {
        ctx.moveTo(col, sy + mh);  ctx.lineTo(col, sy + mh * 2);
      }
      for (let col = sx + offA; col < sx + ts; col += bw) {
        ctx.moveTo(col, sy + mh * 2); ctx.lineTo(col, sy + ts);
      }
      ctx.stroke();
      ctx.restore();

      // ── ベベル ───────────────────────────────────────────────────
      ctx.fillStyle = th.wall.hi;
      ctx.fillRect(sx,          sy,          ts, 2);
      ctx.fillRect(sx,          sy,          2,  ts);
      ctx.fillStyle = th.wall.sh;
      ctx.fillRect(sx + ts - 2, sy,          2,  ts);
      ctx.fillRect(sx,          sy + ts - 2, ts, 2);

      // ── 外周薄フレーム ───────────────────────────────────────────
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#000000';
      ctx.fillRect(sx, sy, ts, 1);
      ctx.fillRect(sx, sy, 1, ts);
      ctx.restore();

      // ── 南側が床 → 前面フェイス ──────────────────────────────────
      const southIsFloor = southTile === TILE.FLOOR || southTile === TILE.CORRIDOR;
      if (southIsFloor) {
        ctx.save();
        const faceH = Math.round(ts * 0.18);
        const grad  = ctx.createLinearGradient(sx, sy + ts - faceH, sx, sy + ts);
        grad.addColorStop(0,   th.wall.hi.replace(/[\d.]+\)$/, '0.60)'));
        grad.addColorStop(0.5, th.wall.hi.replace(/[\d.]+\)$/, '0.30)'));
        grad.addColorStop(1,   th.wall.hi.replace(/[\d.]+\)$/, '0.05)'));
        ctx.fillStyle = grad;
        ctx.fillRect(sx, sy + ts - faceH, ts, faceH);
        ctx.restore();
      }

      // ── ひび割れ ──────────────────────────────────────────────────
      if (seed % 7 === 0) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = th.wall.lo;
        ctx.lineWidth   = 0.9;
        const sc = ts / 32;
        const crx = sx + Math.round(ts * 0.12) + (seed % Math.round(ts * 0.18));
        const cry = sy + Math.round(ts * 0.1)  + ((seed * 5) % Math.round(ts * 0.22));
        ctx.beginPath();
        ctx.moveTo(crx,           cry);
        ctx.lineTo(crx + 4 * sc,  cry + 5 * sc);
        ctx.lineTo(crx + 2 * sc,  cry + 9 * sc);
        ctx.lineTo(crx + 5 * sc,  cry + 13 * sc);
        ctx.stroke();
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

      // ── 北壁の落ち影 ──────────────────────────────────────────────
      if (northIsWall) {
        ctx.save();
        const shadowH = Math.round(ts * 0.26);
        const grad = ctx.createLinearGradient(sx, sy, sx, sy + shadowH);
        grad.addColorStop(0,   'rgba(0,0,0,0.55)');
        grad.addColorStop(0.5, 'rgba(0,0,0,0.22)');
        grad.addColorStop(1,   'rgba(0,0,0,0.00)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx, sy, ts, shadowH);
        ctx.restore();
      }

      // ── 西壁の落ち影 ──────────────────────────────────────────────
      if (westIsWall) {
        ctx.save();
        const wShadow = Math.round(ts * 0.17);
        const grad = ctx.createLinearGradient(sx, sy, sx + wShadow, sy);
        grad.addColorStop(0,   'rgba(0,0,0,0.32)');
        grad.addColorStop(1,   'rgba(0,0,0,0.00)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx, sy, wShadow, ts);
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

  private _drawTownTile(
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
      // ── ベース ───────────────────────────────────────────────────
      ctx.fillStyle = th.wall.base;
      ctx.fillRect(sx, sy, ts, ts);

      // ── レンガ目地（ts比例） ──────────────────────────────────────
      const bh = Math.round(ts / 4);  // レンガ高さ
      const bw = Math.round(ts / 2);  // レンガ幅
      ctx.strokeStyle = 'rgba(50,30,10,0.45)';
      ctx.lineWidth = 1;
      // 水平目地
      for (let y = sy + bh; y < sy + ts; y += bh) {
        ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + ts, y); ctx.stroke();
      }
      // 垂直目地（行ごとにずらす）
      const numRows = Math.ceil(ts / bh);
      for (let row = 0; row < numRows; row++) {
        const ry     = sy + row * bh;
        const offset = (((ty * 3 + row) % 2) === 0) ? 0 : Math.round(bw / 2);
        for (let x = sx + offset; x < sx + ts; x += bw) {
          ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x, ry + bh); ctx.stroke();
        }
      }

      // ── ハイライト・シャドウ ──────────────────────────────────────
      ctx.fillStyle = th.wall.hi;
      ctx.fillRect(sx, sy, ts, 2);
      ctx.fillRect(sx, sy, 2, ts);
      ctx.fillStyle = th.wall.sh;
      ctx.fillRect(sx + ts - 2, sy, 2, ts);
      ctx.fillRect(sx, sy + ts - 2, ts, 2);

      // ── 窓（比例サイズ） ──────────────────────────────────────────
      const seed = (tx * 41 + ty * 23) % 100;
      if (seed < 35) {
        const ww = Math.round(ts * 0.3);
        const wh = Math.round(ts * 0.22);
        const wx = sx + Math.round(ts * 0.33);
        const wy = sy + Math.round(ts * 0.2);
        ctx.fillStyle = seed < 20 ? 'rgba(255,220,80,0.6)' : 'rgba(100,140,180,0.45)';
        ctx.fillRect(wx, wy, ww, wh);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 1;
        ctx.strokeRect(wx, wy, ww, wh);
        ctx.beginPath();
        ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
        ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
        ctx.stroke();
      }

    } else {
      // ── 石畳 or 道路 ─────────────────────────────────────────────
      const isCorr = tileId === TILE.CORRIDOR;
      ctx.fillStyle = isCorr ? th.corridor.base : th.floor.base;
      ctx.fillRect(sx, sy, ts, ts);

      const pal = isCorr ? th.corridor : th.floor;
      ctx.strokeStyle = pal.grid;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(sx + 0.5, sy + 0.5, ts - 1, ts - 1);
      if (!isCorr) {
        ctx.fillStyle = pal.hi;
        ctx.fillRect(sx + 3, sy + 3, ts - 6, ts - 6);
        ctx.save();
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx + 5, sy + 5, ts - 10, ts - 10);
        ctx.restore();
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
            !(tileId === TILE.TRAP && this.revealedTraps.has(`${tx},${ty}`))) continue;

        const sx = tx * ts + camOffX;
        const sy = ty * ts + camOffY;
        if (sx + ts < -TILE_SIZE * 2 || sx > W + TILE_SIZE * 2) continue;
        if (sy + ts < -TILE_SIZE * 2 || sy > H + TILE_SIZE * 2) continue;

        if (tileId === TILE.PILLAR) {
          this._drawPillar(ctx, sx, sy, ts, now);
        } else if (tileId === TILE.WATER) {
          this._drawWater(ctx, sx, sy, ts, tx, ty, now);
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
