# 通配卡未消费扣血修复 — Playwright 验证

**Fixture**: `code/index.html` (含 `_consumedIndices` 修复)

| # | 测试 | 结果 | 详情 |
|---|---|---|---|
| 0 | 页面加载成功 | ✅ PASS |  |
| 1 | 场景1 wild+attack+wild+heal×9 unmatched=0 | ✅ PASS | unmatched=0 hpDelta=0 |
| 2 | 场景2 attack×5 unmatched=0 | ✅ PASS | unmatched=0 hpDelta=0 |
| 3 | 场景3 attack+attack+heal minCombo=3 unmatched=3 | ✅ PASS | unmatched=3 hpDelta=3 |

## 汇总
PASS: 4 / FAIL: 0

## 验证场景

| 场景 | 槽位 | minCombo | 预期 unmatched |
|---|---|---|---|
| 1 | 💎🗡💎❤×9 | 3 | 0 |
| 2 | 🗡×5 | 3 | 0 |
| 3 | 🗡🗡❤ | 3 | 3 |
