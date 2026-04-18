// ─────────────────────────────────────────────
// wfc.js  Wave Function Collapse（簡易実装）
// ─────────────────────────────────────────────

import { TILE_DEF, ALL_TILE_IDS } from './tiles.js';

const DIRS = [
  [ 0, -1], // 上
  [ 0,  1], // 下
  [-1,  0], // 左
  [ 1,  0], // 右
];

/**
 * 1 セルの状態
 *   options  : まだ選択可能なタイル ID の Set
 *   collapsed: 確定済みかどうか
 */
class Cell {
  constructor() {
    this.options = new Set(ALL_TILE_IDS);
    this.collapsed = false;
  }
  get entropy() {
    return this.options.size;
  }
}

export class WFCGenerator {
  constructor(width, height, maxAttempts = 50) {
    this.width  = width;
    this.height = height;
    this.maxAttempts = maxAttempts;
  }

  /**
   * マップを生成して 2D タイル ID 配列を返す
   * 矛盾が続いたらフォールバック（全 GRASS）を返す
   */
  generate() {
    for (let i = 0; i < this.maxAttempts; i++) {
      const result = this._attempt();
      if (result) return result;
    }
    console.warn('WFC: フォールバック（全 GRASS）');
    return Array.from({ length: this.height }, () =>
      Array(this.width).fill(0)
    );
  }

  // ── 内部実装 ────────────────────────────────

  _attempt() {
    const grid = this._initGrid();
    const total = this.width * this.height;
    let collapsed = 0;

    while (collapsed < total) {
      const cell = this._pickMinEntropy(grid);
      if (!cell) break;

      const { x, y, c } = cell;

      // 候補からランダムに 1 タイルを選んで確定
      const chosen = this._weightedRandom([...c.options]);
      c.options   = new Set([chosen]);
      c.collapsed = true;
      collapsed++;

      // 確定を周囲に伝播
      if (!this._propagate(grid, x, y)) return null; // 矛盾 → リトライ
    }

    return grid.map(row => row.map(c => [...c.options][0]));
  }

  _initGrid() {
    return Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => new Cell())
    );
  }

  /** エントロピー最小のセルをランダムに 1 つ選ぶ */
  _pickMinEntropy(grid) {
    let min  = Infinity;
    let best = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const c = grid[y][x];
        if (c.collapsed) continue;
        if (c.entropy === 0) return null; // 矛盾
        if (c.entropy < min) { min = c.entropy; best = []; }
        if (c.entropy === min) best.push({ x, y, c });
      }
    }
    if (best.length === 0) return null;
    return best[Math.floor(Math.random() * best.length)];
  }

  /** weight に応じた加重ランダム選択 */
  _weightedRandom(ids) {
    const weights = ids.map(id => TILE_DEF[id].weight);
    const total   = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < ids.length; i++) {
      r -= weights[i];
      if (r <= 0) return ids[i];
    }
    return ids[ids.length - 1];
  }

  /**
   * (startX, startY) を起点として隣接セルへ制約を伝播する
   * 矛盾（候補がゼロになったセル）が生じたら false を返す
   */
  _propagate(grid, startX, startY) {
    const stack = [[startX, startY]];

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const current = grid[y][x];

      // current の全候補が許容する隣接タイルの合集合
      const allowed = new Set();
      for (const tid of current.options) {
        for (const n of TILE_DEF[tid].allowedNeighbors) {
          allowed.add(n);
        }
      }

      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) continue;

        const neighbor = grid[ny][nx];
        if (neighbor.collapsed) continue;

        // 許容されない候補を除去
        let changed = false;
        for (const opt of [...neighbor.options]) {
          if (!allowed.has(opt)) {
            neighbor.options.delete(opt);
            changed = true;
          }
        }

        if (neighbor.options.size === 0) return false; // 矛盾
        if (changed) stack.push([nx, ny]);             // さらに伝播
      }
    }
    return true;
  }
}
