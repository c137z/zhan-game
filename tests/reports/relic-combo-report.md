# 圣物组合测试报告

> 版本：v2.3-baseline
> 时间：2026-06-05 08:44
> 环境：Playwright + Chrome headless
> 测试范围：11 单圣物 + 14 双圣物组合 × 5 HP 梯度

## 总览

| 状态 | 数量 |
|------|------|
| PASS | 0 |
| DAMAGE | 25 |
| BUFF_DUR | 0 |
| MECHANICS | 5 |
| DEFENSE | 125 |

## 单圣物基线

| 圣物 | HP% | atkBuffMult | vulnMult | defBuffRatio | bestDamage | maxBuffDur | minCombo | noPenalty | effHP | 标记 |
|------|-----|-------------|----------|--------------|------------|------------|----------|-----------|-------|------|
| 双生花 | 100% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 双生花 | 75% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 双生花 | 50% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 双生花 | 25% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 双生花 | 1% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 连击核心 | 100% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 连击核心 | 75% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 连击核心 | 50% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 连击核心 | 25% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 连击核心 | 1% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 扩容核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 扩容核心 | 75% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 扩容核心 | 50% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 扩容核心 | 25% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 扩容核心 | 1% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 耐久核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 242 | DEFENSE |
| 耐久核心 | 75% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 242 | DEFENSE |
| 耐久核心 | 50% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 242 | DEFENSE |
| 耐久核心 | 25% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 242 | DEFENSE |
| 耐久核心 | 1% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 242 | DEFENSE |
| 万能核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 万能核心 | 75% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 万能核心 | 50% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 万能核心 | 25% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 万能核心 | 1% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 过载核心 | 100% | 2 | 2 | 0.5 | 124 | 8 | 3 | false | 300 | DAMAGE, DEFENSE |
| 过载核心 | 75% | 2 | 2 | 0.5 | 124 | 8 | 3 | false | 300 | DAMAGE, DEFENSE |
| 过载核心 | 50% | 2 | 2 | 0.5 | 124 | 8 | 3 | false | 300 | DAMAGE, DEFENSE |
| 过载核心 | 25% | 2 | 2 | 0.5 | 124 | 8 | 3 | false | 300 | DAMAGE, DEFENSE |
| 过载核心 | 1% | 2 | 2 | 0.5 | 124 | 8 | 3 | false | 300 | DAMAGE, DEFENSE |
| 元气核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | true | 242 | DEFENSE |
| 元气核心 | 75% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | true | 242 | DEFENSE |
| 元气核心 | 50% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | true | 242 | DEFENSE |
| 元气核心 | 25% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | true | 242 | DEFENSE |
| 元气核心 | 1% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | true | 242 | DEFENSE |
| 救命毫毛 | 100% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 救命毫毛 | 75% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 救命毫毛 | 50% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 救命毫毛 | 25% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 救命毫毛 | 1% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 坚韧核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 坚韧核心 | 75% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 坚韧核心 | 50% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 坚韧核心 | 25% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 坚韧核心 | 1% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 狂暴核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 狂暴核心 | 75% | 1.63 | 1.63 | 0.63 | 83 | 8 | 3 | false | 260 | DEFENSE |
| 狂暴核心 | 50% | 1.75 | 1.75 | 0.55 | 97 | 8 | 3 | false | 281 | DEFENSE |
| 狂暴核心 | 25% | 1.88 | 1.88 | 0.47 | 111 | 8 | 3 | false | 310 | DEFENSE |
| 狂暴核心 | 1% | 2 | 2 | 0.4 | 124 | 8 | 3 | false | 348 | DAMAGE, DEFENSE |
| 生命核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 364 | DEFENSE |
| 生命核心 | 75% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 364 | DEFENSE |
| 生命核心 | 50% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 364 | DEFENSE |
| 生命核心 | 25% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 364 | DEFENSE |
| 生命核心 | 1% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 364 | DEFENSE |

## 双圣物组合

| 组合 | HP% | atkBuffMult | vulnMult | defBuffRatio | bestDamage | maxBuffDur | minCombo | noPenalty | effHP | 标记 |
|------|-----|-------------|----------|--------------|------------|------------|----------|-----------|-------|------|
| 过载核心 + 狂暴核心 | 100% | 2 | 2 | 0.5 | 124 | 8 | 3 | false | 300 | DAMAGE, DEFENSE |
| 过载核心 + 狂暴核心 | 75% | 2.25 | 2.25 | 0.38 | 158 | 8 | 3 | false | 366 | DAMAGE, DEFENSE |
| 过载核心 + 狂暴核心 | 50% | 2.5 | 2.5 | 0.25 | 195 | 8 | 3 | false | 500 | DAMAGE, DEFENSE |
| 过载核心 + 狂暴核心 | 25% | 2.75 | 2.75 | 0.13 | 237 | 8 | 3 | false | 900 | DAMAGE, DEFENSE |
| 过载核心 + 狂暴核心 | 1% | 2.99 | 2.99 | 0.01 | 279 | 8 | 3 | false | 20099 | DAMAGE, DEFENSE |
| 过载核心 + 耐久核心 | 100% | 2 | 2 | 0.5 | 124 | 9 | 3 | false | 300 | DAMAGE, DEFENSE |
| 过载核心 + 耐久核心 | 75% | 2 | 2 | 0.5 | 124 | 9 | 3 | false | 300 | DAMAGE, DEFENSE |
| 过载核心 + 耐久核心 | 50% | 2 | 2 | 0.5 | 124 | 9 | 3 | false | 300 | DAMAGE, DEFENSE |
| 过载核心 + 耐久核心 | 25% | 2 | 2 | 0.5 | 124 | 9 | 3 | false | 300 | DAMAGE, DEFENSE |
| 过载核心 + 耐久核心 | 1% | 2 | 2 | 0.5 | 124 | 9 | 3 | false | 300 | DAMAGE, DEFENSE |
| 狂暴核心 + 耐久核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 242 | DEFENSE |
| 狂暴核心 + 耐久核心 | 75% | 1.63 | 1.63 | 0.63 | 83 | 9 | 3 | false | 260 | DEFENSE |
| 狂暴核心 + 耐久核心 | 50% | 1.75 | 1.75 | 0.55 | 97 | 9 | 3 | false | 281 | DEFENSE |
| 狂暴核心 + 耐久核心 | 25% | 1.88 | 1.88 | 0.47 | 111 | 9 | 3 | false | 310 | DEFENSE |
| 狂暴核心 + 耐久核心 | 1% | 2 | 2 | 0.4 | 124 | 9 | 3 | false | 348 | DAMAGE, DEFENSE |
| 狂暴核心 + 生命核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 364 | DEFENSE |
| 狂暴核心 + 生命核心 | 75% | 1.63 | 1.63 | 0.62 | 83 | 8 | 3 | false | 390 | DEFENSE |
| 狂暴核心 + 生命核心 | 50% | 1.75 | 1.75 | 0.55 | 97 | 8 | 3 | false | 422 | DEFENSE |
| 狂暴核心 + 生命核心 | 25% | 1.88 | 1.88 | 0.47 | 111 | 8 | 3 | false | 466 | DEFENSE |
| 狂暴核心 + 生命核心 | 1% | 2 | 2 | 0.4 | 124 | 8 | 3 | false | 523 | DAMAGE, DEFENSE |
| 耐久核心 + 生命核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 364 | DEFENSE |
| 耐久核心 + 生命核心 | 75% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 364 | DEFENSE |
| 耐久核心 + 生命核心 | 50% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 364 | DEFENSE |
| 耐久核心 + 生命核心 | 25% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 364 | DEFENSE |
| 耐久核心 + 生命核心 | 1% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 364 | DEFENSE |
| 坚韧核心 + 生命核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 364 | DEFENSE |
| 坚韧核心 + 生命核心 | 75% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 364 | DEFENSE |
| 坚韧核心 + 生命核心 | 50% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 364 | DEFENSE |
| 坚韧核心 + 生命核心 | 25% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 364 | DEFENSE |
| 坚韧核心 + 生命核心 | 1% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 364 | DEFENSE |
| 坚韧核心 + 耐久核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 242 | DEFENSE |
| 坚韧核心 + 耐久核心 | 75% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 242 | DEFENSE |
| 坚韧核心 + 耐久核心 | 50% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 242 | DEFENSE |
| 坚韧核心 + 耐久核心 | 25% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 242 | DEFENSE |
| 坚韧核心 + 耐久核心 | 1% | 1.5 | 1.5 | 0.7 | 71 | 9 | 3 | false | 242 | DEFENSE |
| 万能核心 + 元气核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | true | 242 | DEFENSE |
| 万能核心 + 元气核心 | 75% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | true | 242 | DEFENSE |
| 万能核心 + 元气核心 | 50% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | true | 242 | DEFENSE |
| 万能核心 + 元气核心 | 25% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | true | 242 | DEFENSE |
| 万能核心 + 元气核心 | 1% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | true | 242 | DEFENSE |
| 连击核心 + 万能核心 | 100% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 连击核心 + 万能核心 | 75% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 连击核心 + 万能核心 | 50% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 连击核心 + 万能核心 | 25% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 连击核心 + 万能核心 | 1% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 连击核心 + 元气核心 | 100% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | true | 242 | MECHANICS, DEFENSE |
| 连击核心 + 元气核心 | 75% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | true | 242 | MECHANICS, DEFENSE |
| 连击核心 + 元气核心 | 50% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | true | 242 | MECHANICS, DEFENSE |
| 连击核心 + 元气核心 | 25% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | true | 242 | MECHANICS, DEFENSE |
| 连击核心 + 元气核心 | 1% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | true | 242 | MECHANICS, DEFENSE |
| 连击核心 + 坚韧核心 | 100% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 连击核心 + 坚韧核心 | 75% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 连击核心 + 坚韧核心 | 50% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 连击核心 + 坚韧核心 | 25% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 连击核心 + 坚韧核心 | 1% | 1.5 | 1.5 | 0.7 | 81 | 9 | 2 | false | 242 | DEFENSE |
| 万能核心 + 狂暴核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | false | 242 | DEFENSE |
| 万能核心 + 狂暴核心 | 75% | 1.63 | 1.63 | 0.63 | 83 | 8 | 3 | false | 260 | DEFENSE |
| 万能核心 + 狂暴核心 | 50% | 1.75 | 1.75 | 0.55 | 97 | 8 | 3 | false | 281 | DEFENSE |
| 万能核心 + 狂暴核心 | 25% | 1.88 | 1.88 | 0.47 | 111 | 8 | 3 | false | 310 | DEFENSE |
| 万能核心 + 狂暴核心 | 1% | 2 | 2 | 0.4 | 124 | 8 | 3 | false | 348 | DAMAGE, DEFENSE |
| 过载核心 + 坚韧核心 | 100% | 2 | 2 | 0.5 | 124 | 8 | 3 | false | 300 | DAMAGE, DEFENSE |
| 过载核心 + 坚韧核心 | 75% | 2 | 2 | 0.5 | 124 | 8 | 3 | false | 300 | DAMAGE, DEFENSE |
| 过载核心 + 坚韧核心 | 50% | 2 | 2 | 0.5 | 124 | 8 | 3 | false | 300 | DAMAGE, DEFENSE |
| 过载核心 + 坚韧核心 | 25% | 2 | 2 | 0.5 | 124 | 8 | 3 | false | 300 | DAMAGE, DEFENSE |
| 过载核心 + 坚韧核心 | 1% | 2 | 2 | 0.5 | 124 | 8 | 3 | false | 300 | DAMAGE, DEFENSE |
| 元气核心 + 狂暴核心 | 100% | 1.5 | 1.5 | 0.7 | 71 | 8 | 3 | true | 242 | DEFENSE |
| 元气核心 + 狂暴核心 | 75% | 1.63 | 1.63 | 0.63 | 83 | 8 | 3 | true | 260 | DEFENSE |
| 元气核心 + 狂暴核心 | 50% | 1.75 | 1.75 | 0.55 | 97 | 8 | 3 | true | 281 | DEFENSE |
| 元气核心 + 狂暴核心 | 25% | 1.88 | 1.88 | 0.47 | 111 | 8 | 3 | true | 310 | DEFENSE |
| 元气核心 + 狂暴核心 | 1% | 2 | 2 | 0.4 | 124 | 8 | 3 | true | 348 | DAMAGE, DEFENSE |

## 异常汇总

### DAMAGE（伤害 > 120）

- `overload_core` @ HP 100%: bestDamage = 124
- `overload_core` @ HP 75%: bestDamage = 124
- `overload_core` @ HP 50%: bestDamage = 124
- `overload_core` @ HP 25%: bestDamage = 124
- `overload_core` @ HP 1%: bestDamage = 124
- `fury_core` @ HP 1%: bestDamage = 124
- `overload_core+fury_core` @ HP 100%: bestDamage = 124
- `overload_core+fury_core` @ HP 75%: bestDamage = 158
- `overload_core+fury_core` @ HP 50%: bestDamage = 195
- `overload_core+fury_core` @ HP 25%: bestDamage = 237
- `overload_core+fury_core` @ HP 1%: bestDamage = 279
- `overload_core+endurance_core` @ HP 100%: bestDamage = 124
- `overload_core+endurance_core` @ HP 75%: bestDamage = 124
- `overload_core+endurance_core` @ HP 50%: bestDamage = 124
- `overload_core+endurance_core` @ HP 25%: bestDamage = 124
- `overload_core+endurance_core` @ HP 1%: bestDamage = 124
- `fury_core+endurance_core` @ HP 1%: bestDamage = 124
- `fury_core+life_core` @ HP 1%: bestDamage = 124
- `wild_core+fury_core` @ HP 1%: bestDamage = 124
- `overload_core+tenacity_core` @ HP 100%: bestDamage = 124
- `overload_core+tenacity_core` @ HP 75%: bestDamage = 124
- `overload_core+tenacity_core` @ HP 50%: bestDamage = 124
- `overload_core+tenacity_core` @ HP 25%: bestDamage = 124
- `overload_core+tenacity_core` @ HP 1%: bestDamage = 124
- `spirit_core+fury_core` @ HP 1%: bestDamage = 124

### BUFF_DUR（持续 > 12）

(无异常)

### MECHANICS（minCombo=2 且 免惩罚）

- `combo_core+spirit_core` @ HP 100%: minCombo=2 noPenalty=true
- `combo_core+spirit_core` @ HP 75%: minCombo=2 noPenalty=true
- `combo_core+spirit_core` @ HP 50%: minCombo=2 noPenalty=true
- `combo_core+spirit_core` @ HP 25%: minCombo=2 noPenalty=true
- `combo_core+spirit_core` @ HP 1%: minCombo=2 noPenalty=true

### DEFENSE（免死 + effectiveHP > 200）

- `double_wild` @ HP 100%: effHP = 242
- `double_wild` @ HP 75%: effHP = 242
- `double_wild` @ HP 50%: effHP = 242
- `double_wild` @ HP 25%: effHP = 242
- `double_wild` @ HP 1%: effHP = 242
- `combo_core` @ HP 100%: effHP = 242
- `combo_core` @ HP 75%: effHP = 242
- `combo_core` @ HP 50%: effHP = 242
- `combo_core` @ HP 25%: effHP = 242
- `combo_core` @ HP 1%: effHP = 242
- `slot_plus2` @ HP 100%: effHP = 242
- `slot_plus2` @ HP 75%: effHP = 242
- `slot_plus2` @ HP 50%: effHP = 242
- `slot_plus2` @ HP 25%: effHP = 242
- `slot_plus2` @ HP 1%: effHP = 242
- `endurance_core` @ HP 100%: effHP = 242
- `endurance_core` @ HP 75%: effHP = 242
- `endurance_core` @ HP 50%: effHP = 242
- `endurance_core` @ HP 25%: effHP = 242
- `endurance_core` @ HP 1%: effHP = 242
- `wild_core` @ HP 100%: effHP = 242
- `wild_core` @ HP 75%: effHP = 242
- `wild_core` @ HP 50%: effHP = 242
- `wild_core` @ HP 25%: effHP = 242
- `wild_core` @ HP 1%: effHP = 242
- `overload_core` @ HP 100%: effHP = 300
- `overload_core` @ HP 75%: effHP = 300
- `overload_core` @ HP 50%: effHP = 300
- `overload_core` @ HP 25%: effHP = 300
- `overload_core` @ HP 1%: effHP = 300
- `spirit_core` @ HP 100%: effHP = 242
- `spirit_core` @ HP 75%: effHP = 242
- `spirit_core` @ HP 50%: effHP = 242
- `spirit_core` @ HP 25%: effHP = 242
- `spirit_core` @ HP 1%: effHP = 242
- `lifesaving_fur` @ HP 100%: effHP = 242
- `lifesaving_fur` @ HP 75%: effHP = 242
- `lifesaving_fur` @ HP 50%: effHP = 242
- `lifesaving_fur` @ HP 25%: effHP = 242
- `lifesaving_fur` @ HP 1%: effHP = 242
- `tenacity_core` @ HP 100%: effHP = 242
- `tenacity_core` @ HP 75%: effHP = 242
- `tenacity_core` @ HP 50%: effHP = 242
- `tenacity_core` @ HP 25%: effHP = 242
- `tenacity_core` @ HP 1%: effHP = 242
- `fury_core` @ HP 100%: effHP = 242
- `fury_core` @ HP 75%: effHP = 260
- `fury_core` @ HP 50%: effHP = 281
- `fury_core` @ HP 25%: effHP = 310
- `fury_core` @ HP 1%: effHP = 348
- `life_core` @ HP 100%: effHP = 364
- `life_core` @ HP 75%: effHP = 364
- `life_core` @ HP 50%: effHP = 364
- `life_core` @ HP 25%: effHP = 364
- `life_core` @ HP 1%: effHP = 364
- `overload_core+fury_core` @ HP 100%: effHP = 300
- `overload_core+fury_core` @ HP 75%: effHP = 366
- `overload_core+fury_core` @ HP 50%: effHP = 500
- `overload_core+fury_core` @ HP 25%: effHP = 900
- `overload_core+fury_core` @ HP 1%: effHP = 20099
- `overload_core+endurance_core` @ HP 100%: effHP = 300
- `overload_core+endurance_core` @ HP 75%: effHP = 300
- `overload_core+endurance_core` @ HP 50%: effHP = 300
- `overload_core+endurance_core` @ HP 25%: effHP = 300
- `overload_core+endurance_core` @ HP 1%: effHP = 300
- `fury_core+endurance_core` @ HP 100%: effHP = 242
- `fury_core+endurance_core` @ HP 75%: effHP = 260
- `fury_core+endurance_core` @ HP 50%: effHP = 281
- `fury_core+endurance_core` @ HP 25%: effHP = 310
- `fury_core+endurance_core` @ HP 1%: effHP = 348
- `fury_core+life_core` @ HP 100%: effHP = 364
- `fury_core+life_core` @ HP 75%: effHP = 390
- `fury_core+life_core` @ HP 50%: effHP = 422
- `fury_core+life_core` @ HP 25%: effHP = 466
- `fury_core+life_core` @ HP 1%: effHP = 523
- `endurance_core+life_core` @ HP 100%: effHP = 364
- `endurance_core+life_core` @ HP 75%: effHP = 364
- `endurance_core+life_core` @ HP 50%: effHP = 364
- `endurance_core+life_core` @ HP 25%: effHP = 364
- `endurance_core+life_core` @ HP 1%: effHP = 364
- `tenacity_core+life_core` @ HP 100%: effHP = 364
- `tenacity_core+life_core` @ HP 75%: effHP = 364
- `tenacity_core+life_core` @ HP 50%: effHP = 364
- `tenacity_core+life_core` @ HP 25%: effHP = 364
- `tenacity_core+life_core` @ HP 1%: effHP = 364
- `tenacity_core+endurance_core` @ HP 100%: effHP = 242
- `tenacity_core+endurance_core` @ HP 75%: effHP = 242
- `tenacity_core+endurance_core` @ HP 50%: effHP = 242
- `tenacity_core+endurance_core` @ HP 25%: effHP = 242
- `tenacity_core+endurance_core` @ HP 1%: effHP = 242
- `wild_core+spirit_core` @ HP 100%: effHP = 242
- `wild_core+spirit_core` @ HP 75%: effHP = 242
- `wild_core+spirit_core` @ HP 50%: effHP = 242
- `wild_core+spirit_core` @ HP 25%: effHP = 242
- `wild_core+spirit_core` @ HP 1%: effHP = 242
- `combo_core+wild_core` @ HP 100%: effHP = 242
- `combo_core+wild_core` @ HP 75%: effHP = 242
- `combo_core+wild_core` @ HP 50%: effHP = 242
- `combo_core+wild_core` @ HP 25%: effHP = 242
- `combo_core+wild_core` @ HP 1%: effHP = 242
- `combo_core+spirit_core` @ HP 100%: effHP = 242
- `combo_core+spirit_core` @ HP 75%: effHP = 242
- `combo_core+spirit_core` @ HP 50%: effHP = 242
- `combo_core+spirit_core` @ HP 25%: effHP = 242
- `combo_core+spirit_core` @ HP 1%: effHP = 242
- `combo_core+tenacity_core` @ HP 100%: effHP = 242
- `combo_core+tenacity_core` @ HP 75%: effHP = 242
- `combo_core+tenacity_core` @ HP 50%: effHP = 242
- `combo_core+tenacity_core` @ HP 25%: effHP = 242
- `combo_core+tenacity_core` @ HP 1%: effHP = 242
- `wild_core+fury_core` @ HP 100%: effHP = 242
- `wild_core+fury_core` @ HP 75%: effHP = 260
- `wild_core+fury_core` @ HP 50%: effHP = 281
- `wild_core+fury_core` @ HP 25%: effHP = 310
- `wild_core+fury_core` @ HP 1%: effHP = 348
- `overload_core+tenacity_core` @ HP 100%: effHP = 300
- `overload_core+tenacity_core` @ HP 75%: effHP = 300
- `overload_core+tenacity_core` @ HP 50%: effHP = 300
- `overload_core+tenacity_core` @ HP 25%: effHP = 300
- `overload_core+tenacity_core` @ HP 1%: effHP = 300
- `spirit_core+fury_core` @ HP 100%: effHP = 242
- `spirit_core+fury_core` @ HP 75%: effHP = 260
- `spirit_core+fury_core` @ HP 50%: effHP = 281
- `spirit_core+fury_core` @ HP 25%: effHP = 310
- `spirit_core+fury_core` @ HP 1%: effHP = 348
