# Expected: bug_hiss_endless — 哈气过早 + 无尽模式随机

## VERIFICATION CHECKLIST (IMMUTABLE)

1. 猫猫Boss HP 从 300 到 200-299 区间不触发哈气
2. 猫猫Boss HP 跌破 200 阈值触发哈气
3. 猫猫Boss HP 跌破 100 阈值触发哈气
4. 一次攻击跨越两级阈值（300→199）至少触发一次哈气
5. 哈气仍然清空全场 buff/debuff
6. 无尽模式从未击败的池中随机选 Boss（不包含已击败）
7. 所有猫猫全部击败 → 显示全猫征服
8. no side-effect on mechanics
9. no UI mismatch
10. no runtime mismatch

## INPUT CASE + EXPECTED VALUE

### Case 1: 哈气 200 HP 阈值
- 条件：boss maxHP=300，HP 从 250 攻击至 190
- 预期：触发哈气（跨越 200 阈值点）

### Case 2: 哈气 100 HP 阈值
- 条件：boss HP 从 150 攻击至 90
- 预期：触发哈气（跨越 100 阈值点）

### Case 3: 哈气不触发
- 条件：boss HP 从 280 攻击至 210（仍在 200-300 范围）
- 预期：不触发哈气

### Case 4: 无尽模式去重
- 条件：已击败 tabby/siamese，当前 startEndlessNextCat
- 预期：随机出来的 boss 既不是 tabby，也不是 siamese
