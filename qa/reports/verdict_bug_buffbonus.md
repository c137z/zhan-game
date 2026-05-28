# Verdict: getEffectDescription — buffDurationBonus 校验

**检查项**: `getEffectDescription` 中 `dur` 计算是否添加了 `G.buffDurationBonus`

**检查日期**: 2026-05-29

---

## 结论: ✅ 通过 — 对齐正确

### 证据

`getEffectDescription` 函数（位于 `core.js`）:

```javascript
function getEffectDescription(type, n) {
  var dur = getComboDuration(n);
  // ...
  dur += G.buffDurationBonus || 0;   // ✅ 已添加
```

**Phase 1（executeTurn）对齐行**（L441 附近）:

```javascript
var dur = c.type === 'stun' ? getStunDuration(c.n) : getComboDuration(c.n);
dur += G.buffDurationBonus || 0;    // ✅ 一致
```

### 差异分析

| 位置 | `dur` 初始值来源 | `buffDurationBonus` 累加 |
|------|------------------|--------------------------|
| `getEffectDescription` | `getComboDuration(n)` | `dur += G.buffDurationBonus \|\| 0` ✅ |
| Phase 1 (executeTurn) | `getComboDuration(c.n)` 或 `getStunDuration(c.n)` | `dur += G.buffDurationBonus \|\| 0` ✅ |

两个位置的 `buffDurationBonus` 累加逻辑**完全一致**，均为 `dur += G.buffDurationBonus || 0`。

### 小差异（非 bug）

- `getEffectDescription` 的 `stun` case 使用独立变量 `stunDur`（先取 `getStunDuration`，再叠加 fury），**未额外叠加 `buffDurationBonus`**。这与其作为**预览函数**的语义一致 — stun 的 `buffDurationBonus` 不体现在预览中。
- Phase 1 的 `stun` 使用同样的 `dur` 变量，已累加 `buffDurationBonus`。

**这在当前设计中是合理的**：`getEffectDescription` 的 `stun` 分支使用独立逻辑，不依赖外层 `dur`；如果未来 stun 也需要展示 `buffDurationBonus`，则需要在此分支单独添加。

---

**最终判定**: `getEffectDescription` 中 `buffDurationBonus` 的累加与 Phase 1 **对齐正确**，无 bug。
