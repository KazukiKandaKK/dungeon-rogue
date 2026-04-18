// ─────────────────────────────────────────────
// routes/scores.ts  スコア（ランキング）API
// ─────────────────────────────────────────────

import { Hono }               from 'hono';
import type { ScoreRepository } from '../repository.js';
import type { ScoreInput }      from '../types.js';

const VALID_CLASSES  = new Set(['warrior', 'guardian', 'mage', 'rogue']);
const MAX_NAME_LEN   = 20;
const DEFAULT_LIMIT  = 20;
const MAX_LIMIT      = 100;

export function createScoresRouter(repo: ScoreRepository): Hono {
  const router = new Hono();

  // ── POST /  スコアを投稿 ─────────────────────
  router.post('/', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid JSON' }, 400);
    }

    const err = validateScoreInput(body);
    if (err) return c.json({ error: err }, 400);

    const id = repo.insert(body as ScoreInput);
    return c.json({ id }, 201);
  });

  // ── GET /  ランキングを取得 ────────────────────
  router.get('/', (c) => {
    const dungeonId = c.req.query('dungeon_id') ?? null;
    const limitRaw  = parseInt(c.req.query('limit') ?? String(DEFAULT_LIMIT), 10);
    const limit     = Math.min(isNaN(limitRaw) ? DEFAULT_LIMIT : limitRaw, MAX_LIMIT);
    const offset    = parseInt(c.req.query('offset') ?? '0', 10);

    const scores = repo.findAll(dungeonId, limit, offset);
    return c.json({ scores, limit, offset });
  });

  // ── GET /me/:userId  自分のスコア履歴 ─────────
  router.get('/me/:userId', (c) => {
    const { userId } = c.req.param();
    const scores = repo.findByUser(userId);
    return c.json({ scores });
  });

  return router;
}

// ── バリデーション ──────────────────────────────

function validateScoreInput(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return 'body must be object';
  const b = body as Record<string, unknown>;

  if (typeof b.user_id !== 'string' || b.user_id.length === 0) return 'user_id required';
  if (typeof b.player_name !== 'string' || b.player_name.length === 0 || b.player_name.length > MAX_NAME_LEN)
    return `player_name must be 1–${MAX_NAME_LEN} chars`;
  if (typeof b.class_type !== 'string' || !VALID_CLASSES.has(b.class_type))
    return `class_type must be one of: ${[...VALID_CLASSES].join(', ')}`;
  if (!Number.isInteger(b.lv)         || (b.lv as number) < 1)    return 'lv must be integer >= 1';
  if (!Number.isInteger(b.floor)      || (b.floor as number) < 1)  return 'floor must be integer >= 1';
  if (typeof b.dungeon_id !== 'string' || b.dungeon_id.length === 0) return 'dungeon_id required';
  if (!Number.isInteger(b.gold)       || (b.gold as number) < 0)   return 'gold must be integer >= 0';
  if (!Number.isInteger(b.turn_count) || (b.turn_count as number) < 0) return 'turn_count must be integer >= 0';

  return null;
}
