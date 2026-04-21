// ─────────────────────────────────────────────
// world-events.ts  ワールドイベント（時間帯バフ）
//
// リアル時刻を 15 分スロットに切って 4 種類のイベントをローテーションする。
// どの端末で遊んでも同じ時刻に同じイベントが発動するため、「サーバーで
// ゴールドラッシュ中」みたいな MMO 感が出せる。
//
// 効果は主に獲得倍率。各系統（gold / exp / souls / drop）で 1 つだけ 1.5 倍
// のボーナスが付く。UI 側から getActiveEvent() を呼んで表示する。
// ─────────────────────────────────────────────

export type WorldEventId = 'gold_rush' | 'exp_festival' | 'soul_rain' | 'treasure_fest';

export interface WorldEventDef {
  id:       WorldEventId;
  name:     string;
  /** HUD に出す短い説明 */
  hint:     string;
  icon:     string;
  color:    string;
  /** 効果倍率。無関係な系統は 1 */
  mul: {
    gold:   number;
    exp:    number;
    souls:  number;
    drop:   number;
  };
}

export const WORLD_EVENTS: readonly WorldEventDef[] = [
  {
    id: 'gold_rush',
    name: 'ゴールドラッシュ',
    hint: '💰 G獲得 +50%',
    icon: '💰',
    color: '#fbbf24',
    mul: { gold: 1.5, exp: 1, souls: 1, drop: 1 },
  },
  {
    id: 'exp_festival',
    name: '経験値祭',
    hint: '✨ 経験値 +50%',
    icon: '✨',
    color: '#a5b4fc',
    mul: { gold: 1, exp: 1.5, souls: 1, drop: 1 },
  },
  {
    id: 'soul_rain',
    name: '魂の雨',
    hint: '👻 魂獲得 +100%',
    icon: '👻',
    color: '#c084fc',
    mul: { gold: 1, exp: 1, souls: 2.0, drop: 1 },
  },
  {
    id: 'treasure_fest',
    name: '宝箱祭り',
    hint: '📦 ドロップ率 +50%',
    icon: '📦',
    color: '#4ade80',
    mul: { gold: 1, exp: 1, souls: 1, drop: 1.5 },
  },
];

/** 1スロットの長さ（ミリ秒）= 15 分 */
export const SLOT_MS = 15 * 60 * 1000;

function _slotIndex(ts: number): number {
  return Math.floor(ts / SLOT_MS);
}

/** 現在のワールドイベントを返す（端末を越えて同じ時刻で同じ結果になる） */
export function getActiveEvent(now: number = Date.now()): WorldEventDef {
  const idx = _slotIndex(now) % WORLD_EVENTS.length;
  // idx が常に 0..3 になるよう正規化（負値の保険）
  const safe = ((idx % WORLD_EVENTS.length) + WORLD_EVENTS.length) % WORLD_EVENTS.length;
  return WORLD_EVENTS[safe];
}

/** 次のイベントまでの残り秒 */
export function getSecondsUntilNext(now: number = Date.now()): number {
  const slotStart = _slotIndex(now) * SLOT_MS;
  const nextStart = slotStart + SLOT_MS;
  return Math.max(0, Math.floor((nextStart - now) / 1000));
}

/** 次のイベント */
export function getNextEvent(now: number = Date.now()): WorldEventDef {
  const idx = (_slotIndex(now) + 1) % WORLD_EVENTS.length;
  const safe = ((idx % WORLD_EVENTS.length) + WORLD_EVENTS.length) % WORLD_EVENTS.length;
  return WORLD_EVENTS[safe];
}

// ── 倍率ヘルパー（gameplay 側から呼ぶ） ──

export function goldMul(now: number = Date.now()): number  { return getActiveEvent(now).mul.gold;  }
export function expMul(now: number = Date.now()): number   { return getActiveEvent(now).mul.exp;   }
export function soulsMul(now: number = Date.now()): number { return getActiveEvent(now).mul.souls; }
export function dropMul(now: number = Date.now()): number  { return getActiveEvent(now).mul.drop;  }

// ── 擬似オンライン人数（サーバー情報HUD用）──

/**
 * 5 分チャンクを種として、なだらかに変動する偽オンライン人数。
 * 800〜1600 あたりを漂う。
 */
export function fakeOnlineCount(now: number = Date.now()): number {
  const base = 1200;
  const amp  = 400;
  const chunk = Math.floor(now / (5 * 60 * 1000));
  // 単純な 2 周波の合成で「ほぼ連続的に変動する」っぽさを出す
  const a = Math.sin(chunk * 0.73) * 0.6;
  const b = Math.sin(chunk * 0.19 + 1.3) * 0.4;
  const delta = Math.floor((a + b) * amp);
  return Math.max(400, base + delta);
}

/** サーバー名（装飾） */
export const SERVER_NAME = 'ﾗｸﾞﾅﾛｯｸ鯖 #1';
