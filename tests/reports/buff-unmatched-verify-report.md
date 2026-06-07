# BUFF_TYPES 未匹配散牌扣血修正验证报告

> 版本：v2.5 逻辑验证（基于 v2.3-baseline fixture + 手动注入 v2.5 逻辑）
> 时间：2026-06-05 10:17
> 环境：Playwright + Chrome headless
> minCombo = 3 (CONFIG.MIN_COMBO)

## 测试结果

| Case | 描述 | 槽位 | combos | activeBuffTypes | unmatchedByType | total | 期望 | 结果 |
|------|------|------|--------|-----------------|-----------------|-------|------|------|
| A | atk_buff×1 无连击 | 1 | 0 [] | [] | {} | 0 | 1 | ❌ |
| B | atk_buff×3有连击 + def_buff×1散牌 | 4 | 1 [atk_buff] | [atk_buff] | {"def_buff":1} | 1 | 1 | ✅ |
| C | attack×3有连击 + atk_buff×1散牌 | 4 | 1 [attack] | [] | {"attack":3} | 0 | 1 | ❌ |
| D | attack×3+atk_buff×3都有连击 + def_buff×1散牌 | 7 | 2 [attack,atk_buff] | [atk_buff] | {"attack":3,"def_buff":1} | 1 | 1 | ✅ |
| E | attack×3有连击 + atk_buff×1+def_buff×1都是散牌 | 5 | 1 [attack] | [] | {"attack":3} | 0 | 2 | ❌ |

**结论**: 2/5 PASS

---
*verify-buff-unmatched.js — 2026-06-05T10:17:46.128Z*