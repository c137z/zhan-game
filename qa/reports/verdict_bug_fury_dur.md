# Verdict: fury_core × dur / stunDur 验证

**文件**: `code/core.js`  
**日期**: 2026-05-29  
**结果**: ✅ **全部通过 — 零 bug**

---

## 检查 1: getEffectDescription 中无 fury × dur

**结果**: ✅ PASS

`getEffectDescription`（line 355-386）中：
- `dur` 仅由 `getComboDuration(n)` 计算，fury 不参与
- `dur` 仅叠加 `G.buffDurationBonus`，fury 不参与
- `updateEffectiveFuryValues(G)` 只刷新 `effective*` 数值倍率，不影响 `dur`
- 所有 case（vulnerable / atk_buff / def_buff / atk_down）中的 `dur` 均未乘 fury

## 检查 2: getEffectDescription 中无 fury × stunDur

**结果**: ✅ PASS

- stun case（line 367-369）：`stunDur = getStunDuration(n)`，无 fury 参与
- 返回值仅使用 `stunDur`，无 fury 倍数

## 检查 3: Phase 1 vuln/atk_buff/def_buff/atk_down 中无 fury × dur

**结果**: ✅ PASS

Phase 1（line 434-470）：
- `dur` 计算（line 441-442）无 fury 参与
- 注释（line 434-435）明确标注："dur 不再乘 fury（狂暴核心只影响数值倍率，不影响持续回合）"
- vulnerable / atk_buff / def_buff 的 `dur` 均直接使用，未乘 fury
- atk_down 中 fury 仅影响 `atkDownPct`（百分比），不影响 `dur`

## 检查 4: stun case 无 fury

**结果**: ✅ PASS

- `getEffectDescription` stun case: 无 fury
- Phase 1 stun case（line 452-454）: 无 fury
- `enemyTurn()` stun 检查（line 720）: 无 fury

---

## 总结

4/4 检查全部通过。fury_core 的倍率**仅**通过 `updateEffectiveFuryValues()` 实时驱动 `effectiveAtkBuffMult` / `effectiveVulnMult` / `effectiveDefBuffRatio` 这三个**数值倍率**，**不**影响任何 `dur`（持续回合数）或 `stunDur`（眩晕回合数）。代码符合设计意图。
