# Verdict: `calcBaseValue` — 硬编码 `(totalCount - 3)` → 读取 minCombo

**验证日期**: 2026-05-29
**验证者**: subagent (verifier role)
**验证文件**: `C:\Users\kyzha\.openclaw\projects\zhan\code\core.js`
**验证原则**: RULES.md 不存在（路径 `tools/roles/verifier/RULES.md` 缺失），按任务要求直接验证。

---

## 验证目标

确认 `calcBaseValue` 函数是否已将硬编码的 `(totalCount - 3)` 改为从 `G.effectiveMinCombo || CONFIG.MIN_COMBO` 读取最小连击数。

## 验证方法

**源码行级对比（core.js 第42行）**

```js
// 当前实现：
function calcBaseValue(totalCount) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  return 4 + (totalCount - minCombo) * 2;
}
```

- 旧实现（bug 版本）使用硬编码 `return 4 + (totalCount - 3) * 2;`，即 `minCombo` 恒为 3。
- 新实现引入变量 `minCombo`，取 `G.effectiveMinCombo`（动态值，可被圣物修改）或回退到 `CONFIG.MIN_COMBO`。

## 跨引用一致性检查

所有调用 `calcBaseValue` 的地方都通过 `calcAttackValue` / `calcDefendValue` / `calcHealValue` 间接调用，这些包装函数本身也采用了相同的 `G.effectiveMinCombo || CONFIG.MIN_COMBO` 模式：

| 函数 | 行号 | 是否一致 |
|------|------|----------|
| `calcBaseValue(totalCount)` | 42 | ✅ 使用 `minCombo` 变量 |
| `calcAttackValue(totalCount, maxComboLen, G)` | 48 | ✅ 自身也重新取 `minCombo`（冗余但安全） |
| `calcDefendValue(totalCount, maxComboLen, G)` | 53 | ✅ 同上 |
| `calcHealValue(totalCount, maxComboLen, G)` | 59 | ✅ 同上 |

---

## 裁决

**✅ PASS — 修复已生效。**

`calcBaseValue` 不再使用硬编码 `(totalCount - 3)`。现在通过 `G.effectiveMinCombo || CONFIG.MIN_COMBO` 动态读取最小连击数，圣物可修改 `G.effectiveMinCombo` 以影响伤害/防御/回血的基值计算公式。
