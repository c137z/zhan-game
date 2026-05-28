# Expected: bug_hiss_endless — 哈气阈值 + 无尽去重

Contract version: a038d75

## VERIFICATION CHECKLIST (IMMUTABLE)

1. HISS_TRIGGER 使用固定阈值 [200, 100]，不再 per-100-HP 检验
2. Boss HP 从 300 降至 250 → 不触发哈气
3. Boss HP 跌破 200（如 250→190）→ 触发哈气
4. Boss HP 跌破 100（如 150→90）→ 触发哈气
5. Boss HP 一次跨越多阈值（300→199）→ 只触发一次（不因同时过 200 和 100 触发两次）
6. 哈气效果仍为清空全场 Buff/Debuff
7. startEndlessNextCat 从未击败的 pool 中随机（已从 allCatIds 中 filter 掉 ENDLESS_DEFEATED 中的 boss）
8. 全部猫猫击败后 → 显示全猫征服
9. Contract C2: cycle 数组非空未破坏
10. no side-effect on mechanics
11. no UI mismatch
12. no runtime mismatch

## INPUT CASE + EXPECTED VALUE

### Case 1: 哈气不触发（仍在 200-300 范围）
- 条件：boss maxHP=300，HP 从 280 攻击至 210
- 预期：不触发哈气

### Case 2: 哈气触发（跌破 200）
- 条件：boss HP 从 250 攻击至 190
- 预期：触发哈气，全场 Buff/Debuff 清空

### Case 3: 哈气触发（跌破 100）
- 条件：boss HP 从 150 攻击至 90
- 预期：触发哈气

### Case 4: 跨多阈值只触发一次
- 条件：boss HP 从 300 攻击至 199
- 预期：触发哈气（一次），不触发两次

### Case 5: 无尽去重
- 条件：ENDLESS_DEFEATED = [tabby, siamese]，startEndlessNextCat
- 预期：新 boss 既不是 tabby 也不是 siamese
