import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../../src/core/api-client.js';

// ── fetch モック ──────────────────────────────────

function mockFetch(status: number, body: unknown): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok:   status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response);
}

function mockFetchError(message = 'Network error'): void {
  global.fetch = vi.fn().mockRejectedValue(new Error(message));
}

const BASE = 'http://localhost:3001';
const client = new ApiClient(BASE);

const SCORE: Parameters<ApiClient['submitScore']>[0] = {
  user_id:     'user-1',
  player_name: '勇者',
  class_type:  'warrior',
  lv:          10,
  floor:       5,
  dungeon_id:  'cave',
  gold:        200,
  turn_count:  300,
};

afterEach(() => { vi.restoreAllMocks(); });

// ─────────────────────────────────────────────────

describe('health()', () => {
  it('成功時は ok:true と値を返す', async () => {
    mockFetch(200, { status: 'ok', time: '2026-01-01T00:00:00Z' });
    const result = await client.health();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('ok');
  });

  it('サーバーエラー(500)は ok:false', async () => {
    mockFetch(500, {});
    const result = await client.health();
    expect(result.ok).toBe(false);
  });

  it('ネットワークエラーは ok:false（throw しない）', async () => {
    mockFetchError();
    const result = await client.health();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Network error');
  });
});

describe('submitScore()', () => {
  it('成功時は id を返す', async () => {
    mockFetch(201, { id: 42 });
    const result = await client.submitScore(SCORE);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe(42);
  });

  it('バリデーションエラー(400)は ok:false', async () => {
    mockFetch(400, { error: 'player_name required' });
    const result = await client.submitScore({ ...SCORE, player_name: '' });
    expect(result.ok).toBe(false);
  });

  it('POST /api/scores を呼ぶ', async () => {
    mockFetch(201, { id: 1 });
    await client.submitScore(SCORE);
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/scores`);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string).player_name).toBe('勇者');
  });
});

describe('getScores()', () => {
  it('全ダンジョンのスコアを取得', async () => {
    const mockScores = [{ ...SCORE, id: 1, created_at: '' }];
    mockFetch(200, { scores: mockScores, limit: 20, offset: 0 });
    const result = await client.getScores();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.scores).toHaveLength(1);
  });

  it('dungeon_id クエリパラメータが付く', async () => {
    mockFetch(200, { scores: [], limit: 20, offset: 0 });
    await client.getScores('cave', 10);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain('dungeon_id=cave');
    expect(url).toContain('limit=10');
  });
});

describe('getMyScores()', () => {
  it('userId をパスに含む', async () => {
    mockFetch(200, { scores: [] });
    await client.getMyScores('alice');
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain('/api/scores/me/alice');
  });
});

describe('loadSaves()', () => {
  it('スロット情報を返す', async () => {
    const slots = { 0: { lv: 5 }, 1: null, 2: null };
    mockFetch(200, { slots });
    const result = await client.loadSaves('alice');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.slots[0]).toEqual({ lv: 5 });
  });
});

describe('saveSlot()', () => {
  it('PUT /api/saves/:userId/:slot を呼ぶ', async () => {
    mockFetch(200, { ok: true });
    await client.saveSlot('alice', 1, { lv: 10 });
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/saves/alice/1`);
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body as string).data).toEqual({ lv: 10 });
  });

  it('ネットワークエラーは ok:false（throw しない）', async () => {
    mockFetchError('timeout');
    const result = await client.saveSlot('alice', 0, {});
    expect(result.ok).toBe(false);
  });
});

describe('deleteSlot()', () => {
  it('DELETE /api/saves/:userId/:slot を呼ぶ', async () => {
    mockFetch(200, { ok: true });
    await client.deleteSlot('alice', 2);
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/saves/alice/2`);
    expect(opts.method).toBe('DELETE');
  });
});
