// ─────────────────────────────────────────────
// reclass.ts  転職サービスメニュー描画
// ─────────────────────────────────────────────

import type { Player }       from '../entities/player.js';
import { CLASSES, CLASS_IDS } from '../data/classes.js';
import type { ClassId }      from '../data/classes.js';
import { roundRect }         from './hud.js';

export interface ReclassMenuContext {
  player:        Player;
  reclassCursor: number;
  /** 転職コスト */
  cost:          number;
}

export function drawReclassMenu(
  ctx: CanvasRenderingContext2D,
  W:   number,
  H:   number,
  c:   ReclassMenuContext,
): void {
  ctx.save();

  // 背景暗幕
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);

  const pw = 560;
  const ROW_H = 70;
  const ph = 120 + CLASS_IDS.length * ROW_H + 48;
  const px = (W - pw) / 2 | 0;
  const py = (H - ph) / 2 | 0;

  // パネル
  roundRect(ctx, px, py, pw, ph, 14);
  ctx.fillStyle   = 'rgba(8,3,25,0.97)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(168,85,247,0.8)';
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  // タイトル
  ctx.font         = 'bold 16px "Noto Sans JP", monospace';
  ctx.fillStyle    = '#e9d5ff';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('🔮 転職の祭壇', px + pw / 2, py + 14);

  // サブタイトル（現在の職業・コスト）
  const curCls = CLASSES[c.player.classType as ClassId] ?? null;
  ctx.font      = '11px monospace';
  ctx.fillStyle = '#c4b5fd';
  ctx.fillText(
    `現在: ${curCls ? `${curCls.icon} ${curCls.name}` : c.player.classType} Lv.${c.player.lv}   転職料: ${c.cost}G   (所持: ${c.player.gold}G)`,
    px + pw / 2,
    py + 38,
  );

  // 区切り線
  ctx.strokeStyle = 'rgba(168,85,247,0.35)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(px + 16, py + 60);
  ctx.lineTo(px + pw - 16, py + 60);
  ctx.stroke();

  // 職業リスト
  const startY = py + 74;
  for (let i = 0; i < CLASS_IDS.length; i++) {
    const cid      = CLASS_IDS[i];
    const cls      = CLASSES[cid];
    const rowY     = startY + i * ROW_H;
    const isSelect = i === c.reclassCursor;
    const isCurrent= cid === c.player.classType;
    const canPay   = c.player.gold >= c.cost;

    // 行背景
    roundRect(ctx, px + 16, rowY, pw - 32, ROW_H - 6, 8);
    if (isSelect) {
      ctx.fillStyle = cls.bgColor;
      ctx.fill();
      ctx.strokeStyle = cls.color;
      ctx.lineWidth   = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(24,12,48,0.6)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,80,160,0.35)';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }

    // 職業アイコン
    ctx.font         = '30px monospace';
    ctx.fillStyle    = cls.color;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cls.icon, px + 46, rowY + (ROW_H - 6) / 2);

    // 名前
    ctx.textAlign = 'left';
    ctx.font      = 'bold 14px "Noto Sans JP", monospace';
    ctx.fillStyle = isSelect ? '#ffffff' : cls.color;
    ctx.textBaseline = 'top';
    ctx.fillText(cls.name, px + 80, rowY + 8);

    // ベースステータス（簡易）
    ctx.font      = '10px monospace';
    ctx.fillStyle = '#94a3b8';
    const stats = `HP ${cls.baseHP}+${cls.hpPerLv}/Lv   ATK ${cls.baseAtk}+${cls.atkPerLv}/Lv   DEF ${cls.baseDef}+${cls.defPerLv}/Lv   MP ${cls.baseMpMax}+${cls.mpPerLv}/Lv`;
    ctx.fillText(stats, px + 80, rowY + 26);

    // 説明文（desc 1行目のみ）
    ctx.font      = '10px "Noto Sans JP", monospace';
    ctx.fillStyle = isSelect ? '#e9d5ff' : '#a78bfa';
    ctx.fillText(cls.desc[0] ?? '', px + 80, rowY + 42);

    // 右端バッジ
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    if (isCurrent) {
      ctx.font      = 'bold 11px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('[現職]', px + pw - 28, rowY + (ROW_H - 6) / 2);
    } else if (isSelect) {
      ctx.font      = 'bold 11px monospace';
      ctx.fillStyle = canPay ? '#fbbf24' : '#f87171';
      ctx.fillText(canPay ? '[Enter] 転職' : '[資金不足]', px + pw - 28, rowY + (ROW_H - 6) / 2);
    }
  }

  // 注意書き
  ctx.font      = '10px "Noto Sans JP", monospace';
  ctx.fillStyle = 'rgba(196,181,253,0.7)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('※ レベル・装備・所持品は引き継がれます。スペルは新職業のものに置き換わります。', px + pw / 2, py + ph - 26);

  // 操作説明
  ctx.font      = '10px monospace';
  ctx.fillStyle = 'rgba(196,181,253,0.55)';
  ctx.fillText('[↑↓] 選択   [Enter] 決定   [Esc] 閉じる', px + pw / 2, py + ph - 10);

  ctx.restore();
}
