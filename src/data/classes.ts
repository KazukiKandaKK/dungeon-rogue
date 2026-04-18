// ─────────────────────────────────────────────
// classes.ts  職業定義
// ─────────────────────────────────────────────

export type ClassId = 'warrior' | 'guardian' | 'mage' | 'rogue';

/** レベルアップ時に習得するスペル: { レベル: [spellId, ...] } */
type SpellProgression = Record<number, string[]>;

export interface ClassDef {
  id:       ClassId;
  name:     string;
  icon:     string;
  color:    string;
  bgColor:  string;
  desc:     string[];
  baseAtk:  number;
  baseDef:  number;
  baseHP:   number;
  atkPerLv: number;
  defPerLv: number;
  hpPerLv:  number;
  baseMp:   number;
  mpPerLv:  number;
  baseMpMax: number;
  baseSpd:  number;
  baseLuk:  number;
  startSpells:      string[];
  spellProgression: SpellProgression;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: 'warrior', name: '戦士', icon: '⚔',
    color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)',
    desc: ['攻撃力が高く一撃が重い。', 'LvUPごとにATKと新技を習得。'],
    baseAtk: 5, baseDef: 0, baseHP: 12,
    atkPerLv: 2, defPerLv: 0, hpPerLv: 2,
    baseMp: 12, mpPerLv: 1, baseMpMax: 12,
    baseSpd: 1, baseLuk: 1,
    startSpells: ['heal', 'war_cry'],
    spellProgression: {
      2:  ['shield_bash'],
      4:  ['whirlwind'],
      6:  ['berserk'],
      9:  ['war_stomp'],
      13: ['frost_nova'],   // クロスジョブ習得
      18: ['meteor'],       // 上位魔法
    },
  },
  guardian: {
    id: 'guardian', name: '守護者', icon: '🛡',
    color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)',
    desc: ['防御と最大HPが高い。', 'LvUPごとに守護・聖魔法を習得。'],
    baseAtk: 2, baseDef: 3, baseHP: 18,
    atkPerLv: 1, defPerLv: 1, hpPerLv: 4,
    baseMp: 14, mpPerLv: 2, baseMpMax: 14,
    baseSpd: 0, baseLuk: 2,
    startSpells: ['heal', 'barrier'],
    spellProgression: {
      2:  ['cure'],
      3:  ['regen'],
      5:  ['iron_skin'],
      7:  ['holy_strike'],
      9:  ['sanctuary'],
      11: ['taunt'],
      14: ['holy_nova'],
      18: ['quake'],        // 上位魔法
    },
  },
  mage: {
    id: 'mage', name: '魔法士', icon: '✨',
    color: '#a855f7', bgColor: 'rgba(168,85,247,0.15)',
    desc: ['魔法に特化。LvUPで次々と強力な呪文を習得。'],
    baseAtk: 3, baseDef: 0, baseHP: 7,
    atkPerLv: 1, defPerLv: 0, hpPerLv: 1,
    baseMp: 26, mpPerLv: 4, baseMpMax: 26,
    baseSpd: 1, baseLuk: 2,
    startSpells: ['fireball', 'thunder', 'heal', 'teleport'],
    spellProgression: {
      2:  ['blizzard'],
      3:  ['frost_nova'],
      4:  ['chain_bolt'],
      5:  ['dark_bolt'],
      6:  ['wind_cross'],
      7:  ['drain'],
      8:  ['poison_mist'],
      9:  ['regen'],
      10: ['sleep_gas'],
      11: ['arcane_ray'],
      12: ['gravity'],
      13: ['mana_burst'],
      14: ['quake'],
      15: ['holy_nova'],
      17: ['meteor'],
      19: ['time_stop'],
      22: ['void_rift'],
    },
  },
  rogue: {
    id: 'rogue', name: '盗賊', icon: '🗡',
    color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)',
    desc: ['素早さと運が高い。', 'LvUPで毒・隠密・奇襲技を習得。'],
    baseAtk: 3, baseDef: 1, baseHP: 10,
    atkPerLv: 1, defPerLv: 1, hpPerLv: 2,
    baseMp: 14, mpPerLv: 2, baseMpMax: 14,
    baseSpd: 3, baseLuk: 4,
    startSpells: ['teleport', 'haste'],
    spellProgression: {
      2:  ['venom_blade'],
      3:  ['smoke_bomb'],
      4:  ['drain'],
      5:  ['caltrops'],
      7:  ['shadow_step'],
      9:  ['poison_mist'],
      11: ['assassinate'],
      14: ['sleep_gas'],
      17: ['chain_bolt'],   // クロスジョブ習得
    },
  },
};

export const CLASS_IDS: ClassId[] = ['warrior', 'guardian', 'mage', 'rogue'];
