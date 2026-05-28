# Verdict: bug_hide_intent — 美短虎斑第一回合意图泄漏

---

## 1. INPUT CASE

Case 1:
- 条件: boss = american_shorthair，新局（turn = 0）

Case 2:
- 条件: boss = american_shorthair，turn >= 1（后续回合）

Case 3:
- 条件: boss = tabby（狸花猫），新局

---

## 2. EXPECTED VALUE

Case 1:
- 敌人意图区域: 显示 "❓ 意图隐藏"

Case 2:
- 敌人意图区域: 显示 "❓ 意图隐藏"

Case 3:
- 敌人意图区域: 正常显示意图（攻击/防御/蓄力等）

---

## 3. ACTUAL VALUE

Case 1:
- 敌人意图区域: "❓ 意图隐藏"

  推导路径：
  1. `newGame()` 中 `G = { ... hideIntent: false ... }` 初始化 `hideIntent` 为 `false` (来源: core.js:112)
  2. BUGFIX 块遍历 `boss.traits`，检测到 `american_shorthair` 的 `traits[0].id === 'hide_intent'`，设置 `G.hideIntent = true` (来源: core.js:136-142)
  3. `render()` 被调用 (来源: core.js:153)
  4. `updateEnemyIntent()` 被调用，其中 `if (G.hideIntent)` 分支命中，设置 `innerHTML = '❓ 意图隐藏'` (来源: core.js:370-371)

  时间线：`hideIntent = false` → BUGFIX 设置 `true` → `render()` → `updateEnemyIntent()` 读取 `true` → 显示 "❓ 意图隐藏"
  
  → 第一回合意图隐藏 ✅

Case 2:
- 敌人意图区域: "❓ 意图隐藏"

  推导路径：
  1. `enemyTurn()` 末尾调用 `render()` 和 `updateEnemyIntent()` (来源: core.js:474-476)
  2. `enemyTurn()` 中执行 `onTurnStart` 时，`hide_intent` trait 再次设置 `G.hideIntent = true` (来源: data.js:216)
  3. `updateEnemyIntent()` 检查 `G.hideIntent === true`，显示 "❓ 意图隐藏" (来源: core.js:370-371)
  4. `G.hideIntent` 从未被重置为 `false`（符合"永久隐藏"描述）

  → 后续回合意图隐藏 ✅

Case 3:
- 敌人意图区域: 正常显示意图

  推导路径：
  1. `tabby` 的 `traits` 为 `[{ id: 'lock_pile', ... }]`，不包含 `hide_intent` (来源: data.js:133-150)
  2. BUGFIX 循环遍历 `boss.traits`，`lock_pile !== hide_intent`，不进入分支 (来源: core.js:136-142)
  3. `G.hideIntent` 保持初始值 `false` (来源: core.js:112)
  4. `updateEnemyIntent()` 跳过 `hideIntent` 分支，计算并显示正常意图 (来源: core.js:372-388)

  → 正常显示意图 ✅

---

## 4. DIFF

### Case 1: 美短虎斑第一回合

| 字段 | Expected | Actual | Match |
|------|----------|--------|-------|
| 第一回合意图显示 | ❓ 意图隐藏 | ❓ 意图隐藏 | ✅ |
| G.hideIntent 在 render() 前设置 | true | true | ✅ |
| BUGFIX 块在 newGame() 中位置 | 在 render() 之前 | core.js:136-142 (在 render() 的 core.js:153 之前) | ✅ |

### Case 2: 美短虎斑后续回合

| 字段 | Expected | Actual | Match |
|------|----------|--------|-------|
| 后续回合意图显示 | ❓ 意图隐藏 | ❓ 意图隐藏 | ✅ |
| onTurnStart 维持 hideIntent | true | data.js:216 → G.hideIntent = true | ✅ |

### Case 3: 狸花猫第一回合

| 字段 | Expected | Actual | Match |
|------|----------|--------|-------|
| 第一回合意图显示 | 正常意图（攻击/防御等） | 正常意图（攻击/防御等） | ✅ |
| G.hideIntent 保持 false | false | false (core.js:112, BUGFIX 不匹配) | ✅ |

### CHECKLIST 全覆盖验证

| # | Checklist 项 | 结果 | 说明 |
|---|-------------|------|------|
| 1 | 美短虎斑第一回合意图显示为"❓ 意图隐藏" | ✅ | BUGFIX 在 newGame() 中 render() 前设置 G.hideIntent = true |
| 2 | 其他 Boss 正常显示意图 | ✅ | tabby 无 hide_intent trait，intent 正常显示 |
| 3 | 美短的 buff/debuff 仍然可见（只有意图隐藏） | ✅ | 仅修改 G.hideIntent，不影响 buff/debuff 逻辑 |
| 4 | 第二回合及后续 hideIntent 正常工作 | ✅ | onTurnStart 维持 G.hideIntent = true |
| 5 | 新局后重置（非美短不隐藏意图） | ✅ | newGame() 初始 hideIntent = false，仅 hide_intent Boss 设 true |
| 6 | no side-effect on mechanics | ✅ | 仅改动 G.hideIntent，不涉及伤害/治疗/buff/连击/HP |
| 7 | no UI mismatch | ✅ | intent UI 行为与预期一致 |
| 8 | no runtime mismatch | ✅ | 代码路径清晰，无运行时冲突 |

---

## 5. FINAL DECISION: **PASS**

通过: 8/8

所有 CHECKLIST 项均通过。BUGFIX 正确地在 `newGame()` 的 `render()` 调用之前设置了 `G.hideIntent = true`，使美短虎斑第一回合意图正确隐藏。其他 Boss 不受影响。
