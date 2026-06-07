# 过载核心 + 舔毛周期 验证报告

> 版本：v2.4 逻辑验证（基于 v2.3-baseline fixture + 手动注入 v2.4 逻辑）
> 时间：2026-06-05 09:23
> 环境：Playwright + Chrome headless

## Part A: 过载核心持续减半

v2.4 规则: `dur = max(1, floor(getComboDuration(n, mc) / 2))` (仅 overload_core 激活时)

| # | 测试 | n | mc | baseDur | overload | v2.4 dur | 期望 | 结果 |
|---|------|---|---|---------|----------|----------|------|------|
| 1 | 3连 无overload | 3 | 3 | 1 | false | 1 | 1 | ✅ |
| 2 | 3连 + overload | 3 | 3 | 1 | true | 1 | 1 | ✅ |
| 3 | 4连 + overload | 4 | 3 | 2 | true | 1 | 1 | ✅ |
| 4 | 5连 + overload | 5 | 3 | 3 | true | 1 | 1 | ✅ |
| 5 | 10连 + overload | 10 | 3 | 8 | true | 4 | 4 | ✅ |
| 6 | 10连 无overload | 10 | 3 | 8 | false | 8 | 8 | ✅ |

## Part B: 舔毛周期 4→5

v2.4 规则: `(turn + 1) % 5 === 0` (原 `% 4`)

| # | 描述 | turn | v2.3 (%4) | v2.4 (%5) | 期望触发 | 结果 |
|---|------|------|-----------|-----------|----------|------|
| 1 | turn=3 (第4回合) | 3 | true | false | false | ✅ |
| 2 | turn=4 (第5回合) | 4 | false | true | true | ✅ |
| 3 | turn=9 (第10回合) | 9 | false | true | true | ✅ |
| 4 | turn=0 (第1回合) | 0 | false | false | false | ✅ |
| 5 | turn=14 (第15回合) | 14 | false | true | true | ✅ |

## 总结

| 部分 | 通过 | 总数 |
|------|------|------|
| Part A (过载持续) | 6 | 6 |
| Part B (舔毛周期) | 5 | 5 |

**最终结论**: ✅ ALL PASS

---
*verify-overload-groom.js — 2026-06-05T09:23:12.527Z*