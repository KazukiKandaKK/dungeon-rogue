// ─────────────────────────────────────────────
// riddles.ts  ボスごとの謎（結界を解くためのクイズ）
// ─────────────────────────────────────────────

export interface RiddleDef {
  /** 問題文（1〜2 行で収まる長さ） */
  question:     string;
  /** 選択肢（ちょうど 4 つ） */
  choices:      [string, string, string, string];
  /** 正解インデックス（0〜3） */
  correctIndex: number;
}

/**
 * キー → 謎の対応表。
 *   通常ダンジョンのキーは dungeon.id（'cave', 'goblin_nest', ...）。
 *   十二星座ボスのキーは bossVariant（'aries', 'taurus', ...）。
 */
export const RIDDLES: Record<string, RiddleDef> = {
  // ══ 通常ダンジョンのボス ══
  cave: {
    question: '巨大スライムの魔力コアを砕く最善の策は？',
    choices: ['ひたすら殴る', '水をかける', '魔力で揺さぶる', '無視して逃げる'],
    correctIndex: 2,
  },
  goblin_nest: {
    question: 'ゴブリンキングが最も恐れるものは？',
    choices: ['銀の刃', '王の血統', '炎の舌', '聖なる光'],
    correctIndex: 1,
  },
  cursed_forest: {
    question: '樹霊の呪いを解くのに必要なものは？',
    choices: ['火で焼き払う', '銀の矢を射る', '清めの塩', '祈りを捧げる'],
    correctIndex: 2,
  },
  abyss: {
    question: '深淵魔王の真名はいずれか？',
    choices: ['バアル', 'アスタロス', 'ベルフェゴール', 'モロク'],
    correctIndex: 0,
  },
  infinite_abyss: {
    question: '奈落の底に封じられしものは？',
    choices: ['希望', '光', '業', '無'],
    correctIndex: 3,
  },

  // ══ 十二星座ボス（bossVariant） ══
  aries: {
    question: '♈ 牡羊座の守護星は？',
    choices: ['水星', '金星', '火星', '木星'],
    correctIndex: 2,
  },
  taurus: {
    question: '♉ 牡牛座の元素は？',
    choices: ['火', '地', '風', '水'],
    correctIndex: 1,
  },
  gemini: {
    question: '♊ 双子座の守護星は？',
    choices: ['月', '金星', '水星', '火星'],
    correctIndex: 2,
  },
  cancer: {
    question: '♋ 蟹座の守護星は？',
    choices: ['太陽', '月', '水星', '火星'],
    correctIndex: 1,
  },
  leo: {
    question: '♌ 獅子座の守護星は？',
    choices: ['火星', '太陽', '月', '木星'],
    correctIndex: 1,
  },
  virgo: {
    question: '♍ 乙女座の守護星は？',
    choices: ['水星', '金星', '月', '火星'],
    correctIndex: 0,
  },
  libra: {
    question: '♎ 天秤座の元素は？',
    choices: ['火', '地', '風', '水'],
    correctIndex: 2,
  },
  scorpio: {
    question: '♏ 蠍座の守護星は？',
    choices: ['土星', '冥王星', '海王星', '木星'],
    correctIndex: 1,
  },
  sagittarius: {
    question: '♐ 射手座の守護星は？',
    choices: ['火星', '金星', '木星', '土星'],
    correctIndex: 2,
  },
  capricorn: {
    question: '♑ 山羊座の守護星は？',
    choices: ['土星', '木星', '水星', '冥王星'],
    correctIndex: 0,
  },
  aquarius: {
    question: '♒ 水瓶座の守護星は？',
    choices: ['海王星', '天王星', '土星', '水星'],
    correctIndex: 1,
  },
  pisces: {
    question: '♓ 魚座の守護星は？',
    choices: ['月', '海王星', '木星', '冥王星'],
    correctIndex: 1,
  },
};

/** キーからランダムな謎を取得。なければ null。 */
export function getRiddle(key: string | null | undefined): RiddleDef | null {
  if (!key) return null;
  return RIDDLES[key] ?? null;
}
