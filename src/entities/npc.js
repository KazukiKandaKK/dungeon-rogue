// ─────────────────────────────────────────────
// npc.js  NPCクラス（ランダムウォーク・会話）
// ─────────────────────────────────────────────

import { Actor }   from './actor.js?v=3';
import { TILE }    from '../world/tiles.js?v=11';

// ── NPC タイプ定義 ─────────────────────────────
const NPC_TYPES = {
  traveler: {
    name: '旅人',
    icon: '🧍',
    color: '#3b82f6',
    glowColor: 'rgba(59,130,246,0.7)',
    moveChance: 0.40,
  },
  sage: {
    name: '賢者',
    icon: '🧙',
    color: '#a855f7',
    glowColor: 'rgba(168,85,247,0.8)',
    moveChance: 0.05,
  },
  merchant: {
    name: '商人',
    icon: '🏪',
    color: '#fbbf24',
    glowColor: 'rgba(251,191,36,0.7)',
    moveChance: 0.20,
  },
  ghost: {
    name: '幽霊',
    icon: '👻',
    color: '#e2e8f0',
    glowColor: 'rgba(226,232,240,0.5)',
    moveChance: 0.35,
  },
};

// ── 謎かけリスト（10問以上） ────────────────────
const RIDDLES = [
  {
    q: '私は火があるほど大きくなり、水をかけると消える。何でしょう？',
    choices: ['炎', '影', '穴'], answer: 0, rewardId: 'potion_hp',
  },
  {
    q: '持てば持つほど軽くなるものは何でしょう？',
    choices: ['水', '穴', '羽'], answer: 1, rewardId: 'potion_mp',
  },
  {
    q: '口があるが食べられず、声があるが話せない。何でしょう？',
    choices: ['川', '絵', '石'], answer: 0, rewardId: 'ether_small',
  },
  {
    q: '体の中に骨があり、雨が降るたび強くなるものは？',
    choices: ['木', '傘', '川'], answer: 1, rewardId: 'potion_hp',
  },
  {
    q: '前から読んでも後ろから読んでも同じ言葉は？',
    choices: ['カサ', 'タケヤブヤケタ', 'ソーダ'], answer: 1, rewardId: 'potion_mp',
  },
  {
    q: '触れることもできず、見ることもできないが、誰もが持っているものは？',
    choices: ['夢', '名前', '影'], answer: 1, rewardId: 'ether_small',
  },
  {
    q: '古くなればなるほど若くなるものは何でしょう？',
    choices: ['酒', '木', '石'], answer: 0, rewardId: 'potion_hp',
  },
  {
    q: '高ければ高いほど、人は声を小さくする。何の場所でしょう？',
    choices: ['山', '図書館', '教会'], answer: 1, rewardId: 'potion_mp',
  },
  {
    q: '昼間は2本足、夜は4本足になるものは？',
    choices: ['机', '影', '人間'], answer: 2, rewardId: 'ether_small',
  },
  {
    q: '全てを見ているが目を持たず、全てを聞いているが耳を持たないものは？',
    choices: ['神', '壁', '夜'], answer: 1, rewardId: 'potion_hp',
  },
  {
    q: '死んでいるのに体を持ち、食べるが口を持たない。何でしょう？',
    choices: ['火', '錆', '幽霊'], answer: 0, rewardId: 'potion_mp',
  },
];

// ── フレーバーテキスト ──────────────────────────

const TRAVELER_FLAVORS = [
  '旅は道連れ、世は情けとはよく言ったものだ。',
  'この先の道は細くなっている。慎重に進め。',
  '俺はもう3日眠れていない。何かが追いかけてくるんだ。',
  '水場には近づくな。よくない気配がある。',
  '昔この辺りには賑やかな街があったが、今は廃墟だ。',
  '運がよければ宝が見つかる。運が悪ければ……想像に任せる。',
];

const MERCHANT_FLAVORS = [
  '長く生きた商人は知っている。最も高いものは時間だ。',
  '良い装備は命を救う。ケチるな。',
  '俺は利益のためなら悪魔とも取引する男だ。',
  'このダンジョンで死んだ者の遺品を安く買えるぞ。',
  '信用はゴールドより価値がある。だが、ゴールドの方が使いやすい。',
  '良い客には良い情報を教えてやろう。ゴールドを出せば。',
];

const GHOST_MESSAGES = [
  '血の匂いがする……北へ行くな。',
  '壁に目がある……',
  'あの部屋で死んだ者たちの声が聞こえる……',
  '光の届かぬ場所に、何かが潜んでいる。',
  '足音がする……お前ひとりのはずなのに。',
  '昔ここで眠りについた者は、二度と目を覚まさなかった。',
  '罠は見えないから罠なのだ……気をつけろ。',
  'この空気……何かが違う。おかしい。とてもおかしい。',
  'お前はまだ気づいていない。もうすでに囲まれていることを。',
  '扉の向こうに何があるか、私は知っている。だが教えるべきか迷っている。',
  '夢の中で見た。お前が倒れる場面を。',
  '死者は語らない。だが私は語る。それが呪いだ。',
];

// ── 方角計算ヘルパー ────────────────────────────
function _directionLabel(fromTx, fromTy, toTx, toTy) {
  const dx = toTx - fromTx;
  const dy = toTy - fromTy;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle >= -22.5  && angle <  22.5)  return '東';
  if (angle >=  22.5  && angle <  67.5)  return '南東';
  if (angle >=  67.5  && angle < 112.5)  return '南';
  if (angle >= 112.5  && angle < 157.5)  return '南西';
  if (angle >= 157.5  || angle < -157.5) return '西';
  if (angle >= -157.5 && angle < -112.5) return '北西';
  if (angle >= -112.5 && angle <  -67.5) return '北';
  return '北東';
}

// ── NPC クラス ──────────────────────────────────
export class NPC extends Actor {
  /**
   * @param {number} tx
   * @param {number} ty
   * @param {'traveler'|'sage'|'merchant'|'ghost'} type
   */
  constructor(tx, ty, type = 'traveler') {
    super(tx, ty, 1);
    const cfg     = NPC_TYPES[type] ?? NPC_TYPES.traveler;
    this.type       = type;
    this.name       = cfg.name;
    this.icon       = cfg.icon;
    this.color      = cfg.color;
    this.glowColor  = cfg.glowColor;
    this.moveChance = cfg.moveChance;

    // 賢者用：謎かけをランダムに選んでおく
    this.currentRiddle = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
    this.riddleDone    = false; // 謎かけ済みフラグ
  }

  /**
   * ランダムウォーク（4方向のみ）
   * @param {GameMap} map
   * @param {NPC[]} npcs
   * @param {Player} player
   */
  takeTurn(map, npcs, player) {
    if (Math.random() >= this.moveChance) return;

    const dirs = [
      { dx:  0, dy: -1 },
      { dx:  0, dy:  1 },
      { dx: -1, dy:  0 },
      { dx:  1, dy:  0 },
    ];
    // シャッフル
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    for (const { dx, dy } of dirs) {
      const nx = this.tx + dx;
      const ny = this.ty + dy;
      if (!map.isWalkable(nx, ny)) continue;
      // 通路（CORRIDOR）には入らない（詰まり防止）
      if (map.grid[ny]?.[nx] === TILE.CORRIDOR) continue;
      // プレイヤーがいるタイルには入らない
      if (player && player.tx === nx && player.ty === ny) continue;
      // 他のNPCがいるタイルには入らない
      if (npcs.some(n => n !== this && n.tx === nx && n.ty === ny)) continue;
      this.moveTo(nx, ny);
      break;
    }
  }

  /**
   * コンテキスト依存の台詞を返す
   * @param {GameMap} map
   * @param {Player} player
   * @param {number} floorNumber
   * @param {{tx:number,ty:number}|null} stairs
   * @returns {{ lines: string[], type: 'normal'|'riddle'|'warn' }}
   */
  getDialogue(map, player, floorNumber, stairs) {
    switch (this.type) {
      case 'traveler':  return this._travelerDialogue(map, player, floorNumber, stairs);
      case 'sage':      return this._sageDialogue(map, player, floorNumber, stairs);
      case 'merchant':  return this._merchantDialogue(map, player, floorNumber, stairs);
      case 'ghost':     return this._ghostDialogue(map, player, floorNumber, stairs);
      default:          return { lines: ['…'], type: 'normal' };
    }
  }

  // ── 旅人の台詞 ──────────────────────────────
  _travelerDialogue(map, player, floorNumber, stairs) {
    const lines = [];

    // 階段の方角
    if (stairs) {
      const dir = _directionLabel(player.tx, player.ty, stairs.tx, stairs.ty);
      lines.push(`階段は${dir}の方角にある。`);
    }

    // 深さに応じたコメント
    if (floorNumber >= 10) {
      lines.push('この深さまで来るとは……なかなかの手練れだな。気をつけろ。');
    } else if (floorNumber >= 5) {
      lines.push('ここから先は手強い敵が増える。備えは十分か？');
    }

    // モンスターハウス
    if (map.monsterHouseRoom) {
      lines.push('どこかに化け物の巣がある。近づくな、無謀だ。');
    }

    // フレーバー（ランダムに1つ追加）
    if (lines.length < 3) {
      lines.push(TRAVELER_FLAVORS[Math.floor(Math.random() * TRAVELER_FLAVORS.length)]);
    }

    return { lines, type: 'normal' };
  }

  // ── 賢者の台詞 ──────────────────────────────
  _sageDialogue(map, player, floorNumber, stairs) {
    if (!this.riddleDone) {
      const r = this.currentRiddle;
      return {
        lines: [
          '旅人よ、知恵を試してみよう。',
          r.q,
        ],
        type: 'riddle',
      };
    }
    // 謎かけ済みの場合は通常台詞
    return {
      lines: [
        '真の知恵は経験から生まれる。',
        'また問いかけるときが来れば、答えてやろう。',
      ],
      type: 'normal',
    };
  }

  // ── 商人の台詞 ──────────────────────────────
  _merchantDialogue(map, player, floorNumber, stairs) {
    const lines = [];

    // 所持金に応じたアドバイス
    if (player.gold >= 100) {
      lines.push(`${player.gold}G も持っているのか。金があるなら使い時を選べ。`);
    } else if (player.gold <= 10) {
      lines.push('懐が寂しいな。敵を倒して稼ぐしかない。');
    }

    // 装備状況
    if (!player.equip?.weapon) {
      lines.push('丸腰か？せめて何か武器を拾え。死にたくなければな。');
    } else if (!player.equip?.chest) {
      lines.push('武器はあるが鎧がないのか。攻めるだけが戦いではないぞ。');
    }

    // フレーバー
    if (lines.length < 2) {
      lines.push(MERCHANT_FLAVORS[Math.floor(Math.random() * MERCHANT_FLAVORS.length)]);
    }

    // 階数ヒント
    if (floorNumber >= 3 && !player.equip?.accessory) {
      lines.push('このフロアには装飾品が落ちていることがある。探してみろ。');
    }

    return { lines, type: 'normal' };
  }

  // ── 幽霊の台詞 ──────────────────────────────
  _ghostDialogue(map, player, floorNumber, stairs) {
    // ランダムに2〜3個選ぶ
    const shuffled = [...GHOST_MESSAGES].sort(() => Math.random() - 0.5);
    const lines = shuffled.slice(0, 2 + Math.floor(Math.random() * 2));
    return { lines, type: 'warn' };
  }
}
