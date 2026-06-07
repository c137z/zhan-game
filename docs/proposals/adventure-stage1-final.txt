# 猫咪冒险第一阶段 — 最终方案

> 2026-06-07 | 哈基米 🐱 | 已与老大对齐，待确认后拆 task

---

## 一、范围总览

### 本期做

| # | 功能 | 说明 |
|---|------|------|
| 1 | **首页 UI** | 三入口按钮（猫咪冒险/猫猫迷宫/猫王塔）+ 猫毛显示 + 6 系统图标占位 |
| 2 | **关卡选择界面** | 猫咪冒险 → 5×5 网格（25关），打通解锁下一关，已解锁可重玩 |
| 3 | **存档系统** | localStorage 持久化：解锁进度/猫毛/猫猫迷宫首杀/猫王塔最佳 |
| 4 | **猫咪冒险关卡引擎** | 参数化关卡驱动（ADVENTURE_STAGES），替换旧 `newGame()` 硬编码 |
| 5 | **猫咪冒险前5关** | 逗猫棒→水杯→蜜蜂→小蛇→工蚁，带 Boss + 牌组配置 |
| 6 | **猫猫迷宫模式** | 毛线团→圣物二选一（分享刷新/广告全拿）→随机猫Boss |
| 7 | **猫王塔模式** | 进塔随机1圣物→打第1只猫→随机抽第2圣物→2圣物打到底，每层血量重置 |

### 本期不做

- ❌ 教学引导
- ❌ 6 系统功能实际逻辑（每日悬赏/图鉴/成就/好友排行/猫王地图/设置）
- ❌ 今日最佳统计（显示"0 层"占位）
- ❌ 广告/分享功能（按钮 UI 占位，功能空函数）
- ❌ 标准卡池改为 500 张
- ❌ 第 6-25 关 Boss 配置

---

## 二、用户流程

### 2.1 首页 → 猫咪冒险

```
首页（三入口）
  ↓ 点击【猫咪冒险】
关卡选择页（5×5 网格）
  ↓ 点击已解锁关卡
战斗（牌堆 → 消除 → Boss）
  ↓ 通关
通关弹窗：
  · 继续闯关  → 进下一关（若已解锁）
  · 返回主页  → 首页
  ↓ 败北
败北弹窗：
  · 重试      → 重新打同一关
  · 返回主页  → 首页
```

- 关卡解锁规则：打通第 N 关 → 第 N+1 关解锁
- 通关第四关（小蛇）后，首页"猫猫迷宫"和"猫王塔"永久解锁
- 每关通关/败北后均可选择返回主页

### 2.2 首页 → 猫猫迷宫

```
首页
  ↓ 点击【猫猫迷宫】
战斗：毛线团 🧶（HP 100/攻12/成长+1/4回合循环）
  ↓ 通关（血量不补，剩多少进下一场）
圣物二选一（分享刷新 / 广告全拿）
  ↓ 确认圣物
战斗：随机猫 Boss（10只猫中随机，血量回满）
  ↓ 通关
通关弹窗：
  · 返回主页
  ↓ 败北
败北弹窗：
  · 重试      → 重新打毛线团
  · 返回主页  → 首页
```

- 毛线团无圣物
- 猫 Boss 带完整特性（锁牌/锁槽/舔Buff/隐藏意图/弃牌/涂牌面/限时/塞废牌/晕玩家/先手）
- 本期奖励逻辑：首杀记录到存档，猫毛发放后续统一做

### 2.3 首页 → 猫王塔

```
首页
  ↓ 点击【猫王塔】
圣物二选一（分享刷新 / 不能全拿，必须选1个）
  ↓ 确认圣物
战斗：随机猫 Boss #1（血量初始100）
  ↓ 通关（血量回满）
圣物二选一（再来一次，共2个圣物）
  ↓ 确认圣物 → 之后不再抽圣物
战斗：随机猫 Boss #2（血量重置）
  ↓ 通关 → 血量重置 → 下一只随机猫...
  ↓ 败北
败北弹窗：
  · 显示击败猫数 + 称号
  · 返回主页
  ↓ 全猫征服（10只全通）
通关弹窗："宇宙猫王！"
```

- 猫王塔每层血量重置，2 圣物始终不变
- 消灭后不再出现同一只猫（已击败的不再随机到）
- 称号：社区(1)→街道(2)→城区(3)→城市(4)→省会(5)→大区(6)→王国(7)→大陆(8)→星球(9)→宇宙(10)

---

## 三、数据结构

### 3.1 关卡配置（`data.js` 新增）

```js
var ADVENTURE_STAGES = [
  // 教学关
  { id: 1, bossId: 'catToy', name: '逗猫棒', emoji: '🪄',
    deck: { attack: 50, defend: 50 },
    hp: 50, atk: 5, def: 5, growth: 0,
    cycle: 'atk_def', desc: '基础玩法' },
  { id: 2, bossId: 'cup', name: '水杯', emoji: '🥤',
    deck: { attack: 50, defend: 50, atk_buff: 50, vulnerable: 50 },
    hp: 100, atk: 10, def: 10, growth: 0,
    cycle: 'atk_def', desc: '增伤入门' },
  { id: 3, bossId: 'bee', name: '小蜜蜂', emoji: '🐝',
    deck: { attack: 50, defend: 50, atk_buff: 50, vulnerable: 50, atk_down: 50, def_buff: 50 },
    hp: 100, atk: 20, def: 20, growth: 0,
    cycle: 'atk_def', desc: '防守入门' },
  { id: 4, bossId: 'snake', name: '小蛇', emoji: '🐍',
    deck: { stun: 20, heal: 20, wild: 20 },
    hp: 100, atk: 50, def: 0, growth: 0,
    cycle: 'focus_attack', desc: '进阶博弈' },
  // 第一幕·昆虫序列
  { id: 5, bossId: 'ant', name: '工蚁', emoji: '🐜',
    deck: null,  // null = 标准卡池 DECK_SIZES
    hp: 80, atk: 8, def: 8, growth: 0,
    cycle: 'atk_def', desc: '昆虫序列' },
  // 6-25 后续扩展
];
```

`cycle` 选项：
- `atk_def` → `[{type:'attack'}, {type:'defend', shield: def}]`
- `focus_attack` → `[{type:'focus'}, {type:'attack'}]`
- `atk_def_focus_crit` → 4 回合循环

### 3.2 新增 Boss 配置（`data.js`）

```js
// cup（水杯）、bee（小蜜蜂）、snake（小蛇）、ant（工蚁）
// 白板 Boss，无 traits 无 hpTriggers
cup: {
  id: 'cup', name: '水杯', emoji: '🥤', desc: '教学关Boss·增伤入门',
  maxHP: 100, baseAtk: 10, powerGrowth: 0, startShield: 0,
  cycle: [{ type: 'attack' }, { type: 'defend', shield: 10 }],
  traits: [], hpTriggers: []
},
bee: {
  id: 'bee', name: '小蜜蜂', emoji: '🐝', desc: '教学关Boss·防守入门',
  maxHP: 100, baseAtk: 20, powerGrowth: 0, startShield: 0,
  cycle: [{ type: 'attack' }, { type: 'defend', shield: 20 }],
  traits: [], hpTriggers: []
},
snake: {
  id: 'snake', name: '小蛇', emoji: '🐍', desc: '教学关Boss·进阶博弈',
  maxHP: 100, baseAtk: 50, powerGrowth: 0, startShield: 0,
  cycle: [{ type: 'focus' }, { type: 'attack' }],
  traits: [], hpTriggers: []
},
ant: {
  id: 'ant', name: '工蚁', emoji: '🐜', desc: '昆虫序列·第5关',
  maxHP: 80, baseAtk: 8, powerGrowth: 0, startShield: 0,
  cycle: [{ type: 'attack' }, { type: 'defend', shield: 8 }],
  traits: [], hpTriggers: []
}
```

### 3.3 存档结构（localStorage key: `zhan_save`）

```json
{
  "version": 1,
  "catMao": 250,
  "advUnlocked": 5,
  "bestFloor": 0,
  "mazeFirstKills": [],
  "towerBestFloor": 0,
  "mazeUnlocked": false,
  "towerUnlocked": false
}
```

- `advUnlocked`：猫咪冒险已解锁的关卡数（1~25）
- `mazeFirstKills`：猫猫迷宫中首次击败的猫 Boss id 数组
- `towerBestFloor`：猫王塔最高到达层数
- `mazeUnlocked` / `towerUnlocked`：通关第4关后永久设为 true
- 存档读写：启动时加载 → 全局 `SAVE` 对象 → 关键节点落盘

### 3.4 游戏状态扩展（`G` 对象）

```js
G.mode = 'adventure' | 'maze' | 'tower';  // 当前模式
G.adventureStageId = 1;  // 冒险模式：当前关卡 id（1-25）
G.towerFloor = 0;        // 猫王塔：当前层数
G.towerDefeated = [];    // 猫王塔：本轮已击败的 Boss id
G.towerRelicCount = 0;   // 猫王塔：已抽圣物次数（≤2）
```

---

## 四、代码改动

### 4.1 `data.js`

- **新增** `ADVENTURE_STAGES` 数组
- **新增** 4 个 Boss 配置：`cup`, `bee`, `snake`, `ant`
- **不删** `catToy`, `skeleton`（毛线团），10 只猫猫 Boss 不变

### 4.2 `core.js`

**核心重构：`newGame()` / `_endGame()` / `_startNextStage()`**

```
newGame()
  旧逻辑：读 G.bossId → BOSSES[bossId] → 固定牌组
  新逻辑：根据 G.mode 走不同分支
    - adventure: 读 ADVENTURE_STAGES[id-1] → 自定义牌组
    - maze: 毛线团用 BOSSES.skeleton，猫Boss随机
    - tower: 随机猫Boss，带 isTower 标记

_endGame(win, msg)
  旧逻辑：硬编码 currentStage 1→圣物→2→通关→无尽
  新逻辑：根据 G.mode 走不同分支
    - adventure: 解锁下一关 → 弹窗（继续闯关/返回主页）
    - maze: 毛线团通关→圣物选择→猫Boss；猫Boss通关→返回主页
    - tower: 血量重置→下一只猫→败北/全猫征服

现行 _showRelicSelect / _confirmRelicSelect 保持不变
  迷宫：确认全拿 → 打猫Boss
  冒险：当前关卡暂不用圣物（后续关卡可用）
  猫王塔：第1次抽1个必须选 → 第2次抽1个必须选 → 之后不再弹
```

**新增函数：**
- `saveProgress()` — 写 localStorage
- `loadProgress()` — 读 localStorage，返回 SAVE 对象

**修改函数：**
- `_endGame()` — 重构为模式分发
- `_startNextStage()` — 改为冒险专用（`advGoNext()`）
- `newGame()` — 增加模式参数处理
- `_showRelicSelect()` — 增加猫王塔单选的逻辑

**废弃：**
- `var STAGES = [...]` — 删除
- `ENDLESS_DEFEATED` — 保留给猫王塔用，但换个名字 `TOWER_DEFEATED`
- `_startEndlessNextCat()` — 改为 `_startTowerNextCat()`

### 4.3 `ui.js` — 新增页面渲染

| 函数 | 说明 |
|------|------|
| `renderMainMenu()` | 首页三入口 + 猫毛 + 6 系统图标 |
| `renderStageSelect()` | 5×5 关卡网格 |
| `showResultAdventure()` | 冒险模式通关/败北弹窗 |
| `showResultMaze()` | 迷宫模式结果弹窗 |
| `showResultTower()` | 猫王塔结果弹窗 |

- 现有战斗 UI 渲染完全复用
- 圣物选择 UI 复用（猫王塔增加"必须选1个"约束）

### 4.4 `index.html` — CSS 新增

- 首页布局样式（标题/分割线/按钮/图标/猫毛栏）
- 关卡选择网格样式
- 像素风基础样式（后续可迭代）

### 4.5 不修改

- 战斗结算逻辑（`computeCombos`, `executeTurn`, phase 123）
- Boss trait/hpTriggers 执行引擎
- 牌堆/消除槽渲染
- 圣物系统

---

## 五、状态转换图

```
                    ┌─────────────┐
                    │  首页 Main  │
                    │  3入口+6图标 │
                    └──┬───┬───┬──┘
         ┌─────────────┘   │   └─────────────┐
         ↓                 ↓                 ↓
   ┌──────────┐    ┌──────────┐     ┌──────────┐
   │关卡选择   │    │猫猫迷宫   │     │ 猫王塔   │
   │5×5网格   │    │毛线团→猫  │     │1圣→猫→2圣 │
   └────┬─────┘    └────┬─────┘     └────┬─────┘
        ↓               ↓               ↓
   ┌──────────┐    ┌──────────┐     ┌──────────┐
   │  战斗     │    │  战斗     │     │  战斗     │
   │（复用现有）│    │（复用现有）│     │（复用现有）│
   └────┬─────┘    └────┬─────┘     └────┬─────┘
        ↓               ↓               ↓
   ┌──────────┐    ┌──────────┐     ┌──────────┐
   │ 通关弹窗  │    │ 通关弹窗  │     │ 通关/败北 │
   │继续/主页  │    │返回主页   │     │返回主页   │
   └──────────┘    └──────────┘     └──────────┘
```

---

## 六、确认清单

- [x] 每关通关后都有"继续闯关"和"返回主页"
- [x] 通关第4关后永久解锁猫猫迷宫和猫王塔
- [x] 旧逗猫棒(catToy)复用为冒险第1关
- [x] 旧三关流程(毛线团→猫Boss)改造为猫猫迷宫
- [x] 旧无尽模式改造为猫王塔
- [x] 毛线团无圣物，打过才选
- [x] 迷宫圣物：二选一，分享刷新/广告全拿（和现在一致）
- [x] 猫王塔圣物：第一次随机1个必须选1（只能刷新不能全拿）→ 打第1只猫 → 第二次随机1个（同上）→ 2圣物打到底
- [x] 猫王塔每层血量重置
- [x] 猫王塔已击败的猫不再出现
- [x] 猫王塔称号体系：社区→宇宙猫王
- [x] 6 系统图标纯占位
- [x] 今日最佳暂时"0 层"占位
- [x] 本期奖励逻辑不做，只做首杀记录
- [x] 标准卡池 500 张这次不改
- [x] 首页像素风可以先简单做，后续迭代
