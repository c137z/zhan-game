# 测试需求：BUFF_TYPES 未匹配散牌扣血验证

## 测试目标

验证 v2.5 中 computeUnmatchedPenalty 的修正：
- 只有已经在 combos 中形成合法连击的 buff 类型才跳过
- 未形成连击的 buff 散牌照样扣血

## 测试方法

Playwright page.evaluate()，因为 fixture 是旧版，需要在 page.evaluate 中手动实现 v2.5 逻辑。

## testCases

Case A: slot=[atk_buff×1], minCombo=3 → totalUnmatched=1
Case B: slot=[atk_buff×3, def_buff×1], minCombo=3 → totalUnmatched=1 (只def_buff扣)
Case C: slot=[attack×3, atk_buff×1], minCombo=3 → totalUnmatched=1 (只atk_buff扣)
Case D: slot=[attack×3, atk_buff×3, def_buff×1], minCombo=3 → totalUnmatched=1 (只def_buff扣)
Case E: slot=[attack×3, atk_buff×1, def_buff×1], minCombo=3 → totalUnmatched=2 (atk_buff+def_buff各扣)

## 实现思路

因为 fixture 是 v2.3（旧版 computeUnmatchedPenalty），需要在 page.evaluate 中用 JS 手动实现 v2.5 逻辑：
1. 调 Zhan.Rules.computeCombos(slot, minCombo) 获取 combos
2. 从 combos 提取 activeComboTypes = [...new Set(combos.map(c=>c.type))]
3. 遍历 slot，对每个非wild非special牌，resolveWildType，如果 activeComboTypes 包含且 BUFF_TYPES 下该类型存在 → 跳过；否则统计
4. totalUnmatched = 所有数量 < minCombo 的类型之和

## 输出

报告 tests/reports/buff-unmatched-verify-report.md

## 约束

- 脚本 tests/scripts/verify-buff-unmatched.js
- 不修改 fixture/code
- require('playwright')
- exit 0 = 5/5 PASS
