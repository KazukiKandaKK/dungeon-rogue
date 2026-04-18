// ─────────────────────────────────────────────
// saves.ts  セーブデータ型定義 + ストレージユーティリティ
//
// 純粋関数のみ。グローバル状態を書き換えない。
// saveToSlot / loadFromSlot の実装は GameContext 整備後に移行する。
// ─────────────────────────────────────────────

import { SAVE_SLOT_KEYS } from '../core/game-constants.js';

// ── セーブデータのシリアライズ形式 ─────────────────

export interface SaveEquip {
  weapon:    string | null;
  armor:     string | null;
  accessory: string | null;
}

/**
 * localStorage に書き込む JSON 形式。
 * v < 2 のデータはロード非対応（下位互換打ち切り）。
 */
export interface SaveData {
  /** フォーマットバージョン */
  v:               number;
  floor:           number;
  cls:             string;
  build:           string;
  mystery:         boolean;
  gold:            number;
  lv:              number;
  exp:             number;
  expNext:         number;
  hp:              number;
  mp:              number;
  baseAtk:         number;
  baseDef:         number;
  baseMaxHP:       number;
  baseSpd:         number;
  baseLuk:         number;
  baseMp:          number;
  buildBonus:      Record<string, number>;
  equip:           SaveEquip;
  /** アイテム ID の配列 */
  inventory:       string[];
  /** スペル ID の配列 */
  spells:          string[];
  /** ホットバー（スペル ID or null）6 スロット */
  hotbar:          (string | null)[];
  /** 預かりアイテム ID の配列 */
  baseChest:       string[];
  dungeonId:       string | null;
  clearedDungeons: string[];
  savedAt:         number;
}

// ── 純粋ユーティリティ ────────────────────────────

/**
 * 指定スロットのセーブデータを読み込む。
 * 失敗時は null を返す（例外を投げない）。
 */
export function getSlotData(slot: 0 | 1 | 2): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_SLOT_KEYS[slot]);
    if (!raw) return null;
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

/**
 * いずれかのスロットにセーブが存在するか確認する。
 */
export function hasAnySave(): boolean {
  return SAVE_SLOT_KEYS.some(k => {
    try { return !!localStorage.getItem(k); } catch { return false; }
  });
}

/**
 * セーブデータの保存日時を日本語形式で返す。
 * savedAt がない場合は空文字。
 */
export function formatSavedAt(savedAt: number | undefined): string {
  if (!savedAt) return '';
  return new Date(savedAt).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
