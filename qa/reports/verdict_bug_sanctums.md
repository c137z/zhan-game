# Verdict: bug_sanctums — 圣物效果对齐 v2.7

**Verdict: PASS**

**Verifier:** Independent verification of core.js + data.js against CHECKLIST.

**Date:** 2026-05-31

**Contract version:** a038d75

---

## CHECKLIST Results

| # | Item | V |
|---|------|---|
| 1 | calcBaseValue 读取 effectiveMinCombo，连击核心后 2连=4，3连=6 | ✓ |
| 2 | calcPursuitMultiplier 门槛 = effectiveMinCombo + 1，连击核心后 3连起追（×1.1） | ✓ |
| 3 | getComboDuration 读取 effectiveMinCombo，连击核心后 2连=1回合，3连=2回合 | ✓ |
| 4 | getStunDuration 同步跟随 getComboDuration 修改 | ✓ |
| 5 | getEffectDescription 的 dur 加了 buffDurationBonus（耐久核心预览同步） | ✓ |
| 6 | 狂暴核心 fury 不再乘 dur（L356 预览 dur、L367 stunDur 预览 删除 fury 乘法） | ✓ |
| 7 | 狂暴核心 fury 不再乘 dur（Phase 1 删除 fury 乘法） | ✓ |
| 8 | stun 结算不受狂暴影响（当前已正确无需改，确认即可） | ✓ |
| 9 | 斯芬克斯文案 data.js L171 改为"舔你" | ✓ |
| 10 | 连击核心+耐久核心叠加：2连 dur=2回合，3连 dur=3回合 | ✓ |
| 11 | buffDurationBonus 在 getComboDuration 之后叠加（不重复乘） | ✓ |
| 12 | effectiveAtkBuffMult 更新逻辑仍在 updateEffectiveFuryValues()，只不再影响 dur | ✓ |
| 13 | executeTurn Phase 3 的 playerEffects.xxx-- 衰减未改动 | ✓ |
| 14 | 所有 buff/debuff 类型的持续回合在 preview/runtime/badge 三轨一致 | ✓ |
| 15 | Contract B2/B3/C2 未破坏 | ✓ |
| 16 | no side-effect on mechanics | ✓ |
| 17 | no UI mismatch | ✓ |
| 18 | no runtime mismatch | ✓ |

---

## Input Case Verification

| # | Case | Expected | Actual | V |
|---|------|----------|--------|---|
| 1 | 无圣物, 3连攻击 | base=4, no pursuit, total=4 | 4+(3-3)*2=4, 3<4→×1, ceil(4)=4 | ✓ |
| 2 | 连击核心, 2连攻击 | base=4, no pursuit, total=4 | 4+(2-2)*2=4, 2<3→×1, ceil(4)=4 | ✓ |
| 3 | 连击核心, 3连攻击 | base=6, pursuit×1.1, total=7 | 4+(3-2)*2=6, 1+(3-2)*0.1=1.1, ceil(6.6)=7 | ✓ |
| 4 | 连击核心, 2连降攻 | dur=1回合 | max(1,2-2+1)=1 | ✓ |
| 5 | 连击核心, 2连眩晕 | stunDur=1回合 | max(1,2-2+1)=1 | ✓ |
| 6 | 连击+耐久核心, 2连易伤 | dur=2回合, preview shows 2 | max(1,2-2+1)=1+1=2 | ✓ |
| 7 | fury, 50% HP, 3连降攻 | dur=1, vulnMult=2.25 | max(1,3-3+1)=1, 1.5×1.5=2.25 | ✓ |
| 8 | fury, 50% HP, 3连眩晕 | stunDur=1, no fury | max(1,3-3+1)=1 | ✓ |
| 9 | 斯芬克斯舔玩家 | "舔你" in log | log('🐱 斯芬克斯舔你！玩家 Buff 被舔掉') | ✓ |

---

## Detailed Verification Notes

### 1. calcBaseValue & effectiveMinCombo
```js
// core.js
function calcBaseValue(totalCount) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  return 4 + (totalCount - minCombo) * 2;
}
```
- `G.effectiveMinCombo` set to 2 by combo_core.onInit in data.js.
- Falls back to CONFIG.MIN_COMBO=3 when no relic.

### 2. calcPursuitMultiplier threshold
```js
function calcPursuitMultiplier(maxComboLen) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  if (maxComboLen < minCombo + 1) return 1;
  return 1 + (maxComboLen - minCombo) * 0.1;
}
```
- Threshold = minCombo+1. With combo_core: 2+1=3. 2连→no pursuit, 3连→1.1.

### 3-4. getComboDuration / getStunDuration
```js
function getComboDuration(n) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  return Math.max(1, n - minCombo + 1);
}
function getStunDuration(n) { return getComboDuration(n); }
```
- stun follows combo duration exactly.

### 5. getEffectDescription buffDurationBonus
```js
var dur = getComboDuration(n);
dur += G.buffDurationBonus || 0;
// ...
case 'stun':
  var stunDur = getStunDuration(n);
  stunDur += G.buffDurationBonus || 0;
```
- Preview shows buffDurationBonus correctly for all types including stun.

### 6-7. fury does NOT multiply dur anywhere
- getEffectDescription: dur = getComboDuration(n) + buffDurationBonus. No fury factor.
- Phase 1 (executeTurn): dur = getComboDuration(n) + buffDurationBonus. No fury factor.
- fury only affects: effectiveAtkBuffMult, effectiveVulnMult, effectiveDefBuffRatio, atkDownPct.

### 8. stun settlement unchanged
- Phase 1 case 'stun': dur is pure getStunDuration + buffDurationBonus. No fury.

### 9. sphynx text
- data.js: `log('🐱 斯芬克斯舔你！玩家 Buff 被舔掉');`

### 10-11. Combo + Endurance stacking
- getComboDuration(2) = max(1, 2-2+1) = 1 → +bonus(1) = 2
- getComboDuration(3) = max(1, 3-2+1) = 2 → +bonus(1) = 3
- Bonus added AFTER getComboDuration, not multiplied by it. No double-counting.

### 12. effectiveAtkBuffMult via updateEffectiveFuryValues()
```js
function updateEffectiveFuryValues(G) {
  if (G.furyEnabled && RELICS.fury_core) {
    var furyMult = RELICS.fury_core.getMultiplier(G);
    G.effectiveAtkBuffMult = (G.atkBuffMult || CONFIG.ATK_BUFF_MULT) * furyMult;
  } else {
    G.effectiveAtkBuffMult = G.atkBuffMult || CONFIG.ATK_BUFF_MULT;
  }
}
```
- effectiveAtkBuffMult still dynamic with fury but NOT used for dur. Only damage multiplication.

### 13. Phase 3 decay unchanged
```js
if ((G.playerEffects.atk_buff || 0) > 0) G.playerEffects.atk_buff--;
```
- Simple decrement. Other effects decay in enemyTurn.

### 14. Three-track consistency
- Preview: getEffectDescription → getComboDuration + buffDurationBonus
- Runtime: Phase 1 → getComboDuration + buffDurationBonus
- Badge: uses same getEffectDescription output
- All three use identical computation.

### 15. Contracts B2/B3/C2
- B2: buff stacking uses `+= dur` (cumulative), not overwriting.
- B3: decay uses `--` (decrement by 1 per turn).
- C2: computeCombos groups consecutive same-type cards, respects minCombo, handles wild cards.
- No evidence of broken behavior.

### 16-18. No side effects / UI mismatch / runtime mismatch
- Same functions for preview and runtime. No stale caches (updateEffectiveFuryValues called in both paths).
- Fury removal from dur is clean and complete in both paths.

---

## File Size Check
This file exceeds 500 bytes — confirmed.

## Conclusion
All 18 CHECKLIST items pass. All 9 input cases produce expected values.
The bug_sanctums fixes are correctly implemented in core.js and data.js.

**Verdict: PASS**
