# 斩 ⚔️ — AGENTS.md

> 项目级工作流入口。继承 `system/execution.md` 六步协议，适配 MSP 桥接执行层。

## ⚠️ 工作目录

**斩项目的绝对路径：`C:\Users\kyzha\.openclaw\projects\zhan\`**

工具调用时所有文件路径必须使用此绝对路径，不得使用相对路径。
`workspace/projects/zhan/` 是过时的旧副本，忽略它。

---

## 项目技术概览

| 项 | 值 |
|----|-----|
| 技术栈 | 纯 HTML/CSS/JS（当前原型），计划迁移 Unity 2D |
| 源码 | `projects/zhan/code/` 目录（多文件）<br>`data.js` (11KB) · `core.js` (45KB) · `ui.js` (21KB) · `index.html` (32KB)<br>发布版：`projects/zhan/zhan_v2.1.html` |
| 命名空间 | `window.Zhan` |
| 架构约束 | data.js 禁止 function（polyfill 除外）、core.js 禁止 DOM、ui.js 禁止直接改 state |
| **上下文隔离** | AI 助手在生成 task 时，**优先以 code/ 下的实际代码为准**。docs/design/overview.md 仅作设计蓝图参考，**不可作为"已实现功能"的依据**。 |

---

## MSP 桥接工作流

斩项目的所有代码修改走 MSP（Multi-agent Scheduling Protocol）。

### 角色

| 角色 | 承载主体 | 职责 |
|------|---------|------|
| **Scheduler** | 哈基米（OpenClaw） | 翻译需求 → task JSON、投递 inbox、审阅结果、派 Verifier、派 Playwright task、运行 Playwright 脚本、汇报 |
| **执行层** | Bridge（node 进程） | 任务路由、备份、Worker 适配、Worker 调用、结果封装、自动 Diff |
| **Worker** | Claude Code CLI（默认） | 改代码、写 Playwright 测试脚本 |

Worker 不是固定的——未来可替换为 Gemini CLI / Codex 等兼容 Agent。

### 协议

Scheduler ↔ 执行层之间通过 **task/result JSON** 通信，不使用自然语言。

### 目录结构

```
projects/zhan/
├── code/          ← 源文件（CC CLI 修改位置）
│   ├── data.js
│   ├── core.js
│   ├── ui.js
│   └── index.html
├── msp/           ← MSP 执行层
│   ├── bridge.js
│   ├── .cc-session-id  ← Session Resume UUID
│   ├── inbox/     ← task JSON 投递处（CODE_EDIT / TEST_SCRIPT）
│   ├── outbox/    ← result JSON + .notify marker
│   └── archive/   ← 历史 task + backup + prompts
├── tests/         ← Playwright 测试
│   ├── scripts/   ← Worker 写的测试脚本（verify-*.js）
│   ├── reports/   ← 测试报告（Markdown）
│   ├── screenshots/ ← 测试截图
│   └── fixtures/  ← 基线版本快照
├── context/       ← 工作文档（bug-list, spec, token-analysis）
├── docs/          ← 设计文档（overview.md 为权威蓝图）
├── archive/       ← 历史归档 + self-check.js
├── zhan_v2.1.html ← 发布版
└── AGENTS.md      ← 本文件
```

### Bridge 启动

```bash
node projects/zhan/msp/bridge.js
```

- 后台常驻，**fs.watch 监控 inbox/**（即时触发，非轮询）
- 使用 CC CLI **Session Resume**（`-r <uuid>` 复用 session，避免重复加载）
- 若 CC CLI session 失效，Bridge 检测 stderr 含 "Invalid session" 后自动删除 `.cc-session-id`，下一轮重建
- 崩溃后恢复：需手动重启 Bridge，inbox 中旧 task 需重新投递

---

## Session Resume 规范

- Bridge 为 CC CLI 分配 UUID session，通过 `-r <uuid>` 复用
- 若 `-r` 失败（stderr 含 "Invalid session"），自动删除 `.cc-session-id`，下一轮新建
- 复用效果：首次 task 加载上下文，后续 task 命中缓存
- Bridge 日志每行含 `session:` 前缀可追踪消耗

---

## CHECK → PLAN → EXECUTE → VERIFY → PLAYWRIGHT → COMMIT（MSP 适配版）

### ① CHECK

**哈基米做：**
- 确认 bug 存在于当前文件
- 确认目标文件路径
- 评估风险（是否涉及 data.js / 多文件同步 / 架构变更）

### ② PLAN

**哈基米做：**
- 把需求翻译成 task JSON — **必须精确到函数+位置，不要只描述意图**：
  - `file`：指定文件（如 `code/core.js`）
  - `function`：所在函数名（如 `computeCombos`）
  - `location`：逻辑位置描述（如"连击倍率计算段"）
  - `change`：旧值→新值（如 `1.5 → 2.0`），而非"修复伤害计算"
  - `forbidden`：不能碰什么（如"不要改 ui.js"、"不要改 data.js"）
- **批量打包原则**：改同一个文件的多个修改合并成一个 task（省 token，CC CLI 只读一次文件）
- 投递到 `msp/inbox/task-{id}.json`
- **每次投递 task 后必须立即创建自检轮询**。**自检确认 task DONE 之后**，再派 Verifier。

### ③ EXECUTE

**执行层（Bridge → Worker）自动完成：**
- Bridge 扫描 inbox → 备份 relatedFiles → 生成 Worker prompt → spawn Worker
- Worker 修改文件 → 输出 diff
- Bridge 生成 autoDiff → 写 outbox/result.json → 归档 task

**哈基米不写代码。** 所有代码修改走 MSP 执行层。

### ④ VERIFY（代码级验证）

**哈基米做（Scheduler 审阅）+ Verifier 独立验证（双重卡口）：**

**Scheduler 审阅：**
1. 读 `msp/outbox/result-{id}.json`
2. **机械验证**：autoDiff 确认改了什么、改了哪里
3. **语义验证**：stdout + testCases 逐条对照

**Verifier 独立验证（必须）：**
- 用 `sessions_spawn` 派独立 subagent 做 Verifier
- Verifier 做机械检查（文件存在、括号闭合、关键函数存在、testCases 逐条对照）
- Verifier **只验证不改代码**，输出 PASS/FAIL 报告
- 注意：Verifier 和自检提醒是**不同的东西**，不要混淆

**最终判定：**
- Scheduler 审阅 PASS + Verifier PASS → 进入 ④.5 PLAYWRIGHT
- 任一 FAIL → 标记 REJECT，投递修正 task

### ④.5 PLAYWRIGHT（浏览器端回归测试）

> ⚠️ Verifier PASS 后、COMMIT 前，必须通过 Playwright 浏览器端回归测试。

#### 步骤 A：投递 TEST_SCRIPT task

Scheduler 写 Playwright task JSON（`body.type: "TEST_SCRIPT"`），投递到 `msp/inbox/`：

- **description**：描述要验证的视觉/交互场景（页面加载、CSS 样式、DOM 元素、交互行为）
- **target**：`tests/scripts/<脚本名>.js`
- **context.relatedFiles**：`["tests/scripts/", "tests/fixtures/"]`
- **spec.testCases**：浏览器端验收标准（如"卡牌区域可见"、"label 白底黑字"）

投递后创建自检 cron（同代码 task 的 3 分钟轮询）。

#### 步骤 B：Worker 写脚本

Bridge + Worker 自动完成：
- Worker 写 Playwright 脚本到 `tests/scripts/`
- 脚本格式参考现有 `tests/scripts/verify-*.js`：headless Chrome + playwright 库
- Worker 输出 TASK_DONE 标记

#### 步骤 C：Scheduler 运行脚本

自检确认 DONE → Scheduler 运行：`node tests/scripts/<脚本名>.js`
- 产出 Markdown 报告到 `tests/reports/`
- 截图到 `tests/screenshots/`

#### 步骤 D：Scheduler 审阅报告

- 全部 PASS → 进入 ⑤ COMMIT
- 存在 FAIL → 文档化问题，投递修正 task 回到 ②，或汇报老大决策

### ⑤ COMMIT

**哈基米做：**
- `git add` + `git commit -m "fix: xxx"`
- 写入 `memory/YYYY-MM-DD.md` 日志

**COMMIT 触发条件（硬性）：**
- 每次 VERIFY PASS + PLAYWRIGHT PASS 后**立即 commit**，不等、不攒、不跳过
- 每次会话结束前 `git status` 确认无未提交改动
- Scheduler 自己的文档修改（如 AGENTS.md、context/ 文档）同样适用——改完就 commit

---

## MSP 自检轮询 + Verifier 规范

### 3.1 自检轮询（硬性执行）

每次投递 task JSON 后，**必须立即**创建 3 分钟循环自检 cron（最多轮询 20 次 = 60 分钟上限）：

```
cron add {
  name: "zhan-check-{taskId}",
  schedule: { kind: "every", everyMs: 180000 },
  maxRuns: 20,
  sessionTarget: "current",
  deleteAfterRun: true,
  payload: {
    kind: "agentTurn",
    message: "【自检】查 task-{taskId} result。路径 outbox/result-{taskId}.json。DONE→审阅+派Verifier→飞书汇报[DONE]。PENDING→查 bridge.log→飞书汇报进度。FAILED→飞书汇报错误。",
    timeoutSeconds: 120
  },
  delivery: {
    mode: "announce",
    channel: "feishu",
    to: "user:ou_49d202fa4c333fb6564c64792fa6caf1"
  }
}
```

关键点：
- `maxRuns: 20`（最多 60 分钟）— 超时自动停止，防止 Bridge 故障时飞书被刷爆
- `every: 180000`（3 分钟）+ `sessionTarget: "current"` + `delivery.announce` 到飞书
- `deleteAfterRun: true` — DONE/FAILED 后自删
- 触发后：查 result → DONE → 审阅 + 派 Verifier → 飞书汇报（标题含 [DONE]）
- 若是 TEST_SCRIPT task：DONE → 运行 Playwright 脚本 → 审阅报告 → 飞书汇报

### 3.2 Verifier

**定义**：Verifier 是独立 subagent，task DONE 后由 Scheduler 派发。

**创建时机**：自检确认 task DONE → sessions_spawn 派 Verifier。

**Verifier 职责**：
- 只做机械检查：文件存在、括号闭合、函数完整性、testCases 逐条对照
- **只验证，不改代码**
- 输出 PASS/FAIL 报告

---

## 故障排查

### Bridge 没反应？

1. 检查 Bridge 是否存活：`tasklist | findstr node` 看是否有 bridge.js 的 node 进程
2. 检查 inbox 是否有积压任务：`dir projects\zhan\msp\inbox`
3. 检查 bridge.log 最后写入时间
4. 如果 Bridge 死了，重启：`node projects\zhan\msp\bridge.js`
5. **重启后旧任务会自动 ABORTED**——需要重新投递任务

### Claude Code 进程残留

Bridge 启动时会自动 `taskkill /F /IM claude.exe` 清理残留进程。如果 Bridge 运行期间 claude 进程 hang 住，手动清理：`taskkill /F /IM claude.exe`

### 卡牌不显示（常见复发 bug）

**症状**：浏览器打开页面，游戏界面正常但卡牌区域为空。

**根因**：`newGame()` 启动脚本在 `ui.js` 加载前执行，`Zhan.UI` 未定义，render 被跳过。

**触发条件**：拆分/合并 script 块时，启动脚本被放到了 ui.js 之前的 script 块里。

**正确加载顺序**：`data.js → core.js → ui.js → 启动脚本(newGame) + Test`

**修法**：确保 `newGame()` 在 ui.js **之后**执行。单文件版本中启动脚本必须是最后一个 `<script>` 块。多文件版本中启动脚本放在 `index.html` 的 `<script src="ui.js"></script>` 之后的内联标签中。

**验证**：F12 Console 不应有 `Zhan.UI is undefined`。

### Session 复用失败（task 执行时间突然回到首次水平）

**症状**：之前 task 14s 完成，突然又回到 24s+。
**根因**：CC CLI session 失效（崩溃、OOM、被 taskkill），`-r` 失败，实际从头开始。
**排查**：
1. 检查 `msp/.cc-session-id` 是否存在
2. 检查 bridge.log 是否有 `session:` 日志行
3. 若有报错，Bridge 应已自动删除旧 session 文件并重建
4. 若无自动恢复，手动删 `.cc-session-id` 并重启 Bridge

---

## Worker 适配说明

当前 Worker = Claude Code CLI（`@anthropic-ai/claude-code` v2.1.160），硬编码在 bridge.js 中。

换用其他 Worker 需要：
1. 重写 bridge.js 的 `spawn` 调用（CLI 接口不同）
2. 重写 `buildPrompt` 模板（prompt 格式要求不同）
3. 重新定义退出判定规则

task/result 协议不变。不要为"未来可能的 Worker"提前抽象——等真有第二个 Worker 时再做。
