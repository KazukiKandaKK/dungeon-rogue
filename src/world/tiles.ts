// ─────────────────────────────────────────────
// tiles.ts  タイル定義・テーマ定義
// ─────────────────────────────────────────────

export const TILE = Object.freeze({
  FLOOR:    0, // 床（歩行可）
  CORRIDOR: 1, // 通路（歩行可）
  WALL:     2, // 壁（歩行不可）
  STAIRS:   3, // 階段（歩行可・次フロアへ）
  PILLAR:   4, // 柱（通行不可）
  TRAP:     5, // 罠（通行可・踏むとダメージ）
  WATER:    6, // 水（通行可・雷と接触すると連鎖）
  ICE:      7, // 氷（通行可・踏むと滑る）
  MAGMA:    8, // マグマ（通行可・踏むとダメージ＋延焼）
} as const);

export type TileType = typeof TILE[keyof typeof TILE];

// ── テーマ型 ──────────────────────────────────

export interface WallPalette {
  base: string;
  lo:   string;
  hi:   string;
  sh:   string;
  moss: string;
}

export interface FloorPalette {
  base: string;
  grid: string;
  hi:   string;
}

export interface Theme {
  bg:       string;
  label:    string;
  wall:     WallPalette;
  floor:    FloorPalette;
  corridor: FloorPalette;
}

export type ThemeId = 'dungeon' | 'forest' | 'base' | 'cosmic';

// テーマ別カラーパレット（描画は map.ts が使用）
// 写実寄りの色調に調整：彩度控えめ、石・土・草の自然なトーン
export const THEMES: Record<ThemeId, Theme> = {
  dungeon: {
    bg:       '#030406',
    label:    'ダンジョン',
    wall:     { base: '#221d18', lo: '#0c0a07', hi: 'rgba(180,165,140,0.10)', sh: 'rgba(0,0,0,0.82)', moss: '#2e3820' },
    floor:    { base: '#584c3a', grid: 'rgba(40,30,18,0.42)', hi: 'rgba(255,240,200,0.04)' },
    corridor: { base: '#463c2c', grid: 'rgba(30,22,12,0.45)', hi: 'rgba(255,240,200,0.03)' },
  },
  forest: {
    bg:       '#0a1606',
    label:    '森',
    wall:     { base: '#1e2e12', lo: '#0a1208', hi: 'rgba(120,180,80,0.18)', sh: 'rgba(0,0,0,0.55)', moss: '#2a4018' },
    floor:    { base: '#3e5a24', grid: 'rgba(40,80,16,0.28)', hi: 'rgba(180,230,120,0.06)' },
    corridor: { base: '#6a4e24', grid: 'rgba(80,56,16,0.38)', hi: 'rgba(200,160,80,0.05)' },
  },
  base: {
    bg:       '#0a0805',
    label:    '拠点',
    wall:     { base: '#2a1c10', lo: '#100804', hi: 'rgba(200,140,80,0.15)', sh: 'rgba(0,0,0,0.80)', moss: '#202818' },
    floor:    { base: '#a8886a', grid: 'rgba(120,80,36,0.30)', hi: 'rgba(255,240,200,0.05)' },
    corridor: { base: '#8e7050', grid: 'rgba(100,70,30,0.32)', hi: 'rgba(255,240,200,0.04)' },
  },
  cosmic: {
    bg:       '#02000a',
    label:    '宇宙',
    wall:     { base: '#1a0a3a', lo: '#050018', hi: 'rgba(180,120,255,0.22)', sh: 'rgba(0,0,0,0.88)', moss: '#2a1050' },
    floor:    { base: '#050018', grid: 'rgba(80,40,160,0.30)', hi: 'rgba(200,180,255,0.06)' },
    corridor: { base: '#030010', grid: 'rgba(60,30,120,0.30)', hi: 'rgba(200,180,255,0.05)' },
  },
};

export const THEME_IDS: ThemeId[] = ['dungeon', 'forest', 'base', 'cosmic'];

export const TILE_SIZE   = 96; // アクター lerp 用（論理単位）

// ── アイソメトリック描画定数 ──────────────────────
export const ISO_HALF_W = 32;  // タイルダイヤモンド幅の半分  (全幅 64px)
export const ISO_HALF_H = 16;  // タイルダイヤモンド高さの半分 (全高 32px)
export const ISO_WALL_H = 40;  // 壁ブロックの高さ (px)

// ── タイル定義型 ────────────────────────────────

export interface TileDef {
  label:            string;
  color:            string;
  walkable:         boolean;
  weight:           number;
  allowedNeighbors: TileType[];
}

export const TILE_DEF: Record<TileType, TileDef> = {
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
  [TILE.ICE]: {
    label: '氷', color: '#a5e8ff', walkable: true, weight: 1,
    allowedNeighbors: [TILE.FLOOR, TILE.CORRIDOR],
  },
  [TILE.MAGMA]: {
    label: 'マグマ', color: '#ef4444', walkable: true, weight: 1,
    allowedNeighbors: [TILE.FLOOR, TILE.CORRIDOR],
  },
};

export const ALL_TILE_IDS: TileType[] = Object.values(TILE) as TileType[];
