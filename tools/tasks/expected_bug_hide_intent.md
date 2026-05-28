# Expected: bug_hide_intent — 美短虎斑第一回合意图泄漏

## VERIFICATION CHECKLIST (IMMUTABLE)

1. 美短虎斑第一回合意图显示为"❓ 意图隐藏"
2. 其他 Boss 正常显示意图
3. 美短的 buff/debuff 仍然可见（只有意图隐藏）
4. 第二回合及后续 hideIntent 正常工作
5. 新局后重置（非美短不隐藏意图）
6. no side-effect on mechanics
7. no UI mismatch
8. no runtime mismatch

## INPUT CASE + EXPECTED VALUE

### Case 1: 美短虎斑第一回合
- 条件：boss = american_shorthair，新局
- 预期：敌人意图区域显示"❓ 意图隐藏"

### Case 2: 美短虎斑后续回合
- 条件：boss = american_shorthair，turn >= 1
- 预期：敌人意图区域显示"❓ 意图隐藏"

### Case 3: 狸花猫第一回合
- 条件：boss = tabby，新局
- 预期：正常显示意图（攻击/防御等）
