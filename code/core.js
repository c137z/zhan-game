// ============================================================
//  斩 v14 — core.js
//  战斗引擎：洗牌/发牌/结算/状态管理/敌人回合
//  依赖 data.js（先加载）
// ============================================================

// ========== 存档系统 ==========
if (!window.Zhan) window.Zhan = {};
// SAVE_KEY 和 _save 在 Zhan.Engine 定义后赋值（见下方）

// 计算总卡牌数（从 data.js DECK_SIZES 迁移）
(function() {
  var total = 0;
  for (var k in DECK_SIZES) total += DECK_SIZES[k];
  CONFIG.TOTAL_CARDS = total;
  CONFIG.CARDS_PER_PILE = Math.floor(total / (CONFIG.BOARD_ROWS * CONFIG.BOARD_COLS));
})();

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

// ========== Zhan.RNG — 确定性随机数生成器 ==========
Zhan.RNG = {
  _seed: 0,
  _initialSeed: 0,
  setSeed: function(s) {
    s = (s !== undefined && s !== null) ? s : Date.now();
    Zhan.RNG._seed = s;
    Zhan.RNG._initialSeed = s;
  },
  random: function() {
    Zhan.RNG._seed = (Zhan.RNG._seed * 9301 + 49297) % 233280;
    return Zhan.RNG._seed / 233280;
  },
  getSeed: function() { return Zhan.RNG._initialSeed; }
};

// ========== Zhan.Events — 轻量事件总线 ==========
Zhan.Events = {
  _listeners: {},

  on: function(eventName, fn) {
    if (!this._listeners[eventName]) this._listeners[eventName] = [];
    this._listeners[eventName].push(fn);
  },

  off: function(eventName, fn) {
    var list = this._listeners[eventName];
    if (!list) return;
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i] === fn) list.splice(i, 1);
    }
  },

  emit: function(eventName, data) {
    var list = this._listeners[eventName];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      try { list[i](data); } catch(e) {}
    }
  }
};

// ========== Zhan.Systems — 声明式效果执行引擎 ==========
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
        shuffle(candidates, Zhan.RNG.random);
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
        shuffle(free, Zhan.RNG.random);
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
        var idx = Math.floor(Zhan.RNG.random() * G.slot.length);
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
        shuffle(candidates);
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
          var idx = candidates[Math.floor(Zhan.RNG.random() * candidates.length)];
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
        _pushBattleLog({ type: 'action', side: 'enemy', action: 'trait',
          text: '🐱 舔毛！Boss 清除自身全部 Debuff（破甲/虚弱/击晕）' });
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
        _pushBattleLog({ type: 'action', side: 'enemy', action: 'trait',
          text: '🐱 哈气！！全场 Buff/Debuff 清空！' });
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

// 跳过槽位计数 + 存档键（在 Zhan.Engine 定义后赋值，见下方）
// ========== 日志 ==========
function log(st, msg) {
  // 兼容旧调用：如果第二个参数不存在，则 st 实际上是 msg
  if (msg === undefined) { msg = st; st = Zhan.Engine && Zhan.Engine.state; }
  if (window.console && window.console.log) console.log(msg);
  if (st && st.logLines) {
    st.logLines.push(msg);
    if (st.logLines.length > (CONFIG.LOG_MAX_LINES || 100)) {
      st.logLines.splice(0, st.logLines.length - (CONFIG.LOG_MAX_LINES || 100));
    }
  }
}

// ========== Zhan.Engine — 集中状态管理 ==========
Zhan.Engine = {
  state: null,
  init: function() { return newGame(); },
  _pullCard: function(r, c) {
    if (Zhan.Engine.state.phase !== CONFIG.PHASE_PLAYER || Zhan.Engine.state.over) return false;
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
    Zhan.Engine._skippedSlots = 0;
    var maxSize = Zhan.Engine.state.effectiveSlotSize || CONFIG.SLOT_SIZE;
    if (Zhan.Engine.state.lockedSlots) {
      var insIdx = Zhan.Engine.state.slot.length;
      while (insIdx < maxSize && Zhan.Engine.state.lockedSlots[insIdx]) {
        Zhan.Engine.state.slot.push(null); // 占位锁定槽
        insIdx++;
        Zhan.Engine._skippedSlots++;
      }
      if (insIdx >= maxSize) {
        log('🔒 所有剩余槽位都被锁定了！');
        // BUG2 FIX: push card back to pile
        while (Zhan.Engine._skippedSlots > 0) { Zhan.Engine.state.slot.pop(); Zhan.Engine._skippedSlots--; }
        pile.push(card);
        return false;
      }
    }
    Zhan.Engine.state.slot.push(card);
    updateComboPreview();
    var ct = CARD_TYPES[card.type] || { emoji: '⬜', label: '废牌' };
    log(ct.emoji + ct.label + '→槽(' + Zhan.Engine.state.slot.length + '/' + Zhan.Engine.state.effectiveSlotSize + ')' + (Zhan.Engine._skippedSlots > 0 ? ' 🔒跳过' + Zhan.Engine._skippedSlots + '格' : ''));
    Zhan.Events.emit('cardPlayed', { type: card.type, pileR: r, pileC: c });
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
    // 动态重算 atk_down_pct: 跟随 fury 和 HP 变化（与 vuln/atkBuff 一致）
    if ((st.enemyEffects.atk_down || 0) > 0) {
      var basePct = (st.activeRelics && st.activeRelics.indexOf('overload_core') >= 0) ? 50 : CONFIG.ATK_DOWN_PCT;
      if (st.furyEnabled) {
        var furyMult = Zhan.Systems.Relic.getFuryMultiplier(st);
        st.enemyEffects.atk_down_pct = Math.min(100, Math.round(basePct * furyMult));
      } else {
        st.enemyEffects.atk_down_pct = basePct;
      }
    }
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
          var tj = Math.floor(Zhan.RNG.random() * (ti + 1));
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
    Zhan.Events.emit('damageTaken', { raw: rawAtk, final: dmg, shielded: absorb || 0, source: label });

    // 猫毛商店：复苏（每局一次，HP<50 时触发）
    if (Zhan.Save.hasPurchase('revive') && !st._reviveUsed && st.playerHP < 50 && st.playerHP > 0) {
      st.playerHP = Math.min(st.playerMaxHP, st.playerHP + 10);
      st._reviveUsed = true;
      log(st, '💚 复苏触发！恢复 10 点生命');
    }

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
    // 回放记录：仅记录战斗中的玩家操作
    var replayableActions = ['PLAY_CARD', 'END_TURN', 'REMOVE_CARD', 'SHUFFLE'];
    if (replayableActions.indexOf(action.type) >= 0
        && this.state.phase === CONFIG.PHASE_PLAYER
        && !this.state.over) {
      this.state.replayActions.push(action);
    }
    switch (action.type) {
      case 'PLAY_CARD':
        this._pullCard(action.r, action.c);
        break;
      case 'END_TURN':
        this._executeTurn();
        break;
      case 'RESET':
        Zhan.Engine._towerDefeated = {};
        this.state = null;
        newGame({ mode: CONFIG.MODE_NORMAL, bossId: CONFIG.BOSS_DEFAULT_ID, currentStage: 1, activeRelics: [], isEndless: false });
        break;
      case 'RESTART':
        Zhan.Engine._towerDefeated = {};
        this.state = null;
        newGame({ mode: CONFIG.MODE_NORMAL, bossId: CONFIG.BOSS_DEFAULT_ID, currentStage: 1, activeRelics: [], isEndless: false });
        break;
      case 'START_ENDLESS':
        Zhan.Engine._towerDefeated = {};
        var es = this.init();
        es.isEndless = true;
        Zhan.Engine._startTowerNextCat();
        break;
      case 'START_TOWER':
        Zhan.Engine._towerDefeated = {};
        this.state = null;
        newGame({ mode: CONFIG.MODE_TOWER, towerFloor: 0, towerDefeated: [], towerRelicCount: 0, activeRelics: [] });
        break;
      case 'ADV_CONTINUE':
        Zhan.Engine._adventureNext();
        break;
      case 'GO_HOME':
        this.state = null;
        if (Zhan.UI && Zhan.UI.renderMainMenu) Zhan.UI.renderMainMenu();
        break;
      case 'REMOVE_CARD':
        if (this.state.slot.length > 0 && (this.state.removeUsed || 0) < 1) {
          this.state.slot = [];
          this.state.removeUsed = (this.state.removeUsed || 0) + 1;
          if (Zhan.UI && Zhan.UI.updateComboPreview) Zhan.UI.updateComboPreview(this.state);
        }
        break;
      case 'SHUFFLE':
        if ((this.state.shuffleUsed || 0) < 1) {
          this.state.shuffleUsed = (this.state.shuffleUsed || 0) + 1;
          // 收集所有 piles 中剩余卡牌
          var allCards = [];
          var stPiles = this.state.piles;
          for (var _r = 0; _r < CONFIG.BOARD_ROWS; _r++) {
            for (var _c = 0; _c < CONFIG.BOARD_COLS; _c++) {
              var pile = stPiles[_r][_c];
              for (var _i = 0; _i < pile.length; _i++) allCards.push(pile[_i]);
              stPiles[_r][_c] = [];
            }
          }
          shuffle(allCards, Zhan.RNG.random);
          // 重新平均分布到 25 个 piles
          var idx = 0;
          var totalCards = allCards.length;
          var nPiles = CONFIG.BOARD_ROWS * CONFIG.BOARD_COLS;
          var basePileSize = Math.floor(totalCards / nPiles);
          var remaining = totalCards - basePileSize * nPiles;
          var flatPiles = [];
          for (var _r2 = 0; _r2 < CONFIG.BOARD_ROWS; _r2++) {
            for (var _c2 = 0; _c2 < CONFIG.BOARD_COLS; _c2++) flatPiles.push(stPiles[_r2][_c2]);
          }
          for (var _pi = 0; _pi < flatPiles.length; _pi++) {
            var sz = basePileSize + (_pi < remaining ? 1 : 0);
            for (var _j = 0; _j < sz; _j++) flatPiles[_pi].push(allCards[idx++]);
          }
          // 每个 pile 内部洗顶牌
          for (var _pi2 = 0; _pi2 < flatPiles.length; _pi2++) {
            var p = flatPiles[_pi2];
            if (p.length > 1) {
              var topN = Math.min(4, p.length);
              var top = p.slice(0, topN);
              for (var ti = top.length - 1; ti > 0; ti--) {
                var si = Math.floor(Zhan.RNG.random() * (ti + 1));
                var tmp = top[ti]; top[ti] = top[si]; top[si] = tmp;
              }
              for (var tii = 0; tii < top.length; tii++) p[tii] = top[tii];
            }
          }
          this.state.lockedPiles = {};
          this.state.smearedPiles = {};
          if (Zhan.UI && Zhan.UI.updateComboPreview) Zhan.UI.updateComboPreview(this.state);
        }
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
    // 舔毛/哈气：优先于眩晕，能清除眩晕 debuff
    if (st.boss.hpTriggers) { Zhan.Systems.Boss.runHpTriggers(st, 'hiss'); if (st.over) return; }
    if (st.boss.hpTriggers) { Zhan.Systems.Boss.runHpTriggers(st, 'groom'); if (st.over) return; }
    // T1 首回合 buff_self：仅 powerGrowth>0 时特殊处理（加 buff 不行动）
    // powerGrowth===0 的敌人跳过此分支，走正常 hiss/groom/stun/cycle 流程
    if (st.turn === 0 && st.boss.powerGrowth > 0) {
      log(st.boss.emoji + ' 能力值buff！power=' + st.power);
      st.power += st.boss.powerGrowth;
      Zhan.Systems.Boss.processEvent(st, 'TURN_END');
      if (st.lockedSlots) {
        var cleaned0 = [];
        for (var _ci0 = 0; _ci0 < st.slot.length; _ci0++) {
          if (st.slot[_ci0] !== null || (st.lockedSlots && st.lockedSlots[_ci0])) cleaned0.push(st.slot[_ci0]);
        }
        st.slot = cleaned0;
      }
      st.turn++; st.phase = CONFIG.PHASE_PLAYER;
      Zhan.Engine._updateEffectiveFury(st);
      log('⏭ 回合' + (st.turn+1) + '开始');
      log(st.boss.emoji + 'HP:' + st.enemyHP + '🛡' + st.enemyShield + '⚡' + st.power);
      Zhan.Events.emit('turnEnd', { turn: st.turn, playerHP: st.playerHP, enemyHP: st.enemyHP });
      _pushBattleLog({ type: 'turnFooter', text: '—— 回合结束 ——' });
      if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(st);
      Zhan.Engine._updateEnemyIntent(); return;
    }
    if ((st.enemyEffects.stun || 0) > 0) {
      log('💫 ' + st.boss.name + '击晕，跳过回合！');
      _pushBattleLog({ type: 'action', side: 'enemy', action: 'stun', text: 'Boss 被击晕，跳过回合' });
      st.enemyEffects.stun--;
      if (st.enemyEffects.stun <= 0) st.enemyEffects.stun = 0;
      st.turn++; st.phase = CONFIG.PHASE_PLAYER;
            log('⏭ 回合' + (st.turn+1) + '开始');
      Zhan.Events.emit('turnEnd', { turn: st.turn, playerHP: st.playerHP, enemyHP: st.enemyHP });
      _pushBattleLog({ type: 'turnFooter', text: '—— 回合结束 ——' });
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
    // 战斗日志：敌方分隔线（缅因猫标注先手）
    _pushBattleLog({ type: 'separator', text: '─── 敌方' + (st.boss.id === 'maine_coon' ? '（先手）' : '') + ' ───' });

    var playerHPBefore = st.playerHP, playerShieldBefore = st.playerShield;
    switch (cycle.type) {
      case 'attack':
        Zhan.Engine._applyDamageToPlayer(rawAtk, rawAtk, st.boss.emoji + '攻击');
        var actualDmg = Math.max(0, playerHPBefore - st.playerHP - Math.max(0, st.playerShield - playerShieldBefore));
        var actualShieldBlock = Math.max(0, st.playerShield - playerShieldBefore);
        _pushBattleLog({
          type: 'action', side: 'enemy', action: 'attack',
          text: 'Boss 攻击造成 ' + actualDmg + ' 点伤害',
          formulaParts: _buildEnemyFormulaParts(rawAtk, st),
          finalValue: '' + actualDmg,
          detail: '勇者 HP: ' + playerHPBefore + ' → ' + st.playerHP + '  🛡️: ' + playerShieldBefore + ' → ' + st.playerShield
        });
        break;
      case 'defend':
        st.enemyShield += st.power; log(st.boss.emoji + '防御+' + st.power + ' 🛡' + st.enemyShield);
        _pushBattleLog({ type: 'action', side: 'enemy', action: 'defend', text: 'Boss 增加 ' + st.power + ' 点护盾' });
        break;
      case 'focus':
        log(st.boss.emoji + ' 蓄力中……');
        _pushBattleLog({ type: 'action', side: 'enemy', action: 'focus', text: 'Boss 蓄力中……' });
        break;
      case 'crit':
        Zhan.Engine._applyDamageToPlayer(rawAtk * 2, rawAtk * 2, st.boss.emoji + '暴击×2=');
        var actualCritDmg = Math.max(0, playerHPBefore - st.playerHP - Math.max(0, st.playerShield - playerShieldBefore));
        _pushBattleLog({
          type: 'action', side: 'enemy', action: 'crit',
          text: 'Boss 暴怒攻击造成 ' + actualCritDmg + ' 点伤害',
          formulaParts: [{ text: rawAtk + '(基础' + (st.power - (st.boss.powerGrowth || 0)) + '+力量' + (st.boss.powerGrowth || 0) + ')', color: '#eee' }, { text: ' ×2(暴怒)', color: '#f1c40f' }].concat(
            (st.playerEffects.def_buff || 0) > 0 ? [{ text: ' ×' + parseFloat((st.defBuffRatio || CONFIG.DEF_BUFF_RATIO).toFixed(1)) + '(减伤)', color: '#1abc9c' }] : []
          ).concat(
            (st.enemyEffects.atk_down || 0) > 0 ? [{ text: ' ↓' + (st.enemyEffects.atk_down_pct || CONFIG.ATK_DOWN_PCT) + '%(虚弱)', color: '#8e44ad' }] : []
          ),
          finalValue: '' + actualCritDmg,
          detail: '勇者 HP: ' + playerHPBefore + ' → ' + st.playerHP + '  🛡️: ' + playerShieldBefore + ' → ' + st.playerShield
        });
        break;
      default: log(st.boss.emoji + ' ' + st.boss.name + ' 未定义行动'); break;
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
    st.turn++; st.phase = CONFIG.PHASE_PLAYER;
        Zhan.Engine._updateEffectiveFury(st);
    log('⏭ 回合' + (st.turn+1) + '开始');
    Zhan.Events.emit('turnEnd', { turn: st.turn, playerHP: st.playerHP, enemyHP: st.enemyHP });
    log(st.boss.emoji + 'HP:' + st.enemyHP + '🛡' + st.enemyShield + '⚡' + st.power);
    // 战斗日志：回合结束
    _pushBattleLog({ type: 'turnFooter', text: '—— 回合结束 ——' });
    // buff到期（敌人+玩家所有buff）— 回合末尾递减
    for (var k in st.enemyEffects) { if (k !== 'stun' && st.enemyEffects[k] > 0) st.enemyEffects[k]--; }
    if ((st.enemyEffects.atk_down || 0) <= 0) { st.enemyEffects.atk_down = 0; st.enemyEffects.atk_down_pct = 0; }
    if ((st.playerEffects.def_buff || 0) > 0) st.playerEffects.def_buff--;
    if ((st.playerEffects.divine || 0) > 0) st.playerEffects.divine--;
    if ((st.playerEffects.atk_buff || 0) > 0) st.playerEffects.atk_buff--;
    if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(st);
    Zhan.Engine._updateEnemyIntent();
  },

  _executeTurn: function() {
    var st = this.state;
    if (st.phase !== CONFIG.PHASE_PLAYER || st.over) return;
    if (st.playerSkipped) {
      st.playerSkipped = false; st.phase = 'resolving';
      log('🐱 被晕眩，跳过回合！'); st.slot = [];
      Zhan.Engine._updateEnemyIntent();
      setTimeout(function() { Zhan.Engine._enemyTurn(); }, 300); return;
    }
    if (st.boss && st.boss.id === 'maine_coon') {
      _pushBattleLog({ type: 'separator', text: '─── 缅因猫先手 ───' });
      st._maineCoonFirst = true; Zhan.Engine._enemyTurn();
      if (st.over) return;
    }
    st.phase = 'resolving';
    log('▶ 回合' + (st.turn+1)); log('⚔️ 勇者行动');
    Zhan.Events.emit('turnStart', { turn: st.turn + 1, playerHP: st.playerHP, enemyHP: st.enemyHP });
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
          var atkDownPct = CONFIG.ATK_DOWN_PCT;  // 始终从基准算，不复用旧值
          if (st.activeRelics.indexOf('overload_core') >= 0) atkDownPct = 50;
          if (st.furyEnabled && RELICS.fury_core) atkDownPct = Math.min(100, Math.round(atkDownPct * Zhan.Systems.Relic.getFuryMultiplier(st)));
          st.enemyEffects.atk_down_pct = atkDownPct;
          st.enemyEffects.atk_down = (st.enemyEffects.atk_down || 0) + dur;
          log('⬇虚弱 +' + dur + '→' + st.enemyEffects.atk_down + '回合'); break;
      }
    }
    log('  ⚡ 行动结算...');
    var slotTypeCount = {};
    var turnCards = [];  // 本回合出牌类型（按打出顺序）
    for (var si = 0; si < st.slot.length; si++) {
      var stype = Zhan.Rules.resolveWildType(st.slot, si);
      if (!BUFF_TYPES[stype] && stype !== 'junk') { if (!slotTypeCount[stype]) slotTypeCount[stype] = 0; slotTypeCount[stype]++; }
      turnCards.push(stype);
    }
    var actionMaxLen = {};
    for (var ci2 = 0; ci2 < combos.length; ci2++) {
      var c2 = combos[ci2];
      if (BUFF_TYPES[c2.type]) continue;
      if (!actionMaxLen[c2.type] || c2.n > actionMaxLen[c2.type]) actionMaxLen[c2.type] = c2.n;
    }

    // --- 战斗日志：回合头 + 出牌行 ---
    _pushBattleLog({ type: 'turnHeader', text: '—— 第 ' + (st.turn + 1) + ' 回合 ——' });
    if (turnCards.length > 0) _pushBattleLog({ type: 'cardsRow', cards: turnCards });
    var activeBuffs = _getActiveBuffs(st);
    if (activeBuffs.length > 0) _pushBattleLog({ type: 'buffsRow', buffs: activeBuffs });

    // --- 攻击 ---
    if (slotTypeCount.attack && slotTypeCount.attack >= (st.effectiveMinCombo || CONFIG.MIN_COMBO)) {
      var atkTotal = slotTypeCount.attack;
      var atkMaxLen = actionMaxLen.attack || 0;
      var mc = st.effectiveMinCombo || CONFIG.MIN_COMBO;
      var baseAtk = Zhan.Rules.calcBaseValue(atkTotal, mc);
      var d = Zhan.Rules.calcAttackValue(atkTotal, atkMaxLen, mc);
      if (d > 0) {
        var enemyHPBefore = st.enemyHP, enemyShieldBefore = st.enemyShield;
        Zhan.Engine._updateEffectiveFury(st);
        d = Zhan.Rules.applyStatusEffects('attack', d, { atkBuffMult: st.effectiveAtkBuffMult, vulnMult: st.effectiveVulnMult, defBuffRatio: st.defBuffRatio });
        if (d > st.maxDamage) st.maxDamage = d;
        st.totalDamage += d;
        var pursuitLog = '';
        var pursuitMult = 1;
        if (atkMaxLen >= mc + 1) { pursuitMult = Zhan.Rules.calcPursuitMultiplier(atkMaxLen, mc); pursuitLog = ' ' + atkMaxLen + '连×' + pursuitMult.toFixed(1); }
        var shieldAbsorbed = 0;
        if (st.enemyShield > 0) { shieldAbsorbed = Math.min(st.enemyShield, d); st.enemyShield -= shieldAbsorbed; d -= shieldAbsorbed; }
        st.enemyHP = Math.max(0, st.enemyHP - d);
        log('🗡×' + atkTotal + '→' + baseAtk + pursuitLog + '→总' + d + ' → ' + st.boss.emoji + st.enemyHP + '🛡' + st.enemyShield);
        Zhan.Events.emit('damageDealt', { raw: baseAtk, final: d, crit: st.effectiveAtkBuffMult > CONFIG.ATK_BUFF_MULT, source: 'attack', comboLen: atkMaxLen });
        // 战斗日志
        var atkParts = _buildFormulaParts(baseAtk + '(基础' + atkTotal + '连)', pursuitMult, st);
        if (shieldAbsorbed > 0) atkParts.push({ text: ' -' + shieldAbsorbed + '(护盾)', color: '#3498db' });
        var atkText = '🗡 攻击';
        if (shieldAbsorbed >= (d + shieldAbsorbed)) atkText += '（被护盾抵挡）';
        _pushBattleLog({
          type: 'action', side: 'player', action: 'attack',
          text: '🗡 造成 ' + (d > 0 ? d : 0) + ' 点伤害' + (shieldAbsorbed >= (d + shieldAbsorbed) ? '（被护盾抵挡）' : ''),
          formulaParts: atkParts,
          finalValue: '' + (d > 0 ? d : 0),
          detail: 'Boss HP: ' + enemyHPBefore + ' → ' + st.enemyHP + '  🛡️: ' + enemyShieldBefore + ' → ' + st.enemyShield
        });
      }
    }

    // --- 防御 ---
    if (slotTypeCount.defend && slotTypeCount.defend >= (st.effectiveMinCombo || CONFIG.MIN_COMBO)) {
      var defTotal = slotTypeCount.defend;
      var defMaxLen = actionMaxLen.defend || 0;
      var mc2 = st.effectiveMinCombo || CONFIG.MIN_COMBO;
      var baseDef = Zhan.Rules.calcBaseValue(defTotal, mc2);
      var shieldVal = Zhan.Rules.calcDefendValue(defTotal, defMaxLen, mc2);
      if (shieldVal > 0) {
        var shieldBefore = st.playerShield;
        var defPursuitMult = 1;
        var pursuitLog2 = '';
        if (defMaxLen >= mc2 + 1) { defPursuitMult = Zhan.Rules.calcPursuitMultiplier(defMaxLen, mc2); pursuitLog2 = ' ' + defMaxLen + '连×' + defPursuitMult.toFixed(1); }
        st.playerShield += shieldVal;
        log('🛡×' + defTotal + '→' + baseDef + pursuitLog2 + '→总' + shieldVal + ' 🛡' + st.playerShield);
        var defParts = [{ text: baseDef + '(基础' + defTotal + '连)', color: '#eee' }];
        if (defPursuitMult > 1) defParts.push({ text: ' ×' + parseFloat(defPursuitMult.toFixed(1)) + '(追击)', color: '#eee' });
        _pushBattleLog({
          type: 'action', side: 'player', action: 'defend',
          text: '🛡 增加 ' + shieldVal + ' 点护盾',
          formulaParts: defParts,
          finalValue: '' + shieldVal,
          detail: '护盾: ' + shieldBefore + ' → ' + st.playerShield
        });
      }
    }

    // --- 治疗 ---
    if (slotTypeCount.heal && slotTypeCount.heal >= (st.effectiveMinCombo || CONFIG.MIN_COMBO)) {
      var healTotal = slotTypeCount.heal;
      var healMaxLen = actionMaxLen.heal || 0;
      var mc3 = st.effectiveMinCombo || CONFIG.MIN_COMBO;
      var baseHeal = Zhan.Rules.calcBaseValue(healTotal, mc3);
      var healVal = Zhan.Rules.calcHealValue(healTotal, healMaxLen, mc3);
      if (healVal > 0) {
        var hpBefore = st.playerHP;
        var healPursuitMult = 1;
        var pursuitLog3 = '';
        if (healMaxLen >= mc3 + 1) { healPursuitMult = Zhan.Rules.calcPursuitMultiplier(healMaxLen, mc3); pursuitLog3 = ' ' + healMaxLen + '连×' + healPursuitMult.toFixed(1); }
        st.playerHP = Math.min(st.playerMaxHP, st.playerHP + healVal);
        log('❤×' + healTotal + '→' + baseHeal + pursuitLog3 + '→总' + healVal + ' ❤' + st.playerHP);
        var healParts = [{ text: baseHeal + '(基础' + healTotal + '连)', color: '#eee' }];
        if (healPursuitMult > 1) healParts.push({ text: ' ×' + parseFloat(healPursuitMult.toFixed(1)) + '(追击)', color: '#eee' });
        _pushBattleLog({
          type: 'action', side: 'player', action: 'heal',
          text: '❤️ 恢复 ' + healVal + ' 点生命',
          formulaParts: healParts,
          finalValue: '' + healVal,
          detail: 'HP: ' + hpBefore + ' → ' + st.playerHP
        });
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
    Zhan.Events.emit('comboResolved', { combos: combos, totalDamage: st.totalDamage, maxCombo: st.maxCombo });
    if (st.enemyHP <= 0) { Zhan.Engine._endGame(true, st.boss.emoji + ' 击败！'); return; }
    if (st.playerHP <= 0) { Zhan.Engine._endGame(false, '勇者倒下了...'); return; }
    var totalRemaining = 0;
    var fp = flatten(st.piles);
    for (var fi = 0; fi < fp.length; fi++) totalRemaining += fp[fi].length;
    if (totalRemaining === 0) { Zhan.Engine._endGame(true, '✨ 牌库全消！元气弹斩杀！'); return; }
    Zhan.Engine._updateEffectiveFury(st);
    // 猫毛商店：回合护盾
    var shieldLevel = Zhan.Save.getPurchaseLevel('shield_boost');
    if (shieldLevel > 0) { st.playerShield += shieldLevel; }
    Zhan.Engine._updateEnemyIntent();
    if (st._maineCoonFirst) {
      st._maineCoonFirst = false; st.phase = CONFIG.PHASE_PLAYER;
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

// 跳过槽位计数（pullCard 中跨作用域用）
Zhan.Engine._skippedSlots = 0;

// ========== 战斗日志采集 ==========
function _pushBattleLog(entry) {
  var st = Zhan.Engine.state;
  if (!st || !st.logLines) return;
  st.logLines.push(entry);
}

function _getActiveBuffs(st) {
  var buffs = [];
  if (st.effectiveAtkBuffMult > CONFIG.ATK_BUFF_MULT) buffs.push({ name: '暴击', value: '×' + parseFloat(st.effectiveAtkBuffMult.toFixed(1)), color: '#f1c40f' });
  if (st.effectiveVulnMult > 0) buffs.push({ name: '破甲', value: '×' + parseFloat(st.effectiveVulnMult.toFixed(1)), color: '#e74c3c' });
  if ((st.playerEffects.def_buff || 0) > 0) buffs.push({ name: '减伤', value: '×' + parseFloat((st.defBuffRatio || CONFIG.DEF_BUFF_RATIO).toFixed(1)), color: '#1abc9c' });
  if ((st.enemyEffects.atk_down || 0) > 0) {
    var pct = st.enemyEffects.atk_down_pct || CONFIG.ATK_DOWN_PCT;
    buffs.push({ name: '虚弱', value: '↓' + pct + '%', color: '#8e44ad' });
  }
  return buffs;
}

function _buildFormulaParts(baseText, pursuitMult, st) {
  var parts = [];
  parts.push({ text: baseText, color: '#eee' });
  if (pursuitMult > 1) parts.push({ text: ' ×' + parseFloat(pursuitMult.toFixed(1)) + '(追击)', color: '#eee' });
  if (st.effectiveAtkBuffMult > CONFIG.ATK_BUFF_MULT) parts.push({ text: ' ×' + parseFloat(st.effectiveAtkBuffMult.toFixed(1)) + '(暴击)', color: '#f1c40f' });
  if (st.effectiveVulnMult > 0) parts.push({ text: ' ×' + parseFloat(st.effectiveVulnMult.toFixed(1)) + '(破甲)', color: '#e74c3c' });
  return parts;
}

function _buildEnemyFormulaParts(baseAtk, st) {
  var parts = [];
  parts.push({ text: baseAtk + '(基础' + (st.power - (st.boss.powerGrowth || 0)) + '+力量' + (st.boss.powerGrowth || 0) + ')', color: '#eee' });
  if ((st.playerEffects.def_buff || 0) > 0) parts.push({ text: ' ×' + parseFloat((st.defBuffRatio || CONFIG.DEF_BUFF_RATIO).toFixed(1)) + '(减伤)', color: '#1abc9c' });
  if ((st.enemyEffects.atk_down || 0) > 0) {
    var pct = st.enemyEffects.atk_down_pct || CONFIG.ATK_DOWN_PCT;
    parts.push({ text: ' ↓' + pct + '%(虚弱)', color: '#8e44ad' });
  }
  return parts;
}
// ========== 存档模块 ==========
Zhan.Save = {
  _key: 'zhan_save',
  _data: null,

  _defaultData: function() {
    return { version: CONFIG.SAVE_VERSION || 3, catMao: 0, advUnlocked: 50, bestFloor: 0,
             mazeFirstKills: [], towerBestFloor: 0,
             mazeUnlocked: false, towerUnlocked: false,
             catMaoPurchases: {}, catMaoDailyMaze: '', catMaoDailyCount: 0,
             catMaoAffinityRelic: '' };
  },

  load: function() {
    try {
      var raw = localStorage.getItem(this._key);
      if (raw) {
        this._data = JSON.parse(raw);
        var currentVer = CONFIG.SAVE_VERSION || 2;
        var saveVer = this._data.version || 0;
        if (saveVer < 1) {
          if (!this._data.mazeFirstKills) this._data.mazeFirstKills = [];
          if (this._data.mazeUnlocked === undefined) this._data.mazeUnlocked = false;
          if (this._data.towerUnlocked === undefined) this._data.towerUnlocked = false;
          if (this._data.towerBestFloor === undefined) this._data.towerBestFloor = 0;
          this._data.version = 1;
        }
        if (saveVer < 2) {
          if (!this._data.catMaoPurchases) this._data.catMaoPurchases = {};
          if (!this._data.catMaoDailyMaze) this._data.catMaoDailyMaze = '';
          if (this._data.catMaoDailyCount === undefined) this._data.catMaoDailyCount = 0;
          this._data.version = 2;
        }
        if (saveVer < 3) {
          if (!this._data.catMaoAffinityRelic) this._data.catMaoAffinityRelic = '';
          this._data.version = 3;
        }
        this._data.advUnlocked = 50;
      } else {
        this._data = this._defaultData();
      }
    } catch(e) {
      this._data = this._defaultData();
    }
    return this._data;
  },

  save: function() {
    try { localStorage.setItem(this._key, JSON.stringify(this._data)); } catch(e) {}
  },

  get: function(key, def) {
    if (!this._data) this.load();
    var val = this._data[key];
    return val !== undefined ? val : (def !== undefined ? def : 0);
  },

  set: function(key, value) {
    if (!this._data) this.load();
    this._data[key] = value;
    this.save();
  },

  saveFromState: function(st) {
    if (!st) st = Zhan.Engine.state;
    if (!st) return;
    if (!this._data) this.load();
    var unlockCount = st.mode === CONFIG.MODE_ADVENTURE ? (st.adventureStageId || 1) : 1;
    this._data.advUnlocked = unlockCount;
    this._data.mazeUnlocked = unlockCount > 4;
    this._data.towerUnlocked = unlockCount > 4;
    this.save();
  },

  earn: function(amount, reason) {
    if (!this._data) this.load();
    this._data.catMao = (this._data.catMao || 0) + amount;
    this.save();
    Zhan.Events.emit('catMaoEarned', { amount: amount, reason: reason, total: this._data.catMao });
  },

  spend: function(amount, itemId) {
    if (!this._data) this.load();
    if ((this._data.catMao || 0) < amount) return false;
    this._data.catMao -= amount;
    if (!this._data.catMaoPurchases) this._data.catMaoPurchases = {};
    var cur = this._data.catMaoPurchases[itemId] || 0;
    this._data.catMaoPurchases[itemId] = cur + 1;
    this.save();
    return true;
  },

  canAfford: function(amount) {
    if (!this._data) this.load();
    return (this._data.catMao || 0) >= amount;
  },

  hasPurchase: function(itemId) {
    if (!this._data) this.load();
    return !!(this._data.catMaoPurchases && this._data.catMaoPurchases[itemId]);
  },

  getPurchaseLevel: function(itemId) {
    if (!this._data) this.load();
    return (this._data.catMaoPurchases && this._data.catMaoPurchases[itemId]) || 0;
  }
};

// 向后兼容别名
Zhan.Engine.SAVE_KEY = 'zhan_save';
Zhan.Engine._save = null;

// ========== 冒险模式辅助函数 ==========
function resolveCycle(cycleStr, defValue) {
  switch (cycleStr) {
    case 'atk_def': return [{ type: 'attack' }, { type: 'defend', shield: defValue || 0 }];
    case 'focus_attack': return [{ type: 'focus' }, { type: 'attack' }];
    case 'atk_def_focus_crit': return [{ type: 'attack' }, { type: 'defend' }, { type: 'focus' }, { type: 'crit' }];
    case 'atk_def_atk_focus_crit': return [{ type: 'attack' }, { type: 'defend' }, { type: 'attack' }, { type: 'focus' }, { type: 'crit' }];
    default: return [{ type: 'attack' }, { type: 'defend' }, { type: 'focus' }, { type: 'crit' }];
  }
}

function pickRandomCat() {
  return CAT_BOSS_IDS[Math.floor(Math.random() * CAT_BOSS_IDS.length)];
}

function pickTowerCat() {
  var st = Zhan.Engine.state;
  if (!st) return CAT_BOSS_IDS[Math.floor(Math.random() * CAT_BOSS_IDS.length)];
  var defeated = st.towerDefeated || [];
  var remaining = CAT_BOSS_IDS.filter(function(id) { return defeated.indexOf(id) < 0; });
  if (!remaining.length) return CAT_BOSS_IDS[Math.floor(Math.random() * CAT_BOSS_IDS.length)];
  return remaining[Math.floor(Math.random() * remaining.length)];
}

// 纯状态工厂：根据 options 创建新状态对象，无副作用
function createState(options) {
  var bossId = options.bossId;
  var boss = options.boss;
  if (!boss) boss = JSON.parse(JSON.stringify(BOSSES[bossId]));

  // 冒险模式：应用关卡定义的 HP/ATK
  if (options.advDef) {
    boss.maxHP = options.advDef.hp;
    boss.baseAtk = options.advDef.atk;
    boss.powerGrowth = options.advDef.growth || 0;
    boss.startShield = 0;
    boss.cycle = resolveCycle(options.advDef.cycle, options.advDef.def || 0);
  }

  var relics = options.activeRelics || [];
  var state = {
    deck: [], piles: [], slot: [],
    playerHP: CONFIG.PLAYER_MAX_HP,
    playerMaxHP: CONFIG.PLAYER_MAX_HP,
    playerShield: 0,
    enemyHP: boss.maxHP,
    enemyMaxHP: boss.maxHP,
    enemyShield: boss.startShield || 0,
    power: boss.baseAtk,
    turn: 0,
    phase: CONFIG.PHASE_PLAYER,
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
    deckConfig: options.deckOverride || JSON.parse(JSON.stringify(DECK_SIZES)),
    lockedPiles: {},
    lockedSlots: {},
    smearedPiles: {},
    hideIntent: false,
    playerSkipped: false,
    currentStage: options.currentStage || 1,
    maxCombo: 0,
    maxDamage: 0,
    totalDamage: 0,
    activeRelicNames: relics.map(function(r) { return (RELICS[r] && RELICS[r].name) || r; }),
    isEndless: options.isEndless || false,
    mode: options.mode || CONFIG.MODE_NORMAL,
    adventureStageId: options.adventureStageId || 1,
    mazePhase: options.mazePhase || null,
    towerFloor: options.towerFloor || 0,
    towerDefeated: options.towerDefeated || [],
    towerRelicCount: options.towerRelicCount || 0,
    removeUsed: 0,
    shuffleUsed: 0,
    _reviveUsed: false,
    battleSeed: Zhan.RNG.getSeed(),
    replayActions: [],
  };
  return state;
}

// 初始化编排：创建新状态并执行副作用（发牌、渲染、log）
function newGame(overrides) {
  var oldSt = Zhan.Engine.state;
  var options = overrides || {};

  // 从旧状态继承需要持久化的字段（调用方未显式指定时自动继承）
  if (oldSt) {
    if (!options.mode) options.mode = oldSt.mode || CONFIG.MODE_NORMAL;
    if (!('isEndless' in options)) options.isEndless = oldSt.isEndless;
    if (!('adventureStageId' in options)) options.adventureStageId = oldSt.adventureStageId;
    if (!('mazePhase' in options)) options.mazePhase = oldSt.mazePhase;
    if (!('towerFloor' in options)) options.towerFloor = oldSt.towerFloor || 0;
    if (!('towerDefeated' in options)) options.towerDefeated = oldSt.towerDefeated || [];
    if (!('towerRelicCount' in options)) options.towerRelicCount = oldSt.towerRelicCount || 0;
    if (!('activeRelics' in options)) options.activeRelics = oldSt.activeRelics || [];
    if (!('currentStage' in options)) options.currentStage = oldSt.currentStage;
  }

  // === 种子初始化 ===
  if (options.seed === undefined || options.seed === null) {
    options.seed = Date.now();
  }
  Zhan.RNG.setSeed(options.seed);

  // === Boss 选择 ===
  var mode = options.mode || CONFIG.MODE_NORMAL;
  var bossId = options.bossId;
  var boss = options.boss;

  if (!bossId) {
    if (mode === CONFIG.MODE_ADVENTURE) {
      var advId = options.adventureStageId || 1;
      var advDef = ADVENTURE_STAGES[advId - 1] || ADVENTURE_STAGES[0];
      bossId = advDef.bossId;
      options.bossId = bossId;
      options.advDef = advDef;
      if (advDef.deck) options.deckOverride = JSON.parse(JSON.stringify(advDef.deck));
    } else if (mode === CONFIG.MODE_MAZE) {
      if (options.mazePhase === 'skeleton') {
        bossId = CONFIG.BOSS_DEFAULT_ID;
      } else {
        bossId = pickRandomCat();
      }
      options.bossId = bossId;
    } else if (mode === CONFIG.MODE_TOWER) {
      bossId = pickTowerCat();
      options.bossId = bossId;
    } else {
      bossId = CONFIG.BOSS_DEFAULT_ID;
      options.bossId = bossId;
    }
  }

  var st = createState(options);
  Zhan.Engine.state = st;

  // 副作用：圣物初始化、HP 修正
  Zhan.Systems.Relic.applyInit(st);
  // 猫毛商店：生命上限提升
  var hpLevel = Zhan.Save.getPurchaseLevel('hp_boost');
  if (hpLevel > 0) { st.playerMaxHP += hpLevel * 5; }
  st.playerHP = st.playerMaxHP;

  // hiss 初始化
  if (st.boss.hpTriggers && st.boss.hpTriggers.indexOf('hiss') >= 0) {
    st.hissPrevHP = st.boss.maxHP;
  }

  Zhan.Engine._buildDeck();
  // hide_intent trait
  if (st.boss.traits) {
    for (var _bi = 0; _bi < st.boss.traits.length; _bi++) {
      if (st.boss.traits[_bi].id === 'hide_intent') {
        st.hideIntent = true;
        break;
      }
    }
  }
  // 救命毫毛：特殊卡插入
  if (st.specialCards) {
    for (var sc = 0; sc < st.specialCards.length; sc++) {
      st.deck.unshift({ type: st.specialCards[sc].type, id: st.pickedId++, special: st.specialCards[sc] });
    }
    log(st, '🪶 救命毫毛！获得' + st.specialCards.length + '张特殊卡');
  }
  shuffle(st.deck, Zhan.RNG.random);
  Zhan.Engine._buildPiles();
  Zhan.Engine._updateEffectiveFury(st);
  Zhan.Engine._updateEnemyIntent();
  if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(st);
  log(st, '🎲 种子: ' + st.battleSeed);
  log(st, '🐱 新局开始！双击或向下拖拽卡牌进槽');
  Zhan.Events.emit('battleStart', { mode: st.mode, bossId: st.bossId, playerMaxHP: st.playerMaxHP });

  return st;
}

function shuffle(a, rng) {
  var rand = rng || Math.random;
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
}

// ========== 无尽模式状态（全局持久） ==========
Zhan.Engine._towerDefeated = {}; // { bossId: true }

// ========== Zhan.Engine — 流程控制 ==========

Zhan.Engine._endGame = function(win, msg) {
  var st = this.state;
  if (!st) return;
  st.over = true;
  st.phase = CONFIG.PHASE_OVER;
  st.win = win;
  Zhan.Events.emit(win ? 'enemyDeath' : 'playerDeath', { bossId: st.bossId, turn: st.turn });
  Zhan.Events.emit('battleEnd', { win: win, turn: st.turn, totalDamage: st.totalDamage, maxCombo: st.maxCombo });
  if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(st);

  var mode = st.mode || CONFIG.MODE_NORMAL;

  if (win) {
    // === 猫毛收入 ===
    if (mode === CONFIG.MODE_ADVENTURE) {
      Zhan.Save.earn(5, '冒险关卡通关');
    } else if (mode === CONFIG.MODE_MAZE) {
      var d = Zhan.Save.get('catMaoDailyMaze', '');
      var today = new Date().toISOString().split('T')[0];
      if (d !== today) { Zhan.Save.set('catMaoDailyMaze', today); Zhan.Save.set('catMaoDailyCount', 0); }
      var dailyCount = Zhan.Save.get('catMaoDailyCount', 0);
      if (dailyCount < 3) { Zhan.Save.set('catMaoDailyCount', dailyCount + 1); Zhan.Save.earn(10, '迷宫每日奖励'); }
      var firstKills = Zhan.Save.get('mazeFirstKills', []);
      if (firstKills.indexOf(st.bossId) < 0) { firstKills.push(st.bossId); Zhan.Save.set('mazeFirstKills', firstKills); Zhan.Save.earn(50, '迷宫首杀：' + (st.boss.name || st.bossId)); }
    }
    // === 猫王塔模式 ===
    if (mode === CONFIG.MODE_TOWER) {
      Zhan.Engine._towerDefeated[st.bossId] = true;
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
    if (mode === CONFIG.MODE_ADVENTURE) {
      var advId = st.adventureStageId || 1;
      var nextId = advId + 1;
      var moreStages = nextId <= ADVENTURE_STAGES.length;
      st._resultTitle = '🎉 通关！';
      st._restartText = '🔄 重试';
      if (moreStages) {
        st._resultDesc = '第' + advId + '关通过！继续闯关？';
        st._showContinueBtn = true;
        Zhan.Save.saveFromState(st);
      } else {
        st._resultDesc = '🎊 冒险通关！（存活' + st.turn + '回合）';
        st._restartText = '🔄 再来一局';
      }
      log('🎉第' + advId + '关通关！' + msg);
      if (Zhan.UI && Zhan.UI.showResult) Zhan.UI.showResult(st);
      return;
    }

    // === 迷宫模式 ===
    if (mode === CONFIG.MODE_MAZE) {
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
      Zhan.Engine._towerDefeated[st.bossId] = true;
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
        if (!Zhan.Engine._towerDefeated[allCatIds[ci]]) { allDefeated = false; break; }
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
  if (st.mode === CONFIG.MODE_TOWER) {
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
  var remaining = allCatIds.filter(function(id) { return !Zhan.Engine._towerDefeated[id]; });
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
    // 瞳力：隐藏回合也能看到下下回合
    if (Zhan.Save.hasPurchase('clairvoyance')) {
      var nextT = st.turn + 1;
      var nextIdx = nextT > 0 ? (nextT - 1) % st.boss.cycle.length : 0;
      if (nextT === 0) nextIdx = 0;
      var nextCycle = st.boss.cycle[nextIdx];
      switch (nextCycle.type) {
        case 'attack':  st._intentExtraHTML = ' → ⚔️ 攻击 ' + st.power; break;
        case 'defend':  st._intentExtraHTML = ' → 🛡️ 防御 +' + st.power; break;
        case 'focus':   st._intentExtraHTML = ' → ⏳ 蓄力'; break;
        case 'crit':    st._intentExtraHTML = ' → 💥 暴击 ' + (st.power*2); break;
        default:        st._intentExtraHTML = ''; break;
      }
    }
  } else {
    var t = st.turn;
    if (t === 0) {
      if (st.boss.powerGrowth > 0) {
        st._intentHTML = '⚡ 能力值buff';
      } else {
        var firstCycle = st.boss.cycle[0];
        switch (firstCycle.type) {
          case 'attack':       st._intentHTML = '⚔️ 攻击 ' + st.power; break;
          case 'defend':       st._intentHTML = '🛡️ 防御 +' + st.power; break;
          case 'focus':        st._intentHTML = '⏳ 蓄力'; break;
          case 'crit':         st._intentHTML = '💥 暴击 ' + (st.power*2); break;
          default:             st._intentHTML = '❓'; break;
        }
      }
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

    // 瞳力：额外显示下下回合意图
    if (Zhan.Save.hasPurchase('clairvoyance')) {
      var nextT2 = st.turn + 1;
      var nextIdx2 = nextT2 > 0 ? (nextT2 - 1) % st.boss.cycle.length : 0;
      if (nextT2 === 0) nextIdx2 = 0;
      var nextCycle2 = st.boss.cycle[nextIdx2];
      switch (nextCycle2.type) {
        case 'attack':       st._intentExtraHTML = ' → ⚔️ 攻击 ' + st.power; break;
        case 'defend':       st._intentExtraHTML = ' → 🛡️ 防御 +' + st.power; break;
        case 'focus':        st._intentExtraHTML = ' → ⏳ 蓄力'; break;
        case 'crit':         st._intentExtraHTML = ' → 💥 暴击 ' + (st.power*2); break;
        default:             st._intentExtraHTML = ''; break;
      }
    } else {
      st._intentExtraHTML = '';
    }

    // 舔毛预告
    var extra = [];
    var hasGroom = st.boss.hpTriggers && st.boss.hpTriggers.indexOf('groom') >= 0;
    if (hasGroom && st.turn >= 3 && (st.turn + 1 - 4) % 4 === 0) extra.push('🐱舔毛预告');
    if (extra.length) st._intentExtraHTML += ' <span style="font-size:9px;color:#f39c12;">' + extra.join(' ') + '</span>';
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
  shuffle(allRelicIds);
  var count = st.mode === CONFIG.MODE_TOWER ? 1 : 2;
  // 猫毛商店：圣物亲和
  var affinityRelic = Zhan.Save.get('catMaoAffinityRelic', '');
  if (affinityRelic && allRelicIds.indexOf(affinityRelic) >= 0) {
    allRelicIds = allRelicIds.filter(function(r) { return r !== affinityRelic; });
    allRelicIds.unshift(affinityRelic);
  }
  st.relicOptions = allRelicIds.slice(0, count);
  if (Zhan.UI && Zhan.UI.renderRelicSelect) Zhan.UI.renderRelicSelect(st);
};

Zhan.Engine._rerollRelics = function() {
  var st = this.state;
  if (!st) return;
  var allRelicIds = Object.keys(RELICS);
  shuffle(allRelicIds);
  var count = st.mode === CONFIG.MODE_TOWER ? 1 : 2;
  // 猫毛商店：圣物亲和
  var affinityRelic = Zhan.Save.get('catMaoAffinityRelic', '');
  if (affinityRelic && allRelicIds.indexOf(affinityRelic) >= 0) {
    allRelicIds = allRelicIds.filter(function(r) { return r !== affinityRelic; });
    allRelicIds.unshift(affinityRelic);
  }
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

// ========== 入口函数 ==========
Zhan.Engine._startAdventure = function(stageId) {
  this.state = null;
  newGame({ mode: CONFIG.MODE_ADVENTURE, adventureStageId: stageId || 1, activeRelics: [] });
  if (Zhan.UI && Zhan.UI._showView) Zhan.UI._showView('battle-view');
};

Zhan.Engine._startMaze = function() {
  this.state = null;
  newGame({ mode: CONFIG.MODE_MAZE, mazePhase: 'skeleton', bossId: CONFIG.BOSS_DEFAULT_ID, activeRelics: [] });
  if (Zhan.UI && Zhan.UI._showView) Zhan.UI._showView('battle-view');
};

Zhan.Engine._startTower = function() {
  Zhan.Engine._towerDefeated = {};
  this.state = null;
  newGame({ mode: CONFIG.MODE_TOWER, towerFloor: 0, towerDefeated: [], towerRelicCount: 0, activeRelics: [] });
  if (Zhan.UI && Zhan.UI._showView) Zhan.UI._showView('battle-view');
  Zhan.Engine._showRelicSelect();
};

Zhan.Engine._adventureNext = function() {
  var st = this.state;
  if (!st) return;
  st.adventureStageId = (st.adventureStageId || 1) + 1;
  st.activeRelics = st.activeRelics || [];
  newGame();
};

Zhan.Engine._retry = function() {
  var st = this.state;
  var mode = (st && st.mode) || CONFIG.MODE_NORMAL;
  if (mode === CONFIG.MODE_ADVENTURE) {
    Zhan.Engine._startAdventure((st && st.adventureStageId) || 1);
  } else if (mode === CONFIG.MODE_MAZE) {
    Zhan.Engine._startMaze();
  } else if (mode === CONFIG.MODE_TOWER) {
    Zhan.Engine._startTower();
  } else {
    this.state = null;
    newGame({ mode: CONFIG.MODE_NORMAL, bossId: CONFIG.BOSS_DEFAULT_ID, currentStage: 1 });
  }
};

Zhan.Engine._confirmRelicSelect = function() {
  var st = this.state;
  if (!st) return;
  st.activeRelics = st.activeRelics || [];
  if (st.mode === CONFIG.MODE_TOWER) {
    // 猫王塔：单选1个
    if (!st.selectedRelic) return;
    st.activeRelics.push(st.selectedRelic);
    log('🎁 获得圣物：' + (RELICS[st.selectedRelic] ? RELICS[st.selectedRelic].name + ' — ' + RELICS[st.selectedRelic].desc : st.selectedRelic));
    Zhan.Events.emit('relicGained', { relicId: st.selectedRelic, relicName: RELICS[st.selectedRelic] ? RELICS[st.selectedRelic].name : st.selectedRelic });
    st.towerRelicCount = (st.towerRelicCount || 0) + 1;
    // 进入下一层猫王塔
    Zhan.Engine._startTowerNextCat();
  } else if (st.mode === CONFIG.MODE_MAZE) {
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
  var mode = st.mode || CONFIG.MODE_NORMAL;

  if (mode === CONFIG.MODE_ADVENTURE) {
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

// ========== 过渡别名：window.G 向后兼容 ==========
Object.defineProperty(window, 'G', {
  get: function() { return Zhan.Engine.state; },
  configurable: true
});

