# ⚔️ 斩 Sprint 迭代链机械审查报告

> 审查范围：v1.95（冻结版）→ v1.96_sprint1 → v1.97_sprint2 → v1.98_sprint3 → v1.99_sprint4
> 审查类型：机械事实盘点（不判断逻辑对错）
> 生成时间：2026-06-03

---

## 版本文件确认

| 版本 | 路径 | 大小 | 行数 |
|------|------|------|------|
| v1.95 | artifacts/zhan_v1.95.html | 90,022 B | 2,209 |
| v1.96_sprint1 | zhan_v1.96_sprint1.html | 93,484 B | 2,299 |
| v1.97_sprint2 | zhan_v1.97_sprint2.html | 93,726 B | 2,301 |
| v1.98_sprint3 | zhan_v1.98_sprint3.html | 96,108 B | 2,373 |
| v1.99_sprint4 | zhan_v1.99_sprint4.html | 97,555 B | 2,364 |

✅ 五个版本全部存在，文件完整。

---

## Sprint 1: v1.95 → v1.96

**变更量**: +90 行

### 实际修改内容

1. **Boss 定义数据结构重构**（最大改动）
   - 删除了 `GROOM_TRIGGER` 和 `HISS_TRIGGER` 两个全局对象（作为函数对象挂在 hpTriggers 上）
   - Boss trait（lock_pile / lick_player / lock_slot / hide_intent / random_discard / smear_piles / time_limit / insert_junk / stun_player）从内联匿名函数 → 声明式 `{ events: [...], params: {...} }` 结构
   - hpTriggers 从函数对象引用数组 → 纯字符串 ID 数组 `['groom', 'hiss']`

2. **圣物定义数据结构重构**
   - 所有圣物的 `onInit: function(G) {...}` → `effects: [{ phase: 'INIT', action: '...', params: {...} }]`
   - fury_core 的 `getMultiplier` 保留但格式改为 `multiplier: { depends: 'hpLoss', formula: '1-hpPercent' }`

3. **新增 `Zhan.Systems` 命名空间**（~244 行新代码）
   - `Zhan.Systems.Relic`：圣物效果执行引擎（`_handlers` + `applyInit(G)` + `getFuryMultiplier(G)`）
   - `Zhan.Systems.Boss`：Boss trait/hpTrigger 执行引擎（`_traitHandlers` + `_hpTriggerHandlers` + `processEvent(G, eventName)` + `runHpTriggers(G, filterId)`）

4. **调用点适配**
   - `newGame()` 中的圣物初始化 → 改为 `Zhan.Systems.Relic.applyInit(G)`
   - `executeTurn()` 中的 onResolve → 改为 `Zhan.Systems.Boss.processEvent(G, 'RESOLVE')`
   - `enemyTurn()` 中的 hpTriggers/traits 遍历 → 改为 `Zhan.Systems.Boss` 方法调用
   - `updateEnemyIntent()` 中的 hasGroom 检查 → 从 `.some()` 改为 `.indexOf('groom') >= 0`
   - fury 倍率计算 → 从 `RELICS.fury_core.getMultiplier(G)` 改为 `Zhan.Systems.Relic.getFuryMultiplier(G)`

### ⚠️ 风险点
- **声明式翻译是否正确？** 每个 trait 的内联函数 → params 提取是否语义等价？
  - `lock_pile`: `G.turn % 2 !== 0` → `params.interval: 2`；`candidates[0]` + `candidates[1]` → `params.count: 2`；`lockedPiles[...] = 2` → `params.duration: 2` ✅ 看起来一致
  - `stun_player`: 原 `G.turn > 0 && G.turn % 5 === 0` → `params.interval: 5, minTurn: 1`，但原逻辑要求 `G.turn > 0`（即第一次触发在 turn=5），new 的 `minTurn: 1` 且条件为 `G.turn >= minTurn && G.turn % interval === 0`，第一次触发也在 turn=5 ✅
  - `lick_player`: 原 `G.turn > 0 && G.turn % 3 === 0` → `params.interval: 3, minTurn: 1`，新逻辑 `G.turn < minTurn || G.turn % interval !== 0` return，第一次触发 turn=3 ✅
  - **`insert_junk` 风险高**：原逻辑很复杂（halfHP 判断 + 隔回合 + `junkCount` 动态），params 只有 `{ halfHP: true }`，实际 handler 内保留原逻辑 ✅
- **hpTrigger 'groom' 的 condition 中 `G.turn > 0` 被保留** ✅

---

## Sprint 2: v1.96 → v1.97

**变更量**: +2 行

### 实际修改内容

1. **新增 `Zhan.Rules` 命名空间**（纯数值计算函数，不读全局 G）
   - `calcBaseValue(totalCount, minCombo)`
   - `calcPursuitMultiplier(maxComboLen, minCombo)`
   - `calcAttackValue(totalCount, maxComboLen, minCombo)`
   - `calcDefendValue(totalCount, maxComboLen, minCombo)`
   - `calcHealValue(totalCount, maxComboLen, minCombo)`
   - `resolveWildType(slot, idx)` — 从全局函数迁移
   - `computeCombos(slot, minCombo)` — 从全局函数迁移
   - `getComboDuration(n, minCombo)`
   - `getStunDuration(n, minCombo)`
   - `applyStatusEffects(type, val, effects)`
   - `computeEffectiveFury(playerHP, playerMaxHP, baseValues)`

2. **删除的全局函数**
   - `calcBaseValue`, `calcPursuitMultiplier`, `calcAttackValue`, `calcDefendValue`, `calcHealValue`
   - `applyRelicModifiers`（被移除——原本只是 pass-through `return val`）
   - `resolveWildType`, `computeCombos`, `getComboDuration`, `getStunDuration`

3. **`updateEffectiveFuryValues` 重写**
   - 旧：直接读写 G 上的 fury 相关字段
   - 新：调用 `Zhan.Rules.computeEffectiveFury(G.playerHP, G.playerMaxHP, {...})`，结果写回 G
   - 保留为兼容 wrapper

4. **`getEffectDescription` 适配**
   - `getComboDuration(n)` → `Zhan.Rules.getComboDuration(n, minCombo)`
   - `getStunDuration(n)` → `Zhan.Rules.getStunDuration(n, minCombo)`

5. **`executeTurn` 适配**
   - `computeCombos(G.slot)` → `Zhan.Rules.computeCombos(G.slot, ...)`
   - `resolveWildType` → `Zhan.Rules.resolveWildType`
   - 伤害/护盾/治疗计算改用 `Zhan.Rules`

6. **`updateComboPreview` 适配**
   - 同上，所有计算调用改用 `Zhan.Rules`
   - 追加判断：`if (maxLen >= mc + 1)` 替代原来的 `if (maxLen >= 4)` （minCombo-aware）

7. **`render` 适配**
   - fury 计算改用 `Zhan.Rules.computeEffectiveFury`
   - 卡牌总数计算：`CONFIG.TOTAL_CARDS` → 动态累加 `G.deckConfig`

### ⚠️ 风险点
- **`calcPursuitMultiplier` 硬编码阈值变更**：旧版 `updateComboPreview` 中 `if (maxLen >= 4)` 改为 `if (maxLen >= mc + 1)`。当 `minCombo=3` 时 `mc+1=4` 等价；当 `minCombo=2` 时 `mc+1=3`，preview 会更早显示追逐倍率——**但 display 只在 preview 中，不影响实际结算** ✅
- **`applyRelicModifiers` 删除**：旧版是 pass-through（`return val`），新版在 executeTurn 中直接内联 fury 计算。功能等价 ✅

---

## Sprint 3: v1.97 → v1.98

**变更量**: +72 行

### 实际修改内容

1. **新增 `Zhan.Engine` 状态管理中心**
   - `Zhan.Engine.state`：集中状态引用
   - `Zhan.Engine.init()` → 调用 `newGame()`
   - `Zhan.Engine.dispatch(action)`：统一动作分发
     - `PLAY_CARD` → pullCard(r, c)
     - `END_TURN` → executeTurn()
     - `RESET` → 重置所有状态 + newGame
     - `RESTART` → 重置 + 清 relics
     - `START_ENDLESS` → 无尽模式

2. **render 调用迁移**
   - 旧：各处散落 `render()` 调用（pullCard / executeTurn / enemyTurn / endGame / newGame）
   - 新：统一走 `Zhan.Engine.dispatch()` + `Zhan.UI.render(G)`，或直接 `Zhan.UI.render(G)`
   - `btn-end-turn` 的 disabled 操作也集中到 `Zhan.UI.render`

3. **`pullCard` 修复**
   - **BUG4 FIX**: wild_core null placeholder 从固定 slot[0] → 动态查找第一个非锁定槽位
   - **BUG2 FIX**: 所有槽位被锁时，card 回滚到 pile（`pile.push(card)`）

4. **`executeTurn` 修复**
   - **BUG3 FIX**: wild_core 万能卡插入位置从固定 slot[0] → 动态查找第一个非锁定槽位
   - **BUG1 FIX**: 坚韧核心（tenacity_core）触发位置从 executeTurn 末尾 → 移到未消除惩罚结算后、胜负判定前
   - render 调用：散落调用 → `Zhan.UI.render(G)` + 条件判断

5. **`showRelicSelect` / `renderRelicOptions` / `startNextStage` 适配**
   - 添加 `var G = Zhan.Engine.state || window.G;` 作为 G 获取方式

6. **UI 事件处理迁移**
   - renderBoard 中的双击/拖拽事件 → 改用 `Zhan.Engine.state` 获取状态 + `Zhan.Engine.dispatch({ type: 'PLAY_CARD', r, c })`

### ⚠️ 风险点
- **BUG1 fix 位置变更**：坚韧检查从 executeTurn 末尾移到中间（未消除惩罚后、胜负判定前）。这修复了重复触发问题，但如果在 executeTurn 中还有其他伤害源（如 Buff 反噬），tenacity 检查时机是否正确需要人工验证
- **dispatch 的 PLAY_CARD**：原来 pullCard 内部有 `render()` + `btn-end-turn` 逻辑，现在移除后依赖 dispatch 末尾的 `Zhan.UI.render(this.state)`。如果 pullCard 返回 false（拉取失败），render 仍会执行——这是安全的（无状态变化）
- **newGame() 中 `render()` 移除**：改为 `if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(G)` — 有条件守卫 ✅

---

## Sprint 4: v1.98 → v1.99

**变更量**: -9 行（净减）

### 实际修改内容（MSP 任务 003/013/014 的累积）

1. **003: P0 Bug 修复**
   - executeTurn 异步渲染：setTimeout 回调 + maineCoonFirst 分支末尾都加显式 `Zhan.UI.render(G)`
   - pullCard 万能核心占位：重构为动态非锁定槽位（延续 sprint3 修复）
   - renderSlot 万能核心硬编码：`i === 0` → 动态查找 wildCoreIdx

2. **013: 坚韧核心重构**
   - `applyDamageToPlayer` 末尾 + `executeTurn` Phase 3 末尾的 tenacity 逻辑提取为 `checkTenacity(state)`
   - 两个调用点都改为调用 `checkTenacity(G)`

3. **014: 消除全局 G 依赖**
   - `getEffectDescription(type, n)` → `getEffectDescription(state, type, n)`
   - `updateComboPreview()` → `updateComboPreview(state)`
   - `log()` 统一只读 `Zhan.Engine.state`，删除 window.G 回退

4. **其他 sprint4 细节**
   - `Zhan.Engine._updateEffectiveFury` 方法（内部 helper）
   - render 不再自己计算 fury（改为读 Engine 缓存的值）
   - 新增 `Zhan.Test` 浏览器内回归测试框架（`#test` hash 触发）
   - BOSSES 补了 `boss_first` trait 的 events/params 声明

### ⚠️ 风险点
- **MSP 任务叠加在 sprint4 上**：v1.99 是 sprint3 + MSP 003/013/014 的结果，这些修改的 autoDiff 已在 MSP outbox 中记录，但 sprint3→sprint4 的 diff 未单独拆分 MSP 修改 — 它们是混在一起的
- `getEffectDescription` 签名变更：如果外部有独立调用（不在这次搜索范围内），会因缺少 state 参数而报错

---

## 迭代链总体评估

### 演进路线图

```
v1.95 (冻结版)
  │ 内联函数 → 声明式数据结构
  │ 新增 Zhan.Systems (Relic + Boss 执行引擎)
  ▼
v1.96_sprint1
  │ 全局函数 → Zhan.Rules 纯函数命名空间
  │ minCombo-aware 适配
  ▼
v1.97_sprint2
  │ 新增 Zhan.Engine 状态管理中心
  │ render 集中化 + dispatch 统一入口
  │ 4个 P0 bug 修复 (wild_core / tenacity / pullCard / renderSlot)
  ▼
v1.98_sprint3
  │ MSP 003/013/014 累积修复
  │ 消除全局 G 依赖
  │ 新增回归测试框架
  ▼
v1.99_sprint4 (当前)
```

### 架构演进一致性

✅ **方向一致**：四个 sprint 都在向同一个架构目标演进——声明式数据 + 纯函数计算 + 集中状态管理 + 单向数据流

✅ **无重复修改**：每个 sprint 修改的区域互不重叠（sprint1=Boss/Relic 数据层，sprint2=数值计算层，sprint3=Engine/UI 层，sprint4=细节修复+解耦）

✅ **无回退**：没有发现后一个 sprint 撤销前一个 sprint 修改的情况

### 需要人工验证的高风险项

| # | 风险 | 涉及版本 | 严重程度 |
|---|------|---------|---------|
| 1 | lock_pile/stun_player/lick_player 声明式翻译的语义等价性 | v1.96 | ⚠️ 中 |
| 2 | insert_junk 的复杂逻辑是否在 handler 中完整保留 | v1.96 | ⚠️ 中 |
| 3 | tenacity 触发时机调整（BUG1 fix）是否覆盖所有伤害路径 | v1.98/v1.99 | 🔴 高 |
| 4 | wild_core 动态槽位查找在所有边界情况下正确 | v1.98/v1.99 | 🔴 高 |
| 5 | getEffectDescription 签名变更是否遗漏调用点 | v1.99 | ⚠️ 中 |
| 6 | Zhan.Rules 数值公式与旧版全局函数完全等价 | v1.97 | ⚠️ 中 |

---

## 下一步建议

1. **找人 Review**：把本报告 + 高风险项清单给外部人，重点验证 3、4、6
2. **跑回归测试**：v1.99 已有 `Zhan.Test` 框架（`#test` 触发），可以扩展测试用例
3. **逐个修复高风险项**：如果有问题，通过 MSP 投递修复任务
