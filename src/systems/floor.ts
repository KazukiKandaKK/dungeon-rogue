import { Enemy, getBossName } from '../entities/enemy.js';
import type { DungeonDef } from '../world/dungeon_defs.js';
import { BOSS_RUSH_NAMES, BOSS_RUSH_SPRITES, BOSS_RUSH_VARIANTS } from '../world/dungeon_defs.js';
import type { ItemDef } from '../data/equipment.js';
import { treasureDrop, SHOP_CATALOG, ITEMS } from '../data/equipment.js';
import { TILE } from '../world/tiles.js';
import { ENEMY_COUNT, MIN_SPAWN_DIST, ITEM_PER_FLOOR } from '../core/game-constants.js';

// ---------------------------------------------------------------------------
// Shared map interface
// ---------------------------------------------------------------------------

export interface SpawnMap {
  cols: number;
  rows: number;
  isWalkable(tx: number, ty: number): boolean;
  getExitDir(tx: number, ty: number): string | null;
  isStairs(tx: number, ty: number): boolean;
}

// ---------------------------------------------------------------------------
// 1. getFloorTheme
// ---------------------------------------------------------------------------

export function getFloorTheme(floorNum: number, currentDungeon: DungeonDef | null): string {
  if (currentDungeon) return currentDungeon.theme;
  const cycle = (floorNum - 1) % 15;
  if (cycle < 5)  return 'dungeon';
  if (cycle < 10) return 'forest';
  return 'town';
}

// ---------------------------------------------------------------------------
// 2. spawnBoss
// ---------------------------------------------------------------------------

export interface BossSpawnContext {
  currentDungeon: DungeonDef | null;
  floorNumber: number;
  map: SpawnMap;
}

export function spawnBoss(ctx: BossSpawnContext): Enemy[] {
  const { currentDungeon, floorNumber, map } = ctx;

  let tx = 0;
  let ty = 0;
  let att = 0;
  do {
    tx = Math.floor(map.cols / 2) + Math.floor((Math.random() - 0.5) * 10);
    ty = Math.floor(map.rows / 2) + Math.floor((Math.random() - 0.5) * 10);
    att++;
  } while (att < 1000 && (!map.isWalkable(tx, ty) || map.getExitDir(tx, ty) || map.isStairs(tx, ty)));

  const boss = new Enemy(tx, ty, 'boss');
  boss.alerted = true;

  if (currentDungeon?.bossRush) {
    const wave    = floorNumber;
    const idx     = Math.min(wave - 1, BOSS_RUSH_NAMES.length - 1);
    const name    = BOSS_RUSH_NAMES[idx];
    const sprite  = BOSS_RUSH_SPRITES[idx];
    const variant = BOSS_RUSH_VARIANTS[idx];
    boss.name     = `[Wave ${wave}] ${name}`;
    if (sprite) boss.spriteName = sprite;
    if (variant) boss.bossVariant = variant;
    boss.maxHP    = Math.floor(boss.maxHP * (1 + wave * 0.6));
    boss.hp       = boss.maxHP;
    boss.atk      = boss.atk + wave * 5;
    boss.def      = boss.def + wave * 3;
    boss.expValue = Math.floor(boss.expValue * (1 + wave * 2.0));
  } else {
    boss.name  = currentDungeon?.bossName ?? getBossName(floorNumber);
    if (currentDungeon?.bossSprite) boss.spriteName = currentDungeon.bossSprite;
    const tier = Math.floor((floorNumber - 5) / 5);
    boss.maxHP = Math.floor(boss.maxHP * (1 + tier * 0.5));
    boss.hp    = boss.maxHP;
    boss.atk   = boss.atk + tier * 3;
    boss.def   = boss.def + tier * 2;
    boss.expValue = Math.floor(boss.expValue * (1 + tier * 0.8));
  }

  // ── ボス封印（BossSeal）を設定 ─────────────────
  //   bossRush では封印なし（波が連戦のため）。
  //   通常ダンジョンは bossSeal の type に従って解除条件を設定する。
  const result: Enemy[] = [boss];
  if (!currentDungeon?.bossRush && currentDungeon?.bossSeal) {
    const seal = currentDungeon.bossSeal;
    boss.riddleActive   = true;   // 既存の結界バリア機構を流用
    boss.riddleAnswered = false;
    boss.sealType       = seal.type;
    boss.sealLabel      = seal.label;

    if (seal.type === 'guards') {
      const spawnType = seal.spawnType ?? 'goblin';
      const needed    = seal.count ?? 3;
      const slots     = _collectNearbyWalkable(map, boss.tx, boss.ty, 1, 3);
      for (let i = 0; i < needed && i < slots.length; i++) {
        const s = slots[i]!;
        const guard = new Enemy(s.tx, s.ty, spawnType);
        guard.alerted      = true;
        guard.isSealMinion = true;
        result.push(guard);
      }
    } else if (seal.type === 'statues') {
      const needed = seal.count ?? 2;
      const slots  = _collectNearbyWalkable(map, boss.tx, boss.ty, 1, 3);
      for (let i = 0; i < needed && i < slots.length; i++) {
        const s = slots[i]!;
        const st = new Enemy(s.tx, s.ty, 'seal_statue');
        st.isSealMinion = true;
        result.push(st);
      }
    }
    // 'key' は main.js 側で床にアイテム設置する。ここでは何もしない。
  }

  return result;
}

/**
 * ボス周囲の半径 minR..maxR の歩けるタイルを、重複なしで集める。
 * ボス自身の位置は除外。順序はランダムシャッフル。
 */
function _collectNearbyWalkable(
  map: SpawnMap,
  cx:  number,
  cy:  number,
  minR = 1,
  maxR = 3,
): Array<{ tx: number; ty: number }> {
  const out: Array<{ tx: number; ty: number }> = [];
  for (let dy = -maxR; dy <= maxR; dy++) {
    for (let dx = -maxR; dx <= maxR; dx++) {
      const r = Math.max(Math.abs(dx), Math.abs(dy));
      if (r < minR || r > maxR) continue;
      const tx = cx + dx;
      const ty = cy + dy;
      if (!map.isWalkable(tx, ty)) continue;
      if (map.getExitDir(tx, ty)) continue;
      if (map.isStairs(tx, ty))   continue;
      out.push({ tx, ty });
    }
  }
  // Fisher–Yates シャッフル
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. spawnEnemies
// ---------------------------------------------------------------------------

export interface SpawnContext {
  currentDungeon: DungeonDef | null;
  floorNumber: number;
  isMonsterHouseFloor: boolean;
  map: SpawnMap;
  player: { tx: number; ty: number } | null;
}

export function spawnEnemies(ctx: SpawnContext): Enemy[] {
  const { currentDungeon, floorNumber, isMonsterHouseFloor, map, player } = ctx;

  const maxFloors   = currentDungeon?.maxFloors ?? 99;
  const isBossFloor = currentDungeon?.bossRush
    || (currentDungeon?.infinite ? floorNumber % 10 === 0 : floorNumber === maxFloors);

  if (isBossFloor) return spawnBoss({ currentDungeon, floorNumber, map });

  const baseTypes    = currentDungeon?.enemyTypes ?? ['slime', 'goblin', 'archer', 'wizard'];
  const minFloorMap  = currentDungeon?.enemyMinFloor ?? {};
  const filtered     = baseTypes.filter(t => (minFloorMap[t] ?? 1) <= floorNumber);
  const allowedTypes = filtered.length > 0 ? filtered : baseTypes;
  const diffMult     = currentDungeon?.diffMult ?? 1.0;
  const scale        = (floorNumber - 1) * diffMult;
  const result: Enemy[] = [];

  if (isMonsterHouseFloor) {
    const tiles: Array<{ tx: number; ty: number }> = [];
    for (let ty2 = 0; ty2 < map.rows; ty2++) {
      for (let tx2 = 0; tx2 < map.cols; tx2++) {
        if (!map.isWalkable(tx2, ty2)) continue;
        if (map.getExitDir(tx2, ty2)) continue;
        if (map.isStairs(tx2, ty2)) continue;
        const dist = player
          ? Math.max(Math.abs(tx2 - player.tx), Math.abs(ty2 - player.ty)) : 0;
        if (dist < MIN_SPAWN_DIST) continue;
        tiles.push({ tx: tx2, ty: ty2 });
      }
    }
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = tiles[i]!;
      tiles[i] = tiles[j]!;
      tiles[j] = tmp;
    }
    const mhMax  = currentDungeon?.infinite ? 200 : 50;
    const count  = Math.min(30 + Math.floor(Math.random() * 21), mhMax, tiles.length);
    for (let i = 0; i < count; i++) {
      const tile = tiles[i]!;
      const type = allowedTypes[Math.floor(Math.random() * allowedTypes.length)]!;
      const e    = new Enemy(tile.tx, tile.ty, type);
      e.maxHP    = Math.floor(e.maxHP * (1 + scale * 0.18));
      e.hp       = e.maxHP;
      e.atk      = e.atk + Math.floor(scale * 0.7);
      e.def      = e.def + Math.floor(scale * 0.3);
      e.expValue = Math.floor(e.expValue * (1 + scale * 0.2));
      e.alerted  = true;
      result.push(e);
    }
  } else {
    const baseCount = currentDungeon?.enemyCountBase ?? ENEMY_COUNT;
    const count     = Math.min(25, baseCount + Math.floor((floorNumber - 1) / 2));
    let att = 0;
    while (result.length < count && att < 5000) {
      att++;
      const tx2 = Math.floor(Math.random() * map.cols);
      const ty2 = Math.floor(Math.random() * map.rows);
      if (!map.isWalkable(tx2, ty2)) continue;
      if (map.getExitDir(tx2, ty2)) continue;
      if (map.isStairs(tx2, ty2)) continue;
      const dist = player
        ? Math.max(Math.abs(tx2 - player.tx), Math.abs(ty2 - player.ty)) : 0;
      if (dist < MIN_SPAWN_DIST) continue;
      const type = allowedTypes[Math.floor(Math.random() * allowedTypes.length)]!;
      const e    = new Enemy(tx2, ty2, type);
      e.maxHP    = Math.floor(e.maxHP * (1 + scale * 0.18));
      e.hp       = e.maxHP;
      e.atk      = e.atk + Math.floor(scale * 0.7);
      e.def      = e.def + Math.floor(scale * 0.3);
      e.expValue = Math.floor(e.expValue * (1 + scale * 0.2));
      result.push(e);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// 4. placeFloorItems
// ---------------------------------------------------------------------------

export interface PlacedItem {
  tx: number;
  ty: number;
  item: ItemDef;
}

export interface PlaceFloorItemsContext {
  map: SpawnMap;
  floorNumber: number;
}

export function placeFloorItems(ctx: PlaceFloorItemsContext): PlacedItem[] {
  const { map, floorNumber } = ctx;
  const result: PlacedItem[] = [];

  let placed = 0;
  let att    = 0;
  while (placed < ITEM_PER_FLOOR && att < 2000) {
    att++;
    const tx = Math.floor(Math.random() * map.cols);
    const ty = Math.floor(Math.random() * map.rows);
    if (!map.isWalkable(tx, ty)) continue;
    if (map.getExitDir(tx, ty)) continue;
    if (map.isStairs(tx, ty)) continue;
    if (result.some(fi => fi.tx === tx && fi.ty === ty)) continue;

    const item = treasureDrop(floorNumber);
    if (item) {
      result.push({ tx, ty, item });
      placed++;
    }
  }

  // ゴールドコインを1-2枚追加
  const goldCount = 1 + Math.floor(Math.random() * 2);
  for (let g = 0; g < goldCount; g++) {
    for (let att2 = 0; att2 < 500; att2++) {
      const tx = Math.floor(Math.random() * map.cols);
      const ty = Math.floor(Math.random() * map.rows);
      if (!map.isWalkable(tx, ty)) continue;
      if (map.getExitDir(tx, ty)) continue;
      if (map.isStairs(tx, ty)) continue;
      if (result.some(fi => fi.tx === tx && fi.ty === ty)) continue;
      const amount = Math.floor(floorNumber * 3 + Math.random() * floorNumber * 5 + 5);
      result.push({
        tx,
        ty,
        item: { slot: 'gold', amount, icon: '💰', color: '#fbbf24', name: `${amount}G` } as unknown as ItemDef,
      });
      break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// 5. placeChests
// ---------------------------------------------------------------------------

export interface FloorChest {
  tx: number;
  ty: number;
  opened: boolean;
}

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export interface ChestMap extends SpawnMap {
  rooms: Room[];
  monsterHouseRoom: Room | null;
}

export interface PlaceChestsContext {
  map: ChestMap;
  floorNumber: number;
  player: { tx: number; ty: number } | null;
  existingItems: Array<{ tx: number; ty: number }>;
}

export function placeChests(ctx: PlaceChestsContext): FloorChest[] {
  const { map, floorNumber, player, existingItems } = ctx;

  if (floorNumber % 5 === 0) return [];

  const count  = 1 + Math.floor(Math.random() * 2);
  const mh     = map.monsterHouseRoom;
  const rooms  = map.rooms.filter(r => r !== mh && r.w >= 4 && r.h >= 4);
  if (rooms.length === 0) return [];

  const result: FloorChest[] = [];
  let placed = 0;

  for (let att = 0; att < 2000 && placed < count; att++) {
    const room = rooms[Math.floor(Math.random() * rooms.length)]!;
    const tx   = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
    const ty   = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
    if (!map.isWalkable(tx, ty)) continue;
    if (map.isStairs(tx, ty)) continue;
    if (map.getExitDir(tx, ty)) continue;
    if (existingItems.some(fi => fi.tx === tx && fi.ty === ty)) continue;
    if (result.some(c => c.tx === tx && c.ty === ty)) continue;
    const dist = player
      ? Math.max(Math.abs(tx - player.tx), Math.abs(ty - player.ty)) : 0;
    if (dist < MIN_SPAWN_DIST) continue;
    result.push({ tx, ty, opened: false });
    placed++;
  }

  return result;
}

// ---------------------------------------------------------------------------
// 6. placeShop
// ---------------------------------------------------------------------------

export interface ShopEntry {
  itemId: string;
  price: number;
  tier: number;
  item: ItemDef;
}

export interface PlaceShopResult {
  shopPos: { tx: number; ty: number } | null;
  shopItems: ShopEntry[];
}

export interface ShopMap extends ChestMap {
  stairs: { tx: number; ty: number } | null;
}

export interface PlaceShopContext {
  map: ShopMap;
  floorNumber: number;
  player: { tx: number; ty: number };
}

export function placeShop(ctx: PlaceShopContext): PlaceShopResult {
  const { map, floorNumber, player } = ctx;
  const empty: PlaceShopResult = { shopPos: null, shopItems: [] };

  if (floorNumber % 5 === 0) return empty;
  if (map.rooms.length === 0) return empty;
  if (Math.random() > 0.55) return empty;

  const mh          = map.monsterHouseRoom;
  const stairsTile  = map.stairs;
  const candidates  = map.rooms.filter(r =>
    r !== mh && r.w >= 4 && r.h >= 4 &&
    Math.abs(r.cx - player.tx) + Math.abs(r.cy - player.ty) > 6 &&
    !(stairsTile && r.cx === stairsTile.tx && r.cy === stairsTile.ty)
  );
  if (candidates.length === 0) return empty;

  const room   = candidates[Math.floor(Math.random() * candidates.length)]!;
  const shopPos = { tx: room.cx, ty: room.cy };

  const maxTier  = Math.min(2, Math.floor((floorNumber - 1) / 3));
  const pool     = SHOP_CATALOG.filter(s => s.tier <= maxTier);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const shopItems: ShopEntry[] = shuffled
    .slice(0, 4 + Math.floor(Math.random() * 3))
    .map(s => ({ ...s, item: { ...ITEMS[s.itemId] } as ItemDef }));

  return { shopPos, shopItems };
}

// ---------------------------------------------------------------------------
// 7. assignTrapTypes
// ---------------------------------------------------------------------------

export interface TrapMap {
  rows: number;
  cols: number;
  grid: number[][];
  trapTypes: Map<string, string>;
}

export function assignTrapTypes(map: TrapMap, currentDungeon: DungeonDef | null): void {
  map.trapTypes.clear();
  const TYPES = currentDungeon?.infinite
    ? ['summon', 'summon', 'summon', 'summon', 'summon', 'damage', 'poison', 'teleport', 'alarm', 'sleep']
    : ['damage', 'damage', 'poison', 'poison', 'teleport', 'alarm', 'drop_item', 'sleep', 'summon'];
  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      if (map.grid[ty]![tx] === TILE.TRAP) {
        map.trapTypes.set(`${tx},${ty}`, TYPES[Math.floor(Math.random() * TYPES.length)]!);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 8. buildBaseShopItems
// ---------------------------------------------------------------------------

export function buildBaseShopItems(): ShopEntry[] {
  const shuffled = [...SHOP_CATALOG].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 6).map(s => ({ ...s, item: { ...ITEMS[s.itemId] } as ItemDef }));
}
