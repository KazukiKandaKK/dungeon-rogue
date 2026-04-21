// ─────────────────────────────────────────────
// ranking.ts  冒険者ギルド・ランキング（擬似グローバル）
//
// 日付シードで生成した偽プレイヤー 49 名のスコアに、自分のスコアを
// 挿入してランキング化する。どの端末で遊んでも今日の「上位陣」は
// 同じになる（MMO っぽさ）。
// ─────────────────────────────────────────────

import { APPEARANCE_IDS, APPEARANCES, TINTS } from '../data/appearances.js';
import type { AppearanceDef } from '../data/appearances.js';
import { TITLES } from './titles.js';
import type { TitleDef } from './titles.js';
import { todayKey, dailySeedFor, getDailyBest } from './daily.js';

const NAMES = [
  'フロスト','シュー','ピコ','モス','ベル','サフィ','ペルル','ジン','ノヴァ','ルナ',
  'ソル','メル','リコ','エム','ユキ','カイ','レン','タロ','ミィ','クロ',
  'ユウ','コウ','ハル','ナギ','アサ','ヒビキ','スバル','ティナ','エルダ','ヴェル',
  'ザック','ミモザ','カトレア','ヨル','ガイ','レオ','ダン','シリウス','クリス','ノア',
  'ユズ','ケイ','アルト','フィン','セラ','ミア','ロク','テオ','アヤ','シロ',
];

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

export interface RankEntry {
  rank:       number;
  name:       string;
  lv:         number;
  species:    AppearanceDef;
  tint:       string;
  title:      TitleDef | null;
  floor:      number;
  score:      number;
  cleared:    boolean;
  /** 自分エントリなら true */
  me:         boolean;
}

function _pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * 指定日（YYYYMMDD）の擬似ランキング。
 * 上位ほどスコアが高くなるように並べ、自分のベストスコアがあれば挿入する。
 */
export function getDailyRanking(date: string = todayKey()): RankEntry[] {
  const rng = mulberry32(dailySeedFor('ranking:' + date));
  // 上位プレイヤーほど高スコア。ジップ則風に 10000 から割引。
  const count = 49;
  const baseTop = 8000 + Math.floor(rng() * 2000); // 日によって上位層が 8000-10000
  const fakes: RankEntry[] = [];
  for (let i = 0; i < count; i++) {
    const rankIdx = i + 1;
    // スコア：1位から緩やかに減衰 + ノイズ
    const decay = Math.pow(0.92, i);                 // 指数的減衰
    const noise = (rng() - 0.5) * baseTop * 0.08;
    const score = Math.max(80, Math.floor(baseTop * decay + noise));
    const floor = Math.max(1, Math.floor(score / 240 + rng() * 3));
    const lv    = Math.max(2, Math.min(50, Math.floor(score / 180 + rng() * 4)));
    const speciesId = _pick(rng, APPEARANCE_IDS);
    const species   = APPEARANCES[speciesId];
    const tint      = _pick(rng, TINTS).color;
    const name      = _pick(rng, NAMES);
    const cleared   = rng() < Math.min(0.6, 0.1 + decay);
    // 偽 NPC にも称号を軽く割り当て
    const hasTitle = rng() < 0.70;
    let title: TitleDef | null = null;
    if (hasTitle) {
      // 上位ほどレアが出やすい
      const rareBoost = Math.min(5, 1 + Math.floor((count - i) / 10));
      const pool = TITLES.filter(t => t.rarity <= rareBoost + 1);
      title = pool[Math.floor(rng() * pool.length)] ?? null;
    }
    fakes.push({ rank: rankIdx, name, lv, species, tint, title, floor, score, cleared, me: false });
  }

  // 自分のベストスコアを挿入
  const myBest = getDailyBest(date);
  if (myBest) {
    const meEntry: RankEntry = {
      rank: 0,
      name: 'あなた',
      lv: 0,                                         // 表示時にプレイヤー Lv を差し込む
      species: APPEARANCES[APPEARANCE_IDS[0]],
      tint: '#fde68a',
      title: null,
      floor:   myBest.floor,
      score:   myBest.score,
      cleared: myBest.cleared,
      me:      true,
    };
    fakes.push(meEntry);
  }

  // スコア降順でソートしてランク番号を付け直す
  fakes.sort((a, b) => b.score - a.score);
  fakes.forEach((e, i) => e.rank = i + 1);
  return fakes;
}

/** 自分のエントリだけ返す（見つからなければ null） */
export function findMyRank(list: RankEntry[]): RankEntry | null {
  return list.find(e => e.me) ?? null;
}
