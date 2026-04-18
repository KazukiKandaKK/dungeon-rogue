// ─────────────────────────────────────────────
// dungeon.js  ダンジョン生成（部屋 + MST 廊下 + 4方向エグジット）
//   WFC の代替。閉鎖的な部屋と一本道の廊下を生成する。
// ─────────────────────────────────────────────

import { TILE } from './tiles.js';

const MIN_W        = 5;
const MIN_H        = 4;
const MAX_W        = 11;
const MAX_H        = 9;
const TARGET_ROOMS = 14;  // 大マップ用
const PLACE_TRIES  = 600;

export class DungeonGenerator {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
  }

  /**
   * ダンジョンを生成する
   * @returns {{ grid: number[][], exits: {}, rooms, monsterHouseRoom, stairs: {tx,ty} }}
   */
  generate() {
    // 全セルを壁で初期化
    const grid = Array.from({ length: this.rows }, () =>
      Array(this.cols).fill(TILE.WALL)
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
    const stairs = { tx: farthest.cx, ty: farthest.cy };

    // 障害物配置
    this._placeObstacles(grid, rooms, stairs);

    // モンスターハウスは専用フロア（MonsterHouseArenaGenerator）で処理するため常にnull
    return { grid, exits: {}, rooms, monsterHouseRoom: null, stairs };
  }

  // ─── 部屋配置 ──────────────────────────────────

  _room(x, y, w, h) {
    return { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) };
  }

  _placeRooms(grid) {
    const rooms = [];
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

  _overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  _carve(grid, x, y, w, h) {
    for (let ry = y; ry < y + h && ry < this.rows; ry++)
      for (let rx = x; rx < x + w && rx < this.cols; rx++)
        grid[ry][rx] = TILE.FLOOR;
  }

  // ─── MST 接続 ──────────────────────────────────

  _mst(grid, rooms) {
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

  _connect(grid, a, b) {
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
  _hLine(grid, x1, x2, y) {
    if (y < 0 || y >= this.rows) return;
    const lo = Math.max(0, Math.min(x1, x2));
    const hi = Math.min(this.cols - 1, Math.max(x1, x2));
    for (let x = lo; x <= hi; x++)
      if (grid[y][x] === TILE.WALL) grid[y][x] = TILE.CORRIDOR;
  }

  _vLine(grid, y1, y2, x) {
    if (x < 0 || x >= this.cols) return;
    const lo = Math.max(0, Math.min(y1, y2));
    const hi = Math.min(this.rows - 1, Math.max(y1, y2));
    for (let y = lo; y <= hi; y++)
      if (grid[y][x] === TILE.WALL) grid[y][x] = TILE.CORRIDOR;
  }

  // ─── 障害物配置 ────────────────────────────────

  _placeObstacles(grid, rooms, stairs) {
    // ── 柱 (PILLAR): 40%の部屋にランダム配置 ─────────────────
    for (const room of rooms) {
      if (room.w < 5 || room.h < 4) continue; // 小さい部屋はスキップ
      if (Math.random() > 0.45) continue;
      const maxPillars = Math.min(4, Math.floor((room.w * room.h) / 12));
      const attempts = maxPillars * 15;
      let placed = 0;
      for (let i = 0; i < attempts && placed < maxPillars; i++) {
        const px = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
        const py = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
        if (grid[py][px] !== TILE.FLOOR) continue;
        if (stairs && stairs.tx === px && stairs.ty === py) continue;
        // 柱どうしが隣接しないようにチェック
        const tooClose = [[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy]) =>
          grid[py+dy]?.[px+dx] === TILE.PILLAR
        );
        if (tooClose) continue;
        grid[py][px] = TILE.PILLAR;
        placed++;
      }
    }

    // ── 水 (WATER): 1〜2箇所に水たまり ──────────────────────
    const poolCount = 1 + Math.floor(Math.random() * 2);
    for (let p = 0; p < poolCount; p++) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      if (room.w < 4 || room.h < 4) continue;
      const sx = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
      const sy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
      if (grid[sy][sx] !== TILE.FLOOR) continue;
      const targetSize = 3 + Math.floor(Math.random() * 5);
      const frontier = [[sx, sy]];
      let added = 0;
      while (frontier.length > 0 && added < targetSize) {
        const idx = Math.floor(Math.random() * frontier.length);
        const [cx, cy] = frontier.splice(idx, 1)[0];
        if (grid[cy]?.[cx] !== TILE.FLOOR) continue;
        if (stairs && stairs.tx === cx && stairs.ty === cy) continue;
        grid[cy][cx] = TILE.WATER;
        added++;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          if (Math.random() < 0.55) frontier.push([cx+dx, cy+dy]);
        }
      }
    }

    // ── 罠 (TRAP): フロア全体に3〜7個ランダム配置 ────────────
    const density   = this.trapDensity ?? 1;
    const trapCount = Math.floor((3 + Math.floor(Math.random() * 5)) * density);
    const candidates = [];
    for (let ty = 1; ty < this.rows - 1; ty++)
      for (let tx = 1; tx < this.cols - 1; tx++)
        if (grid[ty][tx] === TILE.FLOOR &&
            !(stairs && stairs.tx === tx && stairs.ty === ty))
          candidates.push([tx, ty]);

    for (let i = 0; i < trapCount && candidates.length > 0; i++) {
      const idx = Math.floor(Math.random() * candidates.length);
      const [tx, ty] = candidates.splice(idx, 1)[0];
      grid[ty][tx] = TILE.TRAP;
    }
  }

  // ─── エグジット ─────────────────────────────────

  /**
   * 指定方向の端まで廊下を伸ばしてエグジットタイルを返す
   * @param {'N'|'S'|'E'|'W'} dir
   */
  _exit(grid, rooms, dir) {
    // 方向に最も近い部屋を選ぶ
    let room;
    if (dir === 'N') room = rooms.reduce((a, b) => a.cy < b.cy ? a : b);
    if (dir === 'S') room = rooms.reduce((a, b) => a.cy > b.cy ? a : b);
    if (dir === 'W') room = rooms.reduce((a, b) => a.cx < b.cx ? a : b);
    if (dir === 'E') room = rooms.reduce((a, b) => a.cx > b.cx ? a : b);

    let tx, ty;
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
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
  }

  generate() {
    const { cols, rows } = this;
    // 全て床（外周のみ壁）
    const grid = Array.from({ length: rows }, (_, y) =>
      Array.from({ length: cols }, (_, x) =>
        (x === 0 || y === 0 || x === cols - 1 || y === rows - 1)
          ? TILE.WALL : TILE.FLOOR
      )
    );

    this._placePillars(grid);

    // 4辺の入口廊下（ボスアリーナと同様）
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    const exits = {
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
    const stairs = { tx: stx, ty: sty };

    // モンスターハウスの範囲 = フロア全体（境界壁除く）
    const monsterHouseRoom = {
      x: 1, y: 1, w: cols - 2, h: rows - 2, cx, cy,
    };

    return { grid, exits, rooms: [], monsterHouseRoom, stairs };
  }

  _placePillars(grid) {
    const { cols, rows } = this;
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);

    const put  = (x, y) => {
      if (x > 1 && y > 1 && x < cols - 2 && y < rows - 2) grid[y][x] = TILE.WALL;
    };
    const near = (x, y) => Math.abs(x - cx) < 8 && Math.abs(y - cy) < 7;
    const hwall = (x, y, len) => { for (let d = 0; d < len; d++) put(x + d, y); };
    const vwall = (x, y, len) => { for (let d = 0; d < len; d++) put(x, y + d); };
    const block = (x, y, w, h) => {
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
    ]) {
      if (near(x, y)) continue;
      hwall(x, y, len);
    }

    // ── 縦長壁（5〜6タイル）：左右帯に密に追加 ────────
    for (const [x, y, len] of [
      [4,  4, 5], [4, 12, 6], [4, 21, 5], [4, 30, 6], [4, 39, 5],
      [55, 4, 5], [55,12, 6], [55,21, 5], [55,30, 6], [55,39, 5],
    ]) {
      if (near(x, y)) continue;
      vwall(x, y, len);
    }

    // ── 中間帯の長めの横壁（廊下的な仕切り）────────────
    for (const [x, y, len] of [
      [4, 16, 8], [16,16, 6], [36,16, 6], [48,16, 8],
      [4, 32, 8], [16,32, 6], [36,32, 6], [48,32, 8],
    ]) {
      if (near(x, y)) continue;
      hwall(x, y, len);
    }

    // ── 中間帯の縦壁（横の仕切り）───────────────────
    for (const [x, y, len] of [
      [15,  4, 6], [15, 38, 6],
      [44,  4, 6], [44, 38, 6],
      [15, 21, 5], [44, 21, 5],
    ]) {
      if (near(x, y)) continue;
      vwall(x, y, len);
    }
  }
}

// ─────────────────────────────────────────────
// ボス戦アリーナ生成（広い一部屋 + 柱）
// ─────────────────────────────────────────────
export class BossArenaGenerator {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
  }

  generate() {
    const { cols, rows } = this;
    // 全て床
    const grid = Array.from({ length: rows }, (_, y) =>
      Array.from({ length: cols }, (_, x) =>
        (x === 0 || y === 0 || x === cols - 1 || y === rows - 1)
          ? TILE.WALL : TILE.FLOOR
      )
    );

    this._placePillars(grid);

    // 4辺にエグジット（中央）
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    const exits = {
      N: { tx: cx, ty: 0 },
      S: { tx: cx, ty: rows - 1 },
      W: { tx: 0, ty: cy },
      E: { tx: cols - 1, ty: cy },
    };
    // 入口廊下
    for (let y = 1; y < rows - 1; y++) grid[y][0]       = TILE.CORRIDOR;
    for (let y = 1; y < rows - 1; y++) grid[y][cols - 1] = TILE.CORRIDOR;
    for (let x = 1; x < cols - 1; x++) grid[0][x]       = TILE.CORRIDOR;
    for (let x = 1; x < cols - 1; x++) grid[rows - 1][x] = TILE.CORRIDOR;

    return { grid, exits };
  }

  _placePillars(grid) {
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
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
  }

  generate() {
    const { cols, rows } = this;
    const grid = Array.from({ length: rows }, (_, y) =>
      Array.from({ length: cols }, (_, x) =>
        (x === 0 || y === 0 || x === cols - 1 || y === rows - 1)
          ? TILE.WALL : TILE.FLOOR
      )
    );
    // 内側に柱（装飾）— BASE_COLS=16,BASE_ROWS=12 レイアウト対応
    const pillars = [[2,8],[2,9],[13,8],[13,9]];
    for (const [px, py] of pillars) {
      if (px > 0 && py > 0 && px < cols-1 && py < rows-1) {
        grid[py][px] = TILE.WALL;
      }
    }
    return { grid, exits: {}, rooms: [], monsterHouseRoom: null };
  }
}
