# Task: bug_hiss_early — 猫猫Boss哈气过早触发 + 无尽随机修复

## GOAL
1. 诊断并修复：猫猫Boss 在 HP 还没到 200 以下就触发哈气
2. 修复：无尽模式去除被击败的 Boss 后从未击败的池中随机

## ROOT CAUSE Bug #4（哈气过早）
HISS_TRIGGER 的哈气阈值每 100 HP 检验一次。如果 boss 起始 300 HP，攻击后 250 HP（阈值从 3→2），就会触发哈气——即使没到 200。哈气有 3 个阶段是正确的：300→200→100，但每个阶段触发的时候条件可能太敏感。

建议修复方向：
- 将哈气触发调整为 fixed 阈值（200 HP、100 HP）
- 或者改进条件不跨过阶段检查

## ROOT CAUSE Bug #6（无尽随机）
当前 startEndlessNextCat 已正确过滤 ENDLESS_DEFEATED（L868-874）。需确认 endGame 中是否用 full pool（L989）重选而非过滤。

## ALLOWED FILES
- `code/data.js`（哈气阈值）
- `code/core.js`（哈气调用 + 无尽随机）

## IMMUTABLE RULES
- 哈气不能消失——仍然清空全场 buff/debuff
- 无尽模式必须跨 session 保留已击败的记录（ENDLESS_DEFEATED）
- 哈气触发改为固定阈值点时，仍需要处理跨阶段跳跃（如 300→199 只触发一次）
