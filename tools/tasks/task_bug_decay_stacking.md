# Task: bug_decay_stacking — 减攻回合衰减异常

## GOAL
修复：3连减攻打出 3 回合，回合结束→下一回合变成 4 回合。预期保持 3 回合（衰减 -1 又叠加 +1 → 3 回合）。

## ROOT CAUSE
atk_down 的衰减在 enemyTurn 结束时（core.js L772-774），但 Phase 1 累积在 executeTurn 中（L466）。导致旧 atk_down 还没衰减就叠加了新 atk_down。

玩家 1 回合流程：
1. Phase 1: atk_down = 0 + 3 → 3 回合
2. Phase 2/3: atk_down 未衰减（衰减在 enemyTurn 末尾）
3. enemyTurn: 执行
4. L772-774: atk_down 衰减 3→2
5. 下回合 Phase 1: atk_down = 2 + 1（新 3 连）= 3 回合 ❌ 正常
但如果旧值还有 3 时新加 1 → 3 + 1 = 4（旧值还没减掉）

## ALLOWED FILES
- `code/core.js`

## IMMUTABLE RULES
- atk_down 的衰减逻辑必须一起改
- 可接受的修复：将 atk_down 衰减从 enemyTurn 移到 executeTurn 的 Phase 3
- 或者：atk_down 先衰减再叠加（Phase 1 前先衰减）
