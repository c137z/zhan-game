# 验证报告：getComboDuration minCombo-aware

**日期**: 2026-05-29  
**验证文件**: `code/core.js`  
**验证方法**: 纯代码审查（只读，未修改代码）  
**注意**: `tools/roles/verifier/RULES.md` 不存在，本报告基于代码直接审查。

---

## 结论：✅ PASS — 两项验证均通过

---

## 1. getComboDuration 已改为 minCombo-aware

**位置**: core.js 第 348-351 行

```js
function getComboDuration(n) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  return Math.max(1, n - minCombo + 1);
}
```

### 验证通过点：
- **不再有** `n - 2` 硬编码 — 已完全移除
- **读取** `G.effectiveMinCombo`（回退到 `CONFIG.MIN_COMBO`）
- **公式** 已变为 `max(1, n - minCombo + 1)` — 与要求完全一致
- 当 `minCombo = 2` 时，行为等价于旧版 `max(1, n - 1)` 即 `max(1, n - 2 + 1)`
- 当 `minCombo = 3` 时（通过圣物/机制修改），公式自适应为 `max(1, n - 2)`

---

## 2. getStunDuration 调用 getComboDuration（间接继承 minCombo-aware）

**位置**: core.js 第 354-356 行

```js
function getStunDuration(n) {
  return getComboDuration(n);
}
```

### 验证通过点：
- `getStunDuration` 直接委托给 `getComboDuration(n)`
- 因为 `getComboDuration` 读取 `G.effectiveMinCombo`，所以 `getStunDuration` 也**间接继承 minCombo-aware 行为**
- 无需在 `getStunDuration` 中重复读取 `effectiveMinCombo`

---

## 3. 调用方一致性检查（附加验证）

| 调用位置 | 使用的函数 | minCombo-aware? |
|---|---|---|
| `executeTurn` Phase 1 (vulnerable) | `getComboDuration(c.n)` | ✅ |
| `executeTurn` Phase 1 (stun) | `getStunDuration(c.n)` | ✅ (委托) |
| `executeTurn` Phase 1 (atk_buff) | `getComboDuration(c.n)` | ✅ |
| `executeTurn` Phase 1 (def_buff) | `getComboDuration(c.n)` | ✅ |
| `executeTurn` Phase 1 (atk_down) | `getComboDuration(c.n)` | ✅ |
| `getEffectDescription` (预览) | `getComboDuration(n)` / `getStunDuration(n)` | ✅ |

所有调用点均正确使用 `effectiveMinCombo`（直接或通过委托）。

---

## 总结

**两个验证点均确认通过：**
1. ✅ `getComboDuration` 已从硬编码 `n - 2` 改为读取 `G.effectiveMinCombo`，公式 `max(1, n - minCombo + 1)` 正确实现
2. ✅ `getStunDuration` 仍调用 `getComboDuration`，间接继承 minCombo-aware 行为
