// ============================================================
//  斩 v14 — ui.js
//  渲染函数 + DOM 事件 + log 系统
//  依赖 data.js / core.js（先加载）
// ============================================================

// ========== 渲染主函数 ==========
function render() {
  document.getElementById('player-hp').textContent = G.playerHP;
  document.getElementById('player-shield').textContent = G.playerShield;
  document.getElementById('enemy-hp').textContent = G.enemyHP;
  document.getElementById('enemy-shield').textContent = G.enemyShield;
  document.getElementById('enemy-power').textContent = G.enemyPower;
  document.getElementById('enemy-avatar').textContent = G.boss.emoji || '💀';
  document.getElementById('enemy-name').textContent = G.boss.name || '骷髅';

  // 元气弹进度
  var totalCards = CONFIG.TOTAL_CARDS;
  var remaining = 0;
  var fp = G.piles.flat();
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
    pbHtml += '<span class="badge badge-atk-up">⚡攻×' + abm + ' ' + pe.atk_buff + 'T</span>';
  }
  if ((pe.def_buff || 0) > 0) {
    var dbr = G.effectiveDefBuffRatio || CONFIG.DEF_BUFF_RATIO;
    pbHtml += '<span class="badge badge-def-up">💨减伤×' + dbr + ' ' + pe.def_buff + 'T</span>';
  }
  document.getElementById('player-badges').innerHTML = pbHtml;

  // 敌人badges
  var ee = G.enemyEffects;
  var ebHtml = '';
  if ((ee.stun || 0) > 0) ebHtml += '<span class="badge badge-stun">💫眩晕 ' + ee.stun + 'T</span>';
  if ((ee.vulnerable || 0) > 0) ebHtml += '<span class="badge badge-vuln">💔易伤 ' + ee.vulnerable + 'T</span>';
  if ((ee.atk_down || 0) > 0) ebHtml += '<span class="badge badge-atk-down">⬇降攻 ' + ee.atk_down + 'T</span>';
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
  var flatPiles = G.piles.flat();
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

        // 涂抹检查：显示但模糊
        if (G.smearedPiles && G.smearedPiles[flatIdx]) div.classList.add('smeared');

        var ct = CARD_TYPES[top.type] || { emoji: '⬜', label: '废牌', cssClass: 'card-junk' };
        var inner = document.createElement('div');
        inner.className = 'card ' + ct.cssClass;
        var icon = document.createElement('span');
        icon.className = 'card-icon';
        icon.textContent = ct.emoji;
        var label = document.createElement('span');
        label.className = 'card-label';
        label.textContent = ct.label;
        inner.appendChild(icon);
        inner.appendChild(label);
        div.appendChild(inner);

        // 先知圣物：额外显示一行（下层牌信息）
        if (G.extraVisible && pile.length > 1) {
          var subCard = pile[pile.length-2];
          var sct = CARD_TYPES[subCard.type] || { emoji: '⬜', label: '废牌', cssClass: 'card-junk' };
          var subInner = document.createElement('div');
          subInner.className = 'card ' + sct.cssClass;
          subInner.style.cssText = 'position:absolute;bottom:0;left:0;width:100%;height:40%;font-size:10px;opacity:0.6;border-radius:0 0 4px 4px;';
          var subIcon = document.createElement('span');
          subIcon.className = 'card-icon';
          subIcon.style.cssText = 'font-size:11px;';
          subIcon.textContent = sct.emoji;
          subInner.appendChild(subIcon);
          div.appendChild(subInner);
        }

        if (pile.length > (G.extraVisible ? 2 : 1)) {
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
          if (now - lastTap < 350) { e.preventDefault(); if (pullCard(r, c)) { log('⚡ 双击进槽'); } lastTap = 0; return; }
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
          if (dy > 20 && dy > dx * 1.5) { e.preventDefault(); if (!swiping && getTop(G.piles[r][c])) { swiping = true; if (pullCard(r, c)) { log('👇 拖拽进槽'); } } }
        }, {passive: false});

        board.appendChild(div);
      })(r, c);
    }
  }
}

// ========== 消除槽渲染 ==========
function renderSlot() {
  var bar = document.getElementById('slot-bar');
  bar.innerHTML = '';
  var effectiveSize = G.effectiveSlotSize || CONFIG.SLOT_SIZE;
  for (var i = 0; i < effectiveSize; i++) {
    var div = document.createElement('div');
    div.className = 'eslot';
    if (i < G.slot.length) {
      var card = G.slot[i];
      var ct = CARD_TYPES[card.type] || { emoji: '⬜', color: 'junk' };
      div.classList.add('filled', ct.color);
      div.textContent = ct.emoji;
    }
    // 锁定槽位
    if (G.lockedSlots && G.lockedSlots[i]) {
      div.classList.add('locked');
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
      var mult = calcPursuitMultiplier(maxLen);
      html += ' ' + maxLen + '连×' + mult.toFixed(1);
    }
    html += '→总' + val + '</span>';
    previewParts.push(html);
  }

  for (var ci2 = 0; ci2 < combos.length; ci2++) {
    var c2 = combos[ci2];
    if (!BUFF_TYPES[c2.type]) continue;
    previewParts.push('<span class="combo-preview ' + c2.type + '">' + CARD_TYPES[c2.type].emoji + c2.n + '连→效果</span>');
  }

  // 未消除扣血预览
  var unmatchedByType = {};
  for (var si2 = 0; si2 < G.slot.length; si2++) {
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
  newGame();
});

// ========== LOG ==========
function log(msg) {
  G.logLines.push(msg);
  if (G.logLines.length > 100) G.logLines.shift();
  var el = document.getElementById('log');
  el.innerHTML = G.logLines.map(function(m) { return '<div>' + m + '</div>'; }).join('');
  el.scrollTop = el.scrollHeight;
}
