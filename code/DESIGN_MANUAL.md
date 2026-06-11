# 《斩》设计手册 v1.1

> 创建：2026-06-11 | 修订：2026-06-11 | 基于 GPT 八条基础设施建议 + CC 执行 + reasonix 审查

---

## 一、项目概要

《斩》是一款纯前端卡牌对战游戏，单文件 HTML 结构，`window.Zhan` 命名空间。

### 文件职责

```
index.html   — 单文件入口：CSS + DOM 结构 + 启动脚本 + 回归测试
data.js      — 纯数据配置，禁止写 function（polyfill 除外）
core.js      — 战斗引擎，禁止碰 DOM
ui.js        — 渲染 + DOM 事件，禁止直接修改 state
simulate.js  — Node.js 沙箱万局测试（离线运行，不参与 index.html 加载）
```

### 数据流

```
玩家操作 → Zhan.Engine.dispatch(action)
                ↓
         state 变更（core.js）
                ↓
    ┌──────────┼──────────┐
    ↓                      ↓
Zhan.UI.render(state)   Zhan.Events.emit(...)
    ↓                      ↓
DOM 更新                logLines 追加
                          ↓
                    战斗日志面板（结构化）
```

---

## 二、已实现的基础设施

### 2.1 RNG 确定性随机数系统 ✅

**位置**：`core.js` — `Zhan.RNG` 模块

```js
Zhan.RNG = {
  _seed: 0,
  _initialSeed: 0,
  setSeed: function(s) {
    s = (s !== undefined && s !== null) ? s : Date.now();
    this._seed = s;
    this._initialSeed = s;
  },
  random: function() {
    this._seed = (this._seed * 9301 + 49297) % 233280;
    return this._seed / 233280;
  },
  getSeed: function() { return this._initialSeed; }
};
```

**设计决策**：
- 使用线性同余生成器（LCG），参数 `9301/49297/233280`，周期 ~23 万
- 战斗内所有随机（洗牌、牌堆、Boss 事件）走 `Zhan.RNG.random()`
- 战斗外随机（选关、圣物、Boss 选择）保留 `Math.random()`
- `setSeed(0)` 是合法种子（`0` 不是 falsy 陷阱，已用严格 `!== undefined` 检查）
- `getSeed()` 始终返回初始种子（`_initialSeed`），不受后续 `random()` 调用影响

**覆盖范围**：

| 位置 | 用途 |
|------|------|
| `shuffle(st.deck)` | 战斗开始洗牌 |
| `_buildPiles()` 内联 | 每堆顶牌随机化 |
| `SHUFFLE` action | 玩家主动洗牌 + 顶牌内联 |
| `lock_pile` trait | 狸花锁牌随机选摞 |
| `lock_slot` trait | 英短锁槽随机选位 |
| `random_discard` trait | 阿比随机弃牌 |
| `insert_junk` trait | 暹罗随机塞废牌 |

### 2.2 战斗日志结构化 ✅

**位置**：`core.js` — `_pushBattleLog()` + `logLines` 数组

**日志条目格式**：

```js
// 回合头
{ type: 'turnHeader', text: '—— 第 3 回合 ——' }

// 出牌行
{ type: 'cardsRow', cards: ['attack','defend','attack'] }

// Buff 行
{ type: 'buffsRow', buffs: [{ name:'暴击', value:'×1.5', color:'#f1c40f' }] }

// 行动（含公式）
{ type: 'action', side: 'player', action: 'attack',
  text: '🗡 造成 28 点伤害',
  formulaParts: [{ text: '12(基础5连)', color: '#eee' }, { text: ' ×1.5(暴击)', color: '#f1c40f' }],
  finalValue: '28',
  detail: 'Boss HP: 150 → 122  🛡️: 0 → 0' }

// 回合尾
{ type: 'turnFooter', text: '—— 回合结束 ——' }
```

**已覆盖的 Boss 行为日志**：groom（舔毛）、hiss（哈气）、lock_pile、lock_slot、smear_piles、insert_junk、lick_player、random_discard、stun_player

### 2.3 回放基础 ✅

**记录**：`dispatch()` 中限定范围记录战斗操作

```js
// 仅记录五种战斗操作，在 PLAYER 阶段且未结束时
var replayableActions = ['PLAY_CARD', 'END_TURN', 'REMOVE_CARD', 'RETURN_CARD', 'SHUFFLE'];
if (replayableActions.indexOf(action.type) >= 0
    && this.state.phase === CONFIG.PHASE_PLAYER && !this.state.over) {
  this.state.replayActions.push(action);
}
```

**回放原理**：`battleSeed` + `replayActions[]` → 重新执行 `dispatch(action)` 即可确定性复现

**种子展示**：结算面板 `renderStatsPanel()` 中展示 `🎲 种子: 12345`

### 2.4 万局自动化测试 ✅

**位置**：`simulate.js`（Node.js 离线运行）

**用法**：
```bash
node simulate.js            # 1000 局
node simulate.js 10000      # 10000 局
node simulate.js 100 42     # 100 局，从种子 42 开始
```

**检测项**：NaN、负血、血量膨胀（>2× 上限）、非法 phase、卡死（>300 步）、异常崩溃

**实现方式**：`vm.runInNewContext` 沙箱执行 `data.js` + `core.js`，mock 所有浏览器 API

---

## 三、GPT 八条建议 — 评估结论

| # | 建议 | 判定 | 理由 |
|---|------|------|------|
| 1 | 数据驱动 | ✅ 已 80% | BOSSES/RELICS/CARD_TYPES/ADVENTURE_STAGES 全是配置。唯一硬编码是 `_executeTurn` 中 5 个 buff switch case，体量太小不紧急 |
| 2 | 效果系统统一 | ⚠️ 技术债 | `applyEffect(effect)` 方向正确，但当前仅 5 种效果，改写查表即可，不需抽象层 |
| 3 | 回放系统 | ✅ 已实现 | logLines 已是结构化数据 + dispatch 记录 + RNG 种子，回放基础已就绪 |
| 4 | 随机数种子 | ✅ 已实现 | `Zhan.RNG` 模块，战斗内全覆盖 |
| 5 | 万局测试 | ✅ 已实现 | `simulate.js`，200 局验证通过 |
| 6 | 存档兼容 | ✅ 已完成 | `Zhan.Save.load()` 中 v0→v1→v2→v3 逐级迁移，`SAVE_VERSION=3` |
| 7 | 性能监控 | ❌ 过早 | 5×5 棋盘的 DOM 重绘没有性能压力 |
| 8 | Mod 接口 | ❌ 过早 | 内容体量远不到需要运行时注册的阶段 |

---

## 四、当前架构最佳实践

### 4.1 新增卡牌类型

在 `data.js` 中添加配置即可，无需改 `core.js`：

```js
// data.js — CARD_TYPES 中加一条
CARD_TYPES.my_new_type = { emoji: '🆕', label: '新卡', color: 'my-new', cssClass: 'card-my-new' };

// data.js — DECK_SIZES 中加数量
DECK_SIZES.my_new_type = 30;

// index.html — 加 CSS 颜色
.card-my-new { background: linear-gradient(135deg, #xxx, #yyy); }
```

### 4.2 新增 Boss 特性

在 `data.js` 中定义 trait，在 `core.js` 的 `_traitHandlers` 中注册 handler：

```js
// data.js — BOSSES 中加 trait
BOSSES.my_boss = {
  // ...
  traits: [{ id: 'my_trait', events: ['TURN_START'], params: { ... } }]
};

// core.js — Zhan.Systems.Boss._traitHandlers 加 handler
Zhan.Systems.Boss._traitHandlers.my_trait = {
  onTurnStart: function(G, params) { /* 效果逻辑 */ }
};
```

### 4.3 新增圣物

在 `data.js` 的 `RELICS` 中加条目，效果逻辑在 `core.js` 的 `Zhan.Systems.Relic._handlers` 中实现：

```js
// data.js
RELICS.my_relic = {
  id: 'my_relic', name: '我的圣物', type: 'rule',
  desc: '描述文本',
  effects: [{ phase: 'INIT', action: 'myAction', params: { ... } }]
};

// core.js
Zhan.Systems.Relic._handlers.myAction = function(G, params) { /* 效果 */ };
```

### 4.4 日志系统

项目有两套独立日志，职责不同：

| 系统 | 函数 | 数据格式 | 消费者 | 用途 |
|------|------|----------|--------|------|
| 战斗日志 | `_pushBattleLog(entry)` | 结构化对象 | 游戏内日志面板（`ui.js` → `renderLog()`） | 玩家可见的战斗记录 |
| 调试日志 | `log(msg)` | 纯字符串 | `console.log` | 开发者调试 |

**规范**：

```js
// Boss 行为：两套日志都写
_pushBattleLog({ type: 'action', side: 'enemy', action: 'trait',
  text: '🐱 舔毛！Boss 清除自身全部 Debuff' });
log('🐱 舔毛！Boss 清除自身全部 Debuff（破甲/虚弱/击晕）');

// 纯调试信息：只写 console
log('DEBUG: slotState=' + JSON.stringify(st.slot));

// 纯面板信息（回合头/尾、出牌行）：只写 _pushBattleLog
_pushBattleLog({ type: 'turnHeader', text: '—— 第 3 回合 ——' });
```

**原则**：玩家在游戏面板里需要看到的信息 → `_pushBattleLog`；开发者排查问题时需要的信息 → `log()`。两者可以共存但不强制捆绑。

### 4.5 随机数

战斗内：`Zhan.RNG.random()` 或 `shuffle(arr, Zhan.RNG.random)`
战斗外（选关/圣物/meta）：`Math.random()` 或 `shuffle(arr)`（默认走 Math.random）

---

## 五、不做的设计决策（及触发条件）

| 决策 | 当前状态 | 触发条件 |
|------|----------|----------|
| 效果系统统一 → `applyEffect(effect)` | 不做 | 当效果类型 >10 种或出现效果间交互 bug |
| 性能监控 → `Profiler` | 不做 | 当棋盘扩到 7×7+ 或加了粒子特效 |
| Mod 接口 → `registerRelic()` | 不做 | 当需要 DLC / 社区内容 / AI 生成内容 |
| 数据驱动深化 → 卡牌独立配置表 | 不做 | 当卡牌开始有 `if(card.id)` 分支 |

---

## 六、待评估：GPT 多端适配方案

GPT 提出了 6 条适配建议，用于移动端/多分辨率支持。当前项目是单档 `max-width: 520px` 的手机优先布局，暂时够用。这些建议留作未来参考。

| # | 建议 | 说明 | 适用场景 |
|---|------|------|----------|
| 1 | 安全区（safe-area） | CSS `env(safe-area-inset-*)` 适配刘海屏/底部指示条 | 全面屏 iPhone 适配 |
| 2 | LayoutManager | JS 统一管理各区域高度分配，替代硬编码 `vh` 值 | 多分辨率（平板/折叠屏） |
| 3 | rem/vw 弹性体系 | 基于根字体大小的比例缩放，替代 `px` | 需要等比缩放的 UI |
| 4 | 横屏锁定 | `screen.lock('portrait')` + CSS `@media orientation` | 防止横屏布局崩坏 |
| 5 | 触摸热区保证 | 所有可点击元素 ≥ 44×44px（Apple HIG） | 手指误触优化 |
| 6 | 渐进式 CSS | `@supports` 检测 + fallback | 兼容旧浏览器 |

**建议**：当前不需要实施。当以下任一条件满足时，再评估并挑需要的落地：

- 收到大量 iPad/平板用户的布局问题反馈
- 需要支持微信小游戏等非标准 WebView
- 要做全面屏/折叠屏适配
- 卡池扩到 7×7 以上导致屏幕密度不足

---

## 七、修改日志

| 日期 | 版本 | 内容 |
|------|------|------|
| 2026-06-11 | v1.0 | 初始版本：RNG + 回放 + simulate.js + GPT 建议评估 |
| 2026-06-11 | v1.1 | 审计修复：replayableActions 补 RETURN_CARD（手册+代码）、日志系统职责分离说明、GPT 多端适配方案录入 |

---

## 七、相关文件索引

| 文件 | 用途 |
|------|------|
| `plan_infra.md` | 本次基础设施改造的执行计划（含审核修订） |
| `simulate.js` | 万局测试脚本 |
| `backup_20260611_171832/` | 本次改造前的原始代码备份 |
| `CLAUDE.md` | 项目约束（CC 自动加载） |
