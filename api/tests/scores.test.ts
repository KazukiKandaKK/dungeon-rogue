import { describe, it, expect } from 'vitest';
import { MemoryScoreRepository, MemorySaveRepository } from '../src/repository.js';
import { createApp } from '../src/index.js';

// テスト用: リポジトリを毎回フレッシュに
function makeApp() {
  return createApp(new MemoryScoreRepository(), new MemorySaveRepository());
}

async function req(
  app: ReturnType<typeof createApp>,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body    = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  const res  = await app.fetch(new Request(`http://localhost${path}`, init));
  const json = await res.json();
  return { status: res.status, json };
}

const VALID_SCORE = {
  user_id:     'user-abc',
  player_name: '勇者A',
  class_type:  'warrior',
  lv:          10,
  floor:       5,
  dungeon_id:  'cave',
  gold:        200,
  turn_count:  300,
};

// ─────────────────────────────────────────────────

describe('POST /api/scores', () => {
  it('正常なスコアを投稿すると 201 と id が返る', async () => {
    const app = makeApp();
    const { status, json } = await req(app, 'POST', '/api/scores', VALID_SCORE);
    expect(status).toBe(201);
    expect((json as { id: number }).id).toBeGreaterThan(0);
  });

  it('player_name が空だと 400', async () => {
    const { status } = await req(makeApp(), 'POST', '/api/scores', { ...VALID_SCORE, player_name: '' });
    expect(status).toBe(400);
  });

  it('player_name が 21 文字以上だと 400', async () => {
    const { status } = await req(makeApp(), 'POST', '/api/scores', { ...VALID_SCORE, player_name: 'a'.repeat(21) });
    expect(status).toBe(400);
  });

  it('不正な class_type だと 400', async () => {
    const { status } = await req(makeApp(), 'POST', '/api/scores', { ...VALID_SCORE, class_type: 'ninja' });
    expect(status).toBe(400);
  });

  it('lv が 0 だと 400（1 以上必須）', async () => {
    const { status } = await req(makeApp(), 'POST', '/api/scores', { ...VALID_SCORE, lv: 0 });
    expect(status).toBe(400);
  });

  it('gold が負数だと 400', async () => {
    const { status } = await req(makeApp(), 'POST', '/api/scores', { ...VALID_SCORE, gold: -1 });
    expect(status).toBe(400);
  });

  it('JSON でないボディだと 400', async () => {
    const app = makeApp();
    const res = await app.fetch(new Request('http://localhost/api/scores', {
      method:  'POST',
      body:    'not json',
      headers: { 'Content-Type': 'application/json' },
    }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/scores', () => {
  it('スコアが 0 件のとき空配列', async () => {
    const { status, json } = await req(makeApp(), 'GET', '/api/scores');
    expect(status).toBe(200);
    expect((json as { scores: unknown[] }).scores).toHaveLength(0);
  });

  it('投稿したスコアが一覧に出る', async () => {
    const app = makeApp();
    await req(app, 'POST', '/api/scores', VALID_SCORE);
    const { json } = await req(app, 'GET', '/api/scores');
    expect((json as { scores: unknown[] }).scores).toHaveLength(1);
  });

  it('dungeon_id でフィルタできる', async () => {
    const app = makeApp();
    await req(app, 'POST', '/api/scores', VALID_SCORE);
    await req(app, 'POST', '/api/scores', { ...VALID_SCORE, dungeon_id: 'abyss' });
    const { json } = await req(app, 'GET', '/api/scores?dungeon_id=cave');
    const scores = (json as { scores: { dungeon_id: string }[] }).scores;
    expect(scores).toHaveLength(1);
    expect(scores[0].dungeon_id).toBe('cave');
  });

  it('limit で件数を絞れる', async () => {
    const app = makeApp();
    for (let i = 0; i < 5; i++) {
      await req(app, 'POST', '/api/scores', { ...VALID_SCORE, player_name: `P${i}` });
    }
    const { json } = await req(app, 'GET', '/api/scores?limit=3');
    expect((json as { scores: unknown[] }).scores).toHaveLength(3);
  });

  it('lv が高いスコアが先頭に来る', async () => {
    const app = makeApp();
    await req(app, 'POST', '/api/scores', { ...VALID_SCORE, lv: 5,  player_name: 'Weak'   });
    await req(app, 'POST', '/api/scores', { ...VALID_SCORE, lv: 50, player_name: 'Strong' });
    const { json } = await req(app, 'GET', '/api/scores');
    const scores = (json as { scores: { player_name: string }[] }).scores;
    expect(scores[0].player_name).toBe('Strong');
  });
});

describe('GET /api/scores/me/:userId', () => {
  it('自分のスコアだけが返る', async () => {
    const app = makeApp();
    await req(app, 'POST', '/api/scores', { ...VALID_SCORE, user_id: 'alice' });
    await req(app, 'POST', '/api/scores', { ...VALID_SCORE, user_id: 'bob' });
    const { json } = await req(app, 'GET', '/api/scores/me/alice');
    const scores = (json as { scores: { user_id: string }[] }).scores;
    expect(scores).toHaveLength(1);
    expect(scores[0].user_id).toBe('alice');
  });

  it('存在しないユーザーは空配列', async () => {
    const { json } = await req(makeApp(), 'GET', '/api/scores/me/nobody');
    expect((json as { scores: unknown[] }).scores).toHaveLength(0);
  });
});
