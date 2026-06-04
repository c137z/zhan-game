# 任务 20240603-015 — 代码审查

## 角色
你是 **Code Reviewer**（代码审查者）。你只阅读代码、分析问题、输出报告。
**不要修改任何代码。不要运行游戏。不要声称验证通过。**

## 项目背景
- 游戏「斩」⚔️：回合制堆叠消除 + 牌组构筑肉鸽
- 技术栈：纯 HTML/CSS/JS 单文件
- 文件：`zhan_v1.99_sprint4.html`
- 架构演进路径：v1.95（冻结版，硬编码/全局变量）→ v1.96（声明式数据层）→ v1.97（纯函数计算层）→ v1.98（Engine/UI 集中管理）→ v1.99（MSP bug修复+解耦）
- 架构目标：声明式数据 + 纯函数计算 + 集中状态管理 + 单向数据流

## 审查范围
文件：`C:\Users\kyzha\.openclaw\projects\zhan\zhan_v1.99_sprint4.html`

---

# 审查清单

## 1. Zhan.Systems.Boss — Boss trait/hpTrigger 执行引擎

阅读 `Zhan.Systems.Boss` 对象（`_traitHandlers` + `_hpTriggerHandlers` + `processEvent` + `runHpTriggers`），检查以下问题：

1.1 **lock_pile**：params 是 `{ interval: 2, count: 2, duration: 2 }`，handler 的 onTurnStart 是否正确实现了每2回合锁**2个**非空牌堆（不是只锁1个）？shuffleArray 后取 `params.count` 个候选是否等价于旧逻辑的 `candidates[0]` + `candidates[1]`？

1.2 **stun_player**：params 是 `{ interval: 5, minTurn: 1 }`，handler 条件 `G.turn >= params.minTurn && G.turn % params.interval === 0`，当 turn=0 时 `0>=1` 为 false，turn=5 时 `5>=1 && 5%5===0` 为 true。旧逻辑是 `G.turn > 0 && G.turn % 5 === 0`。两者是否语义等价？

1.3 **lick_player**：params 是 `{ interval: 3, minTurn: 1 }`，handler 条件 `if (G.turn < params.minTurn || G.turn % params.interval !== 0) return`。旧逻辑是 `G.turn > 0 && G.turn % 3 === 0`。turn=0 时旧逻辑 false（不触），新逻辑 turn<1 为 true → return（不触）。turn=3 时旧逻辑 true（触发），新逻辑 3<1 false, 3%3!==0 false → 不return（触发）。是否等价？注意：旧逻辑的条件是 `G.turn > 0` 即 turn=0 时跳过，新逻辑的 `minTurn: 1` 即 turn>=1，但旧逻辑实际第一次触发在 turn=3（因为%3===0），两者一致。

1.4 **insert_junk**：params 是 `{ halfHP: true }`。检查 handler 内的实际逻辑——是否完整保留了旧版的半血分段（halfHP 以上隔回合塞1张废牌，halfHP 以下每回合塞1张）？

1.5 **hpTrigger groom/hiss**：旧版 GROOM_TRIGGER 和 HISS_TRIGGER 是独立的函数对象，新版是挂在 `_hpTriggerHandlers` 下的字符串 key。`runHpTriggers(G, filterId)` 和 `enemyTurn()` 中手动遍历 hpTriggers 的逻辑是否覆盖了所有调用场景？特别关注 enemyTurn 中 hiss 检查在 groom 之前——如果 hiss 触发了但 playerHP 降到阈值以下，groom 会不会错误跳过？

1.6 **hiss 的 hissPrevHP**：旧版 hiss 触发器把 `hisPrevHP` 挂在 G 对象上，新版 handler 仍然挂在 G 上。`newGame()` 中的初始化 `if (boss.hpTriggers && boss.hpTriggers.indexOf('hiss') >= 0)` 是否正确替代了旧版的循环检查？

1.7 **BOSSES 定义中 `boss_first` trait** 的 events/params：v1.96 中 `maine_coon.boss_first` 的 trait 定义只有 `events: ['TURN_START']` 和 `params: {}`，handler 在 `_traitHandlers` 中没有 boss_first 的处理函数。注释说"在 executeTurn 中特殊处理"。这是否意味着 boss_first 的 `events: ['TURN_START']` 声明是多余的（processEvent 找不到 handler 就不会执行）？

## 2. Zhan.Systems.Relic — 圣物效果执行引擎

阅读 `Zhan.Systems.Relic` 对象和 `RELICS` 定义：

2.1 **wild_core 的 enableWildCoreSlot**：`G.effectiveSlotSize = (G.effectiveSlotSize || CONFIG.SLOT_SIZE) + 1`。如果 `slot_plus2` 先于 `wild_core` 初始化，此时 `G.effectiveSlotSize` 已经是 CONFIG.SLOT_SIZE+2，再加1变成 CONFIG.SLOT_SIZE+3。旧逻辑 `G.effectiveSlotSize = (G.effectiveSlotSize || CONFIG.SLOT_SIZE) + 1` 完全一样——是否两种圣物叠加的结果正确？

2.2 **fury_core 的 getFuryMultiplier**：`var hpLoss = 1 - G.playerHP / G.playerMaxHP; return 1 + hpLoss`。等价于 `2 - HP百分比`。当满血时返回1（无加成），空血时返回2（×2倍率）。与 RELICS 定义中的 `multiplier.depends: 'hpLoss', formula: '1-hpPercent'` 是否一致？

2.3 **lifesaving_fur 的 specialCards**：旧版通过 `onInit` 设置 `G.specialCards = [...]`，新版通过 `addSpecialCards` handler 设置。三张卡的定义（special_atk: dmg=40, special_def: shield=40, divine: immune=true）是否正确？

2.4 **overload_core 的 setOverloadBuffs**：设置 `atkBuffMult: 2.0, vulnMult: 2.0, defBuffRatio: 0.5`。atkBuffMult=2.0 等于 buff效果×2，vulnMult=2.0 等于易伤效果×2，defBuffRatio=0.5 等于减伤比例变为50%（比默认的 CONFIG.DEF_BUFF_RATIO 更强还是更弱？如果是减伤比例，0.5 表示只保留50%伤害 = 减伤50%，需要检查 CONFIG.DEF_BUFF_RATIO 的默认值来判断）

2.5 **applyInit 遍历顺序**：`for (var i = 0; i < relics.length; i++)` 按玩家选择顺序执行。如果 `slot_plus2` 先执行（增大 effectiveSlotSize），再执行 `wild_core`（再增大），最终 effectiveSlotSize 正确。但如果顺序反过来，wild_core 先执行时 effectiveSlotSize 为 undefined → 取 CONFIG.SLOT_SIZE → +1，然后 slot_plus2 再 +2，结果一致。是否安全？

## 3. Zhan.Rules — 纯函数计算层

阅读 `Zhan.Rules` 对象：

3.1 **calcPursuitMultiplier**：`if (maxComboLen < minCombo + 1) return 1; return 1 + (maxComboLen - minCombo) * 0.1`。当 maxComboLen = minCombo+1（如 minCombo=3, maxComboLen=4）时，条件 `4<4` false，返回 `1+(4-3)*0.1 = 1.1`。当 maxComboLen = minCombo+2（maxComboLen=5）时返回 `1+(5-3)*0.1 = 1.2`。检查旧版公式是否一致。

3.2 **computeCombos 的万能牌解析**：`resolveWildType` 策略是左优先搜索。如果槽位是 `[wild, attack, wild, defend]`，第一个 wild（idx=0）向左搜索找不到 → 向右找 attack（idx=1）→ 返回 attack。第三个 wild（idx=2）向左找 attack（idx=1，已 claimed）→ 注意：resolveWildType 不考虑 claimed 状态，只基于原始 slot。所以 wild_idx2 向左找到 idx=0（wild，跳过），idx=1（attack，非wild 非junk）→ 返回 attack。这是否正确——两个 wild 都解析为 attack？

3.3 **computeCombos 的 claimed 去重**：当 `comboLen >= minCombo` 时组内所有 wild 标记为 claimed。如果第一个 combo 是 attack（包含 wild_idx=0 和 wild_idx=2 都是 attack），两个 wild 都被 claimed。之后遍历到 wild_idx=2 时 `resolved[i].card.type==='wild' && resolved[i].claimed` → i++跳过。检查 claimed 机制是否可能遗漏边界——比如一个 wild 在 minCombo 判定**之前**被标记 claimed，但最终 comboLen 不够 minCombo，导致 wild 被浪费？

3.4 **computeCombos 的 null placeholder**：锁槽占位的 `null` 被解析为 `type: 'null_placeholder'`，在遍历时被跳过（`i++` 或 `j++`）。这会导致 combo 跨越锁槽吗？比如 `[attack, attack, null, attack]`——前两个 attack 组成 combo（start=0, end=2），第三个 attack（idx=3）被 null 隔开不会并入。正确。

3.5 **applyStatusEffects**：`attack` 类型同时应用 `atkBuffMult` 和 `vulnMult`——两个 if 是独立判定的。如果两者都>0，伤害被两次乘算。与旧版逻辑一致吗？

3.6 **computeEffectiveFury 的 defBuffRatio**：公式 `Math.max(0, 1 - (1 - baseRatio) * furyMult)`。满血时 furyMult=1，结果为 `1-(1-baseRatio)*1 = baseRatio`（正确）。空血时 furyMult=2，结果为 `max(0, 1-(1-baseRatio)*2)`。如果 baseRatio=0.5，则 `1-0.5*2 = 0`（减伤100%）。极端情况下可能为负值但被 max(0,...) 截断。公式是否与旧版等价？

## 4. Zhan.Engine — 状态管理中心

4.1 **dispatch PLAY_CARD**：`this._pullCard(action.r, action.c)` 的返回值被忽略，无论 pullCard 是否成功，末尾都会执行 `Zhan.UI.render(this.state)`。检查 pullCard 失败时 state 是否真的不变（如果 pullCard 内部改变了 G 但 return false，会导致不一致的 state 被渲染）。

4.2 **dispatch RESET vs RESTART**：RESET 清理 `ENDLESS_DEFEATED`、清空 `this.state`、重置 `G.currentStage=1; G.bossId='skeleton'`、调用 newGame()。RESTART 额外设置 `G.isEndless=false; G.activeRelics=[]`。两者在 `G={}` 之后立即设置属性的模式是否正确（`G={}` 是一个全新的空对象，没有原型链问题）？

4.3 **newGame 中的状态同步**：`Zhan.Engine.state = G;` 赋值在 newGame() 末尾。但在 newGame 执行过程中还有其他地方读取 G（如 `updateEnemyIntent()`）——这些地方此时 G 尚未赋给 Engine.state。如果 `updateEnemyIntent` 内部使用 `Zhan.Engine.state` 而非直接的 `G`，会读到旧 state。

4.4 **enemyTurn 末尾的 phase 更新**：`G.turn++; G.phase = 'player'; Zhan.Engine._updateEffectiveFury(G);` 然后 `Zhan.UI.render(G)`。检查 `_updateEffectiveFury` 在 render 之前调用是否保证了 display 数据的新鲜度。

## 5. Zhan.UI — 渲染层

5.1 **render 函数签名**：`Zhan.UI.render = function(state)`，内部 `var G = state || Zhan.Engine.state`。如果两者都不存在（`return`），不会渲染。检查所有调用 `Zhan.UI.render(G)` 的地方是否总是传入有效 G。

5.2 **renderBoard 的事件闭包**：双击事件中 `Zhan.Engine.dispatch({ type: 'PLAY_CARD', r: r, c: c })` 使用闭包变量 `r` 和 `c`。这些值是在 `renderBoard` 的 for 循环中通过 IIFE `(function(r, c) { ... })(r, c)` 正确捕获的。检查是否有遗漏的非 IIFE 事件绑定导致闭包变量错误。

5.3 **renderSlot 的 wildCoreIdx 计算**：`wildCoreIdx = 0; while (wildCoreIdx < effectiveSize && G.lockedSlots && G.lockedSlots[wildCoreIdx]) wildCoreIdx++`。如果 `G.lockedSlots` 是 undefined（没有锁槽），条件中的 `G.lockedSlots` 为 falsy → 循环不执行 → wildCoreIdx=0。如果 `G.lockedSlots = {0: 2, 1: 2}`（前两个槽位被锁且 duration=2），循环：idx=0 时 lockedSlots[0]=2（truthy）→ idx=1；idx=1 时 lockedSlots[1]=2（truthy）→ idx=2；idx=2 时 lockedSlots[2]=undefined（falsy）→ 退出 → wildCoreIdx=2。万能核心占 slot[2]。检查这个逻辑是否与 executeTurn 中 wild_core 插入逻辑一致（两者都用相同的动态查找算法）。

5.4 **showRelicSelect/renderRelicOptions/startNextStage**：使用 `var G = Zhan.Engine.state || window.G`。window.G 是全局变量（旧版兼容），如果 Engine.state 为 null 但 window.G 有值会发生什么——是否会导致操作旧 state 的问题？

## 6. 核心逻辑正确性

6.1 **tenacity（坚韧核心）**：
- `applyDamageToPlayer` 末尾调用 `checkTenacity(state)`
- `executeTurn` Phase 3（未消除惩罚结算后、胜负判定前）调用 `checkTenacity(G)`
- `checkTenacity` 函数逻辑：`if (tenacityUsed === false && playerHP <= 0) { playerHP = 1; tenacityUsed = true; log(...) }`
- 问题：applyDamageToPlayer 和 executeTurn Phase3 都会触发 checkTenacity。在同一回合中，如果 applyDamageToPlayer 触发 tenacity（HP=1），然后在 executeTurn Phase3 再次检查时 HP 仍可能 <=0（如果后续还受到伤害），但 tenacityUsed 已经是 true → 不会再次触发。是否正确？
- 问题：tenacityUsed 在 newGame 中通过 `Zhan.Systems.Relic.applyInit` → `enableTenacity` → `G.tenacityUsed = false` 设置初始值。在 RESET/RESTART 时 newGame 会重新调用，所以正确。

6.2 **wild_core 万能核心**：
- pullCard 中的 null placeholder：只在 `G.wildCoreSlot && G.slot.length === 0` 时插入（即首次拉牌）。如果第一次拉牌时 slot[0] 被锁 → 动态找到 nullIdx → 在 nullIdx 处插入 null。后续拉牌不再插入 null。
- executeTurn 中的万能卡填充：动态找 wildIdx → 如果 wildIdx < G.slot.length（在已有 slot 范围内）且 slot[wildIdx] 是 null → 替换为万能卡；否则插入万能卡；如果 wildIdx >= G.slot.length → 填充 null 到 wildIdx 位置然后 push。
- 问题：pullCard 的 null placeholder 和 executeTurn 的万能卡填充使用相同的查找逻辑吗？两者之间 slot 状态是否一致？

6.3 **enemyTurn 中 hpTrigger 的调用顺序**：
```
// 1. hiss 检查（跳过 groom）
for (hi=0; hi<G.boss.hpTriggers.length; hi++) {
  triggerId = G.boss.hpTriggers[hi];
  if (triggerId === 'groom') continue;
  handler = Zhan.Systems.Boss._hpTriggerHandlers[triggerId];
  if (handler && handler.condition && handler.condition(G)) handler.execute(G);
}
// 2. groom 检查
Zhan.Systems.Boss.runHpTriggers(G, 'groom');
if (G.over) return;
```
为什么 hiss 和 groom 要分开两次遍历？注释说"hiss first, then groom"，但 `runHpTriggers(G, 'groom')` 只运行 groom。如果 hiss 触发导致 game over，groom 不再执行——正确。但如果 hiss 触发后 game NOT over，groom 正常执行。check：hiss 的作用是清空全场 Buff/Debuff，groom 的作用是清空 Boss 自身 Debuff。两者独立，顺序无所谓。

6.4 **getEffectDescription 调用点**：搜索全文确认所有 `getEffectDescription(` 调用是否都已更新为 `getEffectDescription(G, type, n)` 形式（三个参数）。如果有遗漏的二参数调用，会因缺少 state 导致运行时错误。

6.5 **updateComboPreview 调用点**：搜索全文确认所有 `updateComboPreview(` 调用是否都已更新为 `updateComboPreview(G)` 形式（一个参数）。

## 7. 边界情况

7.1 **空 slot 数组**：`Zhan.Rules.computeCombos([], minCombo)` 应该返回 `[]`（带 `_claimedWildIndices`）。检查是否正确。

7.2 **全部槽位被锁**：pullCard 中 `_skippedSlots` 累加后 `insIdx >= maxSize` 触发回滚（pop null + push card back），return false。是否正确？

7.3 **playerHP=0 但 tenacityUsed=true**：checkTenacity 的条件 `tenacityUsed === false && playerHP <= 0`，false && 0<=0 → false，不触发。正确。

7.4 **fury 极限倍率**：playerHP=0, playerMaxHP=100 → hpLoss=1 → furyMult=2。effectiveAtkBuffMult = base×2, effectiveVulnMult = base×2, effectiveDefBuffRatio = max(0, 1-((1-baseRatio)×2))。这是否过于极端？

7.5 **stun 跳过回合**：executeTurn 中 `if ((G.playerEffects.stun || 0) > 0) { ... enemyTurn(); return; }` 在调用 enemyTurn 前清空 slot 并设置 phase。检查此时是否跳过了 Boss 的 onTurnStart/onTurnEnd traits（因为没走正常的 executeTurn→enemyTurn 流程）。

7.6 **无尽模式 defeated boss 去重**：`ENDLESS_DEFEATED[boss.id] = true` 在 endGame 中设置。`startEndlessNextCat` 中过滤 `!ENDLESS_DEFEATED[b.id]`。检查 defeated boss 是否会被正确排除。

---

# 输出要求

## 必须逐项完成：

1. **发现的确定性问题**：按严重程度分成三级（🔴严重/🟡中等/🟢轻微），每个问题引用具体的行号或代码片段
2. **不确定需要人工判断的疑点**：列出你无法 100% 确定但值得关注的项
3. **架构一致性评估**：从四个维度打分并说明：
   - 声明式数据层：Boss/圣物定义是否完全声明式化？有没有残留的内联函数？
   - 纯函数计算层：Zhan.Rules 是否真正无副作用？
   - 集中状态管理：Engine.state 是否真的是唯一 state 来源？有没有绕开 dispatch 的直接操作？
   - 单向数据流：数据流向是否清晰（action → dispatch → mutate → render）？
4. **建议修复优先级**：把所有问题按 P0/P1/P2 排序

**最后输出一行：REVIEW_DONE**
