# Expected: bug_boss_emoji — 战斗日志硬编码骷髅 emoji

Contract version: a038d75

## VERIFICATION CHECKLIST (IMMUTABLE)

1. 所有 log() 调用中无剩余硬编码 💀（搜索 '💀' 在 core.js log 调用中）
2. 所有日志行使用 G.boss.emoji 动态取值
3. 攻击结算日志正确显示当前 Boss emoji
4. 敌人行动日志正确显示当前 Boss emoji
5. 击败/败北日志正确显示当前 Boss emoji
6. HP 显示日志正确显示当前 Boss emoji
7. 第一关（skeleton，emoji=💀）日志仍显示 💀
8. Contract B2/B3 未破坏
9. no side-effect on mechanics
10. no UI mismatch
11. no runtime mismatch

## INPUT CASE + EXPECTED VALUE

### Case 1: 毛线团日志
- 条件：boss = skeleton（emoji=💀），玩家攻击
- 预期：log 中显示 💀（通过 G.boss.emoji 取到 💀）

### Case 2: 猫猫Boss 日志
- 条件：boss = tabby（emoji=🐱），敌人行动
- 预期：log 中显示 🐱

### Case 3: 击败
- 条件：enemyHP 归零
- 预期：log 显示正确 Boss emoji
