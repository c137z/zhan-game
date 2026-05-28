# Task: bug_boss_log_emoji — 战斗日志显示毛线团而非猫猫Boss名字

## GOAL
修复：所有战斗日志中硬编码的毛线团 🧶 应改为使用当前 Boss 的 emoji。到了 boss 关后，日志应显示猫猫Boss 名字。

## ROOT CAUSE
core.js 中所有战斗日志行硬编码了 🧶，包括：
- L512：攻击日志
- L551：特攻日志
- L593：击败日志
- L656：敌人行动日志
- L728：敌人攻击日志
- L733/L738/L742：防御/蓄力/蓄力中日志
- L859/L863：败北日志
- L512/615/794：HP 显示日志

应统一为 `G.boss.emoji`。

## ALLOWED FILES
- `code/core.js`

## IMMUTABLE RULES
- 只有战斗日志中的 🧶 被改，非日志不碰
- 第一关仍然显示毛线团（skeleton boss 的 emoji 现在是 🧶）
- 猫猫Boss 的 emoji 从 BOSSES 定义正确读取
- 不要更新毛线团 boss本身的 emoji
