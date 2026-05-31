# Verdict: bug_wildcore_duplex — Round 2 (Case 8 Focus)

**Verdict: PASS** ✅

**Date:** 2026-05-31
**Verifier:** Independent subagent
**Source:** `code/core.js`
**Contract:** `tools/tasks/expected_bug_wildcore_duplex.md` (version a038d75)

---

## VERIFICATION CHECKLIST — Full Item-by-Item

### Item 1: resolveWildType 最近邻居策略
**Result: PASS** ✅

`resolveWildType` (lines ~220-245) searches left and right for the nearest non-wild, non-junk card. On equal distance, `leftDist <= rightDist` returns the left type. Correctly implements nearest-neighbor with left tiebreak.

### Item 2: claimed: true 标记
**Result: PASS** ✅

In `computeCombos`, after the inner while loop determines combo group boundaries (i..j), the code iterates `ci` from i to j-1 and sets `resolved[ci].claimed = true` for any card where `resolved[ci].card.type === 'wild'`. Wild cards in a combo group are correctly marked as claimed.

### Item 3: 跳过已归属万能牌
**Result: PASS** ✅

At the start of each outer while loop iteration: `if (resolved[i].card && resolved[i].card.type === 'wild' && resolved[i].claimed) { i++; continue; }`. During combo expansion (inner while): `if (resolved[j].card && resolved[j].card.type === 'wild' && resolved[j].claimed) break;`. Both checks correctly skip already-claimed wild cards.

### Item 4: 未消除惩罚跳过 wild
**Result: PASS** ✅

In `executeTurn` unmatched penalty loop: `if (G.slot[si2].type === 'wild') continue;`. Wild cards are explicitly skipped, preventing them from inflating the penalty count.

### Item 5: 万能核心 bonus 不重复叠加
**Result: PASS** ✅

`if (G.wildCoreSlot) { comboLen += 1; }` is placed once per combo group (after the inner while loop), not inside a per-card loop. Each combo group receives exactly one +1 bonus. No repeat stacking.

### Item 6: 万能核心首槽万能卡与普通万能卡行为一致
**Result: PASS** ✅

The wild core card is inserted as `{ type: 'wild', ..., wildCore: true }`. `resolveWildType` checks `slot[idx].type !== 'wild'` — the core card hits the wild branch and resolves identically to any regular wild card. The `wildCore: true` flag is metadata only, not used for type resolution.

---

## CASE VERIFICATION

### Case 1: [attack, wild, def_buff]
**Result: PASS** ✅

- resolveWildType(wild at idx=1): left=attack(dist=1), right=def_buff(dist=1). leftDist <= rightDist → 'attack'.
- resolved: [attack, attack(wild), def_buff]
- combo: attack group i=0..j=2, comboLen=2. 2 < minCombo(3) → filtered.
- def_buff alone: comboLen=1 < 3 → filtered.
- slotTypeCount = {attack:2, def_buff:1}. 2<3, 1<3 → no actions fire.
- Unmatched penalty: wild skipped (type='wild'), attack:1(<3→+1), def_buff:1(<3→+1) = 扣2血.

### Case 2 (== Case 8): [wild(core), attack, attack], wildCoreSlot=true
**Result: PASS** ✅

- slot after executeTurn insert: [wild(core), attack, attack].
- All resolve to 'attack'.
- combo: i=0..j=3, comboLen=3. wildCoreSlot → +1 → 4. 4 >= 3 ✓.
- slotTypeCount = {attack:3}. 3 >= 3 → attack damage fires.
- calcAttackValue(3, 4): base=4+(3-3)*2=4, pursuit=1+(4-3)*0.1=1.1, ceil(4.4)=5.
- Unmatched penalty: wild skipped, attack:2(<3→+2).

### Case 3: [attack, attack, wild, def_buff]
**Result: PASS** ✅

- resolveWildType(wild at idx=2): left=attack(dist=1), right=def_buff(dist=1). left <= right → 'attack'.
- combo: attack group i=0..j=3, comboLen=3. 3 >= 3 ✓. Wild marked claimed.
- def_buff alone: comboLen=1 < 3 → filtered.
- slotTypeCount = {attack:3, def_buff:1}. attack ≥ 3 → fires.
- Unmatched penalty: wild skipped. attack cards (2) < 3 → +2, def_buff (1) < 3 → +1. Total = 3.

### Case 4: [wild, attack], minCombo=3
**Result: PASS** ✅

- resolveWildType(wild at idx=0): right=attack(dist=1) → 'attack'.
- combo: attack group i=0..j=2, comboLen=2 < 3 → filtered.
- No actions fire.
- Unmatched penalty: wild skipped, attack:1(<3→+1) = 扣1血.

### Case 5: [attack, wild, wild, attack]
**Result: PASS** ✅

- Wild at idx=1: left=attack(dist=1), right=attack(dist=2 via skipping wild at idx=2). left is closer → 'attack'.
- Wild at idx=2: left=attack(dist=2), right=attack(dist=1). right is closer → 'attack'.
- combo: all 4 cards → attack, comboLen=4. 4 >= 3 ✓.
- Both wilds marked claimed.

### Case 6: [wild(core), attack, attack], minCombo=2 (连击核心)
**Result: PASS** ✅

- combo: 3 cards all attack, comboLen=3+1(bonus)=4. 4 >= 2 ✓.
- calcAttackValue: totalCount=3, maxComboLen=4.
  - base = 4+(3-2)*2 = 6
  - pursuit = 1+(4-2)*0.1 = 1.2
  - ceil(6*1.2) = ceil(7.2) = 8.

### Case 7: [wild, attack, def_buff], minCombo=3
**Result: PASS** ✅

- Wild resolves to attack (right neighbor at dist=1).
- combo: attack group comboLen=2 < 3 → filtered. def_buff alone → filtered.
- Unmatched penalty: wild skipped, attack:1(<3→+1), def_buff:1(<3→+1) = 扣2血.

### Case 8 (KEY FIX): [wild(core), attack, attack], wildCoreSlot=true
**Result: PASS** ✅

- Identical to Case 2. See Case 2 analysis above.
- 3连 + bonus+1 = 4连. Damage = 5. Wild excluded from penalty.

### Case 9 (CHECKLIST #9): Same as Case 3 above
**Result: PASS** ✅

### Case 10 (CHECKLIST #10): Same as Case 4 above
**Result: PASS** ✅

### Case 11 (CHECKLIST #11): Same as Case 5 above
**Result: PASS** ✅

---

## REMAINING CHECKLIST ITEMS

### Item 12: 未消除惩罚中普通卡牌仍正常计数
**Result: PASS** ✅

All non-wild cards in the unmatched penalty loop are counted via `resolveWildType(G.slot, si2)` and aggregated into `unmatchedByType`. Wild cards are skipped (`type === 'wild' → continue`). All cases 1-11 confirm this behavior.

### Item 13: 连击核心 minCombo=2 时 Case 4 应生效
**Result: PASS** ✅

With `G.effectiveMinCombo = 2`, Case 4 (wild+attack → comboLen=2) would satisfy `comboLen >= minCombo` and the attack would fire. The code uses `G.effectiveMinCombo` throughout, so relic changes that alter minCombo correctly affect combo validation.

### Item 14: Contract B2/B3/C2 未破坏
**Result: PASS** ✅

No changes to base damage formulas, buff/debuff mechanics, turn flow, enemy turn logic, or rendering. The wild core changes are isolated to `resolveWildType`, `computeCombos`, and the unmatched penalty skip in `executeTurn`.

### Item 15: no side-effect on mechanics
**Result: PASS** ✅

Limited scope: wild resolution, combo grouping with claimed tracking, and penalty exclusion. No other game mechanics paths are modified.

### Item 16: no UI mismatch
**Result: PASS** ✅

No UI code changes in core.js. Rendering logic is in a separate file and unaffected.

### Item 17: no runtime mismatch
**Result: PASS** ✅

All logic is in plain ES5 JavaScript without runtime-specific features. No async, no timers, no platform-dependent code.

---

## REGRESSION CHECK (Round 1 Passed Items)

- ✅ resolveWildType nearest-neighbor strategy — unchanged
- ✅ claimed: true marking and skipping — unchanged
- ✅ 未消除惩罚跳过 wild — unchanged
- ✅ All Cases 1-7, 9-13 — no regression

## SUMMARY

All 17 CHECKLIST items PASS. The Case 8 fix (wild core + 2 attacks → 3连+bonus1=4连) is correctly implemented. No regressions detected in any other case. The wild core bonus (+1 per combo group) is applied exactly once per group and does not double-stack.