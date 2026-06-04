# task_sprint2_rules_purify.md

> TASK_ID: sprint2_rules_purify
> STATUS: ready → assign to Writer (Claude Code)
> DEPENDS_ON: v1.96 (sprint1 completed — code/data.js is pure content, code/core.js has Zhan.Systems)

---

## Objective

All numeric calculation functions → pure functions (no global G reads). Create `Zhan.Rules = {}` namespace in core.js. Every calc function gets its dependencies as explicit parameters.

**Zero change to game behavior.** Same inputs → same outputs.

---

## Precise Function Transformations

File: `code/core.js`

### A. Functions to MOVE into Zhan.Rules (with signature changes)

#### A1. calcBaseValue

**Current** (L274-276, reads G.effectiveMinCombo):
```js
function calcBaseValue(totalCount) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO; return 4 + (totalCount - minCombo) * 2;
}
```
**Target:**
```js
Zhan.Rules.calcBaseValue = function(totalCount, minCombo) {
  return 4 + (totalCount - minCombo) * 2;
};
```

#### A2. calcPursuitMultiplier

**Current** (L278-282, reads G.effectiveMinCombo):
```js
function calcPursuitMultiplier(maxComboLen) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  if (maxComboLen < minCombo + 1) return 1;
  return 1 + (maxComboLen - minCombo) * 0.1;
}
```
**Target:**
```js
Zhan.Rules.calcPursuitMultiplier = function(maxComboLen, minCombo) {
  if (maxComboLen < minCombo + 1) return 1;
  return 1 + (maxComboLen - minCombo) * 0.1;
};
```

#### A3. calcAttackValue

**Current** (L284-288, reads G.effectiveMinCombo, calls old calcBaseValue/calcPursuitMultiplier):
```js
function calcAttackValue(totalCount, maxComboLen, G) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  if (totalCount < minCombo) return 0;
  return Math.ceil(calcBaseValue(totalCount) * calcPursuitMultiplier(maxComboLen));
}
```
**Target:**
```js
Zhan.Rules.calcAttackValue = function(totalCount, maxComboLen, minCombo) {
  if (totalCount < minCombo) return 0;
  return Math.ceil(Zhan.Rules.calcBaseValue(totalCount, minCombo) * Zhan.Rules.calcPursuitMultiplier(maxComboLen, minCombo));
};
```

#### A4. calcDefendValue

**Current** (L290-294, reads G.effectiveMinCombo):
```js
function calcDefendValue(totalCount, maxComboLen, G) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  if (totalCount < minCombo) return 0;
  return Math.floor(calcBaseValue(totalCount) * calcPursuitMultiplier(maxComboLen));
}
```
**Target:**
```js
Zhan.Rules.calcDefendValue = function(totalCount, maxComboLen, minCombo) {
  if (totalCount < minCombo) return 0;
  return Math.floor(Zhan.Rules.calcBaseValue(totalCount, minCombo) * Zhan.Rules.calcPursuitMultiplier(maxComboLen, minCombo));
};
```

#### A5. calcHealValue — same pattern as A4, returns Math.floor

**Target:**
```js
Zhan.Rules.calcHealValue = function(totalCount, maxComboLen, minCombo) {
  if (totalCount < minCombo) return 0;
  return Math.floor(Zhan.Rules.calcBaseValue(totalCount, minCombo) * Zhan.Rules.calcPursuitMultiplier(maxComboLen, minCombo));
};
```

#### A6. resolveWildType

**Current** (L536-551, pure — only reads slot, idx):
```js
function resolveWildType(slot, idx) {
  if (!slot[idx] || slot[idx].isJunk) return 'junk';
  if (slot[idx].type !== 'wild') return slot[idx].type;
  for (var k = idx-1; k >= 0; k--) { ... }
  ...
}
```
This function is already pure (no G reads). Just move it onto Zhan.Rules:
```js
Zhan.Rules.resolveWildType = function(slot, idx) { /* identical body */ };
```

#### A7. computeCombos

**Current** (L554-600, reads G.effectiveMinCombo):
```js
function computeCombos(slot) {
  if (!slot.length) { var empty = []; empty._claimedWildIndices = []; return empty; }
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  ...
```
**Target:**
```js
Zhan.Rules.computeCombos = function(slot, minCombo) {
  if (!slot.length) { var empty = []; empty._claimedWildIndices = []; return empty; }
  // ... use the minCombo parameter instead of G.effectiveMinCombo
  // All internal calls to resolveWildType become Zhan.Rules.resolveWildType
};
```

#### A8. getComboDuration

**Current** (L600-603):
```js
function getComboDuration(n) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  return Math.max(1, n - minCombo + 1);
}
```
**Target:**
```js
Zhan.Rules.getComboDuration = function(n, minCombo) {
  return Math.max(1, n - minCombo + 1);
};
```

#### A9. getStunDuration — same, delegates to getComboDuration
```js
Zhan.Rules.getStunDuration = function(n, minCombo) {
  return Zhan.Rules.getComboDuration(n, minCombo);
};
```

#### A10. applyStatusEffects

**Current** (L329-341, reads G state + calls updateEffectiveFuryValues):
```js
function applyStatusEffects(type, val, G) {
  updateEffectiveFuryValues(G);
  switch (type) {
    case 'attack':
      if (G.effectiveAtkBuffMult > 0) val = Math.ceil(val * G.effectiveAtkBuffMult);
      if (G.effectiveVulnMult > 0) val = Math.ceil(val * G.effectiveVulnMult);
      break;
    case 'defend':
    case 'heal':
      break;
  }
  return val;
}
```
**Target** — remove the side-effect (updateEffectiveFuryValues call inside), take effects as a parameter:
```js
Zhan.Rules.applyStatusEffects = function(type, val, effects) {
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
};
```

#### A11. updateEffectiveFuryValues → computeEffectiveFury

**Current** (L311-327, reads & writes G):
```js
function updateEffectiveFuryValues(G) {
  if (G.furyEnabled && RELICS.fury_core) {
    var furyMult = Zhan.Systems.Relic.getFuryMultiplier(G);
    G.effectiveAtkBuffMult = (G.atkBuffMult || CONFIG.ATK_BUFF_MULT) * furyMult;
    G.effectiveVulnMult = (G.vulnMult || CONFIG.VULN_MULT) * furyMult;
    var baseRatio = G.defBuffRatio || CONFIG.DEF_BUFF_RATIO;
    G.effectiveDefBuffRatio = Math.max(0, 1 - (1 - baseRatio) * furyMult);
  } else {
    G.effectiveAtkBuffMult = G.atkBuffMult || CONFIG.ATK_BUFF_MULT;
    G.effectiveVulnMult = G.vulnMult || CONFIG.VULN_MULT;
    G.effectiveDefBuffRatio = G.defBuffRatio || CONFIG.DEF_BUFF_RATIO;
  }
}
```
**Target** — PURE function, returns the effects object, does NOT write to G:
```js
Zhan.Rules.computeEffectiveFury = function(playerHP, playerMaxHP, baseValues) {
  // baseValues = { furyEnabled, atkBuffMult, vulnMult, defBuffRatio }
  if (!baseValues.furyEnabled) {
    return {
      atkBuffMult: baseValues.atkBuffMult || CONFIG.ATK_BUFF_MULT,
      vulnMult: baseValues.vulnMult || CONFIG.VULN_MULT,
      defBuffRatio: baseValues.defBuffRatio || CONFIG.DEF_BUFF_RATIO
    };
  }
  var hpLoss = 1 - playerHP / playerMaxHP;
  var furyMult = 1 + hpLoss;
  var baseRatio = baseValues.defBuffRatio || CONFIG.DEF_BUFF_RATIO;
  return {
    atkBuffMult: (baseValues.atkBuffMult || CONFIG.ATK_BUFF_MULT) * furyMult,
    vulnMult: (baseValues.vulnMult || CONFIG.VULN_MULT) * furyMult,
    defBuffRatio: Math.max(0, 1 - (1 - baseRatio) * furyMult)
  };
};
```

---

### B. ALL CALL SITES — exact line references in core.js after Sprint 1

#### B1. Internal calls within these functions
After A3-A5: `calcAttackValue` internally calls `Zhan.Rules.calcBaseValue` and `Zhan.Rules.calcPursuitMultiplier` with `minCombo` parameter.

After A7: `computeCombos` internally calls `Zhan.Rules.resolveWildType`.

#### B2. executeTurn() — combo computation (L677)
**Before:** `var combos = computeCombos(G.slot);`
**After:** `var combos = Zhan.Rules.computeCombos(G.slot, G.effectiveMinCombo || CONFIG.MIN_COMBO);`

#### B3. executeTurn() — duration calcs (L691)
**Before:** `var dur = c.type === 'stun' ? getStunDuration(c.n) : getComboDuration(c.n);`
**After:** 
```js
var mc = G.effectiveMinCombo || CONFIG.MIN_COMBO;
var dur = c.type === 'stun' ? Zhan.Rules.getStunDuration(c.n, mc) : Zhan.Rules.getComboDuration(c.n, mc);
```

#### B4. executeTurn() — resolveWildType for attack/defend/heal (L729)
**Before:** `var st = resolveWildType(G.slot, si);`
**After:** `var st = Zhan.Rules.resolveWildType(G.slot, si);`

#### B5. executeTurn() — attack calc (L749-753)
**Before:**
```js
var baseAtk = calcBaseValue(atkTotal);
var d = calcAttackValue(atkTotal, atkMaxLen, G);
// ...
updateEffectiveFuryValues(G);
d = applyRelicModifiers('attack', d, G);
```
**After:**
```js
var mc = G.effectiveMinCombo || CONFIG.MIN_COMBO;
var baseAtk = Zhan.Rules.calcBaseValue(atkTotal, mc);
var d = Zhan.Rules.calcAttackValue(atkTotal, atkMaxLen, mc);
// Note: applyRelicModifiers is a no-op stub, can remove or keep
var furyEffects = Zhan.Rules.computeEffectiveFury(G.playerHP, G.playerMaxHP, {
  furyEnabled: G.furyEnabled,
  atkBuffMult: G.atkBuffMult,
  vulnMult: G.vulnMult,
  defBuffRatio: G.defBuffRatio
});
// Write fury values back to G (this is the runtime's job)
G.effectiveAtkBuffMult = furyEffects.atkBuffMult;
G.effectiveVulnMult = furyEffects.vulnMult;
G.effectiveDefBuffRatio = furyEffects.defBuffRatio;
d = Zhan.Rules.applyStatusEffects('attack', d, furyEffects);
```

#### B6. executeTurn() — pursuit log (L763)
**Before:** `calcPursuitMultiplier(atkMaxLen).toFixed(1)`
**After:** `Zhan.Rules.calcPursuitMultiplier(atkMaxLen, G.effectiveMinCombo || CONFIG.MIN_COMBO).toFixed(1)`

#### B7. executeTurn() — defend calc (L774-775)
**Before:**
```js
var baseDef = calcBaseValue(defTotal);
var shieldVal = calcDefendValue(defTotal, defMaxLen, G);
```
**After:**
```js
var mc = G.effectiveMinCombo || CONFIG.MIN_COMBO;
var baseDef = Zhan.Rules.calcBaseValue(defTotal, mc);
var shieldVal = Zhan.Rules.calcDefendValue(defTotal, defMaxLen, mc);
```

#### B8. executeTurn() — defend pursuit log (L779), same fix as B6.

#### B9. executeTurn() — heal calc (L789-790)
Same pattern as B7.

#### B10. executeTurn() — heal pursuit log (L794), same fix as B6.

#### B11. executeTurn() — wild type for penalty (L838)
**Before:** `var mt = resolveWildType(G.slot, si2);`
**After:** `var mt = Zhan.Rules.resolveWildType(G.slot, si2);`

#### B12. enemyTurn() / applyDamageToPlayer — fury update (L902)
**Before:** `updateEffectiveFuryValues(G);`
**After:**
```js
var furyEff = Zhan.Rules.computeEffectiveFury(G.playerHP, G.playerMaxHP, {
  furyEnabled: G.furyEnabled,
  atkBuffMult: G.atkBuffMult,
  vulnMult: G.vulnMult,
  defBuffRatio: G.defBuffRatio
});
G.effectiveAtkBuffMult = furyEff.atkBuffMult;
G.effectiveVulnMult = furyEff.vulnMult;
G.effectiveDefBuffRatio = furyEff.defBuffRatio;
```

#### B13. getEffectDescription() (L610-630) — this is a UI preview function in core.js.
It calls `getComboDuration`, `updateEffectiveFuryValues`, `getStunDuration`. 
Change all internal calls to Zhan.Rules versions with explicit params.
For fury: call `Zhan.Rules.computeEffectiveFury` then use the returned object for display.

#### B14. executeTurn — atk_down fury multiplier (L491 area, after sprint1)
Currently: `if (G.furyEnabled && RELICS.fury_core) atkDownPct = Math.min(100, atkDownPct * Zhan.Systems.Relic.getFuryMultiplier(G));`
This reads G but is a system call, not a rule. It stays as-is for this sprint (Sprint 3 will handle it).

#### B15. render() in ui.js (L8-60) — spirit bomb bar
**Before:** `var totalCards = CONFIG.TOTAL_CARDS;`
**After:** Compute dynamically from deckConfig:
```js
var totalCards = 0;
for (var k in G.deckConfig) totalCards += G.deckConfig[k];
```

#### B16. render() in ui.js — calls updateEffectiveFuryValues(G)
**Before:** `updateEffectiveFuryValues(G);` (L10)
**After:**
```js
var furyEff = Zhan.Rules.computeEffectiveFury(G.playerHP, G.playerMaxHP, {
  furyEnabled: G.furyEnabled,
  atkBuffMult: G.atkBuffMult,
  vulnMult: G.vulnMult,
  defBuffRatio: G.defBuffRatio
});
G.effectiveAtkBuffMult = furyEff.atkBuffMult;
G.effectiveVulnMult = furyEff.vulnMult;
G.effectiveDefBuffRatio = furyEff.defBuffRatio;
```

---

### C. After migration — remove old function stubs from core.js

Delete the old global `function calcBaseValue(...)`, `function calcPursuitMultiplier(...)`, etc. They should not exist anymore. Keep only `Zhan.Rules.*` versions.

---

### D. Cleanup: remove applyRelicModifiers stub

`function applyRelicModifiers(type, val, G) { return val; }` is a no-op. Remove it and its calls (B5 above already drops it).

---

## Build

After updating core.js and ui.js, produce `zhan_v1.97_sprint2.html` by properly UTF-8 encoding all content. 

**CRITICAL ENCODING REQUIREMENT**: Use .NET's `System.Text.Encoding.UTF8` with BOM when writing the output file. Do NOT use PowerShell's Out-File or Set-Content. Use:
```powershell
[System.IO.File]::WriteAllText($outputPath, $concatenatedHtml, [System.Text.UTF8Encoding]::new($true))
```

File concatenation order:
```
code/index.html →
  replace <script src="data.js"></script> with inline <script>data.js content</script>
  replace <script src="core.js"></script> with inline <script>core.js content</script>
  replace <script src="ui.js"></script> with inline <script>ui.js content</script>
  remove empty trailing <script></script>
```

Output: `C:\Users\kyzha\.openclaw\projects\zhan\zhan_v1.97_sprint2.html`

---

## Verifier Checklist

These must pass before declaring success:

1. **Pure function unit tests** (execute in browser F12 console):
   - `Zhan.Rules.calcBaseValue(5, 3) === 8` → true
   - `Zhan.Rules.calcBaseValue(3, 3) === 4` → true
   - `Zhan.Rules.calcPursuitMultiplier(5, 3) === 1.2` → true
   - `Zhan.Rules.resolveWildType([{type:'attack'}, {type:'wild'}], 1) === 'attack'` → true
   - `Zhan.Rules.getComboDuration(5, 3, 0)` — should return 3 (5-3+1=3)

2. **Double wild spirit fix**: Start game with `double_wild` relic → play through → spirit bomb bar should reach 100% when all cards consumed (not stuck at wrong percentage).

3. **Slot stacking**: Start game with both `slot_plus2` + `wild_core` → slot should display 13 slots (10+2+1).

4. **Damage consistency**: 5-combo attack with no relics → damage value same as v1.95 (should be: base=4+(5-3)*2=8, pursuit=1+(5-3)*0.1=1.2, attack=ceil(8*1.2)=10).

5. **No console errors** on page load.

6. **First two fights clearable** → third fight starts normally with random boss.

---

## DO NOT CHANGE

- Any numeric values or formulas
- data.js — off limits
- style.css, relic.css — off limits
- UI layout (index.html structure beyond script tag inlining)
- Boss trait handlers in Zhan.Systems.Boss
- The only allowed change in ui.js is B15 and B16 above
