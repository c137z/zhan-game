# Verdict: `calcPursuitMultiplier` + executeTurn log thresholds — 硬编码 `< 4` → minCombo-aware

**验证日期**: 2026-05-29
**验证者**: subagent (verifier role)
**验证文件**: `C:\Users\kyzha\.openclaw\projects\zhan\code\core.js`
**验证原则**: tools/roles/verifier/RULES.md 不存在，按子任务要求直接验证。

---

## 验证目标

### 目标 1: `calcPursuitMultiplier` 门槛
确认 `calcPursuitMultiplier` 是否已将硬编码 `< 4` 改为读取 `G.effectiveMinCombo`，门槛变为 `minCombo + 1`。

### 目标 2: `executeTurn` 日志追击门槛
确认 `executeTurn` 中攻击/防御/回血日志的追击门槛（旧: `< 4`）是否也已同步改为 minCombo-aware。

---

## 目标 1 验证结果

**源码（core.js L42-L45）**

```js
function calcPursuitMultiplier(maxComboLen) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  if (maxComboLen < minCombo + 1) return 1;
  return 1 + (maxComboLen - minCombo) * 0.1;
}
```

- **旧阈值（bug 版本）**: 硬编码 `if (maxComboLen < 4) return 1;`，追击倍率激活恒需 ≥4 连。
- **新阈值**: `minCombo + 1`，即当 `minCombo = 3`（默认）时等价于 `< 4`，但当圣物修改 `effectiveMinCombo`（如从 3 降到 2）时，追击门槛也会同步降为 3。
- `minCombo` 来源: `G.effectiveMinCombo || CONFIG.MIN_COMBO`，与 `calcBaseValue` / `calcAttackValue` / `calcDefendValue` / `calcHealValue` / `computeCombos` 一致。

**✅ PASS — 已从硬编码 `< 4` 改为 `minCombo + 1`。**

---

## 目标 2 验证结果

### 攻击日志门槛（executeTurn, 约 L498-L504）

```js
// 结算攻击
var pursuitLog = '';
var _pml = G.effectiveMinCombo || CONFIG.MIN_COMBO;
if (atkMaxLen >= _pml + 1) pursuitLog = ' ' + atkMaxLen + '连×' + calcPursuitMultiplier(atkMaxLen).toFixed(1);
```

✅ 使用 `G.effectiveMinCombo || CONFIG.MIN_COMBO`，阈值 `_pml + 1`。

### 防御日志门槛（executeTurn, 约 L517-L523）

```js
// 结算防御
var pursuitLog = '';
var _pml = G.effectiveMinCombo || CONFIG.MIN_COMBO;
if (defMaxLen >= _pml + 1) pursuitLog = ' ' + defMaxLen + '连×' + calcPursuitMultiplier(defMaxLen).toFixed(1);
```

✅ 使用 `G.effectiveMinCombo || CONFIG.MIN_COMBO`，阈值 `_pml + 1`。

### 回血日志门槛（executeTurn, 约 L534-L540）

```js
// 结算回血
var pursuitLog = '';
var _pml = G.effectiveMinCombo || CONFIG.MIN_COMBO;
if (healMaxLen >= _pml + 1) pursuitLog = ' ' + healMaxLen + '连×' + calcPursuitMultiplier(healMaxLen).toFixed(1);
```

✅ 使用 `G.effectiveMinCombo || CONFIG.MIN_COMBO`，阈值 `_pml + 1`。

**✅ PASS — 三处 executeTurn 日志追击门槛全部使用 `minCombo + 1`。**

---

## 跨引用一致性检查

| 位置 | 函数 | 阈值来源 | 一致 |
|------|------|----------|------|
| L42 | `calcPursuitMultiplier` | `G.effectiveMinCombo \|\| CONFIG.MIN_COMBO` | ✅ |
| L47 | `calcAttackValue` (pre-check) | `G.effectiveMinCombo \|\| CONFIG.MIN_COMBO` | ✅ |
| L52 | `calcDefendValue` (pre-check) | `G.effectiveMinCombo \|\| CONFIG.MIN_COMBO` | ✅ |
| L57 | `calcHealValue` (pre-check) | `G.effectiveMinCombo \|\| CONFIG.MIN_COMBO` | ✅ |
| L246 | `computeCombos` | `G.effectiveMinCombo \|\| CONFIG.MIN_COMBO` | ✅ |
| L498 | executeTurn attack pursuit log | `G.effectiveMinCombo \|\| CONFIG.MIN_COMBO` | ✅ |
| L520 | executeTurn defend pursuit log | `G.effectiveMinCombo \|\| CONFIG.MIN_COMBO` | ✅ |
| L537 | executeTurn heal pursuit log | `G.effectiveMinCombo \|\| CONFIG.MIN_COMBO` | ✅ |

---

## 全局搜索确认

全文搜索 `code/core.js` 中不再存在任何硬编码 `< 4` 用于追击门槛判断。所有 minCombo 相关的阈值判断统一使用 `G.effectiveMinCombo || CONFIG.MIN_COMBO`。

---

## 裁决

**Verdict: PASS**

1. `calcPursuitMultiplier` 已将硬编码 `< 4` 改为 `minCombo + 1`，从 `G.effectiveMinCombo || CONFIG.MIN_COMBO` 读取。
2. `executeTurn` 中攻击、防御、回血三处日志追击门槛全部同步使用 `_pml + 1`（`_pml = G.effectiveMinCombo || CONFIG.MIN_COMBO`）。
3. 全代码库不存在遗留的硬编码 `minCombo` 阈值。
4. 跨函数一致性：所有 8 处 minCombo 引用使用同一来源，无分歧。
