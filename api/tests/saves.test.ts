import { describe, it, expect } from 'vitest';
import { MemoryScoreRepository, MemorySaveRepository } from '../src/repository.js';
import { createApp } from '../src/index.js';

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

const USER      = 'user-xyz';
const SAVE_DATA = { player: { lv: 5, hp: 30 }, floor: 3, dungeon: 'cave' };

describe('GET /api/saves/:userId', () => {
  it('初期状態は全スロット null', async () => {
    const { status, json } = await req(makeApp(), 'GET', `/api/saves/${USER}`);
    expect(status).toBe(200);
    const slots = (json as { slots: Record<string, unknown> }).slots;
    expect(slots['0']).toBeNull();
    expect(slots['1']).toBeNull();
    expect(slots['2']).toBeNull();
  });
});

describe('PUT /api/saves/:userId/:slot', () => {
  it('スロット 0 に書き込み → 読み出しで同じデータが返る', async () => {
    const app = makeApp();
    const { status } = await req(app, 'PUT', `/api/saves/${USER}/0`, { data: SAVE_DATA });
    expect(status).toBe(200);

    const { json } = await req(app, 'GET', `/api/saves/${USER}`);
    const slots = (json as { slots: Record<string, unknown> }).slots;
    expect(slots['0']).toEqual(SAVE_DATA);
    expect(slots['1']).toBeNull();
  });

  it('複数スロットに書き込み', async () => {
    const app = makeApp();
    await req(app, 'PUT', `/api/saves/${USER}/0`, { data: { slot: 0 } });
    await req(app, 'PUT', `/api/saves/${USER}/2`, { data: { slot: 2 } });

    const { json } = await req(app, 'GET', `/api/saves/${USER}`);
    const slots = (json as { slots: Record<string, { slot: number } | null> }).slots;
    expect(slots['0']?.slot).toBe(0);
    expect(slots['1']).toBeNull();
    expect(slots['2']?.slot).toBe(2);
  });

  it('同じスロットへの上書きが正しく反映される', async () => {
    const app = makeApp();
    await req(app, 'PUT', `/api/saves/${USER}/1`, { data: { version: 1 } });
    await req(app, 'PUT', `/api/saves/${USER}/1`, { data: { version: 2 } });

    const { json } = await req(app, 'GET', `/api/saves/${USER}`);
    const slots = (json as { slots: Record<string, { version: number } | null> }).slots;
    expect(slots['1']?.version).toBe(2);
  });

  it('不正なスロット番号（3）だと 400', async () => {
    const { status } = await req(makeApp(), 'PUT', `/api/saves/${USER}/3`, { data: {} });
    expect(status).toBe(400);
  });

  it('"data" フィールドのないボディは 400', async () => {
    const { status } = await req(makeApp(), 'PUT', `/api/saves/${USER}/0`, { save: {} });
    expect(status).toBe(400);
  });

  it('64KB 超えのデータは 413', async () => {
    const { status } = await req(makeApp(), 'PUT', `/api/saves/${USER}/0`, { data: 'x'.repeat(64 * 1024 + 1) });
    expect(status).toBe(413);
  });

  it('ユーザー間でデータが分離される', async () => {
    const app = makeApp();
    await req(app, 'PUT', '/api/saves/alice/0', { data: { who: 'alice' } });
    await req(app, 'PUT', '/api/saves/bob/0',   { data: { who: 'bob' } });

    const { json: aj } = await req(app, 'GET', '/api/saves/alice');
    const { json: bj } = await req(app, 'GET', '/api/saves/bob');

    const aSlots = (aj as { slots: Record<string, { who: string } | null> }).slots;
    const bSlots = (bj as { slots: Record<string, { who: string } | null> }).slots;
    expect(aSlots['0']?.who).toBe('alice');
    expect(bSlots['0']?.who).toBe('bob');
  });
});

describe('DELETE /api/saves/:userId/:slot', () => {
  it('書き込んだスロットを削除すると null になる', async () => {
    const app = makeApp();
    await req(app, 'PUT',    `/api/saves/${USER}/0`, { data: SAVE_DATA });
    await req(app, 'DELETE', `/api/saves/${USER}/0`);

    const { json } = await req(app, 'GET', `/api/saves/${USER}`);
    expect((json as { slots: Record<string, unknown> }).slots['0']).toBeNull();
  });

  it('不正なスロット番号（-1）だと 400', async () => {
    const { status } = await req(makeApp(), 'DELETE', `/api/saves/${USER}/-1`);
    expect(status).toBe(400);
  });
});

describe('GET /api/health', () => {
  it('status: ok を返す', async () => {
    const { status, json } = await req(makeApp(), 'GET', '/api/health');
    expect(status).toBe(200);
    expect((json as { status: string }).status).toBe('ok');
  });
});
