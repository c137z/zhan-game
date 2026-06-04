# task_sprint4_ui_unidirectional.md

> TASK_ID: sprint4_ui_unidirectional
> STATUS: ready → assign to Writer (Claude Code)
> DEPENDS_ON: v1.98 (sprint3 completed — Zhan.Engine exists, dispatch() works)

---

## Objective

ui.js 禁止直接修改 state，所有 UI 事件通过 `Zhan.Engine.dispatch()` 发指令。渲染层纯函数化——render 只读 state，不写 state。

---

## Scope

**只改 ui.js + index.html（加测试开关）**

**不改：** core.js, data.js, style.css, relic.css

---

## PART 1: 消除 ui.js 中的 state 写入

### 1A. render() 中 effective 值写入 → 移到 Engine

**当前代码**（ui.js L20-24，Sprint 3 产出中已存在）：
```js
G.effectiveAtkBuffMult = furyEff.atkBuffMult;
G.effectiveVulnMult = furyEff.vulnMult;
G.effectiveDefBuffRatio = furyEff.defBuffRatio;
```

这是目前 ui.js 中唯一的直接 state 写入。

**方案**：在 `Zhan.Engine.dispatch()` 的 render 调用前，增加一个 `_preRender()` 步骤计算并更新 effective 值。或者更好的做法——在 `_playerPhase` 和 `_enemyPhase` 中对 playerHP 有变化的时机调用一个 Engine 内部的 `_updateEffectiveFury()` 方法。

**具体修改**：在 core.js 的 `Zhan.Engine` 中新增：
```js
_updateEffectiveFury: function(st) {
  var furyEff = Zhan.Rules.computeEffectiveFury(st.playerHP, st.playerMaxHP, {
    furyEnabled: st.furyEnabled,
    atkBuffMult: st.atkBuffMult,
    vulnMult: st.vulnMult,
    defBuffRatio: st.defBuffRatio
  });
  st.effectiveAtkBuffMult = furyEff.atkBuffMult;
  st.effectiveVulnMult = furyEff.vulnMult;
  st.effectiveDefBuffRatio = furyEff.defBuffRatio;
}
```

然后在 `_playerPhase` 末尾（所有伤害结算完成后）和 `_enemyPhase` 末尾（敌人伤害应用后）调用 `this._updateEffectiveFury(st)`。

**在 ui.js 中删除那 4 行**（L18-24 中的赋值语句），只保留 computeEffectiveFury 的调用用于 badge/preview 显示——不对，删除整个 computeEffectiveFury 调用，因为 effective 值已经由 Engine 在 phase 结束时计算好了。render 直接读 `state.effectiveAtkBuffMult` 等即可。

**更正**：ui.js 中的 `Zhan.UI.render` 里那段代码：
```js
var furyEff = Zhan.Rules.computeEffectiveFury(G.playerHP, G.playerMaxHP, {
  furyEnabled: G.furyEnabled,
  atkBuffMult: G.atkBuffMult,
  vulnMult: G.vulnMult,
  defBuffRatio: G.defBuffRatio
});
G.effectiveAtkBuffMult = furyEff.atkBuffMult;
G.effectiveVulnMult = furyEff.vulnMult;
G.effectiveDefBuffRatio = furyEff.defBuffRatio;
```

全部删除。render 函数改为只从 state 读取，不再计算或写入。

**对应 core.js 改动**：在 `Zhan.Engine` 中新增 `_updateEffectiveFury`，并在以下时机调用：
- `_playerPhase` 末尾（所有伤害/衰减处理完后，win/lose 检查前）
- `_enemyPhase` 末尾（applyDamageToPlayer 之后，phase 切换回 player 前）
- `init()` 末尾（初始状态）

---

## PART 2: 渲染函数纯化

### 2A. 确认所有 UI 函数只读不写

逐函数检查：
- `Zhan.UI.render(state)` — ✅ 已接收 state 参数，删除 fury 计算写入后只读
- `Zhan.UI.renderBoard(G)` — 检查内部是否只读 G 的字段、不写
- `Zhan.UI.renderSlot(G)` — 同上
- `Zhan.UI.updateComboPreview(state)` — 检查
- `Zhan.UI.renderStatsPanel(state)` — 检查
- `showRelicSelect()` — 检查（这个可能不接收 state 参数，涉及读全局 G）
- `showBossInfo()` / `showPlayerInfo()` — 检查（读状态用于显示，不应写）

### 2B. 移除 ui.js 中所有对全局 G 的引用

搜索模式并替换：
- `var G = Zhan.Engine.state || window.G || {};` → 在函数参数中接收 state，或直接 `Zhan.Engine.state`
- 所有 `G.xxx` 读取改为从参数 state 或 `Zhan.Engine.state` 读取（只读）
- 绝对禁止 `G.something = value` 形式的写入

### 2C. 事件绑定全部走 dispatch

当前状态已大部分完成（Sprint 3 产出），确认并确保完整性：

```js
// 结束回合
document.getElementById('btn-end-turn').addEventListener('click', function() {
  var st = Zhan.Engine.state;
  if (!st || st.phase !== 'player' || st.over || st.slot.length === 0) return;
  Zhan.Engine.dispatch({ type: 'END_TURN' });
});

// 重置
document.getElementById('btn-reset').addEventListener('click', function() {
  document.getElementById('result-overlay').classList.remove('show');
  Zhan.Engine.dispatch({ type: 'RESET' });
});

// 再来一局
document.getElementById('btn-restart').addEventListener('click', function() {
  document.getElementById('result-overlay').classList.remove('show');
  Zhan.Engine.dispatch({ type: 'RESTART' });
});

// 无尽模式
document.getElementById('btn-endless').addEventListener('click', function() {
  document.getElementById('result-overlay').classList.remove('show');
  Zhan.Engine.dispatch({ type: 'START_ENDLESS' });
});
```

卡牌点击/双击/拖拽 → `Zhan.Engine.dispatch({ type: 'PLAY_CARD', r, c })`

### 2D. 确认不再直接调用 core 函数

在 ui.js 中搜索以下模式，结果为 0：
- `executeTurn(`
- `pullCard(`
- `newGame(`
- `applyDamageToPlayer(`
- `updateEnemyIntent(`
- `endGame(`

事件绑定中允许 `Zhan.Engine.dispatch(...)` 和 `document.getElementById(...)` 的 DOM 操作。

---

## PART 3: core.js 小幅改动

### 3A. 新增 _updateEffectiveFury

在 `Zhan.Engine` 对象中新增：

```js
_updateEffectiveFury: function(st) {
  var furyEff = Zhan.Rules.computeEffectiveFury(st.playerHP, st.playerMaxHP, {
    furyEnabled: st.furyEnabled,
    atkBuffMult: st.atkBuffMult,
    vulnMult: st.vulnMult,
    defBuffRatio: st.defBuffRatio
  });
  st.effectiveAtkBuffMult = furyEff.atkBuffMult;
  st.effectiveVulnMult = furyEff.vulnMult;
  st.effectiveDefBuffRatio = furyEff.defBuffRatio;
}
```

### 3B. 调用 _updateEffectiveFury 的时机

在以下位置插入 `this._updateEffectiveFury(st);`：
1. `init()` 末尾（return st 之前）
2. `_playerPhase` 末尾（在 `this._updateEnemyIntent(st)` 前或后）
3. `_enemyPhase` 末尾（在 `st.phase = 'player'` 之前，dispatch render 之后）

### 3C. 可能需要的 dispatch type 补充

如果当前 `Zhan.Engine.dispatch` 还没处理 `START_ENDLESS`：
```js
case 'START_ENDLESS':
  ENDLESS_DEFEATED = {};
  var es = this.init();
  es.isEndless = true;
  // endless 从 skeleton 开始
  break;
```

---

## PART 4: index.html 新增测试开关

在 `</body>` 前、`<script>` 加载之后，新增：

```html
<script>
// ========== 浏览器内回归测试 ==========
Zhan.Test = {
  assert: function(cond, msg) {
    if (!cond) { console.error('FAIL: ' + msg); throw new Error(msg); }
  },
  run: function() {
    console.log('=== Zhan Regression Test ===');
    // Rules 测试
    this.assert(Zhan.Rules.calcBaseValue(5, 3) === 8, 'calcBaseValue');
    this.assert(Zhan.Rules.resolveWildType([{ type: 'attack' }, { type: 'wild' }], 1) === 'attack', 'resolveWildType');
    // Engine 集成测试
    Zhan.Engine.init();
    this.assert(Zhan.Engine.state.playerHP === 100, 'init HP');
    this.assert(Zhan.Engine.state.bossId === 'skeleton', 'init boss');
    // UI 单向化测试：dispatch 正常
    Zhan.Engine.dispatch({ type: 'END_TURN' });
    this.assert(Zhan.Engine.state.turn >= 1, 'END_TURN dispatch works');
    // 重置
    Zhan.Engine.dispatch({ type: 'RESET' });
    this.assert(Zhan.Engine.state.turn === 0, 'RESET dispatch works');
    console.log('=== All Tests Passed ===');
  }
};
if (location.hash === '#test') {
  setTimeout(function() { Zhan.Test.run(); }, 800);
}
</script>
```

---

## PART 5: 打包

产出 `zhan_v1.99_sprint4.html`：
```powershell
# 拼接顺序：data.js + core.js + ui.js → 内联到 index.html（替换 <script src="..."> 为内联）
# [Writer 自行执行具体的打包命令]
[System.IO.File]::WriteAllText("C:\Users\kyzha\.openclaw\projects\zhan\zhan_v1.99_sprint4.html", $html, [System.Text.UTF8Encoding]::new($true))
```

---

## Verifier Checklist

### 1. ui.js 源码审查 ⭐
在 `code/ui.js` 中搜索：
- `executeTurn(` → 应 0 处
- `pullCard(` → 应 0 处
- `newGame(` → 应 0 处
- `G\.playerHP\s*=` → 应 0 处（不应有任何直接 state 写入）
- `G\.\w+\s*=` → 应 0 处（除了 `var G = ...` 声明）

### 2. Console 无错误
打开页面，F12 Console 无红色错误

### 3. 基础交互
- 单击卡牌查看牌堆内容（如果有这个功能）
- 双击卡牌入槽 → 正常
- 拖拽卡牌入槽 → 正常
- End Turn 按钮正常结算

### 4. 长按弹窗
- 长按 Boss 头像 → Boss 信息弹窗正常显示
- 长按勇者头像 → 圣物信息弹窗正常显示
- 关闭按钮正常

### 5. 通关/败北弹窗
- 战斗结束后 result overlay 正常显示
- 统计面板数据正确
- "再来一局"按钮正常
- "无尽模式"按钮正常进入下一只随机猫

### 6. 测试开关 ⭐
在浏览器地址栏 URL 后加 `#test` 回车
- F12 Console 应显示 `=== All Tests Passed ===`
- 不应有任何 FAIL 消息

### 7. Fury 动态 effective 值 ⭐
- 选择 fury_core 遗物
- 战斗过程中，随着 HP 下降，badge（atk-buff/vuln/def-buff）数值应该实时变化
- **验证：render 不再计算 effective 值，而是从 Engine 预计算好的 state 中读取**

---

## 风险提示

- `showRelicSelect()` / `showBossInfo()` / `showPlayerInfo()` 可能读取全局 G——需要改为从 `Zhan.Engine.state` 只读
- renderBoard / renderSlot 内部如果有 `G.something = ...` 的隐含写入需要揪出来
- 事件绑定中的 lambda 如果闭包捕获了局部 `var G` 需要注意一致性

## 禁止改动

- data.js
- style.css / relic.css
- Zhan.Rules 函数
- Zhan.Systems 函数
- 游戏数值和平衡
