// ─────────────────────────────────────────────
// base-npc.ts  拠点を歩き回る冒険者NPC
//
// MMO の街中の他プレイヤーっぽさを出すために、種族・色・名前・Lv をランダムに
// 持つアバター NPC が拠点を徘徊する。話しかけると短い吹き出しで返事をする。
// ─────────────────────────────────────────────

import { APPEARANCE_IDS, APPEARANCES, TINTS } from '../data/appearances.js';
import type { AppearanceDef } from '../data/appearances.js';
import type { GameMap } from '../types.js';
import { TILE_SIZE } from '../world/tiles.js';
import { pickNpcTitle } from '../systems/titles.js';
import type { TitleDef } from '../systems/titles.js';

const NAMES = [
  'フロスト','シュー','ピコ','モス','ベル','サフィ','ペルル','ジン','ノヴァ','ルナ',
  'ソル','メル','リコ','エム','ユキ','カイ','レン','タロ','ミィ','クロ',
  'ユウ','コウ','ハル','ナギ','アサ','ヒビキ','スバル','ティナ','エルダ','ヴェル',
];

const GREETINGS = [
  'おつかれさま〜',
  'やっほー',
  '今日もダンジョン行く？',
  'ペットかわいい！',
  'AFK中ですm(_ _)m',
  '魂集まらんなぁ…',
  '装備鑑定したい',
  'デイリーまだ？',
  '誰か手伝って〜',
  'いい武器落ちた？',
  'またね',
  'よろしく〜',
  'お先〜',
  '休憩中',
  '無理せずいこ',
  'ﾅｲｽﾌｧｲﾄ',
];

// ── 役割別のセリフ ─────────────────────────────────
const ROLE_LINES: Record<NpcRole, string[]> = {
  wanderer: GREETINGS,
  merchant: [
    'いらっしゃい！',
    '掘り出し物あるよ',
    '今日は安いよ〜',
    '魂の剣、特価だ！',
    '品物ご覧下さい',
  ],
  guard: [
    '気をつけてな',
    '敵が増えている…',
    '門を護れ！',
    '怪しい者はいないか',
    '異常なし',
  ],
  drunk: [
    'ｳﾞｪｰｯ…',
    'もう一杯いっとく？',
    '酒場どこだっけ',
    'ﾌﾗﾌﾗ…',
    'ﾎﾟｶﾎﾟｶするー',
  ],
  crier: [
    '号外だ！新ダンジョン発見！',
    'ボス討伐の報酬、倍増中！',
    '今日の賭博、大当たり多数！',
    '勇者に栄光あれ！',
    '工房、新装備入荷！',
  ],
  priest: [
    '神のご加護を',
    '魂は救われる',
    '祈りなさい',
    '光あれ',
  ],
};

export type NpcRole = 'wanderer' | 'merchant' | 'guard' | 'drunk' | 'crier' | 'priest';

interface Waypoint { tx: number; ty: number; }

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class BaseNpc {
  readonly name:        string;
  readonly speciesId:   string;
  readonly appearance:  AppearanceDef;
  readonly tint:        string;
  readonly lv:          number;
  readonly title:       TitleDef | null;
  /** 役割（セリフと巡回経路の選択に使う） */
  role: NpcRole = 'wanderer';
  /** 巡回するウェイポイント列。NPC はこれらを順に目指して歩く。 */
  waypoints: Waypoint[] = [];
  /** 現在向かっているウェイポイントのインデックス */
  wpIndex: number = 0;
  tx: number;
  ty: number;
  fromTx: number;
  fromTy: number;
  /** 0..1 で 1=停止、0=移動開始直後 */
  moveT: number = 1;
  /** 次に何かを判断する時刻（performance.now ベース） */
  nextActAt: number;
  /** 吹き出し */
  bubbleText: string | null = null;
  bubbleUntil: number = 0;
  /** 横向きの向き（+1=右, -1=左） */
  facingDir: 1 | -1 = 1;

  constructor(tx: number, ty: number, role: NpcRole = 'wanderer', waypoints: Waypoint[] = []) {
    this.speciesId  = pick(APPEARANCE_IDS);
    this.appearance = APPEARANCES[this.speciesId];
    this.tint       = pick(TINTS).color;
    this.name       = pick(NAMES);
    this.lv         = 3 + Math.floor(Math.random() * 30);
    this.title      = pickNpcTitle(`${this.speciesId}:${this.name}:${this.lv}`);
    this.tx = tx; this.ty = ty;
    this.fromTx = tx; this.fromTy = ty;
    this.role = role;
    this.waypoints = waypoints;
    // 触れ回し(crier)は頻繁に吹き出しを出すので初手の間隔を短く
    const delay = role === 'crier' ? 800 : 1500 + Math.random() * 2500;
    this.nextActAt = performance.now() + delay;
  }

  /**
   * 1フレーム更新。立ち止まり中は何もせず、間隔がきたら walk か pause を選択。
   * @param dt 秒
   */
  update(
    dt:        number,
    map:       GameMap,
    blockers:  Array<{ tx: number; ty: number }>, // プレイヤー / 他NPC / 建物座標など
  ): void {
    // 移動補間（タイル間スライド）
    if (this.moveT < 1) this.moveT = Math.min(1, this.moveT + dt * 4);

    const now = performance.now();
    if (now < this.nextActAt) return;
    if (this.moveT < 1)        return; // 移動中は次の判断を遅らせる

    // 役割ごとに発声頻度を変える
    const chatProb =
      this.role === 'crier'    ? 0.55 :
      this.role === 'drunk'    ? 0.40 :
      this.role === 'merchant' ? 0.40 :
      0.30;
    const r = Math.random();
    if (r < chatProb) {
      const lines = ROLE_LINES[this.role] ?? GREETINGS;
      this.bubbleText = pick(lines);
      this.bubbleUntil = now + (this.role === 'crier' ? 2800 : 2200);
      this.nextActAt   = now + 1800 + Math.random() * 2200;
      return;
    }

    // ── ウェイポイント指向の4方向移動（距離が近い方向を優先） ──
    const target = this._currentWaypoint();
    const dirs: Array<[number, number]> = [[1,0],[-1,0],[0,1],[0,-1]];
    if (target) {
      const dx = target.tx - this.tx;
      const dy = target.ty - this.ty;
      // 目標に近い方向を先頭にしたバイアス付きのシャッフル
      dirs.sort(([ax, ay], [bx, by]) => {
        const aScore = ax * Math.sign(dx) + ay * Math.sign(dy);
        const bScore = bx * Math.sign(dx) + by * Math.sign(dy);
        return bScore - aScore;
      });
      // たまに揺らぎを入れる（同じ方向を常に選ばないように先頭2つだけランダム化）
      if (Math.random() < 0.35 && dirs.length >= 2) {
        [dirs[0], dirs[1]] = [dirs[1], dirs[0]];
      }
    } else {
      // ウェイポイントなし → ランダムシャッフル（既存の徘徊挙動）
      for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
      }
    }
    // 酔っ払いは時々逆方向に行く
    const isDrunk = this.role === 'drunk';
    if (isDrunk && Math.random() < 0.35) dirs.reverse();

    for (const [dx, dy] of dirs) {
      const nx = this.tx + dx;
      const ny = this.ty + dy;
      if (nx < 0 || ny < 0 || nx >= map.cols || ny >= map.rows) continue;
      if (!map.isWalkable(nx, ny)) continue;
      if (blockers.some(b => b.tx === nx && b.ty === ny)) continue;
      this.fromTx = this.tx;
      this.fromTy = this.ty;
      this.tx = nx;
      this.ty = ny;
      this.moveT = 0;
      if (dx > 0) this.facingDir = 1;
      else if (dx < 0) this.facingDir = -1;
      // ウェイポイント到達判定
      if (target && this.tx === target.tx && this.ty === target.ty) {
        this._advanceWaypoint();
      }
      // 酔っ払いは動きが速い＆ランダム、触れ回しはゆっくり朗々と
      const nextDelay =
        this.role === 'drunk' ? 600  + Math.random() * 900 :
        this.role === 'crier' ? 1600 + Math.random() * 1400 :
        1200 + Math.random() * 1800;
      this.nextActAt = now + nextDelay;
      return;
    }
    // 動けなかったらしばし停止（ウェイポイントが壁越しなら先送り）
    if (target) this._advanceWaypoint();
    this.nextActAt = now + 1500;
  }

  /** 現在向かっているウェイポイント（未設定なら null） */
  private _currentWaypoint(): Waypoint | null {
    if (this.waypoints.length === 0) return null;
    return this.waypoints[this.wpIndex % this.waypoints.length];
  }

  private _advanceWaypoint(): void {
    if (this.waypoints.length === 0) return;
    this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
  }

  /** 吹き出しを強制セット（プレイヤーから話しかけられた時） */
  speak(text: string): void {
    this.bubbleText  = text;
    this.bubbleUntil = performance.now() + 2500;
  }

  /** ランダム挨拶を返す（プレイヤーから話しかけられた時用） */
  randomGreeting(): string {
    const lines = ROLE_LINES[this.role] ?? GREETINGS;
    return pick(lines);
  }

  /**
   * 描画。プレイヤーと同じ APPEARANCES.draw を流用。
   */
  draw(ctx: CanvasRenderingContext2D, camOffX: number, camOffY: number): void {
    const t = this.moveT;
    const px = ((1 - t) * this.fromTx + t * this.tx + 0.5) * TILE_SIZE + camOffX;
    const py = ((1 - t) * this.fromTy + t * this.ty + 0.5) * TILE_SIZE + camOffY;
    const walking = this.moveT < 1;
    const phase   = walking ? (performance.now() / 200) % 1 : (performance.now() / 1500) % 1;
    // 影
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(px, py + TILE_SIZE * 0.4, TILE_SIZE * 0.32, TILE_SIZE * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 本体
    const facing = walking
      ? (this.facingDir > 0 ? 'side' : 'side')
      : 'front';
    ctx.save();
    if (walking && this.facingDir < 0) { ctx.translate(px, 0); ctx.scale(-1, 1); ctx.translate(-px, 0); }
    this.appearance.draw(ctx, px, py, TILE_SIZE * 0.92, facing as any, this.tint, phase, 1);
    ctx.restore();
    // 名前タグ
    ctx.save();
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const roleIcon: Record<NpcRole, string> = {
      wanderer: '',
      merchant: '🛒',
      guard:    '🛡',
      drunk:    '🍺',
      crier:    '📢',
      priest:   '✨',
    };
    const ri = roleIcon[this.role];
    const tag = `Lv${this.lv} ${this.name}${ri ? ' ' + ri : ''}`;
    const tw = ctx.measureText(tag).width + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(px - tw / 2, py - TILE_SIZE * 0.55 - 12, tw, 14);
    ctx.fillStyle = this.tint;
    ctx.fillText(tag, px, py - TILE_SIZE * 0.55);
    // 称号タグ（名前の上にさらに重ねる）
    if (this.title) {
      ctx.font = 'bold 9px monospace';
      const ttag = `${this.title.icon} ${this.title.name}`;
      const ttw  = ctx.measureText(ttag).width + 8;
      const tty  = py - TILE_SIZE * 0.55 - 14;
      ctx.fillStyle = 'rgba(15,5,30,0.85)';
      ctx.fillRect(px - ttw / 2, tty - 12, ttw, 12);
      ctx.fillStyle = this.title.color;
      ctx.fillText(ttag, px, tty - 1);
    }
    ctx.restore();
    // 吹き出し
    if (this.bubbleText && performance.now() < this.bubbleUntil) {
      const txt = this.bubbleText;
      ctx.save();
      ctx.font = 'bold 12px monospace';
      const w = ctx.measureText(txt).width + 16;
      const h = 22;
      const bx = px - w / 2;
      const by = py - TILE_SIZE * 0.8 - h - 8;
      ctx.fillStyle = 'rgba(15,5,30,0.9)';
      ctx.strokeStyle = 'rgba(168,85,247,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx + 8, by);
      ctx.lineTo(bx + w - 8, by);
      ctx.quadraticCurveTo(bx + w, by, bx + w, by + 8);
      ctx.lineTo(bx + w, by + h - 8);
      ctx.quadraticCurveTo(bx + w, by + h, bx + w - 8, by + h);
      ctx.lineTo(px + 6, by + h);
      ctx.lineTo(px, by + h + 7);
      ctx.lineTo(px - 6, by + h);
      ctx.lineTo(bx + 8, by + h);
      ctx.quadraticCurveTo(bx, by + h, bx, by + h - 8);
      ctx.lineTo(bx, by + 8);
      ctx.quadraticCurveTo(bx, by, bx + 8, by);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fde68a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, px, by + h / 2);
      ctx.restore();
    } else if (this.bubbleText && performance.now() >= this.bubbleUntil) {
      this.bubbleText = null;
    }

    // Y ソート用：renderY フィールドとして公開
    (this as unknown as { renderY: number }).renderY = py;
  }
}
