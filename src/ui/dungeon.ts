import type { Player } from '../entities/player.js';
import type { Enemy } from '../entities/enemy.js';
import type { ItemDef } from '../data/equipment.js';
import type { SpriteLoader } from '../core/sprites.js';
import { roundRect } from '../ui/hud.js';
import { drawItemSvg } from '../ui/item-renderer.js';
import { TILE_SIZE } from '../world/tiles.js';
import { CANVAS_W, CANVAS_H } from '../core/game-constants.js';

// ---------------------------------------------------------------------------
// Context interfaces
// ---------------------------------------------------------------------------

export interface AttackPreviewContext {
  player: Player;
  enemies: Enemy[];
}

export interface EnemyRangesMap {
  cols: number;
  rows: number;
  isWalkable(tx: number, ty: number): boolean;
}

export interface EnemyRangesContext {
  player: Player;
  enemies: Enemy[];
  map: EnemyRangesMap;
}

export interface FloorItem {
  tx: number;
  ty: number;
  item: ItemDef;
}

export interface FloorItemsContext {
  floorItems: FloorItem[];
}

export interface FloorChest {
  tx: number;
  ty: number;
  opened: boolean;
}

export interface ChestsContext {
  floorChests: FloorChest[];
  exploredTiles: Set<string>;
  player: { tx: number; ty: number };
  sprites: SpriteLoader;
}

export interface InfiniteEscapeContext {
  floorNumber: number;
  infiniteEscapeCursor: number;
}

// ---------------------------------------------------------------------------
// drawAttackPreview
// ---------------------------------------------------------------------------

export function drawAttackPreview(
  ctx: CanvasRenderingContext2D,
  camOffX: number,
  camOffY: number,
  c: AttackPreviewContext,
): void {
  const { player, enemies } = c;
  const ts = TILE_SIZE;
  const dx = player.dirX ?? 0;
  const dy = player.dirY ?? 1;
  const targetTx = player.tx + dx;
  const targetTy = player.ty + dy;

  const weapon   = player.equip?.weapon;
  const aoe      = weapon?.aoe;
  const aoeRange = weapon?.aoeRange ?? 1;

  const hitTiles: { tx: number; ty: number }[] = [];
  let tileColor: string;
  let arrowColor: string;

  if (aoe === 'sweep') {
    for (let ady = -1; ady <= 1; ady++) {
      for (let adx = -1; adx <= 1; adx++) {
        if (adx !== 0 || ady !== 0) {
          hitTiles.push({ tx: player.tx + adx, ty: player.ty + ady });
        }
      }
    }
    tileColor  = 'rgba(203,213,225,';
    arrowColor = '#cbd5e1';
  } else if (aoe === 'cross') {
    for (const [rdx, rdy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      for (let r = 1; r <= aoeRange; r++) {
        hitTiles.push({ tx: player.tx + rdx * r, ty: player.ty + rdy * r });
      }
    }
    tileColor  = 'rgba(192,132,252,';
    arrowColor = '#c084fc';
  } else if (aoe === 'burst') {
    for (let ady = -aoeRange; ady <= aoeRange; ady++) {
      for (let adx = -aoeRange; adx <= aoeRange; adx++) {
        if (Math.abs(adx) + Math.abs(ady) <= aoeRange + 1) {
          hitTiles.push({ tx: targetTx + adx, ty: targetTy + ady });
        }
      }
    }
    tileColor  = 'rgba(251,191,36,';
    arrowColor = '#fbbf24';
  } else {
    const range = player.equip?.weapon?.range ?? 1;
    for (let ady = -range; ady <= range; ady++) {
      for (let adx = -range; adx <= range; adx++) {
        if (adx === 0 && ady === 0) continue;
        if (Math.max(Math.abs(adx), Math.abs(ady)) > range) continue;
        hitTiles.push({ tx: player.tx + adx, ty: player.ty + ady });
      }
    }
    tileColor  = 'rgba(96,200,255,';
    arrowColor = '#60c8ff';
  }

  ctx.save();
  for (const t of hitTiles) {
    const fx = t.tx * ts + camOffX;
    const fy = t.ty * ts + camOffY;
    ctx.globalAlpha = 0.22;
    ctx.fillStyle   = tileColor + '1)';
    ctx.fillRect(fx, fy, ts, ts);
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = tileColor + '1)';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(fx + 1, fy + 1, ts - 2, ts - 2);
  }

  let arrowDx = dx;
  let arrowDy = dy;
  if (!aoe) {
    const nearEnemy = enemies
      .filter(e => {
        if (!e.alive) return false;
        const cd = Math.max(Math.abs(e.tx - player.tx), Math.abs(e.ty - player.ty));
        return cd <= (player.equip?.weapon?.range ?? 1);
      })
      .sort(
        (a, b) =>
          Math.hypot(a.tx - player.tx, a.ty - player.ty) -
          Math.hypot(b.tx - player.tx, b.ty - player.ty),
      )[0];
    if (nearEnemy) {
      arrowDx = Math.sign(nearEnemy.tx - player.tx);
      arrowDy = Math.sign(nearEnemy.ty - player.ty);
    }
  }

  const arrowTargetTx = player.tx + arrowDx;
  const arrowTargetTy = player.ty + arrowDy;
  const arrowCx = arrowTargetTx * ts + camOffX + ts / 2;
  const arrowCy = arrowTargetTy * ts + camOffY + ts / 2;
  const angle   = Math.atan2(arrowDy, arrowDx);
  const aSize   = 7;

  ctx.globalAlpha = 0.85;
  ctx.fillStyle   = arrowColor;
  ctx.shadowColor = arrowColor;
  ctx.shadowBlur  = 8;
  ctx.translate(arrowCx, arrowCy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo( aSize,          0);
  ctx.lineTo(-aSize * 0.65, -aSize * 0.55);
  ctx.lineTo(-aSize * 0.65,  aSize * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// drawEnemyRanges
// ---------------------------------------------------------------------------

export function drawEnemyRanges(
  ctx: CanvasRenderingContext2D,
  camOffX: number,
  camOffY: number,
  now: number,
  c: EnemyRangesContext,
): void {
  const { player, enemies, map } = c;
  const ts = TILE_SIZE;
  const t  = now / 1000;

  for (const e of enemies) {
    if (!e.alive || !e.alerted) continue;

    const esx = e.tx * ts + camOffX;
    const esy = e.ty * ts + camOffY;
    if (esx < -ts * 12 || esx > CANVAS_W + ts * 12) continue;
    if (esy < -ts * 12 || esy > CANVAS_H + ts * 12) continue;

    const isCasting = e._castCharge > 0;

    if (e.isRanged) {
      const range = 2;
      ctx.save();

      const rayDirs: [number, number][] = [
        [-1, 0], [1, 0], [0, -1], [0, 1],
        [-1, -1], [-1, 1], [1, -1], [1, 1],
      ];
      for (const [rdx, rdy] of rayDirs) {
        for (let r = 1; r <= range; r++) {
          const tx = e.tx + rdx * r;
          const ty = e.ty + rdy * r;
          if (tx < 0 || ty < 0 || tx >= map.cols || ty >= map.rows) break;
          if (!map.isWalkable(tx, ty)) break;
          const sx = tx * ts + camOffX;
          const sy = ty * ts + camOffY;
          if (sx < -ts || sx > CANVAS_W + ts || sy < -ts || sy > CANVAS_H + ts) continue;

          if (isCasting) {
            const pulse = 0.18 + 0.14 * Math.sin(t * 9);
            ctx.fillStyle = `rgba(255,80,50,${pulse.toFixed(3)})`;
          } else {
            const alpha = Math.max(0.04, 0.14 - (r / range) * 0.1);
            ctx.fillStyle = `rgba(251,146,60,${alpha.toFixed(3)})`;
          }
          ctx.fillRect(sx, sy, ts, ts);
        }
      }

      ctx.setLineDash([4, 5]);
      ctx.lineWidth   = isCasting ? 2 : 1.2;
      ctx.strokeStyle = isCasting ? 'rgba(255,80,50,0.7)' : 'rgba(251,146,60,0.45)';
      const corners = (
        [[-1, -1], [1, -1], [1, 1], [-1, 1]] as [number, number][]
      ).map(([cdx, cdy]) => ({
        x: (e.tx + cdx * range) * ts + ts / 2 + camOffX,
        y: (e.ty + cdy * range) * ts + ts / 2 + camOffY,
      }));
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let ci = 1; ci < corners.length; ci++) ctx.lineTo(corners[ci].x, corners[ci].y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      const distToPlayer = Math.sqrt(
        (e.tx - player.tx) ** 2 + (e.ty - player.ty) ** 2,
      );
      if (distToPlayer <= range) {
        const psx = player.renderX + camOffX;
        const psy = player.renderY + camOffY;
        const pulse = isCasting ? 0.5 + 0.4 * Math.sin(t * 9) : 0.4;
        ctx.strokeStyle = isCasting
          ? `rgba(255,60,60,${pulse.toFixed(3)})`
          : `rgba(251,146,60,${pulse.toFixed(3)})`;
        ctx.lineWidth = isCasting ? 2.5 : 1.5;
        ctx.setLineDash(isCasting ? [] : [5, 4]);
        ctx.beginPath();
        ctx.moveTo(e.renderX + camOffX, e.renderY + camOffY);
        ctx.lineTo(psx, psy);
        ctx.stroke();
        ctx.setLineDash([]);

        if (isCasting) {
          const warnAlpha = 0.7 + 0.3 * Math.sin(t * 10);
          ctx.globalAlpha  = warnAlpha;
          ctx.font         = '18px monospace';
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText('⚡', e.renderX + camOffX, e.renderY + camOffY - 36);
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();
    } else {
      const isAdjacent =
        Math.abs(e.tx - player.tx) <= 2 && Math.abs(e.ty - player.ty) <= 2;
      if (!isAdjacent) continue;
      ctx.save();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const tx = e.tx + dx;
          const ty = e.ty + dy;
          if (tx < 0 || ty < 0 || tx >= map.cols || ty >= map.rows) continue;
          const sx = tx * ts + camOffX;
          const sy = ty * ts + camOffY;
          ctx.fillStyle = 'rgba(248,113,113,0.10)';
          ctx.fillRect(sx, sy, ts, ts);
        }
      }
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------------
// drawFloorItems
// ---------------------------------------------------------------------------

export function drawFloorItems(
  ctx: CanvasRenderingContext2D,
  camOffX: number,
  camOffY: number,
  c: FloorItemsContext,
): void {
  const { floorItems } = c;
  const ts = TILE_SIZE;

  for (const { tx, ty, item } of floorItems) {
    const sx = tx * ts + ts / 2 + camOffX;
    const sy = ty * ts + ts / 2 + camOffY;
    if (sx < -ts || sx > CANVAS_W + ts || sy < -ts || sy > CANVAS_H + ts) continue;

    const sz = ts * 0.62;

    ctx.save();
    ctx.shadowColor = item.color ?? '#fbbf24';
    ctx.shadowBlur  = ts * 0.22;
    ctx.fillStyle   = (item.color ?? '#fbbf24') + '22';
    ctx.beginPath();
    ctx.arc(sx, sy, sz * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.save();
    drawItemSvg(ctx, item, sx, sy, sz);
    ctx.restore();

    const label = `${item.icon ?? ''}${item.name ?? ''}`;
    if (label) {
      ctx.save();
      ctx.font         = 'bold 9px monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      const labelY = sy + sz * 0.52 + 2;
      const textW  = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      roundRect(ctx, sx - textW / 2 - 3, labelY - 1, textW + 6, 13, 3);
      ctx.fill();
      ctx.fillStyle = item.color ?? '#fde68a';
      ctx.fillText(label, sx, labelY);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------------
// drawChests
// ---------------------------------------------------------------------------

export function drawChests(
  ctx: CanvasRenderingContext2D,
  camOffX: number,
  camOffY: number,
  c: ChestsContext,
): void {
  const { floorChests, exploredTiles, player, sprites } = c;
  const ts = TILE_SIZE;

  for (const chest of floorChests) {
    const key = `${chest.tx},${chest.ty}`;
    if (!exploredTiles.has(key)) continue;
    const sx = chest.tx * ts + ts / 2 + camOffX;
    const sy = chest.ty * ts + ts / 2 + camOffY;
    if (sx < -ts || sx > CANVAS_W + ts || sy < -ts || sy > CANVAS_H + ts) continue;

    const spriteName = chest.opened ? 'chest_open' : 'chest';
    const sz = ts * 0.72;

    if (!chest.opened) {
      ctx.save();
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur  = ts * 0.28;
      ctx.fillStyle   = 'rgba(255,215,0,0.18)';
      ctx.beginPath();
      ctx.arc(sx, sy, sz * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    const img = sprites.get(spriteName);
    if (img) {
      ctx.save();
      ctx.drawImage(img, sx - sz / 2, sy - sz / 2, sz, sz);
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle   = chest.opened ? '#8B6914' : '#D4A017';
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth   = 2;
      ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
      ctx.strokeRect(sx - sz / 2, sy - sz / 2, sz, sz);
      ctx.fillStyle    = '#FFD700';
      ctx.font         = 'bold 14px monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chest.opened ? '📦' : '📦', sx, sy);
      ctx.restore();
    }

    if (!chest.opened) {
      const dist = Math.max(
        Math.abs(chest.tx - player.tx),
        Math.abs(chest.ty - player.ty),
      );
      if (dist <= 1) {
        ctx.save();
        ctx.font         = 'bold 10px monospace';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'bottom';
        const hint = '移動で開く';
        const hw   = ctx.measureText(hint).width;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        roundRect(ctx, sx - hw / 2 - 4, sy - sz / 2 - 17, hw + 8, 14, 3);
        ctx.fill();
        ctx.fillStyle = '#fde68a';
        ctx.fillText(hint, sx, sy - sz / 2 - 4);
        ctx.restore();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// drawInfiniteEscapePrompt
// ---------------------------------------------------------------------------

export function drawInfiniteEscapePrompt(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  c: InfiniteEscapeContext,
): void {
  const { floorNumber, infiniteEscapeCursor } = c;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, W, H);

  const pw = 420, ph = 200;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  roundRect(ctx, px, py, pw, ph, 14);
  ctx.fillStyle   = 'rgba(10,5,30,0.97)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(168,85,247,0.9)';
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  ctx.font      = 'bold 15px monospace';
  ctx.fillStyle = '#e9d5ff';
  ctx.fillText(`♾ ${floorNumber - 1}階クリア！`, px + pw / 2, py + 38);

  ctx.font      = '12px monospace';
  ctx.fillStyle = 'rgba(200,180,240,0.8)';
  ctx.fillText('このまま潜り続けますか？', px + pw / 2, py + 68);

  const bonus = Math.floor(floorNumber * 15);
  ctx.font      = '10px monospace';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`脱出報酬: +${bonus}G`, px + pw / 2, py + 92);

  const btnW = 150, btnH = 44, btnY = py + 128, gap = 20;
  const bx0  = px + (pw - btnW * 2 - gap) / 2;
  const labels: string[]  = ['⚔ 続ける', '🏃 脱出する'];
  const colors: string[]  = ['rgba(99,102,241,', 'rgba(239,68,68,'];

  labels.forEach((label, i) => {
    const bx  = bx0 + i * (btnW + gap);
    const sel = infiniteEscapeCursor === i;
    roundRect(ctx, bx, btnY, btnW, btnH, 8);
    ctx.fillStyle   = sel ? colors[i] + '0.35)' : 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = sel ? colors[i] + '0.9)' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = sel ? 2 : 1;
    ctx.stroke();
    ctx.font      = 'bold 13px monospace';
    ctx.fillStyle = sel ? '#fff' : 'rgba(200,200,200,0.7)';
    ctx.fillText(label, bx + btnW / 2, btnY + btnH / 2);
  });

  ctx.font      = '9px monospace';
  ctx.fillStyle = 'rgba(150,150,150,0.5)';
  ctx.fillText('[←→] 選択   [E / Enter] 決定', px + pw / 2, py + ph - 10);
  ctx.restore();
}
