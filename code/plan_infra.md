# 《斩》基础设施优化 — 修改计划

> 创建时间：2026-06-11
> 状态：已修订（v1.1，根据审核意见修正 2 个 🔴 风险 + 2 个 🟡 风险 + 4 项遗漏）

---

## 一、RNG 种子系统 (P0)

### 1.1 新增 `Zhan.RNG` 模块 (core.js，约 22 行)

```js
Zhan.RNG = {
  _seed: 0,
  _initialSeed: 0,
  setSeed: function(s) {
    // 🔴 修复: s=0 是合法种子，不能用 s || Date.now()
    s = (s !== undefined && s !== null) ? s : Date.now();
    this._seed = s;
    this._initialSeed = s;  // 🔴 修复: 单独保存初始种子，getSeed() 始终返回初始值
  },
  random: function() {
    this._seed = (this._seed * 9301 + 49297) % 233280;
    return this._seed / 233280;
  },
  getSeed: function() { return this._initialSeed; }
};
```

### 1.2 修改 `shuffle()` — 支持可选 RNG 参数 (core.js)

```js
// 之前（1471 行附近）
function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
}

// 之后
function shuffle(a, rng) {
  var rand = rng || Math.random;
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
}
```

### 1.3 Math.random() 替换清单（修正版）

| 位置 | 行号 | 函数/上下文 | 替换方式 |
|------|------|------------|----------|
| `shuffle(st.deck)` | 1458 | 战斗开始洗牌库 | `shuffle(st.deck, ZhanRNG.random)` |
| `_buildPiles()` 内联循环 | 618 | 每堆顶牌 4 张内部随机交换 | **直接替换** `Math.random` → `ZhanRNG.random`（不经过 shuffle，是内联 Fisher-Yates） |
| `random_discard` trait | 185 | 阿比随机弃牌（`Math.floor(Math.random() * G.slot.length)`） | **直接替换** `Math.random` → `ZhanRNG.random` |
| `insert_junk` trait | 226 | 暹罗随机塞废牌位置 | **直接替换** `Math.random` → `ZhanRNG.random` |
| `SHUFFLE` action — 顶牌内联循环 | ~778 | 洗牌后每个 pile 顶牌内部随机交换（同 _buildPiles 模式） | **直接替换** `Math.random` → `ZhanRNG.random` |
| `SHUFFLE` action — 外层的 `shuffle(allCards)` | ~757 | 收集全部卡牌后全局洗牌 | `shuffle(allCards, ZhanRNG.random)` |
| `pickTowerCat` | 1304 | 塔选猫 → META | **不换** |
| `pickRandomCat` | 1299 | 随机猫 → META | **不换** |
| `_startTowerNextCat` | 1627, 1641 | 塔内下一对手 → META | **不换** |
| `advGoNext` | 1859 | 冒险下一 Boss → META | **不换** |
| `_showRelicSelect` | 1734 | 随机圣物（`allRelicIds` shuffle + `slice(0,count)`）| **不换**（此处 `shuffle` 不传 rng，自动走 `Math.random`） |
| `_rerollRelics` | 1750 | 圣物重随 → META | **不换**（同上） |

**原则**：战斗内（洗牌、牌堆顶牌随机、Boss 随机事件）→ `ZhanRNG.random()`；战斗外（选关、圣物、Boss 选择）→ `Math.random()`。

### 1.4 种子初始化 + 记录 (newGame 函数，~6 行)

```js
// newGame() 开头
if (options.seed === undefined || options.seed === null) {
  options.seed = Date.now();
}
Zhan.RNG.setSeed(options.seed);
// ... state 创建之后:
st.battleSeed = Zhan.RNG.getSeed();

// 战斗日志输出种子
log(st, '🎲 种子: ' + st.battleSeed);
```

### 1.5 改造量估算

| 文件 | 新增 | 修改 | 总计 |
|------|------|------|------|
| `core.js` | ~28 行（模块 + 初始化） | ~12 行（替换 6 处 Math.random 调用） | ~40 行 |

---

## 二、战斗日志补全 (P1)

### 2.1 当前缺失的日志事件（对照排查）

| 事件 | 代码位置 | 当前日志状态 |
|------|---------|------------|
| 舔毛 (groom) | `Zhan.Systems.Boss._hpTriggerHandlers.groom`（core.js ~244 行） | ❌ 无 `_pushBattleLog` |
| 哈气 (hiss) | `Zhan.Systems.Boss._hpTriggerHandlers.hiss`（core.js ~254 行） | ❌ 无 `_pushBattleLog`（只有 `log()` 控制台输出） |
| 狸花锁牌 | `Zhan.Systems.Boss._traitHandlers.lock_pile` | ⚠️ 只有 `log()`，游戏内日志面板看不到 |
| 英短锁槽 | `Zhan.Systems.Boss._traitHandlers.lock_slot` | ⚠️ 同上 |
| 暹罗塞废牌 | `Zhan.Systems.Boss._traitHandlers.insert_junk` | ⚠️ 同上 |
| 斯芬舔 Buff | `Zhan.Systems.Boss._traitHandlers.lick_player` | ⚠️ 同上 |
| 布偶涂牌 | `Zhan.Systems.Boss._traitHandlers.smear_piles` | ⚠️ 同上 |
| 阿比弃牌 | `Zhan.Systems.Boss._traitHandlers.random_discard` | ⚠️ 同上 |
| 折耳晕玩家 | `Zhan.Systems.Boss._traitHandlers.stun_player` | ⚠️ 同上 |

### 2.2 改造方案

#### 2.2.1 groom 和 hiss（urgent — 完全缺失）

位置：`Zhan.Systems.Boss._hpTriggerHandlers`

```js
// groom handler 中（execute 函数体内，log() 之前）
_pushBattleLog({ type: 'action', side: 'enemy', action: 'trait',
  text: '🐱 舔毛！Boss 清除自身全部 Debuff（破甲/虚弱/击晕）' });
log('🐱 舔毛！Boss 清除自身全部 Debuff（破甲/虚弱/击晕）');  // 保留 console 调试

// hiss handler 中（execute 函数体内，log() 之前）
_pushBattleLog({ type: 'action', side: 'enemy', action: 'trait',
  text: '🐱 哈气！！全场 Buff/Debuff 清空！' });
log('🐱 哈气！！全场 Buff/Debuff 清空！');  // 保留 console 调试
```

> 🟢 安全确认：`_pushBattleLog` 内部有 `if (!st || !st.logLines) return;` guard，handler 执行时 state 一定存在。

#### 2.2.2 其他 trait（nice-to-have — log() 进 console 但不进游戏面板）

六个 trait handler 当前每个都有 `log('...')` 调用。每个旁边加一行 `_pushBattleLog`，格式一致：

```js
_pushBattleLog({ type: 'action', side: 'enemy', action: 'trait', text: '...' });
```

此部分不阻塞 P0，可择机补。

### 2.3 改造量

| 文件 | 改动 |
|------|------|
| `core.js` | groom + hiss 各 ~3 行，共 ~6 行（含保留的 `log()`） |
| `core.js` | 其他 6 个 trait 各 ~1 行（可选，不阻塞 P0） |

---

## 三、回放系统基础 (P1)

### 3.1 设计

回放 = `battleSeed` + `dispatch` 序列。当前 `Zhan.Engine.dispatch()` 已集中所有玩家操作，`logLines` 已是结构化数据。

需要额外处理：
1. **记录范围限定**：`GO_HOME`、`RESET`、`RESTART`、`ADV_CONTINUE` 等元操作不进入回放序列
2. **END_TURN 内的 setTimeout**：回放时不依赖真实计时器，`_executeTurn` → `_enemyTurn` 在回放模式下同步执行

### 3.2 改造

```js
// dispatch() 中 — 仅在战斗进行中记录
// 🟡 修复：限定记录范围
dispatch: function(action) {
    if (!this.state) return;
    // 只在玩家回合阶段记录可回放操作
    var replayableActions = ['PLAY_CARD', 'END_TURN', 'REMOVE_CARD', 'SHUFFLE'];
    if (replayableActions.indexOf(action.type) >= 0
        && this.state.phase === CONFIG.PHASE_PLAYER
        && !this.state.over) {
      this.state.replayActions.push(action);
    }
    switch (action.type) { ... }
}
```

```js
// newGame() 初始化
st.replayActions = [];
```

```js
// ui.js 结算面板 — stats card 加一行种子号
'<div class="stat-row-item"><span class="stat-label">🎲 种子</span><span class="stat-value">' + st.battleSeed + '</span></div>'
```

### 3.3 改造量

| 文件 | 改动 |
|------|------|
| `core.js` `dispatch()` | ~5 行（guard + push） |
| `core.js` `newGame()` | ~1 行（初始化） |
| `ui.js` `renderStatsPanel()` | ~1 行（种子展示） |
| **总计** | **~7 行** |

---

## 四、万局测试 — Node.js 脚本 (P1，依赖 RNG 完成)

### 4.1 注意事项

> 🟢 修复：`data.js` 和 `core.js` 没有 `module.exports`，不能用 `require()`。需用 `fs.readFileSync` + `vm.runInNewContext` 沙箱执行。

### 4.2 脚本结构

```js
// simulate.js (~80 行)
var fs = require('fs');
var vm = require('vm');

// 1. 沙箱环境（模拟浏览器全局变量 + localStorage mock）
var sandbox = {
  window: {},
  localStorage: { _store: {}, getItem: function(k) { return this._store[k] || null; },
                  setItem: function(k,v) { this._store[k] = v; } },
  console: { log: function() {} },
  setTimeout: function(fn, ms) { fn(); },  // 同步执行，不回放真实延时
};
vm.runInNewContext(fs.readFileSync('data.js', 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync('core.js', 'utf8'), sandbox);

// 2. 模拟随机 dispatch 循环
var Zhan = sandbox.Zhan || sandbox.window.Zhan;
var crashes = 0;
for (var seed = 1; seed <= 10000; seed++) {
  try {
    Zhan.RNG.setSeed(seed);
    Zhan.Engine.init();
    var st = Zhan.Engine.state;
    st.battleSeed = seed;
    var maxSteps = 200;
    while (!st.over && maxSteps-- > 0) {
      // 随机选牌 + 结束回合
      // 检查：playerHP < 0, enemyHP < 0, NaN, 卡死
    }
    if (maxSteps <= 0) { crashes++; console.log('STUCK: seed=' + seed); }
  } catch(e) {
    crashes++;
    console.log('CRASH: seed=' + seed + ' | ' + e.message);
  }
}
console.log('Done: ' + crashes + ' failures / 10000');
```

### 4.3 改造量

| 文件 | 改动 |
|------|------|
| `simulate.js` (新建) | ~80 行 |

---

## 五、总览（修订版）

| 序号 | 事项 | 文件 | 行数 | 优先级 |
|------|------|------|------|--------|
| ① | RNG 种子系统 | core.js | ~40 | **P0** |
| ② | 战斗日志 - groom/hiss 补全 | core.js | ~6 | **P1** |
| ②b | 战斗日志 - 6 个 trait log→pushBattleLog | core.js | ~6 | P2（可选） |
| ③ | 回放基础（dispatch 记录 + 种子展示） | core.js + ui.js | ~7 | **P1** |
| ④ | 万局模拟脚本 | simulate.js (新) | ~80 | **P1** |

---

## 六、修订记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-06-11 | 初始版本 |
| v1.1 | 2026-06-11 | 修正 🔴 setSeed(0) falsy bug / 🔴 getSeed 初始种子丢失 / 🟡 _buildPiles 覆盖说明 / 🟡 dispatch 记录范围限定 / 🟢 require→vm 方案 / 补 4 项遗漏 |

---

## 七、明确不做的事

- ❌ `_executeTurn` 中 5 个 buff switch case 改写查表 — 体量太小，无需专门立项
- ❌ 性能监控 — 过早优化
- ❌ Mod 注册接口 — 过早设计
- ❌ 效果系统统一抽象 — 当前技术债不影响迭代速度

---

## 八、项目约束（执行前必读）

- 纯前端 HTML/CSS/JS 游戏，单文件结构
- 使用 window.Zhan 命名空间
- data.js 禁止写 function（polyfill 除外）
- core.js 禁止碰 DOM
- ui.js 禁止直接修改 state
- 所有修改必须先备份到指定目录
- 只修改代码，不运行测试，不验证结果
