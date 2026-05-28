# Expected: bug_emoji_endless — 日志emoji动态化 + 无尽去重

Contract version: a038d75

## VERIFICATION CHECKLIST (IMMUTABLE)

1. core.js 中所有 log() 调用无剩余硬编码 💀（全文搜索 '💀'）
2. 所有日志行使用 G.boss.emoji 动态取值
3. 攻击结算日志正确显示当前 Boss emoji
4. 击败/败北日志正确显示当前 Boss emoji
5. HP 显示日志正确显示当前 Boss emoji
6. 第一关（skeleton emoji=💀）日志仍显示 💀
7. startEndlessNextCat 从未击败池中随机（filter ENDLESS_DEFEATED）
8. 全部猫猫击败 → 全猫征服
9. Contract B2/B3 未破坏
10. no side-effect on mechanics
11. no UI mismatch
12. no runtime mismatch

## INPUT CASE + EXPECTED VALUE

### Case 1: 毛线团日志
- 条件：boss=skeleton，玩家攻击
- 预期：log 通过 G.boss.emoji 显示 💀

### Case 2: 猫猫Boss 日志
- 条件：boss=tabby，敌人行动
- 预期：log 显示 🐱

### Case 3: 无尽去重
- 条件：ENDLESS_DEFEATED=[tabby,siamese]
- 预期：下只 boss 不是 tabby/siamese
