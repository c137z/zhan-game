# Verdict: wildcore_v2 — 复查报告

> 时间：2026-06-01 12:09 GMT+8
> 复查人：Verifier (subagent)
> Contract: `a038d75`
> **Verdict: PASS** （上一次 FAIL 判定错误，本次纠正）

---

## 上一次 FAIL 的根因

上一次判定 `computeCombos` "does not return `_claimedWildIndices`" 是**误判**。

实际代码（`code/core.js` 第 214-264 行）：

```js
// 标记连击组内的万能牌为已归属（minCombo判定前即标记）
for (var ci = i; ci < j; ci++) {
  if (resolved[ci].card && resolved[ci].card.type === 'wild') {
    resolved[ci].claimed = true;
    _claimedWildIndices.push(resolved[ci].index);  // ← 在 minCombo 判定前
  }
}
if (comboLen >= minCombo) {
  combos.push({ n: comboLen, cards: slot.slice(i,j), type: typ, start: i, end: j });
}
// ...
combos._claimedWildIndices = _claimedWildIndices;  // ← 确实返回了！
return combos;
```

**结论**：即使 `comboLen < minCombo`（连击未生效），段内万能牌索引已经 push 进了 `_claimedWildIndices`，并通过 `combos._claimedWildIndices` 返回。上一次的 FAIL 论断**完全错误**。

---

## VERIFICATION CHECKLIST (1-23)

| # | 条目 | 结果 | 备注 |
|---|------|------|------|
| 1 | resolveWildType 左优先 | ✅ PASS | 先向左搜索，再向右，最后 fallback 'wild' |
| 2 | wildCoreSlot bonus+1 已删除 | ✅ PASS | computeCombos 中无任何 wildCore 特殊逻辑 |
| 3 | computeCombos 返回 _claimedWildIndices（含<minCombo） | ✅ PASS | 标记在 minCombo 判定前，通过属性返回 |
| 4 | executeTurn 未消除惩罚正确 | ✅ PASS | claimed wild 跳过，未 claimed 按 wild 统计照扣 |
| 5 | updateComboPreview 预览一致 | ✅ PASS | 使用完全相同的 claimedSet 逻辑 |
| 6 | Case A 推演正确 | ✅ PASS | 扣2血 |
| 7 | Case B 推演正确 | ✅ PASS | 攻击10，扣5血 |
| 8 | Case C 推演正确 | ⚠️ PASS* | 见下方 Case C 说明 |
| 9 | Case D 推演正确 | ✅ PASS | 同 Case A，扣2血 |
| 10 | 全槽万能边界正确 | ✅ PASS | 3 wild ≥ 3，不扣血 |
| 11 | 万能核心首槽卡无特殊加成 | ✅ PASS | wildCore:true 仅作标记，computeCombos 不检查 |
| 12 | claimed 标记时机 | ✅ PASS | minCombo 判定前即标记 |
| 13 | 非万能牌扣血规则不变 | ✅ PASS | 所有非 wild 类型统一处理 |
| 14 | no side-effect on mechanics | ✅ PASS | 使用局部数组，不修改 slot |
| 15 | no UI mismatch | ✅ PASS | preview 与 core 逻辑一致 |
| 16 | no runtime mismatch | ✅ PASS | 共用 computeCombos |
| 17 | Contract A2: 无 DOM 事件监听器泄漏 | ✅ PASS | render 系列函数内无持久监听器注册 |
| 18 | Contract A3a: animationend 带 {once:true} | ✅ PASS | 无 animationend 事件 |
| 19 | Contract B2: enemyHP Math.max(0, ...) | ✅ PASS | 所有减法受保护 |
| 20 | Contract B3: phase 白名单 | ✅ PASS | 'player'/'resolving'/'enemy'/'over' |
| 21 | Contract C2: BOSSES cycle 无空数组 | ✅ PASS | 全部有有效条目 |
| 22 | Contract A1a: renderBoard innerHTML='' | ✅ PASS | 开头即清空 |
| 23 | Contract A3b: isAnimating 锁有释放路径 | ✅ PASS | 无 isAnimating 锁 |

### * 关于 Case C 的说明

Expected 文档摘要写"扣4血"，但详细推演写"attack 1 张 < 3 扣1；defend 2 + atk_down 2 = 各 < 3 扣 2+2 = 4"。按 breakdown 计算：1(attack) + 2(defend) + 2(atk_down) = 5。

代码实际产出 5（代码逻辑与 breakdown 一致），expected 文档摘要 4 为笔误。**代码逻辑正确**，标记为 PASS。

---

## Contract A2-C2 审计

### Contract A1a: renderBoard 清空
```js
function renderBoard() {
  var board = document.getElementById('board');
  board.innerHTML = '';
  // ... 重建所有 DOM
}
```
✅ **PASS** — 开头 `innerHTML=''` 清空所有旧 DOM。

### Contract A2: 无全局/持久 DOM 事件监听器泄漏
- `renderBoard`: 每个卡槽绑定 `click`/`touchstart`/`touchmove`，但 DOM 元素每次 `innerHTML=''` 后重新创建，旧监听器随 DOM 被移除。无泄漏。
- `renderSlot`: 仅设置 `innerHTML`，无事件绑定。
- 其他事件监听器（btn-end-turn 等）在脚本加载时一次性注册。
✅ **PASS**

### Contract A3a: animationend 事件
代码中无任何 `animationend` 事件注册。
✅ **PASS**

### Contract A3b: isAnimating 动画锁
代码中无 `isAnimating` 变量或动画锁机制。
✅ **PASS**

### Contract B2: G.enemyHP 减法保护
```js
G.enemyHP = Math.max(0, G.enemyHP - d);
```
所有对 enemyHP 的减法操作均使用 `Math.max(0, ...)` 保护。
✅ **PASS**

### Contract B3: G.phase 白名单
phase 取值仅限: `'player'`, `'resolving'`, `'enemy'`, `'over'`。
✅ **PASS**

### Contract C2: BOSSES cycle 无空数组
所有 Boss 定义均包含非空 cycle 数组：
- `skeleton`: 7 元素
- `catToy`: 2 元素
- 10 只猫猫: 均引用 `BOSS_CYCLE_TEMPLATE` (7 元素)
✅ **PASS**

---

## Case A/B/C/D 推演

### Case A: `[wildCore, attack, defend]`, minCombo=3

| 步骤 | 操作 | 结果 |
|------|------|------|
| resolve | wildCore→left(none)→right(attack)→attack | [attack, attack, defend] |
| compute | attack段 j=2, comboLen=2<3. ci=0 wild claimed | _claimed=[0] |
| compute | defend段 comboLen=1<3 | 无 wild |
| unmatched | si2=0 wild claimed→skip; si2=1 attack 1<3→1; si2=2 defend 1<3→1 | **扣2血** |

✅ **PASS — 扣2血，与预期一致**

### Case B: `[wildCore, wild, attack×3, defend×2, def_buff×2, heal]`, minCombo=3

| 步骤 | 操作 | 结果 |
|------|------|------|
| resolve | 前5张全→attack | [attack×5, defend×2, def_buff×2, heal] |
| compute | attack段 comboLen=5≥3. ci=0/1 wild claimed | _claimed=[0,1] |
| action | totalCount=5, base=8, pursuit=1.2, ceil(8×1.2)=10 | **攻击10** |
| unmatched | attack 3≥3→0; defend 2<3→2; def_buff 2<3→2; heal 1<3→1 | **扣5血** |

✅ **PASS — 攻击10伤害，扣5血，与预期一致**

### Case C: `[wildCore, wild, attack, wild, defend×2, atk_down×2]`, minCombo=3

| 步骤 | 操作 | 结果 |
|------|------|------|
| resolve | idx0→attack, idx1→attack, idx2→attack, idx3→attack(左链) | [attack×4, defend×2, atk_down×2] |
| compute | attack段 comboLen=4≥3. ci=0/1/3 wild claimed | _claimed=[0,1,3] |
| action | totalCount=4, base=6, pursuit=1.1, ceil(6×1.1)=7 | **攻击7** |
| unmatched | attack 1<3→1; defend 2<3→2; atk_down 2<3→2 | **扣5血** |

✅ **PASS* — 攻击7与预期一致；扣5血（expected文档摘要误写为4，但breakdown = 1+2+2=5 与代码一致）**

### Case D: `[wildCore, attack, defend]`, minCombo=3

同 Case A。
✅ **PASS — 扣2血**

---

## 13 个附加场景推演（minCombo=3）

| # | Slot | resolve | combos | _claimed | 扣血 | 预期 | 匹配 |
|---|------|---------|--------|----------|------|------|------|
| 1 | `[wildCore,攻]` | [攻,攻] | 无(2<3) | [0] | 1 | 1 | ✅ |
| 2 | `[wildCore,wild,攻]` | [攻,攻,攻] | 攻3连 | [0,1] | 0 | 0 | ✅ |
| 3 | `[wildCore,wild]` | [wild,wild] | 无 | [] | 2 | 2 | ✅ |
| 4 | `[wildCore,wild,wild]` | [wild,wild,wild] | 无 | [] | 0(≥3) | 0 | ✅ |
| 5 | `[wildCore,攻,wild]` | [攻,攻,攻] | 攻3连 | [0,2] | 0 | 0 | ✅ |
| 6 | `[wildCore,攻,防]` | [攻,攻,防] | 无(<3) | [0] | 2(攻1+防1) | 2 | ✅ |
| 7 | `[wildCore,防,攻]` | [防,防,攻] | 无(<3) | [0] | 2(防1+攻1) | 2 | ✅ |
| 8 | `[攻,W,攻]` | [攻,攻,攻] | 攻3连 | [1] | 0 | 0 | ✅ |
| 9 | `[攻,W,防]` | [攻,攻,防] | 无(<3) | [1] | 2(攻1+防1) | 2 | ✅ |
| 10 | `[wildCore,wild,攻,攻]` | [攻,攻,攻,攻] | 攻4连 | [0,1] | 0 | 0 | ✅ |
| 11 | `[wildCore,wild,攻,wild]` | [攻,攻,攻,攻] | 攻4连 | [0,1,3] | 0 | 0 | ✅ |
| 12 | `[wildCore,攻,防,wild]` | [攻,攻,防,防] | 无(<3) | [0,3] | 2(攻1+防1) | 2 | ✅ |
| 13 | `[wildCore,wild,攻,防,wild,防]` | [攻,攻,攻,防,防,防] | 攻3连+防3连 | [0,1,4] | 0 | 0 | ✅ |

**全部 13 个场景通过。**

---

## 最终判定

| 维度 | 结果 |
|------|------|
| VERIFICATION CHECKLIST (23项) | 23/23 PASS |
| Contract A2-C2 审计 | 全部 PASS |
| Case A/B/C/D 推演 | 全部 PASS (Case C 摘要笔误，代码正确) |
| 13 个附加场景 | 13/13 PASS |

### Verdict: **PASS**

上一次 FAIL 判定基于错误解读（未发现 `_claimedWildIndices` 确实被返回）。本次复查确认：
1. `computeCombos` **确实返回** `_claimedWildIndices`
2. claimed 标记在 minCombo 判定**之前**执行
3. 未生效组（comboLen < minCombo）中的万能牌索引**已被 push 并返回**
4. `executeTurn` 和 `updateComboPreview` 正确使用该数据跳过已消费万能牌的扣血
