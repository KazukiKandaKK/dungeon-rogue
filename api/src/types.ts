// ─────────────────────────────────────────────
// types.ts  共有型定義
// ─────────────────────────────────────────────

/** スコア投稿ボディ */
export interface ScoreInput {
  user_id:     string;  // クライアントが生成する UUID
  player_name: string;
  class_type:  string;  // 'warrior' | 'guardian' | 'mage' | 'rogue'
  lv:          number;
  floor:       number;
  dungeon_id:  string;
  gold:        number;
  turn_count:  number;
}

/** DB から読み出したスコア行 */
export interface ScoreRow extends ScoreInput {
  id:         number;
  created_at: string;
}

/** セーブデータのスロット番号 (0–2) */
export type SlotNumber = 0 | 1 | 2;

/** クラウドセーブ書き込みボディ */
export interface SaveInput {
  data: unknown; // ゲームが自由にシリアライズした JSON
}

/** DB から読み出したセーブ行 */
export interface SaveRow {
  id:         number;
  user_id:    string;
  slot:       SlotNumber;
  data:       string; // JSON 文字列
  updated_at: string;
}

/** GET /api/saves/:userId のレスポンス */
export type SaveSlots = Record<SlotNumber, unknown | null>;
