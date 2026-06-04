# task_sprint3_engine_eventize.md

> TASK_ID: sprint3_engine_eventize
> STATUS: ready → assign to Writer (Claude Code)
> DEPENDS_ON: v1.97 (sprint2 completed — Zhan.Rules exists, data.js is pure content)

---

## Objective

Centralize global `G` into `Zhan.Engine.state`. All state mutation via `Zhan.Engine.dispatch()`. Fix known timing bugs. Remove all direct `render()`/DOM calls from core logic.

---

## THE PLAN (CRITICAL: read before coding)

Sprint 3 is HIGH RISK because it touches the main game loop. The approach:

1. **Introduce Zhan.Engine without removing G** — start by creating the Engine wrapper, then redirect callers one by one
2. **Keep G as alias** — `var G = Zhan.Engine.state;` at end of newGame/init so existing code in `Zhan.Systems.Boss._traitHandlers` and `Zhan.Systems.Relic._handlers` still works (they all mutate state via G)
3. **Replace direct render()/log() with state.logLines + Engine hook** — log() becomes `state.logLines.push(msg)`, render becomes `Zhan.UI.render(state)` called from dispatch
4. **Move executeTurn/enemyTurn into Engine as private methods**, split into phases
5. **Fix bugs** listed below

---

## PART 1: Create Zhan.Engine

### 1A. Engine structure (add to core.js, below Zhan.Systems.Boss, above function pullCard)

```js
// ========== Zhan.Engine — 集中状态管理 ==========
Zhan.Engine = {
  state: null,
  
  // 初始化
  init: function() {
    var bossId = this.state ? this.state.bossId || 'skeleton' : 'skeleton';
    var boss = BOSSES[bossId];
    var relics = (this.state && this.state.activeRelics) || [];
    var stage = (this.state && this.state.currentStage) || 1;
    
    var st = {
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
    
    // Apply relic init
    Zhan.Systems.Relic.applyInit(st);
    
    // HP after relic init
    st.playerHP = st.playerMaxHP;
    
    // Hiss prevHP
    if (boss.hpTriggers && boss.hpTriggers.indexOf('hiss') >= 0) {
      st.hissPrevHP = boss.maxHP;
    }
    
    // Hide intent check
    if (boss.traits) {
      for (var bi = 0; bi < boss.traits.length; bi++) {
        if (boss.traits[bi].id === 'hide_intent') {
          st.hideIntent = true;
          break;
        }
      }
    }
    
    this.state = st;
    
    // Build deck & piles
    this._buildDeck();
    this._buildPiles();
    
    // Special cards
    if (st.specialCards) {
      for (var sc = 0; sc < st.specialCards.length; sc++) {
        st.deck.unshift({ type: st.specialCards[sc].type, id: st.pickedId++, special: st.specialCards[sc] });
      }
      st.logLines.push('🪶 救命毫毛！获得' + st.specialCards.length + '张特殊卡');
    }
    
    shuffle(st.deck);
    this._buildPiles();
    this._updateEnemyIntent();
    st.logLines.push('🐱 新局开始！双击或向下拖拽卡牌进槽');
    
    return st;
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
  
  // Dispatch — single entry point for all actions
  dispatch: function(action) {
    var st = this.state;
    if (!st) return;
    
    switch (action.type) {
      case 'PLAY_CARD':
        this._pullCard(st, action.r, action.c);
        break;
      case 'END_TURN':
        this._executeTurn(st);
        break;
      case 'RESET':
        // reset global ENDLESS_DEFEATED
        ENDLESS_DEFEATED = {};
        this.state = null;
        this.init();
        break;
      case 'RESTART':
        ENDLESS_DEFEATED = {};
        var newSt = this.init();
        newSt.isEndless = false;
        newSt.activeRelics = [];
        newSt.currentStage = 1;
        newSt.bossId = 'skeleton';
        break;
    }
    
    // Unified render after every action
    if (this.state && Zhan.UI && Zhan.UI.render) {
      Zhan.UI.render(this.state);
    }
    if (this.state) {
      var btn = document.getElementById('btn-end-turn');
      if (btn) btn.disabled = !(this.state.phase === 'player' && !this.state.over && this.state.slot.length > 0);
    }
  }
};
```

---

## PART 2: Split executeTurn into phase methods

### 2A. Turn phases as Engine methods

Each method processes one phase and returns. Control flow stays in dispatch.

```js
Zhan.Engine._playerPhase = function(st) {
  st.phase = 'resolving';
  st.logLines.push('▶ 回合' + (st.turn+1));
  st.logLines.push('⚔️ 勇者行动');
  st.playerShield = 0;
  
  // Wild core
  if (st.wildCoreSlot) {
    if (st.slot[0] === null) {
      st.slot[0] = { type: 'wild', id: st.pickedId++, wildCore: true };
    } else {
      st.slot.unshift({ type: 'wild', id: st.pickedId++, wildCore: true });
    }
  }
  
  // Boss onResolve
  Zhan.Systems.Boss.processEvent(st, 'RESOLVE');
  
  var combos = Zhan.Rules.computeCombos(st.slot, st.effectiveMinCombo || CONFIG.MIN_COMBO);
  
  // Track max combo
  for (var ci = 0; ci < combos.length; ci++) {
    if (combos[ci].n > st.maxCombo) st.maxCombo = combos[ci].n;
  }
  
  // === Phase 1: Buff/Debuff ===
  // [COPY EXISTING buff/debuff code from current executeTurn verbatim]
  // All references to G.xxx become st.xxx
  
  // === Phase 2: Attack/Defend/Heal ===
  // [COPY EXISTING action resolution code verbatim]
  
  // === Special cards ===
  // [COPY EXISTING special card code verbatim]
  
  // === Unmatched penalty ===
  // [COPY EXISTING penalty code verbatim]
  
  st.slot = [];
  
  // Buff decay
  if ((st.playerEffects.atk_buff || 0) > 0) st.playerEffects.atk_buff--;
  
  // Tenacity check — CRITICAL FIX: check AFTER player damage, BEFORE endGame
  if (st.activeRelics.indexOf('tenacity_core') >= 0 && st.tenacityUsed === false && st.playerHP <= 0) {
    st.playerHP = 1;
    st.tenacityUsed = true;
    st.logLines.push('🛡 坚韧核心触发！HP锁定为1');
  }
  
  // Now check win/loss
  if (st.enemyHP <= 0) { this._endGame(st, true, st.boss.emoji + ' 击败！'); return; }
  if (st.playerHP <= 0) { this._endGame(st, false, '勇者倒下了...'); return; }
  
  var totalRemaining = 0;
  var fp = flatten(st.piles);
  for (var fi = 0; fi < fp.length; fi++) totalRemaining += fp[fi].length;
  if (totalRemaining === 0) { this._endGame(st, true, '✨ 牌库全消！元气弹斩杀！'); return; }
  
  this._updateEnemyIntent(st);
  
  // Maine coon: boss goes first, return to player phase after enemy turn
  if (st._maineCoonFirst) {
    st._maineCoonFirst = false;
    st.phase = 'player';
    st.logLines.push('⏭ 回合' + (st.turn+1) + '开始');
    st.logLines.push(st.boss.emoji + 'HP:' + st.enemyHP + '🛡' + st.enemyShield + '⚡' + st.enemyPower);
  } else {
    // Normal flow: enemy goes now
    var self = this;
    setTimeout(function() { self._enemyPhase(st); }, 400);
  }
};

Zhan.Engine._enemyPhase = function(st) { ... };  // [COPY enemyTurn logic with st instead of G]
Zhan.Engine._turnStart = function(st) { ... };
Zhan.Engine._turnEnd = function(st) { ... };
Zhan.Engine._endGame = function(st, win, msg) { ... };  // [COPY endGame logic with st]
Zhan.Engine._updateEnemyIntent = function(st) { ... };  // [COPY updateEnemyIntent logic with st]
Zhan.Engine._applyDamageToPlayer = function(st, dmg, rawAtk, label) { ... };  // [COPY applyDamageToPlayer with st]
```

---

## PART 3: BUG FIXES (CRITICAL)

### BUG 1: Tenacity timing (CRITICAL)
**Problem**: In current executeTurn(), the check order is:
1. `if (st.enemyHP <= 0) endGame(win)` ← checked first
2. `if (st.playerHP <= 0) endGame(lose)` ← checked second  
3. `if (tenacityUsed === false && st.playerHP <= 0)` ← NEVER REACHES, game already over at step 2

**Fix**: In `_playerPhase`, after unmatched penalty applies damage, check tenacity BEFORE the win/lose checks:
```
1. Apply all damage (including unmatched penalty)
2. if (tenacity_core && !tenacityUsed && playerHP <= 0) → playerHP = 1, tenacityUsed = true
3. if (enemyHP <= 0) → win
4. if (playerHP <= 0) → lose
```

### BUG 2: pullCard card disappearance
**Problem** (L582-584 in current core.js): When all slots are locked, `popTop` already removed the card from pile, but the null-rollback doesn't push it back.

**Fix**: In `_pullCard`:
```js
var card = popTop(pile);
if (!card) return;
// ... slot lock check ...
if (insIdx >= maxSize) {
  st.logLines.push('🔒 所有剩余槽位都被锁定了！');
  while (_skippedSlots > 0) { st.slot.pop(); _skippedSlots--; }
  pile.push(card);  // ← FIX: push card back to pile
  return;
}
```

### BUG 3: wild_core vs locked slots
**Problem**: pullCard puts null at slot[0] for wild core, then if slot[0] is locked (英短蓝猫), the wild core card gets placed at slot[0] anyway in executeTurn, which should instead go to the first un-locked slot.

**Fix in _playerPhase**: When placing wild core card:
```js
if (st.wildCoreSlot) {
  var wildIdx = 0;
  while (st.lockedSlots && st.lockedSlots[wildIdx]) wildIdx++;
  if (st.slot[wildIdx] === null) {
    st.slot[wildIdx] = { type: 'wild', id: st.pickedId++, wildCore: true };
  } else {
    // Insert at wildIdx
    st.slot.splice(wildIdx, 0, { type: 'wild', id: st.pickedId++, wildCore: true });
  }
}
```

### BUG 4: pullCard null push for wild_core when slot[0] is locked
When wildCoreSlot and slot[0] is locked by 英短, don't push a null at slot[0]. Instead, find the first unlocked slot for the null placeholder.

---

## PART 4: Remove direct render()/DOM calls

After Engine is working, all `render()` calls in core.js should ONLY be in:
1. `dispatch()` — unified render after action
2. `_enemyPhase()` — via setTimeout callback that calls dispatch

Remove individual `render()` + `document.getElementById('btn-end-turn')` from pullCard, executeTurn, enemyTurn.

---

## PART 5: Adapt ui.js

### Make render() a Zhan.UI member
In ui.js, at the top:
```js
if (!window.Zhan) window.Zhan = {};
Zhan.UI = {};

Zhan.UI.render = function(state) {
  // The existing render() body, but reading from `state` instead of `G`
  // All `G.xxx` becomes `state.xxx`
  // At the end, call renderBoard(state), renderSlot(state)
};
```

Move `renderBoard`, `renderSlot`, `updateComboPreview`, `renderStatsPanel` to Zhan.UI as well.

### Bind events to Engine.dispatch
In ui.js, update event bindings:
```js
document.getElementById('btn-end-turn').addEventListener('click', function() {
  var st = Zhan.Engine.state;
  if (!st || st.phase !== 'player' || st.over || st.slot.length === 0) return;
  Zhan.Engine.dispatch({ type: 'END_TURN' });
});

document.getElementById('btn-reset').addEventListener('click', function() {
  document.getElementById('result-overlay').classList.remove('show');
  Zhan.Engine.dispatch({ type: 'RESET' });
});

document.getElementById('btn-restart').addEventListener('click', function() {
  document.getElementById('result-overlay').classList.remove('show');
  Zhan.Engine.dispatch({ type: 'RESTART' });
});
```

The pullCard should also become dispatch-based:
```js
// In ui.js event handlers for board clicks/drags:
Zhan.Engine.dispatch({ type: 'PLAY_CARD', r: r, c: c });
```

---

## PART 6: Keep backward compat for Zhan.Systems

Zhan.Systems.Boss._traitHandlers and Zhan.Systems.Relic._handlers still use `G` — they receive it as a parameter. Change them to use st/state consistently, or add a compat line at the top of each handler function body: it already receives `G` as a parameter.

Since Engine methods pass `st` instead of global `G`, the trait handlers and relic handlers are called with `G=st`, already works.

---

## Build

Produce `zhan_v1.98_sprint3.html`:
```powershell
[System.IO.File]::WriteAllText("C:\Users\kyzha\.openclaw\projects\zhan\zhan_v1.98_sprint3.html", $html, [System.Text.UTF8Encoding]::new($true))
```

---

## Verifier Checklist

1. F12 Console no errors
2. First fight (catToy) cycles correctly: attack/defend repeat
3. 毛线团 7-round cycle: 攻/防/蓄/攻/双/防/怒
4. **Tenacity test**: With tenacity_core relic, get HP to 1 from unmatched cards, end turn → HP stays 1, game continues (does NOT lose)
5. **Wild core + 英短蓝猫**: slot[0] locked → wild card appears at first unlocked slot, no error
6. **Card vanish fix**: drag card into slot when all slots locked → card returns to pile, pile count unchanged
7. Double-click, drag-drop, end-turn, reset buttons all work
8. Relic select overlay appears after second fight
9. Stats panel shows correct values

---

## DO NOT CHANGE
- data.js — off limits
- style.css, relic.css — off limits
- index.html structure (only touch to inline JS)
- Zhan.Rules functions — they're already pure, don't touch
- Any numeric values or game balance
