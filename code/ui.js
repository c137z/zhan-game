// ============================================================
//  斩 v14 — ui.js
//  渲染函数 + DOM 事件（UI重构 v1）
//  依赖 data.js / core.js（先加载）
// ============================================================

if (!window.Zhan) window.Zhan = {};

// ========== 渲染主函数 ==========
Zhan.UI = {};

// ========== 视图切换 ==========
Zhan.UI._showView = function(viewId) {
  var views = ['main-menu', 'stage-select', 'battle-view'];
  for (var i = 0; i < views.length; i++) {
    var el = document.getElementById(views[i]);
    if (el) el.style.display = (views[i] === viewId) ? ((views[i] === 'main-menu' || views[i] === 'battle-view') ? 'flex' : 'block') : 'none';
  }
};

// ========== 首页渲染 ==========
Zhan.UI.renderMainMenu = function() {
  document.getElementById('result-overlay').classList.remove('show');
  document.getElementById('settings-panel').classList.remove('show');
  Zhan.UI._showView('main-menu');
  document.getElementById('menu-catmao').textContent = '🐱 猫毛：' + Zhan.Save.get('catMao');
  document.getElementById('menu-best').textContent = '今日最佳：' + Zhan.Save.get('towerBestFloor') + '层';
};

// ========== 关卡选择 5x5 网格 ==========
Zhan.UI.renderStageSelect = function() {
  Zhan.UI._showView('stage-select');
  // 50关支持滚动
  if (!document.getElementById('stage-scroll-style')) {
    var ss = document.createElement('style');
    ss.id = 'stage-scroll-style';
    ss.textContent = '#stage-select { max-height: 85vh; overflow-y: auto; }';
    document.head.appendChild(ss);
  }
  var grid = document.getElementById('stage-grid');
  grid.innerHTML = '';
  var unlocked = ADVENTURE_STAGES.length; // 全部解锁
  var currentStage = (Zhan.Engine.state && Zhan.Engine.state.adventureStageId) || 1;
  for (var i = 0; i < ADVENTURE_STAGES.length; i++) {
    var stage = ADVENTURE_STAGES[i];
    var cell = document.createElement('div');
    cell.className = 'stage-cell';
    if (i + 1 <= unlocked) {
      cell.classList.add('unlocked');
      if (i + 1 === currentStage) cell.classList.add('current');
    } else {
      cell.classList.add('locked');
    }
    cell.innerHTML = '<div class="stage-cell-num">' + stage.id + '</div>' +
      '<div class="stage-cell-emoji">' + (stage.emoji || '?') + '</div>' +
      '<div class="stage-cell-name">' + stage.name + '</div>';
    if (i + 1 <= unlocked) {
      (function(stageId) {
        cell.addEventListener('click', function() {
          if (Zhan.Engine._startAdventure) {
            Zhan.Engine._startAdventure(stageId);
          } else {
            var st = Zhan.Engine.state || {};
            st.bossId = stage.bossId;
            st.mode = CONFIG.MODE_ADVENTURE;
            st.adventureStageId = stageId;
            st.activeRelics = [];
            Zhan.Engine.state = st;
            newGame();
          }
        });
      })(stage.id);
    }
    grid.appendChild(cell);
  }
};

// ========== 战斗界面渲染 ==========
Zhan.UI.render = function(state) {
  var st = state || Zhan.Engine.state;
  if (!st) return;

  // 角色基础数据（放到 stats-line 中一起渲染）
  var pNameEl = document.getElementById('player-name');
  if (pNameEl) pNameEl.textContent = CONFIG.PLAYER_DEFAULT_NAME;
  var nameEl = document.getElementById('enemy-name');
  if (nameEl) nameEl.textContent = st.boss.name || CONFIG.BOSS_DEFAULT_NAME;

  // 角色头像
  var playerAvatar = document.getElementById('player-avatar');
  var bossAvatar = document.getElementById('boss-avatar');
  // 检测是否有圣物改变头像
  var playerEmoji = CONFIG.PLAYER_DEFAULT_EMOJI;
  playerAvatar.textContent = playerEmoji;
  bossAvatar.textContent = st.boss.emoji || CONFIG.BOSS_DEFAULT_EMOJI;

  // 血量条
  var hpPct = Math.max(0, st.playerHP / st.playerMaxHP * 100);
  var playerHpBar = document.getElementById('player-hp-bar-inner');
  if (playerHpBar) playerHpBar.style.width = hpPct + '%';
  var enemyHpPct = Math.max(0, st.enemyHP / st.enemyMaxHP * 100);
  var enemyHpBar = document.getElementById('enemy-hp-bar-inner');
  if (enemyHpBar) enemyHpBar.style.width = enemyHpPct + '%';

  // 元气弹进度（竖向）
  var totalCards = 0;
  for (var k in st.deckConfig) totalCards += st.deckConfig[k];
  var remaining = 0;
  var fp = flatten(st.piles);
  for (var i = 0; i < fp.length; i++) remaining += fp[i].length;
  remaining += st.slot.length;
  var consumed = totalCards - remaining;
  var spiritPct = Math.floor(consumed / totalCards * 100);
  var spiritInner = document.getElementById('spirit-bar-inner');
  if (spiritInner) spiritInner.style.height = spiritPct + '%';
  var spiritText = document.getElementById('spirit-text');
  if (spiritText) spiritText.textContent = spiritPct + '%';

  // 玩家状态（HP/护盾 + buff 图标×回合数）
  var pe = st.playerEffects;
  var pStatsHtml = '❤️' + st.playerHP + ' 🛡️' + st.playerShield;
  if ((pe.atk_buff || 0) > 0) {
    pStatsHtml += ' <span class="stat-buff">⚡×' + pe.atk_buff + 'T</span>';
  }
  if ((pe.def_buff || 0) > 0) {
    pStatsHtml += ' <span class="stat-buff">💨×' + pe.def_buff + 'T</span>';
  }
  document.getElementById('player-stats-line').innerHTML = pStatsHtml;

  // 敌人状态（HP/护盾/能力值 + debuff 图标×回合数）
  var ee = st.enemyEffects;
  var eStatsHtml = '❤️' + st.enemyHP + ' 🛡️' + st.enemyShield + ' ⚡' + (st.power || 0);
  if ((ee.stun || 0) > 0) eStatsHtml += ' <span class="stat-debuff">💫×' + ee.stun + 'T</span>';
  if ((ee.vulnerable || 0) > 0) {
    eStatsHtml += ' <span class="stat-debuff">💔×' + ee.vulnerable + 'T</span>';
  }
  if ((ee.atk_down || 0) > 0) eStatsHtml += ' <span class="stat-debuff">⬇×' + ee.atk_down + 'T</span>';
  document.getElementById('enemy-stats-line').innerHTML = eStatsHtml;

  // Boss 背景立绘已移除

  // 渲染子组件
  Zhan.UI.renderBoard(st);
  Zhan.UI.renderCardCount(st);
  Zhan.UI.renderSlot(st);
  Zhan.UI.renderActionButtons(st);
  // 战斗日志自动刷新
  var logPanel = document.getElementById('log-panel');
  if (logPanel && logPanel.classList.contains('show')) {
    Zhan.UI.renderLog();
  }
};

// Legacy render for backward compat
function render() { Zhan.UI.render(Zhan.Engine.state); }

// ========== 牌堆渲染（不变） ==========
Zhan.UI.renderBoard = function(state) {
  var st = state;
  var board = document.getElementById('board');
  board.innerHTML = '';
  var flatPiles = flatten(st.piles);
  for (var r = 0; r < CONFIG.BOARD_ROWS; r++) {
    for (var c = 0; c < CONFIG.BOARD_COLS; c++) {
      (function(r, c) {
        var pile = st.piles[r][c];
        var top = Zhan.Engine._getTop(r * CONFIG.BOARD_COLS + c);
        var div = document.createElement('div');
        div.className = 'card-slot';
        var flatIdx = r * CONFIG.BOARD_COLS + c;

        // 锁定检查
        if (st.lockedPiles && st.lockedPiles[flatIdx]) div.classList.add('locked');

        if (!top) { div.classList.add('card-empty'); board.appendChild(div); return; }

        // 涂抹检查
        var ct;
        var isSmeared = st.smearedPiles && st.smearedPiles[flatIdx];
        if (isSmeared) {
          ct = { emoji: '❓', label: '??', cssClass: 'card-junk' };
        } else {
          ct = CARD_TYPES[top.type] || { emoji: '⬜', label: '废牌', cssClass: 'card-junk' };
        }
        var isSpecial = top.special && top.special.color === 'white';
        if (isSpecial) {
          ct = { emoji: top.special.emoji, label: top.special.label, cssClass: ct.cssClass };
        }
        var inner = document.createElement('div');
        inner.className = 'card ' + ct.cssClass;
        if (isSpecial) {
          inner.style.background = '#fff';
          inner.style.color = '#333';
          inner.style.border = '1px solid #ddd';
        }
        if (isSmeared) {
          inner.style.background = '#555';
          inner.style.color = '#ccc';
          inner.style.border = '1px solid #666';
        }
        div.appendChild(inner);

        if (pile.length > 1) {
          var sc = document.createElement('div');
          sc.className = 'stack-count';
          sc.textContent = pile.length;
          div.appendChild(sc);
        }

        // 双击进槽（click） + 下滑进槽（touchmove）
        var lastTap = 0;
        var touchStartY = 0, touchStartX = 0, swiping = false;
        div.addEventListener('touchstart', function(e) {
          touchStartY = e.touches[0].clientY; touchStartX = e.touches[0].clientX;
          swiping = false;
        }, {passive: true});
        div.addEventListener('touchmove', function(e) {
          var st = Zhan.Engine.state;
          if (!st || st.phase !== CONFIG.PHASE_PLAYER || st.over) return;
          var dy = e.touches[0].clientY - touchStartY;
          var dx = Math.abs(e.touches[0].clientX - touchStartX);
          if (-dy > CONFIG.SWIPE_THRESHOLD && -dy > dx * 1.5) {
            e.preventDefault();
            if (!swiping && st.piles[r][c] && st.piles[r][c].length) {
              swiping = true;
              Zhan.Engine.dispatch({ type: 'PLAY_CARD', r: r, c: c });
            }
          }
        }, {passive: false});
        div.addEventListener('click', function(e) {
          var st = Zhan.Engine.state;
          if (!st || st.phase !== CONFIG.PHASE_PLAYER || st.over) return;
          var now = Date.now();
          if (now - lastTap < CONFIG.DOUBLE_TAP_DELAY) {
            e.preventDefault();
            Zhan.Engine.dispatch({ type: 'PLAY_CARD', r: r, c: c });
            lastTap = 0;
            return;
          }
          lastTap = now;
          if (st.piles[r][c] && st.piles[r][c].length) {
            div.classList.add('double-tap-active');
            setTimeout(function() { div.classList.remove('double-tap-active'); }, 200);
          }
        });

        board.appendChild(div);
      })(r, c);
    }
  }
};

Zhan.UI.renderSlot = function(state) {
  var st = state;
  var bar = document.getElementById('slot-bar');
  bar.innerHTML = '';
  var effectiveSize = st.effectiveSlotSize || CONFIG.SLOT_SIZE;
  var wildCoreIdx = -1;
  if (st.wildCoreSlot) {
    wildCoreIdx = 0;
    while (wildCoreIdx < effectiveSize && st.lockedSlots && st.lockedSlots[wildCoreIdx]) wildCoreIdx++;
  }
  for (var i = 0; i < effectiveSize; i++) {
    var div = document.createElement('div');
    div.className = 'eslot';
    if (st.wildCoreSlot && i === wildCoreIdx) {
      div.classList.add('filled', 'wild-core');
      div.textContent = '💎';
      var wcLabel = document.createElement('span');
      wcLabel.className = 'wild-core-label';
      wcLabel.textContent = '万能';
      div.appendChild(wcLabel);
    } else if (st.lockedSlots && st.lockedSlots[i]) {
      div.classList.add('locked');
      div.textContent = '✕';
    } else if (i < st.slot.length && st.slot[i] !== null) {
      var card = st.slot[i];
      if (card.special) {
        div.classList.add('filled', 'special');
        div.style.background = '#fff';
        div.style.color = '#333';
        div.textContent = card.special.emoji;
      } else {
        var ct = CARD_TYPES[card.type] || { emoji: '⬜', color: 'junk' };
        div.classList.add('filled', ct.color);
        var artworkSlotTypes = ['attack','defend','heal','wild','atk_down','vulnerable','stun','atk_buff','def_buff','junk'];
        if (artworkSlotTypes.indexOf(card.type) === -1) {
          div.textContent = ct.emoji;
        }
      }
    }
    bar.appendChild(div);
  }
};

// ========== 卡牌数量显示 ==========
Zhan.UI.renderCardCount = function(state) {
  var st = state;
  var el = document.getElementById('card-count');
  if (!el) return;
  var total = 0;
  var flatPiles = flatten(st.piles);
  for (var i = 0; i < flatPiles.length; i++) total += flatPiles[i].length;
  var html = '🃏 剩余 ' + total + ' 张';
  // 猫毛商店：卡牌统计
  if (Zhan.Save.hasPurchase('card_stats')) {
    var types = ['attack','defend','heal','atk_buff','def_buff','vulnerable','stun','atk_down','junk'];
    for (var ti = 0; ti < types.length; ti++) {
      var ct = CARD_TYPES[types[ti]];
      var count = 0;
      for (var fi = 0; fi < flatPiles.length; fi++) {
        for (var ci = 0; ci < flatPiles[fi].length; ci++) {
          if (flatPiles[fi][ci].type === types[ti]) count++;
        }
      }
      for (var si = 0; si < st.slot.length; si++) {
        var resolved = Zhan.Rules.resolveWildType(st.slot, si);
        if (resolved === types[ti]) count++;
      }
      if (count > 0) html += ' <span style="margin:0 2px;">' + ct.emoji + '×' + count + '</span>';
    }
  }
  el.innerHTML = html;
};

// ========== 战斗日志渲染 ==========
Zhan.UI.renderLog = function() {
  var panel = document.getElementById('log-panel');
  if (!panel) return;
  var content = document.getElementById('log-panel-content');
  if (!content) return;
  var st = Zhan.Engine && Zhan.Engine.state;
  var lines = (st && st.logLines) || [];
  if (lines.length === 0) {
    content.innerHTML = '<div class="log-entry log-info">暂无战斗日志</div>';
    return;
  }
  var isDetail = document.getElementById('cb-log-detail') && document.getElementById('cb-log-detail').checked;
  var html = '';
  for (var i = Math.max(0, lines.length - 120); i < lines.length; i++) {
    var line = lines[i];
    // 兼容旧格式字符串
    if (typeof line === 'string') { html += '<div class="log-entry">' + line + '</div>'; continue; }

    switch (line.type) {
      case 'turnHeader':
        html += '<div class="log-entry log-turn">' + line.text + '</div>';
        break;
      case 'turnFooter':
        html += '<div class="log-entry log-turn-end">' + line.text + '</div>';
        break;
      case 'cardsRow':
        html += '<div class="log-entry log-cards">🃏 ';
        for (var ci = 0; ci < line.cards.length && ci < 10; ci++) {
          var ct = CARD_TYPES[line.cards[ci]] || { emoji: '⬜' };
          html += ct.emoji;
        }
        html += '</div>';
        break;
      case 'buffsRow':
        if (line.buffs.length > 0) {
          html += '<div class="log-entry log-buffs">📊 ';
          for (var bi = 0; bi < line.buffs.length; bi++) {
            html += '<span style="color:' + line.buffs[bi].color + '">' + line.buffs[bi].name + line.buffs[bi].value + '</span>  ';
          }
          html += '</div>';
        }
        break;
      case 'separator':
        html += '<div class="log-entry log-separator">' + line.text + '</div>';
        break;
      case 'action':
        html += '<div class="log-entry log-action">';
        if (isDetail && line.formulaParts) {
          // 详情模式：显示公式
          var actionLabels = { attack: '🗡 攻击', defend: '🛡 防御', heal: '❤️ 治疗', stun: '💫 击晕', focus: '蓄力', crit: '🗡 暴击' };
          var enemyLabels = { attack: '🐱 Boss 攻击', defend: '🐱 Boss 防御', stun: '🐱 Boss 被击晕', focus: '🐱 Boss 蓄力', crit: '🐱 Boss 暴怒' };
          var actionUnits = { attack: ' 点伤害', defend: ' 点护盾', heal: ' 点生命', stun: '', focus: '' };
          var label = line.side === 'enemy' ? (enemyLabels[line.action] || '🐱 Boss 行动') : (actionLabels[line.action] || '行动');
          var unit = actionUnits[line.action] || '';
          html += '<div style="font-weight:bold;color:#fff;">' + label + '</div>';
          html += '<div class="log-formula">  = ';
          for (var fi = 0; fi < line.formulaParts.length; fi++) {
            html += '<span style="color:' + line.formulaParts[fi].color + '">' + line.formulaParts[fi].text + '</span>';
          }
          html += '</div>';
          html += '<div class="log-result">  = ' + line.finalValue + unit + '</div>';
          if (line.detail) html += '<div class="log-detail">  ' + line.detail + '</div>';
        } else {
          // 精简模式：只显示 text
          html += line.text;
        }
        html += '</div>';
        break;
      case 'turnFooter':
        html += '<div class="log-entry log-turn-end">' + line.text + '</div>';
        break;
      default:
        html += '<div class="log-entry">' + (line.text || '') + '</div>';
    }
  }
  content.innerHTML = html;
  content.scrollTop = content.scrollHeight;
};

// ========== 日志 — 详情切换 + 面板自动刷新 ==========
(function() {
  var cbDetail = document.getElementById('cb-log-detail');
  if (cbDetail) {
    cbDetail.addEventListener('change', function() {
      if (document.getElementById('log-panel').classList.contains('show')) Zhan.UI.renderLog();
    });
  }

  // 事件触发时自动刷新面板
  var refreshEvents = ['turnStart','turnEnd','damageDealt','damageTaken','comboResolved','battleStart','enemyDeath','playerDeath'];
  for (var ri = 0; ri < refreshEvents.length; ri++) {
    Zhan.Events.on(refreshEvents[ri], function() {
      var panel = document.getElementById('log-panel');
      if (panel && panel.classList.contains('show')) Zhan.UI.renderLog();
    });
  }
})();

// ========== 按钮状态渲染 ==========
Zhan.UI.renderActionButtons = function(state) {
  var st = state;
  if (!st) return;

  // 结束回合按钮
  var btnEnd = document.getElementById('btn-end-turn');
  if (btnEnd) {
    if (st.phase === CONFIG.PHASE_PLAYER && !st.over && st.slot.length > 0) btnEnd.disabled = false;
    else btnEnd.disabled = true;
  }

  // 移出卡牌按钮（全部移出）
  var btnRemove = document.getElementById('btn-remove-card');
  if (btnRemove) {
    var canRemove = st.phase === CONFIG.PHASE_PLAYER && !st.over && st.slot.length > 0 && (st.removeUsed || 0) < 1;
    btnRemove.disabled = !canRemove;
    var countEl = document.getElementById('remove-count');
    if (countEl) countEl.textContent = '(' + (st.removeUsed || 0) + '/1)';
  }

  // 洗牌按钮
  var btnShuffle = document.getElementById('btn-shuffle');
  if (btnShuffle) {
    var canShuffle = st.phase === CONFIG.PHASE_PLAYER && !st.over && (st.shuffleUsed || 0) < 1;
    btnShuffle.disabled = !canShuffle;
    var countEl2 = document.getElementById('shuffle-count');
    if (countEl2) countEl2.textContent = '(' + (st.shuffleUsed || 0) + '/1)';
  }
};

// ========== 连击预览 ==========
Zhan.UI.updateComboPreview = function(state) {
  var st = state || Zhan.Engine.state;
  if (!st) return;
  var combos = Zhan.Rules.computeCombos(st.slot, st.effectiveMinCombo || CONFIG.MIN_COMBO);
  var el = document.getElementById('combo-bar');
  if (!el) return;
  if (!combos.length && !st.slot.length) { el.innerHTML = ''; return; }

  var slotTypeCount = {};
  for (var si = 0; si < st.slot.length; si++) {
    var cardType = Zhan.Rules.resolveWildType(st.slot, si);
    if (!BUFF_TYPES[cardType] && cardType !== 'junk') {
      if (!slotTypeCount[cardType]) slotTypeCount[cardType] = 0;
      slotTypeCount[cardType]++;
    }
  }

  var actionMaxLen = {};
  for (var ci = 0; ci < combos.length; ci++) {
    var c = combos[ci];
    if (BUFF_TYPES[c.type]) continue;
    if (!actionMaxLen[c.type] || c.n > actionMaxLen[c.type]) {
      actionMaxLen[c.type] = c.n;
    }
  }

  // 先刷新 fury，让 buff 倍率反映当前 HP
  Zhan.Engine._updateEffectiveFury(st);

  var previewParts = [];
  var ACTION_TYPES = ['attack', 'defend', 'heal'];
  for (var ai = 0; ai < ACTION_TYPES.length; ai++) {
    var at = ACTION_TYPES[ai];
    if (!slotTypeCount[at] || slotTypeCount[at] < (st.effectiveMinCombo || CONFIG.MIN_COMBO)) continue;
    var total = slotTypeCount[at];
    var maxLen = actionMaxLen[at] || 0;
    var mc = st.effectiveMinCombo || CONFIG.MIN_COMBO;
    var baseVal = Zhan.Rules.calcBaseValue(total, mc);
    var val = at === 'attack' ? Zhan.Rules.calcAttackValue(total, maxLen, mc) : (at === 'defend' ? Zhan.Rules.calcDefendValue(total, maxLen, mc) : Zhan.Rules.calcHealValue(total, maxLen, mc));
    // 攻击受暴击/破甲加成（与回合结束结算一致）
    if (at === 'attack' && val > 0) {
      val = Zhan.Rules.applyStatusEffects('attack', val, { atkBuffMult: st.effectiveAtkBuffMult, vulnMult: st.effectiveVulnMult, defBuffRatio: st.defBuffRatio });
    }
    var emoji = CARD_TYPES[at].emoji;
    var html = '<span class="combo-preview ' + at + '">' + emoji + '×' + total + '→' + val + '</span>';
    previewParts.push(html);
  }

  for (var ci2 = 0; ci2 < combos.length; ci2++) {
    var c2 = combos[ci2];
    if (!BUFF_TYPES[c2.type]) continue;
    var desc = Zhan.Rules.getEffectDescription(st, c2.type, c2.n);
    previewParts.push('<span class="combo-preview ' + c2.type + '">' + CARD_TYPES[c2.type].emoji + c2.n + '连→' + desc + '</span>');
  }

  var activeComboTypes = [];
  for (var _cbi2 = 0; _cbi2 < combos.length; _cbi2++) {
    if (BUFF_TYPES[combos[_cbi2].type]) activeComboTypes.push(combos[_cbi2].type);
  }
  var penaltyResult = Zhan.Rules.computeUnmatchedPenalty({
    slot: st.slot,
    _claimedWildIndices: combos._claimedWildIndices,
    effectiveMinCombo: st.effectiveMinCombo,
    activeComboTypes: activeComboTypes
  });
  for (var ut in penaltyResult.unmatchedByType) {
    if (penaltyResult.unmatchedByType[ut] >= (st.effectiveMinCombo || CONFIG.MIN_COMBO)) continue;
    var uct = CARD_TYPES[ut] || { emoji: '⬜' };
    previewParts.push('<span class="combo-none">' + uct.emoji + '×' + penaltyResult.unmatchedByType[ut] + '→❤-' + penaltyResult.unmatchedByType[ut] + '</span>');
  }

  el.innerHTML = previewParts.length ? previewParts.join(' ') : '<span class="combo-none">⚪ 未形成连击</span>';
};

// Legacy compat
function updateComboPreview() { Zhan.UI.updateComboPreview(Zhan.Engine.state); }

// ========== 伤害数字弹出 ==========
Zhan.UI.showDamageNumbers = function(dmg, x, y) {
  var container = document.getElementById('damage-numbers');
  if (!container) return;
  var el = document.createElement('div');
  el.className = 'dmg-float';
  if (dmg < 20) {
    el.classList.add('dmg-float-small');
  } else if (dmg < 40) {
    el.classList.add('dmg-float-medium');
  } else {
    el.classList.add('dmg-float-large');
  }
  el.textContent = '-' + dmg;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  container.appendChild(el);
  setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 1000);
};

// ========== 结算面板 ==========
Zhan.UI.renderStatsPanel = function(state) {
  var st = state;
  var panel = document.getElementById('stats-panel');
  if (!panel) return;

  var relicNames = st.activeRelicNames || [];
  var relicsHtml = '';
  if (relicNames.length) {
    relicsHtml = '<div class="stat-row-item"><span class="stat-label">🏆 圣物</span><span class="stat-value">' + relicNames.join(', ') + '</span></div>';
  }

  var totalDeck = 0;
  for (var k in st.deckConfig) totalDeck += st.deckConfig[k];
  var remaining = 0;
  var fp = flatten(st.piles);
  for (var fi = 0; fi < fp.length; fi++) remaining += fp[fi].length;
  var consumed = totalDeck - remaining;

  panel.innerHTML =
    '<div class="stats-card">' +
      '<div class="stat-row-item"><span class="stat-label">⏱ 存活回合</span><span class="stat-value">' + (st.turn + 1) + '</span></div>' +
      '<div class="stat-row-item"><span class="stat-label">❤️ 剩余HP</span><span class="stat-value">' + st.playerHP + ' / ' + st.playerMaxHP + '</span></div>' +
      '<div class="stat-row-item"><span class="stat-label">💥 最高单次伤害</span><span class="stat-value">' + st.maxDamage + '</span></div>' +
      '<div class="stat-row-item"><span class="stat-label">🔥 最高连击</span><span class="stat-value">' + st.maxCombo + ' 连</span></div>' +
      '<div class="stat-row-item"><span class="stat-label">⚔️ 总伤害输出</span><span class="stat-value">' + st.totalDamage + '</span></div>' +
      '<div class="stat-row-item"><span class="stat-label">🃏 消耗卡牌数</span><span class="stat-value">' + consumed + ' / ' + totalDeck + '</span></div>' +
      '<div class="stat-row-item"><span class="stat-label">🎲 种子</span><span class="stat-value">' + (st.battleSeed || 'N/A') + '</span></div>' +
      relicsHtml +
    '</div>';
};

// Legacy compat
function renderStatsPanel(G) { Zhan.UI.renderStatsPanel(G); }

// ========== 结算面板显示 ==========
Zhan.UI.showResult = function(state) {
  var st = state;
  if (!st) return;
  Zhan.UI.renderStatsPanel(st);
  document.getElementById('result-title').textContent = st._resultTitle || '';
  document.getElementById('result-desc').textContent = st._resultDesc || '';

  document.getElementById('btn-restart').style.display = 'none';
  document.getElementById('btn-endless').style.display = 'none';
  document.getElementById('btn-adv-continue').style.display = 'none';
  document.getElementById('btn-return-home').style.display = 'none';

  if (st.mode === CONFIG.MODE_ADVENTURE) {
    Zhan.UI.showResultAdventure(st);
  } else if (st.mode === CONFIG.MODE_MAZE) {
    Zhan.UI.showResultMaze(st);
  } else if (st.mode === CONFIG.MODE_TOWER) {
    Zhan.UI.showResultTower(st);
  } else {
    document.getElementById('btn-restart').style.display = '';
    document.getElementById('btn-restart').textContent = st._restartText || '🔄 再来一局';
    if (st._showEndlessBtn) {
      document.getElementById('btn-endless').style.display = '';
    }
    document.getElementById('btn-return-home').textContent = '🏠 返回主页';
    document.getElementById('btn-return-home').style.display = '';
  }

  document.getElementById('result-overlay').classList.add('show');
};

Zhan.UI.showResultAdventure = function(st) {
  if (st.win) {
    document.getElementById('btn-adv-continue').textContent = '🏁 继续闯关';
    document.getElementById('btn-adv-continue').style.display = '';
  } else {
    document.getElementById('btn-restart').textContent = '🔄 重试';
    document.getElementById('btn-restart').style.display = '';
  }
  document.getElementById('btn-return-home').textContent = '🏠 返回主页';
  document.getElementById('btn-return-home').style.display = '';
};

Zhan.UI.showResultMaze = function(st) {
  if (st.win) {
    document.getElementById('btn-restart').textContent = '🔄 再次挑战';
    document.getElementById('btn-restart').style.display = '';
    document.getElementById('btn-return-home').textContent = '🏠 返回主页';
    document.getElementById('btn-return-home').style.display = '';
  } else {
    document.getElementById('btn-restart').textContent = '🔄 重新挑战';
    document.getElementById('btn-restart').style.display = '';
    document.getElementById('btn-return-home').textContent = '🏠 返回主页';
    document.getElementById('btn-return-home').style.display = '';
  }
};

Zhan.UI.showResultTower = function(st) {
  var floor = st.towerFloor || 1;
  if (st.win) {
    document.getElementById('result-desc').textContent = '全猫征服！到达第 ' + floor + ' 层';
  } else {
    document.getElementById('result-desc').textContent = '败于第 ' + floor + ' 层';
    document.getElementById('btn-restart').textContent = '🔄 重新挑战';
    document.getElementById('btn-restart').style.display = '';
  }
  document.getElementById('btn-return-home').textContent = '🏠 返回主页';
  document.getElementById('btn-return-home').style.display = '';
};

// ========== 敌人意图渲染 ==========
Zhan.UI.renderEnemyIntent = function(state) {
  var st = state;
  if (!st) return;
  var el = document.getElementById('enemy-intent');
  if (!el) return;
  el.innerHTML = (st._intentHTML || '') + (st._intentExtraHTML || '');
};

// ========== 圣物选择渲染 ==========
Zhan.UI.renderRelicSelect = function(state) {
  var st = state;
  if (!st) return;

  if (!this._relicSelectStyleInjected) {
    this._relicSelectStyleInjected = true;
    var styleEl = document.createElement('style');
    styleEl.textContent = '.relic-card.selected { border-color: #f1c40f !important; box-shadow: 0 0 10px rgba(241,196,15,0.5); }';
    document.head.appendChild(styleEl);
  }

  var isTower = st.mode === CONFIG.MODE_TOWER;

  var optionsEl = document.getElementById('relic-select-options');
  optionsEl.innerHTML = '';
  var opts = st.relicOptions || [];
  for (var oi = 0; oi < opts.length; oi++) {
    var relic = RELICS[opts[oi]];
    var card = document.createElement('div');
    card.className = 'relic-card';
    if (isTower && st.selectedRelic === opts[oi]) {
      card.classList.add('selected');
    }
    card.id = 'relic-opt-' + oi;
    card.innerHTML = '<div class="relic-name">' + relic.name + '</div>' +
      '<div class="relic-type">' + relic.type + '</div>' +
      '<div class="relic-desc">' + relic.desc + '</div>';
    optionsEl.appendChild(card);
  }

  var maxRerolls = 1 + (Zhan.Save.hasPurchase('extra_reroll') ? 1 : 0);
  var rerolls = st.relicRerolls || 0;
  var canReroll = rerolls < maxRerolls;
  if (isTower) {
    document.getElementById('relic-select-desc').textContent =
      '点击选中1个圣物' + (canReroll ? '（可刷新' + (maxRerolls - rerolls) + '次）' : '');
  } else {
    document.getElementById('relic-select-desc').textContent =
      '第二关通过！获得圣物' + (canReroll ? '（可刷新' + (maxRerolls - rerolls) + '次）' : '');
  }

  var btnReroll = document.getElementById('btn-relic-reroll');
  if (!canReroll) {
    btnReroll.disabled = true;
    btnReroll.style.opacity = '0.4';
    btnReroll.textContent = '🔄 刷新（已用完）';
  } else {
    btnReroll.disabled = false;
    btnReroll.style.opacity = '1';
    btnReroll.textContent = '🔄 刷新';
  }

  var btnConfirm = document.getElementById('btn-relic-confirm');
  if (isTower) {
    btnConfirm.textContent = st.selectedRelic ? '✅ 确认选择' : '✅ 请先点击选择圣物';
    btnConfirm.disabled = !st.selectedRelic;
    btnConfirm.style.opacity = st.selectedRelic ? '1' : '0.4';
  } else {
    btnConfirm.textContent = '✅ 确认（全拿）';
    btnConfirm.disabled = false;
    btnConfirm.style.opacity = '1';
  }

  document.getElementById('relic-select-overlay').classList.add('show');
};

// ========== 事件绑定 ==========
document.getElementById('btn-end-turn').addEventListener('click', function() {
  Zhan.Engine.dispatch({ type: 'END_TURN' });
});

document.getElementById('btn-remove-card').addEventListener('click', function() {
  Zhan.Engine.dispatch({ type: 'REMOVE_CARD' });
});

document.getElementById('btn-shuffle').addEventListener('click', function() {
  Zhan.Engine.dispatch({ type: 'SHUFFLE' });
});

document.getElementById('btn-restart').addEventListener('click', function() {
  document.getElementById('result-overlay').classList.remove('show');
  if (Zhan.Engine._retry) {
    Zhan.Engine._retry();
  } else {
    Zhan.Engine.dispatch({ type: 'RESTART' });
  }
});

document.getElementById('btn-endless').addEventListener('click', function() {
  document.getElementById('result-overlay').classList.remove('show');
  Zhan.Engine.dispatch({ type: 'START_ENDLESS' });
});

// 冒险继续闯关
var _advContinueBtn = document.getElementById('btn-adv-continue');
if (_advContinueBtn) {
  _advContinueBtn.addEventListener('click', function() {
    document.getElementById('result-overlay').classList.remove('show');
    Zhan.Engine.dispatch({ type: 'ADV_CONTINUE' });
  });
}

// 返回主页
var _returnHomeBtn = document.getElementById('btn-return-home');
if (_returnHomeBtn) {
  _returnHomeBtn.addEventListener('click', function() {
    document.getElementById('result-overlay').classList.remove('show');
    Zhan.Engine.dispatch({ type: 'GO_HOME' });
  });
}

// ========== LOG（已弃用——保留空函数避免引用报错） ==========
function log(msg) {
  // LOG 已移除 — 调试日志不再需要
}

// ========== Boss 描述弹窗（点击头像） ==========
(function() {
  var bossInfoOverlay = document.getElementById('boss-info-overlay');
  var bossAvatar = document.getElementById('boss-avatar');
  if (bossAvatar) {
    bossAvatar.addEventListener('click', function() {
      var st = Zhan.Engine.state;
      if (!st || !st.boss) return;
      var boss = st.boss;
      document.getElementById('boss-info-emoji').textContent = boss.emoji || ASSETS.BOSS_DEFAULT;
      document.getElementById('boss-info-name').textContent = boss.name || '毛线团';
      document.getElementById('boss-info-mechanic').textContent = boss.desc || '没有描述';
      var stats = 'HP: ' + st.enemyMaxHP + ' | ATK: ' + (boss.baseAtk || 0) + ' | Growth: ' + (boss.powerGrowth || 0);
      document.getElementById('boss-info-stats').textContent = stats;
      bossInfoOverlay.style.display = 'flex';
    });
  }
  document.getElementById('btn-boss-info-close').addEventListener('click', function() {
    bossInfoOverlay.style.display = 'none';
  });
})();

// 玩家头像点击（圣物详情）
(function() {
  var playerOverlay = document.getElementById('player-info-overlay');
  var playerAvatar = document.getElementById('player-avatar');
  if (playerAvatar) {
    playerAvatar.addEventListener('click', function() {
      var st = Zhan.Engine.state;
      if (!st) return;
      var relicNames = st.activeRelicNames || [];
      var mechanic = relicNames.length ? '圣物：' + relicNames.join(', ') : '没有圣物';
      document.getElementById('player-info-mechanic').textContent = mechanic;
      var stats = 'HP: ' + st.playerHP + '/' + st.playerMaxHP + ' | 盾: ' + st.playerShield;
      var abm = st.effectiveAtkBuffMult || 0;
      if (abm > 0) stats += ' | 暴击: ×' + parseFloat(abm.toFixed(1));
      document.getElementById('player-info-stats').textContent = stats;
      playerOverlay.style.display = 'flex';
    });
  }
  document.getElementById('btn-player-info-close').addEventListener('click', function() {
    playerOverlay.style.display = 'none';
  });
})();

// 圣物刷新按钮
(function() {
  var btn = document.getElementById('btn-relic-reroll');
  if (btn) {
    btn.addEventListener('click', function() {
      var st = Zhan.Engine.state;
      if (!st) return;
      Zhan.Engine._rerollRelics();
      Zhan.UI.renderRelicSelect(st);
    });
  }
})();

// 圣物确认按钮
(function() {
  var btn = document.getElementById('btn-relic-confirm');
  if (btn) {
    btn.addEventListener('click', function() {
      document.getElementById('relic-select-overlay').classList.remove('show');
      Zhan.Engine._confirmRelicSelect();
    });
  }
})();

// 圣物卡片点击 — 猫王塔模式
(function() {
  var optionsEl = document.getElementById('relic-select-options');
  if (optionsEl) {
    optionsEl.addEventListener('click', function(e) {
      var card = e.target.closest('.relic-card');
      if (!card) return;
      var st = Zhan.Engine.state;
      if (!st || st.mode !== CONFIG.MODE_TOWER) return;
      var idx = parseInt(card.id.replace('relic-opt-', ''), 10);
      if (!isNaN(idx)) Zhan.Engine._selectRelicOption(idx);
    });
  }
})();

// ========== 首页导航 ==========
document.getElementById('btn-adventure').addEventListener('click', function() {
  Zhan.UI.renderStageSelect();
});
document.getElementById('btn-maze').addEventListener('click', function() {
  Zhan.Engine._startMaze();
});
document.getElementById('btn-tower').addEventListener('click', function() {
  Zhan.Engine._startTower();
});
document.getElementById('btn-back-menu').addEventListener('click', function() {
  Zhan.UI.renderMainMenu();
});

// ========== 首页图标占位 ==========
(function() {
  var wipItems = [
    { id: 'icon-daily', title: '每日悬赏' },
    { id: 'icon-pedia', title: '图鉴' },
    { id: 'icon-achieve', title: '成就' },
    { id: 'icon-leaderboard', title: '好友排行' },
    { id: 'icon-map', title: '猫王地图' }
  ];
  for (var wi = 0; wi < wipItems.length; wi++) {
    (function(item) {
      var el = document.getElementById(item.id);
      if (el) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', function() {
          document.getElementById('wip-title').textContent = item.title;
          document.getElementById('wip-overlay').style.display = 'flex';
        });
      }
    })(wipItems[wi]);
  }

  // 设置图标：对接已有设置面板（首页不显示"返回主页"按钮）
  var iconSettings = document.getElementById('icon-settings');
  if (iconSettings) {
    iconSettings.style.cursor = 'pointer';
    iconSettings.addEventListener('click', function(e) {
      e.stopPropagation();
      document.getElementById('btn-back-to-home').style.display = 'none';
      document.getElementById('settings-panel').classList.toggle('show');
    });
  }

  // 关闭开发中弹窗
  var btnWipClose = document.getElementById('btn-wip-close');
  if (btnWipClose) {
    btnWipClose.addEventListener('click', function() {
      document.getElementById('wip-overlay').style.display = 'none';
    });
  }
})();

// ========== 战斗日志 ==========
(function() {
  var logPanel = document.getElementById('log-panel');
  var btnLog = document.getElementById('btn-log');
  if (btnLog) {
    btnLog.addEventListener('click', function(e) {
      e.stopPropagation();
      logPanel.classList.toggle('show');
      if (logPanel.classList.contains('show')) {
        Zhan.UI.renderLog();
      }
    });
  }
  document.addEventListener('click', function(e) {
    if (logPanel && logPanel.classList.contains('show') && !logPanel.contains(e.target) && e.target !== btnLog) {
      logPanel.classList.remove('show');
    }
  });
})();

// ========== 设置面板 ==========
(function() {
  var settingsPanel = document.getElementById('settings-panel');
  var btnSettings = document.getElementById('btn-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', function(e) {
      e.stopPropagation();
      document.getElementById('btn-back-to-home').style.display = '';
      settingsPanel.classList.toggle('show');
    });
  }
  document.addEventListener('click', function(e) {
    var iconSettings = document.getElementById('icon-settings');
    if (settingsPanel.classList.contains('show') && !settingsPanel.contains(e.target) && e.target !== btnSettings && e.target !== iconSettings) {
      settingsPanel.classList.remove('show');
    }
  });
  var toggleVibrate = document.getElementById('toggle-vibrate');
  if (toggleVibrate) {
    toggleVibrate.addEventListener('click', function() {
      this.classList.toggle('on');
      window.Zhan.Settings.vibrate = this.classList.contains('on');
    });
  }
  var sliderMusic = document.getElementById('slider-music');
  if (sliderMusic) {
    sliderMusic.addEventListener('input', function() { window.Zhan.Settings.musicVolume = this.value / 100; if (Zhan.Audio) Zhan.Audio.setBGMVolume(this.value / 100); });
  }
  var sliderSfx = document.getElementById('slider-sfx');
  if (sliderSfx) {
    sliderSfx.addEventListener('input', function() { window.Zhan.Settings.sfxVolume = this.value / 100; if (Zhan.Audio) Zhan.Audio.setSFXVolume(this.value / 100); });
  }
  document.getElementById('btn-back-to-home').addEventListener('click', function() {
    settingsPanel.classList.remove('show');
    Zhan.UI.renderMainMenu();
  });
})();

// ========== 返回主页（结果弹窗中） ==========
(function() {
  var btnHome = document.getElementById('btn-return-home');
  if (btnHome) {
    btnHome.addEventListener('click', function() {
      document.getElementById('result-overlay').classList.remove('show');
      Zhan.UI.renderMainMenu();
    });
  }
})();

// ========== 猫毛商店 ==========
Zhan.UI.renderCatMaoShop = function() {
  var itemsEl = document.getElementById('shop-items');
  if (!itemsEl) return;
  document.getElementById('shop-balance').textContent = '余额：' + Zhan.Save.get('catMao');
  var html = '';
  for (var i = 0; i < CATMAO_SHOP.length; i++) {
    var item = CATMAO_SHOP[i];
    var level = Zhan.Save.getPurchaseLevel(item.id);
    var maxed = item.maxLevel && level >= item.maxLevel;
    var owned = item.once && Zhan.Save.hasPurchase(item.id);
    var canBuy = !owned && !maxed && Zhan.Save.canAfford(item.price);
    var label = item.name;
    if (item.maxLevel) label += ' Lv.' + level + '/' + item.maxLevel;
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:#0f3460;border-radius:6px;font-size:11px;">';
    html += '<div style="flex:1;"><div style="color:#eee;">' + label + '</div><div style="color:#888;font-size:9px;">' + item.desc + '</div></div>';
    if (item.id === 'relic_affinity' && owned) {
      var chosen = Zhan.Save.get('catMaoAffinityRelic', '');
      html += '<button data-shop-affinity style="padding:4px 10px;border:none;border-radius:4px;background:#8e44ad;color:#fff;font-size:11px;cursor:pointer;">' + (chosen ? '已选：' + ((RELICS[chosen] && RELICS[chosen].name) || chosen) : '选择圣物') + '</button>';
    } else if (owned || maxed) {
      html += '<span style="color:#2ecc71;font-weight:bold;font-size:12px;">✅ 已拥有</span>';
    } else {
      html += '<button data-shop-buy="' + item.id + '" style="padding:4px 10px;border:none;border-radius:4px;background:' + (canBuy ? '#e67e22' : '#555') + ';color:' + (canBuy ? '#fff' : '#888') + ';font-size:11px;cursor:' + (canBuy ? 'pointer' : 'default') + ';" ' + (canBuy ? '' : 'disabled') + '>' + item.price + ' 🐱</button>';
    }
    html += '</div>';
  }
  itemsEl.innerHTML = html;

  var btns = itemsEl.querySelectorAll('[data-shop-buy]');
  for (var bi = 0; bi < btns.length; bi++) {
    btns[bi].addEventListener('click', function(e) {
      var itemId = this.getAttribute('data-shop-buy');
      var shopItem = null;
      for (var si = 0; si < CATMAO_SHOP.length; si++) { if (CATMAO_SHOP[si].id === itemId) { shopItem = CATMAO_SHOP[si]; break; } }
      if (!shopItem) return;
      if (!Zhan.Save.spend(shopItem.price, itemId)) return;
      Zhan.UI.renderCatMaoShop();
      Zhan.UI.renderMainMenu();
    });
  }

  // 圣物亲和选择按钮
  var affinityBtns = itemsEl.querySelectorAll('[data-shop-affinity]');
  for (var ai = 0; ai < affinityBtns.length; ai++) {
    affinityBtns[ai].addEventListener('click', function() {
      Zhan.UI.renderAffinitySelect();
    });
  }
};

// ========== 圣物亲和选择 ==========
Zhan.UI.renderAffinitySelect = function() {
  var optsEl = document.getElementById('affinity-options');
  if (!optsEl) return;
  var current = Zhan.Save.get('catMaoAffinityRelic', '');
  var relicIds = Object.keys(RELICS);
  var html = '';
  for (var i = 0; i < relicIds.length; i++) {
    var relic = RELICS[relicIds[i]];
    var selected = relicIds[i] === current;
    html += '<div data-affinity-id="' + relicIds[i] + '" style="padding:8px 10px;background:' + (selected ? '#2c3e50' : '#0f3460') + ';border-radius:6px;cursor:pointer;border:' + (selected ? '2px solid #f1c40f' : '2px solid transparent') + ';">';
    html += '<div style="font-size:12px;font-weight:bold;color:' + (selected ? '#f1c40f' : '#eee') + ';">' + relic.name + '</div>';
    html += '<div style="font-size:10px;color:#888;">' + relic.type + ' — ' + relic.desc + '</div>';
    html += '</div>';
  }
  optsEl.innerHTML = html;

  var items = optsEl.querySelectorAll('[data-affinity-id]');
  for (var ai = 0; ai < items.length; ai++) {
    items[ai].addEventListener('click', function() {
      var relicId = this.getAttribute('data-affinity-id');
      Zhan.Save.set('catMaoAffinityRelic', relicId);
      document.getElementById('affinity-overlay').style.display = 'none';
      Zhan.UI.renderCatMaoShop();
    });
  }

  document.getElementById('affinity-overlay').style.display = 'flex';
};
document.getElementById('btn-affinity-close').addEventListener('click', function() {
  document.getElementById('affinity-overlay').style.display = 'none';
});

(function() {
  var catmaoEl = document.getElementById('menu-catmao');
  if (catmaoEl) {
    catmaoEl.addEventListener('click', function() {
      Zhan.UI.renderCatMaoShop();
      document.getElementById('catmao-shop-overlay').style.display = 'flex';
    });
  }
  document.getElementById('btn-shop-close').addEventListener('click', function() {
    document.getElementById('catmao-shop-overlay').style.display = 'none';
  });
})();
