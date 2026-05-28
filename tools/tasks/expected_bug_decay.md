# Expected: bug_decay — 减攻回合衰减异常

Contract version: a038d75

## VERIFICATION CHECKLIST (IMMUTABLE)

1. atk_down 衰减已从 enemyTurn 末尾移至 executeTurn Phase 3（atk_buff 衰减同位置）
2. 3连减攻（3回合）→ 回合结束衰减到 2 → 下回合叠加 +1 → 结果是 3（不是 4）
3. stun 衰减仍留在 enemyTurn 末尾（未受影响）
4. vulnerable 衰减仍留在 enemyTurn 末尾（未受影响）
5. atk_down 值为 0 时正确清除 atk_down_pct
6. atk_down 衰减不影响敌方攻击力实时读取（L717-720 的降攻效果读取不受影响）
7. Contract B2: enemyHP Math.max 保护未破坏
8. Contract B3: G.phase 白名单未破坏
9. no side-effect on mechanics
10. no UI mismatch
11. no runtime mismatch

## INPUT CASE + EXPECTED VALUE

### Case 1: 3连减攻第一次
- 条件：atk_down = 0，玩家打出 3 连减攻（n=3）
- 预期：atk_down = dur（getComboDuration(3) = 1），即 1 回合

### Case 2: atk_down 衰减后再叠加
- 条件：当前 atk_down = 3，回合结束→衰减到 2，玩家再打 1 个减攻（n=1，dur=1）
- 预期：atk_down = 3（2+1），不是 4
