# Expected: bug_decay_stacking — 减攻回合衰减异常

## VERIFICATION CHECKLIST (IMMUTABLE)

1. atk_down 衰减时机不影响正常叠加
2. 3连减攻（3回合）→ 回合结束衰减后 → 下回合再叠加 1 个减攻，结果是 3 回合（不是 4）
3. 所有其他 enemyEffects（stun/vulnerable）衰减逻辑不受影响
4. atk_down 在 enemyTurn 结束时衰减，不影响敌方攻击力的实时读取
5. 衰减后的 atk_down 值为 0 时正确清除 atk_down_pct
6. 所有 buff 类型的持续回合显示与实际一致
7. no side-effect on mechanics
8. no UI mismatch
9. no runtime mismatch

※ Contract C 类（D 类）相关条款见 `docs/contracts/combat-core.contract.md`

## INPUT CASE + EXPECTED VALUE

### Case 1: 3连减攻第一次
- 条件：atk_down = 0，玩家打出 3 连减攻
- 预期：atk_down = 3，持续 3 回合

### Case 2: 3连减攻衰减+叠加
- 条件：atk_down = 3，敌方完成行动，atk_down 衰减至 2
- 玩家再打出 1 个减攻
- 预期：atk_down = 3（2+1），而非 4
