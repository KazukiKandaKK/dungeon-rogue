// ─────────────────────────────────────────────
// routes/saves.ts  クラウドセーブ API
// ─────────────────────────────────────────────

import { Hono }              from 'hono';
import type { SaveRepository } from '../repository.js';
import type { SlotNumber, SaveSlots } from '../types.js';

const VALID_SLOTS    = new Set([0, 1, 2]);
const MAX_SAVE_BYTES = 64 * 1024; // 64 KB

export function createSavesRouter(repo: SaveRepository): Hono {
  const router = new Hono();

  // ── GET /:userId  全スロット取得 ──────────────
  router.get('/:userId', (c) => {
    const { userId } = c.req.param();
    const rows = repo.findByUser(userId);

    const slots: SaveSlots = { 0: null, 1: null, 2: null };
    for (const row of rows) {
      try {
        slots[row.slot] = JSON.parse(row.data);
      } catch {
        slots[row.slot] = null;
      }
    }
    return c.json({ slots });
  });

  // ── PUT /:userId/:slot  セーブ書き込み ─────────
  router.put('/:userId/:slot', async (c) => {
    const { userId, slot: slotStr } = c.req.param();
    const slot = parseInt(slotStr, 10);

    if (!VALID_SLOTS.has(slot)) {
      return c.json({ error: 'slot must be 0, 1, or 2' }, 400);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid JSON' }, 400);
    }

    if (typeof body !== 'object' || body === null || !('data' in body)) {
      return c.json({ error: 'body must have "data" field' }, 400);
    }

    const dataStr = JSON.stringify((body as { data: unknown }).data);
    if (dataStr.length > MAX_SAVE_BYTES) {
      return c.json({ error: `data too large (max ${MAX_SAVE_BYTES} bytes)` }, 413);
    }

    repo.upsert(userId, slot as SlotNumber, dataStr);
    return c.json({ ok: true });
  });

  // ── DELETE /:userId/:slot  スロット削除 ────────
  router.delete('/:userId/:slot', (c) => {
    const { userId, slot: slotStr } = c.req.param();
    const slot = parseInt(slotStr, 10);

    if (!VALID_SLOTS.has(slot)) {
      return c.json({ error: 'slot must be 0, 1, or 2' }, 400);
    }

    repo.delete(userId, slot as SlotNumber);
    return c.json({ ok: true });
  });

  return router;
}
