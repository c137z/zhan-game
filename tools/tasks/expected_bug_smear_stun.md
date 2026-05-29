# Expected: bug_smear_stun — 布偶猫涂抹 + 耐久核心眩晕修复

Contract version: a038d75

## VERIFICATION CHECKLIST (IMMUTABLE)

1. core.js `getEffectDescription` 的 `case 'stun':` 中 stunDur 加上了 `buffDurationBonus`
2. data.js 布偶猫 ragdoll 的 `smear_piles` trait 删除了 `onTurnEnd`
3. data.js 布偶猫 ragdoll 的 `smear_piles.onTurnStart` 开头先清空 `G.smearedPiles = {};`
4. ui.js 涂抹卡牌渲染：icon 显示 ❓，label 显示 ??
5. ui.js 涂抹卡牌卡面：背景 #555，文字 #ccc，边框 #666
6. ui.js 涂抹卡牌的堆叠数（stack-count）正常显示
7. style.css `.card-slot.smeared` 清空或移除 blur
8. 耐久核心 + 3连眩晕 → 预览显示"眩晕 2回合"，badge 显示 2T，实际跳过 2 回合（非舔毛/哈气回合）
9. 布偶猫涂抹后，被涂牌堆 UI 遮盖，但卡牌实际类型不变（抽出来仍是原卡类型）
10. 涂抹效果在玩家回合内持续可见
11. 涂抹在下一回合 onTurnStart 时被新涂抹替换
12. 舔毛/哈气对眩晕的正常清空逻辑不变
13. 其他 buff/debuff 的预览和结算不变
14. Contract B2/B3/C2 未破坏
15. no side-effect on mechanics
16. no UI mismatch
17. no runtime mismatch

## INPUT CASE + EXPECTED VALUE

### Case 1: 耐久核心 + 3连眩晕预览
- 条件：activeRelics 含 endurance_core，3连眩晕
- 预期：getEffectDescription 返回 "眩晕 2回合"（1+bonus=2）

### Case 2: 耐久核心 + 3连眩晕结算
- 条件：activeRelics 含 endurance_core，3连眩晕
- 预期：G.enemyEffects.stun = 2，badge 显示 "💫眩晕 2T"

### Case 3: 无圣物 + 3连眩晕
- 条件：无 endurance_core，3连眩晕
- 预期：预览"眩晕 1回合"，结算 stun=1，badge "💫眩晕 1T"

### Case 4: 布偶猫涂抹效果
- 条件：布偶猫 ragdoll 的 enemyTurn onTurnStart
- 预期：选中 2 个有牌的牌堆，设置 smearedPiles[flatIdx]=true

### Case 5: 布偶猫涂抹 UI 遮盖
- 条件：牌堆被涂抹
- 预期：卡牌 icon 显示❓，label 显示??，灰色背景，堆叠数正常显示

### Case 6: 布偶猫涂抹持续性
- 条件：涂抹后进入玩家回合
- 预期：玩家回合中涂抹仍可见（smearedPiles 未被清空）

### Case 7: 布偶猫涂抹刷新
- 条件：下一回合 onTurnStart
- 预期：旧涂抹被清空，新涂抹设置
