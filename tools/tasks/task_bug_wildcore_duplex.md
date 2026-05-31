# Task: bug_wildcore_duplex — 万能牌重复归属修复

## GOAL
万能牌（含万能核心首槽万能卡）不重复归属：一张万能牌只服务于一个连击组，不能被两个不同类型的连击共用，也不能既被计入连击又被计入未消除惩罚。

## ALLOWED FILES
- code/core.js

## BUG LIST

### Bug #1 — resolveWildType 双向搜索导致类型漂移
- 位置：core.js `resolveWildType(slot, idx)` L305-311
- 当前逻辑：万能牌先向左搜索非万能非废牌，找不到再向右搜索
- 问题：如果万能左边是攻击、右边是减伤，万能会取攻击类型。但在 `computeCombos` 的 while 循环中，左边攻击和右边减伤分别被独立扫描时，各自遇到的万能牌都会"漂移"到相邻类型，导致万能同时被攻击连击和减伤连击包含
- 要求：`resolveWildType` 的策略改为**优先向最近的非万能、非废牌取类型**。如果两边都有，取距离更近的；距离相等时取左边的

### Bug #2 — computeCombos 中万能牌被重复计入多个连击组
- 位置：core.js `computeCombos(slot)` L313-341
- 问题：while 循环从 i=0 扫描，当 `resolved[i].type === typ` 时把后续连续同类型都包进去。但如果万能牌的 `resolved[i].type` 被 resolveWildType 设为 attack，而它右边紧邻的是 def_buff，扫描会停在万能这里（因为类型变了）。然后下一轮循环从万能右边开始，万能又被重新考虑——但此时万能已经被"消费"在上一个连击里了
- 要求：万能牌一旦被归入某个连击组，就在 resolved 数组中标记为"已归属"（如设置 `claimed: true`），后续扫描跳过已归属的万能牌

### Bug #3 — 未消除惩罚中万能牌被计入
- 位置：core.js `executeTurn` 未消除惩罚 L570-587
- 问题：`unmatchedByType[mt]++` 按 `resolveWildType` 解析后的类型计数。万能牌被解析后会变成某个类型（如 attack），如果该类型总数不足 minCombo，万能牌也会被计入掉血惩罚
- 要求：万能牌不应被计入未消除惩罚。在未消除惩罚循环中跳过 `slot[si2].type === 'wild'` 的牌

### Bug #4 — 万能核心 bonus comboLen+1 逻辑在万能牌被重复使用时会错误叠加
- 位置：core.js `computeCombos` L329-333
- 当前：`if (G.wildCoreSlot && i >= 1) { comboLen += 1; }`
- 问题：这个 +1 是对"万能核心后方卡牌"的奖励，但计算时机在万能牌类型已解析之后。如果 Bug #2 导致万能被重复使用，这个+1也会被多算
- 要求：该逻辑保持不变，但必须在 Bug #2 修复后验证其正确性（万能牌不被重复计入，bonus+1 也只加一次）

### Bug #5 — 万能核心首槽万能卡的 resolveWildType 返回 'wild'
- 位置：core.js `resolveWildType` L305-311
- 场景：slot[0] 是万能核心卡（type: 'wild', wildCore: true），slot[1] 是攻击。万能核心卡向左搜索不到（左边是空），向右找到攻击 → 返回 'attack'，它和 slot[1] 的攻击组成 2 连
- 但当前逻辑：如果 slot[0] 左边没牌（k<0 停止），右边找到类型。但如果 slot[1] 也是万能牌——还会继续向右找。这个逻辑本身 OK
- 要求：不改变 resolveWildType 的搜索方向，但确保修复 Bug #1 后，万能核心卡不会和"与其相邻但不属于同一连击组"的类型绑定

## 期望行为（对齐后的规范）

1. 一张万能牌只归属于一个连击组，只管"最近的相邻"非万能牌
2. 万能核心首槽万能卡 = 普通万能卡，规则一致
3. 万能牌不产生两种效果（不能既算攻击连击又算减伤连击）
4. 万能牌不算入未消除惩罚（如果万能类型是 wild 或在连击中已被消费）
5. 万能核心后方卡牌连击数+1 只加一次

## IMMUTABLE RULES
- 不改变 CONFIG 常量
- 不改变 BOSSES/圣物定义
- 不改变 executeTurn Phase 1/2/3 的结算顺序
- 不改变 calcBaseValue / calcPursuitMultiplier / calcAttackValue 等公式
- 不改变 enemyTurn 逻辑
- 不改变 UI 渲染（ui.js / style.css）
- 不改变 buildDeck / buildPiles / shuffle 等辅助函数
- Contract B2 (enemyHP Math.max) / B3 (phase 白名单) / C2 (cycle 非空) 不可破坏
