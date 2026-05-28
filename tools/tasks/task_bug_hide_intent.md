# Task: bug_hide_intent — 美短虎斑第一回合意图泄漏

## GOAL
修复：美短虎斑应隐藏行动意图，但第一回合意图被 UI 暴露。

## ROOT CAUSE
美短通过 `onTurnStart` trait 设置 `G.hideIntent = true`。但 newGame() 不会触发 onTurnStart（首次加载时渲染了 UI），所以第一回合展示时 hideIntent 仍是 false 的默认值。

## ALLOWED FILES
- `code/core.js`

## IMMUTABLE RULES
- hideIntent 必须在第一次 updateEnemyIntent() 调用前被设置为 true
- 其他 Boss 不受影响
- hideIntent 应在 newGame() 初始化时检查，如果 boss 有 hide_intent trait 就立即设置为 true
