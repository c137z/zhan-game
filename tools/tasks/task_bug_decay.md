# Task: bug_decay — 减攻回合衰减异常

## GOAL
修复：3连减攻打出 3 回合，回合结束后下一回合变成 4 回合。预期保持 3 回合（衰减 -1 再叠加 +1）。

## ROOT CAUSE
atk_down 衰减在 enemyTurn 末尾（L772-774），叠加在 executeTurn Phase 1（L466）。旧值未衰减就叠新值。

## ALLOWED FILES
- code/core.js

## IMMUTABLE RULES
- 不改编 enemyEffects 中 stun/vulnerable 的衰减时机（留在 enemyTurn 末尾）
- 仅改 atk_down 衰减：从 enemyTurn 末尾移到 executeTurn Phase 3（atk_buff 衰减同位置），让 atk_down 先衰减再叠加
- 不碰 data.js
