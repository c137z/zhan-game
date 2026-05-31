# Expected: bug_sanctums — 圣物效果对齐手册 v2.7

Contract version: a038d75

## VERIFICATION CHECKLIST (IMMUTABLE)

1. calcBaseValue 读取 effectiveMinCombo，连击核心后 2连=4，3连=6
2. calcPursuitMultiplier 门槛 = effectiveMinCombo + 1，连击核心后 3连起追（×1.1）
3. getComboDuration 读取 effectiveMinCombo，连击核心后 2连=1回合，3连=2回合
4. getStunDuration 同步跟随 getComboDuration 修改（眩晕与其他buff保持一致）
5. getEffectDescription 的 dur 加了 buffDurationBonus（耐久核心预览同步）
6. 狂暴核心 fury 不再乘 dur（L356 预览 dur、L367 stunDur 预览 删除 fury 乘法）
7. 狂暴核心 fury 不再乘 dur（Phase 1 L445/L456/L463/L472 删除 fury 乘法）
8. stun 结算（L442-443）不受狂暴影响（当前已正确无需改，确认即可）
9. 斯芬克斯文案 data.js L171 改为"舔你"
10. 连击核心+耐久核心叠加：2连 dur=max(1,2-2+1)+1=2回合，3连 dur=max(1,3-2+1)+1=3回合
11. buffDurationBonus 在 getComboDuration 之后叠加（不重复乘）
12. effectiveAtkBuffMult 更新逻辑仍在 updateEffectiveFuryValues()，只不再影响 dur
13. executeTurn Phase 3 的 playerEffects.xxx-- 衰减未改动
14. 所有 buff/debuff 类型的持续回合在 preview/runtime/badge 三轨一致
15. Contract B2/B3/C2 未破坏
16. no side-effect on mechanics
17. no UI mismatch
18. no runtime mismatch

## INPUT CASE + EXPECTED VALUE

### Case 1: 无圣物攻击
- 条件：minCombo=3，3连攻击
- 预期：base=4+(3-3)*2=4，无追击，最终=4

### Case 2: 连击核心攻击
- 条件：minCombo=2，2连攻击
- 预期：base=4+(2-2)*2=4，无追击（2<3），最终=4

### Case 3: 连击核心攻击+追击
- 条件：minCombo=2，3连攻击
- 预期：base=4+(3-2)*2=6，追击=1+(3-2)*0.1=1.1，最终=ceil(6.6)=7

### Case 4: 连击核心 buff
- 条件：minCombo=2，2连降攻
- 预期：dur=max(1, 2-2+1)=1回合

### Case 5: 连击核心眩晕
- 条件：minCombo=2，2连眩晕
- 预期：stunDur=max(1, 2-2+1)=1回合

### Case 6: 连击核心+耐久核心叠加
- 条件：minCombo=2，buffDurationBonus=1，2连易伤
- 预期：基础 dur=max(1,2-2+1)=1，加 bonus=2回合。UI预览也显示2回合

### Case 7: 狂暴核心不乘 dur
- 条件：furyEnabled=true，HP=50/100，furyMult=1.5，3连降攻
- 预期：dur=max(1,3-3+1)=1回合（不受 furyMult 影响），effectiveVulnMult=1.5×1.5=2.25

### Case 8: 狂暴核心不乘 stunDur
- 条件：furyEnabled=true，HP=50/100，furyMult=1.5，3连眩晕
- 预期：stunDur=max(1,3-3+1)=1回合，不受 fury 影响

### Case 9: 斯芬克斯文案
- 条件：斯芬克斯触发舔玩家
- 预期：log 输出"🐱 斯芬克斯舔你！玩家 Buff 被舔掉"
