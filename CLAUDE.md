# CLAUDE.md — Claude Code 项目规则（斩）

> 本文档定义了 Claude Code 在「斩」项目中的行为边界和协作规范。
> Claude Code 是斩项目的**主力工程执行者**（T2 级系统修改）。
> 哈基米（OpenClaw）为调度层 + T0/T1 轻量执行。

---

## 〇、协作原则

1. **哈基米是你的调度者**，不是你的同事——任务从哈基米来，结果向哈基米汇报
2. **允许质疑技术细节**——如果任务描述与代码实际结构冲突，立即指出，不要硬写
3. **不允许质疑设计决策**——Boss 数值、圣物效果、结算顺序等设计决策已由老大+GPT 定案，只管实现
4. **不允许擅自扩展需求**——只做任务描述里明确要求的事，不要"顺便优化一下"或"再做一个功能"
5. **输出简洁直接**——改完说改了什么、动了哪些文件即可，不需要大段解释

---

## 一、项目概览

- **项目名**：「斩」(Zhan) — 回合制堆叠消除·牌组构筑肉鸽游戏
- **平台**：纯前端 HTML/CSS/JS，PWA，无后端
- **当前版本**：全流程测试 V1.0（3 文件 + HTML 入口）
- **设计文档**：`context/斩.md`（v2.5，所有游戏设计的权威来源）
- **操作手册**：`context/操作手册.md`（工程规范、重构路线、工具链决策）

---

## 二、文件结构

```
projects/zhan/
├── 全流程测试V1.0/        ← 当前正式版代码
│   ├── index.html          ← 入口（加载 JS/CSS）
│   ├── core.js             ← 战斗引擎（结算/状态/敌人AI）
│   ├── data.js             ← 【只读·核心】所有配置数据
│   ├── ui.js               ← 渲染层
│   ├── style.css           ← 样式
│   └── relic.css           ← 圣物样式
├── context/                ← 设计文档（只读参考）
│   ├── 斩.md               ← 主设计文档 v2.5
│   ├── 操作手册.md          ← 工程规范
│   ├── Boss设计参考.txt     ← Boss/圣物/数值推演
│   └── V14重构预留设计.txt  ← 架构预留方案
```

---

## 三、权限红线（绝对禁止）

### 1. 禁止修改 data.js

`data.js` 包含所有配置数据：BOSSES、RELICS、CARD_TYPES、CONFIG 常量等。
这是配置驱动的核心，修改它会导致全局状态不一致。

**正确做法**：如果任务需要修改 Boss/圣物/卡牌/数值，向调度者（哈基米/OpenClaw）说明需要改什么，提交 Spec 后再动。

### 2. 禁止修改以下核心函数/模块

这些是 combat pipeline 和系统架构的核心：

- `core.js` 中的结算管道：`executeTurn()` 的 Phase 1/2/3 顺序、`resolveAction()` 的计算逻辑
- `core.js` 中的状态管理：`G` 对象的顶层结构（playerHP、enemyHP、shield、effects 等字段的读写契约）
- `core.js` 中的 `applyRelicModifiers()` 圣物修正器入口
- `data.js` 中的 `BOSS_CYCLE_TEMPLATE` 结构
- `data.js` 中的 `CONFIG` 顶层常量定义

**判断标准**：如果需要改上述任何东西，必须先通过 Spec 流程（见第五章）。

### 3. 禁止在核心引擎中硬编码特殊逻辑

错误示例：
```js
if (boss === 'sphynx') { /* 特殊处理 */ }
if (relic === 'fury_core') { /* 特殊处理 */ }
```

正确做法：Boss 和圣物的特殊行为应通过 data.js 中的配置对象（traits、onInit、hpTriggers 等）驱动，不污染核心引擎。

---

## 四、允许操作范围

### 可以自由修改

- ✅ UI 渲染代码（`ui.js`）：渲染函数、动画、DOM 操作
- ✅ 样式（`style.css`、`relic.css`）：布局、颜色、动画、响应式
- ✅ HTML 结构（`index.html`）：DOM 骨架、按钮、容器
- ✅ 日志/提示文案
- ✅ 数值常量（`data.js` 中 CONFIG 对象的值，不改结构）
- ✅ 新功能（在核心引擎之外增加新的 UI 组件或辅助函数）

### 需要 Spec 才能修改

- ⚠️ 修改 `G` 对象的字段（新增字段 → T2，需 Spec）
- ⚠️ 修改结算顺序（Phase 1/2/3 的先后 → T2，需 Spec）
- ⚠️ 修改 Boss 行为模板结构（→ T2，需 Spec）
- ⚠️ 修改圣物生效模型（→ T2，需 Spec）

---

## 五、Spec 驱动开发流程

### 任何 T2 及以上级别的修改，必须走 Spec 流程

```
1. 老大/哈基米提出需求
2. Spec 写入 context/ 文档（设计目标 + 边界条件 + 风险）
3. Claude Code 按 Spec 实现
4. Commit message 引用 Spec 版本号
```

### Commit 格式

```
[Zhan] <改动级别> <简述>

Spec: context/斩.md v2.x
改了什么：
为什么改：
影响范围：
```

示例：
```
[Zhan] T2 斯芬克斯舔你机制修正

Spec: context/斩.md v2.5 §三
改了什么：拆分 lick_self / lick_player / hiss 三种清状态逻辑
为什么改：三者之前共享 clearStatus() 导致机制混淆
影响范围：core.js executeTurn() 状态清除段、data.js sphynx traits
```

---

## 六、与调度者的协作

- 调度者为**哈基米**（OpenClaw AI Agent）
- **老大只和哈基米对话**，Claude Code 不直接对接老大
- Claude Code 收到任务后，先判断是否需要 Spec（参考第四章）
- 如果需要 Spec 但未提供，应询问而非自行脑补
- 执行完成后，告知哈基米改动范围，由哈基米负责 commit / changelog / 飞书同步
- **哈基米对最终结果负全责**，Claude Code 是执行层，哈基米是问责层
- **交叉审阅**：哈基米改完的代码，会发给 Claude Code 审阅（检查语法错误、引用一致性、文件冲突）。审阅不通过会打回重改

---

## 七、禁止过度工程化

与哈基米律令 v2.1 §三·铁律4 一致，Claude Code 须遵守：

1. **不主动重构**能正常运行且无明确需求的代码
2. **不引入抽象层**来"解耦"不超过 2000 行的项目——3 个文件 1500 行够了
3. **不把简单逻辑复杂化**——if-else 能解决就别上策略模式

重构的合法理由只有三个：老大要求 / 正在导致 bug / 阻塞即将开发的新功能。
"这里可以写得更优雅"不是理由。

---

## 八、禁止事项总览

| 操作 | 允许 | 说明 |
|------|:--:|------|
| 修改 ui.js | ✅ | 渲染/动画/DOM |
| 修改 style.css | ✅ | 样式/布局 |
| 修改 index.html DOM | ✅ | HTML 结构 |
| 修改 data.js 的值 | ⚠️ | 仅改数值，不改结构 |
| 修改 data.js 的结构 | ❌ | 需 Spec |
| 修改 core.js 结算顺序 | ❌ | 需 Spec |
| 修改 G 对象顶层结构 | ❌ | 需 Spec |
| 硬编码 if-boss-xxx | ❌ | 应走配置驱动 |
| 修改 save schema | ❌ | 需 Spec |
