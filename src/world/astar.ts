// ─────────────────────────────────────────────
// astar.ts  A* 経路探索
//   純 TS 実装（バイナリ最小ヒープ）をデフォルト使用。
//   Emscripten でビルドした astar.wasm があれば自動で切り替わる。
// ─────────────────────────────────────────────

// ── バイナリ最小ヒープ ───────────────────────────

interface HeapNode {
  x: number;
  y: number;
  f: number;
}

class MinHeap {
  private _d: HeapNode[] = [];
  get size(): number { return this._d.length; }

  push(item: HeapNode): void {
    this._d.push(item);
    this._up(this._d.length - 1);
  }

  pop(): HeapNode {
    const top  = this._d[0];
    const last = this._d.pop()!;
    if (this._d.length > 0) { this._d[0] = last; this._down(0); }
    return top;
  }

  private _up(i: number): void {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._d[p].f <= this._d[i].f) break;
      [this._d[p], this._d[i]] = [this._d[i], this._d[p]];
      i = p;
    }
  }

  private _down(i: number): void {
    const n = this._d.length;
    while (true) {
      let m = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this._d[l].f < this._d[m].f) m = l;
      if (r < n && this._d[r].f < this._d[m].f) m = r;
      if (m === i) break;
      [this._d[m], this._d[i]] = [this._d[i], this._d[m]];
      i = m;
    }
  }
}

// ── 方向テーブル（4 方向 + 斜め 4 方向）────────────
const DX:   number[] = [ 0,  0,  1, -1,  1,  1, -1, -1];
const DY:   number[] = [ 1, -1,  0,  0,  1, -1,  1, -1];
const COST: number[] = [ 1,  1,  1,  1, 1.414, 1.414, 1.414, 1.414];

// ── 純 TS A* ────────────────────────────────────
/**
 * A* 経路探索（純 TS・バイナリヒープ）
 */
function findPathTS(
  mapW:       number,
  mapH:       number,
  isWalkable: (x: number, y: number) => boolean,
  sx: number,
  sy: number,
  gx: number,
  gy: number,
): { x: number; y: number }[] {
  if (!isWalkable(sx, sy)) return [];
  const N      = mapW * mapH;
  const gScore = new Float32Array(N).fill(Infinity);
  const parent = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const idx    = (x: number, y: number) => y * mapW + x;
  const h      = (x: number, y: number) => Math.abs(x - gx) + Math.abs(y - gy);

  const startI = idx(sx, sy);
  gScore[startI] = 0;
  const heap = new MinHeap();
  heap.push({ x: sx, y: sy, f: h(sx, sy) });

  while (heap.size > 0) {
    const cur = heap.pop();
    const ci  = idx(cur.x, cur.y);
    if (closed[ci]) continue;
    closed[ci] = 1;

    if (cur.x === gx && cur.y === gy) {
      // パス復元
      const path: { x: number; y: number }[] = [];
      let c = ci;
      while (c !== -1) {
        path.push({ x: c % mapW, y: Math.floor(c / mapW) });
        c = parent[c];
      }
      return path.reverse();
    }

    for (let d = 0; d < 8; d++) {
      const nx = cur.x + DX[d];
      const ny = cur.y + DY[d];
      if (nx < 0 || ny < 0 || nx >= mapW || ny >= mapH) continue;
      const ni = idx(nx, ny);
      if (!isWalkable(nx, ny) || closed[ni]) continue;

      // 斜め移動時、隣接する縦横どちらかが壁なら迂回させない
      if (d >= 4) {
        if (!isWalkable(cur.x + DX[d], cur.y) || !isWalkable(cur.x, cur.y + DY[d])) continue;
      }

      const ng = gScore[ci] + COST[d];
      if (ng < gScore[ni]) {
        gScore[ni] = ng;
        parent[ni] = ci;
        heap.push({ x: nx, y: ny, f: ng + h(nx, ny) });
      }
    }
  }
  return []; // 経路なし
}

// ── WASM ブリッジ ────────────────────────────────

interface WasmExports {
  find_path(mapW: number, mapH: number, walkablePtr: number, sx: number, sy: number, gx: number, gy: number, pathOutPtr: number): number;
}

let _wasmInst:   WasmExports | null = null;
let _wasmMemory: WebAssembly.Memory | null = null;

/**
 * astar.wasm のロードを試みる（失敗しても純 TS にフォールバック）
 */
export async function initAstar(): Promise<void> {
  try {
    const resp = await fetch('src/astar.wasm');
    if (!resp.ok) throw new Error('wasm not found');
    const buf  = await resp.arrayBuffer();
    const mem  = new WebAssembly.Memory({ initial: 4 }); // 256KB
    const env  = { memory: mem };
    const { instance } = await WebAssembly.instantiate(buf, { env });
    _wasmInst   = instance.exports as unknown as WasmExports;
    _wasmMemory = mem;
    console.log('[astar] WASM loaded — C++ A* enabled');
  } catch {
    console.log('[astar] WASM not available — using TS A*');
  }
}

/**
 * A* 経路探索（WASM 優先・TS フォールバック）
 */
export function findPath(
  mapW:       number,
  mapH:       number,
  isWalkable: (x: number, y: number) => boolean,
  sx: number,
  sy: number,
  gx: number,
  gy: number,
): { x: number; y: number }[] {
  if (_wasmInst && _wasmMemory) {
    return _findPathWasm(_wasmInst, _wasmMemory, mapW, mapH, isWalkable, sx, sy, gx, gy);
  }
  return findPathTS(mapW, mapH, isWalkable, sx, sy, gx, gy);
}

function _findPathWasm(
  wasmInst:   WasmExports,
  wasmMemory: WebAssembly.Memory,
  mapW:       number,
  mapH:       number,
  isWalkable: (x: number, y: number) => boolean,
  sx: number,
  sy: number,
  gx: number,
  gy: number,
): { x: number; y: number }[] {
  const N         = mapW * mapH;
  const pathMax   = N * 2; // 最大パス長 (x,y ペア)
  // メモリレイアウト: [walkable: N int32][pathOut: pathMax int32]
  const needed    = (N + pathMax) * 4;
  const pages     = Math.ceil(needed / 65536);
  if (wasmMemory.buffer.byteLength < needed) {
    wasmMemory.grow(pages);
  }
  const mem = new Int32Array(wasmMemory.buffer);

  // walkable グリッドを書き込む
  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      mem[y * mapW + x] = isWalkable(x, y) ? 1 : 0;
    }
  }
  const pathOffset = N; // path_out の開始インデックス

  const len = wasmInst.find_path(
    mapW, mapH, 0, sx, sy, gx, gy, pathOffset * 4
  );

  const result: { x: number; y: number }[] = [];
  for (let i = 0; i < len; i++) {
    result.push({
      x: mem[pathOffset + i * 2],
      y: mem[pathOffset + i * 2 + 1],
    });
  }
  return result;
}
