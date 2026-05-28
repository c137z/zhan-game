// ============================================================
//  斩 v14 — core.js
//  战斗引擎：洗牌/发牌/结算/状态管理/敌人回合
//  依赖 data.js（先加载）
// ============================================================

// Array.prototype.flat() Polyfill（兼容旧浏览器）
if (!Array.prototype.flat) {
  Array.prototype.flat = function(depth) {
    depth = depth === undefined ? 1 : parseInt(depth, 10);
    if (depth < 1) return this.slice();
    var result = [];
    for (var i = 0; i < this.length; i++) {
      var val = this[i];
      if (Array.isArray(val)) {
        result = result.concat(val.flat(depth - 1));
      } else {
        result.push(val);
      }
    }
    return result;
  };
}

// flatten 工具函数（安全替代 .flat()，兼容所有浏览器）
function flatten(arr) {
  var result = [];
  for (var i = 0; i < arr.length; i++) {
    for (var j = 0; j < arr[i].length; j++) {
      result.push(arr[i][j]);
    }
  }
  return result;
}

// ========== 伤害公式 ==========
function calcBaseValue(totalCount) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO; return 4 + (totalCount - minCombo) * 2;
}

function calcPursuitMultiplier(maxComboLen) {
  if (maxComboLen < 4) return 1;
  return 1 + (maxComboLen - 3) * 0.1;
}

function calcAttackValue(totalCount, maxComboLen, G) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  if (totalCount < minCombo) return 0;
  return Math.ceil(calcBaseValue(totalCount) * calcPursuitMultiplier(maxComboLen));
}

function calcDefendValue(totalCount, maxComboLen, G) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  if (totalCount < minCombo) return 0;
  return Math.floor(calcBaseValue(totalCount) * calcPursuitMultiplier(maxComboLen));
}

function calcHealValue(totalCount, maxComboLen, G) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  if (totalCount < minCombo) return 0;
  return Math.floor(calcBaseValue(totalCount) * calcPursuitMultiplier(maxComboLen));
}

// ========== 圣物修正器 ==========
function applyRelicModifiers(type, val, G) {
  // 过载核心：buff/debuff效果翻倍（在 applyStatusEffects 中处理）
  // TASK: FURY_DYNAMIC — fury 已实时融入 effectiveAtkBuffMult/effectiveVulnMult，
  // applyRelicModifiers 不再单独叠加 fury 倍率
  return val;
}

// TASK: FURY_DYNAMIC — 狂暴核心实时驱动 effective 值，随血量变化
function updateEffectiveFuryValues(G) {
  if (G.furyEnabled && RELICS.fury_core) {
    var furyMult = RELICS.fury_core.getMultiplier(G);
    // effectiveAtkBuffMult: base atk_buff 倍率 × fury（实时随动）
    G.effectiveAtkBuffMult = (G.atkBuffMult || CONFIG.ATK_BUFF_MULT) * furyMult;
    // effectiveVulnMult: base vuln 倍率 × fury（实时随动）
    G.effectiveVulnMult = (G.vulnMult || CONFIG.VULN_MULT) * furyMult;
    // effectiveDefBuffRatio: 减伤比率按 fury 增强，公式 1 - (1-baseRatio) * furyMult
    // 下限 0（最多减伤 100%，即伤害×0）
    var baseRatio = G.defBuffRatio || CONFIG.DEF_BUFF_RATIO;
    G.effectiveDefBuffRatio = Math.max(0, 1 - (1 - baseRatio) * furyMult);
  } else {
    G.effectiveAtkBuffMult = G.atkBuffMult || CONFIG.ATK_BUFF_MULT;
    G.effectiveVulnMult = G.vulnMult || CONFIG.VULN_MULT;
    G.effectiveDefBuffRatio = G.defBuffRatio || CONFIG.DEF_BUFF_RATIO;
  }
}

function applyStatusEffects(type, val, G) {
  // TASK: FURY_DYNAMIC — 每次调用前刷新 effective 值，确保实时随血量
  updateEffectiveFuryValues(G);
  switch (type) {
    case 'attack':
      if (G.effectiveAtkBuffMult > 0) val = Math.ceil(val * G.effectiveAtkBuffMult);
      if (G.effectiveVulnMult > 0) val = Math.ceil(val * G.effectiveVulnMult);
      break;
    case 'defend':
    case 'heal':
      // 防御/回血不受 atk_buff/vulnerable 影响
      break;
  }
  return val;
}

// 跳过槽位计数（pullCard 中跨作用域用）
var _skippedSlots = 0;

// ========== 游戏状态 ==========
var G = {};

function newGame() {
  var bossId = G.bossId || 'skeleton';
  var boss = BOSSES[bossId];
  var relics = G.activeRelics || [];
  var stage = G.currentStage || 1;

  G = {
    deck: [], piles: [], slot: [],
    playerHP: CONFIG.PLAYER_MAX_HP,
    playerMaxHP: CONFIG.PLAYER_MAX_HP,
    playerShield: 0,
    enemyHP: boss.maxHP,
    enemyMaxHP: boss.maxHP,
    enemyShield: boss.startShield || 0,
    enemyPower: 0,
    turn: 0,
    phase: 'player',
    pickedId: 0,
    logLines: [],
    over: false,
    playerEffects: {},
    enemyEffects: {},
    bossId: bossId,
    boss: boss,
    activeRelics: relics,
    effectiveMinCombo: CONFIG.MIN_COMBO,
    effectiveSlotSize: CONFIG.SLOT_SIZE,
    effectiveAtkBuffMult: 0,
    effectiveVulnMult: 0,
    buffDurationBonus: 0,
    deckConfig: JSON.parse(JSON.stringify(DECK_SIZES)),
    lockedPiles: {},
    lockedSlots: {},
    smearedPiles: {},
    hideIntent: false,
    playerSkipped: false,
    currentStage: stage,
    maxCombo: 0,
    maxDamage: 0,
    totalDamage: 0,
    activeRelicNames: relics.map(function(r) { return (RELICS[r] && RELICS[r].name) || r; }),
  };

  // 初始化圣物
  for (var i = 0; i < relics.length; i++) {
    var relic = RELICS[relics[i]];
    if (relic && relic.onInit) relic.onInit(G);
  }

  // 开局满血：先用 maxHP 初始化 playerHP，确保生命核心等圣物修改 maxHP 后开局满血
  G.playerHP = G.playerMaxHP;

  // 初始化哈气 prevHP（挂在 G 上，不共享全局单例）
  if (boss.hpTriggers) {
    for (var j = 0; j < boss.hpTriggers.length; j++) {
      if (boss.hpTriggers[j].id === 'hiss') {
        G.hissPrevHP = boss.maxHP;
      }
    }
  }

  buildDeck();
  // 美短虎斑 hide_intent：必须在首次 render() 前设置，避免第一回合意图泄漏
  if (boss.traits) {
    for (var _bi = 0; _bi < boss.traits.length; _bi++) {
      if (boss.traits[_bi].id === 'hide_intent') {
        G.hideIntent = true;
        break;
      }
    }
  }
  // 救命毫毛：特殊卡插入
  if (G.specialCards) {
    for (var sc = 0; sc < G.specialCards.length; sc++) {
      G.deck.unshift({ type: G.specialCards[sc].type, id: G.pickedId++, special: G.specialCards[sc] });
    }
    log('🪶 救命毫毛！获得' + G.specialCards.length + '张特殊卡');
  }
  shuffle(G.deck);
  buildPiles();
  render();
  updateEnemyIntent();
  log('🐱 新局开始！双击或向下拖拽卡牌进槽');
}

function buildDeck() {
  G.deck = [];
  for (var type in G.deckConfig) {
    for (var i = 0; i < G.deckConfig[type]; i++) {
      G.deck.push({ type: type, id: G.pickedId++ });
    }
  }
}

function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
}

function shuffleArray(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
}

function buildPiles() {
  G.piles = [];
  for (var r = 0; r < CONFIG.BOARD_ROWS; r++) {
    G.piles[r] = [];
    for (var c = 0; c < CONFIG.BOARD_COLS; c++) G.piles[r][c] = [];
  }
  var idx = 0;
  var totalCards = G.deck.length;
  var nPiles = CONFIG.BOARD_ROWS * CONFIG.BOARD_COLS;
  var basePileSize = Math.floor(totalCards / nPiles);
  var remaining = totalCards - basePileSize * nPiles;
  var flatPiles = [];
  for (var r = 0; r < CONFIG.BOARD_ROWS; r++) {
    for (var c = 0; c < CONFIG.BOARD_COLS; c++) {
      flatPiles.push(G.piles[r][c]);
    }
  }
  for (var i = 0; i < flatPiles.length; i++) {
    var size = basePileSize + (i < remaining ? 1 : 0);
    for (var j = 0; j < size; j++) flatPiles[i].push(G.deck[idx++]);
  }
  for (var pi = 0; pi < flatPiles.length; pi++) {
    var pile = flatPiles[pi];
    if (pile.length > 1) {
      var topN = Math.min(4, pile.length);
      var top = pile.slice(0, topN);
      for (var ti = top.length - 1; ti > 0; ti--) {
        var tj = Math.floor(Math.random() * (ti + 1));
        var tt = top[ti]; top[ti] = top[tj]; top[tj] = tt;
      }
      for (var ti = 0; ti < top.length; ti++) pile[ti] = top[ti];
    }
  }
}

function getTop(pile) { return pile && pile.length ? pile[pile.length-1] : null; }
function popTop(pile) { return pile && pile.length ? pile.pop() : null; }

function pullCard(r, c) {
  if (G.phase !== 'player' || G.over) return false;
  // 检查锁定牌堆
  var flatIdx = r * CONFIG.BOARD_COLS + c;
  if (G.lockedPiles && G.lockedPiles[flatIdx]) {
    log('🔒 这摞牌被锁定了！');
    return false;
  }
  var pile = G.piles[r][c];
  var top = getTop(pile);
  if (!top || G.slot.length >= G.effectiveSlotSize) return false;
  var card = popTop(pile);
  if (!card) return false;
  // 万能核心：slot[0] 预留给万能核心卡，用户卡牌从 slot[1] 开始
  if (G.wildCoreSlot && G.slot.length === 0) {
    G.slot.push(null); // 占位 slot[0]，executeTurn 时填充万能卡
  }
  // 锁定槽位：跳过被锁槽，在后面第一个可用位置插入
  // 被锁槽在 slot 数组中保持 null 占位
  _skippedSlots = 0;
  var maxSize = G.effectiveSlotSize || CONFIG.SLOT_SIZE;
  if (G.lockedSlots) {
    var insIdx = G.slot.length;
    while (insIdx < maxSize && G.lockedSlots[insIdx]) {
      G.slot.push(null); // 占位锁定槽
      insIdx++;
      _skippedSlots++;
    }
    if (insIdx >= maxSize) {
      log('🔒 所有剩余槽位都被锁定了！');
      // 回滚占位 null
      while (_skippedSlots > 0) { G.slot.pop(); _skippedSlots--; }
      return false;
    }
  }
  G.slot.push(card);
  updateComboPreview();
  var ct = CARD_TYPES[card.type] || { emoji: '⬜', label: '废牌' };
  log(ct.emoji + ct.label + '→槽(' + G.slot.length + '/' + G.effectiveSlotSize + ')' + (_skippedSlots > 0 ? ' 🔒跳过' + _skippedSlots + '格' : ''));
  render();
  document.getElementById('btn-end-turn').disabled = false;
  return true;
}

// ========== 万能牌解析 ==========
function resolveWildType(slot, idx) {
  if (!slot[idx] || slot[idx].isJunk) return 'junk';
  if (slot[idx].type !== 'wild') return slot[idx].type;
  for (var k = idx-1; k >= 0; k--) { if (slot[k] && slot[k].type !== 'wild' && !slot[k].isJunk) return slot[k].type; }
  for (var k = idx+1; k < slot.length; k++) { if (slot[k] && slot[k].type !== 'wild' && !slot[k].isJunk) return slot[k].type; }
  return 'wild';
}

function computeCombos(slot) {
  if (!slot.length) return [];
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  // 过滤 null（锁定槽占位），只处理非 null 卡牌
  var resolved = slot.map(function(c, i) {
    if (!c) return { type: 'null_placeholder', card: null, index: i };
    return { type: resolveWildType(slot, i), card: c, index: i };
  });
  var combos = [];
  var i = 0;
  while (i < resolved.length) {
    var typ = resolved[i].type;
    if (typ === 'null_placeholder' || typ === 'wild' || typ === 'junk') { i++; continue; }
    var j = i+1;
    while (j < resolved.length && resolved[j].type === typ) j++;
    var comboLen = j - i;
    // 万能核心：后方卡牌（i>=1）连击数+1
    // 万能核心卡（slot[0]）会通过 resolveWildType 合并类型，此处额外+1奖励
    if (G.wildCoreSlot && i >= 1) {
      comboLen += 1; // 万能核心后方卡连击数+1
    }
    if (comboLen >= minCombo) {
      combos.push({ n: comboLen, cards: slot.slice(i,j), type: typ, start: i, end: j });
    }
    i = j;
  }
  return combos;
}

// T1: COMBO_DURATION_UNCAP — 每多1连+1T, 无上限
// 3连=1T, 4连=2T, 10连=8T
function getComboDuration(n) {
  return Math.max(1, n - 2);
}

// T1: getStunDuration 统一使用 getComboDuration
function getStunDuration(n) {
  return getComboDuration(n);
}

function getEffectDescription(type, n) {
  var dur = getComboDuration(n);
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  // TASK: FURY_DYNAMIC — 预览显示 fury 翻倍后的 dur，与 runtime/badge 一致
  if (G.furyEnabled && RELICS.fury_core) dur = Math.ceil(dur * RELICS.fury_core.getMultiplier(G));
  // TASK: FURY_DYNAMIC — 实时刷新 effective 值，预览显示随血量变化的倍率
  updateEffectiveFuryValues(G);
  switch (type) {
    case 'vulnerable':
      var vm = G.effectiveVulnMult || CONFIG.VULN_MULT;
      // T3: 去尾零 — 1.50→1.5
      return '易伤×' + parseFloat(vm.toFixed(2)) + ' ' + dur + '回合';
    case 'stun':
      var stunDur = getStunDuration(n);

      if (G.furyEnabled && RELICS.fury_core) stunDur = Math.ceil(stunDur * RELICS.fury_core.getMultiplier(G));
      return '眩晕 ' + stunDur + '回合';
    case 'atk_buff':   return '攻×' + parseFloat(G.effectiveAtkBuffMult.toFixed(2)) + ' ' + dur + '回合';
    case 'def_buff':   return '减伤×' + parseFloat(G.effectiveDefBuffRatio.toFixed(2)) + ' ' + dur + '回合';
    // T3: atk_down 百分比动态取值
    case 'atk_down':   return '降攻-' + (G.enemyEffects.atk_down_pct || CONFIG.ATK_DOWN_PCT) + '% ' + dur + '回合';
    default: return '';
  }
}

// ========== 执行回合 ==========
function executeTurn() {
  if (G.phase !== 'player' || G.over) return;

  // 折耳猫：晕玩家
  if (G.playerSkipped) {
    G.playerSkipped = false;
    G.phase = 'resolving';
    log('🐱 被晕眩，跳过回合！');
    G.slot = [];
    render();
    updateEnemyIntent();
    document.getElementById('btn-end-turn').disabled = true;
    setTimeout(function() { enemyTurn(); }, 300);
    return;
  }

  // 缅因猫先手：Boss先行动
  if (G.boss && G.boss.id === 'maine_coon') {
    G._maineCoonFirst = true;
    enemyTurn();
    if (G.over) return;
  }

  G.phase = 'resolving';
  log('▶ 回合' + (G.turn+1));
  log('⚔️ 勇者行动');

  G.playerShield = 0;

  // 万能核心圣物：首槽固定万能卡，后方卡连击数+1
  // slot[0] 由 pullCard 预占位，此处填充万能卡代替 null 占位
  if (G.wildCoreSlot) {
    if (G.slot[0] === null) {
      G.slot[0] = { type: 'wild', id: G.pickedId++, wildCore: true };
    } else {
      // 无占位时（边缘情况），插入万能卡到最前方
      G.slot.unshift({ type: 'wild', id: G.pickedId++, wildCore: true });
    }
  }

  // Boss专属 onResolve（阿比弃牌等）
  if (G.boss.traits) {
    for (var ti = 0; ti < G.boss.traits.length; ti++) {
      var trait = G.boss.traits[ti];
      if (trait.onResolve) trait.onResolve(G, computeCombos(G.slot));
    }
  }

  var combos = computeCombos(G.slot);

  // 追踪最大连击数
  for (var _ci = 0; _ci < combos.length; _ci++) {
    if (combos[_ci].n > G.maxCombo) G.maxCombo = combos[_ci].n;
  }

  // --- Phase 1: Buff/Debuff ---
  // TASK: FURY_DYNAMIC — fury 实时驱动 effective 值（atkBuffMult / vulnMult / defBuffRatio），
  // 不再在此处静态赋值。dur 仍按 fury 翻倍（结算时一次性，后续由 UI 实时显示剩余回合）。
  log('  ✨ 缓冲结算...');
  for (var ci = 0; ci < combos.length; ci++) {
    var c = combos[ci];
    if (!BUFF_TYPES[c.type]) continue;
    var dur = c.type === 'stun' ? getStunDuration(c.n) : getComboDuration(c.n);
    dur += G.buffDurationBonus || 0;
    switch (c.type) {
      case 'vulnerable':
        // RULE: FURY_SCOPE — fury 对 vulnerable 持续回合翻倍（dur 结算时翻倍）
        if (G.furyEnabled && RELICS.fury_core) dur = Math.ceil(dur * RELICS.fury_core.getMultiplier(G));
        G.enemyEffects.vulnerable = (G.enemyEffects.vulnerable || 0) + dur;
        // effectiveVulnMult 不再静态赋值 — 由 updateEffectiveFuryValues() 实时计算
        log('💔Boss易伤 +' + dur + '→' + G.enemyEffects.vulnerable + '回合');
        break;
      case 'stun':
        G.enemyEffects.stun = (G.enemyEffects.stun || 0) + dur;
        log('💫Boss眩晕 +' + dur + '→' + G.enemyEffects.stun + '回合');
        break;
      case 'atk_buff':
        // RULE: FURY_SCOPE — fury 对 atk_buff 持续回合翻倍（dur 结算时翻倍）
        if (G.furyEnabled && RELICS.fury_core) dur = Math.ceil(dur * RELICS.fury_core.getMultiplier(G));
        G.playerEffects.atk_buff = (G.playerEffects.atk_buff || 0) + dur;
        // effectiveAtkBuffMult 不再静态赋值 — 由 updateEffectiveFuryValues() 实时计算
        log('⚡攻击加成 +' + dur + '→' + G.playerEffects.atk_buff + '回合');
        break;
      case 'def_buff':
        // RULE: FURY_SCOPE — fury 对 def_buff 持续回合翻倍（dur 结算时翻倍）
        if (G.furyEnabled && RELICS.fury_core) dur = Math.ceil(dur * RELICS.fury_core.getMultiplier(G));
        G.playerEffects.def_buff = (G.playerEffects.def_buff || 0) + dur;
        // effectiveDefBuffRatio 不再静态赋值 — 由 updateEffectiveFuryValues() 实时计算
        log('💨减伤 +' + dur + '→' + G.playerEffects.def_buff + '回合');
        break;
      case 'atk_down':
        // RULE: FURY_SCOPE — fury 对 atk_down 降攻百分比翻倍
        var atkDownPct = CONFIG.ATK_DOWN_PCT;
        if (G.activeRelics.indexOf('overload_core') >= 0) atkDownPct = 50;
        if (G.furyEnabled && RELICS.fury_core) dur = Math.ceil(dur * RELICS.fury_core.getMultiplier(G));
        if (G.furyEnabled && RELICS.fury_core) atkDownPct = Math.min(100, atkDownPct * RELICS.fury_core.getMultiplier(G));
        G.enemyEffects.atk_down_pct = atkDownPct;
        G.enemyEffects.atk_down = (G.enemyEffects.atk_down || 0) + dur;
        log('⬇降攻 +' + dur + '→' + G.enemyEffects.atk_down + '回合');
        break;
    }
  }

  // --- Phase 2: 攻击/防御/回血 ---
  log('  ⚡ 行动结算...');
  var slotTypeCount = {};
  for (var si = 0; si < G.slot.length; si++) {
    var st = resolveWildType(G.slot, si);
    if (!BUFF_TYPES[st] && st !== 'junk') {
      if (!slotTypeCount[st]) slotTypeCount[st] = 0;
      slotTypeCount[st]++;
    }
  }

  var actionMaxLen = {};
  for (var ci2 = 0; ci2 < combos.length; ci2++) {
    var c2 = combos[ci2];
    if (BUFF_TYPES[c2.type]) continue;
    if (!actionMaxLen[c2.type] || c2.n > actionMaxLen[c2.type]) {
      actionMaxLen[c2.type] = c2.n;
    }
  }

  // 结算攻击
  if (slotTypeCount.attack && slotTypeCount.attack >= (G.effectiveMinCombo || CONFIG.MIN_COMBO)) {
    var atkTotal = slotTypeCount.attack;
    var atkMaxLen = actionMaxLen.attack || 0;
    var baseAtk = calcBaseValue(atkTotal);
    var d = calcAttackValue(atkTotal, atkMaxLen, G);
    if (d > 0) {
      // TASK: FURY_DYNAMIC — 刷新 effective 值后使用（已包含 fury 倍率）
      updateEffectiveFuryValues(G);
      d = applyRelicModifiers('attack', d, G);
      // 使用 effective value（已含 fury 实时倍率）
      if ((G.playerEffects.atk_buff || 0) > 0) d = Math.ceil(d * G.effectiveAtkBuffMult);
      if ((G.enemyEffects.vulnerable || 0) > 0) d = Math.ceil(d * G.effectiveVulnMult);
      // 追踪伤害统计
      if (d > G.maxDamage) G.maxDamage = d;
      G.totalDamage += d;
      var pursuitLog = '';
      if (atkMaxLen >= 4) pursuitLog = ' ' + atkMaxLen + '连×' + calcPursuitMultiplier(atkMaxLen).toFixed(1);
      if (G.enemyShield > 0) { var ab = Math.min(G.enemyShield, d); G.enemyShield -= ab; d -= ab; }
      G.enemyHP = Math.max(0, G.enemyHP - d);
      log('🗡×' + atkTotal + '→' + baseAtk + pursuitLog + '→总' + d + ' → ' + G.boss.emoji + G.enemyHP + '🛡' + G.enemyShield);
    }
  }

  // 结算防御
  if (slotTypeCount.defend && slotTypeCount.defend >= (G.effectiveMinCombo || CONFIG.MIN_COMBO)) {
    var defTotal = slotTypeCount.defend;
    var defMaxLen = actionMaxLen.defend || 0;
    var baseDef = calcBaseValue(defTotal);
    var shieldVal = calcDefendValue(defTotal, defMaxLen, G);
    if (shieldVal > 0) {
      var pursuitLog = '';
      if (defMaxLen >= 4) pursuitLog = ' ' + defMaxLen + '连×' + calcPursuitMultiplier(defMaxLen).toFixed(1);
      G.playerShield += shieldVal;
      log('🛡×' + defTotal + '→' + baseDef + pursuitLog + '→总' + shieldVal + ' 🛡' + G.playerShield);
    }
  }

  // 结算回血
  if (slotTypeCount.heal && slotTypeCount.heal >= (G.effectiveMinCombo || CONFIG.MIN_COMBO)) {
    var healTotal = slotTypeCount.heal;
    var healMaxLen = actionMaxLen.heal || 0;
    var baseHeal = calcBaseValue(healTotal);
    var healVal = calcHealValue(healTotal, healMaxLen, G);
    if (healVal > 0) {
      var pursuitLog = '';
      if (healMaxLen >= 4) pursuitLog = ' ' + healMaxLen + '连×' + calcPursuitMultiplier(healMaxLen).toFixed(1);
      G.playerHP = Math.min(G.playerMaxHP, G.playerHP + healVal);
      log('❤×' + healTotal + '→' + baseHeal + pursuitLog + '→总' + healVal + ' ❤' + G.playerHP);
    }
  }

  // --- 救命毫毛特殊卡结算（不受连击规则约束，独立结算） ---
  for (var sp = 0; sp < G.slot.length; sp++) {
    var sc = G.slot[sp];
    if (!sc || !sc.special) continue;
    if (sc.type === 'special_atk') {
      var spDmg = sc.special.dmg || 0;
      if (G.enemyShield > 0) { var spAbsorb = Math.min(G.enemyShield, spDmg); G.enemyShield -= spAbsorb; spDmg -= spAbsorb; }
      G.enemyHP = Math.max(0, G.enemyHP - spDmg);
      if (spDmg > G.maxDamage) G.maxDamage = spDmg;
      G.totalDamage += spDmg;
      log('🙈 特攻！→' + (sc.special.dmg || 0) + ' → ' + G.boss.emoji + G.enemyHP + '🛡' + G.enemyShield);
    } else if (sc.type === 'special_def') {
      G.playerShield += (sc.special.shield || 0);
      log('🙉 特防！+🛡' + (sc.special.shield || 0) + ' 🛡' + G.playerShield);
    } else if (sc.type === 'divine') {
      G.playerEffects.divine = 1; // 1回合免伤
      log('🙊 免伤！本回合免疫伤害');
    }
  }

  // --- 未消除惩罚 ---
  if (!G.noUnmatchedPenalty) {
    var unmatchedByType = {};
    for (var si2 = 0; si2 < G.slot.length; si2++) {
      if (!G.slot[si2]) continue; // 跳过 null 占位（锁定槽）
      // 特殊卡不算入未消除惩罚
      if (G.slot[si2].special) continue;
      var mt = resolveWildType(G.slot, si2);
      if (!unmatchedByType[mt]) unmatchedByType[mt] = 0;
      unmatchedByType[mt]++;
    }
    var unmatchedPenalty = 0;
    for (var ut in unmatchedByType) {
      if (unmatchedByType[ut] < (G.effectiveMinCombo || CONFIG.MIN_COMBO)) {
        unmatchedPenalty += unmatchedByType[ut];
      }
    }
    if (unmatchedPenalty > 0) {
      G.playerHP = Math.max(0, G.playerHP - unmatchedPenalty * CONFIG.UNMATCHED_PENALTY);
      log('♀未消除×' + unmatchedPenalty + '→❤-' + unmatchedPenalty);
    }
  }

  G.slot = [];

  // --- Phase 3: Buff层数衰减 ---
  if ((G.playerEffects.atk_buff || 0) > 0) G.playerEffects.atk_buff--;
  // atk_down 衰减已移至 enemyTurn 末尾（保证先衰减再叠加：
  //   敌回合结束衰减 → 下回合 Phase 1 叠新的 atk_down）

  // 检查胜负/元气弹
  if (G.enemyHP <= 0) { endGame(true, G.boss.emoji + ' 击败！'); return; }
  if (G.playerHP <= 0) { endGame(false, '勇者倒下了...'); return; }
  var totalRemaining = 0;
  var fp = flatten(G.piles);
  for (var fi = 0; fi < fp.length; fi++) totalRemaining += fp[fi].length;
  if (totalRemaining === 0) { endGame(true, '✨ 牌库全消！元气弹斩杀！'); return; }

  render();
  updateEnemyIntent();
  document.getElementById('btn-end-turn').disabled = true;

  // 坚韧核心免死检查
  if (G.tenacityUsed === false && G.playerHP <= 0) {
    G.playerHP = 1;
    G.tenacityUsed = true;
    log('🛡 坚韧核心触发！HP锁定为1');
  }

  if (G._maineCoonFirst) {
    G._maineCoonFirst = false;
    G.phase = 'player';
    log('⏭ 回合' + (G.turn+1) + '开始');
    log(G.boss.emoji + 'HP:' + G.enemyHP + '🛡' + G.enemyShield + '⚡' + G.enemyPower);
    render();
    updateEnemyIntent();
    document.getElementById('btn-end-turn').disabled = false;
  } else {
    setTimeout(function() { enemyTurn(); }, 400);
  }
}

// ========== 辅助：破盾后扣玩家血量 ==========
function applyDamageToPlayer(dmg, rawAtk, label) {
  // 免伤（救命毫毛/divine）：本回合免疫伤害
  if ((G.playerEffects.divine || 0) > 0) {
    log('🙊 免伤抵挡了 ' + rawAtk + ' 伤害！');
    return;
  }
  // TASK: FURY_DYNAMIC — 减伤比率实时随血量，effectiveDefBuffRatio 已包含 fury
  if ((G.playerEffects.def_buff || 0) > 0) {
    updateEffectiveFuryValues(G); // 每次计算前刷新，确保实时随动
    var ratio = G.effectiveDefBuffRatio || CONFIG.DEF_BUFF_RATIO;
    dmg = Math.floor(dmg * ratio);
  }
  // 破盾
  if (G.playerShield > 0) {
    var absorb = Math.min(G.playerShield, dmg);
    G.playerShield -= absorb;
    dmg -= absorb;
  }
  G.playerHP = Math.max(0, G.playerHP - dmg);
  log(label + rawAtk + ' → ❤-' + dmg + '🛡' + G.playerShield);

  // 坚韧核心免死：扣血后触发
  if (G.tenacityUsed === false && G.playerHP <= 0) {
    G.playerHP = 1;
    G.tenacityUsed = true;
    log('🛡 坚韧核心触发！HP锁定为1');
  }
}

// ========== 敌人回合 ==========
function enemyTurn() {
  log(G.boss.emoji + ' ' + G.boss.name + '行动');
  G.enemyShield = 0;

  // T2: BOSS_TURN_REORDER — 哈气→舔毛→眩晕检查→行动

  // 1. 哈气检查（HP跨阈值）
  if (G.boss.hpTriggers) {
    for (var hi = 0; hi < G.boss.hpTriggers.length; hi++) {
      var trigger = G.boss.hpTriggers[hi];
      if (trigger.id !== 'groom' && trigger.condition && trigger.condition(G)) {
        trigger.execute(G);
      }
    }
  }

  // 2. 舔毛检查（每4回合，可清除眩晕）
  if (G.boss.hpTriggers) {
    for (var hi2 = 0; hi2 < G.boss.hpTriggers.length; hi2++) {
      var trigger2 = G.boss.hpTriggers[hi2];
      if (trigger2.id === 'groom' && trigger2.condition && trigger2.condition(G)) {
        trigger2.execute(G);
        if (G.over) return;
      }
    }
  }

  // 3. 眩晕检查（舔毛可能已清除眩晕，此时不跳过）
  if ((G.enemyEffects.stun || 0) > 0) {
    log('💫 ' + G.boss.name + '眩晕，跳过回合！');
    G.enemyEffects.stun--;
    if (G.enemyEffects.stun <= 0) G.enemyEffects.stun = 0;
    G.turn++;
    G.phase = 'player';
    log('⏭ 回合' + (G.turn+1) + '开始');
    render(); updateEnemyIntent();
    document.getElementById('btn-end-turn').disabled = false;
    return;
  }

  // Boss 专属 onTurnStart（眩晕跳过之后，正常行动之前）
  if (G.boss.traits) {
    for (var ti = 0; ti < G.boss.traits.length; ti++) {
      var trait = G.boss.traits[ti];
      if (trait.onTurnStart) trait.onTurnStart(G);
      if (G.over) return;
    }
  }

  // 执行 Boss 行动循环
  var t = G.turn;
  // 8+回合 → 4回快速循环（攻/防/蓄/怒）
  var fastCycle = [
    { type: 'attack' },
    { type: 'defend' },
    { type: 'charge' },
    { type: 'rage' },
  ];
  var useCycle = t >= 7 ? fastCycle : G.boss.cycle;
  var cycle = useCycle[t >= 7 ? (t - 7) % fastCycle.length : t % G.boss.cycle.length];
  var rawAtk = G.boss.baseAtk + G.enemyPower;

  // 降攻效果
  if ((G.enemyEffects.atk_down || 0) > 0) {
    var reduction = G.enemyEffects.atk_down_pct || CONFIG.ATK_DOWN_PCT;
    rawAtk = Math.floor(rawAtk * (1 - reduction/100));
  }

  var shieldVal = 40 + Math.floor(G.enemyPower / 2) * 2; // 初始40，随力量递增

  switch (cycle.type) {
    case 'attack':
      var d = rawAtk;
      applyDamageToPlayer(d, rawAtk, G.boss.emoji + '攻击');
      break;

    case 'defend':
      G.enemyShield += (cycle.shield || shieldVal);
      log(G.boss.emoji + '防御+' + (cycle.shield || shieldVal) + ' 🛡' + G.enemyShield);
      break;

    case 'buff_power':
      G.enemyPower += 2;
      log(G.boss.emoji + '蓄力+2 ⚡' + G.enemyPower);
      break;

    case 'charge':
      log(G.boss.emoji + ' 蓄力中……');
      break;

    case 'rage':
      if (cycle.powerBoost) G.enemyPower += cycle.powerBoost;
      var rageMult = cycle.multiplier || 2;
      var rageDmg = rawAtk * rageMult;
      applyDamageToPlayer(rageDmg, rawAtk * rageMult, G.boss.emoji + '怒击×' + rageMult + (cycle.powerBoost ? ' +⚡' + cycle.powerBoost : '') + '=');
      break;

    case 'double_attack':
      var d2 = rawAtk * 2;
      applyDamageToPlayer(d2, rawAtk * 2, G.boss.emoji + '双重攻击');
      break;

    default:
      log(G.boss.emoji + ' ' + G.boss.name + ' 未定义行动');
  }

  if (G.playerHP <= 0) { endGame(false, '勇者倒下了...'); return; }

  // Boss 专属 onTurnEnd
  if (G.boss.traits) {
    for (var tj = 0; tj < G.boss.traits.length; tj++) {
      var trait2 = G.boss.traits[tj];
      if (trait2.onTurnEnd) trait2.onTurnEnd(G);
    }
  }

  // 衰减敌方效果 + 玩家def_buff
  for (var k in G.enemyEffects) {
    if (G.enemyEffects[k] > 0) G.enemyEffects[k]--;
  }
  // atk_down 衰减后清理 pct（atk_down=0 时清除降攻百分比）
  if ((G.enemyEffects.atk_down || 0) <= 0) {
    G.enemyEffects.atk_down = 0;
    G.enemyEffects.atk_down_pct = 0;
  }
  if ((G.playerEffects.def_buff || 0) > 0) G.playerEffects.def_buff--;
  if ((G.playerEffects.divine || 0) > 0) G.playerEffects.divine--; // 免伤衰减

  // 清理 slot 中 null 占位（锁定过期后）
  if (G.lockedSlots) {
    var cleaned = [];
    for (var ci = 0; ci < G.slot.length; ci++) {
      if (G.slot[ci] !== null || (G.lockedSlots && G.lockedSlots[ci])) {
        cleaned.push(G.slot[ci]);
      }
    }
    G.slot = cleaned;
  }

  G.turn++;
  G.phase = 'player';
  // 缅因猫：下一回合Boss也先手（在executeTurn开头处理）
  log('⏭ 回合' + (G.turn+1) + '开始');
  log(G.boss.emoji + 'HP:' + G.enemyHP + '🛡' + G.enemyShield + '⚡' + G.enemyPower);
  render();
  updateEnemyIntent();
  document.getElementById('btn-end-turn').disabled = false;
}

// ========== 无尽模式状态（全局持久） ==========
var ENDLESS_DEFEATED = {}; // { bossId: true }

function endGame(win, msg) {
  G.over = true;
  G.phase = 'over';
  render();
  document.getElementById('btn-end-turn').disabled = true;

  var overlay = document.getElementById('result-overlay');
  var btnEndless = document.getElementById('btn-endless');

  if (win) {
    // 记录无尽模式已击败Boss
    if (G.isEndless && G.bossId) {
      ENDLESS_DEFEATED[G.bossId] = true;
    }

    G.currentStage = (G.currentStage || 1) + 1;

    if (G.currentStage === 2) {
      // 第一关（毛线团）通过 → 选圣物
      showRelicSelect();
      return;
    }
    if (G.currentStage === 3) {
      // 第二关（猫猫Boss）通过 → 通关！
      overlay.classList.add('show');
      renderStatsPanel(G);
      document.getElementById('result-title').textContent = '🎉 通关！';
      document.getElementById('result-desc').textContent = msg + '（存活' + G.turn + '回合）';
      // 显示两个按钮
      btnEndless.style.display = 'block';
      document.getElementById('btn-restart').textContent = '🔄 再来一局';
      log('🎉通关！' + msg);
      return;
    }
    // currentStage >= 4 → 无尽模式继续（showRelicSelect会经过startNextStage随机猫猫）
    if (G.currentStage >= 4 && G.isEndless) {
      // 检查是否所有猫猫都被击败
      var allCatIds = Object.keys(BOSSES).filter(function(k) { return k !== 'skeleton' && k !== 'catToy'; });
      var allDefeated = allCatIds.every(function(id) { return ENDLESS_DEFEATED[id]; });
      if (allDefeated) {
        overlay.classList.add('show');
        renderStatsPanel(G);
        document.getElementById('result-title').textContent = '🏆 全猫征服！';
        document.getElementById('result-desc').textContent = '所有猫猫Boss已被击败！（存活' + G.turn + '回合）';
        log('🏆 全猫征服！所有猫猫Boss已被击败！');
        btnEndless.style.display = 'none';
        document.getElementById('btn-restart').textContent = '🔄 再来一局';
      } else {
        // 继续无尽：随机下一只没打过的猫
        startEndlessNextCat();
        return;
      }
    }
  } else {
    overlay.classList.add('show');
    renderStatsPanel(G);
    document.getElementById('result-title').textContent = G.boss.emoji + ' 败北';
    document.getElementById('result-desc').textContent = msg + '（存活' + G.turn + '回合）';
    btnEndless.style.display = 'none';
    document.getElementById('btn-restart').textContent = '🔄 再来一局';
    log(G.boss.emoji + '败北 ' + msg);
  }
}

function startEndlessNextCat() {
  var allCatIds = Object.keys(BOSSES).filter(function(k) { return k !== 'skeleton' && k !== 'catToy'; });
  var remaining = allCatIds.filter(function(id) { return !ENDLESS_DEFEATED[id]; });
  if (!remaining.length) {
    endGame(true, '全猫征服！');
    return;
  }
  var bossId = remaining[Math.floor(Math.random() * remaining.length)];
  G.isEndless = true;
  G.activeRelics = G.activeRelics || [];
  G.bossId = bossId;
  G.currentStage = (G.currentStage || 3) + 1;
  log('♾️ 无尽模式·第' + (G.currentStage - 2) + '只猫 — 对手：' + BOSSES[bossId].name + ' ' + BOSSES[bossId].emoji);
  newGame();
}

function updateEnemyIntent() {
  if (G.phase === 'enemy') {
    document.getElementById('enemy-intent').innerHTML = '⏳ 行动中...';
    return;
  }
  if (G.hideIntent) {
    document.getElementById('enemy-intent').innerHTML = '❓ 意图隐藏';
    return;
  }
  var t = G.turn;
  var fastCycle = [{ type: 'attack' },{ type: 'defend' },{ type: 'charge' },{ type: 'rage' }];
  var useCycle = t >= 7 ? fastCycle : G.boss.cycle;
  var cycle = useCycle[t >= 7 ? (t - 7) % fastCycle.length : t % G.boss.cycle.length];
  var atk = G.boss.baseAtk + G.enemyPower;
  var shieldVal = 40 + Math.floor(G.enemyPower / 2) * 2;
  switch (cycle.type) {
    case 'attack':       document.getElementById('enemy-intent').innerHTML = '⚔️ 攻击 ' + atk; break;
    case 'defend':       document.getElementById('enemy-intent').innerHTML = '🛡️ 防御 +' + (cycle.shield || shieldVal); break;
    case 'buff_power':   document.getElementById('enemy-intent').innerHTML = '⚡ 蓄力 +2'; break;
    case 'charge':       document.getElementById('enemy-intent').innerHTML = '⏳ 蓄力'; break;
    case 'rage':         document.getElementById('enemy-intent').innerHTML = '💥 怒击 ' + (atk*2); break;
    case 'double_attack':document.getElementById('enemy-intent').innerHTML = '💥 双重攻击 ' + (atk*2); break;
    default:             document.getElementById('enemy-intent').innerHTML = '❓'; break;
  }

  // 舔毛预告（仅猫猫Boss，提前1回合；哈气不预告）
  var extra = [];
  var hasGroom = G.boss.hpTriggers && G.boss.hpTriggers.some(function(t) { return t.id === 'groom'; });
  if (hasGroom && G.turn > 0 && (G.turn + 1) % 4 === 0) extra.push('🐱舔毛预告');
  if (extra.length) {
    document.getElementById('enemy-intent').innerHTML += ' <span style="font-size:9px;color:#f39c12;">' + extra.join(' ') + '</span>';
  }
}

// ========== 三关流程 & 圣物选择 ==========

var STAGES = [
  { name: '第一关·毛线团', bossId: 'skeleton' },
  { name: '第二关·猫猫Boss', bossId: null }, // 随机
];

function showRelicSelect() {
  G.relicRerolls = G.relicRerolls || 0;
  G.selectedRelic = null;
  var allRelicIds = Object.keys(RELICS);
  shuffleArray(allRelicIds);
  G.relicOptions = allRelicIds.slice(0, 2);
  renderRelicOptions();
  document.getElementById('relic-select-desc').textContent =
    '第二关通过！获得圣物' + (G.relicRerolls < 1 ? '（可刷新1次）' : '');
  document.getElementById('relic-select-overlay').classList.add('show');
}

function renderRelicOptions() {
  var el = document.getElementById('relic-select-options');
  el.innerHTML = '';
  for (var oi = 0; oi < G.relicOptions.length; oi++) {
    var relic = RELICS[G.relicOptions[oi]];
    var card = document.createElement('div');
    card.className = 'relic-card';
    card.id = 'relic-opt-' + oi;
    card.innerHTML = '<div class="relic-name">' + relic.name + '</div>' +
      '<div class="relic-type">' + relic.type + '</div>' +
      '<div class="relic-desc">' + relic.desc + '</div>';
    el.appendChild(card);
  }
}

// 刷新按钮 — 换一组圣物
(function() {
  var btn = document.getElementById('btn-relic-reroll');
  btn.addEventListener('click', function() {
    var allRelicIds = Object.keys(RELICS);
    shuffleArray(allRelicIds);
    G.relicOptions = allRelicIds.slice(0, 2);
    renderRelicOptions();
    if (G.relicRerolls < 1) {
      G.relicRerolls++;
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.textContent = '🔄 刷新（已用完）';
      document.getElementById('relic-select-desc').textContent = '第二关通过！获得圣物';
    }
  });
})();

// 确认按钮 — 两个圣物全拿
(function() {
  var btn = document.getElementById('btn-relic-confirm');
  btn.addEventListener('click', function() {
    G.activeRelics = G.activeRelics || [];
    for (var i = 0; i < G.relicOptions.length; i++) {
      G.activeRelics.push(G.relicOptions[i]);
      log('🎁 获得圣物：' + RELICS[G.relicOptions[i]].name + ' — ' + RELICS[G.relicOptions[i]].desc);
    }
    document.getElementById('relic-select-overlay').classList.remove('show');
    startNextStage();
  });
})();

function startNextStage() {
  var stageIdx = G.currentStage - 1;
  if (stageIdx >= STAGES.length) return;
  var stage = STAGES[stageIdx];
  var bossId = stage.bossId;
  if (!bossId) {
    var catIds = Object.keys(BOSSES).filter(function(k) { return k !== 'skeleton' && k !== 'catToy'; });
    bossId = catIds[Math.floor(Math.random() * catIds.length)];
  }
  G.bossId = bossId;
  log('🏁 ' + stage.name + ' — 对手：' + BOSSES[bossId].name + ' ' + BOSSES[bossId].emoji);
  newGame();
}
