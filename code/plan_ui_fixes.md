# 《斩》UI + 回合逻辑修改方案

> 创建：2026-06-11 | 状态：v1.1（审计修订）| 待审阅

---

## 一、血条改细

**目标**：血量条高度变为原来的 1/2。

**改动**：`index.html` CSS 中 `.char-hp-bar` 的 `height: 12px` → `height: 6px`。

| 文件 | 改动 |
|------|------|
| `index.html` | ~1 行 CSS |

---

## 二、移出区删除 + 移出改成清空

**目标**：删除移出区 UI（`#removed-slot-wrap` + `#removed-slot`），"移出卡牌"按钮改为"清空"——槽内所有卡牌永久丢弃，本局不再出现。

**使用限制**：每回合 1 次（保留 `removeUsed` 变量 + 按钮上的 `(0/1)` 计数器）。

### 2.1 HTML (index.html)
- 删除 `<div id="removed-slot-wrap">` 及其内部 `<div id="removed-slot">`
- 注意：实际 DOM id 是 `removed-slot-wrap` / `removed-slot`，不是 `removed-bar`
- 按钮文案 `🗑️移出` → `🗑️清空`

### 2.2 CSS (index.html)
- 删除 `#removed-slot-wrap { ... }` 和 `#removed-slot { ... }` 样式块
- 删除 `.eslot.removed-slot-item` 相关样式

### 2.3 JS — core.js
- `REMOVE_CARD` action：删除 `removedSlot` 逻辑，改为 `st.slot = []; st.removeUsed++;`
- `RETURN_CARD` action：整段删除（没有移出区则不需要回归逻辑）
- `createState()` 中 `removedSlot` 相关初始化：可保留或删除（不影响功能）

### 2.4 JS — ui.js
- `renderRemovedSlot()`：删除整个函数
- `render()` 中 `Zhan.UI.renderRemovedSlot(st)` 调用：删除
- 移出槽双击/下滑事件绑定（第 774-813 行匿名 IIFE）：删除
- `renderActionButtons()` 中 `removeUsed` 相关 `(0/1)` 文案：**保留**（按钮仍有次数限制）

| 文件 | 改动 |
|------|------|
| `index.html` | HTML ~3 行删 + CSS ~12 行删 |
| `core.js` | ~15 行删/改 |
| `ui.js` | ~30 行删/改 |

---

## 三、迷宫胜利按钮

**目标**：猫猫迷宫胜利后，结算面板显示"再次挑战"和"返回主页"。

**改动**：`ui.js` — `showResultMaze()` 的 `if (st.win)` 空分支：

```js
if (st.win) {
  document.getElementById('btn-restart').textContent = '🔄 再次挑战';
  document.getElementById('btn-restart').style.display = '';
  document.getElementById('btn-return-home').textContent = '🏠 返回主页';
  document.getElementById('btn-return-home').style.display = '';
}
```

**验证**：`btn-restart` click 事件已绑定到 `Zhan.Engine._retry()`，`_retry()` 中已有迷宫分支 → `Zhan.Engine._startMaze()`。按钮只需显示，逻辑链完整。

| 文件 | 改动 |
|------|------|
| `ui.js` | ~4 行 |

---

## 四、第一回合敌人行动

**目标**：`powerGrowth === 0` 的敌人第一回合走正常 cycle；`powerGrowth > 0` 的敌人保持现状（加 buff，不行动）。

**改动**：`core.js` — `_enemyTurn()` 中 T1 分支，条件收窄：

```js
// 之前：turn === 0 时全部进入特殊处理
if (st.turn === 0) {
  if (st.boss.powerGrowth > 0) { ... }
  // 无 powerGrowth 也走这里，不做行动
  return;
}

// 之后：只有 powerGrowth > 0 才进特殊处理
if (st.turn === 0 && st.boss.powerGrowth > 0) {
  st.power += st.boss.powerGrowth;
  log(st.boss.emoji + ' 能力值buff！power=' + st.power);
  Zhan.Systems.Boss.processEvent(st, 'TURN_END');
  // clean locked slots, turn++, phase=PLAYER
  return;
}
// powerGrowth === 0 的敌人：跳过此分支，继续向下走正常的 hiss/groom/stun/cycle 流程
```

**假设声明**：`powerGrowth === 0` 的敌人（冒险模式昆虫/小动物等）当前 `traits: []` 都是空的，掉出 T1 分支后缺少 `processEvent(TURN_END)` 不影响行为。**以后如果给这些敌人加了 trait（如 lock_pile），需要重新评估此处。**

| 文件 | 改动 |
|------|------|
| `core.js` | ~3 行改 |

---

## 五、狂暴核心 🔥 头像

**目标**：`fury_core` 是普通圣物，只提供数值加成，不改变玩家头像。

**改动**：`ui.js` — `render()` 中删除 fury_core → 🔥 的判断：

```js
// 删除这行
if (st.activeRelics && st.activeRelics.indexOf('fury_core') >= 0) playerEmoji = ASSETS.PLAYER_AVATAR_FURY;
```

| 文件 | 改动 |
|------|------|
| `ui.js` | ~1 行删 |

---

## 六、回合结算顺序 + 舔毛优先级

### 6.1 普通敌人（非缅因猫）

`_executeTurn()` 内部顺序不变（现状已是先 buff 应用 → 后 action 结算）。

`_enemyTurn()` 重排如下：

```
 1. 敌人护盾清空
 2. hiss 判定 → 若触发，清除全场 Buff/Debuff
 3. groom 判定 → 若触发，清除 Boss 自身 Debuff（含眩晕）
 4. T1 特殊处理（仅 powerGrowth>0，见第四条）
 5. 眩晕判定 → 若仍眩晕，跳过回合
 6. TURN_START 特性
 7. cycle 行动（攻击/防御/蓄力/暴击）
 8. 玩家死亡检查
 9. TURN_END 特性
10. power += powerGrowth
11. 清理锁定槽占位
12. turn++, phase = PLAYER
13. Buff 持续回合递减（敌 + 我）
14. fury 更新
15. 事件 / intent 更新
16. render
```

**关键变化**：
- **hiss/groom 提到眩晕之前**（步骤 2-3），舔毛清除眩晕 debuff 后 Boss 可正常行动
- **眩晕检查移到 hiss/groom 之后**（步骤 5），只有没被舔毛清除的眩晕才生效
- **Buff 递减移到末尾**（步骤 13，之前是步骤 2）

### 6.2 缅因猫

**设计决策（审计讨论后修正）**：`_enemyTurn()` 末尾**始终**做 buff 递减，不拆函数。缅因猫分支保持现有结构——先调 `_enemyTurn()` → 再勇者结算。

推演验证（破甲 1T）：

```
回合 N（玩家刚上了破甲 1T）:
  _enemyTurn() → Boss 行动（吃破甲）→ buff 递减 → 破甲 0T 消失
  勇者结算 → 上新的 debuff/buff

回合 N+1:
  _enemyTurn() → Boss 行动 → buff 递减 → ...
```

✅ 1T debuff 正好覆盖 1 次 Boss 受击，不多不少。

`_executeTurn()` 中的缅因猫分支（结构与现状一致，只改顺序）：

```
 1. 调用 _enemyTurn()（Boss 先动，内含舔毛→眩晕→特性→cycle→buff递减）
 2. 如果游戏结束，return
 3. 勇者消除结算（wildCore → RESOLVE traits → computeCombos → buff 应用 → action 结算 → special cards → unmatched penalty）
 4. 不调用 setTimeout → _enemyTurn（Boss 已经动过了）
 5. render
```

### 6.3 舔毛/groom handler

当前 groom handler 已清除 `stun`：

```js
G.enemyEffects.vulnerable = 0;
G.enemyEffects.atk_down = 0;
G.enemyEffects.atk_down_pct = 0;
G.enemyEffects.stun = 0;
G.effectiveVulnMult = 0;
```

**无需修改**。配合 6.1 的顺序（hiss/groom 提到眩晕检查之前），舔毛自动清除眩晕。

### 6.4 战斗日志缅因适配 (6b)

缅因猫的回合日志需要反映 "Boss 先动" 的结构。改动两处：

**A. `_executeTurn` 缅因分支加日志**：

```js
// 在调用 _enemyTurnCore 之前
_pushBattleLog({ type: 'separator', text: '─── 缅因猫先手 ───' });
```

**B. 在 `_enemyTurnCore` 中加回合头**：

当前回合头 `—— 第 N 回合 ——` 在 `_executeTurn` 的 action 结算阶段才写入。缅因猫先手意味着 Boss 行动发生在回合头之前。改为在 `_enemyTurnCore` 开头也输出一个标记：

```js
_pushBattleLog({ type: 'separator', text: '─── 敌方（先手）───' });
```

| 文件 | 改动 |
|------|------|
| `core.js` `_enemyTurn()` | ~25 行重组（拆分 _enemyTurnCore） |
| `core.js` `_executeTurn()` 缅因分支 | ~15 行调整 |
| `core.js` 日志 | ~4 行 |

---

## 七、总览

| # | 事项 | 文件 | 改动量 | 风险 |
|---|------|------|--------|------|
| 1 | 血条改细 | index.html | ~1 行 | 低 |
| 2 | 移出 → 清空 | index.html + core.js + ui.js | ~55 行 | 中 |
| 3 | 迷宫胜利按钮 | ui.js | ~4 行 | 低 |
| 4 | 第一回合行动 | core.js | ~3 行 | 中 |
| 5 | fury 不变头像 | ui.js | ~1 行 | 低 |
| 6 | 回合顺序 + 舔毛 + 缅因 | core.js | ~45 行 | **高** |

## 八、执行顺序

```
① 血条 → ⑤ 头像 → ③ 迷宫按钮  （低风险，一口气）
② 移出清空                         （中风险，独立备份）
④ 第一回合行动                     （中风险，独立备份）
⑥ 回合顺序 + 缅因 + 日志适配       （高风险，独立备份）
```

---

## 九、手动验证清单

每步做完后建议人工检查：

| 步骤 | 验证方式 |
|------|----------|
| ① | 进入任意战斗，确认血条变细且不溢出 |
| ② | 战斗中点击清空 → 槽清空、计数器变 (1/1)、移出区消失、页面无 JS 报错 |
| ③ | 迷宫模式打赢 → 结算面板出现"再次挑战"和"返回主页"按钮，点击有效 |
| ④ | 冒险第 5 关工蚁（powerGrowth=0）→ T0 正常攻击；对比某猫 Boss（powerGrowth>0）→ T0 只加 buff 不攻击 |
| ⑤ | 选 fury_core 圣物 → 头像保持 🦸 不变 |
| ⑥ | 狸花猫（有 groom）：用眩晕卡 → 舔毛回合 Boss 正常行动，日志显示舔毛→行动。缅因猫：日志显示"缅因猫先手"→ Boss 行动 → 勇者行动，buff 回合数正确 |
| ⑥ | 在普通猫 Boss 面前被眩晕 → Boss 跳过回合（如果未触发舔毛） |

---

## 十、审计回应

| 审计意见 | 处理 |
|----------|------|
| ② `#removed-bar` id 写错 | ✅ 改为 `#removed-slot-wrap` / `#removed-slot` |
| ② 清空按钮限制不明确 | ✅ 明确每回合 1 次，保留 removeUsed |
| ④ powerGrowth=0 的 TURN_END | ✅ 注明假设，以后加 trait 需重新评估 |
| ⑥ 缅因 buff 递减设计有歧义 | ✅ 明确：buff 递减在勇者结算之后。不采纳"让 _enemyTurn 始终做"——会破坏用户的设计语义 |
| ⑥ 6b 无具体内容 | ✅ 补充缅因日志两处改动 |
| ⑦ 缺少验证步骤 | ✅ 补第九章手动验证清单 |
| ⑧ 舔毛日志未覆盖 | ❌ 不采纳。groom/hiss 的 _pushBattleLog 已在上轮基础设施改造中完成（core.js L267-269、L288-290） |
