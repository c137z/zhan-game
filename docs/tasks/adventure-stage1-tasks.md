# 猫咪冒险第一阶段 — Task 设计手册 v1.1

> 2026-06-07 | 哈基米 🐱 | v1.1 — 修正 Kimi 审计 3 个严重问题

---

## v1.1 修正记录

| # | 问题 | 修正 |
|:--:|------|------|
| F1 | 猫王塔/迷宫抽到教学Boss | 新增 CAT_BOSS_IDS 白名单，所有随机猫 Boss 的逻辑统一用它 |
| F2 | 第5关通关后"继续闯关"崩溃 | _showNextStage 增加 ADVENTURE_STAGES.length 上限判断 |
| F3 | 重试按钮未模式化 | 新增 _retry() 统一入口，maze→毛线团重来，tower→重新抽圣物 |
| F4 | T3/T4 并行冲突 | 执行顺序改为 T1→T2→T4→T3→T5+T6 |
| F5 | 猫王塔漏了第2次抽圣物 | 第1只猫通关后 towerRelicCount<2 → 抽第2圣物 |

---

## Task 概览

| Task | 名称 | 文件 | 类型 | 依赖 |
|:----:|------|------|:----:|:----:|
| T1 | 新增关卡配置 + 4 Boss + CAT_BOSS_IDS | data.js | DATA | 无 |
| T2 | 新增存档系统 | core.js | CODE | 无 |
| T4 | 重构圣物选择系统（模式化） | core.js + ui.js | CODE | T1 |
| T3 | 重构 newGame / _endGame 三模式分发 | core.js | CODE | T1, T2, T4 |
| T5 | 首屏首页 + 关卡选择 UI | ui.js + index.html | UI | T3 |
| T6 | 战斗结果弹窗改造（三模式） | ui.js + index.html | UI | T3 |

---

## Task 1: 新增关卡配置 + 4 Boss

**文件**: code/data.js
**类型**: DATA（只增加，不修改）

### 1A. 新增 ADVENTURE_STAGES 数组

位置在 DECK_SIZES 定义之后（约第 65 行）：

```js
var ADVENTURE_STAGES = [
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
  { id: 5, bossId: 'ant', name: '工蚁', emoji: '🐜',
    deck: null,  // null = 标准卡池 DECK_SIZES
    hp: 80, atk: 8, def: 8, growth: 0,
    cycle: 'atk_def', desc: '昆虫序列' }
  // 6-25 后续扩展
];
```

cycle 字段规则（在 core.js T3 中解析）：
- atk_def → [{ type:'attack' }, { type:'defend', shield: def }]
- focus_attack → [{ type:'focus' }, { type:'attack' }]

### 1B. 新增 4 个 Boss 配置

插入 BOSSES 对象中，位置在 catToy 之后、skeleton 之前（约第 200 行）：

```js
cup: {
  id: 'cup', name: '水杯', emoji: '🥤',
  desc: '教学关Boss·增伤入门\n攻击10防御10交替循环',
  maxHP: 100, baseAtk: 10, powerGrowth: 0, startShield: 0,
  cycle: [{ type: 'attack' }, { type: 'defend', shield: 10 }],
  traits: [], hpTriggers: []
},

bee: {
  id: 'bee', name: '小蜜蜂', emoji: '🐝',
  desc: '教学关Boss·防守入门\n攻击20防御20交替循环',
  maxHP: 100, baseAtk: 20, powerGrowth: 0, startShield: 0,
  cycle: [{ type: 'attack' }, { type: 'defend', shield: 20 }],
  traits: [], hpTriggers: []
},

snake: {
  id: 'snake', name: '小蛇', emoji: '🐍',
  desc: '教学关Boss·进阶博弈\n蓄力一回合后攻击50',
  maxHP: 100, baseAtk: 50, powerGrowth: 0, startShield: 0,
  cycle: [{ type: 'focus' }, { type: 'attack' }],
  traits: [], hpTriggers: []
},

ant: {
  id: 'ant', name: '工蚁', emoji: '🐜',
  desc: '昆虫序列·第5关\n攻击8防御8交替循环',
  maxHP: 80, baseAtk: 8, powerGrowth: 0, startShield: 0,
  cycle: [{ type: 'attack' }, { type: 'defend', shield: 8 }],
  traits: [], hpTriggers: []
},
```

### 1C. 新增猫 Boss 白名单数组（🔴 F1 修正）

在 BOSSES 定义之后、RELICS 之前新增：

```js
var CAT_BOSS_IDS = ['tabby','sphynx','british_shorthair','american_shorthair',
  'abyssinian','ragdoll','bengal','siamese','scottish_fold','maine_coon'];
```

这个数组是猫王塔和猫猫迷宫中"随机猫 Boss"的唯一数据源。所有 Object.keys(BOSSES).filter(...) 的调用全部改为 CAT_BOSS_IDS.filter(...)。

### 不改动

- catToy / skeleton / 10只猫猫 Boss / DECK_SIZES / RELICS 全部原样保留

---

## Task 2: 新增存档系统

**文件**: code/core.js
**类型**: CODE（新增函数，不修改现有代码）

### 新增：文件顶部（约第 5 行位置）

```js
var SAVE_KEY = 'zhan_save';
var SAVE = null;
```

### 新增函数：放在 Zhan.Engine 定义之前

```js
function loadProgress() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      SAVE = JSON.parse(raw);
      if (!SAVE.mazeFirstKills) SAVE.mazeFirstKills = [];
      if (!SAVE.mazeUnlocked) SAVE.mazeUnlocked = false;
      if (!SAVE.towerUnlocked) SAVE.towerUnlocked = false;
      if (!SAVE.version) SAVE.version = 1;
    } else {
      SAVE = { version: 1, catMao: 0, advUnlocked: 1, bestFloor: 0,
               mazeFirstKills: [], towerBestFloor: 0,
               mazeUnlocked: false, towerUnlocked: false };
    }
  } catch(e) {
    SAVE = { version: 1, catMao: 0, advUnlocked: 1, bestFloor: 0,
             mazeFirstKills: [], towerBestFloor: 0,
             mazeUnlocked: false, towerUnlocked: false };
  }
  return SAVE;
}

function saveProgress() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); }
  catch(e) { /* 静默失败 */ }
}
```

---

## Task 3: 重构 newGame / _endGame 三模式分发

**文件**: code/core.js
**类型**: CODE（重写核心函数）

### 3A. 新增 buildCycle 辅助函数

```js
function buildCycle(cycleType, defVal) {
  if (cycleType === 'atk_def')
    return [{ type: 'attack' }, { type: 'defend', shield: defVal }];
  if (cycleType === 'focus_attack')
    return [{ type: 'focus' }, { type: 'attack' }];
  return [{ type: 'attack' }];
}
```

### 3B. 重写 newGame() (行 904-992)

完整重写。核心变化：
- 根据 G.mode 走不同分支
- adventure: 读 ADVENTURE_STAGES[stageId-1] → buildCycle 生成 cycle
- maze: boss = BOSSES.skeleton（毛线团）
- tower: 随机猫 Boss（排除已击败的，使用 CAT_BOSS_IDS）
- 新增字段：G.mode, G.adventureStageId, G.mazePhase, G.towerFloor, G.towerDefeated, G.towerRelicCount

完整代码见附录 A。

### 3C. 重写 _endGame() (行 1010-1070)

完整重写。三模式分发：
- adventure: 通关→解锁下一关+save→弹窗(继续/返回)；败北→弹窗(重试/返回)
- maze: 毛线团通关→圣物选择；猫Boss通关→首杀记录+弹窗(返回)；败北→弹窗(重试/返回)
- tower: 通关→记录；第1只猫后抽第2圣物；2圣物打到底(血量重置)；败北→称号+弹窗(返回)

完整代码见附录 B。

### 3D. 新增入口函数

```js
// 🔴 F2 修正：所有跳关入口加 ADVENTURE_STAGES.length 上限
Zhan.Engine._startAdventure = function(stageId) {
  if (stageId < 1 || stageId > ADVENTURE_STAGES.length) return;
  if (stageId > (SAVE.advUnlocked || 1)) return;
  if (!Zhan.Engine.state) Zhan.Engine.state = {};
  var st = Zhan.Engine.state;
  st.mode = 'adventure'; st.adventureStageId = stageId; st.activeRelics = [];
  newGame();
};

Zhan.Engine._startMaze = function() {
  if (!Zhan.Engine.state) Zhan.Engine.state = {};
  var st = Zhan.Engine.state;
  st.mode = 'maze'; st.mazePhase = 'yarn'; st.activeRelics = []; st.bossId = 'skeleton';
  newGame();
};

Zhan.Engine._startTower = function() {
  if (!Zhan.Engine.state) Zhan.Engine.state = {};
  var st = Zhan.Engine.state;
  st.mode = 'tower'; st.towerFloor = 0; st.towerDefeated = []; st.towerRelicCount = 0;
  Zhan.Engine._showRelicSelect('tower');
};

Zhan.Engine._adventureNext = function() {
  var st = this.state;
  var nextId = (st.adventureStageId || 0) + 1;
  if (nextId > ADVENTURE_STAGES.length) return;         // 🔴 F2
  if (nextId > SAVE.advUnlocked) return;
  st.adventureStageId = nextId;
  newGame();
};

// 🔴 F3 修正：统一重试入口（替换原来的 _adventureRetry）
Zhan.Engine._retry = function() {
  var st = this.state;
  if (st.mode === 'maze') {
    st.mazePhase = 'yarn';
    st.bossId = 'skeleton';
    st.activeRelics = [];
    newGame();
  } else if (st.mode === 'tower') {
    st.towerFloor = 0;
    st.towerDefeated = [];
    st.towerRelicCount = 0;
    st.activeRelics = [];
    Zhan.Engine._startTower();  // 重新走抽圣物流程
  } else {
    newGame();
  }
};
```

### 3E. 删除

- var STAGES = [...] — 删除
- ENDLESS_DEFEATED — 删除
- _startEndlessNextCat() — 替换为 _startTowerNextCat()

---

## Task 4: 重构圣物选择系统（模式化）

**文件**: code/core.js + code/ui.js
**类型**: CODE

### 4A. core.js — _showRelicSelect() 增加模式参数

```js
Zhan.Engine._showRelicSelect = function(relicMode) {
  var st = this.state;
  if (!st) return;
  st.relicRerolls = 0;
  st.selectedRelic = null;
  st.relicMode = relicMode || 'maze';  // 'maze'=全拿, 'tower'=单选
  var allRelicIds = Object.keys(RELICS);
  shuffleArray(allRelicIds);
  st.relicOptions = allRelicIds.slice(0, 2);
  if (Zhan.UI && Zhan.UI.renderRelicSelect) Zhan.UI.renderRelicSelect(st);
};
```

### 4B. core.js — _confirmRelicSelect() 模式分发

- maze 模式：全拿 2 个圣物 → _startMazeCatBoss()
- tower 模式：只拿选中的 1 个（必须先选）→ towerRelicCount++ → 战斗

### 4C. core.js — 新增 _startMazeCatBoss()

```js
// F1 修正：使用 CAT_BOSS_IDS 白名单
Zhan.Engine._startMazeCatBoss = function() {
  var st = this.state;
  var bossId = CAT_BOSS_IDS[Math.floor(Math.random() * CAT_BOSS_IDS.length)];
  st.bossId = bossId; st.mazePhase = 'cat'; st.playerHP = st.playerMaxHP; st.playerShield = 0;
  log('🐱 ' + BOSSES[bossId].name + ' ' + BOSSES[bossId].emoji + ' 出现了！');
  newGame();
};
```

### 4D. ui.js — renderRelicSelect() 根据 relicMode 改 UI

- tower 模式：描述文字"选择1个圣物"，按钮"确认选择"（需先选才启用，"全拿"不出现）
- maze 模式：原有逻辑不变
- tower 模式圣物卡片可点击选中（点击高亮，取消其他选中）

---

## Task 5: 首屏首页 + 关卡选择 UI

**文件**: code/ui.js + code/index.html
**类型**: UI

### 5A. index.html — 新增 DOM 结构

在 <div id="app"> 内部最前面插入：

1. <div id="main-menu"> — 首页容器
   - #menu-title: "斩" 大字
   - .menu-divider: 虚线分割
   - #menu-best: "今日最佳：0层"
   - .menu-btn x3: 猫咪冒险/猫猫迷宫/猫王塔（每个含 icon + title + sub）
   - .menu-divider: 第二道分割
   - #menu-catmao: 猫毛显示
   - #menu-icons: 6 系统图标占位（2x3 grid）

2. <div id="stage-select"> — 关卡选择容器（默认隐藏）
   - #stage-select-header: 返回按钮 + 标题
   - #stage-grid: 5x5 网格

3. 现有战斗界面包进 <div id="battle-view">

### 5B. index.html — 新增 CSS

- 首页样式（标题/分割线/入口按钮/猫毛/系统图标）
- 关卡选择网格样式
- 首页默认展示、关卡选择默认隐藏

### 5C. ui.js — 新增渲染函数

```js
Zhan.UI.renderMainMenu()
Zhan.UI.renderStageSelect()
```

- renderMainMenu: 显示首页、隐藏其他、刷新猫毛/最佳/解锁状态
- renderStageSelect: 显示关卡网格、5x5、已解锁可点击、锁着灰掉

### 5D. ui.js — 事件绑定

- #btn-adventure click → Zhan.UI.renderStageSelect()
- #btn-maze click → 检查档案解锁 → Zhan.Engine._startMaze()
- #btn-tower click → 检查档案解锁 → Zhan.Engine._startTower()
- #btn-back-menu click → Zhan.UI.renderMainMenu()

---

## Task 6: 战斗结果弹窗改造（三模式）

**文件**: code/ui.js + code/index.html
**类型**: UI

### 6A. index.html — result-overlay 改按钮

删除旧按钮: #btn-restart, #btn-endless, #btn-reset

新增三个按钮:
```html
<button id="btn-result-next">➡️ 继续闯关</button>
<button id="btn-result-retry">🔄 重试</button>
<button id="btn-result-home">🏠 返回主页</button>
```

### 6B. ui.js — 修改 showResult()

根据 G._showNextStage 控制"继续闯关"/"重试"按钮显隐。"返回主页"始终显示。

### 6C. ui.js — 事件绑定

- #btn-result-next → Zhan.Engine._adventureNext()
- #btn-result-retry → Zhan.Engine._retry()    // 🔴 F3 修正
- #btn-result-home → Zhan.UI.renderMainMenu()

---

## 执行顺序（v1.1 修正）

```
T1 (DATA) → T2 (SAVE) → T4 (圣物模式化) → T3 (核心重构) → T5+T6 (UI)
```

F4 修正：T3 依赖 T4 的 _showRelicSelect('tower') 参数支持，必须先合 T4 再合 T3。

---

## 附录 A: newGame() 完整伪代码（v1.1）

```js
function newGame() {
  var mode = G.mode || 'adventure';
  var boss, relics;

  if (mode === 'adventure') {
    var sid = G.adventureStageId || 1;
    var stage = ADVENTURE_STAGES[sid - 1];
    boss = JSON.parse(JSON.stringify(BOSSES[stage.bossId]));
    boss.cycle = buildCycle(stage.cycle, stage.def || 0);
    boss.maxHP = stage.hp; boss.baseAtk = stage.atk;
    boss.powerGrowth = stage.growth || 0;
    relics = G.activeRelics || [];
  } else if (mode === 'maze') {
    boss = JSON.parse(JSON.stringify(BOSSES.skeleton));
    relics = [];
  } else if (mode === 'tower') {
    // F1: 使用 CAT_BOSS_IDS 白名单
    var cats = CAT_BOSS_IDS.filter(function(k) {
      return G.towerDefeated.indexOf(k) === -1;
    });
    boss = JSON.parse(JSON.stringify(BOSSES[cats[Math.floor(Math.random() * cats.length)]]));
    relics = G.activeRelics || [];
  } else {
    boss = JSON.parse(JSON.stringify(BOSSES[G.bossId || 'skeleton']));
    relics = G.activeRelics || [];
  }

  // 构建 G 对象
  var stageId = G.adventureStageId || null;
  G = {
    mode: mode, adventureStageId: stageId,
    deck: [], piles: [], slot: [],
    playerHP: CONFIG.PLAYER_MAX_HP, playerMaxHP: CONFIG.PLAYER_MAX_HP,
    playerShield: 0,
    enemyHP: boss.maxHP, enemyMaxHP: boss.maxHP,
    enemyShield: boss.startShield || 0,
    power: boss.baseAtk, turn: 0, phase: 'player',
    pickedId: 0, logLines: [], over: false,
    playerEffects: {}, enemyEffects: {},
    bossId: boss.id, boss: boss,
    activeRelics: relics,
    effectiveMinCombo: CONFIG.MIN_COMBO,
    effectiveSlotSize: CONFIG.SLOT_SIZE,
    effectiveAtkBuffMult: 0, atkBuffMult: CONFIG.ATK_BUFF_MULT,
    vulnMult: CONFIG.VULN_MULT, defBuffRatio: CONFIG.DEF_BUFF_RATIO,
    effectiveVulnMult: 0, buffDurationBonus: 0,
    deckConfig: null,
    lockedPiles: {}, lockedSlots: {}, smearedPiles: {},
    hideIntent: false, playerSkipped: false,
    currentStage: 1, maxCombo: 0, maxDamage: 0, totalDamage: 0,
    activeRelicNames: relics.map(function(r) { return (RELICS[r]&&RELICS[r].name)||r; }),
    isEndless: false,
    mazePhase: G.mazePhase || 'yarn',
    towerFloor: G.towerFloor || 0,
    towerDefeated: G.towerDefeated || [],
    towerRelicCount: G.towerRelicCount || 0
  };

  if (mode === 'adventure') {
    var stage = ADVENTURE_STAGES[stageId - 1];
    G.deckConfig = stage.deck ? JSON.parse(JSON.stringify(stage.deck))
                               : JSON.parse(JSON.stringify(DECK_SIZES));
  } else {
    G.deckConfig = JSON.parse(JSON.stringify(DECK_SIZES));
  }

  Zhan.Engine.state = G;
  Zhan.Systems.Relic.applyInit(G);
  G.playerHP = G.playerMaxHP;

  if (boss.hpTriggers && boss.hpTriggers.indexOf('hiss') >= 0) {
    G.hissPrevHP = boss.maxHP;
  }

  Zhan.Engine._buildDeck();
  if (boss.traits) {
    for (var bi = 0; bi < boss.traits.length; bi++) {
      if (boss.traits[bi].id === 'hide_intent') { G.hideIntent = true; break; }
    }
  }
  if (G.specialCards) {
    for (var sc = 0; sc < G.specialCards.length; sc++) {
      G.deck.unshift({ type: G.specialCards[sc].type, id: G.pickedId++, special: G.specialCards[sc] });
    }
    log('🪶 救命毫毛！获得' + G.specialCards.length + '张特殊卡');
  }
  shuffle(G.deck);
  Zhan.Engine._buildPiles();
  Zhan.Engine._updateEffectiveFury(G);
  Zhan.Engine._updateEnemyIntent();
  if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(G);
  log('🐱 新局开始！');
}
```

---

## 附录 B: _endGame() 完整伪代码（v1.1）

```js
Zhan.Engine._endGame = function(win, msg) {
  var st = this.state;
  if (!st) return;
  st.over = true; st.phase = 'over'; st.win = win;
  if (Zhan.UI && Zhan.UI.render) Zhan.UI.render(st);

  var mode = st.mode || 'adventure';

  if (mode === 'adventure') {
    if (win) {
      var sid = st.adventureStageId;
      if (sid >= SAVE.advUnlocked) SAVE.advUnlocked = sid + 1;
      if (sid === 4) { SAVE.mazeUnlocked = true; SAVE.towerUnlocked = true; }
      saveProgress();
      st._resultTitle = '✨ 通关！';
      st._resultDesc = st.boss.emoji + ' ' + st.boss.name + ' 已被击败';
      // F2: 第5关通关后不显示"继续闯关"
      st._showNextStage = sid < ADVENTURE_STAGES.length;
      Zhan.UI.showResult(st);
    } else {
      st._resultTitle = '💀 败北';
      st._resultDesc = msg + '（存活' + st.turn + '回合）';
      st._showNextStage = false;
      Zhan.UI.showResult(st);
    }
  }

  else if (mode === 'maze') {
    if (win) {
      if (st.mazePhase === 'yarn') {
        st.mazePhase = 'cat';
        Zhan.Engine._showRelicSelect('maze');
        return;
      } else {
        var catId = st.bossId;
        if (SAVE.mazeFirstKills.indexOf(catId) === -1) {
          SAVE.mazeFirstKills.push(catId); saveProgress();
        }
        st._resultTitle = '🧶 猫猫迷宫通关！';
        st._resultDesc = st.boss.emoji + ' ' + st.boss.name + ' 已被击败';
        st._showNextStage = false;
        Zhan.UI.showResult(st);
      }
    } else {
      st._resultTitle = '💀 败北';
      st._resultDesc = msg + '（存活' + st.turn + '回合）';
      st._showNextStage = false;
      Zhan.UI.showResult(st);
    }
  }

  else if (mode === 'tower') {
    if (win) {
      st.towerDefeated.push(st.bossId);
      st.towerFloor = (st.towerFloor || 0) + 1;
      if (st.towerFloor > (SAVE.towerBestFloor || 0))
        { SAVE.towerBestFloor = st.towerFloor; saveProgress(); }
      // F1: 使用 CAT_BOSS_IDS 白名单
      var allCats = CAT_BOSS_IDS;
      var allDone = allCats.every(function(id)
        { return st.towerDefeated.indexOf(id) !== -1; });
      if (allDone) {
        st._resultTitle = '🌌 宇宙猫王！';
        st._resultDesc = '全部 10 只猫 Boss 已被征服！';
        st._showNextStage = false;
        Zhan.UI.showResult(st);
        return;
      }
      // F5 修正：第1只猫通关后，先抽第2个圣物
      if (st.towerRelicCount < 2) {
        Zhan.Engine._showRelicSelect('tower');
        return;
      }
      Zhan.Engine._startTowerNextCat();
    } else {
      var titles = ['社区猫王','街道猫王','城区猫王','城市猫王',
                     '省会猫王','大区猫王','王国猫王','大陆猫王',
                     '星球猫王','宇宙猫王'];
      var t = titles[Math.min(st.towerFloor || 0, 9)];
      st._resultTitle = '💀 塔顶坠落';
      st._resultDesc = '称号：' + t + ' | 击败 ' + (st.towerFloor||0) + ' 只猫';
      st._showNextStage = false;
      Zhan.UI.showResult(st);
    }
  }
};

Zhan.Engine._startTowerNextCat = function() {
  var st = this.state;
  // F1: 使用 CAT_BOSS_IDS 白名单
  var cats = CAT_BOSS_IDS.filter(function(k)
    { return st.towerDefeated.indexOf(k) === -1; });
  if (!cats.length) { Zhan.Engine._endGame(true, '全猫征服！'); return; }
  var bid = cats[Math.floor(Math.random() * cats.length)];
  st.bossId = bid; st.playerHP = st.playerMaxHP; st.playerShield = 0;
  log('👑 猫王塔·第' + (st.towerFloor + 1) + '层 — ' + BOSSES[bid].name + ' ' + BOSSES[bid].emoji);
  newGame();
};
```
