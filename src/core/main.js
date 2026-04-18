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
import { SPELLS, resolveSpell }        from '../data/magic.js';
import { CLASSES, CLASS_IDS } from '../data/classes.js';
import {
  CANVAS_W, CANVAS_H, MAP_COLS, MAP_ROWS, ENEMY_COUNT, MIN_SPAWN_DIST,
  ITEM_PER_FLOOR, SAVE_SLOT_KEYS,
  BASE_COLS, BASE_ROWS, BASE_SPAWN, BASE_CHEST_POS, BASE_PORTALS,
  BASE_SHOP_POS, BASE_CASINO_POS, BASE_STALL_POS, BASE_LOAN_POS,
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
import { attack as _attackFn }                                       from '../systems/combat.js';
import { hasLOS, isActorOnLine }                                      from '../systems/fov.js';
import { tickTransition }                                             from '../systems/transitions.js';
import { drawHUD, drawBossHPBar, drawMinimap, drawFloatingTexts, drawHotbar } from '../ui/hud.js';
import { drawMagicMenu, drawShopMenu, drawInventory } from '../ui/inventory.js';
import { tickWaveSpawn } from '../systems/wave-spawn.js';
import { drawCasino, drawLoan } from '../ui/casino.js';
import { drawStall, drawBaseChest, drawBaseShop } from '../ui/base.js';
import { drawTitle, drawSaveSlot, drawClassSelect, drawBuildSelect, drawGameOver } from '../ui/title.js';
import { drawAttackPreview, drawEnemyRanges, drawFloorItems, drawChests, drawInfiniteEscapePrompt } from '../ui/dungeon.js';
import { drawBaseObjects } from '../ui/base-objects.js';
import { getFloorTheme, spawnEnemies, placeFloorItems, placeChests, placeShop, assignTrapTypes, buildBaseShopItems } from '../systems/floor.js';
import { bjNewDeck as _bjNewDeck, bjHandValue as _bjHandValue, bjFinish, bjDeal, bjDealerPlay, rlFinish, ccFinish, ccRoll as _ccRoll, ccEval as _ccEval, ccCompare as _ccCompare, ccRankLabel as _ccRankLabel } from '../systems/casino-logic.js';
import { doEnemyTurn, processEnemyDeathTraits } from '../systems/enemy-ai.js';
import { processTurn as _processTurnFn, castPlayerSpell as _castPlayerSpellFn, processTurnAfterCast as _processTurnAfterCastFn } from '../systems/player-actions.js';

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

// 拠点・ダンジョン管理
let gamePhase      = 'BASE';  // 'BASE' | 'DUNGEON'
let currentDungeon = null;    // DUNGEONS[i] | null
let baseChest      = [];      // 預かりアイテム
let baseChestOpen  = false;
let baseChestSide  = 'chest'; // 'chest' | 'inventory'
let baseCursor     = 0;

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

// 不思議ダンジョン
let mysteryMode = false;

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
let casinoMode    = 'select'; // 'select'|'bj'|'roulette'|'chinchiro'
let casinoCursor  = 0;        // 0=BJ 1=ルーレット 2=チンチロ（選択画面）
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

// フローティングテキスト（レベルアップ通知など）
let floatingTexts = []; // [{text, x, y, alpha, scale, color, life, maxLife}]

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
  floorItems    = [];
  enemies       = [];
  shopOpen      = false;
  shopPos       = null;
  baseChestOpen = false;
  baseShopOpen  = false;
  casinoOpen      = false;
  casinoMode      = 'select';
  loanOpen        = false;
  loanRepayMode   = false;
  baseShopItems = buildBaseShopItems();
  _placePlayer(BASE_SPAWN.tx, BASE_SPAWN.ty);

  // 拠点は全タイル探索済みにする
  exploredTiles = new Set();
  for (let ty = 0; ty < BASE_ROWS; ty++)
    for (let tx = 0; tx < BASE_COLS; tx++)
      exploredTiles.add(`${tx},${ty}`);

  gameState = 'PLAYER_TURN';
  logger.add('🏠 拠点に戻った。ポータルに近づいてダンジョンへ挑もう！', 'warn');
}


function _buildFloor(entryDir) {
  const maxFloors   = currentDungeon?.maxFloors ?? 99;
  // 無限ダンジョン：10フロアごとにボス戦
  const isBossFloor = currentDungeon?.bossRush
    || (currentDungeon?.infinite ? floorNumber % 10 === 0 : floorNumber === maxFloors);
  isMonsterHouseFloor = !isBossFloor && Math.random() < 0.70;
  const theme = getFloorTheme(floorNumber, currentDungeon);
  const trapDensity = currentDungeon?.infinite ? 6 : 1;
  map = new GameMap(MAP_COLS, MAP_ROWS, theme, isBossFloor, trapDensity);


  particles.clear();
  floorItems    = [];
  floorChests   = [];
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
      const emoji = theme === 'forest' ? '🌲' : theme === 'town' ? '🏘️' : '🏚️';
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
    player = new Player(tx, ty, playerClass, BUILDS[playerBuild]?.bonus ?? null);
  } else {
    player.tx      = tx;
    player.ty      = ty;
    player.renderX = (tx + 0.5) * TILE_SIZE;
    player.renderY = (ty + 0.5) * TILE_SIZE;
    player.bumpX   = 0;
    player.bumpY   = 0;
    player.alive   = true; // 死亡状態のままにならないようリセット
    // 拠点帰還時は全回復、フロア移動時は少し回復
    if (gamePhase === 'BASE') {
      player.hp = player.maxHP;
    } else {
      player.hp = Math.min(player.hp + 2, player.maxHP);
    }
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
    flashColor = 'rgba(250,204,21,0.3)';
    flashAlpha = 1;
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
    onGameOver:       () => { gameState = 'GAME_OVER'; gameOverTimer = 2.0; ctx.gameState = 'GAME_OVER'; },
    onTransition:     () => { _startTransition(); ctx.gameState = gameState; },
    onUpdateExplored: () => _updateExplored(),
    onOpenChest:      (tx, ty) => _openChest(tx, ty),
    onTriggerTrap:    type => _triggerTrap(type),
    onShopOpen:       () => {},
    onLevelUps:       levels => _onLevelUps(levels),
    onEnemyTurn:      e => doEnemyTurn(e, _makeEnemyAICtx()),
    onProcessDeathTraits: dead => processEnemyDeathTraits(dead, _makeEnemyAICtx()),
    onTickWaveSpawn:  () => tickWaveSpawn({
      gamePhase, currentDungeon, floorNumber, turnCount: ctx.turnCount,
      map, player, enemies, logger,
      onFlash:        color => { flashColor = color; flashAlpha = 1; },
      onFloatingText: t     => floatingTexts.push(t),
    }),
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
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime  = ts;
    elapsed  += dt;

    if (player) {
      player.updateRender(dt);
      for (const e of enemies) e.updateRender(dt);
    }
    particles.update(dt);
    flashAlpha = Math.max(0, flashAlpha - dt * 6);

    // 矢アニメ更新
    for (const a of arrows) { a.progress += dt * 5; }
    arrows = arrows.filter(a => a.progress < 1);

    // AOEフラッシュフェードアウト
    for (const f of aoeFlash) { f.alpha = Math.max(0, f.alpha - dt * 4); }
    aoeFlash = aoeFlash.filter(f => f.alpha > 0);

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

    // フローティングテキスト更新
    for (const ft of floatingTexts) {
      ft.life -= dt;
      ft.y    -= dt * 28;
      ft.alpha = Math.max(0, ft.life / ft.maxLife);
      ft.scale = ft.life > ft.maxLife * 0.7
        ? 0.5 + 0.5 * (1 - (ft.life - ft.maxLife * 0.7) / (ft.maxLife * 0.3))
        : 1;
    }
    floatingTexts = floatingTexts.filter(ft => ft.life > 0);

    if (gameState === 'TITLE') {
      _handleTitleInput();
    } else if (gameState === 'SAVE_SLOT') {
      _handleSaveSlotInput();
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
        baseChestOpen = false; baseShopOpen = false; casinoOpen = false; stallOpen = false; loanOpen = false;
      }

      if (input.justPressed('KeyP')) {
        saveSlotMode   = 'save';
        saveSlotFrom   = 'PLAYER_TURN';
        saveSlotCursor = 0;
        gameState      = 'SAVE_SLOT';
      }

      if (gamePhase === 'BASE') {
        if (input.justPressed('KeyI') && !baseChestOpen && !baseShopOpen && !casinoOpen && !stallOpen) {
          showInventory = !showInventory; invCursor = 0;
        }
        if (baseChestOpen)     { _handleBaseChestInput(); }
        else if (baseShopOpen) { _handleBaseShopInput(); }
        else if (casinoOpen)   { _handleCasinoInput(); }
        else if (stallOpen)    { _handleStallInput(); }
        else if (loanOpen)     { _handleLoanInput(); }
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
        cx = nx; cy = ny;
        if (BASE_PORTALS.some(p => p.tx === cx && p.ty === cy)) break;
        if (cx === BASE_CHEST_POS.tx  && cy === BASE_CHEST_POS.ty)  break;
        if (cx === BASE_SHOP_POS.tx   && cy === BASE_SHOP_POS.ty)   break;
        if (cx === BASE_CASINO_POS.tx && cy === BASE_CASINO_POS.ty) break;
        if (cx === BASE_STALL_POS.tx  && cy === BASE_STALL_POS.ty)  break;
        if (cx === BASE_LOAN_POS.tx   && cy === BASE_LOAN_POS.ty)   break;
      }
      player.moveTo(cx, cy);
    } else {
      const ntx = player.tx + dx, nty = player.ty + dy;
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
    if (input.justPressed('ArrowLeft')  || input.justPressed('KeyA')) casinoCursor = (casinoCursor - 1 + 3) % 3;
    if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) casinoCursor = (casinoCursor + 1) % 3;
    if (input.justPressed('Enter') || input.justPressed('KeyE')) {
      if (casinoCursor === 0) {
        casinoMode = 'bj';
        bjPhase = 'bet';
        bjBet = Math.max(5, Math.min(bjBet, player.gold));
      } else if (casinoCursor === 1) {
        casinoMode = 'roulette';
        rlPhase = 'bet';
        rlBet = Math.max(5, Math.min(rlBet, player.gold));
      } else {
        casinoMode = 'chinchiro';
        ccPhase = 'bet';
        ccBet = Math.max(5, Math.min(ccBet, player.gold));
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
        player.gold -= ccBet;
        ccPlayerDice  = _ccRoll();
        ccPlayerRolls = 1;
        ccPhase = 'player_roll';
      }
    } else if (ccPhase === 'player_roll') {
      const pEv = _ccEval(ccPlayerDice);
      // 即時確定役（ピンゾロ・シゴロ・ヒフミ）はそのまま dealer rollへ
      if (pEv.rank === 100 || pEv.rank === 50 || pEv.rank === -1) {
        // 自動で dealer_rollへ
        if (input.justPressed('Enter') || input.justPressed('KeyE') || input.justPressed('Space')) {
          ccDealerDice = _ccRoll();
          ccPhase = 'dealer_roll';
          _ccFinish();
        }
      } else if (pEv.rank === 0 && ccPlayerRolls < 3) {
        // 役なし：再振り可能
        if (input.justPressed('Enter') || input.justPressed('KeyE') || input.justPressed('Space')) {
          ccPlayerDice  = _ccRoll();
          ccPlayerRolls++;
          const ev2 = _ccEval(ccPlayerDice);
          if (ev2.rank !== 0 || ccPlayerRolls >= 3) {
            ccDealerDice = _ccRoll();
            ccPhase = 'dealer_roll';
            _ccFinish();
          }
        }
      } else {
        // 役あり or 3回振り終わり
        if (input.justPressed('Enter') || input.justPressed('KeyE') || input.justPressed('Space')) {
          ccDealerDice = _ccRoll();
          ccPhase = 'dealer_roll';
          _ccFinish();
        }
      }
    } else if (ccPhase === 'result') {
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
    return;
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
  transPhase = 'fade-in';
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
  _buildBase();
}

function _dungeonClear() {
  const dungeon = currentDungeon;
  transAlpha = 0;
  transPhase = 'none';
  gameState = 'DUNGEON_CLEAR';
  clearedDungeons.add(dungeon.id); // クリア記録
  logger.add(`🎉 ${dungeon.name} をクリアした！`, 'warn');
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

function _saveToSlot(slot) {
  if (!player) return;
  try {
    const save = {
      v: 3, floor: floorNumber, cls: player.classType,
      build: playerBuild, mystery: mysteryMode,
      gold: player.gold, lv: player.lv, exp: player.exp,
      expNext: player.expNext, hp: player.hp, mp: player.mp,
      baseAtk: player.baseAtk, baseDef: player.baseDef,
      baseMaxHP: player.baseMaxHP, baseSpd: player.baseSpd,
      baseLuk: player.baseLuk, baseMp: player.baseMp,
      buildBonus: player.buildBonus,
      equip: {
        weapon:    player.equip.weapon?.id    ?? null,
        armor:     player.equip.armor?.id     ?? null,
        accessory: player.equip.accessory?.id ?? null,
      },
      inventory: player.inventory.map(i => i.id),
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

    for (const slot of ['weapon', 'armor', 'accessory']) {
      const id = s.equip?.[slot];
      if (id && ITEMS[id]) player.equip[slot] = { ...ITEMS[id] };
    }
    player.inventory = (s.inventory ?? [])
      .filter(id => ITEMS[id])
      .map(id => ({ ...ITEMS[id] }))
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
}

// ── 攻撃解決 → src/systems/combat.ts に移動済み ──────
function _attack(attacker, defender, rawAtk) {
  return _attackFn(attacker, defender, rawAtk, {
    player, logger, particles, camOffX, camOffY,
    onFlash: (color) => { flashColor = color; flashAlpha = 1; },
  });
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
  if (gameState === 'CLASS_SELECT') {
    drawClassSelect(ctx, W, H, { classCursor });
    return;
  }
  if (gameState === 'BUILD_SELECT') {
    drawBuildSelect(ctx, W, H, { playerClass, buildCursor, mysteryMode });
    return;
  }

  if (!player) return;

  camOffX = W / 2 - player.renderX;
  camOffY = H / 2 - player.renderY;

  ctx.fillStyle = map ? (THEMES[map.theme]?.bg ?? '#0a0812') : '#0a0812';
  ctx.fillRect(0, 0, W, H);

  map.draw(ctx, camOffX, camOffY, now);

  // 拠点オブジェクト描画
  if (gamePhase === 'BASE') {
    drawBaseObjects(ctx, camOffX, camOffY, now, {
      player, baseChestCount: baseChest.length, baseShopCount: baseShopItems.length,
      stallCount: stallItems.length, loanDebt, sprites, clearedDungeons,
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
  drawFloorItems(ctx, camOffX, camOffY, { floorItems });

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
      ctx.font = '20px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏪', sx, sy);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  for (const e of enemies) if (e.alive) e.drawShadow(ctx, camOffX, camOffY);
  if (player.alive) player.drawShadow(ctx, camOffX, camOffY);

  const drawOrder = [...enemies.filter(e => e.alive), player]
    .sort((a, b) => a.renderY - b.renderY);
  for (const actor of drawOrder) {
    if (actor === player) {
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
      // 魔法弾：輝く円
      ctx.shadowColor = a.color;
      ctx.shadowBlur  = 14;
      ctx.fillStyle   = a.color;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
      // 軌跡
      ctx.globalAlpha  = 0.4;
      ctx.beginPath();
      ctx.arc(sx - Math.cos(angle) * 8, sy - Math.sin(angle) * 8, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.shadowColor = '#fcd34d';
      ctx.shadowBlur  = 8;
      ctx.strokeStyle = '#c08030';
      ctx.lineWidth   = 2.5;
      ctx.lineCap     = 'round';
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

  if (flashAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle   = flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // HUD / minimap / effects → src/ui/hud.ts に移動済み
  drawHUD(ctx, W, H, { player, enemies, gamePhase, currentDungeon, floorNumber, turnCount });
  drawHotbar(ctx, W, H, { player, hotbar, gamePhase });
  drawBossHPBar(ctx, W, enemies);
  drawMinimap(ctx, W, H, { map, player, enemies, exploredTiles, floorItems, floorChests, shopPos });
  drawFloatingTexts(ctx, floatingTexts);

  if (showInventory) drawInventory(ctx, W, H, { player, invCursor });
  if (showMagic)     drawMagicMenu(ctx, W, H, { player, magicCursor });
  if (shopOpen)      drawShopMenu(ctx, W, H, { player, shopItems, shopCursor });
  if (baseChestOpen) drawBaseChest(ctx, W, H, { player, baseChest, baseChestSide, baseCursor });
  if (baseShopOpen)  drawBaseShop(ctx, W, H, { player, baseShopItems, baseShopCursor });
  if (casinoOpen)    drawCasino(ctx, W, H, {
    player, casinoMode, casinoCursor,
    bjPhase, bjBet, bjHand, bjDealerHand, bjResult, bjMsg,
    rlPhase, rlSpinAngle, rlBetType, rlBet, rlNumber, rlResult, rlMsg,
    ccPhase, ccBet, ccPlayerDice, ccPlayerRolls, ccDealerDice, ccWin, ccMsg,
  });
  if (stallOpen)     drawStall(ctx, W, H, { player, stallItems, stallCursor, stallPriceFn: _stallPrice });
  if (loanOpen)      drawLoan(ctx, W, H, {
    player, loanRepayMode, loanDebt, loanQuestActive, loanRepayCursor, loanCursor,
  });

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
  const maxIdx = hasAny ? 1 : 0;
  if (input.justPressed('ArrowUp') || input.justPressed('KeyW'))
    titleCursor = (titleCursor - 1 + maxIdx + 1) % (maxIdx + 1);
  if (input.justPressed('ArrowDown') || input.justPressed('KeyS'))
    titleCursor = (titleCursor + 1) % (maxIdx + 1);
  if (input.justPressed('Enter') || input.justPressed('Space')) {
    if (titleCursor === 0) {
      gameState = 'CLASS_SELECT';
      classCursor = 0;
    } else {
      saveSlotMode   = 'load';
      saveSlotFrom   = 'TITLE';
      saveSlotCursor = 0;
      gameState      = 'SAVE_SLOT';
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
});
