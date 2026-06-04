# 斩项目 — 当前结构与风险报告

> 2026-06-05 01:11 梳理

---

## 当前结构

```
projects/zhan/                    ← 唯一正式工作区
├── zhan_v2.1.html                ← 最新发布版（v2.0 架构 + 4 bug 修复）
├── zhan_v1.99_sprint4.html       ← 冻结版备份
├── code/                         ← 源文件
│   ├── data.js    (11KB)         ← 纯数据（CONFIG/BOSSES/RELICS/etc）
│   ├── core.js    (45KB)         ← 引擎（Zhan.Rules/Engine/Systems/Test）
│   ├── ui.js      (21KB)         ← 渲染 + DOM（Zhan.UI）
│   └── index.html (32KB)         ← HTML 骨架 + script src + 启动+Test
├── msp/                          ← MSP 执行层
│   ├── bridge.js  (11KB)         ← Bridge（fs.watch + Session Resume + notify）
│   └── archive/                  ← 历史 backup + prompts
├── context/                      ← 工作文档
│   ├── bug-list.md               ← 当前 bug 清单（4 个，已修完）
│   ├── config-classification.md  ← CONFIG 分类（26 改 / 27 保留）
│   ├── step2-spec.md             ← Step 2 还债规范（已完成）
│   └── token-analysis.md         ← Token 消耗分析
├── docs/                         ← 设计文档
│   ├── design/overview.md        ← **最新设计手册（权威）**
│   └── sprint-review-v1.95-v1.99.md
├── archive/                      ← 历史归档
│   ├── housekeeping.md           ← 整理日志
│   └── html_snapshots/           ← 旧版 HTML
└── AGENTS.md                     ← **工作流核心规范**
```

---

## 基础设施状态

| 组件 | 状态 | 备注 |
|------|------|------|
| Bridge | ✅ 运行 (fs.watch + Session Resume) | PID 随重启变 |
| CC CLI | ✅ 用 `-r` 复用 session | 非 thinking 模式 |
| 自检轮询 | ⚠️ 规范已有，未实际用 | 上次搬家后自检 cron 失效 |
| notify marker | ✅ | Bridge 写 `.notify` 文件 |
| Verifier | ✅ sessions_spawn 派 | 手动触发 |

---

## 风险清单

### 🔴 风险 1：Session Resume 缓存未经验证

**描述**：Session Resume 改造完成但未验证 token 消耗是否实际下降。如果 session 切换太频繁或 CC CLI 内部有未预期的上下文泄漏，缓存收益可能打折扣。

**应对**：
- 下次跑真实 task 时记录每次的时间 + 输出长度，跟之前（无 Session Resume）对比
- 如果有 DeepSeek 的 API 账单显示，等几天看趋势
- 如果效果不明显，检查 `-r` 参数是否正确传给了 CC CLI，或者尝试 `-c`（continue）作为备选

### 🔴 风险 2：CC CLI session 可能自动失效

**描述**：`--no-session-persistence false` 是默认值，意味着 session 会持久化到 disk。但如果 CC CLI 崩溃、OOM 或被 taskkill，session 状态可能丢失，下一个 task 的 `-r` 将失败。

**应对**：
- Bridge 的 `callClaudeCode` 在 spawn error / exitCode != 0 时：删除 `.cc-session-id`，下一轮创建新的
- 加个检测：如果 `-r` 失败了（stderr 含 "Invalid session"），自动 fallback 到无 `-r` 模式，重建 session

### 🟡 风险 3：并发 task 可能同时抢 session

**描述**：Bridge 用 `scanning` flag 串行处理，但如果同时投递多个 task，只有第一个被处理，其余排队。不是 bug，但 task 队列可能积压。

**应对**：当前串行够用。如果以后需要并行，改成 session pool（每个 session 对应一个 CC CLI 进程）。

### 🟡 风险 4：自检轮询断链

**描述**：搬家到 `projects/zhan` 后，之前的 cron 自检失效（sessionTarget 绑定了旧 session）。当前没有活动的自检 cron。

**应对**：
- 下次投 task 时手动建 cron，规范在 AGENTS.md 已写
- 或者改用 `message` 工具直接飞书通知（替代 cron），更可靠

### 🟡 风险 5：设计手册与实际代码可能不一致

**描述**：`docs/design/overview.md` 是 v2.7 蓝图，描述了很多未实现的功能（商人、元气弹、第七关以后等）。新加入的人看手册会以为代码实现了所有内容。

**应对**：
- 暂时不改手册（overview 本身就是蓝图，不是 release notes）
- 如果要区分，在 overview 里标注 `[已实现]` / `[规划中]`
- 或者等 v2.5 真发布时再更新

### 🟢 风险 6：core.js 仍在增长

**描述**：core.js 从 69KB 降到 44KB（Step 2 还债），但后续加 Boss/圣物还是会增长。

**应对**：当前 44KB 完全可控。超过 80KB 再考虑拆 core.js 为多个文件。

### 🟢 风险 7：Bridge 进程无守护

**描述**：Bridge 如果崩溃或被 `taskkill` 误杀，没人重启。

**应对**：
- 当前不太可能（Bridge 稳定运行）
- 如果担心，可以写一个简单的 PowerShell 守护脚本

---

## 架构约束（不可违反）

1. **data.js** — 禁止 function（IIFE 除外）
2. **core.js** — 禁止 `document.` / DOM；所有逻辑走 Zhan.Engine/Rules/Systems
3. **ui.js** — 禁止写 `Zhan.Engine.state` 字段；事件走 dispatch
4. **Task 精确化** — 必须写 `file + function + location + change + forbidden`
5. **批量打包** — 同文件的多修改合并一个 task
6. **Session Resume** — Bridge 用 UUID session + `-r` 复用

---

## 下一步

- P0：投一个真实 task 验证 Session Resume 的 token 节省效果
- P1：补上自检轮询（cron 或飞书通知）
- P2：设计手册标注"已实现 vs 规划中"
- P3：多线并行（改不同文件可同时跑）
