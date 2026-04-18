// ─────────────────────────────────────────────
// town.ts  街マップ生成（ブロック + 道路グリッド）
// ─────────────────────────────────────────────

import { TILE } from './tiles.js';
import type { TileType } from './tiles.js';
import type { ExitMap, ExitPos } from './forest.js';

const BLOCK = 9;  // ブロックサイズ（建物1区画 + 道路1本）
const ROAD  = 2;  // 道路幅

export interface TownResult {
  grid:  TileType[][];
  exits: ExitMap;
}

export class TownGenerator {
  cols: number;
  rows: number;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
  }

  generate(): TownResult {
    // 全て建物（壁）で初期化
    const grid: TileType[][] = Array.from({ length: this.rows }, () =>
      Array<TileType>(this.cols).fill(TILE.WALL)
    );

    // 水平・垂直の道路を掘る
    for (let y = 1; y < this.rows - 1; y++) {
      if (this._isRoadLine(y, this.rows)) {
        for (let x = 1; x < this.cols - 1; x++)
          grid[y][x] = TILE.CORRIDOR;
      }
    }
    for (let x = 1; x < this.cols - 1; x++) {
      if (this._isRoadLine(x, this.cols)) {
        for (let y = 1; y < this.rows - 1; y++)
          if (grid[y][x] === TILE.WALL) grid[y][x] = TILE.CORRIDOR;
      }
    }

    // 交差点を広場（FLOOR）に
    for (let y = 1; y < this.rows - 1; y++) {
      for (let x = 1; x < this.cols - 1; x++) {
        if (this._isRoadLine(y, this.rows) && this._isRoadLine(x, this.cols)) {
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx > 0 && ny > 0 && nx < this.cols - 1 && ny < this.rows - 1)
                grid[ny][nx] = TILE.FLOOR;
            }
        }
      }
    }

    // 中央広場（大きめ）
    const cx = Math.floor(this.cols / 2);
    const cy = Math.floor(this.rows / 2);
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx > 0 && ny > 0 && nx < this.cols - 1 && ny < this.rows - 1)
          grid[ny][nx] = TILE.FLOOR;
      }

    // 建物内部にランダムな小部屋を作る（抜け道が生まれる）
    this._carveRooms(grid);

    // エグジット
    const exits = this._addExits(grid);

    return { grid, exits };
  }

  private _isRoadLine(pos: number, size: number): boolean {
    // BLOCK ごとに ROAD 本幅の道路
    const mod = pos % BLOCK;
    return mod >= BLOCK - ROAD && mod < BLOCK;
  }

  private _carveRooms(grid: TileType[][]): void {
    // 各ブロックにランダムで小部屋を開ける（確率 60%）
    for (let by = 0; by * BLOCK < this.rows - BLOCK; by++) {
      for (let bx = 0; bx * BLOCK < this.cols - BLOCK; bx++) {
        if (Math.random() > 0.6) continue;
        // ブロック左上 + 1 余白、道路分手前まで
        const x0 = bx * BLOCK + 2;
        const y0 = by * BLOCK + 2;
        const w  = BLOCK - ROAD - 3;
        const h  = BLOCK - ROAD - 3;
        if (w < 2 || h < 2) continue;
        for (let ry = y0; ry < y0 + h && ry < this.rows - 1; ry++)
          for (let rx = x0; rx < x0 + w && rx < this.cols - 1; rx++)
            grid[ry][rx] = TILE.FLOOR;
      }
    }
  }

  private _addExits(grid: TileType[][]): ExitMap {
    const exits: ExitMap = {};
    type DirKey = 'N' | 'S' | 'E' | 'W';
    const specs: { dir: DirKey; cx: number; cy: number; vertical: boolean; toEdge: number }[] = [
      { dir: 'N', cx: Math.floor(this.cols / 2), cy: 1,              vertical: true,  toEdge: 0             },
      { dir: 'S', cx: Math.floor(this.cols / 2), cy: this.rows - 2,  vertical: true,  toEdge: this.rows - 1 },
      { dir: 'W', cx: 1,              cy: Math.floor(this.rows / 2), vertical: false, toEdge: 0             },
      { dir: 'E', cx: this.cols - 2,  cy: Math.floor(this.rows / 2), vertical: false, toEdge: this.cols - 1 },
    ];

    for (const { dir, cx, cy, vertical, toEdge } of specs) {
      const anchor = this._findWalkable(grid, cx, cy, vertical);
      if (!anchor) continue;

      if (vertical) {
        const [y0, y1] = dir === 'N' ? [0, anchor.ty] : [anchor.ty, this.rows - 1];
        for (let y = y0; y <= y1; y++)
          if (grid[y][anchor.tx] === TILE.WALL) grid[y][anchor.tx] = TILE.CORRIDOR;
        exits[dir] = { tx: anchor.tx, ty: toEdge };
      } else {
        const [x0, x1] = dir === 'W' ? [0, anchor.tx] : [anchor.tx, this.cols - 1];
        for (let x = x0; x <= x1; x++)
          if (grid[anchor.ty][x] === TILE.WALL) grid[anchor.ty][x] = TILE.CORRIDOR;
        exits[dir] = { tx: toEdge, ty: anchor.ty };
      }
    }
    return exits;
  }

  private _findWalkable(
    grid: TileType[][], cx: number, cy: number, vertical: boolean
  ): ExitPos | null {
    for (let r = 0; r < Math.max(this.cols, this.rows); r++) {
      for (let d = -r; d <= r; d++) {
        const x = vertical ? cx + d : cx;
        const y = vertical ? cy     : cy + d;
        if (x <= 0 || y <= 0 || x >= this.cols - 1 || y >= this.rows - 1) continue;
        if (grid[y][x] !== TILE.WALL) return { tx: x, ty: y };
      }
    }
    return null;
  }
}
