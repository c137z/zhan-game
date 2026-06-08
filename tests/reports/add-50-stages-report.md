# add-50-stages 验证报告

> 生成时间: 2026-06-08T07:55:04.003Z

## 汇总

| 状态 | 数量 |
|------|------|
| PASS | 20 |
| FAIL | 0 |
| **合计** | **20** |

## 逐项结果

| # | 检测项 | 结果 | 详情 |
|---|------|:----:|------|
| 1 | 首页可见 (main-menu:flex) | ✅ PASS |  |
| 2 | 战斗界面隐藏 (battle-view:none) | ✅ PASS |  |
| 3 | 关卡选择隐藏 (stage-select:none) | ✅ PASS |  |
| 4 | 关卡选择页显示50个格子 | ✅ PASS | 实际: 50 |
| 5 | 关卡选择页可见 | ✅ PASS |  |
| 6 | 至少第1关解锁 (至少1个.unlocked) | ✅ PASS | unlocked: 1 |
| 7 | 有锁定关卡 (有.locked) | ✅ PASS | locked: 50 |
| 8 | 点击第1关后战斗界面可见 | ✅ PASS |  |
| 9 | 第1关Boss为逗猫棒(🪄) | ✅ PASS | 实际: 🪄 |
| 10 | 第1关mode=adventure, stageId=1 | ✅ PASS |  |
| 11 | 关卡选择滚动CSS注入 (max-height:85vh overflow-y:auto) | ✅ PASS | #stage-select { max-height: 85vh; overflow-y: auto; } |
| 12 | 可滚动到第50关并截图 | ✅ PASS | 第50格已滚动到视野 |
| 13 | ADVENTURE_STAGES[49]存在 | ✅ PASS | {"id":50,"bossId":"straycat","name":"野猫首领","emoji":"🐈‍⬛","hp":300,"atk":20,"cycle":"atk_def_atk_focus_crit","desc":"冒险模式·关底"} |
| 14 | 第50关id=50 | ✅ PASS | id=50 |
| 15 | 第50关bossId=straycat | ✅ PASS | bossId=straycat |
| 16 | 第50关name=野猫首领 | ✅ PASS | name=野猫首领 |
| 17 | 第50关hp=300 | ✅ PASS | hp=300 |
| 18 | resolveCycle(atk_def_atk_focus_crit)返回5元素 | ✅ PASS | ["attack","defend","attack","focus","crit"] |
| 19 | cycle类型: attack,defend,attack,focus,crit | ✅ PASS | ["attack","defend","attack","focus","crit"] |
| 20 | CAT_BOSS_IDS.length===10 | ✅ PASS | 实际: 10 |

## 截图

- 第1关战斗: `screenshots/add-50-stages-stage1.png`
- 50关网格: `screenshots/add-50-stages-stage50-grid.png`
