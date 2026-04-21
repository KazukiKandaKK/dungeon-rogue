// ─────────────────────────────────────────────
// daily.ts  デイリーシード（PRNG / スコア / リーダーボード）
//
// 1日1回、全プレイヤー共通の乱数シードでチャレンジするモード。
// Math.random を mulberry32 で上書きし、ベストスコアを localStorage に保存する。
// ─────────────────────────────────────────────

const SCORES_KEY = 'daily_scores_v1';

// ── PRNG（mulberry32）────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 日付 → シード ────────────────────────
export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function dailySeedFor(key: string): number {
  // 文字列 → 32bit hash（djb2）
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = (((h << 5) + h) + key.charCodeAt(i)) | 0;
  return h >>> 0;
}

// ── PRNG 上書き／復元 ────────────────────
let _origRandom: (() => number) | null = null;

export function installSeededRandom(seed: number): void {
  if (_origRandom) return; // 二重インストール防止
  _origRandom = Math.random;
  const rng = mulberry32(seed);
  Math.random = rng;
}

export function restoreRandom(): void {
  if (!_origRandom) return;
  Math.random = _origRandom;
  _origRandom = null;
}

export function isSeededActive(): boolean {
  return _origRandom !== null;
}

// ── スコア計算 ────────────────────────────
export interface DailyRunSummary {
  floor:    number;
  lv:       number;
  hp:       number;
  maxHp:    number;
  gold:     number;
  cleared:  boolean;
}

export function calcDailyScore(s: DailyRunSummary): number {
  const base    = s.floor * 100;
  const lvBonus = s.lv * 30;
  const hpBonus = Math.floor((s.hp / Math.max(1, s.maxHp)) * 50);
  const goldB   = Math.floor(s.gold / 10);
  const clear   = s.cleared ? 500 : 0;
  return base + lvBonus + hpBonus + goldB + clear;
}

// ── リーダーボード ────────────────────────
export interface DailyEntry {
  date:    string;     // 'YYYYMMDD'
  score:   number;
  floor:   number;
  cleared: boolean;
  at:      number;     // Date.now()
}

function _loadAll(): Record<string, DailyEntry> {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch { return {}; }
}

function _saveAll(map: Record<string, DailyEntry>): void {
  try { localStorage.setItem(SCORES_KEY, JSON.stringify(map)); } catch {}
}

export function recordDailyResult(date: string, summary: DailyRunSummary): { score: number; isBest: boolean } {
  const score = calcDailyScore(summary);
  const all = _loadAll();
  const prev = all[date];
  const isBest = !prev || score > prev.score;
  if (isBest) {
    all[date] = { date, score, floor: summary.floor, cleared: summary.cleared, at: Date.now() };
    _saveAll(all);
  }
  return { score, isBest };
}

export function getDailyBest(date: string): DailyEntry | null {
  return _loadAll()[date] ?? null;
}

export function getDailyHistory(limit = 7): DailyEntry[] {
  const all = _loadAll();
  return Object.values(all).sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
