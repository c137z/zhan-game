# 测试需求：Boss 力量增长验证

## 测试目标

验证 _enemyTurn 中 Boss 的 enemyPower（力量）是否正确增长。

当前代码逻辑：
- Boss 行动循环中有 `case 'buff_power': st.enemyPower += 2;`（第 685 行）
- 每次攻击时计算 `rawAtk = st.boss.baseAtk + st.enemyPower`
- 初始值 `enemyPower: 0`（newGame 中）
- 每回合结束 log 输出 `⚡{enemyPower}`

## 测试方法

用 Playwright + page.evaluate() 在 v2.3-baseline fixture 上模拟多回合 _executeTurn + _enemyTurn 流程。

## 具体步骤

1. page.evaluate() 调 newGame() 初始化状态
2. 记录 enemyPower 初始值（应为 0）
3. 遍历 boss.cycle（7 回合循环），每个回合：
   a. 在 slot 中放入 3 张 attack 卡（确保最小连击生效，不触发 endGame）
   b. 调 Zhan.Engine._executeTurn()
   c. 调 Zhan.Engine._enemyTurn()
   d. 读取 state.enemyPower 值
4. 额外：再跑 4 个回合（第 8-11 回合，即 fastCycle），记录 enemyPower
5. 检查标准：
   - 初始值 = 0
   - 每经过一次 'buff_power' 行动，enemyPower 应 +2
   - 其他行动类型不改变 enemyPower
   - rawAtk（第 676 行计算）应该随 enemyPower 增长而增加
   - shieldVal（第 681 行计算）应该随 enemyPower 增长而增加
6. 报告输出到 tests/reports/enemy-power-report.md
7. 截图输出到 tests/screenshots/enemy-power-turn-{N}.png

## 判定标准

| 标准 | 检查内容 | PASS 条件 |
|------|---------|----------|
| P1 | 初始 enemyPower | === 0 |
| P2 | buff_power 回合后 | 每触发一次 +2 |
| P3 | rawAtk 增长 | baseAtk + enemyPower 正确 |
| P4 | shieldVal 增长 | 40 + floor(enemyPower/2)*2 |
| P5 | 非 buff_power 回合 | enemyPower 不变 |

## 约束

- 脚本放 tests/scripts/verify-enemy-power.js
- 不修改 tests/fixtures/、code/ 下任何文件
- require('playwright')
- exit 0 = 全 PASS, exit 1 = 有 FAIL
