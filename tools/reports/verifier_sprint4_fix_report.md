# Sprint 4 Fix Verifier 报告
日期时间：2026-06-03 02:51 (Asia/Shanghai)
验证者：Verifier

## ⚠️ 关键发现：目标文件不存在

**目标文件 `zhan_v1.99.1_sprint4_fix.html` 在 `C:\Users\kyzha\.openclaw\projects\zhan\` 下不存在。**

目录下仅存在：
- `zhan_v1.96_sprint1.html`
- `zhan_v1.97_sprint2.html`
- `zhan_v1.98_sprint3.html`
- `zhan_v1.99_sprint4.html` ← 唯一可验证文件（pre-fix 版本）

`code/` 子目录下有 `core.js.sprint4_fix_bak` 和 `ui.js.sprint4_fix_bak`，但这两个备份文件不包含 P0-P2 fix 标记（FIX 注释/独立 state 参数/getEffectDescription 重签名等），仅包含旧版 fix 标记（BUG1-4 FIX），更多是变量命名修正而非架构级修复。

以下基于现有的 `zhan_v1.99_sprint4.html`（pre-fix 版本）逐项验证。

---

## 检查结果

| # | 检查项 | 结果 | 备注 |
|---|--------|------|------|
| 1 | P0合集 | FAIL | 全部三项未修复 |
| 2 | P1合集 | FAIL | 全部四项未修复 |
| 3 | P2合集 | FAIL | 全部三项未修复 |
| 4 | 回归 | ⚠️ N/A | 无法运行验证（fix 文件不存在） |

---

## 逐项详细分析

### P0-1 异步渲染 — FAIL
- **当前行为**：`executeTurn()` 末尾（line 1554）直接 `setTimeout(function() { enemyTurn(); }, 400);`，**没有**在 timeout 前调用 `Zhan.UI.render(G)`。
- **应修复为**：在 `setTimeout` 前先 `Zhan.UI.render(G)`，使玩家在 enemyTurn 执行前看到 HP/护盾/log 的即时变化。
- **仅在 `_maineCoonFirst` 分支**（line 1549）有 render 调用，但该分支是缅因猫先手特例。

### P0-2 万能核心占位 — FAIL
- `pullCard()` 中 wild_core null placeholder 逻辑（line 1243）无条件 `G.slot.push(null)`，当 `lockedSlots[0]` 为 true 且 `nullIdx` 跳过到 1 时，循环已 push 1 个 null 占位 locked[0]，line 1243 又 push 第 2 个 null，导致 slot 数组存在多余 null。
- **应修复为**：`if (G.slot.length === 0) G.slot.push(null);` — 仅在 nullIdx 为 0、循环未添加任何 null 时才补推。

### P0-3 万能核心视觉 — FAIL
- `renderSlot()` line 2113：`if (G.wildCoreSlot && i === 0)` — 💎标记**硬编码在 slot[0]**，不检查 lockedSlots。
- **应修复为**：计算 `wildShowIdx` 为第一个未锁定槽位，将 `i === wildShowIdx` 作为放置条件。

### P1-1 getEffectDescription — FAIL
- 函数签名：`function getEffectDescription(type, n)` — **无 state 参数**。
- 函数体内直接读取全局 `G`（line 1274: `var minCombo = G.effectiveMinCombo`）。
- combo preview 调用（line 2191）：`getEffectDescription(c2.type, c2.n)` — **不传 G**。
- **应修复为**：接受 `state` 参数 + `var st = state || G;` 内部 fallback，combo preview 调用时传 `G`。

### P1-2 showRelicSelect/startNextStage — FAIL
- `showRelicSelect()`（line 1844）内部使用全局 `G` 变量：`G.relicRerolls = ...`、`G.selectedRelic = ...` 等。
- `startNextStage()`（line 1910）内部也直接使用全局 `G` 变量。
- 虽然当前实际效果可用（G 指向 Zhan.Engine.state），但缺少 `var G = Zhan.Engine.state;` 的保护性获取。
- **应修复为**：函数开头 `var G = Zhan.Engine.state; if (!G) return;`。

### P1-3 坚韧核心 — FAIL
- **不存在 `_checkTenacity` 辅助函数**。整个文件搜索不到 "tenacity"、"坚韧"、"HP锁定"、"\_checkTenacity" 等关键词。
- 可能坚韧核心圣物效果本身也未实现。
- **应修复为**：添加 `Zhan.Engine._checkTenacity(st)` 并在两处调用（玩家回合 unmatched 扣血后、敌人回合 applyDamageToPlayer 后）。

### P1-4 #test 状态保护 — FAIL
- `Zhan.Test.run()`（line 2381）直接操作 `Zhan.Engine.init()` → `dispatch(END_TURN)` → `dispatch(RESET)`，**不保存也不恢复**用户游戏状态。
- 无 `savedState` / `savedG` / `savedEndless` 变量，无 `try/finally` 结构。
- **应修复为**：在 try 中保存状态，finally 中恢复并 `Zhan.UI.render(savedState)`。

### P2-1 updateEffectiveFuryValues — FAIL
- `updateEffectiveFuryValues(G)` 函数（line 1004）仍然存在，是一个 top-level 函数。
- 注释标注 "Legacy wrapper"，但未被删除。
- **应修复为**：删除该独立函数，其逻辑已移入 `Zhan.Engine._updateEffectiveFury(st)`。

### P2-2 hiss condition — FAIL
- `hiss.condition`（line 829-841）**直接修改 G**：
  - Line 830: `G.hissPrevHP = G.enemyMaxHP;`（初始化）
  - Line 834: `G.hissPrevHP = G.enemyHP;`（触发时）
  - Line 838: `G.hissPrevHP = G.enemyHP;`（未触发时）
- **应修复为**：condition 纯函数只做判断，状态更新移到 execute 中。

### P2-3 log() 初始化 logLines — FAIL
- `function log(msg)` 中（line 2284）有 `if (!G.logLines) G.logLines = [];`。
- **应修复为**：`if (!G || !G.logLines) return;` — Engine 负责初始化，UI 只读取。

---

## 回归检查

由于 fix 版 HTML 文件不存在：
- 无法在浏览器中运行 F12 Console 检查
- 无法验证双击/拖拽入槽、End Turn、通关/败北弹窗、无尽模式
- 无法运行 `#test` 验证 All Tests Passed

---

## 总结

**Sprint 4 Fix 版本文件 `zhan_v1.99.1_sprint4_fix.html` 未生成。** 现有 `zhan_v1.99_sprint4.html` 是 pre-fix 版本，全部 10 项检查（3 P0 + 4 P1 + 3 P2）均为 FAIL。

### 建议下一步行动

1. **确认 Fix 文件的预期来源** — 是否应由 Builder 角色生成 `zhan_v1.99.1_sprint4_fix.html`
2. **检查 Builder 阶段是否有未完成的工作** — `code/core.js.sprint4_fix_bak` 和 `code/ui.js.sprint4_fix_bak` 仅为旧版备份
3. **需要执行 Sprint 4 Fix 构建流程** — 基于上述 P0-P2 清单应用修改后生成 fix 版 HTML
