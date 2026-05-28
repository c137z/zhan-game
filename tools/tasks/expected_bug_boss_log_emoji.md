# Expected: bug_boss_log_emoji — 战斗日志显示毛线团而非猫猫Boss

## VERIFICATION CHECKLIST (IMMUTABLE)

1. 所有战斗日志行使用动态 Boss emoji，非硬编码 🧶
2. 第一关（毛线团）仍显示 🧶
3. 猫猫Boss 关显示各自 emoji（狸花猫 🐱、橘猫 🐈 等）
4. 日志格式不变——只有 emoji 从硬编码 → 变量
5. 所有日志类型覆盖：攻击/特攻/击败/敌人行动/HP显示/败北
6. 预览/UI 不受影响
7. no side-effect on mechanics
8. no UI mismatch
9. no runtime mismatch

## INPUT CASE + EXPECTED VALUE

### Case 1: 第一关毛线团日志
- 条件：boss = skeleton，玩家攻击
- 预期：日志中显示 🧶

### Case 2: 猫猫Boss 日志
- 条件：boss = tabby（狸花🐱），敌人行动
- 预期：日志中显示 🐱 而非 🧶

### Case 3: 击败
- 条件：enemyHP 归零
- 预期：日志显示正确 Boss emoji
