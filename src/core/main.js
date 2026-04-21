// ─────────────────────────────────────────────
// main.js  ターン制ゲームループ（装備・パラメータ対応）
// ─────────────────────────────────────────────

import { TILE_SIZE, THEMES, TILE } from '../world/tiles.js?v=11';
import { GameMap }        from '../world/map.js?v=24';
import { DUNGEONS, BOSS_RUSH_NAMES } from '../world/dungeon_defs.js';
import { Player }         from '../entities/player.js?v=7';
import { Enemy, getBossName } from '../entities/enemy.js?v=10';
import { InputManager }        from './input.js';
import { ParticleSystem }      from './particle.js';
import { SpriteLoader }        from './sprites.js';
import { Logger }              from './logger.js?v=2';
import { initAstar }           from '../world/astar.js';
import { ITEMS, itemStatText, treasureDrop, chestDrop, SHOP_CATALOG, mysteryStartItems } from '../data/equipment.js?v=4';
import { GENERATED_ICONS } from '../data/icon_sprites.js';
import { SPELLS, resolveSpell }        from '../data/magic.js';
import { CLASSES, CLASS_IDS } from '../data/classes.js';
import {
  CANVAS_W, CANVAS_H, MAP_COLS, MAP_ROWS, ENEMY_COUNT, MIN_SPAWN_DIST,
  ITEM_PER_FLOOR, SAVE_SLOT_KEYS,
  BASE_COLS, BASE_ROWS, BASE_SPAWN, BASE_CHEST_POS, BASE_PORTALS,
  BASE_SHOP_POS, BASE_CASINO_POS, BASE_STALL_POS, BASE_LOAN_POS, BASE_RECLASS_POS, BASE_SHRINE_POS,
  BASE_CRAFT_POS, BASE_QUEST_POS, BASE_RECEPTION_POS,
  BASE_TAVERN_POS, BASE_TRADER_POS,
  RECLASS_COST_PER_LV, RECLASS_COST_MIN,
  BUILDS, BUILD_IDS,
  LOAN_AMOUNTS, REPAY_AMOUNTS, LOAN_INTEREST, LOAN_QUEST_FLOORS,
  RL_RED,
  VISION_RADIUS,
  WAVE_INTERVAL, SHINIGAMI_WARN1, SHINIGAMI_WARN2, SHINIGAMI_WARN3,
  SHINIGAMI_SPAWN, SHINIGAMI_RESPAWN,
  SLOTS, SLOT_LABEL, INV_COLS,
  FADE_OUT_SPEED, FADE_IN_SPEED,
} from './game-constants.js';
import { drawItemSvg } from '../ui/item-renderer.js';
import { lightenColor as _lightenC, darkenColor as _darkenC, hexRgb as _hexRgb } from './colors.js';
import { getSlotData, hasAnySave, formatSavedAt } from '../systems/saves.js';
import { applyMetaUpgrades, addSouls, calcSoulsReward, getSouls, META_UPGRADES, getUpgrades, purchaseUpgrade } from '../systems/meta.js';
import { todayKey, dailySeedFor, installSeededRandom, restoreRandom, recordDailyResult } from '../systems/daily.js';
import { Pet, PETS, PET_KINDS } from '../entities/pet.js';
import { BaseNpc } from '../entities/base-npc.js';
import { tickChatTicker, toggleChat, pushPlayerEvent } from '../systems/chat-ticker.js';
import { drawChatTicker } from '../ui/chat-ticker.js';
import {
  getDailyQuests, reportKill as _questReportKill,
  reportFloorReached as _questReportFloor,
  claimQuest as _questClaim, isComplete as _questIsComplete,
  activeCount as _questActiveCount, completedClaimableCount as _questClaimableCount,
} from '../systems/quests.js';
import { drawQuestBoard } from '../ui/quests.js';
import { getDailyRanking } from '../systems/ranking.js';
import { drawRanking } from '../ui/ranking.js';
import { drawServerInfo } from '../ui/server-info.js';
import { drawTitleMenu } from '../ui/titles.js';
import { getActiveEvent, soulsMul as _weSoulsMul } from '../systems/world-events.js';
import {
  reportKill as _titleReportKill, reportFloor as _titleReportFloor,
  reportSoulsEarned as _titleReportSouls, getActiveTitle as _titleActive,
  getUnlockedTitles as _titleUnlocked, setActiveTitle as _titleSet,
  TITLES as _TITLES,
} from '../systems/titles.js';
import { attack as _attackFn }                                       from '../systems/combat.js';
import { hasLOS, isActorOnLine }                                      from '../systems/fov.js';
import { tickTransition }                                             from '../systems/transitions.js';
import { drawHUD, drawBossHPBar, drawMinimap, drawFloatingTexts, drawHotbar } from '../ui/hud.js';
import { drawMagicMenu, drawShopMenu, drawInventory } from '../ui/inventory.js';
import { tickWaveSpawn } from '../systems/wave-spawn.js';
import { drawCasino, drawLoan } from '../ui/casino.js';
import { drawStall, drawBaseChest, drawBaseShop } from '../ui/base.js';
import { drawReclassMenu } from '../ui/reclass.js';
import { drawCraftMenu, listWeapons as _craftListWeapons } from '../ui/craft.js';
import { canCraft as _craftCan, craftCost as _craftCost, combineWeapons as _craftCombine } from '../systems/craft.js';
import { drawTitle, drawSaveSlot, drawClassSelect, drawBuildSelect, drawGameOver, drawCharCreate } from '../ui/title.js';
import { APPEARANCES, APPEARANCE_IDS, TINTS } from '../data/appearances.js';
import { drawAttackPreview, drawEnemyRanges, drawFloorItems, drawChests, drawInfiniteEscapePrompt } from '../ui/dungeon.js';
import { drawBaseObjects } from '../ui/base-objects.js';
import { getFloorTheme, spawnEnemies, placeFloorItems, placeChests, placeShop, assignTrapTypes, buildBaseShopItems } from '../systems/floor.js';
import { bjNewDeck as _bjNewDeck, bjHandValue as _bjHandValue, bjFinish, bjDeal, bjDealerPlay, rlFinish, ccFinish, ccRoll as _ccRoll, ccEval as _ccEval, ccCompare as _ccCompare, ccRankLabel as _ccRankLabel } from '../systems/casino-logic.js';
import { doEnemyTurn, processEnemyDeathTraits } from '../systems/enemy-ai.js';
import { processTurn as _processTurnFn, castPlayerSpell as _castPlayerSpellFn, processTurnAfterCast as _processTurnAfterCastFn } from '../systems/player-actions.js';
import { updateMagicEffects, drawMagicEffects } from './magic-vfx.js';

// ── ゲーム状態 ─────────────────────────────────
let map, player, enemies, input, particles, sprites, logger;
let gameState     = 'LOADING';
let gameOverTimer = 0;
let turnCount     = 0;
let titleCursor    = 0;      // 0=はじめから, 1=続きから
let saveSlotCursor = 0;      // 0-2
let saveSlotMode   = 'load'; // 'load' | 'save'
let saveSlotFrom   = 'TITLE'; // 戻り先のgameState
let floorNumber       = 1;
let isMonsterHouseFloor = false; // 現フロアがMHかどうか
let clearedDungeons   = new Set(); // クリア済みダンジョンID
let infiniteEscapePrompt = false;  // 無限ダンジョン脱出確認UI
let infiniteEscapeCursor = 0;      // 0=続ける 1=脱出

// 拠点・ダンジョン管理（拠点とダンジョン区は同一フィールド）
let gamePhase      = 'BASE';  // 'BASE' | 'DUNGEON'
let currentDungeon = null;    // DUNGEONS[i] | null
let baseChest      = [];      // 預かりアイテム
let baseChestOpen  = false;
let baseChestSide  = 'chest'; // 'chest' | 'inventory'
let baseCursor     = 0;

// キャラクリ（見た目）
let charSpeciesCursor = 0;
let charTintCursor    = 0;
let charFocusGroup    = 'species'; // 'species' | 'tint'
let charPetCursor     = 0;         // 0=なし, 1..=PET_KINDS
let playerPetKind     = null;      // 選択されたペット種類（'slime'|'mush'|'rock'）|null
let pet               = null;      // 現在の Pet インスタンス
let baseNpcs          = [];        // 拠点を歩く冒険者NPC（BaseNpc[]）
let lastWorldEventId  = null;      // ワールドイベント切替検知用
let playerAppearance  = null;      // { species, tint } | null

// 職業選択
let playerClass  = 'warrior';
let classCursor  = 0;

// ビルド（パラメータ重視）選択
let playerBuild  = 'balanced';
let buildCursor  = 0;

// 矢（飛翔アニメ）
let arrows = []; // {wx,wy,twx,twy,progress,color}

// AOEフラッシュ（範囲攻撃視覚）
let aoeFlash = []; // [{tx,ty,alpha,color}]

// 魔法エフェクト（メテオ/ファイアボール等の派手VFX）
let magicEffects = []; // MagicEffect[]
const MAX_MAGIC_EFFECTS = 6;
function spawnMagicVfx(type, params, life = 0.7) {
  // 上限を超えたら古いものから捨てる（描画負荷の上限を保証）
  if (magicEffects.length >= MAX_MAGIC_EFFECTS) {
    magicEffects.splice(0, magicEffects.length - MAX_MAGIC_EFFECTS + 1);
  }
  magicEffects.push({ type, age: 0, life, params });
}

// ── ビネット用キャッシュ（サイズ変わるまで再生成しない）────────
let _vignetteCache = null;
function drawVignette(ctx, W, H) {
  if (!_vignetteCache || _vignetteCache.w !== W || _vignetteCache.h !== H) {
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const oc = off.getContext('2d');
    const g = oc.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0,   'rgba(0,0,0,0)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.25)');
    g.addColorStop(1,   'rgba(0,0,0,0.6)');
    oc.fillStyle = g;
    oc.fillRect(0, 0, W, H);
    _vignetteCache = { w: W, h: H, canvas: off };
  }
  ctx.drawImage(_vignetteCache.canvas, 0, 0);
}

// フロアアイテム（地面に落ちているアイテム）
let floorItems  = []; // [{tx, ty, item}]
// 宝箱
let floorChests = []; // [{tx, ty, opened: bool}]

// ダンジョン露店
let shopOpen    = false;
let shopCursor  = 0;
let shopItems   = []; // [{itemId, price, item}]
let shopPos     = null; // {tx, ty} | null
// 拠点委託露店
let stallOpen   = false;
let stallCursor = 0;
let stallItems  = []; // [{item, price}] 預かり中アイテム

// 拠点 転職サービス
let reclassOpen   = false;
let reclassCursor = 0;

// 拠点 クラフト屋（鍛冶）
let craftOpen  = false;
let craftCurA  = 0;
let craftCurB  = 0;
let craftSide  = 'A'; // 'A' | 'B'

// 不思議ダンジョン
let mysteryMode = false;
let dailyMode    = false;     // デイリー挑戦中
let dailyDateKey = '';        // YYYYMMDD

// ── 魂の祠（メタ進行） ──────────────────────────
let shrineOpen   = false;
let shrineCursor = 0;

// ── クエスト掲示板（デイリー依頼） ───────────────
let questOpen   = false;
let questCursor = 0;

// ── ランキング掲示板（ギルド受付） ───────────────
let rankingOpen   = false;
let rankingCursor = 0;

// ── 称号メニュー（Y キー） ──────────────────────
let titleMenuOpen   = false;
let titleMenuCursor = 0;

// ── 拠点ショップ ───────────────────────────────
let baseShopOpen   = false;
let baseShopCursor = 0;
let baseShopItems  = []; // {itemId, price, item, tier}[]

// ── 金貸し ─────────────────────────────────────
let loanDebt        = 0;      // 現在の借金残高
let loanOpen        = false;
let loanCursor      = 0;      // 借入額選択カーソル
let loanRepayMode   = false;  // 返済額選択モード
let loanRepayCursor = 0;      // 返済額カーソル
let loanQuestActive = false;  // 宝探し依頼中

// ── カジノ ─────────────────────────────────────
let casinoOpen    = false;
let casinoMode    = 'select'; // 'select'|'bj'|'roulette'|'chinchiro'|'slot'
let casinoCursor  = 0;        // 0=BJ 1=ルーレット 2=チンチロ 3=スロット（選択画面）
// ブラックジャック
let bjPhase       = 'bet';   // 'bet'|'play'|'result'
let bjBet         = 10;
let bjDeck        = [];
let bjHand        = [];      // {rank,suit,value}[]
let bjDealerHand  = [];
let bjResult      = '';      // 'win'|'lose'|'push'|'blackjack'
let bjMsg         = '';
// ルーレット
let rlPhase       = 'bet';   // 'bet'|'spin'|'result'
let rlBet         = 10;
let rlBetType     = 'red';   // 'red'|'black'|'odd'|'even'|'low'|'high'|'number'
let rlNumber      = 7;       // straight bet用の数字
let rlResult      = 0;       // 当選番号
let rlSpinAngle   = 0;       // ホイール回転アングル（rad）
let rlSpinSpeed   = 0;       // 現在の回転速度
let rlMsg         = '';
let rlSpinTimer   = 0;       // スピン演出タイマー
// チンチロ
let ccPhase        = 'bet';  // 'bet'|'player_roll'|'dealer_roll'|'result'
let ccBet          = 10;
let ccPlayerDice   = [1,1,1];
let ccDealerDice   = [1,1,1];
let ccPlayerRolls  = 0;      // 振った回数（最大3回）
let ccMsg          = '';
let ccWin          = null;   // true|false|null(push)
let ccPlayerRollAnim = 0;    // プレイヤーのサイコロ演出残時間（秒）
let ccDealerRollAnim = 0;    // ディーラーのサイコロ演出残時間（秒）

// スロット
let slPhase        = 'bet';  // 'bet'|'spin'|'result'
let slBet          = 10;
let slReels        = [0, 0, 0];      // 確定シンボルインデックス
let slReelOffsets  = [0, 0, 0];      // スピン中の縦スクロール量（ピクセル）
let slReelStopped  = [true, true, true];
let slReelStopAt   = [0, 0, 0];      // リール停止予定時刻（rAF相対秒）
let slSpinTimer    = 0;              // スピン経過秒
let slWin          = false;
let slPayout       = 0;
let slMsg          = '';

// 装備画面
let showInventory = false;
let invCursor     = 0; // 0 = equipment slots, 1+ = inventory index

// 魔法メニュー
let showMagic   = false;
let magicCursor = 0;

// ホットバー（MMOスキルバー：1〜6キー）
let hotbar = [null, null, null, null, null, null]; // スペルID or null

// カメラ
let camOffX = CANVAS_W / 2;
let camOffY = CANVAS_H / 2;

// 探索済みタイル（ミニマップ用）
let exploredTiles = new Set(); // "tx,ty" 形式

// 画面フラッシュ
let flashAlpha = 0;
let flashColor = '#ffffff';

// スクリーンシェイク
let shakeIntensity = 0;
let shakeDuration  = 0;
let shakeX = 0, shakeY = 0;
function triggerShake(intensity = 8, duration = 0.25) {
  shakeIntensity = Math.max(shakeIntensity, intensity);
  shakeDuration  = Math.max(shakeDuration, duration);
}

// ヒットストップ
let hitStopRemaining = 0;
function triggerHitStop(seconds = 0.06) {
  hitStopRemaining = Math.max(hitStopRemaining, seconds);
}

// フローティングテキスト（レベルアップ通知など）
let floatingTexts = []; // [{text, x, y, alpha, scale, color, life, maxLife}]

// ── 埃（ダスト）モート：プレイヤー周辺に浮遊 ─────────────
// { x, y, vx, vy, life, maxLife, size }
let dustMotes = [];
const MAX_DUST = 24;
let _dustAccum = 0;
function _updateDust(dt) {
  _dustAccum += dt;
  // 0.25 秒毎に 1 粒追加（最大 MAX_DUST）
  while (_dustAccum > 0.25) {
    _dustAccum -= 0.25;
    if (dustMotes.length < MAX_DUST && player) {
      const r = Math.random() * Math.PI * 2;
      const d = Math.random() * TILE_SIZE * 3.5 + TILE_SIZE * 0.5;
      const x = player.renderX + Math.cos(r) * d;
      const y = player.renderY + Math.sin(r) * d * 0.6;
      const life = 3 + Math.random() * 3;
      dustMotes.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: -4 - Math.random() * 6,
        life, maxLife: life,
        size: 0.8 + Math.random() * 1.2,
      });
    }
  }
  for (const m of dustMotes) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.life -= dt;
  }
  dustMotes = dustMotes.filter(m => m.life > 0);
}
function _drawDust(ctx) {
  if (dustMotes.length === 0) return;
  ctx.save();
  ctx.fillStyle = 'rgba(220,200,160,1)';
  for (const m of dustMotes) {
    const t = m.life / m.maxLife;
    ctx.globalAlpha = 0.28 * t;
    const sx = m.x + camOffX;
    const sy = m.y + camOffY;
    ctx.beginPath();
    ctx.arc(sx, sy, m.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}


// 画面遷移
let transAlpha = 0;
let transDir   = null;
let transPhase = 'none';

// ── 初期化 ────────────────────────────────────
async function init(canvas, logEl) {
  sprites   = new SpriteLoader();
  particles = new ParticleSystem();
  input     = new InputManager();
  logger    = new Logger(logEl);

  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;

  await Promise.all([
    sprites.loadAll([
      ['player_front',      'assets/player_front.svg?v=1'],
      ['player_back',       'assets/player_back.svg?v=1'],
      ['player_side',       'assets/player_side.svg?v=1'],
      ['slime',             'assets/slime.svg?v=6'],
      ['goblin',            'assets/goblin.svg?v=6'],
      ['boss',              'assets/boss.svg?v=1'],
      // ── 通常ダンジョンのボス専用スプライト ──
      ['giant_slime',       'assets/giant_slime.svg?v=1'],
      ['goblin_king',       'assets/goblin_king.svg?v=1'],
      ['cursed_treant',     'assets/cursed_treant.svg?v=1'],
      ['abyss_demon',       'assets/abyss_demon.svg?v=1'],
      ['abyss_warden',      'assets/abyss_warden.svg?v=1'],
      // ── 十二星座ボス ──
      ['zodiac_aries',       'assets/zodiac_aries.svg?v=2'],
      ['zodiac_taurus',      'assets/zodiac_taurus.svg?v=2'],
      ['zodiac_gemini',      'assets/zodiac_gemini.svg?v=2'],
      ['zodiac_cancer',      'assets/zodiac_cancer.svg?v=2'],
      ['zodiac_leo',         'assets/zodiac_leo.svg?v=2'],
      ['zodiac_virgo',       'assets/zodiac_virgo.svg?v=2'],
      ['zodiac_libra',       'assets/zodiac_libra.svg?v=2'],
      ['zodiac_scorpio',     'assets/zodiac_scorpio.svg?v=2'],
      ['zodiac_sagittarius', 'assets/zodiac_sagittarius.svg?v=2'],
      ['zodiac_capricorn',   'assets/zodiac_capricorn.svg?v=2'],
      ['zodiac_aquarius',    'assets/zodiac_aquarius.svg?v=2'],
      ['zodiac_pisces',      'assets/zodiac_pisces.svg?v=2'],
      ['archer',            'assets/archer.svg?v=1'],
      ['wizard',            'assets/wizard.svg?v=1'],
      ['bat',               'assets/bat.svg?v=1'],
      ['giant_bat',         'assets/giant_bat.svg?v=1'],
      ['cave_spider',       'assets/cave_spider.svg?v=1'],
      ['poison_spider',     'assets/poison_spider.svg?v=1'],
      ['giant_scorpion',    'assets/giant_scorpion.svg?v=1'],
      ['skeleton',          'assets/skeleton.svg?v=1'],
      ['zombie',            'assets/zombie.svg?v=1'],
      ['ghost',             'assets/ghost.svg?v=1'],
      ['wraith',            'assets/wraith.svg?v=1'],
      ['giant_rat',         'assets/giant_rat.svg?v=1'],
      ['wolf',              'assets/wolf.svg?v=1'],
      ['dire_wolf',         'assets/dire_wolf.svg?v=1'],
      ['werewolf',          'assets/werewolf.svg?v=1'],
      ['berserker',         'assets/berserker.svg?v=1'],
      ['shadow_assassin',   'assets/shadow_assassin.svg?v=2'],
      ['rock_crab',         'assets/rock_crab.svg?v=1'],
      ['stone_golem',       'assets/stone_golem.svg?v=1'],
      ['iron_golem',        'assets/iron_golem.svg?v=1'],
      ['treant',            'assets/treant.svg?v=1'],
      ['gargoyle',          'assets/gargoyle.svg?v=1'],
      ['fire_elemental',    'assets/fire_elemental.svg?v=1'],
      ['ice_elemental',     'assets/ice_elemental.svg?v=1'],
      ['thunder_elemental', 'assets/thunder_elemental.svg?v=1'],
      ['void_crawler',      'assets/void_crawler.svg?v=1'],
      ['vampire',           'assets/vampire.svg?v=1'],
      ['soul_eater',        'assets/soul_eater.svg?v=1'],
      ['void_stalker',      'assets/void_stalker.svg?v=1'],
      ['nightmare',         'assets/nightmare.svg?v=1'],
      ['mimic',             'assets/mimic.svg?v=1'],
      ['chest',             'assets/chest.svg?v=1'],
      ['chest_open',        'assets/chest_open.svg?v=1'],
      ['debt_collector',    'assets/debt_collector.svg?v=1'],
      // ── 生成武器SVG（scripts/gen_weapons.mjs 由来） ──
      ...Object.values(ITEMS)
        .filter(it => it.spriteName && it.spriteName.startsWith('weapon_'))
        .map(it => [it.spriteName, `assets/weapons/${it.id}.svg?v=1`]),
      // ── 生成アイコンSVG（scripts/gen_icons.mjs 由来） ──
      ...GENERATED_ICONS.map(ic => [ic.spriteName, `${ic.url}?v=1`]),
    ]).catch(e => console.warn('スプライトロード失敗:', e)),
    initAstar(),
  ]);

  gameState = 'TITLE';
}

// ── 新規ゲーム ─────────────────────────────────
function _newGame() {
  gameState   = 'TITLE';
  classCursor = 0;
}

function _startGame(classId, buildId) {
  playerClass   = classId;
  playerBuild   = buildId;
  floorNumber   = 1;
  turnCount     = 0;
  player        = null;
  enemies       = [];
  showInventory = false;
  showMagic     = false;
  hotbar        = [null, null, null, null, null, null];
  _buildBase();
  logger.clear();
  // 不思議ダンジョン: ランダム初期装備
  if (mysteryMode && player) {
    const startItems = mysteryStartItems();
    for (const item of startItems) {
      if (item.slot !== 'consumable') {
        player.equipItem(item); // 武器・鎧は即装備
      } else {
        player.addToInventory(item);
      }
    }
    player.gold = 10 + Math.floor(Math.random() * 20);
    logger.add('✨ 不思議ダンジョン: ランダム初期装備を獲得！', 'warn');
  }
  const cls   = CLASSES[classId];
  const build = BUILDS[buildId];
  logger.add(`【${cls.name}】×【${build.name}】でダンジョンに挑む！`, 'warn');
}

function _buildBase() {
  gamePhase      = 'BASE';
  currentDungeon = null;
  floorNumber    = 1;
  turnCount      = 0;
  map = new GameMap(BASE_COLS, BASE_ROWS, 'base', false);
  particles.clear();
  dustMotes     = [];
  floorItems    = [];
  enemies       = [];
  shopOpen      = false;
  shopPos       = null;
  baseChestOpen = false;
  baseShopOpen  = false;
  casinoOpen      = false;
  casinoMode      = 'select';
  slPhase         = 'bet';
  slReelStopped   = [true, true, true];
  ccPlayerRollAnim = 0;
  ccDealerRollAnim = 0;
  loanOpen        = false;
  loanRepayMode   = false;
  reclassOpen     = false;
  craftOpen       = false;
  craftCurA       = 0;
  craftCurB       = 0;
  craftSide       = 'A';
  baseShopItems = buildBaseShopItems();
  _placePlayer(BASE_SPAWN.tx, BASE_SPAWN.ty);

  // 拠点NPC（冒険者風）を配置 — 統合フィールドは広いので 7〜10 体
  baseNpcs = _spawnBaseNpcs(7 + Math.floor(Math.random() * 4));

  // 拠点は全タイル探索済みにする
  exploredTiles = new Set();
  for (let ty = 0; ty < BASE_ROWS; ty++)
    for (let tx = 0; tx < BASE_COLS; tx++)
      exploredTiles.add(`${tx},${ty}`);

  gameState = 'PLAYER_TURN';
  logger.add('🏠 王都アストラルに帰還。北のダンジョン門から出撃できる。', 'warn');
}


function _buildFloor(entryDir) {
  const maxFloors   = currentDungeon?.maxFloors ?? 99;
  // 無限ダンジョン：10フロアごとにボス戦
  const isBossFloor = currentDungeon?.bossRush
    || (currentDungeon?.infinite ? floorNumber % 10 === 0 : floorNumber === maxFloors);
  // モンスターハウス確率：無限ダンジョンは高頻度（70%）、それ以外は控えめ（5%）
  const mhChance = currentDungeon?.infinite ? 0.70 : 0.05;
  isMonsterHouseFloor = !isBossFloor && Math.random() < mhChance;
  const theme = getFloorTheme(floorNumber, currentDungeon);
  const trapDensity = currentDungeon?.infinite ? 6 : 1;
  map = new GameMap(MAP_COLS, MAP_ROWS, theme, isBossFloor, trapDensity);


  particles.clear();
  floorItems    = [];
  floorChests   = [];
  dustMotes     = [];
  exploredTiles = new Set();

  // スポーン：常にマップ内の歩行可能タイルにランダム配置
  const { tx, ty } = map.findSpawnTile();
  _placePlayer(tx, ty);

  _updateExplored(); // 初期位置の視野を登録
  enemies = spawnEnemies({ currentDungeon, floorNumber, isMonsterHouseFloor, map, player });

  // 無限ダンジョン：フロア数に応じて敵をスケール
  if (currentDungeon?.infinite && floorNumber > 1) {
    const scaleMult = 1 + (floorNumber - 1) * 0.08; // 8%/フロア増加
    for (const e of enemies) {
      e.maxHP = Math.ceil(e.maxHP * scaleMult);
      e.hp    = e.maxHP;
      e.atk   = Math.ceil(e.atk * scaleMult);
      e.def   = Math.ceil(e.def * scaleMult * 0.5);
    }
  }

  floorItems = placeFloorItems({ map, floorNumber });
  const shopResult = placeShop({ map, floorNumber, player });
  shopPos   = shopResult.shopPos;
  shopItems = shopResult.shopItems;
  floorChests = placeChests({ map, floorNumber, player, existingItems: floorItems });
  assignTrapTypes(map, currentDungeon);
  shopOpen = false;
  gameState = 'PLAYER_TURN';

  // 借金利息（2階以降）＋借金取りスポーン
  if (loanDebt > 0 && floorNumber > 1) {
    const interest = Math.floor(loanDebt * LOAN_INTEREST);
    loanDebt += interest;
    logger.add(`💸 利息 +${interest}G 発生。残債: ${loanDebt}G`, 'warn');
  }
  if (loanDebt > 0) _spawnDebtCollectors();

  // モンスターハウス通知
  if (isMonsterHouseFloor) {
    logger.add('🏠 モンスターハウス！ 大量の敵が潜んでいる…', 'warn');
    floatingTexts.push({
      text: '🏠 MONSTER HOUSE!', x: CANVAS_W / 2, y: CANVAS_H / 2 - 60,
      alpha: 1, scale: 1, color: '#ef4444', life: 3.5, maxLife: 3.5, big: true,
    });
  }

  // テーマ移行通知（ダンジョンモードのみ）
  if (!currentDungeon && floorNumber > 1 && !isBossFloor) {
    const themeLabel = THEMES[theme]?.label ?? theme;
    const prevTheme  = getFloorTheme(floorNumber - 1, currentDungeon);
    if (theme !== prevTheme) {
      const emoji = theme === 'forest' ? '🌲' : '🏚️';
      logger.add(`${emoji} ${floorNumber}層 ― ${themeLabel}エリアに入った`, 'warn');
      floatingTexts.push({
        text: `${emoji} ${themeLabel}`, x: CANVAS_W / 2, y: CANVAS_H / 2 - 60,
        alpha: 1, scale: 1, color: '#86efac', life: 2.5, maxLife: 2.5, big: true,
      });
    }
  }

  // ボス階の通知
  if (isBossFloor) {
    const bossName = currentDungeon?.bossName ?? getBossName(floorNumber);
    logger.add(`💀 ${floorNumber}層 ― 「${bossName}」が現れた！`, 'warn');
    floatingTexts.push({
      text: `BOSS: ${bossName}`, x: CANVAS_W / 2, y: CANVAS_H / 2 - 80,
      alpha: 1, scale: 1, color: '#f87171', life: 3.0, maxLife: 3.0, big: true,
    });
  }
}

function _placePlayer(tx, ty) {
  if (!player) {
    player = new Player(tx, ty, playerClass, BUILDS[playerBuild]?.bonus ?? null, playerAppearance);
    // メタ進行：恒久強化 + 開始時アイテム
    const meta = applyMetaUpgrades(player);
    for (let i = 0; i < meta.starterPotions; i++) {
      player.addToInventory({ ...ITEMS['herb'] });
    }
  } else {
    player.tx      = tx;
    player.ty      = ty;
    player.renderX = (tx + 0.5) * TILE_SIZE;
    player.renderY = (ty + 0.5) * TILE_SIZE;
    player.bumpX   = 0;
    player.bumpY   = 0;
    player.alive   = true; // 死亡状態のままにならないようリセット
    // 拠点/前線街は全回復、ダンジョン内のフロア移動時は少し回復
    if (gamePhase === 'BASE') {
      player.hp = player.maxHP;
    } else {
      player.hp = Math.min(player.hp + 2, player.maxHP);
    }
  }
  // ペット同行：プレイヤーの隣のマスへ召喚（毎フロア / 拠点帰還時）
  _spawnOrMovePet();
}

// 現在のワールドイベントを監視し、切り替わったらチャットに流す。
function _tickWorldEvent() {
  const evt = getActiveEvent();
  if (lastWorldEventId === null) {
    lastWorldEventId = evt.id;
    return; // 初回は通知しない
  }
  if (evt.id !== lastWorldEventId) {
    lastWorldEventId = evt.id;
    if (logger) logger.add(`🌐 ワールドイベント『${evt.name}』が始まった！（${evt.hint}）`, 'warn');
    pushPlayerEvent(`『${evt.name}』開始！`, 'achieve');
  }
}

// 拠点に置かれている設備タイル（NPCが上に乗らないように予約）
function _baseReservedTiles() {
  const list = [
    BASE_SPAWN, BASE_CHEST_POS, BASE_SHOP_POS, BASE_CASINO_POS,
    BASE_STALL_POS, BASE_LOAN_POS, BASE_RECLASS_POS, BASE_SHRINE_POS,
    BASE_CRAFT_POS, BASE_QUEST_POS, BASE_RECEPTION_POS,
    BASE_TAVERN_POS, BASE_TRADER_POS,
  ];
  for (const p of BASE_PORTALS) list.push({ tx: p.tx, ty: p.ty });
  return list;
}

function _spawnBaseNpcs(count) {
  const npcs = [];
  if (!map) return npcs;
  const reserved = _baseReservedTiles();
  const occupied = new Set(reserved.map(p => `${p.tx},${p.ty}`));
  if (player) occupied.add(`${player.tx},${player.ty}`);
  let tries = 0;
  while (npcs.length < count && tries < 200) {
    tries++;
    const tx = Math.floor(Math.random() * BASE_COLS);
    const ty = Math.floor(Math.random() * BASE_ROWS);
    if (!map.isWalkable(tx, ty)) continue;
    const key = `${tx},${ty}`;
    if (occupied.has(key)) continue;
    // プレイヤーの初期スポーン半径3以内には湧かせない
    if (Math.abs(tx - BASE_SPAWN.tx) + Math.abs(ty - BASE_SPAWN.ty) < 3) continue;
    occupied.add(key);
    npcs.push(new BaseNpc(tx, ty));
  }
  return npcs;
}

function _doPetTurn() {
  if (!pet || !pet.alive || !player || !map || gamePhase !== 'DUNGEON') return;
  pet.takeTurn(
    map,
    player,
    enemies,
    (tx, ty) => {
      if (player.tx === tx && player.ty === ty) return true;
      return enemies.some(e => e.alive && e.tx === tx && e.ty === ty);
    },
    (target, dmg) => {
      const sx = (target.tx + 0.5) * TILE_SIZE + camOffX;
      const sy = (target.ty + 0.5) * TILE_SIZE + camOffY;
      floatingTexts.push({
        text: `🐾${dmg}`, x: sx, y: sy - 30,
        alpha: 1, scale: 1, color: '#86efac', life: 1.0, maxLife: 1.0,
      });
      particles.burst(sx, sy, '#86efac', 8);
      logger.add(`🐾 ${pet.def.name}が ${target.name ?? '敵'}に ${dmg} ダメージ`, 'info');
    },
  );
}

function _spawnOrMovePet() {
  if (!playerPetKind || !player || !map) { return; }
  const candidates = [
    [player.tx - 1, player.ty],
    [player.tx + 1, player.ty],
    [player.tx, player.ty - 1],
    [player.tx, player.ty + 1],
    [player.tx - 1, player.ty - 1],
    [player.tx + 1, player.ty + 1],
    [player.tx - 1, player.ty + 1],
    [player.tx + 1, player.ty - 1],
  ];
  let spot = null;
  for (const [cx, cy] of candidates) {
    if (cx < 0 || cy < 0 || cx >= map.cols || cy >= map.rows) continue;
    if (!map.isWalkable(cx, cy)) continue;
    if (enemies.some(e => e.alive && e.tx === cx && e.ty === cy)) continue;
    spot = [cx, cy]; break;
  }
  if (!spot) spot = [player.tx, player.ty];
  if (!pet || pet.kind !== playerPetKind) {
    pet = new Pet(playerPetKind, spot[0], spot[1]);
  } else {
    pet.fromTx = pet.tx;
    pet.fromTy = pet.ty;
    pet.tx = spot[0];
    pet.ty = spot[1];
    pet.moveT = 1;
    pet.alive = true;
    if (pet.hp < pet.maxHp) pet.hp = pet.maxHp; // フロア／拠点で回復
  }
}



/** プレイヤー周辺を探索済みに登録 */
function _updateExplored() {
  if (!player || !map) return;
  const r = VISION_RADIUS;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const tx = player.tx + dx;
      const ty = player.ty + dy;
      if (tx >= 0 && ty >= 0 && tx < map.cols && ty < map.rows) {
        exploredTiles.add(`${tx},${ty}`);
      }
    }
  }
}

// ── 増援・死神スポーン ─────────────────────────




// ── レベルアップ共通処理（魔法習得込み） ─────────────
function _onLevelUps(levels) {
  if (!levels || levels.length === 0) return;
  const cls = CLASSES[player.classType];
  for (const lv of levels) {
    logger.add(`⭐ レベルアップ！ LV ${lv} になった！`, 'warn');
    pushPlayerEvent(`Lv ${lv} になった！`, 'achieve');
    flashColor = 'rgba(250,204,21,0.3)';
    flashAlpha = 1;
    triggerShake(6, 0.35);
    particles.spawn(player.renderX, player.renderY, '#fde68a', 24);
    floatingTexts.push({
      text: `LEVEL UP!  LV ${lv}`, x: CANVAS_W / 2, y: CANVAS_H / 2 - 60,
      alpha: 1, scale: 1, color: '#fde68a', life: 2.5, maxLife: 2.5, big: true,
    });
    // 魔法習得チェック
    const newSpells = cls?.spellProgression?.[lv] ?? [];
    for (const spellId of newSpells) {
      if (player.learnSpell(spellId)) {
        const sp = SPELLS[spellId];
        if (sp) {
          logger.add(`✨ 新しい魔法を覚えた！「${sp.name}」`, 'warn');
          floatingTexts.push({
            text: `✨ ${sp.name} 習得！`, x: CANVAS_W / 2, y: CANVAS_H / 2 - 20,
            alpha: 1, scale: 1, color: sp.color ?? '#c084fc', life: 2.8, maxLife: 2.8, big: false,
          });
          // 空きホットバースロットへ自動セット
          const emptySlot = hotbar.findIndex(s => s === null);
          if (emptySlot !== -1) {
            hotbar[emptySlot] = spellId;
            logger.add(`🔑 スロット[${emptySlot + 1}] に「${sp.name}」をセット`, 'info');
          }
        }
      }
    }
  }
}

// ── タイル座標 → スクリーン座標 ─────────────────
function _worldToScreen(tx, ty) {
  return {
    sx: tx * TILE_SIZE + TILE_SIZE / 2 + camOffX,
    sy: ty * TILE_SIZE + TILE_SIZE / 2 + camOffY,
  };
}

// ── アイテムドロップ先タイルを探す ─────────────
function _findDropTile(tx, ty) {
  if (map.isWalkable(tx, ty) && !floorItems.some(fi => fi.tx === tx && fi.ty === ty)) {
    return { tx, ty };
  }
  for (let r = 1; r <= 5; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = tx + dx, ny = ty + dy;
        if (map.isWalkable(nx, ny) && !floorItems.some(fi => fi.tx === nx && fi.ty === ny)) {
          return { tx: nx, ty: ny };
        }
      }
    }
  }
  return { tx, ty }; // フォールバック
}

// ── 敵AI コンテキストビルダー ──────────────────────
function _makeEnemyAICtx() {
  return {
    map, player, enemies, camOffX, camOffY,
    canvasW: CANVAS_W, canvasH: CANVAS_H, loanDebt,
    logger,
    onFloatingText: t => floatingTexts.push(t),
    onFlash:    color => { flashColor = color; flashAlpha = 1; },
    onAoeFlash: entry => aoeFlash.push(entry),
    onArrow:    arrow => arrows.push(arrow),
    attack:          _attack,
    hasLOS:          _hasLOS,
    isEnemyOnLine:   _isEnemyOnLine,
  };
}

// ── プレイヤーアクション コンテキストビルダー ──────────
function _makePACtx() {
  const ctx = {
    player, enemies, map, floorItems, floorChests, floorNumber,
    gamePhase, gameState, currentDungeon,
    loanDebt, loanQuestActive, shopPos, shopItems,
    camOffX, camOffY, canvasW: CANVAS_W, canvasH: CANVAS_H,
    turnCount,
    floatingTexts, aoeFlash, arrows,
    logger,
    onFlash:          color => { flashColor = color; flashAlpha = 1; },
    onSpellVfx:       (type, params, life) => spawnMagicVfx(type, params, life),
    onShake:          (intensity, duration) => triggerShake(intensity, duration),
    onHitStop:        seconds => triggerHitStop(seconds),
    onGameOver:       () => { gameState = 'GAME_OVER'; gameOverTimer = 2.0; ctx.gameState = 'GAME_OVER'; },
    onTransition:     () => { _startTransition(); ctx.gameState = gameState; },
    onUpdateExplored: () => _updateExplored(),
    onOpenChest:      (tx, ty) => _openChest(tx, ty),
    onTriggerTrap:    type => _triggerTrap(type),
    onShopOpen:       () => {},
    onLevelUps:       levels => _onLevelUps(levels),
    onEnemyTurn:      e => doEnemyTurn(e, _makeEnemyAICtx()),
    onProcessDeathTraits: dead => processEnemyDeathTraits(dead, _makeEnemyAICtx()),
    onTickWaveSpawn:  () => {
      tickWaveSpawn({
        gamePhase, currentDungeon, floorNumber, turnCount: ctx.turnCount,
        map, player, enemies, logger,
        onFlash:        color => { flashColor = color; flashAlpha = 1; },
        onFloatingText: t     => floatingTexts.push(t),
      });
      _doPetTurn();
    },
    particles,
    hasLOS:        _hasLOS,
    isEnemyOnLine: _isEnemyOnLine,
    attack:        _attack,
    shopOpen, shopCursor,
  };
  return ctx;
}

function _syncPACtx(ctx) {
  turnCount       = ctx.turnCount;
  loanDebt        = ctx.loanDebt;
  loanQuestActive = ctx.loanQuestActive;
  shopOpen        = ctx.shopOpen;
  shopCursor      = ctx.shopCursor;
}

// ── 宝箱を開ける ─────────────────────────────
function _openChest(tx, ty) {
  const chest = floorChests.find(c => c.tx === tx && c.ty === ty && !c.opened);
  if (!chest) return;
  chest.opened = true;

  // 2〜4個のアイテムをドロップ
  const dropCount = 2 + Math.floor(Math.random() * 3);
  let dropped = 0;
  for (let i = 0; i < dropCount; i++) {
    const dp = _findDropTile(tx, ty);
    const item = chestDrop(floorNumber);
    if (item) {
      floorItems.push({ tx: dp.tx, ty: dp.ty, item });
      dropped++;
    }
  }
  // ゴールドも少し
  const gold = Math.floor(floorNumber * 8 + Math.random() * floorNumber * 12 + 10);
  const dp = _findDropTile(tx, ty);
  floorItems.push({ tx: dp.tx, ty: dp.ty, item: { slot: 'gold', amount: gold, icon: '💰', color: '#fbbf24', name: `${gold}G` } });

  // パーティクル & ログ
  const { sx, sy } = _worldToScreen(tx, ty);
  particles.burst(sx, sy, '#ffd700', 18);
  particles.burst(sx, sy, '#fff0a0', 10);
  logger.add(`✨ 宝箱を開けた！ アイテム${dropped}個+${gold}Gを入手！`, 'warn');
  floatingTexts.push({
    text: '✨ 宝箱！', x: sx, y: sy - 48,
    alpha: 1, scale: 1, color: '#ffd700', life: 2.0, maxLife: 2.0, big: false,
  });
}


// ── トラップ発動 ────────────────────────────────
function _triggerTrap(type) {
  const { sx, sy } = player.screenPos(camOffX, camOffY);
  switch (type) {
    case 'damage': {
      const dmg = Math.max(3, Math.floor(player.maxHP * 0.12));
      player.hp = Math.max(1, player.hp - dmg);
      logger.add(`💥 ダメージ罠！ ${dmg} ダメージ！（残HP: ${player.hp}）`, 'damage');
      particles.burst(player.renderX, player.renderY, '#ef4444', 8);
      floatingTexts.push({ text: `罠！-${dmg}`, x: sx, y: sy-20, alpha:1, scale:1, color:'#ef4444', life:1.8, maxLife:1.8 });
      flashColor = 'rgba(220,30,30,0.35)'; flashAlpha = 0.7;
      triggerShake(12, 0.3);
      triggerHitStop(0.08);
      break;
    }
    case 'poison': {
      const ex = player.statusEffects.find(e => e.type === 'poison');
      if (ex) ex.turnsLeft = Math.max(ex.turnsLeft, 8);
      else player.statusEffects.push({ type: 'poison', turnsLeft: 8, power: 1 });
      logger.add('☠ 毒罠！毒状態になった！（8ターン）', 'warn');
      floatingTexts.push({ text: '☠毒罠！', x: sx, y: sy-20, alpha:1, scale:1, color:'#4ade80', life:1.8, maxLife:1.8 });
      particles.burst(player.renderX, player.renderY, '#4ade80', 8);
      flashColor = 'rgba(74,222,128,0.2)'; flashAlpha = 0.7;
      break;
    }
    case 'teleport': {
      let ttx = 0, tty = 0, att = 0;
      do {
        ttx = Math.floor(Math.random() * map.cols);
        tty = Math.floor(Math.random() * map.rows);
        att++;
      } while (att < 300 && (!map.isWalkable(ttx, tty) || (ttx === player.tx && tty === player.ty)));
      if (att < 300) player.moveTo(ttx, tty);
      logger.add('🌀 テレポート罠！どこかへ飛ばされた！', 'warn');
      floatingTexts.push({ text: '🌀テレポート！', x: sx, y: sy-20, alpha:1, scale:1, color:'#818cf8', life:1.8, maxLife:1.8 });
      flashColor = 'rgba(129,140,248,0.3)'; flashAlpha = 0.8;
      break;
    }
    case 'alarm': {
      let woken = 0;
      for (const e of enemies) {
        if (e.alive && !e.alerted) {
          const d = Math.sqrt((e.tx - player.tx)**2 + (e.ty - player.ty)**2);
          if (d <= 14) { e.alerted = true; woken++; }
        }
      }
      logger.add(`🔔 警報罠！周囲の敵が目を覚ました！（${woken}体）`, 'warn');
      floatingTexts.push({ text: '🔔警報！', x: sx, y: sy-20, alpha:1, scale:1, color:'#fbbf24', life:1.8, maxLife:1.8 });
      flashColor = 'rgba(251,191,36,0.2)'; flashAlpha = 0.7;
      break;
    }
    case 'drop_item': {
      if (player.inventory.length > 0) {
        const idx = Math.floor(Math.random() * player.inventory.length);
        const dropped = player.inventory.splice(idx, 1)[0];
        const dp = _findDropTile(player.tx, player.ty);
        floorItems.push({ tx: dp.tx, ty: dp.ty, item: dropped });
        logger.add(`💀 落とし穴罠！${dropped.icon}${dropped.name} を落とした！`, 'warn');
        floatingTexts.push({ text: `${dropped.icon}落とした！`, x: sx, y: sy-20, alpha:1, scale:1, color:'#fb923c', life:1.8, maxLife:1.8 });
      } else {
        logger.add('💀 落とし穴罠！（落とすアイテムなし）', 'warn');
        floatingTexts.push({ text: '落とし穴罠！', x: sx, y: sy-20, alpha:1, scale:1, color:'#fb923c', life:1.8, maxLife:1.8 });
      }
      flashColor = 'rgba(251,146,60,0.2)'; flashAlpha = 0.7;
      break;
    }
    case 'sleep': {
      const exSleep = player.statusEffects.find(e => e.type === 'sleep');
      if (exSleep) exSleep.turnsLeft = Math.max(exSleep.turnsLeft, 3);
      else player.statusEffects.push({ type: 'sleep', turnsLeft: 3 });
      logger.add('😴 眠り罠！3ターン動けなくなった！', 'warn');
      floatingTexts.push({ text: '😴眠り罠！', x: sx, y: sy-20, alpha:1, scale:1, color:'#a78bfa', life:1.8, maxLife:1.8 });
      flashColor = 'rgba(167,139,250,0.2)'; flashAlpha = 0.7;
      break;
    }
    case 'summon': {
      // フロア全体に敵を召喚
      const allowedTypes = currentDungeon?.enemyTypes?.length
        ? currentDungeon.enemyTypes
        : ['goblin', 'skeleton', 'bat', 'slime', 'zombie'];
      const tiles = [];
      for (let tty2 = 0; tty2 < map.rows; tty2++) {
        for (let ttx2 = 0; ttx2 < map.cols; ttx2++) {
          if (!map.isWalkable(ttx2, tty2)) continue;
          if (enemies.some(e => e.alive && e.tx === ttx2 && e.ty === tty2)) continue;
          const dist2 = Math.max(Math.abs(ttx2 - player.tx), Math.abs(tty2 - player.ty));
          if (dist2 < 3) continue;
          tiles.push({ tx: ttx2, ty: tty2 });
        }
      }
      // シャッフル
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }
      const spawnCount = Math.min(currentDungeon?.infinite ? 80 : 30, tiles.length);
      for (let i = 0; i < spawnCount; i++) {
        const { tx: stx, ty: sty } = tiles[i];
        const type = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
        const e = new Enemy(stx, sty, type);
        e.alerted = true;
        enemies.push(e);
      }
      logger.add(`👹 召喚罠！フロア全体に${spawnCount}体の敵が現れた！`, 'warn');
      floatingTexts.push({ text: `👹 召喚罠！${spawnCount}体！`, x: sx, y: sy-30, alpha:1, scale:1, color:'#f87171', life:2.5, maxLife:2.5, big: true });
      flashColor = 'rgba(220,30,30,0.4)'; flashAlpha = 1;
      triggerShake(16, 0.4);
      break;
    }
  }
  particles.burst(player.renderX, player.renderY, '#fbbf24', 5);
}


// ── ゲームループ ───────────────────────────────
function startLoop(canvas) {
  const ctx    = canvas.getContext('2d');
  let lastTime = null;
  let elapsed  = 0;

  function loop(ts) {
    try {
    if (lastTime === null) lastTime = ts;
    const rawDt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime  = ts;
    elapsed  += rawDt;

    // ── ヒットストップ（dt を 0 に縮めて全体を一時停止）──
    let dt = rawDt;
    if (hitStopRemaining > 0) {
      hitStopRemaining -= rawDt;
      dt = 0;
    }

    // ── スクリーンシェイク更新 ──────────────────────
    if (shakeDuration > 0) {
      shakeDuration -= rawDt;
      const strength = Math.max(0, shakeDuration) * shakeIntensity;
      shakeX = (Math.random() - 0.5) * 2 * strength;
      shakeY = (Math.random() - 0.5) * 2 * strength;
    } else {
      shakeX = 0; shakeY = 0; shakeIntensity = 0;
    }

    if (player) {
      player.updateRender(dt);
      for (const e of enemies) e.updateRender(dt);
    }
    particles.update(dt);
    _updateDust(dt);
    tickChatTicker();
    _tickWorldEvent();
    if (gamePhase === 'BASE' && baseNpcs.length > 0) {
      const blockers = _baseReservedTiles().concat(player ? [{ tx: player.tx, ty: player.ty }] : []);
      for (const n of baseNpcs) {
        const others = baseNpcs.filter(o => o !== n);
        n.update(dt, map, blockers.concat(others));
      }
    }
    flashAlpha = Math.max(0, flashAlpha - dt * 6);

    // 矢アニメ更新
    for (const a of arrows) { a.progress += dt * 5; }
    // ── 着弾：progress が 1 に到達したものは衝撃バーストを発生 ──
    const landed = arrows.filter(a => a.progress >= 1);
    for (const a of landed) {
      const isxRaw = a.twx + camOffX;
      const isyRaw = a.twy + camOffY;
      if (a.isMagic) {
        // 魔法着弾：多段バーストと中央のフラッシュ
        particles.spawn(isxRaw, isyRaw, a.color,   24);
        particles.spawn(isxRaw, isyRaw, '#ffffff', 12);
        triggerShake(8, 0.22);
        triggerHitStop(0.05);
      } else {
        // 矢着弾：小さな火花
        particles.spawn(isxRaw, isyRaw, '#fcd34d', 10);
        particles.spawn(isxRaw, isyRaw, '#ffffff', 4);
        triggerShake(3, 0.10);
      }
    }
    arrows = arrows.filter(a => a.progress < 1);

    // AOEフラッシュフェードアウト
    for (const f of aoeFlash) { f.alpha = Math.max(0, f.alpha - dt * 4); }
    aoeFlash = aoeFlash.filter(f => f.alpha > 0);

    // 魔法エフェクト更新
    magicEffects = updateMagicEffects(magicEffects, dt);

    // ルーレット スピン演出
    if (casinoOpen && casinoMode === 'roulette' && rlPhase === 'spin') {
      rlSpinTimer  += dt;
      rlSpinAngle  += rlSpinSpeed * dt;
      rlSpinSpeed   = Math.max(0, rlSpinSpeed - dt * (rlSpinTimer > 1.5 ? 12 : 2));
      if (rlSpinSpeed <= 0) {
        rlSpinSpeed = 0;
        rlPhase = 'result';
        _rlFinish();
      }
    }

    // チンチロ: ダイスロール演出タイマー
    if (ccPlayerRollAnim > 0) ccPlayerRollAnim = Math.max(0, ccPlayerRollAnim - dt);
    if (ccDealerRollAnim > 0) ccDealerRollAnim = Math.max(0, ccDealerRollAnim - dt);

    // スロット: リール回転演出
    if (casinoOpen && casinoMode === 'slot' && slPhase === 'spin') {
      slSpinTimer += dt;
      for (let i = 0; i < 3; i++) {
        if (!slReelStopped[i]) {
          slReelOffsets[i] += dt * 900; // px/sec
          if (slSpinTimer >= slReelStopAt[i]) {
            slReelStopped[i] = true;
          }
        }
      }
      if (slReelStopped[0] && slReelStopped[1] && slReelStopped[2]) {
        _slFinish();
      }
    }

    // フローティングテキスト更新
    for (const ft of floatingTexts) {
      ft.life -= dt;
      ft.y    -= dt * 36;
      ft.alpha = Math.max(0, Math.min(1, (ft.life / ft.maxLife) * 1.4));
      // ── オーバーシュート: 0 → 1.25 → 1.0 に落ち着く ─
      const age = 1 - ft.life / ft.maxLife;
      if (age < 0.15) {
        ft.scale = (age / 0.15) * 1.25;
      } else if (age < 0.3) {
        ft.scale = 1.25 - ((age - 0.15) / 0.15) * 0.25;
      } else {
        ft.scale = 1.0;
      }
    }
    floatingTexts = floatingTexts.filter(ft => ft.life > 0);

    if (gameState === 'TITLE') {
      _handleTitleInput();
    } else if (gameState === 'SAVE_SLOT') {
      _handleSaveSlotInput();
    } else if (gameState === 'CHAR_CREATE') {
      _handleCharCreateInput();
    } else if (gameState === 'CLASS_SELECT') {
      _handleClassSelectInput();
    } else if (gameState === 'BUILD_SELECT') {
      _handleBuildSelectInput();
    } else if (gameState === 'PLAYER_TURN') {
      // 無限ダンジョン脱出確認プロンプト
      if (infiniteEscapePrompt) {
        if (input.justPressed('ArrowLeft')  || input.justPressed('KeyA')) infiniteEscapeCursor = 0;
        if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) infiniteEscapeCursor = 1;
        if (input.justPressed('Enter') || input.justPressed('KeyE') || input.justPressed('Space')) {
          infiniteEscapePrompt = false;
          if (infiniteEscapeCursor === 1) {
            // 脱出：報酬をもらって拠点へ
            const bonus = Math.floor(floorNumber * 15);
            player.gold += bonus;
            logger.add(`🏃 ${floorNumber - 1}階で脱出！ 報酬 +${bonus}G`, 'warn');
            floatingTexts.push({ text: `+${bonus}G 脱出報酬！`, x: CANVAS_W/2, y: CANVAS_H/2-60, alpha:1, scale:1, color:'#fbbf24', life:3.0, maxLife:3.0, big:true });
            _returnToBase();
          } else {
            // 続ける
            _buildFloor(transDir);
            gameState = 'PLAYER_TURN';
          }
        }
        input.flush();
      }

      // メニュー切り替え
      if (input.justPressed('Escape')) {
        showInventory = false; showMagic = false; shopOpen = false;
        baseChestOpen = false; baseShopOpen = false; casinoOpen = false; stallOpen = false; loanOpen = false; reclassOpen = false; craftOpen = false; questOpen = false; titleMenuOpen = false; rankingOpen = false;
      }

      if (input.justPressed('KeyP')) {
        saveSlotMode   = 'save';
        saveSlotFrom   = 'PLAYER_TURN';
        saveSlotCursor = 0;
        gameState      = 'SAVE_SLOT';
      }

      // チャット表示切替（T）
      if (input.justPressed('KeyT')) {
        const on = toggleChat();
        logger.add(on ? '🌐 ﾜｰﾙﾄﾞﾁｬｯﾄを表示' : '🌐 ﾜｰﾙﾄﾞﾁｬｯﾄを非表示', 'info');
      }

      // 称号メニュー切替（Y）— どこからでも開ける
      if (input.justPressed('KeyY')
          && !showInventory && !showMagic && !shopOpen
          && !baseChestOpen && !baseShopOpen && !casinoOpen && !stallOpen
          && !loanOpen && !reclassOpen && !craftOpen && !shrineOpen && !questOpen && !rankingOpen) {
        titleMenuOpen = !titleMenuOpen;
        titleMenuCursor = 0;
      }

      if (gamePhase === 'BASE') {
        if (input.justPressed('KeyI') && !baseChestOpen && !baseShopOpen && !casinoOpen && !stallOpen && !reclassOpen && !craftOpen && !shrineOpen && !questOpen && !rankingOpen) {
          showInventory = !showInventory; invCursor = 0;
        }
        if (baseChestOpen)     { _handleBaseChestInput(); }
        else if (baseShopOpen) { _handleBaseShopInput(); }
        else if (casinoOpen)   { _handleCasinoInput(); }
        else if (stallOpen)    { _handleStallInput(); }
        else if (loanOpen)     { _handleLoanInput(); }
        else if (reclassOpen)  { _handleReclassInput(); }
        else if (craftOpen)    { _handleCraftInput(); }
        else if (shrineOpen)   { _handleShrineInput(); }
        else if (questOpen)    { _handleQuestInput(); }
        else if (rankingOpen)  { _handleRankingInput(); }
        else if (titleMenuOpen){ _handleTitleMenuInput(); }
        else if (showInventory){ _handleInventoryInput(); }
        else                   { _handleBaseInput(); }
      } else {
        // ダンジョン内の既存処理
        if (input.justPressed('KeyI') && !showMagic) {
          showInventory = !showInventory; invCursor = 0;
        }
        if (input.justPressed('KeyO') && !showInventory) {
          showMagic = !showMagic; magicCursor = 0;
        }

        if (shopOpen) {
          _handleShopInput();
        } else if (showInventory) {
          _handleInventoryInput();
        } else if (showMagic) {
          _handleMagicInput();
        } else if (titleMenuOpen) {
          _handleTitleMenuInput();
        } else {
          // ─ ホットバー（1〜6キー）によるスキル発動 ─
          let hotbarUsed = false;
          for (let _hi = 0; _hi < 6; _hi++) {
            if (input.justPressed(`Digit${_hi + 1}`)) {
              const _spId = hotbar[_hi];
              if (_spId) {
                const _sp = SPELLS[_spId];
                if (_sp && player.mp >= _sp.mp) {
                  _castPlayerSpell(_spId);
                  _processTurnAfterCast();
                } else if (_sp) {
                  logger.add(`MP不足！「${_sp.name}」には ${_sp.mp}MP 必要（現在: ${player.mp}）`, 'damage');
                }
              } else {
                logger.add(`スロット[${_hi + 1}] は空。[O]魔法メニューで選んで[1-6]キーでセット`, 'info');
              }
              hotbarUsed = true;
              break;
            }
          }
          if (!hotbarUsed) {
          const action = _readAction();
          if (action) {
            // 眠り状態チェック
            const sleepEff = player.statusEffects?.find(e => e.type === 'sleep');
            if (sleepEff) {
              const { sx, sy } = player.screenPos(camOffX, camOffY);
              floatingTexts.push({ text: '😴…', x: sx, y: sy-28, alpha:1, scale:1, color:'#a78bfa', life:0.8, maxLife:0.8 });
              if (sleepEff.turnsLeft <= 1) {
                player.statusEffects = player.statusEffects.filter(e => e !== sleepEff);
                logger.add('目が覚めた！', 'warn');
              } else {
                sleepEff.turnsLeft--;
                logger.add(`😴 眠り状態…（残り${sleepEff.turnsLeft}ターン）`, 'damage');
              }
              _processTurnAfterCast();
            } else {
              _processTurn(action);
            }
          }
          } // end if (!hotbarUsed)
        }
      }

    } else if (gameState === 'TRANSITIONING') {
      _updateTransition(dt);

    } else if (gameState === 'GAME_OVER') {
      gameOverTimer -= dt;
      if (gameOverTimer <= 0) {
        if (input.justPressed('Enter') || input.justPressed('Space') || input.justPressed('KeyE')) {
          _returnToBase(false);
        }
      }
    } else if (gameState === 'DUNGEON_CLEAR') {
      // クリア演出中は何もしない（setTimeout で自動遷移）
    }

    _draw(ctx, CANVAS_W, CANVAS_H, elapsed);

    // ── デバッグパネルはダンジョン中のみ表示（タイトル/職業選択を邪魔しない） ──
    const _dbg = document.getElementById('debugPanel');
    if (_dbg) {
      const inDungeon = (gamePhase === 'DUNGEON') &&
        gameState !== 'TITLE' && gameState !== 'CHAR_CREATE' &&
        gameState !== 'CLASS_SELECT' &&
        gameState !== 'BUILD_SELECT' && gameState !== 'SAVE_SLOT';
      _dbg.style.display = inDungeon ? 'flex' : 'none';
    }
    } catch (err) {
      console.error('[loop error]', err);
    }
    input.flush();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// ── 露店入力 ──────────────────────────────────
function _handleShopInput() {
  if (input.justPressed('Escape') || input.justPressed('KeyB')) {
    shopOpen = false;
    return;
  }
  if (shopItems.length === 0) { shopOpen = false; return; }

  const total = shopItems.length;
  if (input.justPressed('ArrowUp')   || input.justPressed('KeyW'))
    shopCursor = (shopCursor - 1 + total) % total;
  if (input.justPressed('ArrowDown') || input.justPressed('KeyS'))
    shopCursor = (shopCursor + 1) % total;

  if (input.justPressed('Enter') || input.justPressed('KeyE')) {
    const entry = shopItems[shopCursor];
    if (!entry) return;
    if (player.gold < entry.price) {
      logger.add(`お金が足りない！（必要: ${entry.price}G / 所持: ${player.gold}G）`, 'warn');
      return;
    }
    if (entry.item.slot !== 'consumable' && player.inventory.length >= player.maxInventory) {
      logger.add('所持品がいっぱいで買えない！', 'warn');
      return;
    }
    if (entry.item.slot === 'consumable' && player.inventory.length >= player.maxInventory) {
      logger.add('所持品がいっぱいで買えない！', 'warn');
      return;
    }
    player.gold -= entry.price;
    player.addToInventory({ ...entry.item });
    logger.add(`🏪 ${entry.item.icon}${entry.item.name} を ${entry.price}G で購入した！`);
    const { sx, sy } = player.screenPos(camOffX, camOffY);
    floatingTexts.push({ text: `-${entry.price}G`, x: sx, y: sy - 28, alpha: 1, scale: 1, color: '#f87171', life: 1.2, maxLife: 1.2 });

    shopItems.splice(shopCursor, 1);
    if (shopItems.length === 0) {
      shopOpen = false;
      logger.add('売り切れ！');
      return;
    }
    shopCursor = Math.min(shopCursor, shopItems.length - 1);
  }

  // 盗む（R キー）
  if (input.justPressed('KeyR')) {
    const entry = shopItems[shopCursor];
    if (!entry) return;
    if (player.inventory.length >= player.maxInventory) {
      logger.add('所持品がいっぱいで盗めない！', 'warn');
      return;
    }
    player.addToInventory({ ...entry.item });
    shopItems.splice(shopCursor, 1);
    shopOpen = false;
    logger.add(`😈 ${entry.item.icon}${entry.item.name} を盗んだ！番人の死神が現れた！`, 'warn');
    flashColor = 'rgba(139,0,139,0.4)'; flashAlpha = 1;
    triggerShake(18, 0.45);
    triggerHitStop(0.15);
    const { sx, sy } = player.screenPos(camOffX, camOffY);
    floatingTexts.push({ text: '😈盗んだ！', x: sx, y: sy-28, alpha:1, scale:1, color:'#aa44ff', life:1.5, maxLife:1.5 });
    _spawnShopShinigami();
  }
}

// 番人の死神をスポーン
function _spawnShopShinigami() {
  let tx, ty, att = 0;
  do {
    tx = Math.floor(Math.random() * map.cols);
    ty = Math.floor(Math.random() * map.rows);
    att++;
  } while (att < 400 && (
    !map.isWalkable(tx, ty) ||
    enemies.some(e => e.alive && e.tx === tx && e.ty === ty) ||
    Math.max(Math.abs(tx - player.tx), Math.abs(ty - player.ty)) < 5
  ));
  const s = new Enemy(tx, ty, 'shop_shinigami');
  s.alerted = true;
  enemies.push(s);
  floatingTexts.push({
    text: '💀 番人の死神！',
    x: CANVAS_W / 2, y: CANVAS_H / 2 - 60,
    alpha: 1, scale: 1, color: '#aa44ff',
    life: 3.0, maxLife: 3.0, big: true,
  });
}

// ── 借金取りスポーン ──────────────────────────
function _spawnDebtCollectors() {
  if (loanQuestActive) return; // 宝探し依頼中は猶予期間
  const count = Math.min(10, Math.max(1, Math.floor(loanDebt / 100)));
  let spawned = 0;
  for (let i = 0; i < count; i++) {
    let tx, ty, att = 0;
    do {
      tx = Math.floor(Math.random() * map.cols);
      ty = Math.floor(Math.random() * map.rows);
      att++;
    } while (att < 400 && (
      !map.isWalkable(tx, ty) ||
      enemies.some(e => e.alive && e.tx === tx && e.ty === ty) ||
      Math.max(Math.abs(tx - player.tx), Math.abs(ty - player.ty)) < MIN_SPAWN_DIST
    ));
    if (att < 400) {
      const dc = new Enemy(tx, ty, 'debt_collector');
      // 借金額に応じてステータス強化
      dc.maxHP   = Math.floor(35 + loanDebt / 50);
      dc.hp      = dc.maxHP;
      dc.atk     = Math.floor(10 + loanDebt / 100);
      dc.alerted = true;
      enemies.push(dc);
      spawned++;
    }
  }
  if (spawned > 0) {
    logger.add(`💸 借金取りが ${spawned} 体現れた！（残債: ${loanDebt}G）`, 'warn');
    floatingTexts.push({
      text: `💸 借金取り ×${spawned}！`, x: CANVAS_W / 2, y: CANVAS_H / 2 - 60,
      alpha: 1, scale: 1, color: '#f87171', life: 3.0, maxLife: 3.0, big: true,
    });
  }
}

// ── ダンジョン解放チェック ─────────────────────
function _isDungeonUnlocked(dungeonId) {
  const idx = DUNGEONS.findIndex(d => d.id === dungeonId);
  if (idx <= 0) return true; // 最初のダンジョンは常に解放
  return clearedDungeons.has(DUNGEONS[idx - 1].id);
}

// ── 拠点入力 ──────────────────────────────────
function _handleBaseInput() {
  const portal   = BASE_PORTALS.find(p => p.tx === player.tx && p.ty === player.ty);
  const onChest  = player.tx === BASE_CHEST_POS.tx  && player.ty === BASE_CHEST_POS.ty;
  const onShop   = player.tx === BASE_SHOP_POS.tx   && player.ty === BASE_SHOP_POS.ty;
  const onCasino = player.tx === BASE_CASINO_POS.tx && player.ty === BASE_CASINO_POS.ty;
  const onStall  = player.tx === BASE_STALL_POS.tx  && player.ty === BASE_STALL_POS.ty;
  const onLoan   = player.tx === BASE_LOAN_POS.tx   && player.ty === BASE_LOAN_POS.ty;
  const onReclass = player.tx === BASE_RECLASS_POS.tx && player.ty === BASE_RECLASS_POS.ty;
  const onCraft   = player.tx === BASE_CRAFT_POS.tx   && player.ty === BASE_CRAFT_POS.ty;
  const onShrine  = player.tx === BASE_SHRINE_POS.tx  && player.ty === BASE_SHRINE_POS.ty;
  const onQuest   = player.tx === BASE_QUEST_POS.tx   && player.ty === BASE_QUEST_POS.ty;
  const onReception = player.tx === BASE_RECEPTION_POS.tx && player.ty === BASE_RECEPTION_POS.ty;
  const onTavern    = player.tx === BASE_TAVERN_POS.tx    && player.ty === BASE_TAVERN_POS.ty;
  const onTrader    = player.tx === BASE_TRADER_POS.tx    && player.ty === BASE_TRADER_POS.ty;

  if (input.justPressed('Enter') || input.justPressed('KeyE')) {
    if (portal) {
      if (!_isDungeonUnlocked(portal.dungeonId)) {
        const idx = DUNGEONS.findIndex(d => d.id === portal.dungeonId);
        const prev = DUNGEONS[idx - 1];
        logger.add(`🔒 ${prev.emoji}${prev.name} をクリアすると解放される！`, 'warn');
        return;
      }
      _startDungeon(portal.dungeonId); return;
    }
    if (onTavern) { logger.add('🍺 酒場の喧騒。冒険者たちが武勇を語り合っている。', 'info'); return; }
    if (onTrader) { logger.add('🛒 行商人：「街道を旅する者に必要な物が揃っているぜ」（準備中）', 'info'); return; }
    if (onChest)  { baseChestOpen = true; baseCursor = 0; baseChestSide = 'chest'; return; }
    if (onShop)   { baseShopOpen = true; baseShopCursor = 0; return; }
    if (onStall)  { stallOpen = true; stallCursor = 0; return; }
    if (onCasino) {
      casinoOpen  = true;
      casinoMode  = 'select';
      casinoCursor = 0;
      return;
    }
    if (onLoan) {
      loanOpen   = true;
      loanCursor = 0;
      return;
    }
    if (onReclass) {
      reclassOpen   = true;
      // 現在職はスキップして最初の「別の職」にカーソルを置く
      const curIdx = CLASS_IDS.indexOf(player.classType);
      reclassCursor = (curIdx >= 0) ? (curIdx + 1) % CLASS_IDS.length : 0;
      return;
    }
    if (onCraft) {
      craftOpen = true;
      craftCurA = 0;
      craftCurB = Math.min(1, Math.max(0, _craftListWeapons(player).length - 1));
      craftSide = 'A';
      return;
    }
    if (onShrine) {
      shrineOpen   = true;
      shrineCursor = 0;
      return;
    }
    if (onQuest) {
      questOpen   = true;
      questCursor = 0;
      return;
    }
    if (onReception) {
      rankingOpen   = true;
      rankingCursor = 0;
      return;
    }
  }

  const action = _readAction();
  if (!action) return;

  if (action.type === 'MOVE' || action.type === 'DASH') {
    const { dx, dy } = action;
    player.dirX = dx;
    player.dirY = dy;

    if (action.type === 'DASH') {
      let cx = player.tx, cy = player.ty;
      for (let i = 0; i < 30; i++) {
        const nx = cx + dx, ny = cy + dy;
        if (!map.isWalkable(nx, ny)) break;
        if (baseNpcs.some(n => n.tx === nx && n.ty === ny)) break;
        cx = nx; cy = ny;
        if (BASE_PORTALS.some(p => p.tx === cx && p.ty === cy)) break;
        if (cx === BASE_CHEST_POS.tx  && cy === BASE_CHEST_POS.ty)  break;
        if (cx === BASE_SHOP_POS.tx   && cy === BASE_SHOP_POS.ty)   break;
        if (cx === BASE_CASINO_POS.tx && cy === BASE_CASINO_POS.ty) break;
        if (cx === BASE_STALL_POS.tx  && cy === BASE_STALL_POS.ty)  break;
        if (cx === BASE_LOAN_POS.tx   && cy === BASE_LOAN_POS.ty)   break;
        if (cx === BASE_RECLASS_POS.tx && cy === BASE_RECLASS_POS.ty) break;
        if (cx === BASE_CRAFT_POS.tx   && cy === BASE_CRAFT_POS.ty)   break;
        if (cx === BASE_SHRINE_POS.tx  && cy === BASE_SHRINE_POS.ty)  break;
        if (cx === BASE_QUEST_POS.tx   && cy === BASE_QUEST_POS.ty)   break;
        if (cx === BASE_RECEPTION_POS.tx && cy === BASE_RECEPTION_POS.ty) break;
        if (cx === BASE_TAVERN_POS.tx    && cy === BASE_TAVERN_POS.ty)    break;
        if (cx === BASE_TRADER_POS.tx    && cy === BASE_TRADER_POS.ty)    break;
      }
      player.moveTo(cx, cy);
    } else {
      const ntx = player.tx + dx, nty = player.ty + dy;
      // NPC に向かって踏み込んだ＝話しかけ（移動はキャンセル）
      const npc = baseNpcs.find(n => n.tx === ntx && n.ty === nty);
      if (npc) {
        npc.speak(npc.randomGreeting());
        return;
      }
      if (map.isWalkable(ntx, nty)) player.moveTo(ntx, nty);
    }
    _updateExplored();
  }
}

// ── 委託露店の売値計算 ─────────────────────────
function _stallPrice(item) {
  const cat = SHOP_CATALOG.find(c => c.itemId === item.id);
  if (cat) return Math.max(1, Math.floor(cat.price * 0.5));
  return Math.max(5, (item.atk ?? 0) * 5 + (item.def ?? 0) * 4 + 8);
}

// ── 魂の祠 入力 ────────────────────────────────
function _handleShrineInput() {
  if (input.justPressed('Escape') || input.justPressed('KeyB')) {
    shrineOpen = false;
    return;
  }
  const n = META_UPGRADES.length;
  if (input.justPressed('ArrowUp')   || input.justPressed('KeyW'))
    shrineCursor = (shrineCursor - 1 + n) % n;
  if (input.justPressed('ArrowDown') || input.justPressed('KeyS'))
    shrineCursor = (shrineCursor + 1) % n;
  if (input.justPressed('Enter') || input.justPressed('KeyE')) {
    const def = META_UPGRADES[shrineCursor];
    const ups = getUpgrades();
    const cur = ups[def.id] ?? 0;
    if (cur >= def.costs.length) {
      logger.add(`✦ ${def.name} はもう極めている。`, 'warn');
      return;
    }
    const cost = def.costs[cur];
    if (getSouls() < cost) {
      logger.add(`👻 魂が足りない（必要: ${cost}）`, 'warn');
      return;
    }
    if (purchaseUpgrade(def.id)) {
      logger.add(`✦ ${def.name} を Lv${cur + 1} に強化した！`, 'heal');
      flashColor = 'rgba(192,132,252,0.25)';
      flashAlpha = 1;
    }
  }
}

// ── クエスト掲示板 入力 ────────────────────────
function _handleQuestInput() {
  if (input.justPressed('Escape') || input.justPressed('KeyB')) {
    questOpen = false;
    return;
  }
  const quests = getDailyQuests();
  const n = quests.length;
  if (n === 0) { questOpen = false; return; }
  if (input.justPressed('ArrowUp')   || input.justPressed('KeyW'))
    questCursor = (questCursor - 1 + n) % n;
  if (input.justPressed('ArrowDown') || input.justPressed('KeyS'))
    questCursor = (questCursor + 1) % n;
  if (input.justPressed('Enter') || input.justPressed('KeyE')) {
    const q = quests[questCursor];
    if (!q) return;
    if (q.claimed) {
      logger.add('この依頼は受領済み。', 'warn');
      return;
    }
    if (!_questIsComplete(q)) {
      logger.add('まだ条件を満たしていない。', 'warn');
      return;
    }
    const reward = _questClaim(q.id);
    if (!reward) return;
    player.gold += reward.gold;
    if (reward.souls > 0) addSouls(reward.souls);
    logger.add(`📜 「${q.title}」完了！ +${reward.gold}G / 魂+${reward.souls}`, 'heal');
    pushPlayerEvent(`${q.title} 達成！`, 'achieve');
    flashColor = 'rgba(251,191,36,0.25)';
    flashAlpha = 1;
  }
}

// ── ランキング掲示板 入力 ─────────────────────────
function _handleRankingInput() {
  if (input.justPressed('Escape') || input.justPressed('KeyB')) {
    rankingOpen = false;
    return;
  }
  const list = getDailyRanking();
  const n = list.length;
  if (n === 0) { rankingOpen = false; return; }
  if (input.justPressed('ArrowUp')   || input.justPressed('KeyW'))
    rankingCursor = (rankingCursor - 1 + n) % n;
  if (input.justPressed('ArrowDown') || input.justPressed('KeyS'))
    rankingCursor = (rankingCursor + 1) % n;
}

// ── 称号メニュー 入力 ────────────────────────────
function _handleTitleMenuInput() {
  if (input.justPressed('Escape') || input.justPressed('KeyB') || input.justPressed('KeyY')) {
    titleMenuOpen = false;
    return;
  }
  const n = _TITLES.length;
  if (input.justPressed('ArrowUp')   || input.justPressed('KeyW'))
    titleMenuCursor = (titleMenuCursor - 1 + n) % n;
  if (input.justPressed('ArrowDown') || input.justPressed('KeyS'))
    titleMenuCursor = (titleMenuCursor + 1) % n;
  if (input.justPressed('Enter') || input.justPressed('KeyE')) {
    const t = _TITLES[titleMenuCursor];
    if (!t) return;
    const unlocked = _titleUnlocked().some(u => u.id === t.id);
    if (!unlocked) {
      logger.add(`🎖 「${t.name}」はまだ解放されていない（${t.desc}）`, 'warn');
      return;
    }
    _titleSet(t.id);
    logger.add(`🎖 称号「${t.name}」を装備した！`, 'heal');
  }
  if (input.justPressed('KeyX')) {
    _titleSet(null);
    logger.add('🎖 称号を外した。', 'info');
  }
}

// ── 魂の祠 描画 ────────────────────────────────
function _drawShrine(ctx, W, H) {
  ctx.save();
  // 暗幕
  ctx.fillStyle = 'rgba(5,0,20,0.85)';
  ctx.fillRect(0, 0, W, H);

  const panelW = 540, panelH = 420;
  const px = (W - panelW) / 2;
  const py = (H - panelH) / 2;
  ctx.fillStyle = 'rgba(20,8,40,0.95)';
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.roundRect(px, py, panelW, panelH, 10);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;

  // タイトル
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('✦ 魂の祠 ✦', W / 2, py + 14);
  ctx.font = '12px monospace';
  ctx.fillStyle = '#c084fc';
  ctx.fillText(`所持魂: ${getSouls()}`, W / 2, py + 40);

  // 一覧
  const ups = getUpgrades();
  const startY = py + 70;
  const rowH   = 56;
  META_UPGRADES.forEach((def, i) => {
    const y    = startY + i * rowH;
    const sel  = i === shrineCursor;
    const cur  = ups[def.id] ?? 0;
    const max  = def.costs.length;
    const done = cur >= max;
    const cost = done ? null : def.costs[cur];

    ctx.fillStyle = sel ? 'rgba(192,132,252,0.18)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(px + 16, y, panelW - 32, rowH - 6);
    if (sel) {
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 16, y, panelW - 32, rowH - 6);
    }

    // 名称 + lv
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = sel ? '#fde68a' : '#e9d5ff';
    ctx.fillText(`${def.name}  Lv ${cur}/${max}`, px + 28, y + 6);
    // 説明
    ctx.font = '11px monospace';
    ctx.fillStyle = '#c4b5fd';
    ctx.fillText(def.desc, px + 28, y + 24);
    // コスト or MAX
    ctx.textAlign = 'right';
    ctx.font = 'bold 12px monospace';
    if (done) {
      ctx.fillStyle = '#fde68a';
      ctx.fillText('★ MAX', px + panelW - 28, y + 18);
    } else {
      ctx.fillStyle = getSouls() >= cost ? '#86efac' : '#fca5a5';
      ctx.fillText(`魂 ${cost}`, px + panelW - 28, y + 18);
    }
  });

  // フッター
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(196,181,253,0.65)';
  ctx.textAlign = 'center';
  ctx.fillText('↑↓ 選択   Enter 強化   Esc / B で閉じる', W / 2, py + panelH - 22);
  ctx.restore();
}

// ── 委託露店入力 ──────────────────────────────
function _handleStallInput() {
  if (input.justPressed('Escape') || input.justPressed('KeyB')) {
    stallOpen = false;
    return;
  }

  const inv   = player.inventory;
  const total = stallItems.length + inv.length;
  if (total === 0) { stallOpen = false; return; }

  if (input.justPressed('ArrowUp')   || input.justPressed('KeyW'))
    stallCursor = (stallCursor - 1 + total) % total;
  if (input.justPressed('ArrowDown') || input.justPressed('KeyS'))
    stallCursor = (stallCursor + 1) % total;

  if (input.justPressed('Enter') || input.justPressed('KeyE')) {
    if (stallCursor < stallItems.length) {
      // 委託中 → 引き上げ
      const { item } = stallItems.splice(stallCursor, 1)[0];
      if (player.inventory.length < player.maxInventory) {
        player.addToInventory(item);
        logger.add(`${item.icon ?? ''}${item.name} を露店から引き上げた`);
      } else {
        logger.add('所持品がいっぱいで引き上げられない！', 'warn');
        stallItems.splice(stallCursor, 0, { item, price: _stallPrice(item) });
        return;
      }
    } else {
      // 手持ち → 委託
      const invIdx = stallCursor - stallItems.length;
      if (invIdx >= 0 && invIdx < inv.length) {
        const item = inv.splice(invIdx, 1)[0];
        const price = _stallPrice(item);
        stallItems.push({ item, price });
        logger.add(`${item.icon ?? ''}${item.name} を委託した（売値 ${price}G・帰還時売却）`);
      }
    }
    stallCursor = Math.min(stallCursor, Math.max(0, stallItems.length + player.inventory.length - 1));
  }
}

// ── 転職コスト計算 ────────────────────────────
function _reclassCost() {
  return Math.max(RECLASS_COST_MIN, player.lv * RECLASS_COST_PER_LV);
}

// ── 転職サービス入力 ──────────────────────────
function _handleReclassInput() {
  if (input.justPressed('Escape') || input.justPressed('KeyB')) {
    reclassOpen = false;
    return;
  }
  const total = CLASS_IDS.length;
  if (input.justPressed('ArrowUp')   || input.justPressed('KeyW'))
    reclassCursor = (reclassCursor - 1 + total) % total;
  if (input.justPressed('ArrowDown') || input.justPressed('KeyS'))
    reclassCursor = (reclassCursor + 1) % total;

  if (input.justPressed('Enter') || input.justPressed('KeyE')) {
    const target = CLASS_IDS[reclassCursor];
    if (!target) return;
    if (target === player.classType) {
      logger.add('同じ職業には転職できない。', 'warn');
      return;
    }
    const cost = _reclassCost();
    if (player.gold < cost) {
      logger.add(`資金不足！ 転職には ${cost}G 必要だ。`, 'warn');
      return;
    }
    const cls = CLASSES[target];
    player.gold -= cost;
    const ok = player.reclassTo(target);
    if (ok) {
      logger.add(`${cls.icon} ${cls.name} に転職した！ (-${cost}G)`, 'heal');
      logger.add('スペルが新職業のものに置き換わり、HP/MPが全快した。');
    } else {
      player.gold += cost; // 失敗時はロールバック
      logger.add('転職に失敗した…', 'warn');
    }
    reclassOpen = false;
  }
}

// ── クラフト屋入力 ────────────────────────────
function _handleCraftInput() {
  if (input.justPressed('Escape') || input.justPressed('KeyB')) {
    craftOpen = false;
    return;
  }
  const weapons = _craftListWeapons(player);
  const total = weapons.length;
  if (total === 0) {
    // 武器が無ければ Enter/何か押されたら閉じる
    if (input.justPressed('Enter') || input.justPressed('KeyE')) {
      logger.add('武器を持っていないと合成できない。', 'warn');
      craftOpen = false;
    }
    return;
  }

  // 側切替
  if (input.justPressed('Tab') || input.justPressed('ArrowLeft') || input.justPressed('ArrowRight')
      || input.justPressed('KeyA') || input.justPressed('KeyD')) {
    craftSide = (craftSide === 'A') ? 'B' : 'A';
  }

  // カーソル移動
  const curKey = craftSide === 'A' ? 'A' : 'B';
  const getCur = () => (curKey === 'A' ? craftCurA : craftCurB);
  const setCur = (v) => { if (curKey === 'A') craftCurA = v; else craftCurB = v; };

  if (input.justPressed('ArrowUp') || input.justPressed('KeyW')) {
    setCur((getCur() - 1 + total) % total);
  }
  if (input.justPressed('ArrowDown') || input.justPressed('KeyS')) {
    setCur((getCur() + 1) % total);
  }

  // Enter: 合成実行
  if (input.justPressed('Enter') || input.justPressed('KeyE')) {
    craftCurA = Math.min(craftCurA, total - 1);
    craftCurB = Math.min(craftCurB, total - 1);
    const a = weapons[craftCurA];
    const b = weapons[craftCurB];
    if (!a || !b) return;
    if (a.invIndex === b.invIndex) {
      logger.add('同じ武器は選べない。別々の武器を2本選ぼう。', 'warn');
      return;
    }
    if (!_craftCan(a.item, b.item)) {
      logger.add('この組み合わせは合成できない。', 'warn');
      return;
    }
    const cost = _craftCost(a.item, b.item);
    if (player.gold < cost) {
      logger.add(`資金不足！ 合成には ${cost}G 必要だ。`, 'warn');
      return;
    }
    const result = _craftCombine(a.item, b.item);
    // 大きい方の invIndex から先に削除（splice のズレ回避）
    const i1 = Math.max(a.invIndex, b.invIndex);
    const i2 = Math.min(a.invIndex, b.invIndex);
    player.removeFromInventory(i1);
    player.removeFromInventory(i2);
    player.gold -= cost;
    if (!player.addToInventory(result)) {
      // 通常ここには来ない（2本削除した直後なので空きあり）
      logger.add('所持品がいっぱいで合成品を持てない！', 'warn');
    } else {
      logger.add(`⚒ ${result.icon ?? ''}${result.name} を鍛え上げた！ (-${cost}G)`, 'heal');
    }
    // カーソルを安全な位置へ
    const newTotal = _craftListWeapons(player).length;
    craftCurA = Math.min(craftCurA, Math.max(0, newTotal - 1));
    craftCurB = Math.min(craftCurB, Math.max(0, newTotal - 1));
    if (newTotal < 2) {
      craftOpen = false;
    }
  }
}

function _handleBaseChestInput() {
  if (input.justPressed('Escape') || input.justPressed('KeyB')) {
    baseChestOpen = false;
    return;
  }
  const currentList = baseChestSide === 'chest' ? baseChest : player.inventory;
  if (input.justPressed('ArrowLeft')  || input.justPressed('KeyA')) {
    baseChestSide = 'chest';
    baseCursor = Math.min(baseCursor, Math.max(0, baseChest.length - 1));
  }
  if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) {
    baseChestSide = 'inventory';
    baseCursor = Math.min(baseCursor, Math.max(0, player.inventory.length - 1));
  }
  if (input.justPressed('ArrowUp') || input.justPressed('KeyW'))
    baseCursor = Math.max(0, baseCursor - 1);
  if (input.justPressed('ArrowDown') || input.justPressed('KeyS'))
    baseCursor = Math.min(Math.max(0, currentList.length - 1), baseCursor + 1);

  if (input.justPressed('Enter') || input.justPressed('KeyE')) {
    if (baseChestSide === 'chest' && baseChest.length > 0) {
      const item = baseChest[baseCursor];
      if (player.addToInventory(item)) {
        baseChest.splice(baseCursor, 1);
        baseCursor = Math.min(baseCursor, Math.max(0, baseChest.length - 1));
        logger.add(`🗃 ${item.icon}${item.name} を取り出した。`);
      } else {
        logger.add('所持品がいっぱいで取り出せない！', 'warn');
      }
    } else if (baseChestSide === 'inventory' && player.inventory.length > 0) {
      const item = player.inventory[baseCursor];
      baseChest.push(item);
      player.removeFromInventory(baseCursor);
      baseCursor = Math.min(baseCursor, Math.max(0, player.inventory.length - 1));
      logger.add(`🗃 ${item.icon}${item.name} を宝箱に預けた。`);
    }
  }
}

// ── 拠点ショップ商品生成 ───────────────────────

// ── 拠点ショップ入力 ───────────────────────────
function _handleBaseShopInput() {
  if (input.justPressed('Escape') || input.justPressed('KeyB')) {
    baseShopOpen = false; return;
  }
  if (baseShopItems.length === 0) { baseShopOpen = false; return; }

  const total = baseShopItems.length;
  if (input.justPressed('ArrowUp')   || input.justPressed('KeyW'))
    baseShopCursor = (baseShopCursor - 1 + total) % total;
  if (input.justPressed('ArrowDown') || input.justPressed('KeyS'))
    baseShopCursor = (baseShopCursor + 1) % total;

  if (input.justPressed('Enter') || input.justPressed('KeyE')) {
    const entry = baseShopItems[baseShopCursor];
    if (!entry) return;
    if (player.gold < entry.price) {
      logger.add(`お金が足りない！（必要: ${entry.price}G）`, 'warn'); return;
    }
    if (player.inventory.length >= player.maxInventory) {
      logger.add('所持品がいっぱいで買えない！', 'warn'); return;
    }
    player.gold -= entry.price;
    player.addToInventory({ ...entry.item });
    logger.add(`🏪 ${entry.item.icon}${entry.item.name} を ${entry.price}G で購入！`);
    const { sx, sy } = player.screenPos(camOffX, camOffY);
    floatingTexts.push({ text: `-${entry.price}G`, x: sx, y: sy - 28, alpha: 1, scale: 1, color: '#f87171', life: 1.2, maxLife: 1.2 });
    baseShopItems.splice(baseShopCursor, 1);
    baseShopCursor = Math.min(baseShopCursor, Math.max(0, baseShopItems.length - 1));
  }
}

// ── ブラックジャック ロジック ──────────────────

function _bjFinish(result) {
  const ctx = { bjPhase, bjResult, bjMsg, bjBet, bjDeck, bjHand, bjDealerHand, player, camOffX, camOffY, onFloatingText: t => floatingTexts.push(t) };
  bjFinish(ctx, result);
  bjPhase = ctx.bjPhase; bjResult = ctx.bjResult; bjMsg = ctx.bjMsg;
}

function _rlFinish() {
  const ctx = { rlResult, rlBetType, rlBet, rlNumber, rlMsg, player, camOffX, camOffY, onFloatingText: t => floatingTexts.push(t), logger };
  rlFinish(ctx);
  rlMsg = ctx.rlMsg;
}

// ── チンチロ ロジック（→ casino-logic.ts）──────────────

function _ccFinish() {
  const ctx = { ccPhase, ccBet, ccPlayerDice, ccDealerDice, ccWin, ccMsg, player, camOffX, camOffY, onFloatingText: t => floatingTexts.push(t), logger };
  ccFinish(ctx);
  ccPhase = ctx.ccPhase; ccWin = ctx.ccWin; ccMsg = ctx.ccMsg;
}

// ── スロット ロジック ──────────────
// シンボルインデックス: 0=🍒 1=🍋 2=🔔 3=⭐ 4=💎 5=7️⃣
// 重み: よく出るシンボルほど払いが小さい
const _SL_WEIGHTS = [14, 10, 7, 5, 3, 1]; // cherry〜seven
const _SL_PAYOUTS = { 0: 3, 1: 5, 2: 8, 3: 10, 4: 15, 5: 25 };

function _slPickSymbol() {
  const total = _SL_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < _SL_WEIGHTS.length; i++) {
    r -= _SL_WEIGHTS[i];
    if (r <= 0) return i;
  }
  return 0;
}

function _slStart() {
  player.gold -= slBet;
  slPhase = 'spin';
  slSpinTimer = 0;
  slReels = [_slPickSymbol(), _slPickSymbol(), _slPickSymbol()];
  slReelOffsets = [0, 0, 0];
  slReelStopped = [false, false, false];
  // 各リールが止まる時刻（段階的）
  slReelStopAt = [1.0, 1.6, 2.3];
  slWin = false;
  slPayout = 0;
  slMsg = '';
  logger.add(`🎰 スロット始動！ベット ${slBet}G`, 'info');
}

function _slFinish() {
  slPhase = 'result';
  const [a, b, cc] = slReels;
  let mult = 0;
  let label = '';
  if (a === b && b === cc) {
    mult = _SL_PAYOUTS[a] ?? 0;
    if (a === 5) label = '🎆 JACKPOT！777 🎆';
    else if (a === 4) label = '💎 ダイヤ揃い！';
    else if (a === 3) label = '⭐ スター揃い！';
    else if (a === 2) label = '🔔 ベル揃い！';
    else if (a === 1) label = '🍋 レモン揃い！';
    else label = '🍒 チェリー揃い！';
  } else if (a === 0 && b === 0) {
    // チェリー2個
    mult = 2;
    label = '🍒 チェリー2個！';
  } else if (a === 0) {
    mult = 1.5;
    label = '🍒 チェリー（先頭）';
  }
  if (mult > 0) {
    const payout = Math.floor(slBet * mult);
    player.gold += payout;
    slWin = true;
    slPayout = payout;
    slMsg = `${label}  +${payout}G！`;
    logger.add(`🎰 ${label}  ${payout}G 獲得！`, 'heal');
    // 画面全体をフラッシュ
    flashAlpha = 0.35;
    flashColor = mult >= 20 ? '#fde68a' : '#fbbf24';
  } else {
    slWin = false;
    slPayout = 0;
    slMsg = '残念…次にチャンス！';
  }
}

function _bjDeal() {
  const ctx = { bjPhase, bjResult, bjMsg, bjBet, bjDeck, bjHand, bjDealerHand, player, camOffX, camOffY, onFloatingText: t => floatingTexts.push(t) };
  bjDeal(ctx);
  bjPhase = ctx.bjPhase; bjResult = ctx.bjResult; bjMsg = ctx.bjMsg;
  bjDeck = ctx.bjDeck; bjHand = ctx.bjHand; bjDealerHand = ctx.bjDealerHand;
}

function _bjDealerPlay() {
  const ctx = { bjPhase, bjResult, bjMsg, bjBet, bjDeck, bjHand, bjDealerHand, player, camOffX, camOffY, onFloatingText: t => floatingTexts.push(t) };
  bjDealerPlay(ctx);
  bjPhase = ctx.bjPhase; bjResult = ctx.bjResult; bjMsg = ctx.bjMsg;
  bjDealerHand = ctx.bjDealerHand;
}

// ── カジノ入力 ─────────────────────────────────
function _handleCasinoInput() {
  if (input.justPressed('Escape') || input.justPressed('KeyB')) {
    if (casinoMode !== 'select') { casinoMode = 'select'; return; }
    casinoOpen = false; return;
  }

  // ── モード選択 ──────────────────────────────
  if (casinoMode === 'select') {
    if (input.justPressed('ArrowLeft')  || input.justPressed('KeyA')) casinoCursor = (casinoCursor - 1 + 4) % 4;
    if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) casinoCursor = (casinoCursor + 1) % 4;
    if (input.justPressed('Enter') || input.justPressed('KeyE')) {
      if (casinoCursor === 0) {
        casinoMode = 'bj';
        bjPhase = 'bet';
        bjBet = Math.max(5, Math.min(bjBet, player.gold));
      } else if (casinoCursor === 1) {
        casinoMode = 'roulette';
        rlPhase = 'bet';
        rlBet = Math.max(5, Math.min(rlBet, player.gold));
      } else if (casinoCursor === 2) {
        casinoMode = 'chinchiro';
        ccPhase = 'bet';
        ccBet = Math.max(5, Math.min(ccBet, player.gold));
      } else {
        casinoMode = 'slot';
        slPhase = 'bet';
        slBet = Math.max(5, Math.min(slBet, player.gold));
        slReelStopped = [true, true, true];
      }
    }
    return;
  }

  // ── チンチロ ──────────────────────────────────
  if (casinoMode === 'chinchiro') {
    if (ccPhase === 'bet') {
      const maxBet = Math.max(5, player.gold);
      if (input.justPressed('ArrowUp')    || input.justPressed('KeyW')) ccBet = Math.min(maxBet, ccBet + 5);
      if (input.justPressed('ArrowDown')  || input.justPressed('KeyS')) ccBet = Math.max(5, ccBet - 5);
      if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) ccBet = Math.min(maxBet, ccBet + 50);
      if (input.justPressed('ArrowLeft')  || input.justPressed('KeyA')) ccBet = Math.max(5, ccBet - 50);
      if (input.justPressed('Enter') || input.justPressed('KeyE')) {
        if (player.gold < ccBet || player.gold < 5) { logger.add('お金が足りない！', 'warn'); return; }
        if (ccPlayerRollAnim > 0) return; // ロール演出中
        player.gold -= ccBet;
        ccPlayerDice  = _ccRoll();
        ccPlayerRolls = 1;
        ccPhase = 'player_roll';
        ccPlayerRollAnim = 0.75;
      }
    } else if (ccPhase === 'player_roll') {
      if (ccPlayerRollAnim > 0) return; // 振ってる最中は入力不可
      const pEv = _ccEval(ccPlayerDice);
      // 即時確定役（ピンゾロ・シゴロ・ヒフミ）はそのまま dealer rollへ
      if (pEv.rank === 100 || pEv.rank === 50 || pEv.rank === -1) {
        // 自動で dealer_rollへ
        if (input.justPressed('Enter') || input.justPressed('KeyE') || input.justPressed('Space')) {
          ccDealerDice = _ccRoll();
          ccPhase = 'dealer_roll';
          ccDealerRollAnim = 0.8;
          _ccFinish();
        }
      } else if (pEv.rank === 0 && ccPlayerRolls < 3) {
        // 役なし：再振り可能
        if (input.justPressed('Enter') || input.justPressed('KeyE') || input.justPressed('Space')) {
          ccPlayerDice  = _ccRoll();
          ccPlayerRolls++;
          ccPlayerRollAnim = 0.7;
          const ev2 = _ccEval(ccPlayerDice);
          if (ev2.rank !== 0 || ccPlayerRolls >= 3) {
            ccDealerDice = _ccRoll();
            ccPhase = 'dealer_roll';
            ccDealerRollAnim = 0.8;
            _ccFinish();
          }
        }
      } else {
        // 役あり or 3回振り終わり
        if (input.justPressed('Enter') || input.justPressed('KeyE') || input.justPressed('Space')) {
          ccDealerDice = _ccRoll();
          ccPhase = 'dealer_roll';
          ccDealerRollAnim = 0.8;
          _ccFinish();
        }
      }
    } else if (ccPhase === 'result') {
      if (ccDealerRollAnim > 0) return; // ディーラーロール中
      if (input.justPressed('Enter') || input.justPressed('KeyE') || input.justPressed('Space')) {
        ccPhase = 'bet';
        ccBet = Math.max(5, Math.min(ccBet, player.gold));
      }
    }
    return;
  }

  // ── ルーレット ──────────────────────────────
  if (casinoMode === 'roulette') {
    if (rlPhase === 'bet') {
      const BET_TYPES = ['red','black','odd','even','low','high','number'];
      const maxBet = Math.max(5, player.gold);
      if (input.justPressed('ArrowLeft')  || input.justPressed('KeyA'))
        rlBetType = BET_TYPES[(BET_TYPES.indexOf(rlBetType) - 1 + BET_TYPES.length) % BET_TYPES.length];
      if (input.justPressed('ArrowRight') || input.justPressed('KeyD'))
        rlBetType = BET_TYPES[(BET_TYPES.indexOf(rlBetType) + 1) % BET_TYPES.length];
      if (input.justPressed('ArrowUp')   || input.justPressed('KeyW')) {
        if (rlBetType === 'number') rlNumber = Math.min(36, rlNumber + 1);
        else rlBet = Math.min(maxBet, rlBet + 5);
      }
      if (input.justPressed('ArrowDown') || input.justPressed('KeyS')) {
        if (rlBetType === 'number') rlNumber = Math.max(0, rlNumber - 1);
        else rlBet = Math.max(5, rlBet - 5);
      }
      if (input.justPressed('KeyQ')) rlBet = Math.min(maxBet, rlBet + 50);
      if (input.justPressed('KeyZ')) rlBet = Math.max(5, rlBet - 50);
      if (input.justPressed('Enter') || input.justPressed('KeyE')) {
        if (player.gold < rlBet || player.gold < 5) {
          logger.add('お金が足りない！（最低5G必要）', 'warn'); return;
        }
        player.gold -= rlBet;
        rlPhase     = 'spin';
        rlSpinSpeed = 25 + Math.random() * 10;
        rlSpinTimer = 0;
        rlResult    = Math.floor(Math.random() * 37); // 0〜36
      }
    } else if (rlPhase === 'spin') {
      // 演出中は入力不可（自動で進む）
    } else if (rlPhase === 'result') {
      if (input.justPressed('Enter') || input.justPressed('KeyE') || input.justPressed('Space')) {
        rlPhase = 'bet';
        rlBet   = Math.max(5, Math.min(rlBet, player.gold));
      }
    }
    return;
  }

  // ── スロット ──────────────────────────────────
  if (casinoMode === 'slot') {
    if (slPhase === 'bet') {
      const maxBet = Math.max(5, player.gold);
      if (input.justPressed('ArrowUp')    || input.justPressed('KeyW')) slBet = Math.min(maxBet, slBet + 5);
      if (input.justPressed('ArrowDown')  || input.justPressed('KeyS')) slBet = Math.max(5, slBet - 5);
      if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) slBet = Math.min(maxBet, slBet + 50);
      if (input.justPressed('ArrowLeft')  || input.justPressed('KeyA')) slBet = Math.max(5, slBet - 50);
      if (input.justPressed('Enter') || input.justPressed('KeyE') || input.justPressed('Space')) {
        if (player.gold < slBet || player.gold < 5) { logger.add('お金が足りない！（最低5G必要）', 'warn'); return; }
        _slStart();
      }
    } else if (slPhase === 'spin') {
      // 演出中は入力不可（自動で進行）
    } else if (slPhase === 'result') {
      if (input.justPressed('Enter') || input.justPressed('KeyE') || input.justPressed('Space')) {
        slPhase = 'bet';
        slBet   = Math.max(5, Math.min(slBet, player.gold));
      }
    }
    return;
  }

  if (bjPhase === 'bet') {
    const maxBet = Math.max(5, player.gold);
    if (input.justPressed('ArrowUp')   || input.justPressed('KeyW'))
      bjBet = Math.min(maxBet, bjBet + 5);
    if (input.justPressed('ArrowDown') || input.justPressed('KeyS'))
      bjBet = Math.max(5, bjBet - 5);
    if (input.justPressed('ArrowRight') || input.justPressed('KeyD'))
      bjBet = Math.min(maxBet, bjBet + 50);
    if (input.justPressed('ArrowLeft') || input.justPressed('KeyA'))
      bjBet = Math.max(5, bjBet - 50);
    if (input.justPressed('Enter') || input.justPressed('KeyE')) {
      if (player.gold < bjBet || player.gold < 5) {
        logger.add('お金が足りない！（最低5G必要）', 'warn'); return;
      }
      player.gold -= bjBet;
      _bjDeal();
    }

  } else if (bjPhase === 'play') {
    // H / ← = ヒット
    if (input.justPressed('KeyH') || input.justPressed('ArrowLeft')) {
      bjHand.push(bjDeck.pop());
      const pv = _bjHandValue(bjHand);
      if      (pv > 21) _bjFinish('lose');
      else if (pv === 21) _bjDealerPlay(); // 21になったら自動スタンド
    }
    // S / → / Space = スタンド
    if (input.justPressed('KeyS') || input.justPressed('ArrowRight') || input.justPressed('Space')) {
      _bjDealerPlay();
    }

  } else if (bjPhase === 'result') {
    if (input.justPressed('Enter') || input.justPressed('KeyE') || input.justPressed('Space')) {
      bjPhase = 'bet';
      bjBet   = Math.max(5, Math.min(bjBet, player.gold));
    }
  }
}

// ── 金貸し入力 ────────────────────────────────
function _handleLoanInput() {
  if (input.justPressed('Escape') || input.justPressed('KeyB')) {
    if (loanRepayMode) { loanRepayMode = false; return; }
    loanOpen = false; loanRepayMode = false; return;
  }

  if (loanRepayMode) {
    // 返済額選択モード
    if (input.justPressed('ArrowLeft') || input.justPressed('KeyA'))
      loanRepayCursor = Math.max(0, loanRepayCursor - 1);
    if (input.justPressed('ArrowRight') || input.justPressed('KeyD'))
      loanRepayCursor = Math.min(REPAY_AMOUNTS.length - 1, loanRepayCursor + 1);
    if (input.justPressed('Enter') || input.justPressed('KeyR') || input.justPressed('KeyE')) {
      if (loanDebt <= 0) { logger.add('借金はありません。', 'info'); loanRepayMode = false; return; }
      const rawAmt   = REPAY_AMOUNTS[loanRepayCursor];
      const targetAmt = rawAmt === -1 ? loanDebt : rawAmt;
      const pay = Math.min(targetAmt, loanDebt, player.gold);
      if (pay <= 0) { logger.add('お金が足りない！返済できない。', 'warn'); return; }
      player.gold -= pay;
      loanDebt    -= pay;
      logger.add(`💰 ${pay}G 返済した。残債: ${loanDebt}G`, loanDebt > 0 ? 'warn' : 'info');
      if (loanDebt <= 0) {
        loanDebt = 0;
        loanQuestActive = false;
        logger.add('🎉 借金を完済した！', 'warn');
        loanRepayMode = false;
      }
    }
    return;
  }

  // 通常モード
  if (input.justPressed('ArrowLeft')  || input.justPressed('KeyA'))
    loanCursor = Math.max(0, loanCursor - 1);
  if (input.justPressed('ArrowRight') || input.justPressed('KeyD'))
    loanCursor = Math.min(LOAN_AMOUNTS.length - 1, loanCursor + 1);

  if (input.justPressed('Enter') || input.justPressed('KeyE')) {
    // 借入
    const amt = LOAN_AMOUNTS[loanCursor];
    loanDebt += amt;
    player.gold += amt;
    logger.add(`💸 ${amt}G 借りた。残債: ${loanDebt}G（フロアごとに${Math.round(LOAN_INTEREST*100)}%利息）`, 'warn');
    loanOpen = false;
  }
  if (input.justPressed('KeyR')) {
    if (loanDebt <= 0) { logger.add('借金はありません。', 'info'); return; }
    loanRepayMode   = true;
    loanRepayCursor = 0;
  }
  if (input.justPressed('KeyQ')) {
    // 宝探し依頼
    if (loanDebt <= 0) { logger.add('借金はありません。', 'info'); return; }
    if (loanQuestActive) { logger.add('すでに依頼中です。', 'info'); return; }
    loanQuestActive = true;
    logger.add(`🗺️ 宝探し依頼を受けた！${LOAN_QUEST_FLOORS}フロア以内のお宝が借金返済に充てられる。借金取りは来ない。`, 'warn');
    loanOpen = false;
  }
}

// ── 装備画面入力 ──────────────────────────────

function _handleInventoryInput() {
  const inEquip = invCursor < SLOTS.length;
  const invIdx  = invCursor - SLOTS.length;
  const invLen  = player.inventory.length;

  if (input.justPressed('ArrowUp')) {
    if (inEquip) {
      invCursor = (invCursor - 1 + SLOTS.length) % SLOTS.length;
    } else if (invIdx >= INV_COLS) {
      invCursor -= INV_COLS;
    } else {
      invCursor = SLOTS.length - 1; // グリッド先頭行 → 装備ゾーンへ
    }
  }
  if (input.justPressed('ArrowDown')) {
    if (inEquip) {
      if (invCursor < SLOTS.length - 1) invCursor++;
      else if (invLen > 0) invCursor = SLOTS.length;
    } else {
      const newIdx = invIdx + INV_COLS;
      if (newIdx < invLen) invCursor = SLOTS.length + newIdx;
    }
  }
  if (input.justPressed('ArrowLeft')) {
    if (!inEquip) {
      if (invIdx % INV_COLS > 0) invCursor--;
      else invCursor = SLOTS.length - 1; // グリッド左端 → 装備ゾーンへ
    }
  }
  if (input.justPressed('ArrowRight')) {
    if (inEquip) {
      if (invLen > 0) invCursor = SLOTS.length;
    } else {
      const col = invIdx % INV_COLS;
      if (col < INV_COLS - 1 && invIdx + 1 < invLen) invCursor++;
    }
  }

  if (input.justPressed('Enter') || input.justPressed('KeyE')) {
    if (invCursor < SLOTS.length) {
      // 装備スロット選択 → 外す
      const slot = SLOTS[invCursor];
      const cur  = player.equip[slot];
      if (cur && cur.cursed) {
        logger.add(`💜 ${cur.name} は呪われていて外せない…！（浄化の巻物が必要）`, 'warn');
      } else {
        const old  = player.unequipSlot(slot);
        if (old) {
          if (player.addToInventory(old)) {
            logger.add(`${old.name} を外した。`);
          } else {
            // インベントリ満杯のため再装備
            player.equipItem(old);
            logger.add('所持品がいっぱいで外せない！', 'warn');
          }
        }
      }
    } else {
      // インベントリアイテム選択 → 装備
      const idx  = invCursor - SLOTS.length;
      const item = player.inventory[idx];
      if (item) {
        if (item.slot === 'consumable') {
          // ── 消費アイテムを使う ──
          if (item.spellId) {
            // 魔法の巻物
            player.removeFromInventory(idx);
            showInventory = false;
            _castPlayerSpell(item.spellId);
            _processTurnAfterCast();
          } else if (item.bombDmg) {
            // 爆弾：周囲2マスの敵にダメージ
            player.removeFromInventory(idx);
            showInventory = false;
            let hits = 0;
            for (const e of enemies) {
              if (!e.alive) continue;
              const dist = Math.max(Math.abs(e.tx - player.tx), Math.abs(e.ty - player.ty));
              if (dist <= 2) { _attack(player, e, item.bombDmg); hits++; }
            }
            logger.add(`💣 爆弾！ 周囲${hits}体に${item.bombDmg}ダメージ！`, 'warn');
            flashColor = 'rgba(239,68,68,0.3)'; flashAlpha = 1;
            _processTurnAfterCast();
          } else if (item.breakWallRange) {
            // ツルハシ：向いている方向に最大 breakWallRange 枚の壁を掘る
            if (gamePhase === 'BASE') {
              logger.add('⛏ 拠点では使えない。', 'warn');
            } else {
              const dx = player.dirX ?? 0;
              const dy = player.dirY ?? 1;
              if (dx === 0 && dy === 0) {
                logger.add('向きを決めてからツルハシを使う。', 'warn');
              } else {
                let cx = player.tx, cy = player.ty;
                let broken = 0;
                let gotStone = 0, gotWood = 0;
                for (let step = 0; step < item.breakWallRange; step++) {
                  cx += dx; cy += dy;
                  if (!map.canBreakWall || !map.canBreakWall(cx, cy)) break;
                  const mat = map.wallMaterialAt ? map.wallMaterialAt(cx, cy) : 'stone';
                  if (!map.breakWall(cx, cy)) break;
                  broken++;
                  if (mat === 'wood') { player.wood   = (player.wood   ?? 0) + 1; gotWood++; }
                  else                { player.stones = (player.stones ?? 0) + 1; gotStone++; }
                  const sx = (cx - player.tx) * 1 + player.renderX;
                  const sy = (cy - player.ty) * 1 + player.renderY;
                  particles.spawn(sx + dx * 28, sy + dy * 28, mat === 'wood' ? '#92400e' : '#a8a29e', 10);
                }
                if (broken === 0) {
                  logger.add(`⛏ ${item.name}：前方に掘れる壁がない。`, 'warn');
                } else {
                  player.removeFromInventory(idx);
                  showInventory = false;
                  player.attackBump(dx, dy);
                  const parts = [];
                  if (gotStone > 0) parts.push(`⛏${gotStone}`);
                  if (gotWood  > 0) parts.push(`🪵${gotWood}`);
                  logger.add(`⛏ ${item.name}！壁${broken}枚を粉砕（${parts.join(' ')}）`, 'heal');
                  flashColor = 'rgba(203,213,225,0.25)'; flashAlpha = 1;
                  _processTurnAfterCast();
                }
              }
            }
          } else if (item.revive) {
            // 蘇生の宝玉：蘇生バフをセット
            player.removeFromInventory(idx);
            player.statusEffects = player.statusEffects.filter(e => e.type !== 'revive');
            player.statusEffects.push({ type: 'revive', turns: 9999 });
            logger.add(`💎 蘇生の宝玉を使った！次の死亡時に復活する。`, 'warn');
            flashColor = 'rgba(52,211,153,0.3)'; flashAlpha = 1;
          } else if (item.tempAtk) {
            // 力の秘薬：一時ATK強化
            player.removeFromInventory(idx);
            player.statusEffects = player.statusEffects.filter(e => e.type !== 'power_up');
            player.statusEffects.push({ type: 'power_up', turns: item.tempTurns, power: item.tempAtk });
            player.atk += item.tempAtk;
            logger.add(`💪 力の秘薬！ ATK+${item.tempAtk}（${item.tempTurns}ターン）`, 'warn');
            flashColor = 'rgba(249,115,22,0.3)'; flashAlpha = 1;
          } else if (item.identifyScroll) {
            const n = player.useItem(item);
            player.removeFromInventory(idx);
            if (n > 0) logger.add(`📜 鑑定の巻物！ ${n} 個の装備を鑑定した。`, 'warn');
            else       logger.add('📜 鑑定の巻物… だが鑑定すべき装備が無い。', 'warn');
            flashColor = 'rgba(253,224,71,0.25)'; flashAlpha = 1;
          } else if (item.uncurseScroll) {
            const n = player.useItem(item);
            player.removeFromInventory(idx);
            if (n > 0) logger.add(`📜 浄化の巻物！ ${n} 個の呪いを解いた。`, 'heal');
            else       logger.add('📜 浄化の巻物… だが呪い装備は無い。', 'warn');
            flashColor = 'rgba(134,239,172,0.25)'; flashAlpha = 1;
          } else {
            const healed = player.useItem(item);
            player.removeFromInventory(idx);
            if (item.healMp === 'full') {
              logger.add(`${item.icon}${item.name} を使った！ MP が全回復した！`, 'warn');
              flashColor = 'rgba(99,102,241,0.28)'; flashAlpha = 1;
            } else if (item.healMp) {
              logger.add(`${item.icon}${item.name} を使った！ MP +${healed} 回復。`);
              flashColor = 'rgba(99,102,241,0.28)'; flashAlpha = 1;
            } else if (item.heal === 'full') {
              logger.add(`${item.icon}${item.name} を使った！ HP が全回復した！`, 'warn');
              flashColor = 'rgba(52,211,153,0.28)'; flashAlpha = 1;
            } else {
              logger.add(`${item.icon}${item.name} を使った！ HP +${healed} 回復。`);
              flashColor = 'rgba(52,211,153,0.28)'; flashAlpha = 1;
            }
          }
        } else {
          // ── 装備アイテム ──
          const old = player.equipItem(item);
          player.removeFromInventory(idx);
          if (old) {
            if (!player.addToInventory(old)) {
              const dp3 = _findDropTile(player.tx, player.ty);
              floorItems.push({ tx: dp3.tx, ty: dp3.ty, item: old });
              logger.add(`${old.name} を床に落とした。`, 'warn');
            } else {
              logger.add(`${item.name} を装備した（${old.name} を外した）。`);
            }
          } else {
            logger.add(`${item.name} を装備した。`);
          }
        }
        invCursor = Math.min(invCursor, SLOTS.length + player.inventory.length - 1);
      }
    }
  }

  // D / Delete キーで捨てる（インベントリアイテムのみ）
  if (input.justPressed('KeyD') || input.justPressed('Delete')) {
    if (invCursor >= SLOTS.length) {
      const idx  = invCursor - SLOTS.length;
      const item = player.removeFromInventory(idx);
      if (item) {
        const dp4 = _findDropTile(player.tx, player.ty);
        floorItems.push({ tx: dp4.tx, ty: dp4.ty, item });
        logger.add(`${item.icon}${item.name} を捨てた。`, 'warn');
        if (player.inventory.length === 0) invCursor = SLOTS.length - 1;
        else invCursor = Math.min(invCursor, SLOTS.length + player.inventory.length - 1);
      }
    }
  }
}

// ── 画面遷移 ──────────────────────────────────

function _startTransition(dir = null) {
  gameState  = 'TRANSITIONING';
  transDir   = dir;
  transPhase = 'fade-out';
  transAlpha = 0;
  logger.add('階段を降りる...', 'warn');
}

// _updateTransition → src/systems/transitions.ts に移動済み
function _updateTransition(dt) {
  const result = tickTransition({ phase: transPhase, alpha: transAlpha }, dt);
  if (result.done) {
    if (result.event === 'do-switch') { transPhase = 'switch'; _doSwitch(); }
    else { transPhase = 'none'; gameState = 'PLAYER_TURN'; transAlpha = 0; }
  } else {
    transAlpha = result.alpha;
    transPhase = result.phase;
  }
}

function _doSwitch() {
  const prevFloor = floorNumber;
  floorNumber++;
  turnCount = 0;
  _questReportFloor(floorNumber);
  _titleReportFloor(floorNumber);
  const maxFloors = currentDungeon?.maxFloors ?? 99;
  if (floorNumber > maxFloors && !currentDungeon?.infinite) {
    _dungeonClear();
    return;
  }
  // 無限ダンジョン：10階クリアごとに脱出確認
  if (currentDungeon?.infinite && prevFloor % 10 === 0) {
    transPhase = 'none';
    transAlpha = 0;
    infiniteEscapePrompt = true;
    infiniteEscapeCursor = 0;
    gameState = 'PLAYER_TURN';
    logger.add(`⚠ ${prevFloor}階クリア！ このまま続けますか？`, 'warn');
    pushPlayerEvent(`${prevFloor}F まで来た！`, 'achieve');
    return;
  }
  // 5フロアおきに進捗チャット
  if (prevFloor > 0 && prevFloor % 5 === 0) {
    pushPlayerEvent(`${prevFloor}F クリア`, 'achieve');
  }
  _buildFloor(transDir);
  gameState  = 'TRANSITIONING';

  if (currentDungeon?.bossRush) {
    const name = BOSS_RUSH_NAMES[Math.min(floorNumber - 1, BOSS_RUSH_NAMES.length - 1)];
    logger.add(`💀 Wave ${floorNumber}「${name}」が現れた！`, 'warn');
    floatingTexts.push({
      text: `Wave ${floorNumber}`,
      x: CANVAS_W / 2, y: CANVAS_H / 2 - 60,
      alpha: 1, scale: 1, color: '#f43f5e', life: 2.5, maxLife: 2.5, big: true,
    });
  } else {
    logger.add(`${floorNumber} 層に移動した。`, 'warn');
  }

  // ── 封印付きボスの登場を通知＋床に鍵を設置（key タイプのみ） ──
  const _sealedBoss = enemies.find(e => e.alive && e.isBoss && e.riddleActive);
  if (_sealedBoss) {
    const label = _sealedBoss.sealLabel ?? '封印';
    logger.add(`🔒 ${_sealedBoss.name} は ${label} の封印に守られている！`, 'warn');
    if (_sealedBoss.sealType === 'key') {
      _placeSealKeyOnFloor(_sealedBoss);
    }
  }
  transPhase = 'fade-in';
}

// ── 封印の鍵アイテムを床のランダムな歩行可能タイルに設置 ──
function _placeSealKeyOnFloor(boss) {
  const name = boss.sealLabel ?? '封印の鍵';
  for (let att = 0; att < 2000; att++) {
    const tx = Math.floor(Math.random() * map.cols);
    const ty = Math.floor(Math.random() * map.rows);
    if (!map.isWalkable(tx, ty)) continue;
    if (map.getExitDir(tx, ty)) continue;
    if (map.isStairs(tx, ty)) continue;
    if (floorItems.some(fi => fi.tx === tx && fi.ty === ty)) continue;
    if (floorChests.some(c => c.tx === tx && c.ty === ty)) continue;
    if (shopPos && shopPos.tx === tx && shopPos.ty === ty) continue;
    if (player && tx === player.tx && ty === player.ty) continue;
    floorItems.push({
      tx, ty,
      item: { slot: 'seal_key', icon: '🗝', color: '#fbbf24', name },
    });
    logger.add(`🗝 どこかに「${name}」が落ちているようだ…`, 'info');
    return;
  }
}

// ── 封印の状態更新（ターン終了時などに呼ぶ） ──────────
// 護衛/石像タイプ: 封印ミニオンが全滅したら封印解除。
// 鍵タイプ: 拾った時点で解除されるため、ここでは何もしない。
function _updateSealState() {
  if (!enemies) return;
  for (const boss of enemies) {
    if (!boss.alive || !boss.isBoss || !boss.riddleActive) continue;
    if (boss.sealType === 'guards' || boss.sealType === 'statues') {
      const remaining = enemies.some(m => m.alive && m.isSealMinion);
      if (!remaining) {
        boss.riddleActive   = false;
        boss.riddleAnswered = true;
        logger.add(`✅ 封印が解けた！${boss.name} に挑め！`, 'heal');
        flashColor = 'rgba(253,224,71,0.35)';
        flashAlpha = 1;
        const { sx, sy } = boss.screenPos(camOffX, camOffY);
        floatingTexts.push({
          text: '🔓 封印解除！', x: sx, y: sy - 36,
          alpha: 1, scale: 1.2, color: '#fde047',
          life: 2.0, maxLife: 2.0, big: true,
        });
        particles.spawn(sx, sy, '#fde047', 30);
      }
    }
  }
}

// ── デバッグ: 現在のダンジョンのボス階へワープ ──────────
function _debugWarpToBoss() {
  if (gamePhase !== 'DUNGEON' || !currentDungeon) {
    logger.add('⚠ デバッグ: ダンジョンに入っていません', 'warn');
    return;
  }
  const prev = floorNumber;
  let target;
  if (currentDungeon.bossRush) {
    // 各 wave がボス。次の wave へ（最終 wave でクランプ）
    target = Math.min(floorNumber + 1, currentDungeon.maxFloors);
  } else if (currentDungeon.infinite) {
    // 次の 10 の倍数階（＝次のボス階）
    target = Math.floor(floorNumber / 10) * 10 + 10;
  } else {
    target = currentDungeon.maxFloors;
  }
  if (target === prev) {
    logger.add('⚠ デバッグ: 既にボス階にいます', 'warn');
    return;
  }
  floorNumber = target;
  turnCount   = 0;
  _buildFloor(null);
  logger.add(`🐉 デバッグワープ: ${prev} → ${target} 階`, 'warn');
  floatingTexts.push({
    text: `DEBUG WARP → ${target}F`,
    x: CANVAS_W / 2, y: CANVAS_H / 2 - 60,
    alpha: 1, scale: 1, color: '#fbbf24', life: 2.0, maxLife: 2.0, big: true,
  });
}

function _startDungeon(dungeonId) {
  const dungeon = DUNGEONS.find(d => d.id === dungeonId);
  if (!dungeon) return;
  currentDungeon = dungeon;
  gamePhase      = 'DUNGEON';
  floorNumber    = 1;
  turnCount      = 0;
  _buildFloor(null);
  const floorLabel = dungeon.infinite ? '∞' : dungeon.maxFloors;
  const msg = dungeon.bossRush
    ? `${dungeon.emoji} ${dungeon.name} 開始！全${floorLabel}波を制覇せよ！`
    : `${dungeon.emoji} ${dungeon.name} に踏み込んだ！（全${floorLabel}階）`;
  logger.add(msg, 'warn');
  floatingTexts.push({
    text: `${dungeon.emoji} ${dungeon.name}`,
    x: CANVAS_W / 2, y: CANVAS_H / 2 - 60,
    alpha: 1, scale: 1, color: dungeon.color, life: 3.0, maxLife: 3.0, big: true,
  });
}

function _returnToBase(fromClear = false) {
  // メタ進行：到達フロアに応じて魂を獲得
  if (gamePhase === 'DUNGEON') {
    const reached = floorNumber || 1;
    const baseReward = calcSoulsReward(reached, fromClear);
    const reward  = baseReward > 0
      ? Math.max(1, Math.floor(baseReward * _weSoulsMul()))
      : 0;
    if (reward > 0) {
      addSouls(reward);
      _titleReportSouls(reward);
      const evt = getActiveEvent();
      const soulBonus = reward > baseReward ? `（${evt.name} +${reward - baseReward}）` : '';
      logger.add(`👻 魂を ${reward} 獲得した${soulBonus}（所持: ${getSouls()}）`, 'warn');
      floatingTexts.push({
        text: `+${reward} 魂`, x: CANVAS_W / 2, y: CANVAS_H / 2 + 10,
        alpha: 1, scale: 1, color: '#c084fc', life: 2.5, maxLife: 2.5, big: false,
      });
    }
    // デイリー挑戦：スコア記録（ベスト更新時のみ表示）
    if (dailyMode && dailyDateKey && player) {
      const summary = {
        floor:   reached,
        lv:      player.lv ?? 1,
        hp:      Math.max(0, player.hp ?? 0),
        maxHp:   player.totalMaxHP ?? player.maxHP ?? 1,
        gold:    player.gold ?? 0,
        cleared: !!fromClear,
      };
      const { score, isBest } = recordDailyResult(dailyDateKey, summary);
      logger.add(`☀ デイリー Score: ${score}${isBest ? '（ベスト更新！）' : ''}`, 'warn');
      floatingTexts.push({
        text: `☀ Score ${score}${isBest ? ' NEW' : ''}`,
        x: CANVAS_W / 2, y: CANVAS_H / 2 + 50,
        alpha: 1, scale: 1, color: isBest ? '#fde68a' : '#fef3c7',
        life: 3.0, maxLife: 3.0, big: false,
      });
      // デイリーは1日1回のみ：終了したら通常モードへ戻す
      dailyMode = false;
      restoreRandom();
    }
  }
  if (!fromClear && player) {
    // 死亡時: 所持品を失う（装備は保持）
    player.inventory = [];
    player.gold      = Math.floor(player.gold * 0.75);
    logger.add('💀 所持品を失い、拠点に戻った…', 'warn');
  }
  // 委託露店アイテムの自動売却
  if (stallItems.length > 0 && player) {
    let totalGold = 0;
    for (const { price } of stallItems) totalGold += price;
    player.gold = (player.gold ?? 0) + totalGold;
    logger.add(`🏪 委託露店で ${stallItems.length} 件が売れた！ +${totalGold}G`, 'warn');
    stallItems = [];
  }
  // 借金の強制回収（拠点帰還時）
  if (loanDebt > 0 && player) {
    const pay = Math.min(loanDebt, player.gold);
    if (pay > 0) {
      player.gold -= pay;
      loanDebt    -= pay;
      logger.add(`💸 帰還時に ${pay}G を自動回収された。残債: ${loanDebt}G`, 'warn');
    }
    // まだ借金が残っていれば差し押さえ
    if (loanDebt > 0 && player.inventory.length > 0) {
      const seized = player.inventory.splice(0, Math.min(player.inventory.length, Math.ceil(loanDebt / 100)));
      const names  = seized.map(s => s.icon + s.name).join('、');
      logger.add(`💸 借金のかた ${names} を差し押さえられた！`, 'warn');
    }
    if (loanDebt <= 0) {
      loanDebt = 0;
      loanQuestActive = false;
      logger.add('✅ 借金を完済した！', 'info');
    }
  }
  // 拠点フィールドへ帰還（ダンジョン入口の前にスポーン）
  const firstPortal = BASE_PORTALS[0];
  const returnAt = firstPortal
    ? { tx: firstPortal.tx, ty: firstPortal.ty + 1 }
    : BASE_SPAWN;
  _buildBase();
  _placePlayer(returnAt.tx, returnAt.ty);
  logger.add('🏠 王都アストラルに帰還した。', 'warn');
}

function _dungeonClear() {
  const dungeon = currentDungeon;
  transAlpha = 0;
  transPhase = 'none';
  gameState = 'DUNGEON_CLEAR';
  clearedDungeons.add(dungeon.id); // クリア記録
  logger.add(`🎉 ${dungeon.name} をクリアした！`, 'warn');
  pushPlayerEvent(`${dungeon.name} クリア！`, 'achieve');
  floatingTexts.push({
    text: '🎉 DUNGEON CLEAR!',
    x: CANVAS_W / 2, y: CANVAS_H / 2 - 70,
    alpha: 1, scale: 1, color: '#fde68a', life: 5.0, maxLife: 5.0, big: true,
  });
  floatingTexts.push({
    text: dungeon.name,
    x: CANVAS_W / 2, y: CANVAS_H / 2,
    alpha: 1, scale: 1, color: dungeon.color, life: 5.0, maxLife: 5.0, big: true,
  });
  flashColor = 'rgba(250,204,21,0.5)'; flashAlpha = 1;
  setTimeout(() => _returnToBase(true), 4000);
}

// ── セーブ・ロード（3スロット対応） ─────────────────────
// getSlotData / hasAnySave → src/systems/saves.ts に移動済み
const _getSlotData = getSlotData;
const _hasAnySave  = hasAnySave;

// 装備・インベントリのアイテムを保存形式へ。呪い・祝福・未鑑定や
// 効果値（cursed/blessedで増減）を残す。
function _serializeItem(item, count) {
  if (!item) return null;
  const out = { id: item.id };
  if (count !== undefined) out.count = count;
  if (item.cursed)             out.cursed     = true;
  if (item.blessed)            out.blessed    = true;
  if (item.identified === false) out.identified = false;
  if (item.atk        !== undefined) out.atk        = item.atk;
  if (item.def        !== undefined) out.def        = item.def;
  if (item.maxHp      !== undefined) out.maxHp      = item.maxHp;
  if (item.durability !== undefined) out.durability = item.durability;
  return out;
}

function _deserializeItem(entry) {
  if (!entry) return null;
  // 旧形式: 文字列（= id）または { id, count } のみ
  const id = typeof entry === 'string' ? entry : entry.id;
  if (!id || !ITEMS[id]) return null;
  const base = { ...ITEMS[id] };
  if (typeof entry === 'object') {
    if (entry.count      !== undefined) base.count      = entry.count;
    if (entry.cursed)                   base.cursed     = true;
    if (entry.blessed)                  base.blessed    = true;
    if (entry.identified === false)     base.identified = false;
    if (entry.atk        !== undefined) base.atk        = entry.atk;
    if (entry.def        !== undefined) base.def        = entry.def;
    if (entry.maxHp      !== undefined) base.maxHp      = entry.maxHp;
    if (entry.durability !== undefined) base.durability = entry.durability;
  }
  return base;
}

function _saveToSlot(slot) {
  if (!player) return;
  try {
    const save = {
      v: 3, floor: floorNumber, cls: player.classType,
      build: playerBuild, mystery: mysteryMode,
      gold: player.gold, stones: player.stones ?? 0, wood: player.wood ?? 0,
      lv: player.lv, exp: player.exp,
      expNext: player.expNext, hp: player.hp, mp: player.mp,
      baseAtk: player.baseAtk, baseDef: player.baseDef,
      baseMaxHP: player.baseMaxHP, baseSpd: player.baseSpd,
      baseLuk: player.baseLuk, baseMp: player.baseMp,
      buildBonus: player.buildBonus,
      appearance: player.appearance ?? null,
      pet:        playerPetKind ?? null,
      equip: {
        weapon:    _serializeItem(player.equip.weapon),
        head:      _serializeItem(player.equip.head),
        chest:     _serializeItem(player.equip.chest),
        waist:     _serializeItem(player.equip.waist),
        legs:      _serializeItem(player.equip.legs),
        accessory: _serializeItem(player.equip.accessory),
      },
      inventory: player.inventory.map(i => _serializeItem(i, i.count ?? 1)),
      spells:    [...player.spells],
      baseChest: baseChest.map(i => i.id ?? i.name),
      dungeonId:       currentDungeon?.id ?? null,
      clearedDungeons: [...clearedDungeons],
      savedAt:         Date.now(),
    };
    localStorage.setItem(SAVE_SLOT_KEYS[slot], JSON.stringify(save));
  } catch {}
}

function _loadFromSlot(slot) {
  try {
    const s = _getSlotData(slot);
    if (!s || s.v < 2) return;

    playerClass     = s.cls ?? 'warrior';
    playerBuild     = s.build ?? 'balanced';
    mysteryMode     = s.mystery ?? false;
    // 旧セーブに見た目情報がなければ既存のプレイヤー見た目を継承（= 新しく選んだもの／null）
    if (s.appearance && APPEARANCES[s.appearance.species]) {
      playerAppearance = { species: s.appearance.species, tint: s.appearance.tint };
    }
    playerPetKind = (s.pet && PETS[s.pet]) ? s.pet : null;
    pet           = null; // 再配置は _placePlayer で行う
    floorNumber     = Math.max(1, s.floor ?? 1);
    clearedDungeons = new Set(s.clearedDungeons ?? []);
    player        = null;
    enemies       = [];
    showInventory = false;
    showMagic     = false;

    baseChest = (s.baseChest ?? [])
      .filter(id => ITEMS[id])
      .map(id => ({ ...ITEMS[id] }));

    _buildBase();

    player.gold      = s.gold ?? 0;
    player.stones    = s.stones ?? 0;
    player.wood      = s.wood ?? 0;
    player.lv        = s.lv ?? 1;
    player.exp       = s.exp ?? 0;
    player.expNext   = s.expNext ?? 10;
    player.baseAtk   = s.baseAtk ?? player.baseAtk;
    player.baseDef   = s.baseDef ?? player.baseDef;
    player.baseMaxHP = s.baseMaxHP ?? player.baseMaxHP;
    player.baseSpd   = s.baseSpd ?? player.baseSpd;
    player.baseLuk   = s.baseLuk ?? player.baseLuk;
    player.baseMp    = s.baseMp ?? player.baseMp;
    if (s.buildBonus) player.buildBonus = s.buildBonus;
    player.maxHP = player.totalMaxHP;
    player.hp    = Math.min(s.hp ?? player.maxHP, player.maxHP);
    player.mp    = Math.min(s.mp ?? player.totalMaxMp, player.totalMaxMp);

    for (const slot of ['weapon', 'head', 'chest', 'waist', 'legs', 'accessory']) {
      const item = _deserializeItem(s.equip?.[slot]);
      if (item) player.equip[slot] = item;
    }
    // 旧フォーマット互換: v3以前の `armor` は chest へマップ
    if (s.equip?.armor && !player.equip.chest) {
      const armorItem = _deserializeItem(s.equip.armor);
      if (armorItem) player.equip.chest = armorItem;
    }
    player.inventory = (s.inventory ?? [])
      .map(_deserializeItem)
      .filter(it => it !== null)
      .slice(0, player.maxInventory);
    player.spells = s.spells ?? player.spells;

    if (s.dungeonId) {
      const dungeon = DUNGEONS.find(d => d.id === s.dungeonId);
      if (dungeon) {
        currentDungeon = dungeon;
        gamePhase      = 'DUNGEON';
        turnCount      = 0;
        _buildFloor(null);
        gameState = 'PLAYER_TURN';
        logger.clear();
        const dateStr = s.savedAt
          ? formatSavedAt(s.savedAt)
          : '';
        logger.add(`💾 ${dungeon.emoji}${dungeon.name} ${floorNumber}層から再開！ LV${player.lv}${dateStr ? `（${dateStr}保存）` : ''}`, 'warn');
        return;
      }
    }

    gameState = 'PLAYER_TURN';
    logger.clear();
    logger.add(`💾 セーブデータをロードした（LV${player.lv} / ${player.gold}G）`, 'warn');
  } catch (e) {
    console.error('Load failed:', e);
  }
}

function _dirLabel(dir) {
  return { N: '北', S: '南', W: '西', E: '東' }[dir] ?? dir;
}

// ── 入力 → アクション変換 ────────────────────
function _readAction() {
  const shift = input.isDown('ShiftLeft') || input.isDown('ShiftRight');

  const alt = input.isDown('AltLeft') || input.isDown('AltRight');

  // Alt＋方向キー：その場で向きだけ変える（ターン消費なし）
  if (alt) {
    if (input.justPressed('ArrowUp')    || input.justPressed('KeyW')) return { type:'TURN', dx: 0, dy:-1 };
    if (input.justPressed('ArrowDown')  || input.justPressed('KeyS')) return { type:'TURN', dx: 0, dy: 1 };
    if (input.justPressed('ArrowLeft')  || input.justPressed('KeyA')) return { type:'TURN', dx:-1, dy: 0 };
    if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) return { type:'TURN', dx: 1, dy: 0 };
  }

  // 方向キー：Shift＝ダッシュ（壁まで）、通常＝1歩（長押しリピート対応）
  const moveType = shift ? 'DASH' : 'MOVE';
  if (input.heldRepeat('ArrowUp')    || input.heldRepeat('KeyW')) return { type:moveType, dx: 0, dy:-1 };
  if (input.heldRepeat('ArrowDown')  || input.heldRepeat('KeyS')) return { type:moveType, dx: 0, dy: 1 };
  if (input.heldRepeat('ArrowLeft')  || input.heldRepeat('KeyA')) return { type:moveType, dx:-1, dy: 0 };
  if (input.heldRepeat('ArrowRight') || input.heldRepeat('KeyD')) return { type:moveType, dx: 1, dy: 0 };

  // 斜め移動（常に1歩）
  if (input.justPressed('KeyQ') || input.justPressed('KeyY')) return { type:'MOVE', dx:-1, dy:-1 };
  if (input.justPressed('KeyE')) return { type:'MOVE', dx: 1, dy:-1 };
  if (input.justPressed('KeyZ')) return { type:'MOVE', dx:-1, dy: 1 };
  if (input.justPressed('KeyC')) return { type:'MOVE', dx: 1, dy: 1 };

  // Space＝向いている方向へ攻撃
  if (input.justPressed('Space')) return { type:'ATTACK_DIR' };

  // .（ピリオド）or F＝待機
  if (input.justPressed('Period') || input.justPressed('KeyF')) return { type:'WAIT' };

  // ⛏ KeyG＝向いている方向の壁を掘る（テーマ別に石/木を入手）
  if (input.justPressed('KeyG')) return { type:'BREAK_WALL' };
  // 🧱 KeyT＝向いている方向に石壁を置く（石を1つ消費）
  if (input.justPressed('KeyT')) return { type:'PLACE_WALL', material: 'stone' };
  // 🪵 KeyV＝向いている方向に木壁を置く（木を1つ消費）
  if (input.justPressed('KeyV')) return { type:'PLACE_WALL', material: 'wood' };

  return null;
}

// ── 視線チェック（Bresenham + 対角コーナー遮断） ──
// _hasLOS / _isEnemyOnLine → src/systems/fov.ts に移動済み
function _hasLOS(x0, y0, x1, y1) {
  return hasLOS(map, x0, y0, x1, y1);
}
function _isEnemyOnLine(x0, y0, x1, y1, excludeEnemy) {
  return isActorOnLine(enemies, excludeEnemy, x0, y0, x1, y1);
}

// ── ターン処理 ────────────────────────────────
function _processTurn(action) {
  const ctx = _makePACtx();
  _processTurnFn(action, ctx);
  _syncPACtx(ctx);
  _updateSealState();
}

// ── 敵 AI 行動 ────────────────────────────────
// ── 魔法メニュー入力 ─────────────────────────────
function _handleMagicInput() {
  const spells = player.spells;

  if (spells.length > 0) {
    if (input.justPressed('ArrowUp') || input.justPressed('KeyW'))
      magicCursor = (magicCursor - 1 + spells.length) % spells.length;
    if (input.justPressed('ArrowDown') || input.justPressed('KeyS'))
      magicCursor = (magicCursor + 1) % spells.length;
  }

  // Digit1-6 でホットバースロットにセット
  for (let _si = 0; _si < 6; _si++) {
    if (input.justPressed(`Digit${_si + 1}`)) {
      const spellId = spells[magicCursor];
      if (spellId) {
        hotbar[_si] = spellId;
        const sp = SPELLS[spellId];
        logger.add(`🔑 スロット[${_si + 1}] ← 「${sp?.name ?? spellId}」をセット`, 'info');
      }
      return;
    }
  }

  if (input.justPressed('Enter')) {
    const spellId = spells[magicCursor];
    showMagic = false;
    _castPlayerSpell(spellId);
    _processTurnAfterCast();
  }
  if (input.justPressed('Escape')) {
    showMagic = false;
  }
}

function _castPlayerSpell(spellId) {
  const ctx = _makePACtx();
  _castPlayerSpellFn(spellId, ctx);
  _syncPACtx(ctx);
}

// 魔法発動後のターン進行
function _processTurnAfterCast() {
  const ctx = _makePACtx();
  _processTurnAfterCastFn(ctx);
  turnCount = ctx.turnCount;
  loanDebt  = ctx.loanDebt;
  loanQuestActive = ctx.loanQuestActive;
  _updateSealState();
}

// ── 攻撃解決 → src/systems/combat.ts に移動済み ──────
function _attack(attacker, defender, rawAtk) {
  const result = _attackFn(attacker, defender, rawAtk, {
    player, logger, particles, camOffX, camOffY,
    onFlash:    color => { flashColor = color; flashAlpha = 1; },
    onShake:    (intensity, duration) => triggerShake(intensity, duration),
    onHitStop:  seconds => triggerHitStop(seconds),
    onFloatingText: t => floatingTexts.push(t),
  });
  // プレイヤーが敵を倒した時のみクエスト討伐カウント & 称号統計
  if (attacker === player && defender !== player && !defender.alive) {
    _questReportKill();
    _titleReportKill(!!defender.isBoss);
  }
  return result;
}

// ── 描画 ──────────────────────────────────────
function _draw(ctx, W, H, now) {
  if (gameState === 'TITLE') {
    drawTitle(ctx, W, H, { titleCursor });
    return;
  }
  if (gameState === 'SAVE_SLOT' && !player) {
    ctx.fillStyle = '#060118';
    ctx.fillRect(0, 0, W, H);
    drawSaveSlot(ctx, W, H, { saveSlotMode, saveSlotCursor });
    return;
  }
  if (gameState === 'CHAR_CREATE') {
    drawCharCreate(ctx, W, H, {
      speciesCursor: charSpeciesCursor,
      tintCursor:    charTintCursor,
      focusGroup:    charFocusGroup,
      dailyMode:     dailyMode,
      dailyDateKey:  dailyDateKey,
      petCursor:     charPetCursor,
    });
    return;
  }
  if (gameState === 'CLASS_SELECT') {
    drawClassSelect(ctx, W, H, { classCursor });
    return;
  }
  if (gameState === 'BUILD_SELECT') {
    drawBuildSelect(ctx, W, H, { playerClass, buildCursor, mysteryMode });
    return;
  }

  if (!player) return;

  camOffX = W / 2 - player.renderX + shakeX;
  camOffY = H / 2 - player.renderY + shakeY;

  ctx.fillStyle = map ? (THEMES[map.theme]?.bg ?? '#0a0812') : '#0a0812';
  ctx.fillRect(0, 0, W, H);

  map.draw(ctx, camOffX, camOffY, now);

  // ── ビネット（画面周辺を暗く・奥行き演出）─────────
  drawVignette(ctx, W, H);

  // 拠点オブジェクト描画
  if (gamePhase === 'BASE') {
    drawBaseObjects(ctx, camOffX, camOffY, now, {
      player, baseChestCount: baseChest.length, baseShopCount: baseShopItems.length,
      stallCount: stallItems.length, loanDebt, sprites, clearedDungeons,
      questActive: _questActiveCount(), questClaimable: _questClaimableCount(),
    });
  }
  // 向き・攻撃範囲プレビュー
  if (gameState === 'PLAYER_TURN' && !showInventory && !showMagic && gamePhase !== 'BASE') {
    drawAttackPreview(ctx, camOffX, camOffY, { player, enemies });
  }

  // 敵攻撃範囲ビジュアライザ
  if (gamePhase !== 'BASE') {
    drawEnemyRanges(ctx, camOffX, camOffY, now, { player, enemies, map });
  }

  // 床アイテム描画
  drawFloorItems(ctx, camOffX, camOffY, { floorItems, sprites });

  // 宝箱描画
  drawChests(ctx, camOffX, camOffY, { floorChests, exploredTiles, player, sprites });

  // 露店アイコン描画
  if (shopPos) {
    const ts = TILE_SIZE;
    const sx = shopPos.tx * ts + ts / 2 + camOffX;
    const sy = shopPos.ty * ts + ts / 2 + camOffY;
    if (sx > -ts && sx < CANVAS_W + ts && sy > -ts && sy < CANVAS_H + ts) {
      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur  = 12;
      if (sprites.get('ui_shop')) {
        sprites.draw(ctx, 'ui_shop', sx, sy, ts, ts);
      } else {
        ctx.font = '20px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏪', sx, sy);
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  for (const e of enemies) if (e.alive) e.drawShadow(ctx, camOffX, camOffY);
  if (player.alive) player.drawShadow(ctx, camOffX, camOffY);

  // ペットの位置補間 + Y ソート用 renderY 計算
  let petRenderY = 0;
  if (pet && pet.alive) {
    pet.advanceAnim(1 / 60);
    const t  = pet.moveT;
    const px = ((1 - t) * pet.fromTx + t * pet.tx + 0.5) * TILE_SIZE;
    const py = ((1 - t) * pet.fromTy + t * pet.ty + 0.5) * TILE_SIZE;
    petRenderY = py + camOffY;
    pet._sx = px + camOffX;
    pet._sy = py + camOffY;
    // 影
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(pet._sx, pet._sy + TILE_SIZE * 0.42, TILE_SIZE * 0.32, TILE_SIZE * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const sortable = [...enemies.filter(e => e.alive), player];
  if (pet && pet.alive) sortable.push({ __isPet: true, renderY: petRenderY });
  // 拠点NPC（BaseNpc）の Y ソート用 renderY は draw 後に更新するので、
  // 仮の renderY をここで先に計算しておく
  if (gamePhase === 'BASE') {
    for (const n of baseNpcs) {
      const t  = n.moveT;
      const py = ((1 - t) * n.fromTy + t * n.ty + 0.5) * TILE_SIZE + camOffY;
      sortable.push({ __isBaseNpc: true, npc: n, renderY: py });
    }
  }
  sortable.sort((a, b) => a.renderY - b.renderY);
  for (const actor of sortable) {
    if (actor.__isBaseNpc) {
      actor.npc.draw(ctx, camOffX, camOffY);
    } else if (actor.__isPet) {
      // ペット描画
      const facing = (player && player.tx > pet.tx) ? 'side' : (player && player.tx < pet.tx ? 'side' : 'front');
      const walking = pet.moveT < 1;
      ctx.save();
      pet.draw(ctx, pet._sx, pet._sy, TILE_SIZE * 0.78, facing, walking);
      ctx.restore();
      // HPバー（小さく）
      if (pet.hp < pet.maxHp) {
        const bw = 36, bh = 4;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(pet._sx - bw / 2, pet._sy - TILE_SIZE * 0.45, bw, bh);
        ctx.fillStyle = '#86efac';
        ctx.fillRect(pet._sx - bw / 2, pet._sy - TILE_SIZE * 0.45, bw * (pet.hp / pet.maxHp), bh);
      }
    } else if (actor === player) {
      player.draw(ctx, sprites, camOffX, camOffY);
    } else {
      // Floor depth tint via hue-rotate
      const tier = Math.min(4, Math.floor((floorNumber - 1) / 5));
      const hues = [0, 20, 45, 90, 150];
      const hue  = hues[tier];
      if (hue > 0) ctx.filter = `hue-rotate(${hue}deg) saturate(1.4)`;
      actor.draw(ctx, sprites, camOffX, camOffY, now);
      if (hue > 0) ctx.filter = 'none';
    }
  }

  particles.draw(ctx);

  // ── 埃・ちり（アクター上に漂う空気感）────────
  if (gamePhase === 'DUNGEON') _drawDust(ctx);

  // 魔法VFX 描画
  drawMagicEffects(magicEffects, {
    ctx, camOffX, camOffY, TILE_SIZE, W, H, particles,
    onShake: triggerShake,
  });

  // AOEフラッシュ描画
  for (const f of aoeFlash) {
    if (f.alpha <= 0) continue;
    const fx = f.tx * TILE_SIZE + camOffX;
    const fy = f.ty * TILE_SIZE + camOffY;
    ctx.save();
    ctx.globalAlpha = f.alpha * 0.55;
    ctx.fillStyle   = f.color + '1)';
    ctx.fillRect(fx, fy, TILE_SIZE, TILE_SIZE);
    ctx.restore();
  }

  // 矢・魔法弾の描画
  for (const a of arrows) {
    const sx = a.wx + (a.twx - a.wx) * a.progress + camOffX;
    const sy = a.wy + (a.twy - a.wy) * a.progress + camOffY;
    const angle = Math.atan2(a.twy - a.wy, a.twx - a.wx);
    ctx.save();
    if (a.isMagic) {
      // ── 魔法弾：長いトレイル ─────────────────
      ctx.globalCompositeOperation = 'lighter';
      const segments = 9;
      for (let i = segments - 1; i >= 0; i--) {
        const back = i * 5;
        const alpha = (1 - i / segments) * 0.9;
        const r = 5 * (1 - i / segments * 0.7);
        ctx.globalAlpha = alpha;
        ctx.shadowColor = a.color;
        ctx.shadowBlur  = 14;
        ctx.fillStyle   = a.color;
        ctx.beginPath();
        ctx.arc(sx - Math.cos(angle) * back, sy - Math.sin(angle) * back, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // コア（白く光る芯）
      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 18;
      ctx.fillStyle   = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // ── 矢：軌跡線 ─────────────────────────
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = 'rgba(252,211,77,0.6)';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(sx - Math.cos(angle) * 28, sy - Math.sin(angle) * 28);
      ctx.lineTo(sx - Math.cos(angle) * 10, sy - Math.sin(angle) * 10);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.shadowColor = '#fcd34d';
      ctx.shadowBlur  = 10;
      ctx.strokeStyle = '#c08030';
      ctx.lineWidth   = 2.5;
      ctx.beginPath();
      ctx.moveTo(sx - Math.cos(angle) * 10, sy - Math.sin(angle) * 10);
      ctx.lineTo(sx + Math.cos(angle) * 4, sy + Math.sin(angle) * 4);
      ctx.stroke();
      ctx.fillStyle   = '#fcd34d';
      ctx.shadowBlur  = 0;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── ヴィネット（ダンジョンのみ・プレイヤー中心 FOV） ──────
  if (gamePhase === 'DUNGEON' && player) {
    const { sx: psx, sy: psy } = player.screenPos(camOffX, camOffY);
    const outer = Math.max(W, H) * 0.78;
    // 外側の暗化（視界外）— 奥に行くほど青みがかった闇
    const grad  = ctx.createRadialGradient(psx, psy, TILE_SIZE * 2.0, psx, psy, outer);
    grad.addColorStop(0,    'rgba(0,0,0,0)');
    grad.addColorStop(0.5,  'rgba(4,6,14,0.48)');
    grad.addColorStop(1,    'rgba(2,4,10,0.92)');
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // 中心の暖色光（プレイヤー周辺の松明的な明かり）
    const warm = ctx.createRadialGradient(psx, psy, 0, psx, psy, TILE_SIZE * 3.0);
    warm.addColorStop(0,   'rgba(255,170,80,0.34)');
    warm.addColorStop(0.5, 'rgba(255,130,50,0.14)');
    warm.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (flashAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle   = flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // HUD / minimap / effects → src/ui/hud.ts に移動済み
  drawHUD(ctx, W, H, { player, enemies, gamePhase, currentDungeon, floorNumber, turnCount });
  drawHotbar(ctx, W, H, { player, hotbar, gamePhase, sprites });
  drawBossHPBar(ctx, W, enemies);
  drawMinimap(ctx, W, H, { map, player, enemies, exploredTiles, floorItems, floorChests, shopPos });
  drawFloatingTexts(ctx, floatingTexts);

  // チャットティッカー（拠点では大きめ、ダンジョン中はコンパクト）
  drawChatTicker(ctx, W, H, gamePhase === 'DUNGEON');

  // サーバー情報（右上オーバーレイ）
  drawServerInfo(ctx, W, H);

  if (showInventory) drawInventory(ctx, W, H, { player, invCursor, sprites });
  if (showMagic)     drawMagicMenu(ctx, W, H, { player, magicCursor });
  if (shopOpen)      drawShopMenu(ctx, W, H, { player, shopItems, shopCursor });
  if (baseChestOpen) drawBaseChest(ctx, W, H, { player, baseChest, baseChestSide, baseCursor });
  if (baseShopOpen)  drawBaseShop(ctx, W, H, { player, baseShopItems, baseShopCursor });
  if (casinoOpen)    drawCasino(ctx, W, H, {
    player, casinoMode, casinoCursor,
    bjPhase, bjBet, bjHand, bjDealerHand, bjResult, bjMsg,
    rlPhase, rlSpinAngle, rlBetType, rlBet, rlNumber, rlResult, rlMsg,
    ccPhase, ccBet, ccPlayerDice, ccPlayerRolls, ccDealerDice, ccWin, ccMsg,
    ccPlayerRollAnim, ccDealerRollAnim,
    slPhase, slBet, slReels, slReelOffsets, slReelStopped, slWin, slMsg,
  });
  if (stallOpen)     drawStall(ctx, W, H, { player, stallItems, stallCursor, stallPriceFn: _stallPrice });
  if (loanOpen)      drawLoan(ctx, W, H, {
    player, loanRepayMode, loanDebt, loanQuestActive, loanRepayCursor, loanCursor,
  });
  if (reclassOpen)   drawReclassMenu(ctx, W, H, { player, reclassCursor, cost: _reclassCost() });
  if (craftOpen)     drawCraftMenu(ctx, W, H, { player, craftCurA, craftCurB, craftSide });
  if (shrineOpen)    _drawShrine(ctx, W, H);
  if (questOpen)     drawQuestBoard(ctx, W, H, { quests: getDailyQuests(), cursor: questCursor });
  if (rankingOpen)   drawRanking(ctx, W, H, { list: getDailyRanking(), cursor: rankingCursor });
  if (titleMenuOpen) drawTitleMenu(ctx, W, H, { items: _TITLES, cursor: titleMenuCursor });

  if (transAlpha > 0) {
    ctx.fillStyle = `rgba(0,0,0,${transAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    if (transPhase === 'fade-out' && transAlpha > 0.5) {
      ctx.save();
      ctx.globalAlpha  = Math.min(1, (transAlpha - 0.5) * 2);
      ctx.font         = 'bold 18px monospace';
      ctx.fillStyle    = '#f5c842';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${floorNumber} 層`, W / 2, H / 2);
      ctx.restore();
    }
  }

  if (gameState === 'GAME_OVER') drawGameOver(ctx, W, H, { gameOverTimer });
  if (gameState === 'SAVE_SLOT') drawSaveSlot(ctx, W, H, { saveSlotMode, saveSlotCursor });

  // 無限ダンジョン脱出確認プロンプト
  if (infiniteEscapePrompt) drawInfiniteEscapePrompt(ctx, W, H, { floorNumber, infiniteEscapeCursor });
}


// ─── アイテムSVG描画ヘルパー → src/ui/item-renderer.ts に移動済み ─────





// _drawHUD / _drawBossHPBar / _drawMinimap / _drawFloatingTexts / _drawHotbar
// → src/ui/hud.ts に移動済み


// ── 露店メニュー ───────────────────────────────



// ── 委託露店UI ─────────────────────────────────

// ── 宝箱UI ─────────────────────────────────────

// ── 拠点ショップ UI ───────────────────────────

// ── カジノ UI ─────────────────────────────────


// ── 金貸し UI ─────────────────────────────────

// ── 装備・所持品画面 ───────────────────────────
// ── MC スロット描画ヘルパー ──────────────────────


// ── 職業選択画面 ───────────────────────────────



// ── ビルド選択画面 ──────────────────────────────

function _handleTitleInput() {
  const hasAny = _hasAnySave();
  // メニュー: 0=はじめから, 1=続きから（あれば）, 末尾=デイリー挑戦
  const items = ['new'];
  if (hasAny) items.push('continue');
  items.push('daily');
  const maxIdx = items.length - 1;
  if (input.justPressed('ArrowUp') || input.justPressed('KeyW'))
    titleCursor = (titleCursor - 1 + maxIdx + 1) % (maxIdx + 1);
  if (input.justPressed('ArrowDown') || input.justPressed('KeyS'))
    titleCursor = (titleCursor + 1) % (maxIdx + 1);
  if (input.justPressed('Enter') || input.justPressed('Space')) {
    const sel = items[Math.min(titleCursor, maxIdx)];
    if (sel === 'new') {
      dailyMode = false;
      restoreRandom();
      gameState = 'CHAR_CREATE';
      charSpeciesCursor = 0;
      charTintCursor    = 0;
      charFocusGroup    = 'species';
      charPetCursor     = 0;
      pet               = null;
    } else if (sel === 'continue') {
      dailyMode = false;
      restoreRandom();
      saveSlotMode   = 'load';
      saveSlotFrom   = 'TITLE';
      saveSlotCursor = 0;
      gameState      = 'SAVE_SLOT';
    } else if (sel === 'daily') {
      // デイリー挑戦：今日の日付からシードを作って Math.random を上書き
      dailyMode    = true;
      dailyDateKey = todayKey();
      restoreRandom();
      installSeededRandom(dailySeedFor(dailyDateKey));
      gameState = 'CHAR_CREATE';
      charSpeciesCursor = 0;
      charTintCursor    = 0;
      charFocusGroup    = 'species';
      charPetCursor     = 0;
      pet               = null;
    }
  }
}

function _handleSaveSlotInput() {
  if (input.justPressed('ArrowUp') || input.justPressed('KeyW'))
    saveSlotCursor = (saveSlotCursor + 2) % 3;
  if (input.justPressed('ArrowDown') || input.justPressed('KeyS'))
    saveSlotCursor = (saveSlotCursor + 1) % 3;

  if (input.justPressed('Escape') || input.justPressed('Backspace')) {
    gameState = saveSlotFrom;
    return;
  }

  if (input.justPressed('Enter') || input.justPressed('Space') || input.justPressed('KeyE')) {
    if (saveSlotMode === 'save') {
      _saveToSlot(saveSlotCursor);
      floatingTexts.push({
        text: `💾 スロット${saveSlotCursor + 1}にセーブ`,
        x: CANVAS_W / 2, y: CANVAS_H / 2 - 40,
        alpha: 1, scale: 1, color: '#86efac',
        life: 2.0, maxLife: 2.0,
      });
      gameState = saveSlotFrom;
    } else {
      const s = _getSlotData(saveSlotCursor);
      if (s) {
        _loadFromSlot(saveSlotCursor);
      }
    }
  }
}

function _handleCharCreateInput() {
  // ← → ：常に種族、 ↑ ↓ ：常に色（直観的に）
  if (input.justPressed('ArrowLeft') || input.justPressed('KeyA')) {
    charSpeciesCursor = (charSpeciesCursor - 1 + APPEARANCE_IDS.length) % APPEARANCE_IDS.length;
    charFocusGroup = 'species';
  }
  if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) {
    charSpeciesCursor = (charSpeciesCursor + 1) % APPEARANCE_IDS.length;
    charFocusGroup = 'species';
  }
  if (input.justPressed('ArrowUp') || input.justPressed('KeyW')) {
    charTintCursor = (charTintCursor - 1 + TINTS.length) % TINTS.length;
    charFocusGroup = 'tint';
  }
  if (input.justPressed('ArrowDown') || input.justPressed('KeyS')) {
    charTintCursor = (charTintCursor + 1) % TINTS.length;
    charFocusGroup = 'tint';
  }
  if (input.justPressed('KeyP')) {
    // 0=なし → 1..PET_KINDS.length をループ
    charPetCursor = (charPetCursor + 1) % (PET_KINDS.length + 1);
  }
  if (input.justPressed('Escape') || input.justPressed('Backspace')) {
    gameState = 'TITLE';
    return;
  }
  if (input.justPressed('Enter') || input.justPressed('Space')) {
    playerAppearance = {
      species: APPEARANCE_IDS[charSpeciesCursor],
      tint:    TINTS[charTintCursor].color,
    };
    playerPetKind = charPetCursor === 0 ? null : PET_KINDS[charPetCursor - 1];
    gameState   = 'CLASS_SELECT';
    classCursor = 0;
  }
}

function _handleClassSelectInput() {
  if (input.justPressed('ArrowLeft')  || input.justPressed('KeyA')) {
    classCursor = (classCursor - 1 + CLASS_IDS.length) % CLASS_IDS.length;
  }
  if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) {
    classCursor = (classCursor + 1) % CLASS_IDS.length;
  }
  if (input.justPressed('Enter') || input.justPressed('Space')) {
    playerClass = CLASS_IDS[classCursor];
    buildCursor = 0;
    gameState   = 'BUILD_SELECT';
  }
}

function _handleBuildSelectInput() {
  if (input.justPressed('ArrowLeft')  || input.justPressed('KeyA'))
    buildCursor = (buildCursor - 1 + BUILD_IDS.length) % BUILD_IDS.length;
  if (input.justPressed('ArrowRight') || input.justPressed('KeyD'))
    buildCursor = (buildCursor + 1) % BUILD_IDS.length;
  if (input.justPressed('ArrowUp')    || input.justPressed('KeyW'))
    buildCursor = (buildCursor - 3 + BUILD_IDS.length) % BUILD_IDS.length;
  if (input.justPressed('ArrowDown')  || input.justPressed('KeyS'))
    buildCursor = (buildCursor + 3) % BUILD_IDS.length;
  if (input.justPressed('Backspace') || input.justPressed('Escape'))
    gameState = 'CLASS_SELECT';
  // M キーで不思議ダンジョン切り替え
  if (input.justPressed('KeyM')) {
    mysteryMode = !mysteryMode;
  }
  if (input.justPressed('Enter') || input.justPressed('Space'))
    _startGame(playerClass, BUILD_IDS[buildCursor]);
}

// ── GAME OVER ─────────────────────────────────

// ── エントリーポイント ─────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('gameCanvas');
  const logEl  = document.getElementById('battleLog');
  await init(canvas, logEl);
  startLoop(canvas);

  // ── デバッグボタン: 現在のダンジョンのボス階へワープ ──
  const btnWarp = document.getElementById('btnWarpBoss');
  if (btnWarp) {
    btnWarp.addEventListener('click', () => {
      _debugWarpToBoss();
      btnWarp.blur(); // フォーカスをキャンバスへ戻す
    });
  }
});
