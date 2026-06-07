// ============================================================
//  斩 v14 — core.js
//  战斗引擎：洗牌/发牌/结算/状态管理/敌人回合
//  依赖 data.js（先加载）
// ============================================================

// ========== 存档系统 ==========
var SAVE_KEY = 'zhan_save';
var SAVE = null;

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

// ========== Zhan.Systems — 声明式效果执行引擎 ==========
if (!window.Zhan) window.Zhan = {};
Zhan.Systems = {};

// --- Relic Effects ---
Zhan.Systems.Relic = {
  _handlers: {
    multiplyDeckCard: function(G, params) { G.deckConfig[params.cardType] *= params.factor; },
    setEffectiveMinCombo: function(G, params) { G.effectiveMinCombo = params.value; },
    increaseSlotSize: function(G, params) { G.effectiveSlotSize = (G.effectiveSlotSize || CONFIG.SLOT_SIZE) + params.amount; },
    setBuffDurationBonus: function(G, params) { G.buffDurationBonus = params.amount; },
    enableWildCoreSlot: function(G) {
      G.wildCoreSlot = true;
      G.effectiveSlotSize = (G.effectiveSlotSize || CONFIG.SLOT_SIZE) + 1;
    },
    setOverloadBuffs: function(G, params) {
      G.atkBuffMult = params.atkBuffMult;
      G.vulnMult = params.vulnMult;
      G.defBuffRatio = params.defBuffRatio;
    },
    setNoUnmatchedPenalty: function(G, params) { G.noUnmatchedPenalty = params.value; },
    addSpecialCards: function(G, params) { G.specialCards = params.cards; },
    enableTenacity: function(G) { G.tenacityUsed = false; },
    enableFury: function(G) { G.furyEnabled = true; },
    increaseMaxHP: function(G, params) { G.playerMaxHP = CONFIG.PLAYER_MAX_HP + params.amount; }
  },

  applyInit: function(G) {
    var relics = G.activeRelics || [];
    for (var i = 0; i < relics.length; i++) {
      var relicDef = RELICS[relics[i]];
      if (!relicDef || !relicDef.effects) continue;
      for (var j = 0; j < relicDef.effects.length; j++) {
        var eff = relicDef.effects[j];
        if (eff.phase !== 'INIT') continue;
        var handler = this._handlers[eff.action];
        if (handler) handler(G, eff.params || {});
      }
    }
  },

  // fury_core getMultiplier — still needed at runtime with G context
  getFuryMultiplier: function(G) {
    var hpLoss = 1 - G.playerHP / G.playerMaxHP;
    return 1 + hpLoss;
  }
};

// --- Boss Trait Handlers ---
Zhan.Systems.Boss = {
  _traitHandlers: {
    lock_pile: {
      onTurnStart: function(G, params) {
        if (G.turn % params.interval !== 0) return;
        var flat = flatten(G.piles);
        var candidates = [];
        for (var i = 0; i < flat.length; i++) {
          if (flat[i].length > 0 && !G.lockedPiles[i]) candidates.push(i);
        }
        if (candidates.length < params.count) return;
        shuffleArray(candidates);
        G.lockedPiles = G.lockedPiles || {};
        for (var ci = 0; ci < params.count; ci++) {
          G.lockedPiles[candidates[ci]] = params.duration;
        }
        log('🐱 狸花锁牌：锁定了' + params.count + '摞牌，持续' + params.duration + '回合');
      },
      onTurnEnd: function(G, params) {
        if (!G.lockedPiles) return;
        for (var k in G.lockedPiles) {
          G.lockedPiles[k]--;
          if (G.lockedPiles[k] <= 0) delete G.lockedPiles[k];
        }
      }
    },
    lick_player: {
      onTurnStart: function(G, params) {
        if (G.turn < params.minTurn || G.turn % params.interval !== 0) return;
        if (G.playerEffects.atk_buff) delete G.playerEffects.atk_buff;
        if (G.playerEffects.def_buff) delete G.playerEffects.def_buff;
        log('🐱 斯芬克斯舔你！玩家 Buff 被舔掉');
      }
    },
    lock_slot: {
      onTurnStart: function(G, params) {
        if (G.turn % params.interval !== 0) return;
        var free = [];
        for (var i = 0; i < CONFIG.SLOT_SIZE; i++) {
          if (!G.lockedSlots || !G.lockedSlots[i]) free.push(i);
        }
        if (free.length < params.count) return;
        shuffleArray(free);
        G.lockedSlots = G.lockedSlots || {};
        for (var ci = 0; ci < params.count; ci++) {
          G.lockedSlots[free[ci]] = params.duration;
        }
        log('🐱 英短锁槽：锁定了' + params.count + '个槽位，持续' + params.duration + '回合');
      },
      onTurnEnd: function(G, params) {
        if (!G.lockedSlots) return;
        for (var k in G.lockedSlots) {
          G.lockedSlots[k]--;
          if (G.lockedSlots[k] <= 0) delete G.lockedSlots[k];
        }
      }
    },
    hide_intent: {
      onTurnStart: function(G) { G.hideIntent = true; }
    },
    random_discard: {
      onResolve: function(G, combos) {
        if (!G.slot.length) return;
        var idx = Math.floor(Math.random() * G.slot.length);
        var card = G.slot.splice(idx, 1)[0];
        log('🐱 阿比拍飞了一张 ' + CARD_TYPES[card.type].emoji + '！');
      }
    },
    smear_piles: {
      onTurnStart: function(G, params) {
        G.smearedPiles = {};
        var flat = flatten(G.piles);
        var candidates = [];
        for (var i = 0; i < flat.length; i++) {
          if (flat[i].length > 0) candidates.push(i);
        }
        if (candidates.length < params.count) return;
        shuffleArray(candidates);
        for (var ci = 0; ci < params.count; ci++) {
          G.smearedPiles[candidates[ci]] = true;
        }
        log('🐱 布偶趴牌：涂抹了' + params.count + '摞牌');
      }
    },
    time_limit: {
      onTurnStart: function(G, params) {
        G.maxTurns = G.maxTurns || params.maxTurns;
        if (G.turn >= G.maxTurns) {
          Zhan.Engine._endGame(false, '⏰ ' + params.maxTurns + '回合已到！豹猫赢了...');
        }
      }
    },
    insert_junk: {
      onTurnStart: function(G, params) {
        var halfHP = G.enemyMaxHP / 2;
        var junkCount = (G.enemyHP > halfHP) ? (G.turn % 2 === 0 ? 0 : 1) : 1;
        if (junkCount === 0) return;
        for (var j = 0; j < junkCount; j++) {
          var flat = flatten(G.piles);
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
    },
    stun_player: {
      onTurnStart: function(G, params) {
        if (G.turn >= params.minTurn && G.turn % params.interval === 0) {
          G.playerSkipped = true;
          log('🐱 折耳发作！玩家本回合无法行动');
        }
      }
    }
  },

  _hpTriggerHandlers: {
    groom: {
      condition: function(G) { return G.turn >= 4 && (G.turn - 4) % 4 === 0; },
      execute: function(G) {
        G.enemyEffects.vulnerable = 0;
        G.enemyEffects.atk_down = 0;
        G.enemyEffects.atk_down_pct = 0;
        G.enemyEffects.stun = 0;
        G.effectiveVulnMult = 0;
        log('🐱 舔毛！Boss 清除自身全部 Debuff（破甲/虚弱/击晕）');
      }
    },
    hiss: {
      condition: function(G) {
        if (G.hissPrevHP === undefined) G.hissPrevHP = G.enemyMaxHP;
        var thresholds = [200, 100];
        for (var i = 0; i < thresholds.length; i++) {
          if (G.enemyHP < thresholds[i] && G.hissPrevHP >= thresholds[i]) {
            G.hissPrevHP = G.enemyHP;
            return true;
          }
        }
        G.hissPrevHP = G.enemyHP;
        return false;
      },
      execute: function(G) {
        G.playerEffects = {};
        G.enemyEffects = {};
        log('🐱 哈气！！全场 Buff/Debuff 清空！');
      }
    }
  },

  // Dispatch traits based on event name
  processEvent: function(G, eventName) {
    var boss = G.boss;
    if (!boss || !boss.traits) return;
    for (var i = 0; i < boss.traits.length; i++) {
      var trait = boss.traits[i];
      if (!trait.events || trait.events.indexOf(eventName) === -1) continue;
      var handler = this._traitHandlers[trait.id];
      if (!handler) continue;
      var fn = handler[{
        'TURN_START': 'onTurnStart',
        'TURN_END': 'onTurnEnd',
        'RESOLVE': 'onResolve'
      }[eventName]];
      if (fn) fn(G, trait.params || {});
    }
  },

  // Dispatch hpTriggers
  runHpTriggers: function(G, filterId) {
    var boss = G.boss;
    if (!boss || !boss.hpTriggers) return;
    for (var i = 0; i < boss.hpTriggers.length; i++) {
      var triggerId = boss.hpTriggers[i];
      if (typeof triggerId !== 'string') continue;
      if (filterId && triggerId !== filterId) continue;
      var handler = this._hpTriggerHandlers[triggerId];
      if (!handler) continue;
      if (handler.condition && handler.condition(G)) {
        handler.execute(G);
      }
    }
  }
};

// ========== Zhan.Rules — 纯数值计算函数 ==========
// 所有规则函数不读全局 G，依赖以参数显式传入
Zhan.Rules = {
  calcBaseValue: function(totalCount, minCombo) {
    return 4 + (totalCount - minCombo) * 2;
  },

  calcPursuitMultiplier: function(maxComboLen, minCombo) {
    if (maxComboLen < minCombo + 1) return 1;
    return 1 + (maxComboLen - minCombo) * 0.1;
  },

  calcAttackValue: function(totalCount, maxComboLen, minCombo) {
    if (totalCount < minCombo) return 0;
    return Math.ceil(Zhan.Rules.calcBaseValue(totalCount, minCombo) * Zhan.Rules.calcPursuitMultiplier(maxComboLen, minCombo) - Number.EPSILON);
  },

  calcDefendValue: function(totalCount, maxComboLen, minCombo) {
    if (totalCount < minCombo) return 0;
    return Math.floor(Zhan.Rules.calcBaseValue(totalCount, minCombo) * Zhan.Rules.calcPursuitMultiplier(maxComboLen, minCombo));
  },

  calcHealValue: function(totalCount, maxComboLen, minCombo) {
    if (totalCount < minCombo) return 0;
    return Math.floor(Zhan.Rules.calcBaseValue(totalCount, minCombo) * Zhan.Rules.calcPursuitMultiplier(maxComboLen, minCombo));
  },

  resolveWildType: function(slot, idx) {
    if (!slot[idx] || slot[idx].isJunk) return 'junk';
    if (slot[idx].type !== 'wild') return slot[idx].type;
    for (var k = idx-1; k >= 0; k--) {
      if (slot[k] && slot[k].type !== 'wild' && !slot[k].isJunk) {
        return slot[k].type;
      }
    }
    for (var k = idx+1; k < slot.length; k++) {
      if (slot[k] && slot[k].type !== 'wild' && !slot[k].isJunk) {
        return slot[k].type;
      }
    }
    return 'wild';
  },

  computeCombos: function(slot, minCombo) {
    if (!slot.length) { var empty = []; empty._claimedWildIndices = []; empty._consumedIndices = []; return empty; }
    var resolved = slot.map(function(c, i) {
      if (!c) return { type: 'null_placeholder', card: null, index: i, claimed: false };
      return { type: Zhan.Rules.resolveWildType(slot, i), card: c, index: i, claimed: false };
    });
    var combos = [];
    var _claimedWildIndices = [];
    var _consumedIndices = [];
    var i = 0;
    while (i < resolved.length) {
      var typ = resolved[i].type;
      if (typ === 'null_placeholder' || typ === 'wild' || typ === 'junk') { i++; continue; }
      if (resolved[i].card && resolved[i].card.type === 'wild' && resolved[i].claimed) { i++; continue; }
      var j = i+1;
      while (j < resolved.length) {
        if (resolved[j].type === 'null_placeholder') { j++; continue; }
        if (resolved[j].card && resolved[j].card.type === 'wild' && resolved[j].claimed) break;
        if (resolved[j].type !== typ) break;
        j++;
      }
      var comboLen = j - i;
      if (comboLen >= minCombo) {
        for (var ci = i; ci < j; ci++) {
          _consumedIndices.push(resolved[ci].index);
          if (resolved[ci].card && resolved[ci].card.type === 'wild') {
            resolved[ci].claimed = true;
            _claimedWildIndices.push(resolved[ci].index);
          }
        }
        combos.push({ n: comboLen, cards: slot.slice(i,j), type: typ, start: i, end: j });
      }
      i = j;
    }
    combos._claimedWildIndices = _claimedWildIndices;
    combos._consumedIndices = _consumedIndices;
    return combos;
  },

  getComboDuration: function(n, minCombo) {
    return Math.max(1, n - minCombo + 1);
  },

  getStunDuration: function(n, minCombo) {
    return Zhan.Rules.getComboDuration(n, minCombo);
  },

  applyStatusEffects: function(type, val, effects) {
    switch (type) {
      case 'attack':
        if (effects.atkBuffMult > 0) val = Math.ceil(val * effects.atkBuffMult);
        if (effects.vulnMult > 0) val = Math.ceil(val * effects.vulnMult);
        break;
      case 'defend':
      case 'heal':
        break;
    }
    return val;
  },

  computeUnmatchedPenalty: function(state) {
    var claimedSet = {};
    for (var cwi = 0; cwi < state._claimedWildIndices.length; cwi++) {
      claimedSet[state._claimedWildIndices[cwi]] = true;
    }
    var consumedSet = {};
    if (state._consumedIndices) {
      for (var consi = 0; consi < state._consumedIndices.length; consi++) {
        consumedSet[state._consumedIndices[consi]] = true;
      }
    }
    var unmatchedByType = {};
    for (var si = 0; si < state.slot.length; si++) {
      if (!state.slot[si]) continue; // 跳过 null 占位（锁定槽）
      if (state.slot[si].special) continue; // 特殊卡不算入未消除惩罚
      if (consumedSet[si]) continue; // 已被 combo 消费的不扣血
      if (state.slot[si].type === 'wild') {
        if (claimedSet[si]) continue; // 被消费的万能牌不扣血（冗余保护）
        unmatchedByType['wild'] = (unmatchedByType['wild'] || 0) + 1;
        continue;
      }
      if (BUFF_TYPES[state.slot[si].type]) {
        if (state.activeComboTypes) {
          var _rt = Zhan.Rules.resolveWildType(state.slot, si);
          if (state.activeComboTypes.indexOf(_rt) >= 0) continue;
        } else {
          continue;
        }
      }
      var mt = Zhan.Rules.resolveWildType(state.slot, si);
      if (!unmatchedByType[mt]) unmatchedByType[mt] = 0;
      unmatchedByType[mt]++;
    }
    var totalUnmatched = 0;
    var minCombo = state.effectiveMinCombo || CONFIG.MIN_COMBO;
    for (var ut in unmatchedByType) {
      if (unmatchedByType[ut] < minCombo) {
        totalUnmatched += unmatchedByType[ut];
      }
    }
    return { unmatchedByType: unmatchedByType, totalUnmatched: totalUnmatched };
  },

  computeEffectiveFury: function(playerHP, playerMaxHP, baseValues) {
    if (!baseValues.furyEnabled) {
      return {
        atkBuffMult: baseValues.atkBuffMult || 1.0,
        vulnMult: baseValues.vulnMult || 1.0,
        defBuffRatio: baseValues.defBuffRatio || 1.0
      };
    }
    var hpLoss = 1 - playerHP / playerMaxHP;
    var furyMult = 1 + hpLoss;
    var baseAtk = baseValues.atkBuffMult || 1.0;
    var baseVuln = baseValues.vulnMult || 1.0;
    var baseRatio = baseValues.defBuffRatio || 1.0;
    return {
      atkBuffMult: 1 + (baseAtk - 1) * furyMult,
      vulnMult: 1 + (baseVuln - 1) * furyMult,
      defBuffRatio: Math.max(0, 1 - (1 - baseRatio) * furyMult)
    };
  },


  getEffectDescription: function(state, type, n) {
    var minCombo = state.effectiveMinCombo || CONFIG.MIN_COMBO;
    var dur = Zhan.Rules.getComboDuration(n, minCombo);
    dur += state.buffDurationBonus || 0;
    switch (type) {
      case 'vulnerable':
        var vm = state.effectiveVulnMult || CONFIG.VULN_MULT;
        dur += state.enemyEffects.vulnerable || 0;
        return '破甲×' + parseFloat(vm.toFixed(1)) + ' ' + dur + '回合';
      case 'stun':
        var stunDur = Zhan.Rules.getStunDuration(n, minCombo);
        stunDur += state.buffDurationBonus || 0;
        stunDur += state.enemyEffects.stun || 0;
        return '击晕 ' + stunDur + '回合';
      case 'atk_buff':
        dur += state.playerEffects.atk_buff || 0;
        return '暴击×' + parseFloat(state.effectiveAtkBuffMult.toFixed(1)) + ' ' + dur + '回合';
      case 'def_buff':
        dur += state.playerEffects.def_buff || 0;
        return '减伤×' + parseFloat(state.effectiveDefBuffRatio.toFixed(1)) + ' ' + dur + '回合';
      case 'atk_down':
        dur += state.enemyEffects.atk_down || 0;
        return '虚弱-' + Math.round(state.enemyEffects.atk_down_pct || CONFIG.ATK_DOWN_PCT) + '% ' + dur + '回合';
      default: return '';
    }
  }
};

// 跳过槽位计数（pullCard 中跨作用域用）
var _skippedSlots = 0;

// ========== 存档读写 ==========
function loadProgress() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      SAVE = JSON.parse(raw);
      if (!SAVE.mazeFirstKills) SAVE.mazeFirstKills = [];
      if (!SAVE.mazeUnlocked) SAVE.mazeUnlocked = false;
      if (!SAVE.towerUnlocked) SAVE.towerUnlocked = false;
      if (!SAVE.version) SAVE.version = 1;
    } else {
      SAVE = { version: 1, catMao: 0, advUnlocked: 1, bestFloor: 0,
               mazeFirstKills: [], towerBestFloor: 0,
               mazeUnlocked: false, towerUnlocked: false };
    }
  } catch(e) {
    SAVE = { version: 1, catMao: 0, advUnlocked: 1, bestFloor: 0,
             mazeFirstKills: [], towerBestFloor: 0,
             mazeUnlocked: false, towerUnlocked: false };
  }
  return SAVE;
}

function saveProgress() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); }
  catch(e) { /* 静默失败 */ }
}

// ========== Zhan.Engine — 集中状态管理 ==========
Zhan.Engine = {
  state: null,
  init: function() { newGame(); return G; },
  _pullCard: function(r, c) {
    if (Zhan.Engine.state.phase !== 'player' || Zhan.Engine.state.over) return false;
    // 检查锁定牌堆
    var flatIdx = r * CONFIG.BOARD_COLS + c;
    if (Zhan.Engine.state.lockedPiles && Zhan.Engine.state.lockedPiles[flatIdx]) {
      log('🔒 这摞牌被锁定了！');
      return false;
    }
    var pile = Zhan.Engine.state.piles[r][c];
    var top = Zhan.Engine._getTop(flatIdx);
    if (!top || Zhan.Engine.state.slot.length >= Zhan.Engine.state.effectiveSlotSize) return false;
    var card = Zhan.Engine._popTop(flatIdx);
    if (!card) return false;
    // BUG4 FIX: wild_core null placeholder at first unlocked slot
    if (Zhan.Engine.state.wildCoreSlot && Zhan.Engine.state.slot.length === 0) {
      Zhan.Engine.state.slot.push(null);
    }
    // 锁定槽位：跳过被锁槽，在后面第一个可用位置插入
    // 被锁槽在 slot 数组中保持 null 占位
    _skippedSlots = 0;
    var maxSize = Zhan.Engine.state.effectiveSlotSize || CONFIG.SLOT_SIZE;
    if (Zhan.Engine.state.lockedSlots) {
      var insIdx = Zhan.Engine.state.slot.length;
      while (insIdx < maxSize && Zhan.Engine.state.lockedSlots[insIdx]) {
        Zhan.Engine.state.slot.push(null); // 占位锁定槽
        insIdx++;
        _skippedSlots++;
      }
      if (insIdx >= maxSize) {
        log('🔒 所有剩余槽位都被锁定了！');
        // BUG2 FIX: push card back to pile
        while (_skippedSlots > 0) { Zhan.Engine.state.slot.pop(); _skippedSlots--; }
        pile.push(card);
        return false;
      }
    }
    Zhan.Engine.state.slot.push(card);
    updateComboPreview();
    var ct = CARD_TYPES[card.type] || { emoji: '⬜', label: '废牌' };
    log(ct.emoji + ct.label + '→槽(' + Zhan.Engine.state.slot.length + '/' + Zhan.Engine.state.effectiveSlotSize + ')' + (_skippedSlots > 0 ? ' 🔒跳过' + _skippedSlots + '格' : ''));
    return true;
  },

  _updateEffectiveFury: function(st) {
    var furyEff = Zhan.Rules.computeEffectiveFury(st.playerHP, st.playerMaxHP, {
      furyEnabled: st.furyEnabled,
      atkBuffMult: st.atkBuffMult,
      vulnMult: st.vulnMult,
      defBuffRatio: st.defBuffRatio
    });
    st.effectiveAtkBuffMult = furyEff.atkBuffMult;
    st.effectiveVulnMult = furyEff.vulnMult;
    st.effectiveDefBuffRatio = furyEff.defBuffRatio;
    if ((st.playerEffects.atk_buff || 0) <= 0) st.effectiveAtkBuffMult = 0;
    if ((st.enemyEffects.vulnerable || 0) <= 0) st.effectiveVulnMult = 0;
  },
  _buildDeck: function() {
    var st = this.state;
    st.deck = [];
    for (var type in st.deckConfig) {
      for (var i = 0; i < st.deckConfig[type]; i++) {
        st.deck.push({ type: type, id: st.pickedId++ });
      }
    }
  },

  _buildPiles: function() {
    var st = this.state;
    st.piles = [];
    for (var r = 0; r < CONFIG.BOARD_ROWS; r++) {
      st.piles[r] = [];
      for (var c = 0; c < CONFIG.BOARD_COLS; c++) st.piles[r][c] = [];
    }
    var idx = 0;
    var totalCards = st.deck.length;
    var nPiles = CONFIG.BOARD_ROWS * CONFIG.BOARD_COLS;
    var basePileSize = Math.floor(totalCards / nPiles);
    var remaining = totalCards - basePileSize * nPiles;
    var flatPiles = [];
    for (var r = 0; r < CONFIG.BOARD_ROWS; r++) {
      for (var c = 0; c < CONFIG.BOARD_COLS; c++) {
        flatPiles.push(st.piles[r][c]);
      }
    }
    for (var i = 0; i < flatPiles.length; i++) {
      var size = basePileSize + (i < remaining ? 1 : 0);
      for (var j = 0; j < size; j++) flatPiles[i].push(st.deck[idx++]);
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
  },

  _getTop: function(pileIdx) {
    var st = this.state;
    var r = Math.floor(pileIdx / CONFIG.BOARD_COLS);
    var c = pileIdx % CONFIG.BOARD_COLS;
    var pile = st.piles[r][c];
    return pile && pile.length ? pile[pile.length-1] : null;
  },

  _popTop: function(pileIdx) {
    var st = this.state;
    var r = Math.floor(pileIdx / CONFIG.BOARD_COLS);
    var c = pileIdx % CONFIG.BOARD_COLS;
    var pile = st.piles[r][c];
    return pile && pile.length ? pile.pop() : null;
  },

  _applyDamageToPlayer: function(dmg, rawAtk, label) {
    var st = this.state;
    // 免伤（救命毫毛/divine）：本回合免疫伤害
    if ((st.playerEffects.divine || 0) > 0) {
      log('🙊 免伤抵挡了 ' + rawAtk + ' 伤害！');
      return;
    }
    // TASK: FURY_DYNAMIC — 减伤比率实时随血量，effectiveDefBuffRatio 已包含 fury
    if ((st.playerEffects.def_buff || 0) > 0) {
      Zhan.Engine._updateEffectiveFury(st);
      var ratio = st.effectiveDefBuffRatio || CONFIG.DEF_BUFF_RATIO;
      dmg = Math.floor(dmg * ratio);
    }
    // 破盾
    if (st.playerShield > 0) {
      var absorb = Math.min(st.playerShield, dmg);
      st.playerShield -= absorb;
      dmg -= absorb;
    }
    st.playerHP = Math.max(0, st.playerHP - dmg);
    log(label + rawAtk + ' → ❤-' + dmg + '🛡' + st.playerShield);

    // 坚韧核心免死：扣血后触发
    Zhan.Engine._checkTenacity(st);
  },

  _checkTenacity: function(state) {
    if (state.tenacityUsed === false && state.playerHP <= 0) {
      state.playerHP = 1;
      state.tenacityUsed = true;
      log('🛡 坚韧核心触发！HP锁定为1');
    }
  },

  dispatch: function(action) {
    if (!this.state) return;
    switch (action.type) {
      case 'PLAY_CARD':
        this._pullCard(action.r, action.c);
        break;
      case 'END_TURN':
        this._executeTurn();
        break;
      case 'RESET':
        TOWER_DEFEATED = {};
        this.state = null;
        G = {};
        G.currentStage = 1;
        G.bossId = 'skeleton';
        newGame();
        if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(G);
        break;
      case 'RESTART':
        TOWER_DEFEATED = {};
        this.state = null;
        G = {};
        G.isEndless = false;
        G.activeRelics = [];
        G.currentStage = 1;
        G.bossId = 'skeleton';
        newGame();
        if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(G);
        break;
      case 'START_ENDLESS':
        TOWER_DEFEATED = {};
        var es = this.init();
        es.isEndless = true;
        Zhan.Engine._startTowerNextCat();
        break;
      case 'START_TOWER':
        TOWER_DEFEATED = {};
        this.state = null;
        G = {};
        G.mode = 'tower';
        G.towerFloor = 0;
        G.towerDefeated = [];
        G.towerRelicCount = 0;
        G.activeRelics = [];
        newGame();
        if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(G);
        break;
    }
    if (this.state && action.type !== 'END_TURN' && Zhan.UI && Zhan.UI.render) {
      Zhan.UI.render(this.state);
    }
  },

  _enemyTurn: function() {
    var st = this.state;
    log(st.boss.emoji + ' ' + st.boss.name + '行动');
    st.enemyShield = 0;
    // buff到期（敌人+玩家所有buff）
    for (var k in st.enemyEffects) { if (k !== 'stun' && st.enemyEffects[k] > 0) st.enemyEffects[k]--; }
    if ((st.enemyEffects.atk_down || 0) <= 0) { st.enemyEffects.atk_down = 0; st.enemyEffects.atk_down_pct = 0; }
    if ((st.playerEffects.def_buff || 0) > 0) st.playerEffects.def_buff--;
    if ((st.playerEffects.divine || 0) > 0) st.playerEffects.divine--;
    if ((st.playerEffects.atk_buff || 0) > 0) st.playerEffects.atk_buff--;
    if (st.boss.hpTriggers) { Zhan.Systems.Boss.runHpTriggers(st, 'hiss'); if (st.over) return; }
    if (st.boss.hpTriggers) { Zhan.Systems.Boss.runHpTriggers(st, 'groom'); if (st.over) return; }
    // T1 首回合 buff_self：不被击晕打断
    if (st.turn === 0) {
      log(st.boss.emoji + ' 能力值buff！power=' + st.power);
      Zhan.Systems.Boss.processEvent(st, 'TURN_END');
      st.power += (st.boss.powerGrowth || 0);
      if (st.lockedSlots) {
        var cleaned0 = [];
        for (var _ci0 = 0; _ci0 < st.slot.length; _ci0++) {
          if (st.slot[_ci0] !== null || (st.lockedSlots && st.lockedSlots[_ci0])) cleaned0.push(st.slot[_ci0]);
        }
        st.slot = cleaned0;
      }
      st.turn++; st.phase = 'player';
      Zhan.Engine._updateEffectiveFury(st);
      log('⏭ 回合' + (st.turn+1) + '开始');
      log(st.boss.emoji + 'HP:' + st.enemyHP + '🛡' + st.enemyShield + '⚡' + st.power);
      if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(st);
      Zhan.Engine._updateEnemyIntent(); return;
    }
    if ((st.enemyEffects.stun || 0) > 0) {
      log('💫 ' + st.boss.name + '击晕，跳过回合！');
      st.enemyEffects.stun--;
      if (st.enemyEffects.stun <= 0) st.enemyEffects.stun = 0;
      st.turn++; st.phase = 'player';
      log('⏭ 回合' + (st.turn+1) + '开始');
      if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(st);
      Zhan.Engine._updateEnemyIntent(); return;
    }
    Zhan.Systems.Boss.processEvent(st, 'TURN_START');
    if (st.over) return;
    var t = st.turn;
    var cycleIdx = (t - 1) % st.boss.cycle.length;
    var cycle = st.boss.cycle[cycleIdx];
    var rawAtk = st.power;
    if ((st.enemyEffects.atk_down || 0) > 0) {
      var reduction = st.enemyEffects.atk_down_pct || CONFIG.ATK_DOWN_PCT;
      rawAtk = Math.floor(rawAtk * (1 - reduction/100));
    }
    switch (cycle.type) {
      case 'attack': Zhan.Engine._applyDamageToPlayer(rawAtk, rawAtk, st.boss.emoji + '攻击'); break;
      case 'defend': st.enemyShield += st.power; log(st.boss.emoji + '防御+' + st.power + ' 🛡' + st.enemyShield); break;
      case 'focus': log(st.boss.emoji + ' 蓄力中……'); break;
      case 'crit': Zhan.Engine._applyDamageToPlayer(rawAtk * 2, rawAtk * 2, st.boss.emoji + '暴击×2='); break;
      default: log(st.boss.emoji + ' ' + st.boss.name + ' 未定义行动');
    }
    if (st.playerHP <= 0) { Zhan.Engine._endGame(false, '勇者倒下了...'); return; }
    Zhan.Systems.Boss.processEvent(st, 'TURN_END');
    st.power += (st.boss.powerGrowth || 0);
    if (st.lockedSlots) {
      var cleaned = [];
      for (var ci = 0; ci < st.slot.length; ci++) {
        if (st.slot[ci] !== null || (st.lockedSlots && st.lockedSlots[ci])) cleaned.push(st.slot[ci]);
      }
      st.slot = cleaned;
    }
    st.turn++; st.phase = 'player';
    Zhan.Engine._updateEffectiveFury(st);
    log('⏭ 回合' + (st.turn+1) + '开始');
    log(st.boss.emoji + 'HP:' + st.enemyHP + '🛡' + st.enemyShield + '⚡' + st.power);
    if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(st);
    Zhan.Engine._updateEnemyIntent();
  },

  _executeTurn: function() {
    var st = this.state;
    if (st.phase !== 'player' || st.over) return;
    if (st.playerSkipped) {
      st.playerSkipped = false; st.phase = 'resolving';
      log('🐱 被晕眩，跳过回合！'); st.slot = [];
      Zhan.Engine._updateEnemyIntent();
      setTimeout(function() { Zhan.Engine._enemyTurn(); }, 300); return;
    }
    if (st.boss && st.boss.id === 'maine_coon') {
      st._maineCoonFirst = true; Zhan.Engine._enemyTurn();
      if (st.over) return;
    }
    st.phase = 'resolving';
    log('▶ 回合' + (st.turn+1)); log('⚔️ 勇者行动');
    st.playerShield = 0;
    if (st.wildCoreSlot) {
      var wildIdx = 0;
      while (st.lockedSlots && st.lockedSlots[wildIdx]) wildIdx++;
      if (wildIdx < st.slot.length) {
        if (st.slot[wildIdx] === null) st.slot[wildIdx] = { type: 'wild', id: st.pickedId++, wildCore: true };
        else st.slot.splice(wildIdx, 0, { type: 'wild', id: st.pickedId++, wildCore: true });
      } else {
        while (st.slot.length < wildIdx) st.slot.push(null);
        st.slot.push({ type: 'wild', id: st.pickedId++, wildCore: true });
      }
    }
    Zhan.Systems.Boss.processEvent(st, 'RESOLVE');
    var combos = Zhan.Rules.computeCombos(st.slot, st.effectiveMinCombo || CONFIG.MIN_COMBO);
    for (var _ci = 0; _ci < combos.length; _ci++) { if (combos[_ci].n > st.maxCombo) st.maxCombo = combos[_ci].n; }
    log('  ✨ 缓冲结算...');
    for (var ci = 0; ci < combos.length; ci++) {
      var c = combos[ci];
      if (!BUFF_TYPES[c.type]) continue;
      var mc = st.effectiveMinCombo || CONFIG.MIN_COMBO;
      var dur = c.type === 'stun' ? Zhan.Rules.getStunDuration(c.n, mc) : Zhan.Rules.getComboDuration(c.n, mc);
      dur += st.buffDurationBonus || 0;
      if (st.activeRelics.indexOf('overload_core') >= 0) dur = Math.max(1, Math.floor(dur / 2));
      switch (c.type) {
        case 'vulnerable': st.enemyEffects.vulnerable = (st.enemyEffects.vulnerable || 0) + dur; log('💔Boss破甲 +' + dur + '→' + st.enemyEffects.vulnerable + '回合'); break;
        case 'stun': st.enemyEffects.stun = (st.enemyEffects.stun || 0) + dur; log('💫Boss击晕 +' + dur + '→' + st.enemyEffects.stun + '回合'); break;
        case 'atk_buff': st.playerEffects.atk_buff = (st.playerEffects.atk_buff || 0) + dur; log('⚡暴击 +' + dur + '→' + st.playerEffects.atk_buff + '回合'); break;
        case 'def_buff': st.playerEffects.def_buff = (st.playerEffects.def_buff || 0) + dur; log('💨减伤 +' + dur + '→' + st.playerEffects.def_buff + '回合'); break;
        case 'atk_down':
          var atkDownPct = st.enemyEffects.atk_down_pct || CONFIG.ATK_DOWN_PCT;
          if (st.activeRelics.indexOf('overload_core') >= 0) atkDownPct = 50;
          if (st.furyEnabled && RELICS.fury_core) atkDownPct = Math.min(100, atkDownPct * Zhan.Systems.Relic.getFuryMultiplier(st));
          st.enemyEffects.atk_down_pct = atkDownPct;
          st.enemyEffects.atk_down = (st.enemyEffects.atk_down || 0) + dur;
          log('⬇虚弱 +' + dur + '→' + st.enemyEffects.atk_down + '回合'); break;
      }
    }
    log('  ⚡ 行动结算...');
    var slotTypeCount = {};
    for (var si = 0; si < st.slot.length; si++) {
      var stype = Zhan.Rules.resolveWildType(st.slot, si);
      if (!BUFF_TYPES[stype] && stype !== 'junk') { if (!slotTypeCount[stype]) slotTypeCount[stype] = 0; slotTypeCount[stype]++; }
    }
    var actionMaxLen = {};
    for (var ci2 = 0; ci2 < combos.length; ci2++) {
      var c2 = combos[ci2];
      if (BUFF_TYPES[c2.type]) continue;
      if (!actionMaxLen[c2.type] || c2.n > actionMaxLen[c2.type]) actionMaxLen[c2.type] = c2.n;
    }
    if (slotTypeCount.attack && slotTypeCount.attack >= (st.effectiveMinCombo || CONFIG.MIN_COMBO)) {
      var atkTotal = slotTypeCount.attack;
      var atkMaxLen = actionMaxLen.attack || 0;
      var mc = st.effectiveMinCombo || CONFIG.MIN_COMBO;
      var baseAtk = Zhan.Rules.calcBaseValue(atkTotal, mc);
      var d = Zhan.Rules.calcAttackValue(atkTotal, atkMaxLen, mc);
      if (d > 0) {
        Zhan.Engine._updateEffectiveFury(st);
        d = Zhan.Rules.applyStatusEffects('attack', d, { atkBuffMult: st.effectiveAtkBuffMult, vulnMult: st.effectiveVulnMult, defBuffRatio: st.defBuffRatio });
        if (d > st.maxDamage) st.maxDamage = d;
        st.totalDamage += d;
        var pursuitLog = '';
        if (atkMaxLen >= mc + 1) pursuitLog = ' ' + atkMaxLen + '连×' + Zhan.Rules.calcPursuitMultiplier(atkMaxLen, mc).toFixed(1);
        if (st.enemyShield > 0) { var ab = Math.min(st.enemyShield, d); st.enemyShield -= ab; d -= ab; }
        st.enemyHP = Math.max(0, st.enemyHP - d);
        log('🗡×' + atkTotal + '→' + baseAtk + pursuitLog + '→总' + d + ' → ' + st.boss.emoji + st.enemyHP + '🛡' + st.enemyShield);
      }
    }
    if (slotTypeCount.defend && slotTypeCount.defend >= (st.effectiveMinCombo || CONFIG.MIN_COMBO)) {
      var defTotal = slotTypeCount.defend;
      var defMaxLen = actionMaxLen.defend || 0;
      var mc = st.effectiveMinCombo || CONFIG.MIN_COMBO;
      var baseDef = Zhan.Rules.calcBaseValue(defTotal, mc);
      var shieldVal = Zhan.Rules.calcDefendValue(defTotal, defMaxLen, mc);
      if (shieldVal > 0) {
        var pursuitLog = '';
        if (defMaxLen >= mc + 1) pursuitLog = ' ' + defMaxLen + '连×' + Zhan.Rules.calcPursuitMultiplier(defMaxLen, mc).toFixed(1);
        st.playerShield += shieldVal;
        log('🛡×' + defTotal + '→' + baseDef + pursuitLog + '→总' + shieldVal + ' 🛡' + st.playerShield);
      }
    }
    if (slotTypeCount.heal && slotTypeCount.heal >= (st.effectiveMinCombo || CONFIG.MIN_COMBO)) {
      var healTotal = slotTypeCount.heal;
      var healMaxLen = actionMaxLen.heal || 0;
      var mc = st.effectiveMinCombo || CONFIG.MIN_COMBO;
      var baseHeal = Zhan.Rules.calcBaseValue(healTotal, mc);
      var healVal = Zhan.Rules.calcHealValue(healTotal, healMaxLen, mc);
      if (healVal > 0) {
        var pursuitLog = '';
        if (healMaxLen >= mc + 1) pursuitLog = ' ' + healMaxLen + '连×' + Zhan.Rules.calcPursuitMultiplier(healMaxLen, mc).toFixed(1);
        st.playerHP = Math.min(st.playerMaxHP, st.playerHP + healVal);
        log('❤×' + healTotal + '→' + baseHeal + pursuitLog + '→总' + healVal + ' ❤' + st.playerHP);
      }
    }
    for (var sp = 0; sp < st.slot.length; sp++) {
      var sc = st.slot[sp];
      if (!sc || !sc.special) continue;
      if (sc.type === 'special_atk') {
        var spDmg = sc.special.dmg || 0;
        if (st.enemyShield > 0) { var spAbsorb = Math.min(st.enemyShield, spDmg); st.enemyShield -= spAbsorb; spDmg -= spAbsorb; }
        st.enemyHP = Math.max(0, st.enemyHP - spDmg);
        if (spDmg > st.maxDamage) st.maxDamage = spDmg;
        st.totalDamage += spDmg;
        log('🙈 特攻！→' + (sc.special.dmg || 0) + ' → ' + st.boss.emoji + st.enemyHP + '🛡' + st.enemyShield);
      } else if (sc.type === 'special_def') {
        st.playerShield += (sc.special.shield || 0);
        log('🙉 特防！+🛡' + (sc.special.shield || 0) + ' 🛡' + st.playerShield);
      } else if (sc.type === 'divine') {
        st.playerEffects.divine = 1;
        log('🙊 免伤！本回合免疫伤害');
      }
    }
    if (!st.noUnmatchedPenalty) {
      var activeComboTypes = [];
      for (var _cbi = 0; _cbi < combos.length; _cbi++) {
        if (BUFF_TYPES[combos[_cbi].type]) activeComboTypes.push(combos[_cbi].type);
      }
      var penaltyResult = Zhan.Rules.computeUnmatchedPenalty({ slot: st.slot, _claimedWildIndices: combos._claimedWildIndices, _consumedIndices: combos._consumedIndices, effectiveMinCombo: st.effectiveMinCombo, activeComboTypes: activeComboTypes });
      if (penaltyResult.totalUnmatched > 0) { st.playerHP = Math.max(0, st.playerHP - penaltyResult.totalUnmatched * CONFIG.UNMATCHED_PENALTY); log('♀未消除×' + penaltyResult.totalUnmatched + '→❤-' + penaltyResult.totalUnmatched); }
    }
    st.slot = [];
    Zhan.Engine._checkTenacity(st);
    if (st.enemyHP <= 0) { Zhan.Engine._endGame(true, st.boss.emoji + ' 击败！'); return; }
    if (st.playerHP <= 0) { Zhan.Engine._endGame(false, '勇者倒下了...'); return; }
    var totalRemaining = 0;
    var fp = flatten(st.piles);
    for (var fi = 0; fi < fp.length; fi++) totalRemaining += fp[fi].length;
    if (totalRemaining === 0) { Zhan.Engine._endGame(true, '✨ 牌库全消！元气弹斩杀！'); return; }
    Zhan.Engine._updateEffectiveFury(st);
    Zhan.Engine._updateEnemyIntent();
    if (st._maineCoonFirst) {
      st._maineCoonFirst = false; st.phase = 'player';
      log('⏭ 回合' + (st.turn+1) + '开始');
      log(st.boss.emoji + 'HP:' + st.enemyHP + '🛡' + st.enemyShield + '⚡' + st.power);
      if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(st);
      Zhan.Engine._updateEnemyIntent();
    } else {
      if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(st);
      setTimeout(function() { Zhan.Engine._enemyTurn(); }, 400);
    }
  }

};

// ========== 游戏状态 ==========
var G = {};

// ========== 冒险模式辅助函数 ==========
function resolveCycle(cycleStr, defValue) {
  switch (cycleStr) {
    case 'atk_def': return [{ type: 'attack' }, { type: 'defend', shield: defValue || 0 }];
    case 'focus_attack': return [{ type: 'focus' }, { type: 'attack' }];
    case 'atk_def_focus_crit': return [{ type: 'attack' }, { type: 'defend' }, { type: 'focus' }, { type: 'crit' }];
    default: return [{ type: 'attack' }, { type: 'defend' }, { type: 'focus' }, { type: 'crit' }];
  }
}

function pickRandomCat() {
  return CAT_BOSS_IDS[Math.floor(Math.random() * CAT_BOSS_IDS.length)];
}

function pickTowerCat() {
  var st = Zhan.Engine.state;
  var defeated = st.towerDefeated || [];
  var remaining = CAT_BOSS_IDS.filter(function(id) { return defeated.indexOf(id) < 0; });
  if (!remaining.length) return CAT_BOSS_IDS[Math.floor(Math.random() * CAT_BOSS_IDS.length)];
  return remaining[Math.floor(Math.random() * remaining.length)];
}

function saveProgress(st) {
  if (!st) st = Zhan.Engine.state;
  if (!st) return;
  var unlockCount = st.mode === 'adventure' ? (st.adventureStageId || 1) : 1;
  var mazeUnlocked = unlockCount > 4;
  var towerUnlocked = unlockCount > 4;
  var save = {
    version: 1, catMao: 250,
    advUnlocked: unlockCount,
    bestFloor: 0, mazeFirstKills: [], towerBestFloor: 0,
    mazeUnlocked: mazeUnlocked, towerUnlocked: towerUnlocked
  };
  try { localStorage.setItem('zhan_save', JSON.stringify(save)); } catch(e) {}
}

function loadProgress() {
  try { var raw = localStorage.getItem('zhan_save'); if (raw) return JSON.parse(raw); } catch(e) {}
  return null;
}

function newGame() {
  var mode = G.mode || 'normal';
  var bossId = null, boss = null;
  var relics = G.activeRelics || [];
  var stage = G.currentStage || 1;
  var deckOverride = null;

  // === Mode-based boss selection ===
  if (mode === 'adventure') {
    var advId = G.adventureStageId || 1;
    var advDef = ADVENTURE_STAGES[advId - 1] || ADVENTURE_STAGES[0];
    bossId = advDef.bossId;
    boss = JSON.parse(JSON.stringify(BOSSES[bossId]));
    boss.maxHP = advDef.hp;
    boss.baseAtk = advDef.atk;
    boss.powerGrowth = advDef.growth || 0;
    boss.startShield = advDef.def || 0;
    boss.cycle = resolveCycle(advDef.cycle, boss.startShield);
    if (advDef.deck) deckOverride = JSON.parse(JSON.stringify(advDef.deck));
  } else if (mode === 'maze') {
    if (G.mazePhase === 'skeleton') {
      bossId = 'skeleton'; boss = BOSSES.skeleton;
    } else {
      bossId = pickRandomCat(); boss = BOSSES[bossId];
    }
  } else if (mode === 'tower') {
    bossId = pickTowerCat(); boss = BOSSES[bossId];
  } else {
    bossId = G.bossId || 'skeleton';
    boss = BOSSES[bossId];
  }

  G = {
    deck: [], piles: [], slot: [],
    playerHP: CONFIG.PLAYER_MAX_HP,
    playerMaxHP: CONFIG.PLAYER_MAX_HP,
    playerShield: 0,
    enemyHP: boss.maxHP,
    enemyMaxHP: boss.maxHP,
    enemyShield: boss.startShield || 0,
    power: boss.baseAtk,
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
    atkBuffMult: CONFIG.ATK_BUFF_MULT,
    vulnMult: CONFIG.VULN_MULT,
    defBuffRatio: CONFIG.DEF_BUFF_RATIO,
    effectiveVulnMult: 0,
    buffDurationBonus: 0,
    deckConfig: deckOverride || JSON.parse(JSON.stringify(DECK_SIZES)),
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
    isEndless: G.isEndless,
    mode: mode,
    adventureStageId: G.adventureStageId,
    mazePhase: G.mazePhase,
    towerFloor: G.towerFloor || 0,
    towerDefeated: G.towerDefeated || [],
    towerRelicCount: G.towerRelicCount || 0,
  };

  Zhan.Engine.state = G;

  // 初始化圣物（声明式效果执行）
  Zhan.Systems.Relic.applyInit(G);

  // 开局满血：先用 maxHP 初始化 playerHP，确保生命核心等圣物修改 maxHP 后开局满血
  G.playerHP = G.playerMaxHP;

  // 初始化哈气 prevHP（挂在 G 上，不共享全局单例）
  // 现在 hpTriggers 是字符串数组，检查是否包含 'hiss'
  if (boss.hpTriggers && boss.hpTriggers.indexOf('hiss') >= 0) {
    G.hissPrevHP = boss.maxHP;
  }

  Zhan.Engine._buildDeck();
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
  Zhan.Engine._buildPiles();
  Zhan.Engine._updateEffectiveFury(G);
  Zhan.Engine._updateEnemyIntent();
  if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(G);
  log('🐱 新局开始！双击或向下拖拽卡牌进槽');
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


// ========== 无尽模式状态（全局持久） ==========
var TOWER_DEFEATED = {}; // { bossId: true }

// ========== Zhan.Engine — 流程控制 ==========

Zhan.Engine._endGame = function(win, msg) {
  var st = this.state;
  if (!st) return;
  st.over = true;
  st.phase = 'over';
  st.win = win;
  if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(st);

  var mode = st.mode || 'normal';

  if (win) {
    // === 猫王塔模式 ===
    if (mode === 'tower') {
      TOWER_DEFEATED[st.bossId] = true;
      if (!st.towerDefeated) st.towerDefeated = [];
      if (st.towerDefeated.indexOf(st.bossId) < 0) st.towerDefeated.push(st.bossId);
      st.towerFloor = (st.towerFloor || 0) + 1;
      var allCatIdsT = CAT_BOSS_IDS;
      var allDefeatedT = true;
      for (var tdi = 0; tdi < allCatIdsT.length; tdi++) {
        if (st.towerDefeated.indexOf(allCatIdsT[tdi]) < 0) { allDefeatedT = false; break; }
      }
      if (allDefeatedT) {
        var titles = ['社区','街道','城区','城市','省会','大区','王国','大陆','星球','宇宙猫王'];
        var title = titles[Math.min(st.towerFloor - 1, titles.length - 1)];
        st._resultTitle = '🏆 ' + title + '！';
        st._resultDesc = '击败' + st.towerFloor + '猫（存活' + st.turn + '回合）';
        st._restartText = '🔄 再来一局';
        log('🏆 ' + title + '！击败' + st.towerFloor + '猫');
        if (Zhan.UI && Zhan.UI.showResult) Zhan.UI.showResult(st);
      } else if ((st.towerRelicCount || 0) < 2) {
        Zhan.Engine._showRelicSelect();
      } else {
        st.playerHP = st.playerMaxHP;
        Zhan.Engine._startTowerNextCat();
      }
      return;
    }

    // === 冒险模式 ===
    if (mode === 'adventure') {
      var advId = st.adventureStageId || 1;
      var nextId = advId + 1;
      var moreStages = nextId <= ADVENTURE_STAGES.length;
      st._resultTitle = '🎉 通关！';
      st._restartText = '🔄 重试';
      if (moreStages) {
        st._resultDesc = '第' + advId + '关通过！继续闯关？';
        st._showContinueBtn = true;
        saveProgress(st);
      } else {
        st._resultDesc = '🎊 冒险通关！（存活' + st.turn + '回合）';
        st._restartText = '🔄 再来一局';
      }
      log('🎉第' + advId + '关通关！' + msg);
      if (Zhan.UI && Zhan.UI.showResult) Zhan.UI.showResult(st);
      return;
    }

    // === 迷宫模式 ===
    if (mode === 'maze') {
      if (st.mazePhase === 'skeleton') {
        st.mazePhase = 'relic';
        Zhan.Engine._showRelicSelect();
        return;
      } else {
        st._resultTitle = '🎉 猫猫迷宫通关！';
        st._resultDesc = msg + '（存活' + st.turn + '回合）';
        st._restartText = '🔄 再来一局';
        log('🎉迷宫通关！' + msg);
        if (Zhan.UI && Zhan.UI.showResult) Zhan.UI.showResult(st);
        return;
      }
    }

    // === 普通模式（旧版兼容） ===
    if (st.isEndless && st.bossId) {
      TOWER_DEFEATED[st.bossId] = true;
    }
    st.currentStage = (st.currentStage || 1) + 1;
    if (st.currentStage === 2) {
      Zhan.Engine._showRelicSelect();
      return;
    }
    if (st.currentStage === 3) {
      st._resultTitle = '🎉 通关！';
      st._resultDesc = msg + '（存活' + st.turn + '回合）';
      st._showEndlessBtn = true;
      st._restartText = '🔄 再来一局';
      log('🎉通关！' + msg);
      if (Zhan.UI && Zhan.UI.showResult) Zhan.UI.showResult(st);
      return;
    }
    if (st.currentStage >= 4 && st.isEndless) {
      var allCatIds = CAT_BOSS_IDS;
      var allDefeated = true;
      for (var ci = 0; ci < allCatIds.length; ci++) {
        if (!TOWER_DEFEATED[allCatIds[ci]]) { allDefeated = false; break; }
      }
      if (allDefeated) {
        st._resultTitle = '🏆 全猫征服！';
        st._resultDesc = '所有猫猫Boss已被击败！（存活' + st.turn + '回合）';
        st._showEndlessBtn = false;
        st._restartText = '🔄 再来一局';
        log('🏆 全猫征服！所有猫猫Boss已被击败！');
        if (Zhan.UI && Zhan.UI.showResult) Zhan.UI.showResult(st);
      } else {
        Zhan.Engine._startTowerNextCat();
      }
      return;
    }
  } else {
    st._resultTitle = st.boss.emoji + ' 败北';
    st._resultDesc = msg + '（存活' + st.turn + '回合）';
    st._showEndlessBtn = false;
    st._restartText = '🔄 再来一局';
    log(st.boss.emoji + '败北 ' + msg);
    if (Zhan.UI && Zhan.UI.showResult) Zhan.UI.showResult(st);
  }
};

Zhan.Engine._startTowerNextCat = function() {
  var st = this.state;
  if (!st) return;
  // Tower mode: use towerDefeated array
  if (st.mode === 'tower') {
    var defeated = st.towerDefeated || [];
    var remaining = CAT_BOSS_IDS.filter(function(id) { return defeated.indexOf(id) < 0; });
    if (!remaining.length) {
      Zhan.Engine._endGame(true, '全猫征服！');
      return;
    }
    var bossId = remaining[Math.floor(Math.random() * remaining.length)];
    st.activeRelics = st.activeRelics || [];
    st.bossId = bossId;
    log('🏯 猫王塔·第' + (st.towerFloor + 1) + '层 — 对手：' + BOSSES[bossId].name);
    newGame();
    return;
  }
  // Legacy endless mode fallback
  var allCatIds = CAT_BOSS_IDS;
  var remaining = allCatIds.filter(function(id) { return !TOWER_DEFEATED[id]; });
  if (!remaining.length) {
    Zhan.Engine._endGame(true, '全猫征服！');
    return;
  }
  var bossId = remaining[Math.floor(Math.random() * remaining.length)];
  st.isEndless = true;
  st.activeRelics = st.activeRelics || [];
  st.bossId = bossId;
  st.currentStage = (st.currentStage || 3) + 1;
  log('♾️ 无尽模式·第' + (st.currentStage - 2) + '只猫 — 对手：' + BOSSES[bossId].name + ' ' + BOSSES[bossId].emoji);
  newGame();
};

Zhan.Engine._updateEnemyIntent = function() {
  var st = this.state;
  if (!st) return;
  if (st.phase === 'enemy') {
    st._intentHTML = '⏳ 行动中...';
    st._intentExtraHTML = '';
  } else if (st.hideIntent) {
    st._intentHTML = '❓ 意图隐藏';
    st._intentExtraHTML = '';
  } else {
    var t = st.turn;
    // T0 显示 buff_self 意图
    if (t === 0) {
      st._intentHTML = '⚡ 能力值buff';
    } else {
      var cycleIdx = (t - 1) % st.boss.cycle.length;
      var cycle = st.boss.cycle[cycleIdx];
      switch (cycle.type) {
        case 'attack':       st._intentHTML = '⚔️ 攻击 ' + st.power; break;
        case 'defend':       st._intentHTML = '🛡️ 防御 +' + st.power; break;
        case 'focus':        st._intentHTML = '⏳ 蓄力'; break;
        case 'crit':         st._intentHTML = '💥 暴击 ' + (st.power*2); break;
        default:             st._intentHTML = '❓'; break;
      }
    }

    // 舔毛预告（仅猫猫Boss，提前1回合；哈气不预告）
    var extra = [];
    var hasGroom = st.boss.hpTriggers && st.boss.hpTriggers.indexOf('groom') >= 0;
    if (hasGroom && st.turn >= 3 && (st.turn + 1 - 4) % 4 === 0) extra.push('🐱舔毛预告');
    st._intentExtraHTML = extra.length ? ' <span style="font-size:9px;color:#f39c12;">' + extra.join(' ') + '</span>' : '';
  }
  if (Zhan.UI && Zhan.UI.renderEnemyIntent) Zhan.UI.renderEnemyIntent(st);
};

// ========== 模式流程 & 圣物选择 ==========

Zhan.Engine._showRelicSelect = function() {
  var st = this.state;
  if (!st) return;
  st.relicRerolls = st.relicRerolls || 0;
  st.selectedRelic = null;
  var allRelicIds = Object.keys(RELICS);
  shuffleArray(allRelicIds);
  var count = st.mode === 'tower' ? 1 : 2;
  st.relicOptions = allRelicIds.slice(0, count);
  if (Zhan.UI && Zhan.UI.renderRelicSelect) Zhan.UI.renderRelicSelect(st);
};

Zhan.Engine._rerollRelics = function() {
  var st = this.state;
  if (!st) return;
  var allRelicIds = Object.keys(RELICS);
  shuffleArray(allRelicIds);
  var count = st.mode === 'tower' ? 1 : 2;
  st.relicOptions = allRelicIds.slice(0, count);
  st.relicRerolls = (st.relicRerolls || 0) + 1;
  st.selectedRelic = null; // 刷新后清空选择
};

Zhan.Engine._selectRelicOption = function(idx) {
  var st = this.state;
  if (!st || !st.relicOptions || !st.relicOptions[idx]) return;
  st.selectedRelic = st.relicOptions[idx];
  if (Zhan.UI && Zhan.UI.renderRelicSelect) Zhan.UI.renderRelicSelect(st);
};

Zhan.Engine._confirmRelicSelect = function() {
  var st = this.state;
  if (!st) return;
  st.activeRelics = st.activeRelics || [];
  if (st.mode === 'tower') {
    // 猫王塔：单选1个
    if (!st.selectedRelic) return;
    st.activeRelics.push(st.selectedRelic);
    log('🎁 获得圣物：' + (RELICS[st.selectedRelic] ? RELICS[st.selectedRelic].name + ' — ' + RELICS[st.selectedRelic].desc : st.selectedRelic));
    st.towerRelicCount = (st.towerRelicCount || 0) + 1;
    // 进入下一层猫王塔
    Zhan.Engine._startTowerNextCat();
  } else if (st.mode === 'maze') {
    // 迷宫：全拿圣物 → 打随机猫Boss
    for (var i = 0; i < st.relicOptions.length; i++) {
      st.activeRelics.push(st.relicOptions[i]);
      log('🎁 获得圣物：' + RELICS[st.relicOptions[i]].name + ' — ' + RELICS[st.relicOptions[i]].desc);
    }
    st.mazePhase = 'cat';
    log('🏁 猫猫迷宫 — 随机猫Boss');
    newGame();
  } else {
    // 普通/冒险：全拿圣物 → 下一关
    for (var i = 0; i < st.relicOptions.length; i++) {
      st.activeRelics.push(st.relicOptions[i]);
      log('🎁 获得圣物：' + RELICS[st.relicOptions[i]].name + ' — ' + RELICS[st.relicOptions[i]].desc);
    }
    Zhan.Engine.advGoNext();
  }
};

Zhan.Engine.advGoNext = function() {
  var st = this.state;
  if (!st) return;
  var mode = st.mode || 'normal';

  if (mode === 'adventure') {
    st.adventureStageId = (st.adventureStageId || 1) + 1;
    log('🏁 冒险·第' + st.adventureStageId + '关');
    newGame();
    return;
  }

  // 普通模式兼容：随机猫Boss作为第二关
  var bossId = CAT_BOSS_IDS[Math.floor(Math.random() * CAT_BOSS_IDS.length)];
  st.bossId = bossId;
  log('🏁 第二关 — 对手：' + BOSSES[bossId].name + ' ' + BOSSES[bossId].emoji);
  newGame();
};

// 启动脚本已移至 index.html（ui.js 之后的内联 script）
// Zhan.Test 已移至 index.html（ui.js 之后的内联 script）
