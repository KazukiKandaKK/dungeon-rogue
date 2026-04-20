// ─────────────────────────────────────────────
// dungeon.ts  ダンジョン生成（部屋 + MST 廊下 + 4方向エグジット）
//   WFC の代替。閉鎖的な部屋と一本道の廊下を生成する。
// ─────────────────────────────────────────────

import { TILE } from './tiles.js';
import type { TileType } from './tiles.js';
import type { ExitMap, ExitPos } from './forest.js';

const MIN_W        = 5;
const MIN_H        = 4;
const MAX_W        = 11;
const MAX_H        = 9;
const TARGET_ROOMS = 14;  // 大マップ用
const PLACE_TRIES  = 600;

export interface Room {
  x:  number;
  y:  number;
  w:  number;
  h:  number;
  cx: number;
  cy: number;
}

export interface DungeonResult {
  grid:             TileType[][];
  exits:            ExitMap;
  rooms:            Room[];
  monsterHouseRoom: Room | null;
  stairs:           ExitPos | null;
}

export class DungeonGenerator {
  cols:        number;
  rows:        number;
  trapDensity: number;

  constructor(cols: number, rows: number) {
    this.cols        = cols;
    this.rows        = rows;
    this.trapDensity = 1;
  }

  /**
   * ダンジョンを生成する
   */
  generate(): DungeonResult {
    // 全セルを壁で初期化
    const grid: TileType[][] = Array.from({ length: this.rows }, () =>
      Array<TileType>(this.cols).fill(TILE.WALL)
    );

    const rooms = this._placeRooms(grid);

    // フォールバック：部屋が 0 なら中央に 1 部屋
    if (rooms.length === 0) {
      const cx = Math.floor(this.cols / 2) - 3;
      const cy = Math.floor(this.rows / 2) - 3;
      this._carve(grid, cx, cy, 6, 6);
      rooms.push(this._room(cx, cy, 6, 6));
    }

    // 最小全域木（最近傍グリーディ）で全部屋を接続
    this._mst(grid, rooms);

    // 階段：マップ中央から最も遠い部屋の中心に配置
    const mcx = Math.floor(this.cols / 2);
    const mcy = Math.floor(this.rows / 2);
    const farthest = rooms.reduce((a, b) => {
      const da = Math.abs(a.cx - mcx) + Math.abs(a.cy - mcy);
      const db = Math.abs(b.cx - mcx) + Math.abs(b.cy - mcy);
      return db > da ? b : a;
    });
    grid[farthest.cy][farthest.cx] = TILE.STAIRS;
    const stairs: ExitPos = { tx: farthest.cx, ty: farthest.cy };

    // 障害物配置
    this._placeObstacles(grid, rooms, stairs);

    // モンスターハウスは専用フロア（MonsterHouseArenaGenerator）で処理するため常にnull
    return { grid, exits: {}, rooms, monsterHouseRoom: null, stairs };
  }

  // ─── 部屋配置 ──────────────────────────────────

  private _room(x: number, y: number, w: number, h: number): Room {
    return { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) };
  }

  private _placeRooms(grid: TileType[][]): Room[] {
    const rooms: Room[] = [];
    for (let t = 0; t < PLACE_TRIES && rooms.length < TARGET_ROOMS; t++) {
      const w = MIN_W + Math.floor(Math.random() * (MAX_W - MIN_W + 1));
      const h = MIN_H + Math.floor(Math.random() * (MAX_H - MIN_H + 1));
      // 端 1 タイルを壁として残す
      const x = 1 + Math.floor(Math.random() * (this.cols - w - 2));
      const y = 1 + Math.floor(Math.random() * (this.rows - h - 2));

      // 1 タイル余白を設けて重なりチェック（廊下が密着しないように）
      if (rooms.some(r => this._overlaps(x - 1, y - 1, w + 2, h + 2, r.x, r.y, r.w, r.h))) {
        continue;
      }
      this._carve(grid, x, y, w, h);
      rooms.push(this._room(x, y, w, h));
    }
    return rooms;
  }

  private _overlaps(
    ax: number, ay: number, aw: number, ah: number,
    bx: number, by: number, bw: number, bh: number
  ): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  private _carve(grid: TileType[][], x: number, y: number, w: number, h: number): void {
    for (let ry = y; ry < y + h && ry < this.rows; ry++)
      for (let rx = x; rx < x + w && rx < this.cols; rx++)
        grid[ry][rx] = TILE.FLOOR;
  }

  // ─── MST 接続 ──────────────────────────────────

  private _mst(grid: TileType[][], rooms: Room[]): void {
    if (rooms.length < 2) return;
    const connected = new Set([0]);
    while (connected.size < rooms.length) {
      let best = { d: Infinity, ai: -1, bi: -1 };
      for (const ai of connected) {
        for (let bi = 0; bi < rooms.length; bi++) {
          if (connected.has(bi)) continue;
          const d = Math.abs(rooms[ai].cx - rooms[bi].cx)
                  + Math.abs(rooms[ai].cy - rooms[bi].cy);
          if (d < best.d) best = { d, ai, bi };
        }
      }
      if (best.ai === -1) break;
      this._connect(grid, rooms[best.ai], rooms[best.bi]);
      connected.add(best.bi);
    }
  }

  private _connect(grid: TileType[][], a: Room, b: Room): void {
    // L 字廊下（折れ曲がり方をランダムに選ぶ）
    if (Math.random() < 0.5) {
      this._hLine(grid, a.cx, b.cx, a.cy);
      this._vLine(grid, a.cy, b.cy, b.cx);
    } else {
      this._vLine(grid, a.cy, b.cy, a.cx);
      this._hLine(grid, a.cx, b.cx, b.cy);
    }
  }

  // 壁タイルのみを CORRIDOR に変える（床を上書きしない）
  private _hLine(grid: TileType[][], x1: number, x2: number, y: number): void {
    if (y < 0 || y >= this.rows) return;
    const lo = Math.max(0, Math.min(x1, x2));
    const hi = Math.min(this.cols - 1, Math.max(x1, x2));
    for (let x = lo; x <= hi; x++)
      if (grid[y][x] === TILE.WALL) grid[y][x] = TILE.CORRIDOR;
  }

  private _vLine(grid: TileType[][], y1: number, y2: number, x: number): void {
    if (x < 0 || x >= this.cols) return;
    const lo = Math.max(0, Math.min(y1, y2));
    const hi = Math.min(this.rows - 1, Math.max(y1, y2));
    for (let y = lo; y <= hi; y++)
      if (grid[y][x] === TILE.WALL) grid[y][x] = TILE.CORRIDOR;
  }

  // ─── 障害物配置 ────────────────────────────────

  private _placeObstacles(grid: TileType[][], rooms: Room[], stairs: ExitPos): void {
    // ── 柱 (PILLAR): 40%の部屋にランダム配置 ─────────────────
    for (const room of rooms) {
      if (room.w < 5 || room.h < 4) continue; // 小さい部屋はスキップ
      if (Math.random() > 0.45) continue;
      const maxPillars = Math.min(4, Math.floor((room.w * room.h) / 12));
      const attempts   = maxPillars * 15;
      let placed = 0;
      for (let i = 0; i < attempts && placed < maxPillars; i++) {
        const px = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
        const py = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
        if (grid[py][px] !== TILE.FLOOR) continue;
        if (stairs && stairs.tx === px && stairs.ty === py) continue;
        // 柱どうしが隣接しないようにチェック
        const tooClose = ([[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]).some(([dx,dy]) =>
          grid[py+dy]?.[px+dx] === TILE.PILLAR
        );
        if (tooClose) continue;
        grid[py][px] = TILE.PILLAR;
        placed++;
      }
    }

    // ── 特殊床 (WATER / ICE / MAGMA): 各 1〜2箇所 ──────────────
    const placePatch = (tile: TileType, growProb: number) => {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      if (room.w < 4 || room.h < 4) return;
      const sx = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
      const sy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
      if (grid[sy][sx] !== TILE.FLOOR) return;
      const targetSize = 3 + Math.floor(Math.random() * 5);
      const frontier: [number, number][] = [[sx, sy]];
      let added = 0;
      while (frontier.length > 0 && added < targetSize) {
        const idx2 = Math.floor(Math.random() * frontier.length);
        const [cx, cy] = frontier.splice(idx2, 1)[0];
        if (grid[cy]?.[cx] !== TILE.FLOOR) continue;
        if (stairs && stairs.tx === cx && stairs.ty === cy) continue;
        grid[cy][cx] = tile;
        added++;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
          if (Math.random() < growProb) frontier.push([cx+dx, cy+dy]);
        }
      }
    };
    // 水
    const poolCount = 1 + Math.floor(Math.random() * 2);
    for (let p = 0; p < poolCount; p++) placePatch(TILE.WATER, 0.55);
    // 氷（40% の確率で 1 箇所）
    if (Math.random() < 0.4) placePatch(TILE.ICE, 0.55);
    // マグマ（30% の確率で 1 箇所、小さめ）
    if (Math.random() < 0.3) placePatch(TILE.MAGMA, 0.45);

    // ── 罠 (TRAP): フロア全体に3〜7個ランダム配置 ────────────
    const density   = this.trapDensity;
    const trapCount = Math.floor((3 + Math.floor(Math.random() * 5)) * density);
    const candidates: [number, number][] = [];
    for (let ty = 1; ty < this.rows - 1; ty++)
      for (let tx = 1; tx < this.cols - 1; tx++)
        if (grid[ty][tx] === TILE.FLOOR &&
            !(stairs && stairs.tx === tx && stairs.ty === ty))
          candidates.push([tx, ty]);

    for (let i = 0; i < trapCount && candidates.length > 0; i++) {
      const idx2 = Math.floor(Math.random() * candidates.length);
      const [tx, ty] = candidates.splice(idx2, 1)[0];
      grid[ty][tx] = TILE.TRAP;
    }
  }

  // ─── エグジット ─────────────────────────────────

  /**
   * 指定方向の端まで廊下を伸ばしてエグジットタイルを返す
   */
  _exit(grid: TileType[][], rooms: Room[], dir: 'N' | 'S' | 'E' | 'W'): ExitPos {
    // 方向に最も近い部屋を選ぶ
    let room: Room;
    if (dir === 'N') room = rooms.reduce((a, b) => a.cy < b.cy ? a : b);
    else if (dir === 'S') room = rooms.reduce((a, b) => a.cy > b.cy ? a : b);
    else if (dir === 'W') room = rooms.reduce((a, b) => a.cx < b.cx ? a : b);
    else room = rooms.reduce((a, b) => a.cx > b.cx ? a : b);

    let tx: number, ty: number;
    if (dir === 'N') {
      tx = room.cx; ty = 0;
      this._vLine(grid, 0, room.cy, tx);
    } else if (dir === 'S') {
      tx = room.cx; ty = this.rows - 1;
      this._vLine(grid, room.cy, this.rows - 1, tx);
    } else if (dir === 'W') {
      tx = 0; ty = room.cy;
      this._hLine(grid, 0, room.cx, ty);
    } else {
      tx = this.cols - 1; ty = room.cy;
      this._hLine(grid, room.cx, this.cols - 1, ty);
    }

    // 端タイルを確実に CORRIDOR にする
    grid[ty][tx] = TILE.CORRIDOR;
    return { tx, ty };
  }
}

// ─────────────────────────────────────────────
// モンスターハウス専用フロア生成（広い一部屋 + 柱 + 階段）
// ─────────────────────────────────────────────
export class MonsterHouseArenaGenerator {
  cols: number;
  rows: number;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
  }

  generate(): DungeonResult {
    const { cols, rows } = this;
    // 全て床（外周のみ壁）
    const grid: TileType[][] = Array.from({ length: rows }, (_, y) =>
      Array.from({ length: cols }, (_, x) =>
        (x === 0 || y === 0 || x === cols - 1 || y === rows - 1)
          ? TILE.WALL : TILE.FLOOR
      )
    );

    this._placePillars(grid);

    // 4辺の入口廊下（ボスアリーナと同様）
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    const exits: ExitMap = {
      N: { tx: cx, ty: 0 },
      S: { tx: cx, ty: rows - 1 },
      W: { tx: 0,  ty: cy },
      E: { tx: cols - 1, ty: cy },
    };
    for (let y = 1; y < rows - 1; y++) grid[y][0]        = TILE.CORRIDOR;
    for (let y = 1; y < rows - 1; y++) grid[y][cols - 1] = TILE.CORRIDOR;
    for (let x = 1; x < cols - 1; x++) grid[0][x]        = TILE.CORRIDOR;
    for (let x = 1; x < cols - 1; x++) grid[rows - 1][x] = TILE.CORRIDOR;

    // 階段：右下コーナー付近（プレイヤースポーン＝中央から遠い）
    const stx = cols - 4;
    const sty = rows - 4;
    grid[sty][stx] = TILE.STAIRS;
    const stairs: ExitPos = { tx: stx, ty: sty };

    // モンスターハウスの範囲 = フロア全体（境界壁除く）
    const monsterHouseRoom: Room = {
      x: 1, y: 1, w: cols - 2, h: rows - 2, cx, cy,
    };

    return { grid, exits, rooms: [], monsterHouseRoom, stairs };
  }

  private _placePillars(grid: TileType[][]): void {
    const { cols, rows } = this;
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);

    const put  = (x: number, y: number) => {
      if (x > 1 && y > 1 && x < cols - 2 && y < rows - 2) grid[y][x] = TILE.WALL;
    };
    const near = (x: number, y: number) => Math.abs(x - cx) < 8 && Math.abs(y - cy) < 7;
    const hwall = (x: number, y: number, len: number) => { for (let d = 0; d < len; d++) put(x + d, y); };
    const vwall = (x: number, y: number, len: number) => { for (let d = 0; d < len; d++) put(x, y + d); };
    const block = (x: number, y: number, w: number, h: number) => {
      for (let dy = 0; dy < h; dy++)
        for (let dx = 0; dx < w; dx++) put(x + dx, y + dy);
    };

    // ── 2×2 柱を超密グリッド（step 5×4）で敷き詰める ──
    for (let gy = 3; gy < rows - 3; gy += 4) {
      for (let gx = 3; gx < cols - 3; gx += 5) {
        if (near(gx, gy)) continue;
        block(gx, gy, 2, 2);
      }
    }

    // ── 横長壁（5〜6タイル）：上下帯に密に追加 ────────
    for (const [x, y, len] of [
      [4,  4, 5], [12, 4, 6], [22, 4, 5], [32, 4, 6], [42, 4, 5], [50, 4, 5],
      [4, 44, 5], [12,44, 6], [22,44, 5], [32,44, 6], [42,44, 5], [50,44, 5],
    ] as [number, number, number][]) {
      if (near(x, y)) continue;
      hwall(x, y, len);
    }

    // ── 縦長壁（5〜6タイル）：左右帯に密に追加 ────────
    for (const [x, y, len] of [
      [4,  4, 5], [4, 12, 6], [4, 21, 5], [4, 30, 6], [4, 39, 5],
      [55, 4, 5], [55,12, 6], [55,21, 5], [55,30, 6], [55,39, 5],
    ] as [number, number, number][]) {
      if (near(x, y)) continue;
      vwall(x, y, len);
    }

    // ── 中間帯の長めの横壁（廊下的な仕切り）────────────
    for (const [x, y, len] of [
      [4, 16, 8], [16,16, 6], [36,16, 6], [48,16, 8],
      [4, 32, 8], [16,32, 6], [36,32, 6], [48,32, 8],
    ] as [number, number, number][]) {
      if (near(x, y)) continue;
      hwall(x, y, len);
    }

    // ── 中間帯の縦壁（横の仕切り）───────────────────
    for (const [x, y, len] of [
      [15,  4, 6], [15, 38, 6],
      [44,  4, 6], [44, 38, 6],
      [15, 21, 5], [44, 21, 5],
    ] as [number, number, number][]) {
      if (near(x, y)) continue;
      vwall(x, y, len);
    }
  }
}

// ─────────────────────────────────────────────
// ボス戦アリーナ生成（広い一部屋 + 柱）
// ─────────────────────────────────────────────
export interface ArenaResult {
  grid:  TileType[][];
  exits: ExitMap;
}

export class BossArenaGenerator {
  cols: number;
  rows: number;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
  }

  generate(): ArenaResult {
    const { cols, rows } = this;
    // 全て床
    const grid: TileType[][] = Array.from({ length: rows }, (_, y) =>
      Array.from({ length: cols }, (_, x) =>
        (x === 0 || y === 0 || x === cols - 1 || y === rows - 1)
          ? TILE.WALL : TILE.FLOOR
      )
    );

    this._placePillars(grid);

    // 4辺にエグジット（中央）
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    const exits: ExitMap = {
      N: { tx: cx, ty: 0 },
      S: { tx: cx, ty: rows - 1 },
      W: { tx: 0, ty: cy },
      E: { tx: cols - 1, ty: cy },
    };
    // 入口廊下
    for (let y = 1; y < rows - 1; y++) grid[y][0]        = TILE.CORRIDOR;
    for (let y = 1; y < rows - 1; y++) grid[y][cols - 1] = TILE.CORRIDOR;
    for (let x = 1; x < cols - 1; x++) grid[0][x]        = TILE.CORRIDOR;
    for (let x = 1; x < cols - 1; x++) grid[rows - 1][x] = TILE.CORRIDOR;

    return { grid, exits };
  }

  private _placePillars(grid: TileType[][]): void {
    const { cols, rows } = this;
    // 外周から6マス内側に、6マスおきに2×2の柱
    const offX = 8, offY = 6, stepX = 12, stepY = 10;
    for (let y = offY; y < rows - offY; y += stepY) {
      for (let x = offX; x < cols - offX; x += stepX) {
        // 中央エリア（プレイヤースポーン付近）は空ける
        const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
        if (Math.abs(x - cx) < 6 && Math.abs(y - cy) < 6) continue;
        // 2×2 の柱
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx > 1 && ny > 1 && nx < cols - 2 && ny < rows - 2) {
              grid[ny][nx] = TILE.WALL;
            }
          }
        }
      }
    }
  }
}

// ─────────────────────────────────────────────
// 拠点（ベースルーム）生成
// ─────────────────────────────────────────────
export class BaseRoomGenerator {
  cols: number;
  rows: number;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
  }

  generate(): DungeonResult {
    const { cols, rows } = this;
    const grid: TileType[][] = Array.from({ length: rows }, (_, y) =>
      Array.from({ length: cols }, (_, x) =>
        (x === 0 || y === 0 || x === cols - 1 || y === rows - 1)
          ? TILE.WALL : TILE.FLOOR
      )
    );

    // 28×20 レイアウト（地区分け）
    //   ポータルの間と中央広場を区切る「アーチ状の仕切り壁」
    //   中央の噴水（2×2 ブロック）
    //   各施設は 3×2 タイル占有の建物（本体 5 マスが壁、扉 1 マスだけ床）
    //   商業地区／工房地区の区切り柱
    //   裏路地の結界柱
    const walls: [number, number][] = [
      // ── 上段：ポータルの間を囲む飾り柱 ──
      [1, 2], [26, 2],
      [1, 6], [26, 6],

      // ── 中仕切り（y=7）：左右に壁、中央 x=6..21 は広いアーチで開放 ──
      [2, 7], [3, 7], [4, 7], [5, 7],
      [22, 7], [23, 7], [24, 7], [25, 7],

      // ── 中央噴水（2×2） ──
      [13, 8], [14, 8],
      [13, 9], [14, 9],

      // ── 商業地区（西）／工房地区（東）を画定する柱 ──
      [2, 11], [25, 11],
      [2, 13], [25, 13],

      // ── 裏路地の入口柱（門柱風） ──
      [10, 14], [17, 14],

      // ── ショップ（扉 (4,12)） 本体 5 マス ──
      [3, 11], [4, 11], [5, 11],
      [3, 12],          [5, 12],

      // ── 委託露店（扉 (8,12)） 本体 5 マス ──
      [7, 11], [8, 11], [9, 11],
      [7, 12],          [9, 12],

      // ── 鍛冶屋（扉 (19,12)） 本体 5 マス ──
      [18, 11], [19, 11], [20, 11],
      [18, 12],           [20, 12],

      // ── 転職の祭壇（扉 (23,12)） 本体 5 マス ──
      [22, 11], [23, 11], [24, 11],
      [22, 12],           [24, 12],

      // ── 金貸し（扉 (3,15)） 本体 5 マス ──
      [2, 14], [3, 14], [4, 14],
      [2, 15],          [4, 15],

      // ── カジノ（扉 (24,15)） 本体 5 マス ──
      [23, 14], [24, 14], [25, 14],
      [23, 15],           [25, 15],
    ];

    for (const [px, py] of walls) {
      if (px > 0 && py > 0 && px < cols - 1 && py < rows - 1) {
        grid[py][px] = TILE.WALL;
      }
    }

    return { grid, exits: {}, rooms: [], monsterHouseRoom: null, stairs: null };
  }
}
