// ─────────────────────────────────────────────
// api-client.ts  ゲーム → バックエンド API クライアント
//
// 全メソッドはネットワーク失敗を throw せず Result 型で返す。
// サーバーが落ちていてもゲームがクラッシュしないように設計する。
// ─────────────────────────────────────────────

// ── 型定義（バックエンドの types.ts と対応）──────

export interface ScorePayload {
  user_id:     string;
  player_name: string;
  class_type:  string;
  lv:          number;
  floor:       number;
  dungeon_id:  string;
  gold:        number;
  turn_count:  number;
}

export interface ScoreEntry extends ScorePayload {
  id:         number;
  created_at: string;
}

export type SaveSlots = Record<0 | 1 | 2, unknown | null>;

// ── Result 型（失敗してもゲームを止めない）─────────

export type ApiResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: string };

function succeed<T>(value: T): ApiResult<T> { return { ok: true,  value }; }
function fail<T>(error: string): ApiResult<T> { return { ok: false, error }; }

// ── ApiClient クラス ────────────────────────────

export class ApiClient {
  private _base: string;

  /**
   * @param baseUrl  例: 'http://localhost:3001'
   */
  constructor(baseUrl = 'http://localhost:3001') {
    this._base = baseUrl.replace(/\/$/, '');
  }

  // ── ヘルスチェック ─────────────────────────────

  async health(): Promise<ApiResult<{ status: string; time: string }>> {
    return this._get('/api/health');
  }

  // ── スコア ─────────────────────────────────────

  /** スコアを投稿する */
  async submitScore(payload: ScorePayload): Promise<ApiResult<{ id: number }>> {
    return this._post('/api/scores', payload);
  }

  /**
   * スコアランキングを取得する
   * @param dungeonId null = 全ダンジョン
   * @param limit     最大件数（デフォルト 20）
   */
  async getScores(
    dungeonId: string | null = null,
    limit      = 20,
    offset     = 0,
  ): Promise<ApiResult<{ scores: ScoreEntry[] }>> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (dungeonId) params.set('dungeon_id', dungeonId);
    return this._get(`/api/scores?${params}`);
  }

  /** 自分のスコア履歴を取得する */
  async getMyScores(userId: string): Promise<ApiResult<{ scores: ScoreEntry[] }>> {
    return this._get(`/api/scores/me/${encodeURIComponent(userId)}`);
  }

  // ── クラウドセーブ ──────────────────────────────

  /** 全スロットのセーブデータを取得する */
  async loadSaves(userId: string): Promise<ApiResult<{ slots: SaveSlots }>> {
    return this._get(`/api/saves/${encodeURIComponent(userId)}`);
  }

  /**
   * スロットにセーブデータを書き込む
   * @param slot 0 | 1 | 2
   * @param data 任意のシリアライズ可能なオブジェクト
   */
  async saveSlot(
    userId: string,
    slot:   0 | 1 | 2,
    data:   unknown,
  ): Promise<ApiResult<{ ok: boolean }>> {
    return this._put(`/api/saves/${encodeURIComponent(userId)}/${slot}`, { data });
  }

  /** スロットを削除する */
  async deleteSlot(userId: string, slot: 0 | 1 | 2): Promise<ApiResult<{ ok: boolean }>> {
    return this._delete(`/api/saves/${encodeURIComponent(userId)}/${slot}`);
  }

  // ── 内部ヘルパー ────────────────────────────────

  private async _get<T>(path: string): Promise<ApiResult<T>> {
    try {
      const res = await fetch(this._base + path);
      if (!res.ok) return fail(`HTTP ${res.status}`);
      return succeed(await res.json() as T);
    } catch (e) {
      return fail(String(e));
    }
  }

  private async _post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    try {
      const res = await fetch(this._base + path, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!res.ok) return fail(`HTTP ${res.status}`);
      return succeed(await res.json() as T);
    } catch (e) {
      return fail(String(e));
    }
  }

  private async _put<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    try {
      const res = await fetch(this._base + path, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!res.ok) return fail(`HTTP ${res.status}`);
      return succeed(await res.json() as T);
    } catch (e) {
      return fail(String(e));
    }
  }

  private async _delete<T>(path: string): Promise<ApiResult<T>> {
    try {
      const res = await fetch(this._base + path, { method: 'DELETE' });
      if (!res.ok) return fail(`HTTP ${res.status}`);
      return succeed(await res.json() as T);
    } catch (e) {
      return fail(String(e));
    }
  }
}

// ── デフォルトシングルトン（main.js から import して使う）──

export const apiClient = new ApiClient(
  typeof window !== 'undefined' && (window as { __API_BASE__?: string }).__API_BASE__
    ? (window as { __API_BASE__?: string }).__API_BASE__!
    : 'http://localhost:3001'
);
