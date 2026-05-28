# Verdict: bug_hide_intent — 美短虎斑第一回合意图泄漏

**Contract version**: a038d75  
**Verification date**: 2026-05-28  
**Role**: verifier (只做验证，不改代码)  

## 结论：✅ PASS — 所有 10 项 CHECKLIST 全部通过

---

## CHECKLIST 逐项验证

### Item 1: newGame() 中 render() 之前，检测 boss traits 含 hide_intent 时设 G.hideIntent = true

**结果：✅ PASS**

**来源**：`code/core.js`

- `G.hideIntent` 初始值为 `false` — 行 148（`hideIntent: false,` 在 `G = {...}` 对象字面量中）
- hide_intent 检测逻辑 — 行 175-183：
  ```javascript
  // 美短虎斑 hide_intent：必须在首次 render() 前设置，避免第一回合意图泄漏
  if (boss.traits) {
    for (var _bi = 0; _bi < boss.traits.length; _bi++) {
      if (boss.traits[_bi].id === 'hide_intent') {
        G.hideIntent = true;
        break;
      }
    }
  }
  ```
- `render()` 调用 — 行 193
- `updateEnemyIntent()` 调用 — 行 194

**序列**：hide_intent 检测（175-183） → render()（193） → updateEnemyIntent()（194）。  
检测在 render() 之前，✅ 符合要求。

---

### Item 2: 美短虎斑第一回合意图区显示"❓ 意图隐藏"

**结果：✅ PASS**

**来源**：`code/core.js`

- `updateEnemyIntent()` 函数 — 行 898-932
- `G.hideIntent` 检查 — 行 903-906：
  ```javascript
  if (G.hideIntent) {
    document.getElementById('enemy-intent').innerHTML = '❓ 意图隐藏';
    return;
  }
  ```

**推理**：Item 1 已证实 `G.hideIntent = true` 在首次 `updateEnemyIntent()` 调用之前被设置，因此首回合 `updateEnemyIntent()` 会在第 903 行命中 `G.hideIntent === true`，返回 "❓ 意图隐藏"。

---

### Item 3: 狸花猫第一回合意图正常显示（不受影响）

**结果：✅ PASS**

**来源**：
- `code/data.js` 行 126-135 — tabby（狸花猫）定义，traits 仅包含 `lock_pile`，不含 `hide_intent`
- `code/core.js` 行 175-183 — hide_intent 检测，仅当 `boss.traits[_bi].id === 'hide_intent'` 时设置

**推理**：狸花猫 traits 中无 `hide_intent`，newGame() 中检测循环不会匹配，`G.hideIntent` 保持默认 `false`（行 148），`updateEnemyIntent()` 正常走意图计算分支（行 908+），显示正常攻击/防御等意图。

---

### Item 4: 其他无 hide_intent trait 的 Boss 首回合意图正常

**结果：✅ PASS**

**来源**：
- `code/core.js` 行 175-183 — hide_intent 检测仅匹配 `id === 'hide_intent'`
- `code/data.js` — 所有 Boss 定义中仅 `american_shorthair`（行 209-216）有 `hide_intent` trait

**推理**：其他所有 Boss（tabby、abyssinian、ragdoll、scottish_fold、british_shorthair、maine_coon、skeleton、catToy）均无 `hide_intent` trait。hide_intent 检测是白名单式匹配，不会误触发。`G.hideIntent` 保持 `false`，意图正常显示。

---

### Item 5: hideIntent 的 onTurnStart 逻辑仍正常运行（后续回合也隐藏）

**结果：✅ PASS**

**来源**：
- `code/data.js` 行 214 — american_shorthair 的 hide_intent trait：`{ id: 'hide_intent', onTurnStart: function(G) { G.hideIntent = true; } }`
- `code/core.js` 行 706-712 — `enemyTurn()` 中调用 `trait.onTurnStart(G)`：
  ```javascript
  if (G.boss.traits) {
    for (var ti = 0; ti < G.boss.traits.length; ti++) {
      var trait = G.boss.traits[ti];
      if (trait.onTurnStart) trait.onTurnStart(G);
      if (G.over) return;
    }
  }
  ```

**推理**：newGame() 设 `G.hideIntent = true`（首回合），后续每个敌方回合开始时 onTurnStart 都会再次设置 `G.hideIntent = true`（行 214 的闭包）。`updateEnemyIntent()` 的检查（行 903）在每次渲染后都会重新判断。且 `G.hideIntent` 从未在任何地方被重置为 `false`（美短虎斑一旦开始就永久隐藏），后续回合意图持续隐藏。

---

### Item 6: 重置/新局后，非美短 Boss 意图正常显示

**结果：✅ PASS**

**来源**：
- `code/core.js` 行 113-197 — `newGame()` 完整重设 `G` 对象
- `code/core.js` 行 148 — `hideIntent: false`（默认值，每次 newGame 都重置）
- `code/core.js` 行 175-183 — hide_intent 检测仅对含 `hide_intent` trait 的 Boss 生效

**推理**：每次调用 `newGame()`（包括重置、新局、startNextStage、startEndlessNextCat）都会完整重建 `G` 对象（行 118 的 `G = {...}`），`hideIntent` 重置为 `false`（行 148）。如果新 Boss 非美短，检测不命中，意图正常。如果新 Boss 是美短，检测命中，意图隐藏。无状态泄漏。

---

### Item 7: Contract B3: G.phase 白名单未破坏

**结果：✅ PASS**

**来源**：`code/core.js`

- `G.phase` 初始值 — 行 130：`phase: 'player'`
- `updateEnemyIntent()` 中对 `G.phase` 的检查 — 行 899-901：
  ```javascript
  if (G.phase === 'enemy') {
    document.getElementById('enemy-intent').innerHTML = '⏳ 行动中...';
    return;
  }
  ```

**推理**：hideIntent 检查（行 903）在 G.phase 检查（行 899）之后。当 `G.phase === 'enemy'` 时先命中行 899 返回 "⏳ 行动中..."，不会进入 hideIntent 检查。`G.phase` 的合法值：`'player'`（行 130）、`'resolving'`（行 395）、`'enemy'`（enemyTurn 末尾行 808）、`'over'`（endGame 行 820）。hideIntent 逻辑未修改 G.phase 白名单。

---

### Item 8: no side-effect on mechanics

**结果：✅ PASS**

**来源**：`code/core.js` 行 175-183

**推理**：hide_intent 检测仅做两件事：
1. 遍历 `boss.traits` 查找 `id === 'hide_intent'`
2. 命中时设置 `G.hideIntent = true`

不修改卡牌、伤害、Buff/Debuff、回合流程、圣物、牌堆、槽位等任何其他游戏机制。纯标记位操作，无副作用。

---

### Item 9: no UI mismatch

**结果：✅ PASS**

**来源**：
- `code/core.js` 行 903-906 — `updateEnemyIntent()` 中 hideIntent 分支直接设置 innerHTML = '❓ 意图隐藏' 并 return
- `code/ui.js` 行 8-74 — `render()` 不调用 `updateEnemyIntent()`，也不直接修改 `enemy-intent` DOM

**推理**：`render()` 只渲染 HP、护盾、能量、头像、名称、Badge、牌堆、槽位等 UI 元素，不触碰 `enemy-intent`。`enemy-intent` 唯一更新点是通过 `updateEnemyIntent()`（newGame 行 194、executeTurn 行 389/612、enemyTurn 行 701/810 等处调用）。显示逻辑单一入口，无 UI 不一致风险。

---

### Item 10: no runtime mismatch

**结果：✅ PASS**

**来源**：
- `code/core.js` 行 175-183 — hide_intent 检测逻辑
- `code/data.js` 行 214 — american_shorthair 的 hide_intent trait 定义：`{ id: 'hide_intent', onTurnStart: function(G) { G.hideIntent = true; } }`

**推理**：newGame() 中的检测（行 175-183）和 onTurnStart 中的设置（data.js 行 214）完全一致 — 都是设置 `G.hideIntent = true`。两者无分歧，不存在运行时表现不一致的情况。

---

## 输入用例验证

### Case 1: 美短第一回合
- **条件**：boss = american_shorthair，新局，turn=0
- **预期**：enemy-intent 显示 "❓ 意图隐藏"
- **实际**：✅ PASS
  - newGame() 中 boss.traits 检测命中 `hide_intent`，`G.hideIntent = true`（core.js:175-183）
  - updateEnemyIntent() 命中 hideIntent 分支，显示 "❓ 意图隐藏"（core.js:903-906）

### Case 2: 狸花猫第一回合
- **条件**：boss = tabby，新局，turn=0
- **预期**：enemy-intent 正常显示攻击/防御等意图
- **实际**：✅ PASS
  - tabby traits 不含 hide_intent（data.js:131-135，仅 lock_pile）
  - hide_intent 检测不命中，`G.hideIntent` 保持 `false`（core.js:148）
  - updateEnemyIntent() 进入正常意图计算分支（core.js:908-927）

### Case 3: 美短后续回合
- **条件**：boss = american_shorthair，turn=5（onTurnStart 已触发）
- **预期**：enemy-intent 显示 "❓ 意图隐藏"
- **实际**：✅ PASS
  - enemyTurn() 中调用 onTurnStart，设置 `G.hideIntent = true`（core.js:706-712 + data.js:214）
  - updateEnemyIntent() 命中 hideIntent 分支，显示 "❓ 意图隐藏"（core.js:903-906）

---

## 关键代码位置汇总

| 检查项 | 文件 | 行号 |
|--------|------|------|
| G.hideIntent 默认值 `false` | code/core.js | 148 |
| newest() hide_intent 检测 | code/core.js | 175-183 |
| newest() 中 render() 调用 | code/core.js | 193 |
| newest() 中 updateEnemyIntent() 调用 | code/core.js | 194 |
| updateEnemyIntent() hideIntent 分支 | code/core.js | 903-906 |
| enemyTurn() onTurnStart 调用 | code/core.js | 706-712 |
| american_shorthair hide_intent trait | code/data.js | 214 |
| tabby traits（无 hide_intent） | code/data.js | 131-135 |

---

## 最终裁定

**PASS — 全部 10 项 CHECKLIST + 3 个用例通过，无缺陷。**
