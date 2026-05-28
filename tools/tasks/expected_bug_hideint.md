# Expected: bug_hide_intent — 美短虎斑第一回合意图泄漏

Contract version: a038d75

## VERIFICATION CHECKLIST (IMMUTABLE)

1. newGame() 中 render() 之前，检测 boss traits 含 hide_intent 时设 G.hideIntent = true
2. 美短虎斑第一回合意图区显示"❓ 意图隐藏"
3. 狸花猫第一回合意图正常显示（不受影响）
4. 其他无 hide_intent trait 的 Boss 首回合意图正常
5. hideIntent 的 onTurnStart 逻辑仍正常运行（后续回合也隐藏）
6. 重置/新局后，非美短 Boss 意图正常显示
7. Contract B3: G.phase 白名单未破坏
8. no side-effect on mechanics
9. no UI mismatch
10. no runtime mismatch

## INPUT CASE + EXPECTED VALUE

### Case 1: 美短第一回合
- 条件：boss = american_shorthair，新局，turn=0
- 预期：enemy-intent 显示 "❓ 意图隐藏"

### Case 2: 狸花猫第一回合
- 条件：boss = tabby，新局，turn=0
- 预期：enemy-intent 正常显示攻击/防御等意图

### Case 3: 美短后续回合
- 条件：boss = american_shorthair，turn=5（onTurnStart 已触发）
- 预期：enemy-intent 显示 "❓ 意图隐藏"
