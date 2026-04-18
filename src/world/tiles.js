// ─────────────────────────────────────────────
// tiles.js  タイル定義・テーマ定義
// ─────────────────────────────────────────────

export const TILE = Object.freeze({
  FLOOR:    0, // 床（歩行可）
  CORRIDOR: 1, // 通路（歩行可）
  WALL:     2, // 壁（歩行不可）
  STAIRS:   3, // 階段（歩行可・次フロアへ）
  PILLAR:   4, // 柱（通行不可）
  TRAP:     5, // 罠（通行可・踏むとダメージ）
  WATER:    6, // 水（通行可・スプラッシュ）
});

// テーマ別カラーパレット（描画はmap.jsが使用）
export const THEMES = {
  dungeon: {
    bg:       '#000000',
    label:    'ダンジョン',
    wall:     { base: '#0c0a18', lo: '#040309', hi: 'rgba(80,60,130,0.18)', sh: 'rgba(0,0,0,0.85)', moss: '#0a1008' },
    floor:    { base: '#e8d4a8', grid: 'rgba(180,140,70,0.3)', hi: 'rgba(255,255,255,0.06)' },
    corridor: { base: '#c0a070', grid: 'rgba(140,100,50,0.3)', hi: 'rgba(255,255,255,0.04)' },
  },
  forest: {
    bg:       '#0d1f06',
    label:    '森',
    wall:     { base: '#223a10', lo: '#0c1808', hi: 'rgba(80,200,50,0.45)', sh: 'rgba(0,0,0,0.55)', moss: '#1a3010' },
    floor:    { base: '#3d6e22', grid: 'rgba(50,100,20,0.25)', hi: 'rgba(150,255,80,0.07)' },
    corridor: { base: '#7a5a2a', grid: 'rgba(100,70,20,0.3)',  hi: 'rgba(200,160,80,0.06)' },
  },
  town: {
    bg:       '#1e1a14',
    label:    '街',
    wall:     { base: '#504030', lo: '#201808', hi: 'rgba(220,200,160,0.45)', sh: 'rgba(0,0,0,0.55)', moss: '#1e2010' },
    floor:    { base: '#d4c4a0', grid: 'rgba(160,140,90,0.4)', hi: 'rgba(255,255,255,0.05)' },
    corridor: { base: '#a09070', grid: 'rgba(120,100,60,0.35)',hi: 'rgba(255,255,255,0.04)' },
  },
  base: {
    bg:       '#000000',
    label:    '拠点',
    wall:     { base: '#1c0e06', lo: '#0a0604', hi: 'rgba(200,120,60,0.18)', sh: 'rgba(0,0,0,0.85)', moss: '#0a1008' },
    floor:    { base: '#c8a87a', grid: 'rgba(160,110,50,0.3)', hi: 'rgba(255,255,255,0.06)' },
    corridor: { base: '#b89860', grid: 'rgba(140,100,50,0.3)', hi: 'rgba(255,255,255,0.04)' },
  },
};

export const THEME_IDS = ['dungeon', 'forest', 'town', 'base'];

export const TILE_SIZE   = 96; // アクター lerp 用（論理単位）

// ── アイソメトリック描画定数 ──────────────────────
export const ISO_HALF_W = 32;  // タイルダイヤモンド幅の半分  (全幅 64px)
export const ISO_HALF_H = 16;  // タイルダイヤモンド高さの半分 (全高 32px)
export const ISO_WALL_H = 40;  // 壁ブロックの高さ (px)

export const TILE_DEF = {
  [TILE.FLOOR]: {
    label: '床',
    color: '#b8a888',
    walkable: true,
    weight: 6,
    allowedNeighbors: [TILE.FLOOR, TILE.CORRIDOR],
  },
  [TILE.CORRIDOR]: {
    label: '通路',
    color: '#8a7a60',
    walkable: true,
    weight: 3,
    allowedNeighbors: [TILE.FLOOR, TILE.CORRIDOR, TILE.WALL],
  },
  [TILE.WALL]: {
    label: '壁',
    color: '#1e1a2e',
    walkable: false,
    weight: 5,
    allowedNeighbors: [TILE.WALL, TILE.CORRIDOR],
  },
  [TILE.STAIRS]: {
    label: '階段',
    color: '#b8a888',
    walkable: true,
    weight: 1,
    allowedNeighbors: [TILE.FLOOR, TILE.CORRIDOR],
  },
  [TILE.PILLAR]: {
    label: '柱', color: '#6b6b6b', walkable: false, weight: 5,
    allowedNeighbors: [TILE.FLOOR, TILE.CORRIDOR],
  },
  [TILE.TRAP]: {
    label: '罠', color: '#b8a888', walkable: true, weight: 1,
    allowedNeighbors: [TILE.FLOOR],
  },
  [TILE.WATER]: {
    label: '水', color: '#3b6ea8', walkable: true, weight: 8,
    allowedNeighbors: [TILE.FLOOR, TILE.CORRIDOR],
  },
};

export const ALL_TILE_IDS = Object.values(TILE);
