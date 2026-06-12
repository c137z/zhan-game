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

  // --- 模式/阶段 ---
  MODE_ADVENTURE: 'adventure',
  MODE_TOWER: 'tower',
  MODE_MAZE: 'maze',
  MODE_NORMAL: 'normal',
  PHASE_PLAYER: 'player',
  PHASE_ENEMY: 'enemy',
  PHASE_RESOLVING: 'resolving',
  PHASE_OVER: 'over',

  // --- 卡牌/效果类型 ---
  TYPE_ATTACK: 'attack',
  TYPE_DEFEND: 'defend',
  TYPE_HEAL: 'heal',
  TYPE_WILD: 'wild',
  TYPE_JUNK: 'junk',
  TYPE_VULNERABLE: 'vulnerable',
  TYPE_STUN: 'stun',
  TYPE_ATK_BUFF: 'atk_buff',
  TYPE_DEF_BUFF: 'def_buff',
  TYPE_ATK_DOWN: 'atk_down',

  // --- 默认值 ---
  BOSS_DEFAULT_ID: 'skeleton',
  BOSS_DEFAULT_NAME: '毛线团',
  BOSS_DEFAULT_EMOJI: '🧶',
  PLAYER_DEFAULT_NAME: '勇者',
  PLAYER_DEFAULT_EMOJI: '🦸',

  // --- 游戏数值阈值 ---
  MAZE_UNLOCK_THRESHOLD: 4,
  TOWER_UNLOCK_THRESHOLD: 4,
  RELIC_COUNT_TOWER: 1,
  RELIC_COUNT_OTHER: 2,
  MAX_RELIC_REROLLS: 1,
  MAX_REMOVE_PER_TURN: 1,
  MAX_SHUFFLE_PER_TURN: 1,
  SAVE_VERSION: 3,        // v3: 猫毛效果系统（亲和圣物选择）
  GAME_VERSION: "v14",     // 游戏版本号，用于验证系统场景文件的版本一致性
};

// ========== 猫毛商店 ==========
var CATMAO_SHOP = [
  { id: 'extra_reroll',  name: '多一次刷新',    price: 100, desc: '每局圣物选择多一次刷新机会', once: true },
  { id: 'clairvoyance',  name: '瞳力',          price: 100, desc: '可多看一回合敌人意图', once: true },
  { id: 'card_stats',    name: '卡牌统计',      price:  50, desc: '战斗时显示每种卡牌剩余数量', once: true },
  { id: 'hp_boost',      name: '生命上限 +5',   price:  50, desc: '开局生命上限提升', maxLevel: 4 },
  { id: 'shield_boost',  name: '回合护盾 +1',   price:  50, desc: '每回合结束自动获得护盾', maxLevel: 5 },
  { id: 'revive',        name: '复苏',          price: 100, desc: '生命首次低于50时恢复10点血（每局一次）', once: true },
  { id: 'relic_affinity',name: '圣物亲和',      price: 300, desc: '自选一个圣物，之后每次圣物选择必出现', once: true },
];

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
  atk_buff:   50,
  def_buff:   50,
};

// ========== 冒险关卡配置 ==========
var ADVENTURE_STAGES = [
  // 教学关
  { id: 1, bossId: 'catToy', name: '逗猫棒', emoji: '🪄',
    deck: { attack: 50, defend: 50 },
    hp: 50, atk: 5, def: 5, growth: 0,
    cycle: 'atk_def', desc: '基础玩法' },
  { id: 2, bossId: 'cup', name: '水杯', emoji: '🥤',
    deck: { attack: 50, defend: 50, atk_buff: 50, vulnerable: 50 },
    hp: 100, atk: 10, def: 10, growth: 0,
    cycle: 'atk_def', desc: '增伤入门' },
  { id: 3, bossId: 'bee', name: '小蜜蜂', emoji: '🐝',
    deck: { attack: 50, defend: 50, atk_buff: 50, vulnerable: 50, atk_down: 50, def_buff: 50 },
    hp: 100, atk: 20, def: 20, growth: 0,
    cycle: 'atk_def', desc: '防守入门' },
  { id: 4, bossId: 'snake', name: '小蛇', emoji: '🐍',
    deck: { stun: 20, heal: 20, wild: 20 },
    hp: 100, atk: 50, def: 0, growth: 0,
    cycle: 'focus_attack', desc: '进阶博弈' },
  // 第一幕·昆虫序列
  { id: 5, bossId: 'ant', name: '工蚁', emoji: '🐜',
    deck: null,  // null = 标准卡池 DECK_SIZES
    hp: 80, atk: 8, def: 8, growth: 0,
    cycle: 'atk_def', desc: '昆虫序列' },
  // === 第一幕·昆虫序列 (6-19) ===
  { id: 6, bossId: 'ladybug', name: '瓢虫', emoji: '🐞',
    deck: null, hp: 95, atk: 9, def: 9, growth: 0, cycle: 'atk_def', desc: '昆虫序列' },
  { id: 7, bossId: 'snail', name: '蜗牛', emoji: '🐌',
    deck: null, hp: 110, atk: 10, def: 10, growth: 0, cycle: 'atk_def', desc: '昆虫序列' },
  { id: 8, bossId: 'mosquito', name: '蚊子', emoji: '🦟',
    deck: null, hp: 125, atk: 11, def: 11, growth: 0, cycle: 'atk_def', desc: '昆虫序列' },
  { id: 9, bossId: 'fly', name: '绿头苍蝇', emoji: '🪰',
    deck: null, hp: 140, atk: 12, def: 12, growth: 0, cycle: 'atk_def', desc: '昆虫序列' },
  { id: 10, bossId: 'earthworm', name: '蚯蚓', emoji: '🪱',
    deck: null, hp: 155, atk: 13, def: 13, growth: 0, cycle: 'atk_def', desc: '昆虫序列' },
  { id: 11, bossId: 'spider', name: '园蛛', emoji: '🕷️',
    deck: null, hp: 170, atk: 14, def: 14, growth: 0, cycle: 'atk_def', desc: '昆虫序列' },
  { id: 12, bossId: 'cricket', name: '蟋蟀', emoji: '🦗',
    deck: null, hp: 185, atk: 15, def: 15, growth: 0, cycle: 'atk_def', desc: '昆虫序列' },
  { id: 13, bossId: 'centipede', name: '蜈蚣', emoji: '🦂',
    deck: null, hp: 200, atk: 16, def: 16, growth: 0, cycle: 'atk_def', desc: '昆虫序列' },
  { id: 14, bossId: 'mantis', name: '螳螂', emoji: '🪳',
    deck: null, hp: 215, atk: 17, def: 17, growth: 0, cycle: 'atk_def', desc: '昆虫序列' },
  { id: 15, bossId: 'butterfly', name: '菜粉蝶', emoji: '🦋',
    deck: null, hp: 230, atk: 18, def: 18, growth: 0, cycle: 'atk_def', desc: '昆虫序列' },
  { id: 16, bossId: 'hornet', name: '马蜂', emoji: '🐝',
    deck: null, hp: 245, atk: 18, def: 18, growth: 0, cycle: 'atk_def', desc: '昆虫序列' },
  { id: 17, bossId: 'firefly', name: '萤火虫', emoji: '✨',
    deck: null, hp: 260, atk: 19, def: 19, growth: 0, cycle: 'atk_def', desc: '昆虫序列' },
  { id: 18, bossId: 'tick', name: '蜱虫', emoji: '🪳',
    deck: null, hp: 280, atk: 19, def: 19, growth: 0, cycle: 'atk_def', desc: '昆虫序列' },
  { id: 19, bossId: 'beetle', name: '独角仙', emoji: '🪲',
    deck: null, hp: 300, atk: 20, def: 20, growth: 0, cycle: 'atk_def', desc: '昆虫序列·关底' },
  // === 第二幕·小动物序列 (20-39) ===
  { id: 20, bossId: 'mouse', name: '家鼠', emoji: '🐭',
    deck: null, hp: 200, atk: 15, def: 15, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 21, bossId: 'sparrow', name: '麻雀', emoji: '🐦',
    deck: null, hp: 205, atk: 15, def: 15, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 22, bossId: 'treefrog', name: '树蛙', emoji: '🐸',
    deck: null, hp: 210, atk: 15, def: 15, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 23, bossId: 'squirrel', name: '松鼠', emoji: '🐿️',
    deck: null, hp: 215, atk: 16, def: 16, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 24, bossId: 'hedgehog', name: '刺猬', emoji: '🦔',
    deck: null, hp: 220, atk: 16, def: 16, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 25, bossId: 'bat', name: '蝙蝠', emoji: '🦇',
    deck: null, hp: 225, atk: 16, def: 16, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 26, bossId: 'loach', name: '泥鳅', emoji: '🐟',
    deck: null, hp: 230, atk: 17, def: 17, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 27, bossId: 'viper', name: '毒蛇', emoji: '🐍',
    deck: null, hp: 235, atk: 17, def: 17, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 28, bossId: 'gecko', name: '壁虎', emoji: '🦎',
    deck: null, hp: 240, atk: 17, def: 17, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 29, bossId: 'hamster', name: '仓鼠', emoji: '🐹',
    deck: null, hp: 245, atk: 17, def: 17, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 30, bossId: 'pigeon', name: '灰鸽', emoji: '🕊️',
    deck: null, hp: 250, atk: 18, def: 18, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 31, bossId: 'crow', name: '乌鸦', emoji: '🐦‍⬛',
    deck: null, hp: 255, atk: 18, def: 18, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 32, bossId: 'hare', name: '野兔', emoji: '🐰',
    deck: null, hp: 260, atk: 18, def: 18, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 33, bossId: 'duck', name: '野鸭', emoji: '🦆',
    deck: null, hp: 265, atk: 18, def: 18, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 34, bossId: 'chick', name: '小鸡', emoji: '🐤',
    deck: null, hp: 270, atk: 19, def: 19, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 35, bossId: 'turtle', name: '草龟', emoji: '🐢',
    deck: null, hp: 275, atk: 19, def: 19, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 36, bossId: 'crab', name: '螃蟹', emoji: '🦀',
    deck: null, hp: 280, atk: 19, def: 19, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 37, bossId: 'crayfish', name: '小龙虾', emoji: '🦞',
    deck: null, hp: 285, atk: 19, def: 19, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 38, bossId: 'mole', name: '鼹鼠', emoji: '🐀',
    deck: null, hp: 290, atk: 20, def: 20, growth: 1, cycle: 'atk_def_focus_crit', desc: '成长压迫' },
  { id: 39, bossId: 'raccoon', name: '浣熊', emoji: '🦝',
    deck: null, hp: 300, atk: 20, def: 20, growth: 1, cycle: 'atk_def_focus_crit', desc: '第二幕·关底' },
  // === 第三幕·中等动物序列 (40-50) ===
  { id: 40, bossId: 'weasel', name: '黄鼠狼', emoji: '🦡',
    deck: null, hp: 250, atk: 18, def: 18, growth: 2, cycle: 'atk_def_atk_focus_crit', desc: '双重压迫' },
  { id: 41, bossId: 'fox', name: '赤狐', emoji: '🦊',
    deck: null, hp: 255, atk: 18, def: 18, growth: 2, cycle: 'atk_def_atk_focus_crit', desc: '双重压迫' },
  { id: 42, bossId: 'meerkat', name: '猫鼬', emoji: '🐱',
    deck: null, hp: 260, atk: 18, def: 18, growth: 2, cycle: 'atk_def_atk_focus_crit', desc: '双重压迫' },
  { id: 43, bossId: 'goose', name: '大鹅', emoji: '🪿',
    deck: null, hp: 265, atk: 19, def: 19, growth: 2, cycle: 'atk_def_atk_focus_crit', desc: '双重压迫' },
  { id: 44, bossId: 'straydog', name: '流浪狗', emoji: '🐕',
    deck: null, hp: 270, atk: 19, def: 19, growth: 2, cycle: 'atk_def_atk_focus_crit', desc: '双重压迫' },
  { id: 45, bossId: 'skunk', name: '臭鼬', emoji: '🦨',
    deck: null, hp: 275, atk: 19, def: 19, growth: 2, cycle: 'atk_def_atk_focus_crit', desc: '双重压迫' },
  { id: 46, bossId: 'boar', name: '野猪', emoji: '🐗',
    deck: null, hp: 280, atk: 20, def: 20, growth: 2, cycle: 'atk_def_atk_focus_crit', desc: '双重压迫' },
  { id: 47, bossId: 'deer', name: '小鹿', emoji: '🦌',
    deck: null, hp: 285, atk: 20, def: 20, growth: 2, cycle: 'atk_def_atk_focus_crit', desc: '双重压迫' },
  { id: 48, bossId: 'goat', name: '山羊', emoji: '🐐',
    deck: null, hp: 290, atk: 20, def: 20, growth: 2, cycle: 'atk_def_atk_focus_crit', desc: '双重压迫' },
  { id: 49, bossId: 'calf', name: '小牛', emoji: '🐮',
    deck: null, hp: 295, atk: 20, def: 20, growth: 2, cycle: 'atk_def_atk_focus_crit', desc: '双重压迫' },
  { id: 50, bossId: 'straycat', name: '野猫首领', emoji: '🐈‍⬛',
    deck: null, hp: 300, atk: 20, def: 20, growth: 2, cycle: 'atk_def_atk_focus_crit', desc: '冒险模式·关底' },
];

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

  cup: {
    id: 'cup', name: '水杯', emoji: '🥤',
    desc: '教学关Boss·增伤入门',
    maxHP: 100, baseAtk: 10, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 10 }],
    traits: [], hpTriggers: []
  },

  bee: {
    id: 'bee', name: '小蜜蜂', emoji: '🐝',
    desc: '教学关Boss·防守入门',
    maxHP: 100, baseAtk: 20, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 20 }],
    traits: [], hpTriggers: []
  },

  snake: {
    id: 'snake', name: '小蛇', emoji: '🐍',
    desc: '教学关Boss·进阶博弈',
    maxHP: 100, baseAtk: 50, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'focus' }, { type: 'attack' }],
    traits: [], hpTriggers: []
  },

  ant: {
    id: 'ant', name: '工蚁', emoji: '🐜',
    desc: '昆虫序列·第5关',
    maxHP: 80, baseAtk: 8, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 8 }],
    traits: [], hpTriggers: []
  },

  // ===== 猫咪冒险·第一幕：昆虫 =====
  ladybug: {
    id: 'ladybug', name: '瓢虫', emoji: '🐞',
    desc: '冒险第6关白板Boss',
    maxHP: 95, baseAtk: 9, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 9 }],
    traits: [], hpTriggers: []
  },
  snail: {
    id: 'snail', name: '蜗牛', emoji: '🐌',
    desc: '冒险第7关白板Boss',
    maxHP: 110, baseAtk: 10, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 10 }],
    traits: [], hpTriggers: []
  },
  mosquito: {
    id: 'mosquito', name: '蚊子', emoji: '🦟',
    desc: '冒险第8关白板Boss',
    maxHP: 125, baseAtk: 11, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 11 }],
    traits: [], hpTriggers: []
  },
  fly: {
    id: 'fly', name: '绿头苍蝇', emoji: '🪰',
    desc: '冒险第9关白板Boss',
    maxHP: 140, baseAtk: 12, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 12 }],
    traits: [], hpTriggers: []
  },
  earthworm: {
    id: 'earthworm', name: '蚯蚓', emoji: '🪱',
    desc: '冒险第10关白板Boss',
    maxHP: 155, baseAtk: 13, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 13 }],
    traits: [], hpTriggers: []
  },
  spider: {
    id: 'spider', name: '园蛛', emoji: '🕷️',
    desc: '冒险第11关白板Boss',
    maxHP: 170, baseAtk: 14, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 14 }],
    traits: [], hpTriggers: []
  },
  cricket: {
    id: 'cricket', name: '蟋蟀', emoji: '🦗',
    desc: '冒险第12关白板Boss',
    maxHP: 185, baseAtk: 15, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 15 }],
    traits: [], hpTriggers: []
  },
  centipede: {
    id: 'centipede', name: '蜈蚣', emoji: '🦂',
    desc: '冒险第13关白板Boss',
    maxHP: 200, baseAtk: 16, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 16 }],
    traits: [], hpTriggers: []
  },
  mantis: {
    id: 'mantis', name: '螳螂', emoji: '🪳',
    desc: '冒险第14关白板Boss',
    maxHP: 215, baseAtk: 17, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 17 }],
    traits: [], hpTriggers: []
  },
  butterfly: {
    id: 'butterfly', name: '菜粉蝶', emoji: '🦋',
    desc: '冒险第15关白板Boss',
    maxHP: 230, baseAtk: 18, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 18 }],
    traits: [], hpTriggers: []
  },
  hornet: {
    id: 'hornet', name: '马蜂', emoji: '🐝',
    desc: '冒险第16关白板Boss',
    maxHP: 245, baseAtk: 18, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 18 }],
    traits: [], hpTriggers: []
  },
  firefly: {
    id: 'firefly', name: '萤火虫', emoji: '✨',
    desc: '冒险第17关白板Boss',
    maxHP: 260, baseAtk: 19, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 19 }],
    traits: [], hpTriggers: []
  },
  tick: {
    id: 'tick', name: '蜱虫', emoji: '🪳',
    desc: '冒险第18关白板Boss',
    maxHP: 280, baseAtk: 19, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 19 }],
    traits: [], hpTriggers: []
  },
  beetle: {
    id: 'beetle', name: '独角仙', emoji: '🪲',
    desc: '冒险第19关Boss·昆虫序列关底',
    maxHP: 300, baseAtk: 20, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 20 }],
    traits: [], hpTriggers: []
  },
  // ===== 猫咪冒险·第二幕：小动物 =====
  mouse: {
    id: 'mouse', name: '家鼠', emoji: '🐭',
    desc: '冒险第20关白板Boss',
    maxHP: 200, baseAtk: 15, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 15 }],
    traits: [], hpTriggers: []
  },
  sparrow: {
    id: 'sparrow', name: '麻雀', emoji: '🐦',
    desc: '冒险第21关白板Boss',
    maxHP: 205, baseAtk: 15, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 15 }],
    traits: [], hpTriggers: []
  },
  treefrog: {
    id: 'treefrog', name: '树蛙', emoji: '🐸',
    desc: '冒险第22关白板Boss',
    maxHP: 210, baseAtk: 15, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 15 }],
    traits: [], hpTriggers: []
  },
  squirrel: {
    id: 'squirrel', name: '松鼠', emoji: '🐿️',
    desc: '冒险第23关白板Boss',
    maxHP: 215, baseAtk: 16, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 16 }],
    traits: [], hpTriggers: []
  },
  hedgehog: {
    id: 'hedgehog', name: '刺猬', emoji: '🦔',
    desc: '冒险第24关白板Boss',
    maxHP: 220, baseAtk: 16, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 16 }],
    traits: [], hpTriggers: []
  },
  bat: {
    id: 'bat', name: '蝙蝠', emoji: '🦇',
    desc: '冒险第25关白板Boss',
    maxHP: 225, baseAtk: 16, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 16 }],
    traits: [], hpTriggers: []
  },
  loach: {
    id: 'loach', name: '泥鳅', emoji: '🐟',
    desc: '冒险第26关白板Boss',
    maxHP: 230, baseAtk: 17, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 17 }],
    traits: [], hpTriggers: []
  },
  viper: {
    id: 'viper', name: '毒蛇', emoji: '🐍',
    desc: '冒险第27关白板Boss',
    maxHP: 235, baseAtk: 17, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 17 }],
    traits: [], hpTriggers: []
  },
  gecko: {
    id: 'gecko', name: '壁虎', emoji: '🦎',
    desc: '冒险第28关白板Boss',
    maxHP: 240, baseAtk: 17, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 17 }],
    traits: [], hpTriggers: []
  },
  hamster: {
    id: 'hamster', name: '仓鼠', emoji: '🐹',
    desc: '冒险第29关白板Boss',
    maxHP: 245, baseAtk: 17, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 17 }],
    traits: [], hpTriggers: []
  },
  pigeon: {
    id: 'pigeon', name: '灰鸽', emoji: '🕊️',
    desc: '冒险第30关白板Boss',
    maxHP: 250, baseAtk: 18, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 18 }],
    traits: [], hpTriggers: []
  },
  crow: {
    id: 'crow', name: '乌鸦', emoji: '🐦‍⬛',
    desc: '冒险第31关白板Boss',
    maxHP: 255, baseAtk: 18, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 18 }],
    traits: [], hpTriggers: []
  },
  hare: {
    id: 'hare', name: '野兔', emoji: '🐰',
    desc: '冒险第32关白板Boss',
    maxHP: 260, baseAtk: 18, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 18 }],
    traits: [], hpTriggers: []
  },
  duck: {
    id: 'duck', name: '野鸭', emoji: '🦆',
    desc: '冒险第33关白板Boss',
    maxHP: 265, baseAtk: 18, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 18 }],
    traits: [], hpTriggers: []
  },
  chick: {
    id: 'chick', name: '小鸡', emoji: '🐤',
    desc: '冒险第34关白板Boss',
    maxHP: 270, baseAtk: 19, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 19 }],
    traits: [], hpTriggers: []
  },
  turtle: {
    id: 'turtle', name: '草龟', emoji: '🐢',
    desc: '冒险第35关白板Boss',
    maxHP: 275, baseAtk: 19, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 19 }],
    traits: [], hpTriggers: []
  },
  crab: {
    id: 'crab', name: '螃蟹', emoji: '🦀',
    desc: '冒险第36关白板Boss',
    maxHP: 280, baseAtk: 19, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 19 }],
    traits: [], hpTriggers: []
  },
  crayfish: {
    id: 'crayfish', name: '小龙虾', emoji: '🦞',
    desc: '冒险第37关白板Boss',
    maxHP: 285, baseAtk: 19, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 19 }],
    traits: [], hpTriggers: []
  },
  mole: {
    id: 'mole', name: '鼹鼠', emoji: '🐀',
    desc: '冒险第38关白板Boss',
    maxHP: 290, baseAtk: 20, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 20 }],
    traits: [], hpTriggers: []
  },
  raccoon: {
    id: 'raccoon', name: '浣熊', emoji: '🦝',
    desc: '冒险第39关Boss·第二幕关底',
    maxHP: 300, baseAtk: 20, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 20 }],
    traits: [], hpTriggers: []
  },
  // ===== 猫咪冒险·第三幕：中等动物 =====
  weasel: {
    id: 'weasel', name: '黄鼠狼', emoji: '🦡',
    desc: '冒险第40关白板Boss',
    maxHP: 250, baseAtk: 18, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 18 }],
    traits: [], hpTriggers: []
  },
  fox: {
    id: 'fox', name: '赤狐', emoji: '🦊',
    desc: '冒险第41关白板Boss',
    maxHP: 255, baseAtk: 18, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 18 }],
    traits: [], hpTriggers: []
  },
  meerkat: {
    id: 'meerkat', name: '猫鼬', emoji: '🐱',
    desc: '冒险第42关白板Boss',
    maxHP: 260, baseAtk: 18, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 18 }],
    traits: [], hpTriggers: []
  },
  goose: {
    id: 'goose', name: '大鹅', emoji: '🪿',
    desc: '冒险第43关白板Boss',
    maxHP: 265, baseAtk: 19, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 19 }],
    traits: [], hpTriggers: []
  },
  straydog: {
    id: 'straydog', name: '流浪狗', emoji: '🐕',
    desc: '冒险第44关白板Boss',
    maxHP: 270, baseAtk: 19, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 19 }],
    traits: [], hpTriggers: []
  },
  skunk: {
    id: 'skunk', name: '臭鼬', emoji: '🦨',
    desc: '冒险第45关白板Boss',
    maxHP: 275, baseAtk: 19, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 19 }],
    traits: [], hpTriggers: []
  },
  boar: {
    id: 'boar', name: '野猪', emoji: '🐗',
    desc: '冒险第46关白板Boss',
    maxHP: 280, baseAtk: 20, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 20 }],
    traits: [], hpTriggers: []
  },
  deer: {
    id: 'deer', name: '小鹿', emoji: '🦌',
    desc: '冒险第47关白板Boss',
    maxHP: 285, baseAtk: 20, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 20 }],
    traits: [], hpTriggers: []
  },
  goat: {
    id: 'goat', name: '山羊', emoji: '🐐',
    desc: '冒险第48关白板Boss',
    maxHP: 290, baseAtk: 20, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 20 }],
    traits: [], hpTriggers: []
  },
  calf: {
    id: 'calf', name: '小牛', emoji: '🐮',
    desc: '冒险第49关白板Boss',
    maxHP: 295, baseAtk: 20, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 20 }],
    traits: [], hpTriggers: []
  },
  straycat: {
    id: 'straycat', name: '野猫首领', emoji: '🐈‍⬛',
    desc: '冒险第50关Boss·冒险模式关底',
    maxHP: 300, baseAtk: 20, powerGrowth: 0, startShield: 0,
    cycle: [{ type: 'attack' }, { type: 'defend', shield: 20 }],
    traits: [], hpTriggers: []
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

// ========== 猫Boss白名单 ==========
var CAT_BOSS_IDS = ['tabby','sphynx','british_shorthair','american_shorthair','abyssinian','ragdoll','bengal','siamese','scottish_fold','maine_coon'];

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

// ========== 美术资源路径常量 ==========
var ASSETS = {
  // --- 卡牌 emoji（临时，将来替换为图片路径） ---
  CARD_ATTACK:     '🗡️',
  CARD_DEFEND:     '🛡️',
  CARD_HEAL:       '❤️',
  CARD_WILD:       '💎',
  CARD_ATK_DOWN:   '⬇️',
  CARD_VULNERABLE: '💔',
  CARD_STUN:       '💫',
  CARD_ATK_BUFF:   '⚡',
  CARD_DEF_BUFF:   '💨',
  CARD_JUNK:       '⬜',

  // --- 角色 ---
  PLAYER_AVATAR:       '🦸',
  PLAYER_AVATAR_LIFE:  '💪',
  PLAYER_AVATAR_FURY:  '🔥',
  BOSS_DEFAULT:        '🧶',

  // --- UI 图标 ---
  ICON_SHIELD:     '🛡️',
  ICON_HEART:      '❤️',
  ICON_POWER:      '⚡',
  ICON_CARD_COUNT: '🃏',
  ICON_CAT_MAO:    '🐱',
};


