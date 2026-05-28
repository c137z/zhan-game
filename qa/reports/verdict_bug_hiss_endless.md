# Verdict: bug_hiss_endless — 哈气阈值 + 无尽去重

Contract version: a038d75
Date: 2026-05-28
Role: Verifier (verify-only, no code changes)

---

## Checklist Verification

### 1. HISS_TRIGGER 使用固定阈值 [200, 100]，不再 per-100-HP 检验
**Verdict: ✅ PASS**

来源: `data.js` L79-L93
```js
var HISS_TRIGGER = {
  id: 'hiss',
  condition: function(G) {
    if (G.hissPrevHP === undefined) G.hissPrevHP = G.enemyMaxHP;
    var thresholds = [200, 100];  // ← 固定阈值
    for (var i = 0; i < thresholds.length; i++) {
      if (G.enemyHP < thresholds[i] && G.hissPrevHP >= thresholds[i]) {
        G.hissPrevHP = G.enemyHP;
        return true;
      }
    }
    G.hissPrevHP = G.enemyHP;
    return false;
  },
  ...
};
```
- 阈值数组 `[200, 100]` 是硬编码常量，无 `Math.floor(G.enemyHP/100)` 或其他 per-100-HP 计算。
- 逻辑正确：当 HP 从 ≥200 降至 <200，或从 ≥100 降至 <100 时触发。
- `G.hissPrevHP` 追踪上一次 HP 值，阻止重复触发。

---

### 2. Boss HP 从 300 降至 250 → 不触发哈气
**Verdict: ✅ PASS (逻辑推导)**

- `hissPrevHP` 初始化为 `boss.maxHP` = 300（`core.js` L155-L159）
- 攻击后 `G.enemyHP = 250`
- 条件检查: `250 < 200`? No. `250 < 100`? No.
- 返回值: `false`，不触发哈气。
- `hissPrevHP` 更新为 250。

---

### 3. Boss HP 跌破 200（如 250→190）→ 触发哈气
**Verdict: ✅ PASS (逻辑推导)**

- `hissPrevHP` = 250（来自上一轮）
- 攻击后 `G.enemyHP = 190`
- 遍历阈值: `190 < 200 && 250 >= 200`? **Yes**. → 设置 `hissPrevHP = 190`, return `true`。
- 哈气执行: `execute(G)` → `G.playerEffects = {}; G.enemyEffects = {};`（清空全场 Buff/Debuff）。

---

### 4. Boss HP 跌破 100（如 150→90）→ 触发哈气
**Verdict: ✅ PASS (逻辑推导)**

- `hissPrevHP` = 150
- 攻击后 `G.enemyHP = 90`
- 遍历阈值: `90 < 200 && 150 >= 200`? No.
- 下一个阈值: `90 < 100 && 150 >= 100`? **Yes**. → 触发。

---

### 5. Boss HP 一次跨越多阈值（300→199）→ 只触发一次（不因同时过 200 和 100 触发两次）
**Verdict: ✅ PASS (逻辑推导)**

- `hissPrevHP` = 300
- 攻击后 `G.enemyHP = 199`
- 遍历阈值:
  - `199 < 200 && 300 >= 200`? **Yes** → 进入 if-block:
    - `G.hissPrevHP = 199`（立即更新！）
    - `return true`
  - 循环第2轮: `199 < 100 && 199 >= 100`? No（`199 < 100` 为 false）。
- 仅触发一次。`hissPrevHP` 在第一次匹配后被立即设为 199，等效于只记录一次 crossing。

---

### 6. 哈气效果仍为清空全场 Buff/Debuff
**Verdict: ✅ PASS**

来源: `data.js` L93-L96
```js
execute: function(G) {
  G.playerEffects = {};
  G.enemyEffects = {};
  log('🐱 哈气！！全场 Buff/Debuff 清空！');
}
```
- 与原始设计一致，无变更。

---

### 7. startEndlessNextCat 从未击败的 pool 中随机（已从 allCatIds 中 filter 掉 ENDLESS_DEFEATED 中的 boss）
**Verdict: ✅ PASS**

来源: `core.js` L868-L874
```js
function startEndlessNextCat() {
  var allCatIds = Object.keys(BOSSES).filter(function(k) { return k !== 'skeleton' && k !== 'catToy'; });
  var remaining = allCatIds.filter(function(id) { return !ENDLESS_DEFEATED[id]; });
  if (!remaining.length) {
    endGame(true, '全猫征服！');
    return;
  }
  var bossId = remaining[Math.floor(Math.random() * remaining.length)];
  ...
}
```
- `allCatIds` 过滤出 10 只猫猫 boss（排除 skeleton/catToy）。
- `remaining` 过滤掉 `ENDLESS_DEFEATED[id]` 为 `true` 的 bossId。
- 随机从 remaining 中选择。

---

### 8. 全部猫猫击败后 → 显示全猫征服
**Verdict: ✅ PASS**

来源: `core.js` L819-L827（`endGame` 中）
```js
var allCatIds = Object.keys(BOSSES).filter(function(k) { return k !== 'skeleton' && k !== 'catToy'; });
var allDefeated = allCatIds.every(function(id) { return ENDLESS_DEFEATED[id]; });
if (allDefeated) {
  overlay.classList.add('show');
  renderStatsPanel(G);
  document.getElementById('result-title').textContent = '🏆 全猫征服！';
  document.getElementById('result-desc').textContent = '所有猫猫Boss已被击败！（存活' + G.turn + '回合）';
  log('🏆 全猫征服！所有猫猫Boss已被击败！');
  btnEndless.style.display = 'none';
  ...
}
```
- 正确使用 `allCatIds.every()` 检查所有 10 只猫猫是否在 `ENDLESS_DEFEATED` 中。
- 全部击败时显示 "🏆 全猫征服！"，隐藏无尽按钮。

---

### 9. Contract C2: cycle 数组非空未破坏
**Verdict: ✅ PASS**

来源: `data.js` L55-L63
```js
var BOSS_CYCLE_TEMPLATE = [
  { type: 'attack' },
  { type: 'defend' },
  { type: 'buff_power' },
  { type: 'attack' },
  { type: 'defend' },
  { type: 'charge' },
  { type: 'rage' },
];
```
- 所有 10 只猫猫 Boss 的 `cycle` 字段均为 `BOSS_CYCLE_TEMPLATE`，7 元素数组非空。
- `core.js` 中 `enemyTurn()` 正确索引 cycle（包括 8+ 回合快速循环 fallback）。
- cycle 数组未被本次改动修改。

---

### 10. No side-effect on mechanics
**Verdict: ✅ PASS**

检查范围:
- `HISS_TRIGGER.condition`: 只读 `G.enemyHP`, `G.hissPrevHP`, `G.enemyMaxHP`，仅写入 `G.hissPrevHP`。不修改其他 game state。
- `HISS_TRIGGER.execute`: 只写入 `G.playerEffects` 和 `G.enemyEffects`（与原始行为一致）。
- `startEndlessNextCat`: 只读 `ENDLESS_DEFEATED` 和 `BOSSES`，只写入 `G.isEndless`, `G.activeRelics`, `G.bossId`, `G.currentStage`，然后调用 `newGame()`。
- `endGame` 中全猫征服检查: 只读 `ENDLESS_DEFEATED`，写入 UI overlay 和按钮状态（与原始流程一致）。
- 无对 `GROOM_TRIGGER`、combat resolution、damage formula、cycle execution 的修改。

---

### 11. No UI mismatch
**Verdict: ✅ PASS**

- HISS_TRIGGER 仅通过 `log()` 输出消息（`core.js` 中 `enemyTurn()` 调用 trigger.execute，其中包含 `log('🐱 哈气！！全场 Buff/Debuff 清空！')`）。
- `G.playerEffects` 和 `G.enemyEffects` 被清空后，下一帧 `render()` 会自然反映状态变化（buff/debuff 图标消失）。
- 全猫征服 UI（"🏆 全猫征服！"）使用与现有 overlay 一致的 DOM 操作模式。
- 无新增 DOM 元素或 CSS 类名冲突。

---

### 12. No runtime mismatch
**Verdict: ✅ PASS**

- `G.hissPrevHP` 在 `newGame()` 中正确初始化为 `boss.maxHP`（`core.js` L155-L159）。
- `hissPrevHP` 挂载在 `G` 对象上而非全局单例，确保每局独立。
- `HISS_TRIGGER.condition` 在 `enemyTurn()` 阶段调用（`core.js` L558-L564），时机为敌回合开始、眩晕检查之前，符合设计意图。
- `STARTENDLESSCAT` 在 `endGame(true)` 且 `currentStage >= 4` 时调用（`core.js` L819-L834），时机正确（无尽模式赢后下一只）。

---

## Verdict Summary

| # | Item | Result |
|---|------|--------|
| 1 | 固定阈值 [200, 100] | ✅ PASS |
| 2 | 300→250 不触发 | ✅ PASS |
| 3 | 250→190 触发 | ✅ PASS |
| 4 | 150→90 触发 | ✅ PASS |
| 5 | 跨多阈值只触发一次 | ✅ PASS |
| 6 | 哈气效果不变 | ✅ PASS |
| 7 | 无尽去重 filter | ✅ PASS |
| 8 | 全猫征服 | ✅ PASS |
| 9 | cycle 数组非空 | ✅ PASS |
| 10 | No side-effect | ✅ PASS |
| 11 | No UI mismatch | ✅ PASS |
| 12 | No runtime mismatch | ✅ PASS |

**OVERALL VERDICT: ✅ ALL 12/12 ITEMS PASS — NO BUGS FOUND**

代码实现了所有预期行为。HISS_TRIGGER 正确使用固定阈值 [200, 100]，startEndlessNextCat 正确过滤已击败 boss。无副作用、无 UI/运行时偏差。
