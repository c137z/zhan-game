// ============================================================
//  斩 v14 — ui.js
//  渲染函数 + DOM 事件 + log 系统
//  依赖 data.js / core.js（先加载）
// ============================================================

// ========== 渲染主函数 ==========
function render() {
  // TASK: FURY_DYNAMIC — 每次渲染前刷新 effective 值，确保 badge/preview 实时随血量
  updateEffectiveFuryValues(G);
  document.getElementById('player-hp').textContent = G.playerHP;
  document.getElementById('player-shield').textContent = G.playerShield;
  document.getElementById('enemy-hp').textContent = G.enemyHP;
  document.getElementById('enemy-shield').textContent = G.enemyShield;
  document.getElementById('enemy-power').textContent = G.enemyPower;
  document.getElementById('enemy-avatar').textContent = G.boss.emoji || '🧶';
  document.getElementById('enemy-name').textContent = G.boss.name || '毛线团';

  // 元气弹进度
  var totalCards = CONFIG.TOTAL_CARDS;
  var remaining = 0;
  var fp = flatten(G.piles);
  for (var i = 0; i < fp.length; i++) remaining += fp[i].length;
  remaining += G.slot.length;
  var consumed = totalCards - remaining;
  var spiritPct = Math.floor(consumed / totalCards * 100);
  document.getElementById('spirit-bar-inner').style.width = spiritPct + '%';
  document.getElementById('spirit-text').textContent = spiritPct + '%';

  // 玩家badges
  var pe = G.playerEffects;
  var pbHtml = '';
  if ((pe.atk_buff || 0) > 0) {
    var abm = G.effectiveAtkBuffMult || CONFIG.ATK_BUFF_MULT;
    // T3: 去尾零 — 1.50→1.5
    pbHtml += '<span class="badge badge-atk-up">⚡攻×' + parseFloat(abm.toFixed(2)) + ' ' + pe.atk_buff + 'T</span>';
  }
  if ((pe.def_buff || 0) > 0) {
    var dbr = G.effectiveDefBuffRatio || CONFIG.DEF_BUFF_RATIO;
    // T3: 去尾零 — 0.70→0.7
    pbHtml += '<span class="badge badge-def-up">💨减伤×' + parseFloat(dbr.toFixed(2)) + ' ' + pe.def_buff + 'T</span>';
  }
  document.getElementById('player-badges').innerHTML = pbHtml;

  // 敌人badges
  var ee = G.enemyEffects;
  var ebHtml = '';
  if ((ee.stun || 0) > 0) ebHtml += '<span class="badge badge-stun">💫眩晕 ' + ee.stun + 'T</span>';
  if ((ee.vulnerable || 0) > 0) ebHtml += '<span class="badge badge-vuln">💔易伤 ' + ee.vulnerable + 'T</span>';
  // T3: 降攻百分比动态取值
  if ((ee.atk_down || 0) > 0) ebHtml += '<span class="badge badge-atk-down">⬇降攻-' + (ee.atk_down_pct || CONFIG.ATK_DOWN_PCT) + '% ' + ee.atk_down + 'T</span>';
  document.getElementById('enemy-badges').innerHTML = ebHtml;

  // 牌堆统计
  var totalRemaining = 0;
  for (var i2 = 0; i2 < fp.length; i2++) totalRemaining += fp[i2].length;
  document.getElementById('deck-remain').textContent = totalRemaining;
  var hiddenCount = 0, visibleCount = 0;
  for (var i3 = 0; i3 < fp.length; i3++) {
    var pile = fp[i3];
    if (!pile.length) continue;
    visibleCount++;
    if (pile.length > 1) hiddenCount += pile.length - 1;
  }
  document.getElementById('hidden-cards').textContent = hiddenCount;
  document.getElementById('visible-cards').textContent = visibleCount;

  renderBoard();
  renderSlot();

  var btn = document.getElementById('btn-end-turn');
  if (G.phase === 'player' && !G.over && G.slot.length > 0) btn.disabled = false;
  else btn.disabled = true;
}

// ========== 牌堆渲染 ==========
function renderBoard() {
  var board = document.getElementById('board');
  board.innerHTML = '';
  var flatPiles = flatten(G.piles);
  for (var r = 0; r < CONFIG.BOARD_ROWS; r++) {
    for (var c = 0; c < CONFIG.BOARD_COLS; c++) {
      (function(r, c) {
        var pile = G.piles[r][c];
        var top = getTop(pile);
        var div = document.createElement('div');
        div.className = 'card-slot';
        var flatIdx = r * CONFIG.BOARD_COLS + c;

        // 锁定检查
        if (G.lockedPiles && G.lockedPiles[flatIdx]) div.classList.add('locked');

        if (!top) { div.classList.add('card-empty'); board.appendChild(div); return; }

        // 涂抹检查：显示❓遮盖
        var ct;
        var isSmeared = G.smearedPiles && G.smearedPiles[flatIdx];
        if (isSmeared) {
          ct = { emoji: '❓', label: '??', cssClass: 'card-junk' };
        } else {
          ct = CARD_TYPES[top.type] || { emoji: '⬜', label: '废牌', cssClass: 'card-junk' };
        }
        // 救命毫毛特殊卡：白色卡面，覆盖样式（保持 CARD_TYPES 定义的 cssClass）
        var isSpecial = top.special && top.special.color === 'white';
        if (isSpecial) {
          ct = { emoji: top.special.emoji, label: top.special.label, cssClass: ct.cssClass };
        }
        var inner = document.createElement('div');
        inner.className = 'card ' + ct.cssClass;
        // 特殊卡白色卡面
        if (isSpecial) {
          inner.style.background = '#fff';
          inner.style.color = '#333';
          inner.style.border = '1px solid #ddd';
        }
        // 涂抹卡牌：灰色卡面
        if (isSmeared) {
          inner.style.background = '#555';
          inner.style.color = '#ccc';
          inner.style.border = '1px solid #666';
        }
        var icon = document.createElement('span');
        icon.className = 'card-icon';
        icon.textContent = ct.emoji;
        var label = document.createElement('span');
        label.className = 'card-label';
        label.textContent = ct.label;
        inner.appendChild(icon);
        inner.appendChild(label);
        div.appendChild(inner);

        if (pile.length > 1) {
          var sc = document.createElement('div');
          sc.className = 'stack-count';
          sc.textContent = pile.length;
          div.appendChild(sc);
        }

        // 双击进槽
        var lastTap = 0;
        div.addEventListener('click', function(e) {
          if (G.phase !== 'player' || G.over) return;
          var now = Date.now();
          if (now - lastTap < CONFIG.DOUBLE_TAP_DELAY) { e.preventDefault(); if (pullCard(r, c)) { log('⚡ 双击进槽'); } lastTap = 0; return; }
          lastTap = now;
          if (getTop(G.piles[r][c])) { div.classList.add('double-tap-active'); setTimeout(function() { div.classList.remove('double-tap-active'); }, 200); }
        });

        // 拖拽进槽
        var touchStartY = 0, touchStartX = 0, swiping = false;
        div.addEventListener('touchstart', function(e) {
          touchStartY = e.touches[0].clientY; touchStartX = e.touches[0].clientX; swiping = false;
        }, {passive: true});
        div.addEventListener('touchmove', function(e) {
          if (G.phase !== 'player' || G.over) return;
          var dy = e.touches[0].clientY - touchStartY;
          var dx = Math.abs(e.touches[0].clientX - touchStartX);
          if (dy > CONFIG.SWIPE_THRESHOLD && dy > dx * 1.5) { e.preventDefault(); if (!swiping && getTop(G.piles[r][c])) { swiping = true; if (pullCard(r, c)) { log('👇 拖拽进槽'); } } }
        }, {passive: false});

        board.appendChild(div);
      })(r, c);
    }
  }
}

function renderSlot() {
  var bar = document.getElementById('slot-bar');
  bar.innerHTML = '';
  var effectiveSize = G.effectiveSlotSize || CONFIG.SLOT_SIZE;
  for (var i = 0; i < effectiveSize; i++) {
    var div = document.createElement('div');
    div.className = 'eslot';
    // 万能核心槽位：显示💎和"万能"标签
    if (G.wildCoreSlot && i === 0) {
      div.classList.add('filled', 'wild-core');
      div.textContent = '💎';
      var wcLabel = document.createElement('span');
      wcLabel.className = 'wild-core-label';
      wcLabel.textContent = '万能';
      div.appendChild(wcLabel);
    } else if (G.lockedSlots && G.lockedSlots[i]) {
      div.classList.add('locked');
      div.textContent = '✕';
    } else if (i < G.slot.length && G.slot[i] !== null) {
      var card = G.slot[i];
      // 特殊救命毫毛卡
      if (card.special) {
        div.classList.add('filled', 'special');
        div.style.background = '#fff';
        div.style.color = '#333';
        div.textContent = card.special.emoji;
      } else {
        var ct = CARD_TYPES[card.type] || { emoji: '⬜', color: 'junk' };
        div.classList.add('filled', ct.color);
        div.textContent = ct.emoji;
      }
    }
    bar.appendChild(div);
  }
}

// ========== 连击预览 ==========
function updateComboPreview() {
  var combos = computeCombos(G.slot);
  var el = document.getElementById('combo-bar');
  if (!combos.length && !G.slot.length) { el.innerHTML = ''; return; }

  var slotTypeCount = {};
  for (var si = 0; si < G.slot.length; si++) {
    var st = resolveWildType(G.slot, si);
    if (!BUFF_TYPES[st] && st !== 'junk') {
      if (!slotTypeCount[st]) slotTypeCount[st] = 0;
      slotTypeCount[st]++;
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

  var previewParts = [];
  var ACTION_TYPES = ['attack', 'defend', 'heal'];
  for (var ai = 0; ai < ACTION_TYPES.length; ai++) {
    var at = ACTION_TYPES[ai];
    if (!slotTypeCount[at] || slotTypeCount[at] < (G.effectiveMinCombo || CONFIG.MIN_COMBO)) continue;
    var total = slotTypeCount[at];
    var maxLen = actionMaxLen[at] || 0;
    var baseVal = calcBaseValue(total);
    var val = at === 'attack' ? calcAttackValue(total, maxLen, G) : (at === 'defend' ? calcDefendValue(total, maxLen, G) : calcHealValue(total, maxLen, G));
    var emoji = CARD_TYPES[at].emoji;
    var html = '<span class="combo-preview ' + at + '">' + emoji + '×' + total + '→' + baseVal;
    if (maxLen >= 4) {
      // T3: 去尾零 — 1.0→1, 1.5→1.5
      var mult = calcPursuitMultiplier(maxLen);
      html += ' ' + maxLen + '连×' + parseFloat(mult.toFixed(1));
    }
    html += '→总' + val + '</span>';
    previewParts.push(html);
  }

  for (var ci2 = 0; ci2 < combos.length; ci2++) {
    var c2 = combos[ci2];
    if (!BUFF_TYPES[c2.type]) continue;
    var desc = getEffectDescription(c2.type, c2.n);
    previewParts.push('<span class="combo-preview ' + c2.type + '">' + CARD_TYPES[c2.type].emoji + c2.n + '连→' + desc + '</span>');
  }

  // 未消除扣血预览（跳过特殊卡）
  var unmatchedByType = {};
  for (var si2 = 0; si2 < G.slot.length; si2++) {
    if (!G.slot[si2] || G.slot[si2].special) continue;
    var mt = resolveWildType(G.slot, si2);
    if (!unmatchedByType[mt]) unmatchedByType[mt] = 0;
    unmatchedByType[mt]++;
  }
  for (var ut in unmatchedByType) {
    if (unmatchedByType[ut] >= (G.effectiveMinCombo || CONFIG.MIN_COMBO)) continue;
    var uct = CARD_TYPES[ut] || { emoji: '⬜' };
    previewParts.push('<span class="combo-none">' + uct.emoji + '×' + unmatchedByType[ut] + '→❤-' + unmatchedByType[ut] + '</span>');
  }

  el.innerHTML = previewParts.length ? previewParts.join(' ') : '<span class="combo-none">⚪ 未形成连击</span>';
}

// ========== 结算面板 ==========
function renderStatsPanel(G) {
  var panel = document.getElementById('stats-panel');
  if (!panel) return;

  var relicNames = G.activeRelicNames || [];
  var relicsHtml = '';
  if (relicNames.length) {
    relicsHtml = '<div class="stat-row-item"><span class="stat-label">🏆 圣物</span><span class="stat-value">' + relicNames.join(', ') + '</span></div>';
  }

  var totalDeck = 0;
  for (var k in G.deckConfig) totalDeck += G.deckConfig[k];
  var remaining = 0;
  var fp = flatten(G.piles);
  for (var fi = 0; fi < fp.length; fi++) remaining += fp[fi].length;
  var consumed = totalDeck - remaining;

  panel.innerHTML =
    '<div class="stats-card">' +
      '<div class="stat-row-item"><span class="stat-label">⏱ 存活回合</span><span class="stat-value">' + (G.turn + 1) + '</span></div>' +
      '<div class="stat-row-item"><span class="stat-label">❤️ 剩余HP</span><span class="stat-value">' + G.playerHP + ' / ' + G.playerMaxHP + '</span></div>' +
      '<div class="stat-row-item"><span class="stat-label">💥 最高单次伤害</span><span class="stat-value">' + G.maxDamage + '</span></div>' +
      '<div class="stat-row-item"><span class="stat-label">🔥 最高连击</span><span class="stat-value">' + G.maxCombo + ' 连</span></div>' +
      '<div class="stat-row-item"><span class="stat-label">⚔️ 总伤害输出</span><span class="stat-value">' + G.totalDamage + '</span></div>' +
      '<div class="stat-row-item"><span class="stat-label">🃏 消耗卡牌数</span><span class="stat-value">' + consumed + ' / ' + totalDeck + '</span></div>' +
      relicsHtml +
    '</div>';
}

// ========== 事件绑定 ==========
document.getElementById('btn-end-turn').addEventListener('click', function() {
  if (G.phase !== 'player' || G.over || G.slot.length === 0) return;
  executeTurn();
});

document.getElementById('btn-reset').addEventListener('click', function() {
  document.getElementById('result-overlay').classList.remove('show');
  newGame();
});

document.getElementById('btn-restart').addEventListener('click', function() {
  document.getElementById('result-overlay').classList.remove('show');
  // 重置全局状态：回到毛线团第一关
  ENDLESS_DEFEATED = {};
  G.isEndless = false;
  G.activeRelics = [];
  G.currentStage = 1;
  G.bossId = 'skeleton';
  newGame();
});

document.getElementById('btn-endless').addEventListener('click', function() {
  document.getElementById('result-overlay').classList.remove('show');
  // 无尽模式：保留圣物，随机一只没打过的猫猫
  ENDLESS_DEFEATED = ENDLESS_DEFEATED || {};
  G.isEndless = true;
  startEndlessNextCat();
});

// ========== LOG ==========
function log(msg) {
  G.logLines.push(msg);
  if (G.logLines.length > CONFIG.LOG_MAX_LINES) G.logLines.shift();
  var el = document.getElementById('log');
  // 逐行用 textContent 防止 XSS
  el.innerHTML = '';
  for (var i = 0; i < G.logLines.length; i++) {
    var line = document.createElement('div');
    line.textContent = G.logLines[i];
    el.appendChild(line);
  }
  el.scrollTop = el.scrollHeight;
}

// ========== Boss 描述弹窗（长按头像） ==========
(function() {
  var el = document.getElementById('enemy-avatar');
  var timer;
  el.addEventListener('touchstart', function(e) {
    timer = setTimeout(function() { showBossInfo(); }, CONFIG.LONG_PRESS_DELAY);
  }, {passive: true});
  el.addEventListener('touchend', function() { clearTimeout(timer); });
  el.addEventListener('touchmove', function() { clearTimeout(timer); });
  // 桌面端右键
  el.addEventListener('contextmenu', function(e) { e.preventDefault(); showBossInfo(); });
})();

function showBossInfo() {
  if (!G.boss || !G.boss.desc) return;
  document.getElementById('boss-info-emoji').textContent = G.boss.emoji || '?';
  document.getElementById('boss-info-name').textContent = G.boss.name;
  document.getElementById('boss-info-mechanic').textContent = G.boss.desc;
  document.getElementById('boss-info-stats').textContent =
    'HP ' + G.boss.maxHP + ' | 攻击 ' + G.boss.baseAtk + ' | 护盾 ' + (G.boss.startShield || 0);
  document.getElementById('boss-info-overlay').style.display = 'flex';
}

document.getElementById('btn-boss-info-close').addEventListener('click', function() {
  document.getElementById('boss-info-overlay').style.display = 'none';
});
document.getElementById('boss-info-overlay').addEventListener('click', function(e) {
  if (e.target === this) this.style.display = 'none';
});


// ========== 勇者圣物信息弹窗（长按头像） ==========
(function() {
  var el = document.getElementById('player-avatar');
  var timer;
  el.addEventListener('touchstart', function(e) {
    timer = setTimeout(function() { showPlayerRelicInfo(); }, CONFIG.LONG_PRESS_DELAY);
  }, {passive: true});
  el.addEventListener('touchend', function() { clearTimeout(timer); });
  el.addEventListener('touchmove', function() { clearTimeout(timer); });
  el.addEventListener('contextmenu', function(e) { e.preventDefault(); showPlayerRelicInfo(); });
})();

function showPlayerRelicInfo() {
  var relics = G.activeRelics || [];
  var desc = relics.length ? '' : '（未装配圣物）';
  for (var i = 0; i < relics.length; i++) {
    var relic = RELICS[relics[i]];
    if (relic) desc += (i ? '\\n' : '') + relic.name + ': ' + relic.desc;
  }
  document.getElementById('player-info-mechanic').textContent = desc;
  document.getElementById('player-info-stats').textContent =
    'HP ' + G.playerHP + '/' + G.playerMaxHP + ' | ⚡ ' + (G.effectiveMinCombo || CONFIG.MIN_COMBO) + '连起效';
  document.getElementById('player-info-overlay').style.display = 'flex';
}

// 勇者弹窗关闭
document.getElementById('btn-player-info-close').addEventListener('click', function() {
  document.getElementById('player-info-overlay').style.display = 'none';
});
document.getElementById('player-info-overlay').addEventListener('click', function(e) {
  if (e.target === this) this.style.display = 'none';
});
