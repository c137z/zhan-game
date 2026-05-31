# Task: bug_sanctums — 圣物效果对齐手册 v2.7

## GOAL
修复 6 个圣物相关 bug，使代码行为与设计手册 v2.7 完全一致。

## ALLOWED FILES
- code/core.js
- code/data.js

## BUG LIST

### Bug #1 — calcBaseValue 硬编码偏移
- 当前：`return 4 + (totalCount - 3) * 2`（L38）
- 要求：改为 `return 4 + (totalCount - (G.effectiveMinCombo || CONFIG.MIN_COMBO)) * 2`
- 效果：连击核心后 2连=4, 3连=6

### Bug #2 — calcPursuitMultiplier 硬编码门槛
- 当前：`if (maxComboLen < 4) return 1`（L42），`(maxComboLen - 3) * 0.1`（L43）
- 要求：读取 `var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO`，门槛改为 `minCombo + 1`，偏移改为 `maxComboLen - minCombo`
- 效果：连击核心后 3连起追（1.1倍）

### Bug #3 — getComboDuration + getStunDuration 硬编码偏移
- 当前 getComboDuration（L344）：`return Math.max(1, n - 2)`
- 当前 getStunDuration（L348-350）：`return getComboDuration(n)`
- 要求：两者都改为 `var minCombo = G.effectiveMinCombo || CONFIG.MIN_COMBO; return Math.max(1, n - minCombo + 1)`
- 效果：连击核心后 2连=1回合, 3连=2回合。眩晕与其他 buff/debuff 保持一致，都受连击核心影响

### Bug #4 — getEffectDescription 缺 buffDurationBonus
- 当前：L353 `var dur = getComboDuration(n)` 之后没有加 `G.buffDurationBonus`
- 要求：在 dur 行后加 `dur += G.buffDurationBonus || 0`（与 Phase 1 L441 对齐）
- 关键：buffDurationBonus 必须在 getComboDuration 之后叠加，不要重复乘
- 效果：耐久核心 UI 预览和结算统一 +1。连击核心+耐久核心叠加时，2连 dur=1+1=2，3连 dur=2+1=3

### Bug #5 — 狂暴核心错误影响持续回合
- 当前：L356/L367（预览）+ L445/L456/L463/L472（结算），共 6 处对 dur/stunDur 乘了 fury
- 要求：删除全部 6 处 fury × dur/stunDur 的逻辑
- 狂暴核心仍影响 effectiveAtkBuffMult/effectiveVulnMult/effectiveDefBuffRatio（通过 updateEffectiveFuryValues）
- 衰减逻辑不改：executeTurn Phase 3 的 atk_buff--、def_buff-- 保持不变
- 眩晕：stun 不受狂暴核心任何影响（不加数值、不加回合）

### Bug #6 — 斯芬克斯文案
- 当前 data.js L171：`log('🐱 斯芬克斯舔主角！玩家 Buff 被舔掉')`
- 要求：改为 `log('🐱 斯芬克斯舔你！玩家 Buff 被舔掉')`
- 只改 UI 文本，不改逻辑

## IMMUTABLE RULES
- 不改编 stun 衰减时机、atk_down 衰减时机
- executeTurn Phase 3 的 playerEffects.xxx-- 衰减不碰
- 不改 CONFIG 常量
- 不改 BOSSES/圣物定义的 onInit
- effectiveAtkBuffMult 更新时机保留在 updateEffectiveFuryValues()，只不再影响 dur
- Contract B2 (enemyHP Math.max) / B3 (phase 白名单) / C2 (cycle 非空) 不可破坏
