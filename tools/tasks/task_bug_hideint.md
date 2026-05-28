# Task: bug_hide_intent — 美短虎斑第一回合意图泄漏

## GOAL
修复：美短虎斑第一回合意图区显示"❓ 意图隐藏"，而非暴露实际行动。

## ROOT CAUSE
newGame() 渲染时 hideIntent 仍为 false（onTurnStart trait 在第一次 enemyTurn 才触发，第一回合已经过去了）。

## ALLOWED FILES
- code/core.js

## IMMUTABLE RULES
- hideIntent 值不变（false 初始值在 newGame 中保留）
- 修复方式：newGame() 中，render() 之前，检查 boss traits 是否有 hide_intent trait，如有则立即设 G.hideIntent = true
- 不碰 data.js 中的 boss 定义
- 其他 Boss 的第一回合意图不受影响
