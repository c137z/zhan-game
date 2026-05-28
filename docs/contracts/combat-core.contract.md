# Contract: 斩 战斗核心契约审计

> 每个条款 = 一个已发生过的 bug 的反推规则。
> Verifier 在每次代码变更后必须逐条验证，不能跳过。

---

## Tier 1 — 纯正则可验证（每次 commit 后自动跑）

---

### Contract A2 [CRITICAL]
#### Rule
render 系列函数体内不得对全局/持久 DOM 注册事件监听器。对函数内新创建的局部 DOM 节点注册 listener 不违规（随父容器 `innerHTML=''` 自动销毁）。

#### Rationale
对全局/持久 DOM（如 document、window、固定按钮）重复注册会导致 listener 堆积。而对 renderBoard 内部新创建的 div 注册 listener 是安全的——renderBoard 在开头 `board.innerHTML=''` 统一销毁旧 DOM 及其 listener。

#### Check
1. 提取 `code/ui.js` 中所有 `function render` 开头的函数体
2. 搜索函数体内的 `addEventListener(`
3. 排除安全模式：target 为函数内 `document.createElement` 创建的变量 / `querySelector` 从本次渲染父容器内选取的
4. 命中非安全模式 → FAIL

#### 当前代码状态（2026-05-28）
- `render()`：PASS ✅
- `renderBoard()`：L131-L144 对局部 div 注册，安全 ✅
- `renderSlot()`：PASS ✅
- `renderStatsPanel()`：PASS ✅

#### Severity: CRITICAL

---

### Contract A3a [CRITICAL]
#### Rule
animationend 事件注册必须使用 `{once: true}`。

#### Rationale
animationend 如果不设 once，每次动画结束都会触发回调。如果回调里有副作用（如修改状态、触发下一阶段），会导致事件指数级堆积。

#### Check
1. 搜索 `code/core.js` 和 `code/ui.js` 中的 `animationend`
2. 若命中 → 检查同一行或下一行是否有 `{once: true}` 或 `{ once: true }`
3. 无命中 → PASS（哨兵规则：当前无动画事件，以后加了必须带 once）

#### 当前代码状态
全文搜索 `animationend`：零命中 ✅ — PASS（哨兵规则）

#### Severity: CRITICAL

---

### Contract B2 [CRITICAL]
#### Rule
`G.enemyHP` 的减法操作必须有 `Math.max(0, ...)` 下限保护。

#### Rationale
Boss HP 溢出为负数会导致 endGame 判断失效、UI 显示异常。

#### Check
1. 搜索 `G\.enemyHP\s*=`（排除 newGame 中的初始化 `G.enemyHP = boss.maxHP`）
2. 所有命中行必须出现 `Math.max(0, ...)`
3. 缺少 → FAIL

#### 当前代码状态
- `core.js` L511：`G.enemyHP = Math.max(0, G.enemyHP - d)` ✅
- `core.js` L551：`G.enemyHP = Math.max(0, G.enemyHP - spDmg)` ✅

#### Severity: CRITICAL

---

### Contract B3 [MEDIUM]
#### Rule
`G.phase` 只允许赋值为白名单值：`player`、`enemy`、`resolving`、`over`。

#### Rationale
非白名单的 phase 值会导致状态机卡死——玩家不能操作、敌人不能行动、游戏逻辑无法推进。

#### Check
1. 搜索 `G\.phase\s*=\s*'(?<value>[^']+)'`，提取所有赋值值
2. 逐项比对白名单
3. 出现白名单外值 → FAIL

#### 当前代码状态
- L375：`'resolving'` ✅
- L392：`'resolving'` ✅
- L613：`'player'` ✅
- L688：`'player'` ✅
- L791：`'player'` ✅
- L805：`'over'` ✅
- L884：读取比较（非赋值）— 不触发

#### Severity: MEDIUM

---

### Contract C2 [MEDIUM]
#### Rule
每个 BOSSES 定义的 `cycle` 数组长度必须 > 0。

#### Rationale
空 cycle 会导致 enemyTurn 中 `cycle[t % cycle.length]` 除零，游戏崩溃。

#### Check
1. 读取 `code/data.js` 的 BOSSES 对象
2. 逐个 Boss 检查 `cycle` 字段：内联数组检查 length，引用 `BOSS_CYCLE_TEMPLATE` 则检查模板非空
3. 任意 length === 0 → FAIL

#### 当前代码状态
- 所有猫猫Boss 使用 `BOSS_CYCLE_TEMPLATE`（L128-L323），模板长度 7 ✅
- 毛线团（skeleton）`cycle` L349：7 项 ✅
- 逗猫棒（catToy）`cycle` L336：3 项 ✅

#### Severity: MEDIUM

---

## Tier 2 — 需要上下文理解（每次架构变更后手动触发）

---

### Contract A1a [CRITICAL]
#### Rule
renderBoard 创建的 DOM 节点上注册的事件监听器，必须在 renderBoard 开头通过 `board.innerHTML = ''` 统一清除。

#### Rationale
单文件 HTML 游戏没有组件生命周期。renderBoard 通过在开头清空父容器来销毁旧 DOM——这同时销毁了挂在上面的 listener。如果某次重构去掉了这个 `innerHTML=''` 改用增量更新，旧 listener 会泄漏。

#### Check
1. 确认 `code/ui.js` 函数 renderBoard 内第一行或前五行有 `board.innerHTML = ''`
2. 确认 renderBoard 内所有 addEventListener 的目标都是本次 renderBoard 新创建的 DOM 节点
3. 任一不满足 → FAIL

#### 当前代码状态
- L79：`board.innerHTML = ''` ✅

#### Severity: CRITICAL

---

### Contract A3b [HIGH]
#### Rule
如果存在动画状态锁变量（如 `isAnimating`），其重置必须在 animationend 回调内完成。

#### Rationale
isAnimating 设为 true 后忘了重置，会永久阻塞后续动画，导致 UI 假死。

#### Check
1. 全文搜索 `isAnimating\s*=\s*true`
2. 若命中 → 检查同文件中 animationend 回调内是否有 `isAnimating\s*=\s*false`
3. 无一命中 → PASS（哨兵规则：当前无动画锁，以后加了必须有释放）

#### 当前代码状态
全文搜索 `isAnimating`：零命中 ✅ — PASS（哨兵规则）

#### Severity: HIGH

---

### Contract E1 [DESIGN_PENDING] — preview-runtime dur source consistency
#### Rule
预览函数 `getEffectDescription` 和结算函数 `executeTurn` Phase 1 的 dur 计算必须引用同一套函数（`getComboDuration` / `getStunDuration`）。

#### Rationale
预览和实际结算使用不同的 dur 计算逻辑会导致玩家看到 4 回合、实际只有 2 回合。

#### 当前代码状态（2026-05-28）
- 函数引用：同一族 ✅
- fury 对 stun dur 的处理：预览有 fury 乘（L356-L358），结算没有（L442）→ **不一致**

#### Status: DESIGN_PENDING
当前 preview/runtime 的 fury 行为不一致。未定义最终设计真值——fury 到底影不影响 stun 持续时间？这需要 gameplay authority 决策。
Verifier 不判 FAIL，仅提示 divergence。决策后更新本条 contract。

#### Severity: DESIGN_PENDING

---

### Contract E2 [DESIGN_PENDING] — preview-runtime buffDurationBonus consistency
#### Rule
预览函数 `getEffectDescription` 的 dur 与结算函数 `executeTurn` Phase 1 的 dur 对 `buffDurationBonus` 的处理必须一致。

#### Rationale
耐久核心（`endurance_core`）给 buff 持续回合 +1。预览没加而结算加了 → 玩家看到的回合数比实际少 1，导致战术判断错误。

#### 当前代码状态（2026-05-28）
- 预览 L344：无 buffDurationBonus ❌
- 结算 L432：有 buffDurationBonus ✅
- 结论：不一致 → 预览少 1 回合

#### Status: DESIGN_PENDING
当前 preview 和 runtime 对 buffDurationBonus 的处理不一致。未定义最终设计真值——是否保留耐久核心？如果保留，预览是否要同步加 buffDurationBonus？这需要 gameplay authority 决策。
Verifier 不判 FAIL，仅提示 divergence。决策后更新本条 contract。

#### Severity: DESIGN_PENDING

---

## Appendix: 条款来源

| Contract | 对应历史 bug |
|----------|-------------|
| A2 | render 函数内对全局 DOM 重复 addEventListener（哨兵规则，当前 PASS） |
| A3a | animationend 泄漏（哨兵规则） |
| B2 | enemyHP 溢出为负数 |
| B3 | phase 非法值导致状态机卡死 |
| C2 | cycle 空数组除零崩溃 |
| A1a | renderBoard 不先 clear 直接增量更新 |
| A3b | isAnimating 未释放（哨兵规则） |
| E1 | fury 对 dur 乘法在两处行为不一致 |
| E2 | buffDurationBonus 预览缺 1 回合 |
