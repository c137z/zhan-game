# task_sprint1_content_decouple.md

> TASK_ID: sprint1_content_decouple
> STATUS: ready → assign to Writer (Claude Code)
> DEPENDS_ON: current code/ data.js + core.js (v1.95)

---

## Objective

Decouple all function logic from `data.js`. Transform RELICS and BOSSES into pure data config. All execution logic moves to core.js under a new `Zhan.Systems` namespace. **Zero change to game behavior — same fights must produce same results.**

---

## Deliverables

1. Updated `code/data.js` — pure content, 0 `function` keywords (except IIFE for total-card calculation at L65, which is allowed)
2. Updated `code/core.js` — hosts `Zhan.Systems.Relic` and `Zhan.Systems.Boss`
3. `zhan_v1.96_sprint1.html` — single‑file build artifact

---

## PRECISE TASK SPEC

### A. data.js: RELICS → pure config

**For each of the 11 relics below**, remove `onInit` (and `getMultiplier` for fury_core). Replace with a declarative `effects` array.

#### Specification table:

| relic_id | current onInit behavior | new effects array |
|----------|------------------------|-------------------|
| double_wild | `G.deckConfig.wild *= 2` | `effects: [{ phase:'INIT', action:'multiplyDeckCard', params:{ cardType:'wild', factor:2 } }]` |
| combo_core | `G.effectiveMinCombo = 2` | `effects: [{ phase:'INIT', action:'setEffectiveMinCombo', params:{ value:2 } }]` |
| slot_plus2 | `G.effectiveSlotSize = CONFIG.SLOT_SIZE + 2` | `effects: [{ phase:'INIT', action:'increaseSlotSize', params:{ amount:2 } }]` |
| endurance_core | `G.buffDurationBonus = 1` | `effects: [{ phase:'INIT', action:'setBuffDurationBonus', params:{ amount:1 } }]` |
| wild_core | `G.wildCoreSlot = true; G.effectiveSlotSize = (G.effectiveSlotSize \|\| CONFIG.SLOT_SIZE) + 1` | `effects: [{ phase:'INIT', action:'enableWildCoreSlot' }]` |
| overload_core | `G.atkBuffMult = 2.0; G.vulnMult = 2.0; G.defBuffRatio = 0.5` | `effects: [{ phase:'INIT', action:'setOverloadBuffs', params:{ atkBuffMult:2.0, vulnMult:2.0, defBuffRatio:0.5 } }]` |
| spirit_core | `G.noUnmatchedPenalty = true` | `effects: [{ phase:'INIT', action:'setNoUnmatchedPenalty', params:{ value:true } }]` |
| lifesaving_fur | sets G.specialCards to 3-card array | `effects: [{ phase:'INIT', action:'addSpecialCards', params:{ cards:[{type:'special_atk',label:'特攻',emoji:'🙈',dmg:40,color:'white'},{type:'special_def',label:'特防',emoji:'🙉',shield:40,color:'white'},{type:'divine',label:'免伤',emoji:'🙊',immune:true,color:'white'}] } }]` |
| tenacity_core | `G.tenacityUsed = false` | `effects: [{ phase:'INIT', action:'enableTenacity' }]` |
| fury_core | `G.furyEnabled = true` + getMultiplier function | `effects: [{ phase:'INIT', action:'enableFury' }]`. Also add `multiplier: { depends:'hpLoss', formula:'1-hpPercent' }` as metadata (actual getMultiplier function moves to core.js, see below) |
| life_core | `G.playerMaxHP = CONFIG.PLAYER_MAX_HP + 50` | `effects: [{ phase:'INIT', action:'increaseMaxHP', params:{ amount:50 } }]` |

Each relic object after transformation looks like:
```js
double_wild: {
  id: 'double_wild', name: '双生花', type: 'rule',
  desc: '万能卡数量翻倍',
  effects: [{ phase: 'INIT', action: 'multiplyDeckCard', params: { cardType: 'wild', factor: 2 } }]
},
```

All 11 relics must follow this pattern.

---

### B. data.js: BOSSES → pure config

#### B1. GROOM_TRIGGER and HISS_TRIGGER → reduce to id markers

**Before** (lines 86-121):
```js
var GROOM_TRIGGER = {
  id: 'groom',
  condition: function(G) { return G.turn > 0 && (G.turn + 1) % 4 === 0; },
  execute: function(G) { ... }
};
var HISS_TRIGGER = {
  id: 'hiss',
  condition: function(G) { ... },
  execute: function(G) { ... }
};
```

**After**: Remove entirely. All 10 cat bosses reference these by id only:
```js
hpTriggers: ['groom', 'hiss']
```

The hpTriggers array changes from `[GROOM_TRIGGER, HISS_TRIGGER]` (object references) to `['groom', 'hiss']` (string ids). The actual condition/execute functions move to core.js under `Zhan.Systems.Boss.hpTriggerHandlers`.

#### B2. All boss traits → pure event configs

Replace every `onTurnStart`/`onTurnEnd`/`onResolve` function body with a declarative events spec.

**Trait mapping table:**

| trait_id | current hooks | new events config | params |
|----------|--------------|-------------------|--------|
| lock_pile | onTurnStart + onTurnEnd | `events: ['TURN_START', 'TURN_END']` | `{ interval:2, count:2, duration:2 }` |
| lick_player | onTurnStart | `events: ['TURN_START']` | `{ interval:3, minTurn:1 }` |
| lock_slot | onTurnStart + onTurnEnd | `events: ['TURN_START', 'TURN_END']` | `{ interval:3, count:2, duration:2 }` |
| hide_intent | onTurnStart | `events: ['TURN_START']` | — (sets hideIntent=true every turn) |
| random_discard | onResolve | `events: ['RESOLVE']` | `{ count:1 }` |
| smear_piles | onTurnStart | `events: ['TURN_START']` | `{ count:2 }` |
| time_limit | onTurnStart | `events: ['TURN_START']` | `{ maxTurns:24 }` |
| insert_junk | onTurnStart | `events: ['TURN_START']` | `{ halfHP: true }` |
| stun_player | onTurnStart | `events: ['TURN_START']` | `{ interval:5, minTurn:1 }` |
| boss_first | (no function — handled in executeTurn by id check) | `events: ['TURN_START']` | — (becomes: check `boss.id === 'maine_coon'` in runtime — already done, no change needed) |

**Example transformation — tabby (狸花猫):**

Before:
```js
traits: [{
  id: 'lock_pile',
  onTurnStart: function(G) { /* ~15 lines */ },
  onTurnEnd: function(G) { /* ~8 lines */ }
}],
```

After:
```js
traits: [{
  id: 'lock_pile',
  events: ['TURN_START', 'TURN_END'],
  params: { interval: 2, count: 2, duration: 2 }
}],
```

**Apply this to ALL 10 cat bosses.** (catToy and skeleton already have no traits, no change.)

---

### C. core.js: Add Zhan.Systems namespace

Add at the top of core.js (after the polyfill/flatten section, before the damage formulas):

```js
// ========== Zhan.Systems — 声明式效果执行引擎 ==========
if (!window.Zhan) window.Zhan = {};
Zhan.Systems = {};

// --- Relic Effects ---
Zhan.Systems.Relic = {
  _handlers: {
    multiplyDeckCard: function(G, params) { G.deckConfig[params.cardType] *= params.factor; },
    setEffectiveMinCombo: function(G, params) { G.effectiveMinCombo = params.value; },
    increaseSlotSize: function(G, params) { G.effectiveSlotSize = CONFIG.SLOT_SIZE + params.amount; },
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
        log('🐱 阿比拍飞了一张 ' + (CARD_TYPES[card.type] ? CARD_TYPES[card.type].emoji : '?') + '！');
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
          endGame(false, '⏰ ' + params.maxTurns + '回合已到！豹猫赢了...');
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
      condition: function(G) { return G.turn > 0 && (G.turn + 1) % 4 === 0; },
      execute: function(G) {
        G.enemyEffects.vulnerable = 0;
        G.enemyEffects.atk_down = 0;
        G.enemyEffects.atk_down_pct = 0;
        G.enemyEffects.stun = 0;
        G.effectiveVulnMult = 0;
        log('🐱 舔毛！Boss 清除自身全部 Debuff（易伤/降攻/眩晕）');
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
```

---

### D. core.js: Update all call sites

#### D1. newGame() — relic init (line ~159-160)

**Before:**
```js
var relic = RELICS[relics[i]];
if (relic && relic.onInit) relic.onInit(G);
```

**After:**
```js
// Relic init moved to applyInit — call after all relics are collected
```
(Then add a single call at the end of newGame(), after the `for` loop: `Zhan.Systems.Relic.applyInit(G);`)

Actually, keep the loop structure but call applyInit differently. Best approach: **remove the individual onInit loop and call applyInit once at end of newGame()**.

#### D2. newGame() — hide_intent check (line ~176-185)

Already handled — the runtime check `if (boss.traits[i].id === 'hide_intent')` stays unchanged in newGame() because it's already color‑blind (checks by id string). No change needed.

#### D3. enemyTurn() — groom trigger (line ~708-715)

**Before:**
```js
if (G.boss.hpTriggers) {
  for (var hi2 = 0; hi2 < G.boss.hpTriggers.length; hi2++) {
    var trigger2 = G.boss.hpTriggers[hi2];
    if (trigger2.id === 'groom' && trigger2.condition && trigger2.condition(G)) {
      trigger2.execute(G);
      if (G.over) return;
    }
  }
}
```

**After:**
```js
if (G.boss.hpTriggers) {
  Zhan.Systems.Boss.runHpTriggers(G, 'groom');
  if (G.over) return;
}
```

#### D4. enemyTurn() — hiss check (line ~701-706)

**Before:**
```js
if (G.boss.hpTriggers) {
  for (var hi = 0; hi < G.boss.hpTriggers.length; hi++) {
    var trigger = G.boss.hpTriggers[hi];
    if (trigger.id !== 'groom' && trigger.condition && trigger.condition(G)) {
      trigger.execute(G);
    }
  }
}
```

**After:** (hiss is the only non-groom hpTrigger; run all non-groom)
```js
if (G.boss.hpTriggers) {
  for (var hi = 0; hi < G.boss.hpTriggers.length; hi++) {
    var triggerId = G.boss.hpTriggers[hi];
    if (triggerId === 'groom') continue;
    var handler = Zhan.Systems.Boss._hpTriggerHandlers[triggerId];
    if (handler && handler.condition && handler.condition(G)) {
      handler.execute(G);
    }
  }
}
```

#### D5. executeTurn() — trait onResolve (line ~439-445)

**Before:**
```js
if (G.boss.traits) {
  for (var ti = 0; ti < G.boss.traits.length; ti++) {
    var trait = G.boss.traits[ti];
    if (trait.onResolve) trait.onResolve(G, computeCombos(G.slot));
  }
}
```

**After:**
```js
Zhan.Systems.Boss.processEvent(G, 'RESOLVE');
```

#### D6. enemyTurn() — trait onTurnStart (line ~742-748)

**Before:**
```js
if (G.boss.traits) {
  for (var ti = 0; ti < G.boss.traits.length; ti++) {
    var trait = G.boss.traits[ti];
    if (trait.onTurnStart) trait.onTurnStart(G);
    if (G.over) return;
  }
}
```

**After:**
```js
Zhan.Systems.Boss.processEvent(G, 'TURN_START');
if (G.over) return;
```

#### D7. enemyTurn() — trait onTurnEnd (line ~812-817)

**Before:**
```js
if (G.boss.traits) {
  for (var tj = 0; tj < G.boss.traits.length; tj++) {
    var trait2 = G.boss.traits[tj];
    if (trait2.onTurnEnd) trait2.onTurnEnd(G);
  }
}
```

**After:**
```js
Zhan.Systems.Boss.processEvent(G, 'TURN_END');
```

#### D8. fury_core getMultiplier call sites

Search core.js for `RELICS.fury_core.getMultiplier(G)` → replace with `Zhan.Systems.Relic.getFuryMultiplier(G)`. This appears at:
- `updateEffectiveFuryValues` (~L76)
- `executeTurn` atk_down branch (~L491)

#### D9. executeTurn — overload_core check (line ~490)

**Before:**
```js
if (G.activeRelics.indexOf('overload_core') >= 0) atkDownPct = 50;
```

**No change** — this already checks by id string, which is purely content‑referenced. Keep as is.

---

## BUILD

After updating data.js and core.js, produce `zhan_v1.96_sprint1.html` by concatenating in order:
```
index.html (with script tags replaced by inline content)
  → data.js content
  → core.js content  
  → ui.js content
```
(The existing `artifacts/zhan_v1.95.html` shows the concatenation pattern — follow it.)

---

## VERIFICATION CHECKLIST (for Verifier)

1. `grep -c "function" data.js` → should be exactly 1 (the IIFE at L65)
2. Open `zhan_v1.96_sprint1.html` in browser → no console errors
3. First fight (catToy 逗猫棒) → clear normally
4. Second fight (毛线团) → clear → relic select overlay appears with 2 relics
5. Click confirm → third fight starts with random cat boss
6. Spot-check 3 different cats with traits (tabby, abyssinian, siamese) → trait behavior unchanged
7. Fury core relic: damage changes as HP drops
8. Wild core relic: first slot is wild card

---

## DO NOT CHANGE

- Any numeric values (CONFIG, DECK_SIZES, BOSSES stats, card definitions)
- ui.js — never touch
- style.css / relic.css — never touch
- index.html — only touch to inline the updated JS files for the build artifact
- The game's actual behavior — this is a pure refactor, not a balance patch
