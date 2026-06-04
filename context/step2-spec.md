# Step 2 还债 — 执行规范 v2

> 目标：把拆分后的四个文件从"能用"变成"干净"，消除全局 G 依赖、归位函数、硬切 core/ui 边界。
> 预计：8 个 task，总耗时约 120 分钟。

---

## 当前基线

| 文件 | 大小 | 状态 |
|------|------|------|
| `code/data.js` | 11KB | ✅ 无 function，纯数据 |
| `code/core.js` | 69KB | ⚠️ 20 个全局 function、393 处 `G.`、29 处 `document.` |
| `code/ui.js` | 18KB | ⚠️ 73 处 `G.`、1 处 state 写入 |
| `code/index.html` | 17KB | ✅ 启动脚本在 ui 之后 |

---

## 架构约束（不可违反）

1. **data.js** — 禁止 function（IIFE 除外）
2. **core.js** — 禁止 `document.` / DOM 操作；禁止直接读 `CONFIG.MIN_COMBO` 等运行时可变值
3. **ui.js** — 禁止直接写 `Zhan.Engine.state` 的任何字段；事件处理走 dispatch，不直接读 G
4. **每个 task 完成后必须跑冒烟测试**：浏览器打开，第一回合能正常出牌、结束回合

---

## Task 清单

### 201a — 删废弃函数 + 确认 getEffectDescription 位置

**目标**：清理明确废弃的代码，确认待迁移函数的当前位置。

**具体操作**：
1. 删除 `updateEffectiveFuryValues` 函数及其所有调用残留
2. 确认 `getEffectDescription` 在 core.js line 685，是全局函数（已接收 state 参数）
3. 确认 ui.js `log()` 中 `G.logLines = []` 是唯一的 ui.js state 写入（记为 203 处理项）

**验收**：
- [ ] `updateEffectiveFuryValues` 不在 core.js 中
- [ ] 输出 `getEffectDescription` 的确认位置（在报告中注明）
- [ ] `#test` PASS
- [ ] 冒烟测试 PASS（浏览器第一回合正常）

**预计**：5 min

---

### 201b — CONFIG 全量扫描（Scheduler 手工做，非 CC CLI）

**目标**：生成 CONFIG 直读的完整分类清单，作为 206 的输入。

**执行者**：哈基米（Scheduler），不用 CC CLI。

**步骤**：
```
grep -n "CONFIG\." code/core.js
grep -n "CONFIG\." code/ui.js
```
逐行分类：

| 分类 | CONFIG 字段 | 替换目标 | 原因 |
|------|------------|---------|------|
| 应改 | `MIN_COMBO` | `G.effectiveMinCombo \|\| CONFIG.MIN_COMBO` | 圣物可能改 |
| 应改 | `ATK_BUFF_MULT` | `G.effectiveAtkBuffMult \|\| CONFIG.ATK_BUFF_MULT` | fury 实时变化 |
| 应改 | `VULN_MULT` | `G.effectiveVulnMult \|\| CONFIG.VULN_MULT` | fury 实时变化 |
| 应改 | `ATK_DOWN_PCT` | `G.enemyEffects.atk_down_pct \|\| CONFIG.ATK_DOWN_PCT` | fury 翻倍 |
| 保留 | `BOARD_ROWS/COLS`、`SLOT_SIZE`、`DECK_SIZE`、`DOUBLE_TAP_DELAY`、`LOG_MAX_LINES`、`DAMAGE_MIN` 等 | 不动 | 真常量 |

**产出**：`context/config-classification.md`

**预计**：10 min

---

### 202a — 纯数据操作函数 → Zhan.Engine 方法

**目标**：把无 DOM、无复杂状态变更的底层函数归位到 Engine。

**具体操作**：

| 原函数 | 改为 | 注意事项 |
|--------|------|---------|
| `buildDeck()` | `Zhan.Engine._buildDeck()` | |
| `buildPiles()` | `Zhan.Engine._buildPiles()` | |
| `getTop(pileIdx)` | `Zhan.Engine._getTop(pileIdx)` | |
| `popTop(pileIdx)` | `Zhan.Engine._popTop(pileIdx)` | |

以下保留在原位置（纯工具函数，无 G 依赖）：
- `flatten(arr)` — 不动
- `shuffle(arr)` — 不动
- `shuffleArray(arr)` — 不动
- `getEffectDescription(state, type, n)` — 移到 `Zhan.Rules.getEffectDescription`（它已是纯函数，接收 state 参数）

**验收**：
- [ ] 4 个函数不再以全局 function 存在
- [ ] getEffectDescription 在 Zhan.Rules 下
- [ ] 所有调用点已更新（buildPiles/getTop/popTop 被 executeTurn/pullCard 等调用）
- [ ] `#test` PASS
- [ ] 冒烟测试 PASS

**预计**：15 min

---

### 202b — 核心战斗逻辑 → Zhan.Engine 方法

**目标**：把有状态变更的战斗函数归位到 Engine。

**具体操作**：

| 原函数 | 改为 | 注意事项 |
|--------|------|---------|
| `pullCard(r,c)` | `Zhan.Engine._pullCard(r,c)` | 涉及万能核心动态槽位 |
| `executeTurn()` | `Zhan.Engine._executeTurn()` | 最大函数，约 400 行 |
| `applyDamageToPlayer(dmg,rawAtk,label)` | `Zhan.Engine._applyDamageToPlayer(dmg,rawAtk,label)` | 涉及坚韧核心 |
| `enemyTurn()` | `Zhan.Engine._enemyTurn()` | Boss 行动 |

executeTurn 迁移策略：先改函数签名和外壳 → 内部 `G.` 全部改为 `var st = Zhan.Engine.state` → 内部调用点（buildDeck/buildPiles 等）改为 `Zhan.Engine._xxx`。

**验收**：
- [ ] 4 个函数不再以全局 function 存在
- [ ] executeTurn 内所有子调用已更新为 Zhan.Engine/Zhan.Rules 方法
- [ ] `#test` PASS
- [ ] 冒烟测试 PASS

**预计**：40 min

---

### 202c — 流程控制函数 → Engine+UI 拆分

**目标**：把既做状态变更又做 DOM 操作的函数硬拆。

**拆分策略**：

| 原函数 | Engine 部分 | UI 部分 | 调用时机 |
|--------|------------|---------|---------|
| `endGame(win,msg)` | `Zhan.Engine._endGame(win,msg)` — 设置 G.over/G.win | **不单独拆 showResult** — `endGame` 在 Engine 里调 `Zhan.UI.render(state)` 统一刷新 |
| `updateEnemyIntent()` | `Zhan.Engine._updateEnemyIntent()` — 设置 intent 字段 | `Zhan.UI.renderEnemyIntent(state)` — DOM 更新 | Engine 设置好 intent → 调 UI.renderEnemyIntent |
| `showRelicSelect()` | `Zhan.Engine._showRelicSelect()` — 状态标记 | `Zhan.UI.renderRelicSelect(state)` — relic 弹窗 | |
| `startNextStage()` | `Zhan.Engine._startNextStage()` | 无需拆分（它调 newGame，newGame 内已调 render） | |
| `startEndlessNextCat()` | `Zhan.Engine._startEndlessNextCat()` | 无需拆分 | |

**关键**：`endGame` 不在 Engine 里单独调 `showResult`，而是在 state 变更后统一调 `Zhan.UI.render(state)`。render 里已有 result-overlay 的显示逻辑，需要在 render 中处理。

**验收**：
- [ ] core.js 中 `document.` 引用 = 0
- [ ] ui.js 新增 `renderEnemyIntent`、`renderRelicSelect` 方法
- [ ] `#test` PASS
- [ ] 冒烟测试 PASS

**预计**：20 min

---

### 203 — ui.js 事件处理 → dispatch 模式

**目标**：ui.js 中事件处理函数不再直接读 G。

**具体操作**：
- `renderBoard` 中的双击/拖拽事件：保留 `var st = Zhan.Engine.state`（只读可接受）
- `btn-end-turn` click：确认走 `dispatch({ type: 'END_TURN' })`
- `btn-reset`/`btn-restart`/`btn-endless`：确认走 dispatch
- log 函数：确认 `var G = Zhan.Engine.state`
- Boss/player 弹窗事件：确认只读 state
- `G.logLines = []` → 移到 core.js `newGame()` 中：`G = { ... logLines: [] ... }`

**验收**：
- [ ] ui.js 中无 `G.logLines =` 等 state 写入
- [ ] 所有 `G.` 读取通过 `var st = Zhan.Engine.state` 获取
- [ ] `#test` PASS
- [ ] 冒烟测试 PASS

**预计**：15 min

---

### 204 — CONFIG 替换（按 201b 清单）

**目标**：按 201b 产出的 `config-classification.md`，批量替换应改的 CONFIG 直读。

**前置条件**：201b 清单经 Scheduler 人工审阅通过。

**具体操作**：
- `CONFIG.MIN_COMBO` → `G.effectiveMinCombo || CONFIG.MIN_COMBO`
- `CONFIG.ATK_BUFF_MULT` → `G.effectiveAtkBuffMult || CONFIG.ATK_BUFF_MULT`
- `CONFIG.VULN_MULT` → `G.effectiveVulnMult || CONFIG.VULN_MULT`
- `CONFIG.ATK_DOWN_PCT` → `G.enemyEffects.atk_down_pct || CONFIG.ATK_DOWN_PCT`（降攻是敌人效果，不在 effective 层）

**验收**：
- [ ] core.js 和 ui.js 中上述 4 个 CONFIG 全部替换完毕
- [ ] `#test` PASS
- [ ] 冒烟测试 PASS

**预计**：10 min

---

### 205 — 回归测试

**目标**：全量回归验证。

**具体操作**：
1. 跑 `Zhan.Test.run()` — 全部 PASS
2. **冒烟测试**：第一关逗猫棒，第一回合出牌、结束回合正常
3. **通关测试**：第二关毛线团通关 → 选圣物 → 第三关正常
4. **无尽模式**：至少 3 关
5. **Fury 测试**：带狂暴核心，验证低血量 fury 倍率正确
6. **Wild 测试**：带万能核心 + 英短蓝猫，验证 wild 出现在正确槽位
7. F12 Console 无 error

**验收**：全 PASS

**预计**：15 min

---

## 调整后的执行顺序

```
201a（CC CLI）+ 201b（我手工）→ 并行做
     ↓
202a → 202b → 202c → 203 → 204 → 205
```

201a 和 201b 互不依赖（201a 改代码、201b 分析数据），可以并行。

203 和 204 改串行：204 的 CONFIG 替换可能在 ui.js 上，跟 203 的 ui.js 改造冲突。串行更安全。

---

## 执行规则

1. 每个 task 走 MSP 完整流程：投递 → Bridge → CC CLI → 审阅 → Verifier → 汇报
2. 每个 task 验收加**冒烟测试**（浏览器第一回合正常）
3. 回退：`#test` FAIL → REJECT + 投递修复，不继续
4. 不碰原版 `zhan_v1.99_sprint4.html`

---

## 201b 产出清单（我待会做）

| 文件 | 行号 | 原引用 | 分类 | 替换目标 |
|------|------|--------|------|---------|
| core.js | ... | CONFIG.xxx | 改/保留 | ... |

---

## 预期成果

- `core.js`：0 处 `document.`，0 个全局 function，G 通过 `Zhan.Engine.state`
- `ui.js`：事件走 dispatch，无 state 写入
- CONFIG：运行时可变值全部走 effective
