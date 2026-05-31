# Expected: bug_wildcore_duplex — 万能牌重复归属修复

Contract version: a038d75

## VERIFICATION CHECKLIST (IMMUTABLE)

1. resolveWildType 改为取最近非万能非废牌类型，距离相等取左边
2. computeCombos 中万能牌被归入连击组后标记 `claimed: true`
3. computeCombos 扫描时跳过 `claimed === true` 的牌
4. executeTurn 未消除惩罚循环中跳过 `type === 'wild'` 的牌
5. 万能核心 bonus comboLen+1 只对每个后方连击组加一次（不重复叠加）
6. 万能核心首槽万能卡行为与普通万能卡一致
7. Case 1: slot = [attack, wild, def_buff]，万能和 attack 组成 2 连（或取 attack 类型），不会同时和 def_buff 组成连击
8. Case 2: slot = [wild(万能核心), attack, attack]，万能→attack，3 连攻击（含 bonus+1=4连），未消除惩罚不含万能牌
9. Case 3: slot = [attack, attack, wild, def_buff]，万能在 attack 组右边但 attack 组在前，万能归入 attack 组=3连，def_buff 单独一张未达 minCombo 则扣血
10. Case 4: slot = [wild, attack]，万能→attack，2 连（无连击核心时 <3 不生效），万能不计入未消除惩罚
11. Case 5: slot = [attack, wild, wild, attack]，两个万能都取相邻 attack→4连攻击
12. 未消除惩罚中普通（非万能）卡牌仍正常计数
13. 连击核心 minCombo=2 时 Case 4 应生效（万能+攻击 2连=有效攻击）
14. Contract B2/B3/C2 未破坏
15. no side-effect on mechanics
16. no UI mismatch
17. no runtime mismatch

## INPUT CASE + EXPECTED VALUE

### Case 1: 万能夹在攻击和减伤之间（Bug #1 主场景）
- 条件：slot = [🗡attack, 💎wild, 💨def_buff]
- 预期：万能取 attack 类型（左边更近或距离相等取左），attack+wild=2连。def_buff 单独，若 minCombo=3 则扣血 1 点。万能不计入未消除惩罚

### Case 2: 万能核心 + 两张攻击（Bug #5 场景）
- 条件：wildCoreSlot=true，slot = [💎wild(核心), 🗡attack, 🗡attack]
- 预期：核心万能→attack，3 连攻击。bonus+1=4连。万能不计入未消除

### Case 3: 攻击+万能+减伤，已有足够攻击在前（Bug #2 场景）
- 条件：slot = [🗡attack, 🗡attack, 💎wild, 💨def_buff]
- 预期：万能被 attack 连击吸收（3连攻击）。def_buff 单独未达 minCombo=3 → 扣血 1 点

### Case 4: 万能 + 一张攻击（无连击核心）
- 条件：minCombo=3，slot = [💎wild, 🗡attack]
- 预期：万能→attack，2连 < 3 不生效。万能不计入未消除惩罚（跳过 type='wild'）。attack 也不计入未消除（已在 resolveWildType 中变成 attack 类型，但只有 1 张 attack < 3 → 扣 1 血？）

⚠️ 注意：Case 4 存在边界歧义。万能不计入未消除（跳过 type='wild'），但万能解析后的 attack 类型在 `slotTypeCount` 中会被计入（Phase 2 L479 的 `resolveWildType`）。而 Phase 2 的 `slotTypeCount` 和未消除惩罚的 `unmatchedByType` 是两套逻辑。需要确认：未消除惩罚只跳过 `type === 'wild'`，不影响 Phase 2 的 slotTypeCount 将万能计为 attack。

### Case 5: 两个连续万能 + 攻击
- 条件：slot = [🗡attack, 💎wild, 💎wild, 🗡attack]
- 预期：所有牌 type→attack，4连攻击

### Case 6: 万能核心后方连击 bonus+1
- 条件：wildCoreSlot=true，minCombo=2（连击核心），slot = [💎wild(核心), 🗡attack, 🗡attack]
- 预期：核心万能→attack，3连（attack+attack+万能核心卡）。bonus+1=4连。攻击值: calcBaseValue(3) calcPursuitMultiplier(4) = (4+(3-2)*2)=6 * (1+(4-2)*0.1)=1.2 → ceil(7.2)=8

### Case 7: 未消除惩罚不包含万能牌
- 条件：slot = [💎wild, 🗡attack, 💨def_buff]，无连击核心 minCombo=3
- 预期：万能→attack（取更近的attack），attack 组=2连（wild+attack）< 3 不生效。未消除惩罚：跳过 wild（type='wild'），attack 1张 < 3 → +1点，def_buff 1张 < 3 → +1点 = 扣 2 血。万能不加重惩罚
