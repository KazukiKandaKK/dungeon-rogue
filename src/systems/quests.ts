// ─────────────────────────────────────────────
// quests.ts  デイリークエスト（掲示板）
//
// 1日1回ランダムに 3件の依頼を生成し、進捗を localStorage に保存する。
// 種類: 討伐（kill）/ 収集（collect）/ 到達（reach）/ 連続撃破（streak）/ 累計ゴールド（gold）
// 報酬: ゴールド + 魂 +（任意の）アイテム
// ─────────────────────────────────────────────

// v2 で streak / gold カテゴリを追加。旧 v1 データは読み込み時にマイグレーションする。
const QUEST_KEY     = 'quests_v2';
const QUEST_KEY_OLD = 'quests_v1';
const SEED_KEY      = 'quests_seed_v1'; // 何日のクエストか（旧互換のまま）

// ── 種別と難度 ────────────────────────────
export type QuestKind = 'kill' | 'collect' | 'reach' | 'streak' | 'gold';

export interface QuestDef {
  id:         string;
  kind:       QuestKind;
  /** 表示名 */
  title:      string;
  /** カウントの内訳説明 */
  desc:       string;
  /** クリア条件の総数 */
  total:      number;
  /** 進捗（保存される） */
  progress:   number;
  /** 報酬済みフラグ */
  claimed:    boolean;
  /** 報酬 */
  reward: {
    gold:     number;
    souls:    number;
  };
}

interface QuestSave {
  date:    string;       // YYYYMMDD
  quests:  QuestDef[];
}

// ── 候補テンプレ ──────────────────────────
// id から種別を引くために `kind` も埋めておく（将来の追加で分岐ミスを防ぐ）
interface QuestTemplate {
  id:    string;
  kind:  QuestKind;
  title: string;
  desc:  string;
  total: number;
  reward: { gold: number; souls: number };
}

const KILL_TEMPLATES: QuestTemplate[] = [
  { id: 'kill_any_5',  kind: 'kill', title: 'モンスター討伐',  desc: '敵を {n} 体倒す', total: 5,  reward: { gold: 60,  souls: 1 } },
  { id: 'kill_any_15', kind: 'kill', title: '討伐の任務',       desc: '敵を {n} 体倒す', total: 15, reward: { gold: 180, souls: 2 } },
  { id: 'kill_any_30', kind: 'kill', title: '熟練の討伐',       desc: '敵を {n} 体倒す', total: 30, reward: { gold: 360, souls: 3 } },
];

const COLLECT_TEMPLATES: QuestTemplate[] = [
  { id: 'collect_any_4',  kind: 'collect', title: '物資調達',    desc: '床のアイテムを {n} 個拾う', total: 4,  reward: { gold: 80,  souls: 1 } },
  { id: 'collect_any_10', kind: 'collect', title: '大規模な調達', desc: '床のアイテムを {n} 個拾う', total: 10, reward: { gold: 200, souls: 2 } },
];

const REACH_TEMPLATES: QuestTemplate[] = [
  { id: 'reach_5',  kind: 'reach', title: '5階到達',  desc: 'いずれかのダンジョンで {n}F まで進む',  total: 5,  reward: { gold: 100, souls: 1 } },
  { id: 'reach_10', kind: 'reach', title: '10階到達', desc: 'いずれかのダンジョンで {n}F まで進む',  total: 10, reward: { gold: 250, souls: 2 } },
  { id: 'reach_20', kind: 'reach', title: '20階到達', desc: 'いずれかのダンジョンで {n}F まで進む',  total: 20, reward: { gold: 500, souls: 4 } },
];

// 連続撃破（1フロア内で被ダメージに関わらず N 体倒す）
const STREAK_TEMPLATES: QuestTemplate[] = [
  { id: 'streak_5',  kind: 'streak', title: '連撃の証',   desc: '1フロアで連続 {n} 体倒す', total: 5,  reward: { gold: 120, souls: 1 } },
  { id: 'streak_10', kind: 'streak', title: '連撃の覇者', desc: '1フロアで連続 {n} 体倒す', total: 10, reward: { gold: 280, souls: 2 } },
];

// 累計ゴールド（旧 collect_gold_500 も gold に引っ越す）
const GOLD_TEMPLATES: QuestTemplate[] = [
  { id: 'collect_gold_500', kind: 'gold', title: '金策',     desc: '累計で {n}G を稼ぐ',  total: 500,  reward: { gold: 0, souls: 3 } },
  { id: 'gold_300',         kind: 'gold', title: '小口の金策', desc: '累計で {n}G を稼ぐ',  total: 300,  reward: { gold: 0, souls: 2 } },
  { id: 'gold_1000',        kind: 'gold', title: '大口の金策', desc: '累計で {n}G を稼ぐ',  total: 1000, reward: { gold: 0, souls: 4 } },
];

// 全テンプレ集合（3件重複無し抽選に使う）
const ALL_TEMPLATES: QuestTemplate[] = [
  ...KILL_TEMPLATES,
  ...COLLECT_TEMPLATES,
  ...REACH_TEMPLATES,
  ...STREAK_TEMPLATES,
  ...GOLD_TEMPLATES,
];

// id → kind の逆引き（旧データ復元で使う）
const ID_TO_KIND: Record<string, QuestKind> = Object.fromEntries(
  ALL_TEMPLATES.map(t => [t.id, t.kind]),
);

// ── 簡易シード PRNG（mulberry32）────────
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
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function _todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// ── 保存 / 復元 ───────────────────────────
function _load(): QuestSave | null {
  try {
    // まず v2 を試す
    const raw = localStorage.getItem(QUEST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.quests)) {
        return parsed as QuestSave;
      }
    }
    // v1 からのマイグレーション（kind の再割当てのみ）
    const oldRaw = localStorage.getItem(QUEST_KEY_OLD);
    if (oldRaw) {
      const parsed = JSON.parse(oldRaw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.quests)) {
        const migrated: QuestSave = {
          date: String(parsed.date ?? ''),
          quests: parsed.quests.map((q: QuestDef) => ({
            ...q,
            kind: ID_TO_KIND[q.id] ?? q.kind ?? 'kill',
          })),
        };
        _save(migrated);
        return migrated;
      }
    }
    return null;
  } catch { return null; }
}
function _save(s: QuestSave): void {
  try { localStorage.setItem(QUEST_KEY, JSON.stringify(s)); } catch {}
}

// ── 生成 ──────────────────────────────────
function _generate(date: string): QuestDef[] {
  const rng = mulberry32(djb2('quests:' + date));
  // 全テンプレから 3 件を重複無しで抽選（Fisher–Yates）
  const pool = ALL_TEMPLATES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picks = pool.slice(0, 3);

  return picks.map(t => ({
    id:        t.id,
    kind:      t.kind,
    title:     t.title,
    desc:      t.desc.replace('{n}', String(t.total)),
    total:     t.total,
    progress:  0,
    claimed:   false,
    reward:    { ...t.reward },
  }));
}

/** 今日のクエスト一覧を返す。日が変わっていれば再生成 */
export function getDailyQuests(): QuestDef[] {
  const today = _todayKey();
  const s = _load();
  if (s && s.date === today) return s.quests;
  // 新規 / 日付更新
  const fresh: QuestSave = { date: today, quests: _generate(today) };
  _save(fresh);
  try { localStorage.setItem(SEED_KEY, today); } catch {}
  return fresh.quests;
}

function _persist(quests: QuestDef[]): void {
  const today = _todayKey();
  _save({ date: today, quests });
}

// ── 進捗イベント ──────────────────────────

export function reportKill(): void {
  const qs = getDailyQuests();
  let dirty = false;
  for (const q of qs) {
    if (q.kind === 'kill' && !q.claimed && q.progress < q.total) {
      q.progress = Math.min(q.total, q.progress + 1);
      dirty = true;
    }
  }
  if (dirty) _persist(qs);
}

export function reportPickup(): void {
  const qs = getDailyQuests();
  let dirty = false;
  for (const q of qs) {
    // collect カテゴリのみ進行（旧 collect_gold_500 は gold カテゴリに移動済み）
    if (q.kind === 'collect' && !q.claimed && q.progress < q.total) {
      q.progress = Math.min(q.total, q.progress + 1);
      dirty = true;
    }
  }
  if (dirty) _persist(qs);
}

export function reportGold(amount: number): void {
  if (amount <= 0) return;
  const qs = getDailyQuests();
  let dirty = false;
  for (const q of qs) {
    if (q.kind === 'gold' && !q.claimed && q.progress < q.total) {
      q.progress = Math.min(q.total, q.progress + amount);
      dirty = true;
    }
  }
  if (dirty) _persist(qs);
}

export function reportFloorReached(floor: number): void {
  if (floor <= 0) return;
  const qs = getDailyQuests();
  let dirty = false;
  for (const q of qs) {
    if (q.kind === 'reach' && !q.claimed && q.progress < floor) {
      q.progress = Math.min(q.total, floor);
      dirty = true;
    }
  }
  if (dirty) _persist(qs);
}

/**
 * 連続撃破の進捗を更新する。
 * 呼び出し側で「1フロア内の連続撃破カウンタ」を管理し、その値をそのまま渡す。
 * フロア開始時は 0、キル時にインクリメントしてから呼ぶ想定。
 * 連続撃破は「最大記録」で更新するため、途中でカウンタが 0 にリセットされても
 * 進捗が減ることはない（被ダメージでリセットする仕様は今回入れない）。
 */
export function reportStreak(current: number): void {
  if (current <= 0) return;
  const qs = getDailyQuests();
  let dirty = false;
  for (const q of qs) {
    if (q.kind === 'streak' && !q.claimed && q.progress < current) {
      q.progress = Math.min(q.total, current);
      dirty = true;
    }
  }
  if (dirty) _persist(qs);
}

/** 報酬を受け取る。受け取り済みは null を返す */
export function claimQuest(id: string): { gold: number; souls: number } | null {
  const qs = getDailyQuests();
  const q = qs.find(x => x.id === id);
  if (!q) return null;
  if (q.claimed) return null;
  if (q.progress < q.total) return null;
  q.claimed = true;
  _persist(qs);
  return q.reward;
}

export function isComplete(q: QuestDef): boolean {
  return q.progress >= q.total;
}

export function activeCount(): number {
  return getDailyQuests().filter(q => !q.claimed).length;
}

export function completedClaimableCount(): number {
  return getDailyQuests().filter(q => isComplete(q) && !q.claimed).length;
}
