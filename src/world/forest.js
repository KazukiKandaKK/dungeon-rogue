// ─────────────────────────────────────────────
// forest.js  森マップ生成（セルオートマトン）
// ─────────────────────────────────────────────

import { TILE } from './tiles.js';

export class ForestGenerator {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
  }

  generate() {
    // 1. ランダムノイズ（52% ツリー → やや密な森）
    let grid = Array.from({ length: this.rows }, (_, y) =>
      Array.from({ length: this.cols }, (_, x) =>
        (x === 0 || y === 0 || x === this.cols - 1 || y === this.rows - 1 || Math.random() < 0.52)
          ? TILE.WALL : TILE.FLOOR
      )
    );

    // 2. セルオートマトン平滑化（5 回）
    for (let i = 0; i < 5; i++) grid = this._smooth(grid);

    // 3. 中央スポーン地点を開ける
    const cx = Math.floor(this.cols / 2);
    const cy = Math.floor(this.rows / 2);
    this._clearArea(grid, cx, cy, 4);

    // 4. エグジット廊下を掘る
    const exits = this._addExits(grid);

    // 5. 階段を配置（中央から遠い歩行可能タイル）
    const stairs = this._placeStairs(grid, cx, cy, exits);

    return { grid, exits, stairs };
  }

  _smooth(grid) {
    return Array.from({ length: this.rows }, (_, y) =>
      Array.from({ length: this.cols }, (_, x) => {
        if (x === 0 || y === 0 || x === this.cols - 1 || y === this.rows - 1) return TILE.WALL;
        return this._countWallNeighbors(grid, x, y) >= 5 ? TILE.WALL : TILE.FLOOR;
      })
    );
  }

  _countWallNeighbors(grid, x, y) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) n++;
        else if (grid[ny][nx] === TILE.WALL) n++;
      }
    }
    return n;
  }

  _clearArea(grid, cx, cy, r) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x > 0 && y > 0 && x < this.cols - 1 && y < this.rows - 1)
          grid[y][x] = TILE.FLOOR;
      }
    }
  }

  // 各辺の中央付近の歩行可能セルから端まで通路を掘る
  _addExits(grid) {
    const exits = {};
    const dirs = {
      N: { scanY: 1,               scanX: Math.floor(this.cols / 2), lineY: [0, null],            lineX: null },
      S: { scanY: this.rows - 2,   scanX: Math.floor(this.cols / 2), lineY: [null, this.rows - 1], lineX: null },
      W: { scanY: Math.floor(this.rows / 2), scanX: 1,              lineY: null, lineX: [0, null]  },
      E: { scanY: Math.floor(this.rows / 2), scanX: this.cols - 2,  lineY: null, lineX: [null, this.cols - 1] },
    };

    for (const [dir, cfg] of Object.entries(dirs)) {
      // 中央から最も近い歩行可能セルを探す
      const anchor = this._findWalkableNear(grid, cfg.scanX, cfg.scanY, dir);
      if (!anchor) continue;

      // 端まで直線を掘る
      if (dir === 'N') {
        for (let y = 0; y <= anchor.y; y++)
          if (grid[y][anchor.x] === TILE.WALL) grid[y][anchor.x] = TILE.CORRIDOR;
        exits[dir] = { tx: anchor.x, ty: 0 };
      } else if (dir === 'S') {
        for (let y = anchor.y; y < this.rows; y++)
          if (grid[y][anchor.x] === TILE.WALL) grid[y][anchor.x] = TILE.CORRIDOR;
        exits[dir] = { tx: anchor.x, ty: this.rows - 1 };
      } else if (dir === 'W') {
        for (let x = 0; x <= anchor.x; x++)
          if (grid[anchor.y][x] === TILE.WALL) grid[anchor.y][x] = TILE.CORRIDOR;
        exits[dir] = { tx: 0, ty: anchor.y };
      } else {
        for (let x = anchor.x; x < this.cols; x++)
          if (grid[anchor.y][x] === TILE.WALL) grid[anchor.y][x] = TILE.CORRIDOR;
        exits[dir] = { tx: this.cols - 1, ty: anchor.y };
      }
    }
    return exits;
  }

  _findWalkableNear(grid, cx, cy, dir) {
    const isH = (dir === 'N' || dir === 'S');
    for (let r = 0; r < Math.max(this.cols, this.rows); r++) {
      for (let d = -r; d <= r; d++) {
        const x = isH ? cx + d : cx;
        const y = isH ? cy     : cy + d;
        if (x <= 0 || y <= 0 || x >= this.cols - 1 || y >= this.rows - 1) continue;
        if (grid[y][x] !== TILE.WALL) return { x, y };
      }
    }
    return null;
  }

  // 中央から遠い歩行可能タイルに階段を配置
  _placeStairs(grid, spawnX, spawnY, exits) {
    const isExit = (tx, ty) => Object.values(exits).some(e => e.tx === tx && e.ty === ty);
    const minDist = Math.floor(Math.min(this.cols, this.rows) * 0.4);

    // 候補：中央から一定距離以上・出口でない・壁際でない
    const candidates = [];
    for (let ty = 2; ty < this.rows - 2; ty++) {
      for (let tx = 2; tx < this.cols - 2; tx++) {
        if (grid[ty][tx] !== TILE.FLOOR) continue;
        if (isExit(tx, ty)) continue;
        const dist = Math.abs(tx - spawnX) + Math.abs(ty - spawnY);
        if (dist >= minDist) candidates.push({ tx, ty, dist });
      }
    }

    if (candidates.length === 0) {
      // 候補なければ距離条件を緩めて再探索
      for (let ty = 2; ty < this.rows - 2; ty++) {
        for (let tx = 2; tx < this.cols - 2; tx++) {
          if (grid[ty][tx] !== TILE.FLOOR) continue;
          if (isExit(tx, ty)) continue;
          candidates.push({ tx, ty });
        }
      }
    }

    if (candidates.length === 0) return null;

    // 最も遠い候補を選ぶ
    candidates.sort((a, b) => (b.dist ?? 0) - (a.dist ?? 0));
    const chosen = candidates[0];
    grid[chosen.ty][chosen.tx] = TILE.STAIRS;
    return { tx: chosen.tx, ty: chosen.ty };
  }
}
