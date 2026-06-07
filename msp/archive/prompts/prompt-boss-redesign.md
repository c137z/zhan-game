# Prompt: Boss行为循环重设计

## 设计目标

将旧的 7 回合 Boss 循环（攻击→防御→蓄力→攻击→防御→充能→怒击）替换为新设计。

## 核心概念：能力值（Power）

- 能力值同时影响**攻击力**和**防御护盾**
- 初始能力值 = Boss 的 baseAtk（毛线团12，猫猫20）
- 每回合结束（TURN_END）能力值自动增长：毛线团+1，猫猫+2
- 攻击伤害 = 当前能力值
- 防御护盾 = 当前能力值
- 蓄力回合：不出手不叠盾，但能力值照常增长
- 暴击 = 当前能力值 × 2

## T1 首回合 Buff（不可打断）

- 第一个回合（turn 0）Boss 发动"buff_self"：上能力值增长 buff
- **眩晕不能跳过首回合 buff**——在 _enemyTurn 开头，判断 stun 之前就检查是否是首回合
- 首回合 Boss 不攻击也不防御，只上 buff

## 毛线团（skeleton）

| 属性 | 值 |
|------|-----|
| baseAtk | 12 |
| 能力值成长 | +1/回合 |
| 循环（4回合） | 攻击 → 防御 → 蓄力 → 暴击 |
| startShield | 0 |

T1: buff_self → T2: 攻击13 → T3: 防御14盾 → T4: 蓄力(能力值15-不行动) → T5: 暴击16×2=32
T6: 攻击17 → T7: 防御18盾 → T8: 蓄力19 → T9: 暴击20×2=40

## 猫猫 Boss（10只）

| 属性 | 值 |
|------|-----|
| baseAtk | 20 |
| 能力值成长 | +2/回合 |
| 循环（5回合） | 攻击 → 防御 → 攻击 → 蓄力 → 暴击 |
| startShield | 0 |

T1: buff_self → T2: 攻击22 → T3: 防御24盾 → T4: 攻击26 → T5: 蓄力28 → T6: 暴击30×2=60
T7: 攻击32 → T8: 防御34盾 → T9: 攻击36 → T10: 蓄力38 → T11: 暴击40×2=80

## 舔毛规则改动

- 旧规则：每5回合（turn>0且(turn+1)%5===0）
- 新规则：从第5回合开始，每4回合一次（turn>=5且(turn-5)%4===0）
- 第一次舔毛在 T5，第二次 T9，第三次 T13...
- 效果不变：清除 Boss 自身全部 Debuff

## 哈气规则

不变：Boss 每掉 100 血触发一次，清空全场 Buff/Debuff。

## 删除的旧机制

- BOSS_CYCLE_TEMPLATE（7回合模板）
- fastCycle（半血加速循环）
- enemyPower（旧的独立力量值，被能力值power替代）
- buff_power action（被能力值系统替代）
- charge action（被蓄力focus替代）
- rage action（被暴击crit替代）
- double_attack action（被暴击crit替代）

## 新 action type

| type | 含义 |
|------|------|
| buff_self | 首回合buff，能力值开始增长 |
| attack | 攻击，伤害=当前能力值 |
| defend | 防御，叠护盾=当前能力值 |
| focus | 蓄力，不行动但能力值照增 |
| crit | 暴击，伤害=当前能力值×2 |

## 关键代码改动点

### data.js
1. 删除 BOSS_CYCLE_TEMPLATE（行72-80）
2. 所有猫猫 Boss 的 baseAtk 从24改为20
3. 所有猫猫 Boss 的 cycle 改为 6 个元素：buff_self, attack, defend, attack, focus, crit
4. 所有猫猫 Boss 添加 powerGrowth: 2
5. 毛线团 skeleton 改为：baseAtk=12, powerGrowth=1, cycle=[buff_self, attack, defend, focus, crit]
6. 逗猫棒 catToy 不改

### core.js
1. newGame()：删除 enemyPower，添加 power: boss.baseAtk
2. _enemyTurn() 重写：
   - T0（turn===0）时执行 buff_self，跳过 stun 判定
   - 删除 fastCycle 逻辑
   - 统一循环索引：(turn-1) % cycle.length
   - 新 switch case：buff_self/focus/crit
   - 删除旧 case：buff_power/charge/rage/double_attack
   - 回合结束时 power += boss.powerGrowth
3. _updateEnemyIntent() 重写意图展示
4. groom handler condition：turn>=5 && (turn-5)%4===0
