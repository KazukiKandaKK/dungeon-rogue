// ─────────────────────────────────────────────
// index.ts  Hono アプリ エントリーポイント
// ─────────────────────────────────────────────

import { Hono }            from 'hono';
import { cors }            from 'hono/cors';
import { logger }          from 'hono/logger';
import { serve }           from '@hono/node-server';
import {
  MemoryScoreRepository,
  MemorySaveRepository,
  type ScoreRepository,
  type SaveRepository,
} from './repository.js';
import { createScoresRouter } from './routes/scores.js';
import { createSavesRouter  } from './routes/saves.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ─────────────────────────────────────────────
// createApp: テストではリポジトリを差し替えて使う
// ─────────────────────────────────────────────
export function createApp(
  scoreRepo: ScoreRepository = new MemoryScoreRepository(),
  saveRepo:  SaveRepository  = new MemorySaveRepository(),
): Hono {
  const app = new Hono();

  app.use('*', cors());
  app.use('*', logger());

  // ── ヘルスチェック ─────────────────────────────
  app.get('/api/health', (c) =>
    c.json({ status: 'ok', time: new Date().toISOString() })
  );

  // ── ルーター マウント ───────────────────────────
  app.route('/api/scores', createScoresRouter(scoreRepo));
  app.route('/api/saves',  createSavesRouter(saveRepo));

  // ── 404 ────────────────────────────────────────
  app.notFound((c) => c.json({ error: 'not found' }, 404));

  return app;
}

// ── サーバー起動（直接実行時のみ）─────────────────
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  const app = createApp();
  console.log(`[api] listening on http://localhost:${PORT}`);
  serve({ fetch: app.fetch, port: PORT });
}
