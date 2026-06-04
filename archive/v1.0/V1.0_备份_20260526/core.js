// ============================================================
//  斩 v14 — core.js
//  战斗引擎：洗牌/发牌/结算/状态管理/敌人回合
//  依赖 data.js（先加载）
// ============================================================

// ========== 伤害公式 ==========
function calcBaseValue(totalCount) {
  return 4 + (totalCount - 3) * 2;
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
  // 狂暴核心：低血增伤
  if (G.furyEnabled && RELICS.fury_core) {
    val = Math.ceil(val * RELICS.fury_core.getMultiplier(G));
  }
  return val;
}

function applyStatusEffects(type, val, G) {
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
    playerHP: CONFIG.PLAYER_HP,
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
  };

  // 初始化圣物
  for (var i = 0; i < relics.length; i++) {
    var relic = RELICS[relics[i]];
    if (relic && relic.onInit) relic.onInit(G);
  }

  // 初始化哈气 prevHP（挂在 G 上，不共享全局单例）
  if (boss.hpTriggers) {
    for (var j = 0; j < boss.hpTriggers.length; j++) {
      if (boss.hpTriggers[j].id === 'hiss') {
        G.hissPrevHP = boss.maxHP;
      }
    }
  }

  buildDeck();
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
    if (j-i >= minCombo) {
      combos.push({ n: j-i, cards: slot.slice(i,j), type: typ, start: i, end: j });
    }
    i = j;
  }
  return combos;
}

function getComboDuration(n) {
  if (n >= 5) return n - (G.effectiveMinCombo || CONFIG.MIN_COMBO);
  return 1;
}

function getStunDuration(n) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  return n - minCombo + 1; // 2连=1回，3连=2回，5连=4回
}

function getEffectDescription(type, n) {
  var dur = getComboDuration(n);
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  switch (type) {
    case 'vulnerable': return '易伤×' + CONFIG.VULN_MULT + ' ' + dur + '回合';
    case 'stun':
      var stunDur = getStunDuration(n);
      return '眩晕 ' + stunDur + '回合';
    case 'atk_buff':   return '攻×' + (G.atkBuffMult || CONFIG.ATK_BUFF_MULT) + ' ' + dur + '回合';
    case 'def_buff':   return '减伤×' + (G.defBuffRatio || CONFIG.DEF_BUFF_RATIO) + ' ' + dur + '回合';
    case 'atk_down':   return '降攻-' + CONFIG.ATK_DOWN_PCT + '% ' + dur + '回合';
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

  G.phase = 'resolving';
  log('▶ 回合' + (G.turn+1));
  log('⚔️ 勇者行动');

  G.playerShield = 0;

  // 万能槽圣物：首槽自动万能卡
  if (G.autoWildSlot && G.slot.length < G.effectiveSlotSize) {
    G.slot.unshift({ type: 'wild', id: G.pickedId++, autoWild: true });
  }

  // Boss专属 onResolve（阿比弃牌等）
  if (G.boss.traits) {
    for (var ti = 0; ti < G.boss.traits.length; ti++) {
      var trait = G.boss.traits[ti];
      if (trait.onResolve) trait.onResolve(G, computeCombos(G.slot));
    }
  }

  var combos = computeCombos(G.slot);

  // --- Phase 1: Buff/Debuff ---
  log('  ✨ 缓冲结算...');
  for (var ci = 0; ci < combos.length; ci++) {
    var c = combos[ci];
    if (!BUFF_TYPES[c.type]) continue;
    var dur = c.type === 'stun' ? getStunDuration(c.n) : getComboDuration(c.n);
    dur += G.buffDurationBonus || 0;
    switch (c.type) {
      case 'vulnerable':
        G.enemyEffects.vulnerable = (G.enemyEffects.vulnerable || 0) + dur;
        G.effectiveVulnMult = G.vulnMult || CONFIG.VULN_MULT;
        log('💔Boss易伤 +' + dur + '→' + G.enemyEffects.vulnerable + '回合');
        break;
      case 'stun':
        G.enemyEffects.stun = (G.enemyEffects.stun || 0) + dur;
        log('💫Boss眩晕 +' + dur + '→' + G.enemyEffects.stun + '回合');
        break;
      case 'atk_buff':
        G.playerEffects.atk_buff = (G.playerEffects.atk_buff || 0) + dur;
        G.effectiveAtkBuffMult = G.atkBuffMult || CONFIG.ATK_BUFF_MULT;
        log('⚡攻击加成 +' + dur + '→' + G.playerEffects.atk_buff + '回合');
        break;
      case 'def_buff':
        G.playerEffects.def_buff = (G.playerEffects.def_buff || 0) + dur;
        G.effectiveDefBuffRatio = G.defBuffRatio || CONFIG.DEF_BUFF_RATIO;
        log('💨减伤 +' + dur + '→' + G.playerEffects.def_buff + '回合');
        break;
      case 'atk_down':
        G.enemyEffects.atk_down_pct = CONFIG.ATK_DOWN_PCT;
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
      d = applyRelicModifiers('attack', d, G);
      // 读取 buff 层数（像V13一样直接从 playerEffects / enemyEffects 判断）
      if ((G.playerEffects.atk_buff || 0) > 0) d = Math.ceil(d * (G.atkBuffMult || CONFIG.ATK_BUFF_MULT));
      if ((G.enemyEffects.vulnerable || 0) > 0) d = Math.ceil(d * (G.vulnMult || CONFIG.VULN_MULT));
      var pursuitLog = '';
      if (atkMaxLen >= 4) pursuitLog = ' ' + atkMaxLen + '连×' + calcPursuitMultiplier(atkMaxLen).toFixed(1);
      if (G.enemyShield > 0) { var ab = Math.min(G.enemyShield, d); G.enemyShield -= ab; d -= ab; }
      G.enemyHP = Math.max(0, G.enemyHP - d);
      log('🗡×' + atkTotal + '→' + baseAtk + pursuitLog + '→总' + d + ' → 💀' + G.enemyHP + '🛡' + G.enemyShield);
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

  // --- 未消除惩罚 ---
  if (!G.noUnmatchedPenalty) {
    var unmatchedByType = {};
    for (var si2 = 0; si2 < G.slot.length; si2++) {
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

  // 检查胜负/元气弹
  if (G.enemyHP <= 0) { endGame(true, '💀 击败！'); return; }
  if (G.playerHP <= 0) { endGame(false, '勇者倒下了...'); return; }
  var totalRemaining = 0;
  var fp = G.piles.flat();
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

  // 缅因猫：Boss先手（跳过玩家阶段直接enemyTurn，实际这个在回合开始时触发）
  if (G.boss && G.boss.id === 'maine_coon') {
    enemyTurn();
  } else {
    setTimeout(function() { enemyTurn(); }, 400);
  }
}

// ========== 辅助：破盾后扣玩家血量 ==========
function applyDamageToPlayer(dmg, rawAtk, label) {
  // 减伤
  if ((G.playerEffects.def_buff || 0) > 0) {
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
}

// ========== 敌人回合 ==========
function enemyTurn() {
  log('💀 ' + G.boss.name + '行动');
  G.enemyShield = 0;

  // 眩晕检查
  if ((G.enemyEffects.stun || 0) > 0) {
    log('💫 ' + G.boss.name + '眩晕，跳过回合！');
    for (var k in G.enemyEffects) { if (G.enemyEffects[k] > 0) G.enemyEffects[k]--; }
    if (!G.enemyEffects.atk_down || G.enemyEffects.atk_down <= 0) G.enemyEffects.atk_down_pct = 0;
    G.turn++;
    G.phase = 'player';
    log('⏭ 回合' + (G.turn+1) + '开始');
    render(); updateEnemyIntent();
    document.getElementById('btn-end-turn').disabled = false;
    return;
  }

  // Boss 专属 onTurnStart
  if (G.boss.traits) {
    for (var ti = 0; ti < G.boss.traits.length; ti++) {
      var trait = G.boss.traits[ti];
      if (trait.onTurnStart) trait.onTurnStart(G);
      if (G.over) return;
    }
  }

  // 哈气/舔毛检查
  if (G.boss.hpTriggers) {
    for (var hi = 0; hi < G.boss.hpTriggers.length; hi++) {
      var trigger = G.boss.hpTriggers[hi];
      if (trigger.condition && trigger.condition(G)) {
        trigger.execute(G);
      }
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
      applyDamageToPlayer(d, rawAtk, '💀攻击');
      break;

    case 'defend':
      G.enemyShield += (cycle.shield || shieldVal);
      log('💀防御+' + (cycle.shield || shieldVal) + ' 🛡' + G.enemyShield);
      break;

    case 'buff_power':
      G.enemyPower += 2;
      log('💀蓄力+2 ⚡' + G.enemyPower);
      break;

    case 'charge':
      log('💀 蓄力中……');
      break;

    case 'rage':
      if (cycle.powerBoost) G.enemyPower += cycle.powerBoost;
      var rageMult = cycle.multiplier || 2;
      var rageDmg = rawAtk * rageMult;
      applyDamageToPlayer(rageDmg, rawAtk * rageMult, '💥怒击×' + rageMult + (cycle.powerBoost ? ' +⚡' + cycle.powerBoost : '') + '=');
      break;

    case 'double_attack':
      var d2 = rawAtk * 2;
      applyDamageToPlayer(d2, rawAtk * 2, '💥双重攻击');
      break;

    default:
      log('💀 ' + G.boss.name + ' 未定义行动');
  }

  if (G.playerHP <= 0) { endGame(false, '勇者倒下了...'); return; }

  // 坚韧核心免死（可能被Boss攻击触发）
  if (G.tenacityUsed === false && G.playerHP <= 0) {
    G.playerHP = 1;
    G.tenacityUsed = true;
    log('🛡 坚韧核心触发！HP锁定为1');
  }

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
    if (G.enemyEffects[k] === 0 && k === 'atk_down') G.enemyEffects.atk_down_pct = 0;
  }
  if ((G.playerEffects.def_buff || 0) > 0) G.playerEffects.def_buff--;

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
  log('💀HP:' + G.enemyHP + '🛡' + G.enemyShield + '⚡' + G.enemyPower);
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
      // 第一关（骷髅）通过 → 选圣物
      showRelicSelect();
      return;
    }
    if (G.currentStage === 3) {
      // 第二关（猫猫Boss）通过 → 通关！
      overlay.classList.add('show');
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
    document.getElementById('result-title').textContent = '💀 败北';
    document.getElementById('result-desc').textContent = msg + '（存活' + G.turn + '回合）';
    btnEndless.style.display = 'none';
    document.getElementById('btn-restart').textContent = '🔄 再来一局';
    log('💀败北 ' + msg);
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
  { name: '第一关·骷髅', bossId: 'skeleton' },
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
