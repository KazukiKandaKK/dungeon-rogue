// ─────────────────────────────────────────────
// chat-ticker.ts  チャットログ風ティッカー
//
// シングルプレイなのに MMO の街中にいるような賑わいを出すための
// 偽グローバルチャット。ランダム生成された冒険者NPCの発言を流す。
// ─────────────────────────────────────────────

import { APPEARANCE_IDS, APPEARANCES, TINTS } from '../data/appearances.js';

const TOGGLE_KEY = 'chatTicker_v1_off';

// ── 名前・テンプレ ────────────────────────
const NAMES = [
  'フロスト','シュー','ピコ','モス','ベル','サフィ','ペルル','ジン','ノヴァ','ルナ',
  'ソル','メル','リコ','エム','ユキ','カイ','レン','タロ','ミィ','クロ',
  'ユウ','コウ','ハル','ナギ','アサ','ヒビキ','スバル','ティナ','エルダ','ヴェル',
  'ザク','プリン','ボン','ガル','ライ','シノ','ホタル','カゲ','フウ','チロ',
] as const;

const ITEMS = [
  'ミスリル鎧','竜の剣','疾風の靴','聖騎士の兜','ハンマー','クロスボウ',
  'エリクサー','メテオの巻物','長弓','力の指輪','幸運のお守り','聖域の巻物',
  '大回復薬','吹雪の巻物','巨人帯','魔法鎧',
] as const;

const TEMPLATES_ACHIEVE = [
  '{floor}Fクリアした！',
  '{floor}Fでボス倒したー！',
  '{item} キター！',
  'ようやく {item} 手に入った',
  '今日のデイリーで {score} 点出た',
  '魂 {n} 個ゲット',
  'レベル {lv} になった',
  'ミスリル装備揃ったw',
  'ペットがレベルアップした！',
  '{floor}F 制覇〜',
] as const;

const TEMPLATES_QUESTION = [
  '鑑定の巻物余ってる人いる？',
  '魂の祠ってどこだっけ',
  'このペット強いかな？',
  '{floor}F のボス何が出る？',
  '初心者です、よろしく〜',
  '呪い解く方法教えて',
  'デイリーのスコアどれくらい目指す？',
  '{item} って強いの？',
  'ロクリングってどう育てる？',
] as const;

const TEMPLATES_CHAT = [
  'お疲れさまです',
  '今日は調子悪い…',
  '呪い引いた泣',
  '全装備祝福だわw',
  'クリティカル気持ちいい',
  '寝落ちしそう',
  'またモンハウかよ',
  'ペットかわいい〜',
  'ボス強すぎる',
  'デイリー難しすぎ…',
  '今日も頑張ろう',
  '雑談チャンネルあるといいな',
  'お腹すいた',
  'ｺﾞｰﾙﾄﾞが足りない',
  '{item} 売ったら高かったw',
  'ﾄﾗｯﾌﾟ踏みすぎて辛い',
] as const;

// ── 型 ────────────────────────────────────
export interface ChatMessage {
  name:        string;
  speciesName: string;
  speciesId:   string;
  tint:        string;
  lv:          number;
  text:        string;
  kind:        'achieve' | 'question' | 'chat';
  bornAt:      number;
}

// ── 状態 ──────────────────────────────────
let _queue:        ChatMessage[] = [];
let _nextSpawnAt:  number        = 0;
const MAX_KEEP    = 8;            // 保持する最大行数
const VISIBLE_MS  = 14000;        // 14秒で消える
let _enabled:      boolean        = (() => {
  try { return localStorage.getItem(TOGGLE_KEY) !== '1'; } catch { return true; }
})();

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function _generate(): ChatMessage {
  const speciesId = pick(APPEARANCE_IDS);
  const species   = APPEARANCES[speciesId];
  const tint      = pick(TINTS).color;
  const name      = pick(NAMES);
  const lv        = 3 + Math.floor(Math.random() * 32);

  const r = Math.random();
  const kind: ChatMessage['kind'] = r < 0.40 ? 'achieve' : r < 0.72 ? 'chat' : 'question';
  const tpl =
    kind === 'achieve'  ? pick(TEMPLATES_ACHIEVE) :
    kind === 'question' ? pick(TEMPLATES_QUESTION) :
                          pick(TEMPLATES_CHAT);

  const text = tpl
    .replace('{floor}', String(2 + Math.floor(Math.random() * 35)))
    .replace('{lv}',    String(2 + Math.floor(Math.random() * 28)))
    .replace('{n}',     String(1 + Math.floor(Math.random() * 8)))
    .replace('{score}', String(500 + Math.floor(Math.random() * 4500)))
    .replace('{item}',  pick(ITEMS));

  return {
    name, speciesName: species.name, speciesId, tint,
    lv, text, kind, bornAt: performance.now(),
  };
}

// ── 公開API ────────────────────────────────

/** 毎フレーム呼んで、間隔がきたら新しいメッセージを追加する */
export function tickChatTicker(): void {
  if (!_enabled) return;
  const now = performance.now();
  if (now >= _nextSpawnAt) {
    _queue.push(_generate());
    while (_queue.length > MAX_KEEP) _queue.shift();
    // 3.5〜9 秒のランダム間隔
    _nextSpawnAt = now + (3500 + Math.random() * 5500);
  }
  // 期限切れを除去
  _queue = _queue.filter(m => now - m.bornAt < VISIBLE_MS);
}

/** プレイヤー自身の達成をチャットに割り込ませる（イベント駆動）*/
export function pushPlayerEvent(text: string, kind: ChatMessage['kind'] = 'achieve'): void {
  _queue.push({
    name: 'あなた', speciesName: '', speciesId: '', tint: '#fde68a',
    lv: 0, text, kind, bornAt: performance.now(),
  });
  while (_queue.length > MAX_KEEP) _queue.shift();
}

export function getChatMessages(): ChatMessage[] { return _queue; }

export function isChatEnabled(): boolean { return _enabled; }

export function toggleChat(): boolean {
  _enabled = !_enabled;
  try { localStorage.setItem(TOGGLE_KEY, _enabled ? '0' : '1'); } catch {}
  return _enabled;
}

export function clearChat(): void {
  _queue = [];
  _nextSpawnAt = 0;
}
