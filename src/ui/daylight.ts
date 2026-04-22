// ─────────────────────────────────────────────
// daylight.ts  太陽ベクトル計算（指向性影・色調用）
//
// time-of-day の phase（0..1）から「影がどの方向にどれだけ伸びるか」
// 「影の色はどんな色か」を導くヘルパ。base-objects.ts の時間帯オーバーレイと
// 合わせて、マイクラのシェーダ MOD 風の時間帯演出を actor 側でも再現する。
//
// トップダウン 2D なので「太陽方位＋高度」を screen の (dx, dy) ベクトルに
// 射影する。昼の一瞬は影が真下に短く、朝夕は水平に長く伸びる。
//
// time-of-day の位相/ラベル/アイコンを算出する純関数もここに置く。
// HUD 等 Node テスト環境（Canvas/Path2D を持たない）から直接参照できるよう、
// base-objects.ts から分離している。
// ─────────────────────────────────────────────
'use strict';

// ─── 時間帯（純関数群） ──────────────────────────
// 1 サイクル = 実時間 4 分。base-objects.ts の時間帯オーバーレイと共通。
export const TIME_OF_DAY_CYCLE_MS = 4 * 60 * 1000;

/** 現在の位相（0..1）を now から算出する純関数。 */
export function getTimeOfDayPhase(now: number): number {
  const t = ((now % TIME_OF_DAY_CYCLE_MS) + TIME_OF_DAY_CYCLE_MS) % TIME_OF_DAY_CYCLE_MS;
  return t / TIME_OF_DAY_CYCLE_MS;
}

/** 時刻ラベル（朝・昼・夕・夜）を位相から得る。 */
export function getTimeOfDayLabel(phase: number): '朝' | '昼' | '夕' | '夜' {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.20) return '朝';
  if (p < 0.50) return '昼';
  if (p < 0.70) return '夕';
  return '夜';
}

/** 時刻ラベルに絵文字を付与した HUD 用の短い表記を返す。 */
export function getTimeOfDayIcon(label: '朝' | '昼' | '夕' | '夜'): string {
  if (label === '朝') return '🌅';
  if (label === '昼') return '☀';
  if (label === '夕') return '🌇';
  return '🌙';
}

/** 影の描画に必要なパラメタのまとまり。 */
export interface SunVec {
  /** 影の方向（画面座標。dx: 東→西 が負, dy: 南向きが正） */
  dx: number;
  dy: number;
  /** 太陽高度 0..1（1 = 真上、0 = 地平線 / 夜） */
  elevation: number;
  /** 影の長さ倍率（真昼は 0.6、朝夕は ～2.4） */
  lengthMult: number;
  /** 影の基本 rgba（時間帯ごとに寒色/暖色を切り替え） */
  tint: string;
  /** 影全体の α（夜は弱める） */
  alpha: number;
}

/**
 * phase（0..1）から太陽ベクトルを計算する純関数。
 * base-objects.ts の getTimeOfDayPhase と組にして使う。
 *
 * 位相の想定：
 *   0.00..0.08  夜明け前（月光：影うっすら、南向き）
 *   0.08..0.18  朝焼け（太陽が東低／影は西に長く）
 *   0.18..0.45  午前〜昼（影は短く南寄り）
 *   0.45..0.55  正午付近（最短・真下）
 *   0.55..0.70  午後〜夕焼け（太陽が西低／影は東に長く）
 *   0.70..0.85  日暮れ（影を急速に弱める）
 *   0.85..1.00  夜（月光・南にうっすら）
 */
export function getSunVector(phase: number): SunVec {
  const p = ((phase % 1) + 1) % 1;

  // ── 夜帯（月光）──
  // 拠点 getNightFactor と揃えて 0.85 以降 / 0.08 以前は夜扱い。
  if (p >= 0.85 || p < 0.08) {
    // 月の方位：朝 4 時（p≈0.0）は西にあるため東向きに薄い影
    const moonEast = p < 0.04 || p > 0.96 ? -1 : (p < 0.08 ? -0.6 : 0.6);
    const dx = -moonEast * 0.15;
    const dy = 1;
    const mag = Math.hypot(dx, dy);
    return {
      dx: dx / mag,
      dy: dy / mag,
      elevation: 0.15,
      lengthMult: 0.85,
      tint: 'rgba(20,30,55,0.24)',
      alpha: 0.24,
    };
  }

  // ── 昼帯（0.08..0.85 を 0..1 に正規化）──
  const d = (p - 0.08) / (0.85 - 0.08);     // 0..1
  // 高度：dawn/dusk で 0、正午で 1
  const elev = Math.max(0, Math.sin(d * Math.PI));
  // 東西成分：dawn で +1（東）、dusk で -1（西）
  const sunX = Math.cos(d * Math.PI);
  // 影は太陽の反対方向
  const dxRaw = -sunX;
  const dyRaw = 0.3 + (1 - elev) * 0.7;
  const mag = Math.hypot(dxRaw, dyRaw);
  const dx = dxRaw / mag;
  const dy = dyRaw / mag;

  // 長さ：正午最短、朝夕最長
  const lengthMult = 0.6 + (1 - elev) * 1.8;

  // 色調
  let tint: string;
  if (p < 0.18)      tint = 'rgba(60,45,75,0.28)';    // 朝焼け（紫がかった冷影）
  else if (p < 0.48) tint = 'rgba(20,25,35,0.30)';    // 昼（ほぼ黒）
  else if (p < 0.58) tint = 'rgba(25,22,28,0.32)';    // 昼→夕の入り
  else if (p < 0.70) tint = 'rgba(70,40,30,0.30)';    // 夕焼け（暖色）
  else               tint = 'rgba(40,35,55,0.26)';    // 日暮れ（寒くなる）

  const alpha = 0.22 + 0.18 * elev;

  return { dx, dy, elevation: elev, lengthMult, tint, alpha };
}

/**
 * 夜間の光源補正。0..1 で返し、1 なら「強めに光らせる」。
 * HUD や bloom の調整用に、actor 側から使いたい場合に参照できる。
 */
export function getNightGlowBoost(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  // 0.70..1.00 と 0.00..0.08 で glow を上げる
  if (p >= 0.70 && p < 0.85) return (p - 0.70) / 0.15;    // 夕→夜 ramp up
  if (p >= 0.85 || p < 0.08) return 1;                    // 夜
  if (p < 0.15)              return 1 - (p - 0.08) / 0.07; // 朝 ramp down
  return 0;
}
