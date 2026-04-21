// ─────────────────────────────────────────────
// quests.ts  デイリークエスト（掲示板）
//
// 1日1回ランダムに 3件の依頼を生成し、進捗を localStorage に保存する。
// 種類: 討伐（kill）/ 収集（collect）/ 到達（reach）
// 報酬: ゴールド + 魂 +（任意の）アイテム
// ─────────────────────────────────────────────

const QUEST_KEY = 'quests_v1';
const SEED_KEY  = 'quests_seed_v1'; // 何日のクエストか

// ── 種別と難度 ────────────────────────────
export type QuestKind = 'kill' | 'collect' | 'reach';

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
const KILL_TEMPLATES = [
  { id: 'kill_any_5',  title: 'モンスター討伐',  desc: '敵を {n} 体倒す', total: 5,  reward: { gold: 60,  souls: 1 } },
  { id: 'kill_any_15', title: '討伐の任務',       desc: '敵を {n} 体倒す', total: 15, reward: { gold: 180, souls: 2 } },
  { id: 'kill_any_30', title: '熟練の討伐',       desc: '敵を {n} 体倒す', total: 30, reward: { gold: 360, souls: 3 } },
];

const COLLECT_TEMPLATES = [
  { id: 'collect_any_4',  title: '物資調達',       desc: '床のアイテムを {n} 個拾う', total: 4,  reward: { gold: 80,  souls: 1 } },
  { id: 'collect_any_10', title: '大規模な調達',    desc: '床のアイテムを {n} 個拾う', total: 10, reward: { gold: 200, souls: 2 } },
  { id: 'collect_gold_500',title: '金策',           desc: '累計で {n}G を稼ぐ',       total: 500, reward: { gold: 0, souls: 3 } },
];

const REACH_TEMPLATES = [
  { id: 'reach_5',  title: '5階到達',  desc: 'いずれかのダンジョンで {n}F まで進む',  total: 5,  reward: { gold: 100, souls: 1 } },
  { id: 'reach_10', title: '10階到達', desc: 'いずれかのダンジョンで {n}F まで進む',  total: 10, reward: { gold: 250, souls: 2 } },
  { id: 'reach_20', title: '20階到達', desc: 'いずれかのダンジョンで {n}F まで進む',  total: 20, reward: { gold: 500, souls: 4 } },
];

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
    const raw = localStorage.getItem(QUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.quests)) return null;
    return parsed as QuestSave;
  } catch { return null; }
}
function _save(s: QuestSave): void {
  try { localStorage.setItem(QUEST_KEY, JSON.stringify(s)); } catch {}
}

// ── 生成 ──────────────────────────────────
function _generate(date: string): QuestDef[] {
  const rng = mulberry32(djb2('quests:' + date));
  const pickN = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

  const k = pickN(KILL_TEMPLATES);
  const c = pickN(COLLECT_TEMPLATES);
  const r = pickN(REACH_TEMPLATES);

  return [k, c, r].map(t => ({
    id:        t.id,
    kind:      (t.id.startsWith('kill') ? 'kill' : t.id.startsWith('collect') || t.id === 'collect_gold_500' ? 'collect' : 'reach') as QuestKind,
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
    if (q.kind === 'collect' && q.id !== 'collect_gold_500' && !q.claimed && q.progress < q.total) {
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
    if (q.kind === 'collect' && q.id === 'collect_gold_500' && !q.claimed && q.progress < q.total) {
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
