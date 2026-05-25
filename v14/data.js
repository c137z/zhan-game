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

  // Boss 默认（第二关骷髅/第三关Boss各自覆盖）
  ENEMY_HP: 100,
  ENEMY_START_SHIELD: 0,
  ENEMY_BASE_ATK: 12,
  ENEMY_CYCLE: 7,
  SHIELD_RESET_ON_OWN_TURN: true,

  MIN_COMBO: 3,
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
  heal:       { emoji: '❤️', label: '回血', color: 'heal',        cssClass: 'card-heal' },
  wild:       { emoji: '💎', label: '万能', color: 'wild',        cssClass: 'card-wild' },
  atk_down:   { emoji: '⬇️', label: '降攻', color: 'atk-down',    cssClass: 'card-atk-down' },
  vulnerable: { emoji: '💔', label: '易伤', color: 'vulnerable',  cssClass: 'card-vulnerable' },
  stun:       { emoji: '💫', label: '眩晕', color: 'stun',        cssClass: 'card-stun' },
  atk_buff:   { emoji: '⚡', label: '攻加', color: 'atk-buff',    cssClass: 'card-atk-buff' },
  def_buff:   { emoji: '💨', label: '减伤', color: 'def-buff',    cssClass: 'card-def-buff' },
};

var BUFF_TYPES = { vulnerable:1, stun:1, atk_buff:1, def_buff:1, atk_down:1 };

// ========== 牌组构成 ==========
var DECK_SIZES = {
  attack:     50,
  defend:     50,
  heal:       25,
  wild:       10,
  atk_down:   25,
  vulnerable: 25,
  stun:       15,
  atk_buff:   20,
  def_buff:   20,
};

(function() {
  var total = 0;
  for (var k in DECK_SIZES) total += DECK_SIZES[k];
  CONFIG.TOTAL_CARDS = total;
  CONFIG.CARDS_PER_PILE = Math.floor(total / (CONFIG.BOARD_ROWS * CONFIG.BOARD_COLS));
})();

// ========== Boss 行动循环模板（新版7回合） ==========
// 所有 Boss 共用，10只猫猫在此基础上加专属 traits
var BOSS_CYCLE_TEMPLATE = [
  { type: 'attack' },
  { type: 'defend' },
  { type: 'buff_power' },
  { type: 'attack' },
  { type: 'defend' },
  { type: 'charge' },
  { type: 'rage' },
];

// ========== Boss 通用触发器 ==========
var GROOM_TRIGGER = {
  id: 'groom',
  condition: function(turn) { return turn > 0 && turn % 4 === 0; },
  execute: function(G) {
    // 清空 Boss 自身 Debuff
    G.enemyEffects.atk_down = 0;
    G.enemyEffects.atk_down_pct = 0;
    G.enemyEffects.stun = 0;
    log('🐱 舔毛！Boss 清除自身 Debuff');
  }
};

var HISS_TRIGGER = {
  id: 'hiss',
  prevHP: null, // 初始化时记录
  condition: function(G) {
    if (this.prevHP === null) this.prevHP = G.enemyMaxHP;
    var triggered = false;
    // 检查是否跨越了 100 血阈值
    var prevThreshold = Math.floor(this.prevHP / 100);
    var curThreshold = Math.floor(G.enemyHP / 100);
    if (curThreshold < prevThreshold && G.enemyHP > 0) {
      triggered = true;
    }
    this.prevHP = G.enemyHP;
    return triggered;
  },
  execute: function(G) {
    // 清空全场 Buff/Debuff
    G.playerEffects = {};
    G.enemyEffects = {};
    log('🐱 哈气！！全场 Buff/Debuff 清空！');
  }
};

// ========== 10只猫猫 Boss 定义 ==========
var BOSSES = {
  tabby: {  // 狸花猫
    id: 'tabby', name: '狸花猫', emoji: '🐱',
    maxHP: 300, baseAtk: 24, startShield: 0,
    cycle: BOSS_CYCLE_TEMPLATE,
    traits: [{
      id: 'lock_pile',
      onTurnStart: function(G) {
        if (G.turn % 2 !== 0) return; // 每2回合
        var flat = G.piles.flat();
        var candidates = [];
        for (var i = 0; i < flat.length; i++) {
          if (flat[i].length > 0 && !G.lockedPiles[i]) candidates.push(i);
        }
        if (candidates.length < 2) return;
        // 随机锁2摞
        shuffleArray(candidates);
        G.lockedPiles = G.lockedPiles || {};
        G.lockedPiles[candidates[0]] = 2;
        G.lockedPiles[candidates[1]] = 2;
        log('🐱 狸花锁牌：锁定了2摞牌，持续2回合');
      },
      onTurnEnd: function(G) {
        if (!G.lockedPiles) return;
        for (var k in G.lockedPiles) {
          G.lockedPiles[k]--;
          if (G.lockedPiles[k] <= 0) delete G.lockedPiles[k];
        }
      }
    }],
    hpTriggers: [GROOM_TRIGGER, HISS_TRIGGER],
  },

  sphynx: {  // 斯芬克斯
    id: 'sphynx', name: '斯芬克斯', emoji: '🐱',
    maxHP: 300, baseAtk: 24, startShield: 0,
    cycle: BOSS_CYCLE_TEMPLATE,
    traits: [{
      id: 'lick_player',
      onTurnStart: function(G) {
        if (G.turn > 0 && G.turn % 3 === 0) {
          // 舔掉玩家 Buff（保留 Debuff）
          if (G.playerEffects.atk_buff) delete G.playerEffects.atk_buff;
          if (G.playerEffects.def_buff) delete G.playerEffects.def_buff;
          log('🐱 斯芬克斯舔主角！玩家 Buff 被舔掉');
        }
      }
    }],
    hpTriggers: [GROOM_TRIGGER, HISS_TRIGGER],
  },

  british_shorthair: {  // 英短蓝猫
    id: 'british_shorthair', name: '英短蓝猫', emoji: '🐱',
    maxHP: 300, baseAtk: 24, startShield: 0,
    cycle: BOSS_CYCLE_TEMPLATE,
    traits: [{
      id: 'lock_slot',
      onTurnStart: function(G) {
        if (G.turn % 3 !== 0) return;
        var free = [];
        for (var i = 0; i < CONFIG.SLOT_SIZE; i++) {
          if (!G.lockedSlots || !G.lockedSlots[i]) free.push(i);
        }
        if (free.length < 2) return;
        shuffleArray(free);
        G.lockedSlots = G.lockedSlots || {};
        G.lockedSlots[free[0]] = 2;
        G.lockedSlots[free[1]] = 2;
        log('🐱 英短锁槽：锁定了2个槽位，持续2回合');
      },
      onTurnEnd: function(G) {
        if (!G.lockedSlots) return;
        for (var k in G.lockedSlots) {
          G.lockedSlots[k]--;
          if (G.lockedSlots[k] <= 0) delete G.lockedSlots[k];
        }
      }
    }],
    hpTriggers: [GROOM_TRIGGER, HISS_TRIGGER],
  },

  american_shorthair: {  // 美短虎斑
    id: 'american_shorthair', name: '美短虎斑', emoji: '🐱',
    maxHP: 300, baseAtk: 24, startShield: 0,
    cycle: BOSS_CYCLE_TEMPLATE,
    traits: [{ id: 'hide_intent', onTurnStart: function(G) { G.hideIntent = true; } }],
    hpTriggers: [GROOM_TRIGGER, HISS_TRIGGER],
  },

  abyssinian: {  // 阿比西尼亚
    id: 'abyssinian', name: '阿比西尼亚', emoji: '🐱',
    maxHP: 300, baseAtk: 24, startShield: 0,
    cycle: BOSS_CYCLE_TEMPLATE,
    traits: [{
      id: 'random_discard',
      onResolve: function(G, combos) {
        if (!G.slot.length) return;
        var idx = Math.floor(Math.random() * G.slot.length);
        var card = G.slot.splice(idx, 1)[0];
        log('🐱 阿比拍飞了一张 ' + CARD_TYPES[card.type].emoji + '！');
      }
    }],
    hpTriggers: [GROOM_TRIGGER, HISS_TRIGGER],
  },

  ragdoll: {  // 布偶猫
    id: 'ragdoll', name: '布偶猫', emoji: '🐱',
    maxHP: 300, baseAtk: 24, startShield: 0,
    cycle: BOSS_CYCLE_TEMPLATE,
    traits: [{
      id: 'smear_piles',
      onTurnStart: function(G) {
        var flat = G.piles.flat();
        var candidates = [];
        for (var i = 0; i < flat.length; i++) {
          if (flat[i].length > 0) candidates.push(i);
        }
        if (candidates.length < 2) return;
        shuffleArray(candidates);
        G.smearedPiles = G.smearedPiles || {};
        G.smearedPiles[candidates[0]] = true;
        G.smearedPiles[candidates[1]] = true;
        log('🐱 布偶趴牌：涂抹了2摞牌');
      },
      onTurnEnd: function(G) { G.smearedPiles = {}; }
    }],
    hpTriggers: [GROOM_TRIGGER, HISS_TRIGGER],
  },

  bengal: {  // 豹猫
    id: 'bengal', name: '豹猫', emoji: '🐱',
    maxHP: 300, baseAtk: 24, startShield: 0,
    cycle: BOSS_CYCLE_TEMPLATE,
    traits: [{
      id: 'time_limit',
      onTurnStart: function(G) {
        G.maxTurns = G.maxTurns || 24;
        if (G.turn >= G.maxTurns) {
          endGame(false, '⏰ 24回合已到！豹猫赢了...');
        }
      }
    }],
    hpTriggers: [GROOM_TRIGGER, HISS_TRIGGER],
  },

  siamese: {  // 暹罗猫
    id: 'siamese', name: '暹罗猫', emoji: '🐱',
    maxHP: 300, baseAtk: 24, startShield: 0,
    cycle: BOSS_CYCLE_TEMPLATE,
    traits: [{
      id: 'insert_junk',
      onTurnStart: function(G) {
        var halfHP = G.enemyMaxHP / 2;
        var junkCount = (G.enemyHP > halfHP) ? (G.turn % 2 === 0 ? 0 : 1) : 1;
        if (junkCount === 0) return;
        for (var j = 0; j < junkCount; j++) {
          var flat = G.piles.flat();
          var candidates = [];
          for (var i = 0; i < flat.length; i++) {
            if (flat[i].length > 0) candidates.push(i);
          }
          if (!candidates.length) return;
          var idx = candidates[Math.floor(Math.random() * candidates.length)];
          flat[idx].push({ type: 'junk', id: G.pickedId++, isJunk: true });
        }
        log('🐱 暹罗捣乱：塞了' + junkCount + '张废牌！');
      }
    }],
    hpTriggers: [GROOM_TRIGGER, HISS_TRIGGER],
  },

  scottish_fold: {  // 折耳猫
    id: 'scottish_fold', name: '折耳猫', emoji: '🐱',
    maxHP: 300, baseAtk: 24, startShield: 0,
    cycle: BOSS_CYCLE_TEMPLATE,
    traits: [{
      id: 'stun_player',
      onTurnStart: function(G) {
        if (G.turn > 0 && G.turn % 5 === 0) {
          G.playerSkipped = true;
          log('🐱 折耳发作！玩家本回合无法行动');
        }
      }
    }],
    hpTriggers: [GROOM_TRIGGER, HISS_TRIGGER],
  },

  maine_coon: {  // 缅因猫
    id: 'maine_coon', name: '缅因猫', emoji: '🐱',
    maxHP: 300, baseAtk: 24, startShield: 0,
    cycle: BOSS_CYCLE_TEMPLATE,
    traits: [{
      id: 'boss_first',
      // 每回合Boss先手：在 executeTurn 中特殊处理（跳过玩家阶段直接enemyTurn）
    }],
    hpTriggers: [GROOM_TRIGGER, HISS_TRIGGER],
  },

  // 教学关骷髅（保留供第一关使用）
  skeleton: {
    id: 'skeleton', name: '骷髅', emoji: '💀',
    maxHP: 100, baseAtk: 12, startShield: 0,
    cycle: [
      { type: 'attack' },
      { type: 'defend', shield: 15 },
      { type: 'buff_power' },
      { type: 'attack' },
      { type: 'double_attack' },
      { type: 'defend', shield: 20 },
      { type: 'rage', bonus: 3 },
    ],
    traits: [],
    hpTriggers: [],
  }
};

// ========== 圣物定义 ==========
var RELICS = {
  double_wild: {
    id: 'double_wild', name: '双生花', type: 'rule',
    desc: '万能卡数量翻倍',
    onInit: function(G) { G.deckConfig.wild *= 2; },
  },
  combo_core: {
    id: 'combo_core', name: '连击核心', type: 'rule',
    desc: '最小连击数 -1（3→2，全局生效）',
    onInit: function(G) { G.effectiveMinCombo = 2; },
  },
  slot_plus2: {
    id: 'slot_plus2', name: '扩容核心', type: 'rule',
    desc: '消除槽 +2（10→12）',
    onInit: function(G) { G.effectiveSlotSize = CONFIG.SLOT_SIZE + 2; },
  },
  endurance_core: {
    id: 'endurance_core', name: '耐久核心', type: 'rule',
    desc: 'Buff/Debuff 持续时间 +1 回合',
    onInit: function(G) { G.buffDurationBonus = 1; },
  },
  prophet: {
    id: 'prophet', name: '先知', type: 'info',
    desc: '卡牌区额外显示一行（可见牌 +5）',
    onInit: function(G) { G.extraVisible = 5; },
  },
  wild_slot: {
    id: 'wild_slot', name: '万能槽', type: 'rule',
    desc: '每回合首个槽位自动生成一张万能卡',
    onInit: function(G) { G.autoWildSlot = true; },
  },
  overload_core: {
    id: 'overload_core', name: '过载核心', type: 'rule',
    desc: 'Buff/Debuff 效果提升至 200%',
    onInit: function(G) {
      G.atkBuffMult = CONFIG.ATK_BUFF_MULT * 2;
      G.vulnMult = CONFIG.VULN_MULT * 2;
      G.defBuffRatio = Math.max(0.1, CONFIG.DEF_BUFF_RATIO - (1 - CONFIG.DEF_BUFF_RATIO));
    },
  },
  spirit_core: {
    id: 'spirit_core', name: '元气核心', type: 'rule',
    desc: '未消除的单卡不消耗生命值',
    onInit: function(G) { G.noUnmatchedPenalty = true; },
  },
  lifesaving_fur: {
    id: 'lifesaving_fur', name: '救命毫毛', type: 'function',
    desc: '开局获得三张特殊卡：特攻20/特防20/神佑1回合免伤',
    onInit: function(G) {
      G.specialCards = [
        { type: 'special_atk', label: '特攻', emoji: '⚔️', dmg: 20 },
        { type: 'special_def', label: '特防', emoji: '🛡️', shield: 20 },
        { type: 'divine', label: '神佑', emoji: '✨', immune: true },
      ];
    },
  },
  tenacity_core: {
    id: 'tenacity_core', name: '坚韧核心', type: 'stat',
    desc: '首次受到致命伤害时触发免伤，HP锁定为1（每局一次）',
    onInit: function(G) { G.tenacityUsed = false; },
  },
  fury_core: {
    id: 'fury_core', name: '狂暴核心', type: 'stat',
    desc: '生命值每降低1%，全部卡牌效果数值+1%',
    onInit: function(G) { G.furyEnabled = true; },
    getMultiplier: function(G) {
      var hpLoss = 1 - G.playerHP / G.playerMaxHP;
      return 1 + hpLoss; // 满血×1.0，空血×2.0
    },
  },
  life_core: {
    id: 'life_core', name: '生命核心', type: 'stat',
    desc: '最大生命值 +50',
    onInit: function(G) { G.playerMaxHP = CONFIG.PLAYER_MAX_HP + 50; },
  },
};
