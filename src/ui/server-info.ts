// ─────────────────────────────────────────────
// server-info.ts  右上のサーバー情報オーバーレイ
//
// ・ｻｰﾊﾞｰ名 / オンライン人数 / 現在時刻 を常時表示
// ・発動中のワールドイベントと残り時間（プログレスバー付き）
// ─────────────────────────────────────────────

import {
  SERVER_NAME,
  fakeOnlineCount,
  getActiveEvent,
  getSecondsUntilNext,
  SLOT_MS,
} from '../systems/world-events.js';

function _pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function _clockText(now: number): string {
  const d = new Date(now);
  return `${_pad2(d.getHours())}:${_pad2(d.getMinutes())}`;
}

function _fmtCount(n: number): string {
  return n.toLocaleString('en-US');
}

function _remainText(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${_pad2(m)}:${_pad2(s)}`;
}

/**
 * 画面右上にオーバーレイで描画する。タイトル/作成画面中は非表示推奨。
 */
export function drawServerInfo(
  ctx: CanvasRenderingContext2D,
  W:   number,
  _H:  number,
): void {
  const now    = Date.now();
  const evt    = getActiveEvent(now);
  const remain = getSecondsUntilNext(now);
  const online = fakeOnlineCount(now);

  const panelW = 230;
  const panelH = 62;
  // 画面右上の「Floor 情報」パネル（rph=62, rpy=10）の下に並べる
  const px = W - panelW - 10;
  const py = 82;

  ctx.save();
  // 本体
  ctx.fillStyle   = 'rgba(10,4,24,0.72)';
  ctx.strokeStyle = 'rgba(192,132,252,0.45)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.roundRect(px, py, panelW, panelH, 6);
  ctx.fill(); ctx.stroke();

  // 1行目: ｻｰﾊﾞｰ名 + オンライン
  ctx.font = 'bold 10.5px monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#c4b5fd';
  ctx.fillText(SERVER_NAME, px + 10, py + 6);
  ctx.font = '10px monospace';
  ctx.fillStyle = '#86efac';
  ctx.textAlign = 'right';
  ctx.fillText(`● ${_fmtCount(online)}`, px + panelW - 10, py + 7);

  // 2行目: 時計 + イベント名
  ctx.textAlign = 'left';
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#9ca3af';
  ctx.fillText(_clockText(now), px + 10, py + 23);
  ctx.fillStyle = evt.color;
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`${evt.icon} ${evt.name}`, px + 58, py + 22);

  // 3行目: バフ内容 + 残り
  ctx.font = '9.5px monospace';
  ctx.fillStyle = '#fde68a';
  ctx.fillText(evt.hint, px + 10, py + 39);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#c4b5fd';
  ctx.fillText(`-${_remainText(remain)}`, px + panelW - 10, py + 39);

  // プログレスバー（残り時間を減っていく方向で表示）
  const barX = px + 10;
  const barY = py + panelH - 8;
  const barW = panelW - 20;
  const barH = 4;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(barX, barY, barW, barH);
  const ratio = Math.max(0, Math.min(1, remain * 1000 / SLOT_MS));
  ctx.fillStyle = evt.color;
  ctx.fillRect(barX, barY, barW * ratio, barH);

  ctx.restore();
}
