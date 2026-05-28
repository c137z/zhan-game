# Task: bug_hiss_endless — 哈气阈值 + 无尽去重

## GOAL
1. 修复：哈气在跌破 200 血和 100 血时触发（而非每 100 HP 都触发）
2. 确认无尽模式从已击败 boss 中排除（已验证 L868-874 过滤逻辑存在，如果不对就修）

## ROOT CAUSE
HISS_TRIGGER 用 floor(HP/100) 跨阈值触发，300→250（阈值 3→2）就触发。应改为固定阈值 [200, 100]。

## ALLOWED FILES
- code/data.js (哈气)
- code/core.js (无尽随机的 startEndlessNextCat，如需要)

## IMMUTABLE RULES
- 哈气效果不变：清空全场 Buff/Debuff
- 舔毛逻辑不动（GROOM_TRIGGER）
- 一次跨越多阈值只触发一次（如 300→199 同时过 200 和 100 线，只触发一次）
- ENDLESS_DEFEATED 结构不变
