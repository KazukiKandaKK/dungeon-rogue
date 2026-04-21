// ─────────────────────────────────────────────
// base-interact.ts  拠点のインタラクト可能オブジェクト
//
// 拠点の広場に置かれたベンチ・井戸・看板・焚き火などを表現する。
// プレイヤーが隣接して [E] を押すと、フレーバーログと小さな効果（MP/HP +1）を返す。
// ─────────────────────────────────────────────

'use strict';

import { roundRect } from '../ui/hud.js';

// ── 型定義 ──────────────────────────────────────

export type InteractKind =
  | 'bench'
  | 'well'
  | 'signpost'
  | 'brazier'
  | 'fountain'
  | 'notice_board';

export interface InteractPlayer {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  tx?: number;
  ty?: number;
}

export interface InteractContext {
  player: InteractPlayer;
  addLog: (msg: string, type?: string) => void;
  now: number;
}

export interface BaseInteractable {
  tx: number;
  ty: number;
  kind: InteractKind;
  /** 隣接時に頭上に表示する短いラベル（例: "🪑 休む"） */
  label: string;
  /** インタラクト時にランダムに選ばれるフレーバー文の配列 */
  flavor: string[];
  /** 任意の副作用（HP/MP 回復など） */
  onInteract?: (ctx: InteractContext) => void;
}

// ── デフォルト配置 ──────────────────────────────
//
// 36×28 の拠点マップ上に、既存の施設・壁・噴水を避けて配置する。
// 壁: y=8 と y=17 の横壁、噴水 (17,12)-(18,13)、壁柱 (10,20)/(25,20)
// 施設: ポータル・酒場・行商人・祠・ギルド・受付・商店・工房・カジノ 等

export function buildDefaultBaseInteractables(): BaseInteractable[] {
  const list: BaseInteractable[] = [];

  // 中央噴水の北側（水源のほとり）
  list.push({
    tx: 17, ty: 11,
    kind: 'fountain',
    label: '⛲ 水を汲む',
    flavor: [
      '冷たい水が手のひらを伝う。頭がすっきりした。',
      '噴水に指を浸す。魔力が少し戻った気がする。',
      '水面に自分の顔が映る。まだ戦える。',
    ],
    onInteract: ({ player, addLog }) => {
      if (player.mp < player.maxMp) {
        player.mp = Math.min(player.maxMp, player.mp + 1);
        addLog('MP +1', 'heal');
      }
    },
  });

  // 広場のベンチ（4箇所）
  const benchFlavor = [
    '少し腰を下ろす。広場の鐘が遠くで鳴る。',
    'ベンチに座る。旅人たちの話し声が心地よい。',
    '木のベンチに身を預ける。日差しが暖かい。',
    '隣に猫が寄ってきた。しばし撫でてやる。',
  ];
  for (const pos of [
    { tx:  8, ty: 14 },
    { tx: 28, ty: 14 },
    { tx: 12, ty: 19 },
    { tx: 24, ty: 19 },
  ]) {
    list.push({
      tx: pos.tx, ty: pos.ty,
      kind: 'bench',
      label: '🪑 休む',
      flavor: benchFlavor,
    });
  }

  // 裏路地の井戸
  list.push({
    tx: 5, ty: 21,
    kind: 'well',
    label: '🪣 井戸を覗く',
    flavor: [
      '古い井戸。底から冷気がのぼってくる。',
      '井戸の水で喉を潤した。',
      '井戸の底に何か光るものが見えた気がした。',
    ],
    onInteract: ({ player, addLog }) => {
      if (player.mp < player.maxMp) {
        player.mp = Math.min(player.maxMp, player.mp + 1);
        addLog('MP +1', 'heal');
      }
    },
  });

  // 焚き火（2基）
  const brazierFlavor = [
    '焚き火に手をかざす。指先がじんわり温まる。',
    '炎の揺らぎに見入ってしまう。',
    '煙が夜空に溶けていく。',
  ];
  for (const pos of [
    { tx: 15, ty: 22 },
    { tx: 20, ty: 22 },
  ]) {
    list.push({
      tx: pos.tx, ty: pos.ty,
      kind: 'brazier',
      label: '🔥 暖をとる',
      flavor: brazierFlavor,
      onInteract: ({ player, addLog }) => {
        if (player.hp < player.maxHp) {
          player.hp = Math.min(player.maxHp, player.hp + 1);
          addLog('HP +1', 'heal');
        }
      },
    });
  }

  // 北西の看板（ダンジョン方面の道標）
  list.push({
    tx: 2, ty: 3,
    kind: 'signpost',
    label: '📜 看板を読む',
    flavor: [
      '看板：「北に洞窟、東にゴブリン巣、奥地に深淵」',
      '看板の裏に落書きが残っている。「強者、死すべし」',
      '古い道標。文字はかすれているが、方角だけは読み取れる。',
    ],
  });

  // 北東の掲示板
  list.push({
    tx: 32, ty: 3,
    kind: 'notice_board',
    label: '📋 掲示板を見る',
    flavor: [
      '掲示板：「行方不明の冒険者を捜索中。目撃情報求む」',
      '掲示板：「魂の値段、本日急騰。各自注意のこと」',
      '掲示板：「今宵、酒場にて新人歓迎会。参加自由」',
    ],
  });

  return list;
}

// ── 近傍検索 ──────────────────────────────────
//
// (tx,ty) から Manhattan 距離 1 以内（自身のタイルも含む）の
// インタラクタブルを返す。複数あるときは最短、同距離なら配列順。

export function findInteractableNear(
  list: readonly BaseInteractable[],
  tx: number,
  ty: number,
): BaseInteractable | null {
  let best: BaseInteractable | null = null;
  let bestDist = Infinity;
  for (const it of list) {
    const d = Math.abs(it.tx - tx) + Math.abs(it.ty - ty);
    if (d > 1) continue;
    if (d < bestDist) {
      bestDist = d;
      best = it;
    }
  }
  return best;
}

// ── 描画 ────────────────────────────────────

/**
 * 拠点オブジェクトをキャンバスに描画する。
 * プレイヤーが隣接している場合はラベルとパルスグロウを添える。
 */
export function drawBaseInteractables(
  ctx: CanvasRenderingContext2D,
  list: readonly BaseInteractable[],
  camOffX: number,
  camOffY: number,
  TILE_SIZE: number,
  now: number,
  playerTx: number,
  playerTy: number,
): void {
  for (const it of list) {
    const cx = it.tx * TILE_SIZE + TILE_SIZE / 2 + camOffX;
    const cy = it.ty * TILE_SIZE + TILE_SIZE / 2 + camOffY;
    const dist = Math.abs(it.tx - playerTx) + Math.abs(it.ty - playerTy);
    const nearby = dist <= 1;

    // 隣接時のパルスグロウ
    if (nearby) {
      const pulse = 0.35 + 0.25 * Math.sin(now / 220);
      ctx.save();
      ctx.globalAlpha = pulse;
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, TILE_SIZE * 0.9);
      grad.addColorStop(0, 'rgba(253,230,138,0.55)');
      grad.addColorStop(1, 'rgba(253,230,138,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, TILE_SIZE * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 本体
    switch (it.kind) {
      case 'bench':        _drawBench(ctx, cx, cy, TILE_SIZE); break;
      case 'well':         _drawWell(ctx, cx, cy, TILE_SIZE); break;
      case 'signpost':     _drawSignpost(ctx, cx, cy, TILE_SIZE); break;
      case 'brazier':      _drawBrazier(ctx, cx, cy, TILE_SIZE, now); break;
      case 'fountain':     _drawFountainDrop(ctx, cx, cy, TILE_SIZE, now); break;
      case 'notice_board': _drawNoticeBoard(ctx, cx, cy, TILE_SIZE); break;
    }

    // ラベル
    if (nearby) {
      _drawLabel(ctx, `[E] ${it.label}`, cx, cy - TILE_SIZE * 0.6);
    }
  }
}

// ── 個別の描画関数 ──────────────────────────

function _drawBench(ctx: CanvasRenderingContext2D, cx: number, cy: number, ts: number): void {
  const w = ts * 0.74, h = ts * 0.18;
  ctx.save();
  // 座面
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  // 背もたれ
  ctx.fillStyle = '#a06a34';
  ctx.fillRect(cx - w / 2, cy - h * 1.6, w, h * 0.7);
  // 脚
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(cx - w / 2 + 2, cy + h / 2, 3, ts * 0.18);
  ctx.fillRect(cx + w / 2 - 5, cy + h / 2, 3, ts * 0.18);
  ctx.restore();
}

function _drawWell(ctx: CanvasRenderingContext2D, cx: number, cy: number, ts: number): void {
  ctx.save();
  // 石枠
  ctx.fillStyle = '#6b7280';
  ctx.beginPath();
  ctx.ellipse(cx, cy + ts * 0.05, ts * 0.35, ts * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // 内部（水）
  ctx.fillStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.ellipse(cx, cy + ts * 0.05, ts * 0.26, ts * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  // 屋根
  ctx.fillStyle = '#7c3f1f';
  ctx.beginPath();
  ctx.moveTo(cx - ts * 0.40, cy - ts * 0.22);
  ctx.lineTo(cx + ts * 0.40, cy - ts * 0.22);
  ctx.lineTo(cx, cy - ts * 0.48);
  ctx.closePath();
  ctx.fill();
  // 柱
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(cx - ts * 0.32, cy - ts * 0.22, 3, ts * 0.28);
  ctx.fillRect(cx + ts * 0.29, cy - ts * 0.22, 3, ts * 0.28);
  ctx.restore();
}

function _drawSignpost(ctx: CanvasRenderingContext2D, cx: number, cy: number, ts: number): void {
  ctx.save();
  // 支柱
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(cx - 2, cy - ts * 0.30, 4, ts * 0.55);
  // 看板
  ctx.fillStyle = '#a87342';
  ctx.fillRect(cx - ts * 0.30, cy - ts * 0.38, ts * 0.60, ts * 0.22);
  ctx.strokeStyle = '#3a2612';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - ts * 0.30, cy - ts * 0.38, ts * 0.60, ts * 0.22);
  // 文字っぽい線
  ctx.fillStyle = '#3a2612';
  ctx.fillRect(cx - ts * 0.24, cy - ts * 0.30, ts * 0.48, 1.5);
  ctx.fillRect(cx - ts * 0.24, cy - ts * 0.25, ts * 0.36, 1.5);
  ctx.restore();
}

function _drawBrazier(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number, now: number,
): void {
  ctx.save();
  // 台座
  ctx.fillStyle = '#3f2a1a';
  ctx.fillRect(cx - 3, cy + ts * 0.05, 6, ts * 0.22);
  // 器
  ctx.fillStyle = '#4b2e17';
  ctx.beginPath();
  ctx.ellipse(cx, cy + ts * 0.05, ts * 0.24, ts * 0.10, 0, 0, Math.PI * 2);
  ctx.fill();
  // 炎（時間で揺らぐ）
  const flick = 1 + 0.18 * Math.sin(now / 110);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(253,186,116,0.9)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - ts * 0.10, ts * 0.13 * flick, ts * 0.22 * flick, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(251,113,36,0.7)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - ts * 0.04, ts * 0.09 * flick, ts * 0.16 * flick, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,200,0.8)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - ts * 0.02, ts * 0.05 * flick, ts * 0.09 * flick, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function _drawFountainDrop(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, ts: number, now: number,
): void {
  ctx.save();
  // 小さな水瓶（噴水の縁のアクセント）
  ctx.fillStyle = '#6b7280';
  ctx.beginPath();
  ctx.ellipse(cx, cy + ts * 0.08, ts * 0.22, ts * 0.10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.ellipse(cx, cy + ts * 0.05, ts * 0.14, ts * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // 水しぶき
  const s = 0.5 + 0.5 * Math.abs(Math.sin(now / 260));
  ctx.fillStyle = `rgba(191,219,254,${0.4 + 0.3 * s})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy - ts * 0.05, ts * 0.06, ts * 0.12 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function _drawNoticeBoard(ctx: CanvasRenderingContext2D, cx: number, cy: number, ts: number): void {
  ctx.save();
  // 支柱 2 本
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(cx - ts * 0.26, cy - ts * 0.15, 3, ts * 0.48);
  ctx.fillRect(cx + ts * 0.22, cy - ts * 0.15, 3, ts * 0.48);
  // 板
  ctx.fillStyle = '#a16a3a';
  ctx.fillRect(cx - ts * 0.32, cy - ts * 0.38, ts * 0.64, ts * 0.32);
  ctx.strokeStyle = '#3a2612';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - ts * 0.32, cy - ts * 0.38, ts * 0.64, ts * 0.32);
  // 紙片
  ctx.fillStyle = '#f5f5dc';
  ctx.fillRect(cx - ts * 0.25, cy - ts * 0.32, ts * 0.16, ts * 0.14);
  ctx.fillRect(cx - ts * 0.04, cy - ts * 0.30, ts * 0.14, ts * 0.16);
  ctx.fillRect(cx + ts * 0.13, cy - ts * 0.32, ts * 0.14, ts * 0.12);
  ctx.restore();
}

function _drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
): void {
  ctx.save();
  ctx.font = 'bold 11px "Noto Sans JP", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.max(40, ctx.measureText(text).width + 14);
  const h = 18;
  // 背景
  ctx.fillStyle = 'rgba(16,8,28,0.88)';
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(253,230,138,0.75)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // テキスト
  ctx.fillStyle = '#fde68a';
  ctx.fillText(text, cx, cy + 0.5);
  ctx.restore();
}
