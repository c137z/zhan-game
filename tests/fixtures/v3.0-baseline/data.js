// ============================================================
//  斩 v14 — data.js
//  所有配置数据：Boss定义、圣物定义、卡牌、数值常量
// ============================================================

// ========== 战斗数值常量 ==========
var CONFIG = {
  BOARD_ROWS: 5,
  BOARD_COLS: 5,
  SLOT_SIZE: 10,
  PLAYER_HP: 100,
  PLAYER_MAX_HP: 100,

  // Boss 默认（第二关毛线团/第三关Boss各自覆盖）
  ENEMY_HP: 100,
  ENEMY_START_SHIELD: 0,
  ENEMY_BASE_ATK: 12,
  ENEMY_CYCLE: 7,
  SHIELD_RESET_ON_OWN_TURN: true,

  MIN_COMBO: 3,
  DOUBLE_TAP_DELAY: 350,     // 双击判定间隔 ms
  LONG_PRESS_DELAY: 600,     // 长按触发间隔 ms
  SWIPE_THRESHOLD: 20,       // 下滑拖拽阈值 px
  LOG_MAX_LINES: 100,        // 日志最大行数
  VULN_MULT: 1.5,
  ATK_BUFF_MULT: 1.5,
  DEF_BUFF_RATIO: 0.7,
  ATK_DOWN_PCT: 30,
  UNMATCHED_PENALTY: 1,
};

// ========== 卡牌定义 ==========
var CARD_TYPES = {
  attack:     { emoji: '🗡', label: '攻击', color: 'attack',     cssClass: 'card-attack' },
  defend:     { emoji: '🛡️', label: '防御', color: 'defend',      cssClass: 'card-defend' },
  heal:       { emoji: '❤️', label: '治疗', color: 'heal',        cssClass: 'card-heal' },
  wild:       { emoji: '💎', label: '全能', color: 'wild',        cssClass: 'card-wild' },
  atk_down:   { emoji: '⬇️', label: '虚弱', color: 'atk-down',    cssClass: 'card-atk-down' },
  vulnerable: { emoji: '💔', label: '破甲', color: 'vulnerable',  cssClass: 'card-vulnerable' },
  stun:       { emoji: '💫', label: '击晕', color: 'stun',        cssClass: 'card-stun' },
  atk_buff:   { emoji: '⚡', label: '暴击', color: 'atk-buff',    cssClass: 'card-atk-buff' },
  def_buff:   { emoji: '💨', label: '减伤', color: 'def-buff',    cssClass: 'card-def-buff' },
  special_atk:{ emoji: '🙈', label: '特攻', color: 'special',     cssClass: 'card-special-atk' },
  special_def:{ emoji: '🙉', label: '特防', color: 'special',     cssClass: 'card-special-def' },
  divine:     { emoji: '🙊', label: '免伤', color: 'special',     cssClass: 'card-divine' },
};

var BUFF_TYPES = { vulnerable:1, stun:1, atk_buff:1, def_buff:1, atk_down:1 };

// ========== 牌组构成 ==========
// TASK: CARD_DOUBLE — 全部卡牌数量 ×2
var DECK_SIZES = {
  attack:     100,
  defend:     100,
  heal:       50,
  wild:       20,
  atk_down:   50,
  vulnerable: 50,
  stun:       30,
  atk_buff:   40,
  def_buff:   40,
};

(function() {
  var total = 0;
  for (var k in DECK_SIZES) total += DECK_SIZES[k];
  CONFIG.TOTAL_CARDS = total;
  CONFIG.CARDS_PER_PILE = Math.floor(total / (CONFIG.BOARD_ROWS * CONFIG.BOARD_COLS));
})();


// ========== Boss 定义 ==========
// hpTriggers 使用纯字符串 id 引用，执行函数在 core.js Zhan.Systems.Boss._hpTriggerHandlers 中
var BOSSES = {
  tabby: {  // 狸花猫
    id: 'tabby', name: '狸花猫', emoji: '🐱',
    desc: '每2回合随机锁定2摞牌2回合\n被锁的牌无法点选',
    maxHP: 300, baseAtk: 20, powerGrowth: 2, startShield: 0,
    cycle: [{ type: 'attack' },{ type: 'defend' },{ type: 'attack' },{ type: 'focus' },{ type: 'crit' }],
    traits: [{
      id: 'lock_pile',
      events: ['TURN_START', 'TURN_END'],
      params: { interval: 2, count: 2, duration: 2 }
    }],
    hpTriggers: ['groom', 'hiss'],
  },

  sphynx: {  // 斯芬克斯
    id: 'sphynx', name: '斯芬克斯', emoji: '🐱',
    desc: '每3回合舔掉玩家所有Buff\n（不清Debuff和Boss自身）',
    maxHP: 300, baseAtk: 20, powerGrowth: 2, startShield: 0,
    cycle: [{ type: 'attack' },{ type: 'defend' },{ type: 'attack' },{ type: 'focus' },{ type: 'crit' }],
    traits: [{
      id: 'lick_player',
      events: ['TURN_START'],
      params: { interval: 3, minTurn: 1 }
    }],
    hpTriggers: ['groom', 'hiss'],
  },

  british_shorthair: {  // 英短蓝猫
    id: 'british_shorthair', name: '英短蓝猫', emoji: '🐱',
    desc: '每3回合锁定2个槽位2回合\n锁定的槽位无法放入牌',
    maxHP: 300, baseAtk: 20, powerGrowth: 2, startShield: 0,
    cycle: [{ type: 'attack' },{ type: 'defend' },{ type: 'attack' },{ type: 'focus' },{ type: 'crit' }],
    traits: [{
      id: 'lock_slot',
      events: ['TURN_START', 'TURN_END'],
      params: { interval: 3, count: 2, duration: 2 }
    }],
    hpTriggers: ['groom', 'hiss'],
  },

  american_shorthair: {  // 美短虎斑
    id: 'american_shorthair', name: '美短虎斑', emoji: '🐱',
    desc: '永久隐藏下一回合行动意图\n无法预判Boss下一步',
    maxHP: 300, baseAtk: 20, powerGrowth: 2, startShield: 0,
    cycle: [{ type: 'attack' },{ type: 'defend' },{ type: 'attack' },{ type: 'focus' },{ type: 'crit' }],
    traits: [{
      id: 'hide_intent',
      events: ['TURN_START'],
      params: {}
    }],
    hpTriggers: ['groom', 'hiss'],
  },

  abyssinian: {  // 阿比西尼亚
    id: 'abyssinian', name: '阿比西尼亚', emoji: '🐱',
    desc: '玩家消除结算时随机弃掉1张牌\n优先破坏连击链',
    maxHP: 300, baseAtk: 20, powerGrowth: 2, startShield: 0,
    cycle: [{ type: 'attack' },{ type: 'defend' },{ type: 'attack' },{ type: 'focus' },{ type: 'crit' }],
    traits: [{
      id: 'random_discard',
      events: ['RESOLVE'],
      params: { count: 1 }
    }],
    hpTriggers: ['groom', 'hiss'],
  },

  ragdoll: {  // 布偶猫
    id: 'ragdoll', name: '布偶猫', emoji: '🐱',
    desc: '每回合涂抹随机2摞牌\n被涂的牌面信息不可见',
    maxHP: 300, baseAtk: 20, powerGrowth: 2, startShield: 0,
    cycle: [{ type: 'attack' },{ type: 'defend' },{ type: 'attack' },{ type: 'focus' },{ type: 'crit' }],
    traits: [{
      id: 'smear_piles',
      events: ['TURN_START'],
      params: { count: 2 }
    }],
    hpTriggers: ['groom', 'hiss'],
  },

  bengal: {  // 豹猫
    id: 'bengal', name: '豹猫', emoji: '🐱',
    desc: '最大回合数24回合\n超时直接判负',
    maxHP: 300, baseAtk: 20, powerGrowth: 2, startShield: 0,
    cycle: [{ type: 'attack' },{ type: 'defend' },{ type: 'attack' },{ type: 'focus' },{ type: 'crit' }],
    traits: [{
      id: 'time_limit',
      events: ['TURN_START'],
      params: { maxTurns: 24 }
    }],
    hpTriggers: ['groom', 'hiss'],
  },

  siamese: {  // 暹罗猫
    id: 'siamese', name: '暹罗猫', emoji: '🐱',
    desc: '前半血每2回塞1张废牌\n半血后每回塞1张废牌',
    maxHP: 300, baseAtk: 20, powerGrowth: 2, startShield: 0,
    cycle: [{ type: 'attack' },{ type: 'defend' },{ type: 'attack' },{ type: 'focus' },{ type: 'crit' }],
    traits: [{
      id: 'insert_junk',
      events: ['TURN_START'],
      params: { halfHP: true }
    }],
    hpTriggers: ['groom', 'hiss'],
  },

  scottish_fold: {  // 折耳猫
    id: 'scottish_fold', name: '折耳猫', emoji: '🐱',
    desc: '每5回合爆发一次\n玩家跳过下一回合无法行动',
    maxHP: 300, baseAtk: 20, powerGrowth: 2, startShield: 0,
    cycle: [{ type: 'attack' },{ type: 'defend' },{ type: 'attack' },{ type: 'focus' },{ type: 'crit' }],
    traits: [{
      id: 'stun_player',
      events: ['TURN_START'],
      params: { interval: 5, minTurn: 1 }
    }],
    hpTriggers: ['groom', 'hiss'],
  },

  maine_coon: {  // 缅因猫
    id: 'maine_coon', name: '缅因猫', emoji: '🐱',
    desc: '每回合Boss先于玩家行动\n必须先承受伤害再出牌',
    maxHP: 300, baseAtk: 20, powerGrowth: 2, startShield: 0,
    cycle: [{ type: 'attack' },{ type: 'defend' },{ type: 'attack' },{ type: 'focus' },{ type: 'crit' }],
    traits: [{
      id: 'boss_first',
      // 此 trait 在 executeTurn 开头硬编码处理（Boss先手），不走 processEvent
      events: [],
      params: {}
    }],
    hpTriggers: ['groom', 'hiss'],
  },

  // 第一关：逗猫棒
  catToy: {
    id: 'catToy', name: '逗猫棒', emoji: '🪄',
    desc: '教学关Boss\n攻击5防御5交替循环',
    maxHP: 50, baseAtk: 5, startShield: 0,
    cycle: [
      { type: 'attack' },
      { type: 'defend', shield: 5 },
    ],
    traits: [],
    hpTriggers: [],
  },

  // 第二关毛线团
  skeleton: {
    id: 'skeleton', name: '毛线团', emoji: '🧶',
    desc: '第二关Boss\n新4回合循环：攻/防/蓄/暴\n毛线团冒险者来袭！',
    maxHP: 100, baseAtk: 12, powerGrowth: 1, startShield: 0,
    cycle: [
      { type: 'attack' },
      { type: 'defend' },
      { type: 'focus' },
      { type: 'crit' },
    ],
    traits: [],
    hpTriggers: [],
  }
};

// ========== 圣物定义 ==========
// 所有执行逻辑移至 core.js Zhan.Systems.Relic
var RELICS = {
  double_wild: {
    id: 'double_wild', name: '双生花', type: 'rule',
    desc: '万能卡数量翻倍',
    effects: [{ phase: 'INIT', action: 'multiplyDeckCard', params: { cardType: 'wild', factor: 2 } }],
  },
  combo_core: {
    id: 'combo_core', name: '连击核心', type: 'rule',
    desc: '最小连击数 -1（3→2，全局生效）',
    effects: [{ phase: 'INIT', action: 'setEffectiveMinCombo', params: { value: 2 } }],
  },
  slot_plus2: {
    id: 'slot_plus2', name: '扩容核心', type: 'rule',
    desc: '消除槽 +2（10→12）',
    effects: [{ phase: 'INIT', action: 'increaseSlotSize', params: { amount: 2 } }],
  },
  endurance_core: {
    id: 'endurance_core', name: '耐久核心', type: 'rule',
    desc: 'Buff/Debuff 持续时间 +1 回合',
    effects: [{ phase: 'INIT', action: 'setBuffDurationBonus', params: { amount: 1 } }],
  },
  wild_core: {
    id: 'wild_core', name: '万能核心', type: 'rule',
    desc: '消除槽+1置于最前，槽内固定万能卡💎，后方卡牌连击数+1',
    effects: [{ phase: 'INIT', action: 'enableWildCoreSlot' }],
  },
  overload_core: {
    id: 'overload_core', name: '过载核心', type: 'rule',
    desc: 'Buff/Debuff 效果提升至 200%',
    effects: [{ phase: 'INIT', action: 'setOverloadBuffs', params: { atkBuffMult: 2.0, vulnMult: 2.0, defBuffRatio: 0.5 } }],
  },
  spirit_core: {
    id: 'spirit_core', name: '元气核心', type: 'rule',
    desc: '未消除的单卡不消耗生命值',
    effects: [{ phase: 'INIT', action: 'setNoUnmatchedPenalty', params: { value: true } }],
  },
  lifesaving_fur: {
    id: 'lifesaving_fur', name: '救命毫毛', type: 'function',
    desc: '开局获得三张特殊卡：特攻40/特防40/免伤1回合',
    effects: [{ phase: 'INIT', action: 'addSpecialCards', params: {
      cards: [
        { type: 'special_atk', label: '特攻', emoji: '🙈', dmg: 40, color: 'white' },
        { type: 'special_def', label: '特防', emoji: '🙉', shield: 40, color: 'white' },
        { type: 'divine', label: '免伤', emoji: '🙊', immune: true, color: 'white' },
      ]
    } }],
  },
  tenacity_core: {
    id: 'tenacity_core', name: '坚韧核心', type: 'stat',
    desc: '首次受到致命伤害时触发免伤，HP锁定为1（每局一次）',
    effects: [{ phase: 'INIT', action: 'enableTenacity' }],
  },
  fury_core: {
    id: 'fury_core', name: '狂暴核心', type: 'stat',
    desc: '生命值每降低1%，全部卡牌效果数值+1%',
    effects: [{ phase: 'INIT', action: 'enableFury' }],
    multiplier: { depends: 'hpLoss', formula: '1-hpPercent' },
  },
  life_core: {
    id: 'life_core', name: '生命核心', type: 'stat',
    desc: '最大生命值 +50',
    effects: [{ phase: 'INIT', action: 'increaseMaxHP', params: { amount: 50 } }],
  },

};

