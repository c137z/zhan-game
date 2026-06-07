# 猫咪冒险 第一阶段方案（首页 + 5关）

> 2026-06-07 | 哈基米 🐱 | 待老大确认后出 task

---

## 一、现状分析

### 当前代码能做到的
- ✅ 战斗引擎完整（三阶段结算/连击/Boss traits/HP触发/圣物系统）
- ✅ `BOSSES.catToy`（逗猫棒 🪄 HP 50/攻5防5交替）已实现
- ✅ 圣物选择 UI（二选一/分享刷新/广告全拿）
- ✅ 牌组生成系统（支持自定义牌组配置）

### 当前代码做不到的
- ❌ 无首页/模式选择（打开即战斗，`newGame()` 自动启动）
- ❌ 无关卡概念（`currentStage` 硬编码三关流程：毛线团→猫Boss→无尽）
- ❌ 无关卡选择界面（5×5 网格）
- ❌ 无关卡解锁/持久化（无存档）
- ❌ 无猫毛经济系统
- ❌ `_endGame()` 里通关/败北逻辑硬写死了旧三关流程

---

## 二、实现范围

### 本期做
| # | 功能 | 说明 |
|---|------|------|
| 1 | **首页 UI** | 三入口（猫咪冒险/猫猫迷宫/猫王塔）+ 猫毛显示 + 6个系统图标占位 |
| 2 | **关卡选择界面** | 猫咪冒险 → 5×5 网格（25关），打通解锁下一关，已解锁可重玩 |
| 3 | **局外存档系统** | localStorage 持久化：解锁进度/猫毛数量/今日最佳，单文件管理不脏也不丢 |
| 4 | **通用关卡引擎** | 重构 `newGame()` / `_endGame()` / `_startNextStage()`，不再硬编码三关流程，改为参数化关卡驱动 |
| 5 | **前5关 Boss + 牌组配置** | 逗猫棒→水杯→小蜜蜂→小蛇→工蚁，6月7日设计文档对齐 |

### 本期不做
- ❌ 猫猫迷宫（只有入口占位）
- ❌ 猫王塔（只有入口占位）
- ❌ 6个系统功能（每日悬赏/图鉴/成就/好友排行/猫王地图/设置 — 图标占位）
- ❌ 今日最佳统计（用"0层"占位显示）
- ❌ 教学引导（老大说美术做完再看）
- ❌ 标准卡池改 500 张（老大说先挂起来）
- ❌ 第5关以后的内容（5×5 网格已列出但只解锁前5关）
- ❌ 广告/分享功能（按钮 UI 占位，功能为空）

---

## 三、数据结构设计

### 3.1 关卡配置（`data.js` 新增）

```js
var ADVENTURE_STAGES = [
  // 教学关
  { id: 1, bossId: 'catToy', name: '逗猫棒', deck: { attack: 50, defend: 50 }, hp: 50, atk: 5, cycle: 'atk_def', traits: [], desc: '教学关' },
  { id: 2, bossId: 'cup',      name: '水杯',   deck: { attack: 50, defend: 50, atk_buff: 50, vulnerable: 50 }, hp: 100, atk: 10, cycle: 'atk_def', traits: [], desc: '增伤入门' },
  { id: 3, bossId: 'bee',      name: '小蜜蜂', deck: { attack: 50, defend: 50, atk_buff: 50, vulnerable: 50, atk_down: 50, def_buff: 50 }, hp: 100, atk: 20, cycle: 'atk_def', traits: [], desc: '防守入门' },
  { id: 4, bossId: 'snake',    name: '小蛇',   deck: { stun: 20, heal: 20, wild: 20 }, hp: 100, atk: 50, cycle: 'focus_attack', traits: [], desc: '进阶博弈' },
  // 第一幕·昆虫序列
  { id: 5,  bossId: 'ant',     name: '工蚁',   deck: null, hp: 80,  atk: 8,  cycle: 'atk_def', traits: [], desc: '昆虫序列' },
  // ... (6-25 后续拓展，本期只配到第5关)
];
```

`deck: null` 表示使用标准卡池（DECK_SIZES 当前值）。

### 3.2 存档结构（localStorage `zhan_save`）

```json
{
  "catMao": 250,
  "advUnlocked": 5,
  "bestFloor": 0,
  "mazeFirstKills": [],
  "towerBest": 0
}
```

### 3.3 增强 `newGame()`（`core.js` 修改）

```js
// 旧：从 G.bossId + STAGES 数组硬编码
// 新：从 ADVENTURE_STAGES[id-1] 参数化
function newGame() {
  var stageId = G.adventureStageId || G.bossId; // 兼容旧调用
  var stageCfg = G.adventureStageId ? ADVENTURE_STAGES[G.adventureStageId - 1] : null;
  var boss = BOSSES[stageCfg ? stageCfg.bossId : G.bossId || 'skeleton'];
  var relics = G.activeRelics || [];
  
  G = {
    // ... 现有字段 ...
    adventureStageId: G.adventureStageId || null,  // 新增
    boss: boss,
    deckConfig: stageCfg && stageCfg.deck 
      ? JSON.parse(JSON.stringify(stageCfg.deck))
      : JSON.parse(JSON.stringify(DECK_SIZES)),
    // ...
  };
}
```

### 3.4 重构 `_endGame()`（`core.js` 修改）

```js
// 旧：硬编码 currentStage 1→圣物→2→通关→无尽
// 新：根据 G.adventureStageId 判断
Zhan.Engine._endGame = function(win, msg) {
  if (win) {
    if (G.isAdventure) {
      // 冒险模式
      var stageId = G.adventureStageId;
      if (stageId === 4) {
        // 第4关通关 → 展示"教学完成" → 回关选
        st._resultTitle = '🎓 教学完成！';
        st._resultDesc = '你已经掌握了所有技巧！';
        st._restartText = '🗺 返回关卡';
      } else if (stageId < 5) {
        // 第1-3关通关 → 下一关 / 返回关卡
        st._resultTitle = '✨ 通关！';
        st._nextStageEnabled = true;
        st._restartText = '🗺 返回关卡';
      } else {
        // 第5关+ → 继续闯关 / 返回关卡
        st._resultTitle = '⚔️ 胜利！';
        st._nextStageEnabled = true;
        st._restartText = '🗺 返回关卡';
      }
    } else {
      // 迷宫/猫王塔模式（后续扩展）
    }
  } else {
    // 败北：重试 / 返回关卡
    st._resultTitle = '💀 败北';
    st._nextStageEnabled = false;
    st._restartText = '🔄 重试';
  }
};
```

---

## 四、UI 设计

### 4.1 首页（新 view：`mainMenu`）

```
================
       斩
 今日最佳：0层
================
  [🐱 猫咪冒险]
    主线关卡
  [🧶 猫猫迷宫]
    每日资源
  [👑 猫王塔]
    无尽挑战
================
  猫毛：250
  [🎯][📖][🏅]
  [🐱][🗺][⚙]
================
```

- 像素风 CSS，三个入口按钮渐变色
- 底部系统图标深色方块占位（hover 显示名字，点击不响应）
- 猫猫迷宫/猫王塔点击弹提示"即将推出"

### 4.2 关卡选择（新 view：`stageSelect`）

```
← 返回
第一幕：昆虫序列 1/25
┌──┬──┬──┬──┬──┐
│ 1│ 2│ 3│ 4│ 5│
│🪄│🥤│🐝│🐍│🐜│
│✓ │✓ │✓ │✓ │🔒│
├──┼──┼──┼──┼──┤
│ 6│ 7│ 8│ 9│10│
│❓│❓│❓│❓│❓│
│🔒│🔒│🔒│🔒│🔒│
├──┼──┼──┼──┼──┤
│...│...│...│...│...│
└──┴──┴──┴──┴──┘
```

- 已解锁关卡显示 Boss emoji + 名称
- 已通关显示 ✓
- 未解锁显示 🔒
- 点击已解锁关卡 → 进入战斗
- 点击已通关关卡 → 弹窗确认重新挑战

### 4.3 冒险战斗（复用现有战斗界面）

- 战斗界面完全复用现有 UI
- 通关/败北弹窗增加"下一关"/"返回关卡"/"重试"按钮
- 顶部显示"第N关 · Boss名"

---

## 五、影响范围

### 修改文件
| 文件 | 改动 |
|------|------|
| `code/data.js` | 新增 `ADVENTURE_STAGES` 数组 + 4 个新 Boss 配置（cup/bee/snake/ant） |
| `code/core.js` | 重构 `newGame()` / `_endGame()` / `_startNextStage()`；新增存档函数 |
| `code/ui.js` | 新增主页渲染/关卡选择渲染/存档逻辑 |
| `code/index.html` | 首页 CSS / 关卡选择 CSS / 入口逻辑 |

### 不修改
- 战斗结算逻辑
- 圣物系统
- Boss trait/hpTriggers 执行引擎
- 牌堆/消除槽/连击计算

---

## 六、风险点

| 风险 | 缓解 |
|------|------|
| `_endGame()` 分支太多易出 bug | 先画出状态转换图，每个分支写 test case |
| 存档结构以后要兼容迷宫/猫王塔 | `version` 字段预留，合并策略：新字段新增不删旧字段 |
| index.html 单文件继续膨胀 | 本期暂不拆文件，后续 tauri 迁移时统一模块化 |
| 第5关起标准卡池 500 张 | 不在此期范围，保持现 DECK_SIZES（atk_buff: 40 -> 暂不改） |

---

## 七、确认清单

老大，下面几点需要你确认：

- [ ] **首页布局**：上述布局 OK？像素风可以后续加，先做功能
- [ ] **猫猫迷宫/猫王塔入口**：点击弹"即将推出"的 toast，可以吗？
- [ ] **6个系统图标**：纯占位方块，不响应点击，hover 显示名称，可以吗？
- [ ] **关卡选择网格**：5×5 展示 25 关，只解锁前 5 关，可以吗？
- [ ] **第4关通关后**：弹窗显示"教学完成" + 回关卡选择页，可以吗？（设计文档里第4关后进入标准卡池，但第5关才换标准卡池）
- [ ] **旧三关流程**：`STAGES` 和旧 `_endGame()` 硬编码逻辑全部废弃，修改范围 OK？
- [ ] **存档**：用 localStorage 存本地，不做云端同步，以后做排行时再对接后端，OK？

👆 确认后我出 task 文件给 MSP 执行。
