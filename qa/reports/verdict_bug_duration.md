# Verdict: getComboDuration minCombo-aware 改造

**Date:** 2026-05-29  
**Verifier:** subagent (verification-only, no code changes)  
**Scope:** `code/core.js` — `getComboDuration` (L345)、`getStunDuration` (L351)、`getEffectDescription` (L355)

---

## ✅ VERDICT: PASS

All three checkpoints verified. The fix is correctly applied.

---

### Check 1: `getComboDuration` — 硬编码 `n - 2` 已移除，改用 `G.effectiveMinCombo`

**L345–348:**

```js
function getComboDuration(n) {
  var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO;
  return Math.max(1, n - minCombo + 1);
}
```

- ✅ 已读取 `G.effectiveMinCombo`（fallback `CONFIG.MIN_COMBO`）
- ✅ 公式为 `Math.max(1, n - minCombo + 1)`（clamp 到 1，防负值）
- ✅ 旧 `n - 2` 硬编码已不在
- ✅ 与注释 `// minCombo-aware: duration = max(1, n - minCombo + 1)` 一致

**语义验证（CONFIG.MIN_COMBO = 3 时）：**
| n（连击数） | n - 3 + 1 | max(1, ...) | 结果 |
|------------|-----------|-------------|------|
| 3          | 1         | 1           | 1T   |
| 4          | 2         | 2           | 2T   |
| 10         | 8         | 8           | 8T   |
| 2          | 0         | 1           | 1T   |

→ 与注释 "3连=1T, 4连=2T, 10连=8T" 完全一致 ✅

---

### Check 2: `getStunDuration` 仍通过调用 `getComboDuration` 间接继承 minCombo-aware

**L351–353:**

```js
function getStunDuration(n) {
  return getComboDuration(n);
}
```

- ✅ 直接委托 `getComboDuration(n)`，因此自动继承 minCombo-aware 逻辑
- ✅ 无独立硬编码，无绕过

---

### Check 3: `G.effectiveMinCombo` 全局引用一致

全文件 `G.effectiveMinCombo` 出现点（共 16 处，均在 L38/42/48/54/60/139/315/346/357/505/521/530/537/545/552/592）：

- ✅ **L139** 初始化：`effectiveMinCombo: CONFIG.MIN_COMBO`（游戏状态初始化）
- ✅ **L346**（getComboDuration）：`var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO`
- ✅ **L357**（getEffectDescription）：同样使用 `G.effectiveMinCombo`
- ✅ 其他处（combo 匹配逻辑、penalty 阈值等）全部统一使用 `G.effectiveMinCombo`

无旧 `n - 2` 硬编码残留。

---

## Conclusion

**State:** ✅ FIXED & VERIFIED  
**Risk:** None. Formula is mathematically correct, backwards-compatible with default `MIN_COMBO=3`, and all consumers (`getStunDuration`, `getEffectDescription`) properly delegate.  
**Recommendation:** 无需进一步修改。
