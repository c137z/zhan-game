# 斩 ⚔️ 全自动开发管线

> "我只需要下命令和等验收——剩下的全部自动化。"
> — 老大，2026-06-05

---

## 一句话概述

**老大说"修这个 bug" → 8 步自动化流程走完 → 代码改好、审查通过、测试跑完、报告出来 → 老大看报告拍板。**

全程老大零操作，只管下命令和看结果。

---

## 完整流程（8 步）

```
① CHECK     老大说需求 → 哈基米读代码定位
② PLAN      哈基米写 Task JSON → 投递 msp/inbox/
③ EXECUTE   Bridge 自动调 CC 改代码 → outbox/result
④ VERIFY    哈基米审阅 + 派 Verifier subagent 审查 → PASS/FAIL
⑤ PLAYWRIGHT  哈基米写验证task JSON → 投inbox → CC写测试脚本 → 跑 → 报告
⑥ BUILD     node tools/build_single.js → artifacts/zhan_vX.Y.html
⑦ GIT COMMIT  git add + commit
⑧ REPORT    哈基米汇总 Verifier + Playwright 结果 → 飞书汇报
```

**注意：⑤ PLAYWRIGHT 在 ⑥ BUILD 之前** — 用旧 fixture 验证新逻辑，测试通过后再 build。

---

## 架构总览

```
                         ┌─────────────────────────┐
                         │        老大（人类）        │
                         │    下命令 → 看报告 → 拍板   │
                         └───────────┬─────────────┘
                                     │ 飞书消息
                                     ▼
┌────────────────────────────────────────────────────────────────┐
│                     🐱 哈基米（OpenClaw 主 Agent）                │
│                                                                  │
│   CHECK → PLAN → EXECUTE → VERIFY → PLAYWRIGHT → BUILD → COMMIT  │
│   拆 Task JSON → 投 Inbox → 审 result → 派 Verifier              │
│   → 投 Playwright → 跑测试 → Build → Git → 汇报                   │
└───────────┬────────────────────────────────────────────────────┘
            │
            │ filesystem: msp/inbox/*.json
            ▼
┌────────────────────────────────────────────────────────────────┐
│                  🌉 Bridge（msp/bridge.js）                      │
│                                                                  │
│   fs.watch + polling 监控 Inbox → spawn Claude Code CLI          │
│   Session Resume 缓存（省 80% token）                             │
│   自动备份 + git diff → outbox/result                            │
│   --allowedTools: Read,Edit,Write,Bash                           │
└───────────┬────────────────────────────────────────────────────┘
            │ spawn child process
            ▼
┌────────────────────────────────────────────────────────────────┐
│               ✍️ Writer（Claude Code CLI）                       │
│   DeepSeek V4 Pro | Session Resume | 只改代码不测试              │
│   只改 task 指定的文件，forbidden 文件禁止写入                     │
└────────────────────────────────────────────────────────────────┘

              ┌─────────── VERIFY 完成 ──────────┐
              ▼                                  ▼
┌──────────────────────┐   ┌──────────────────────────┐
│  🔍 Verifier（小猫）    │   │  🤖 Playwright 测试        │
│  OpenClaw Subagent    │   │  Headless Chrome          │
│                      │   │                          │
│  静态审查 CC 的代码     │   │  page.evaluate() 调引擎    │
│  逐项对照 Task Spec    │   │  读 fixtures/ 快照不碰 code/ │
│  PASS/FAIL 表         │   │  Markdown 报告 + 截图      │
│  FAIL → 退回重改       │   │  退出码 0/1 = 全绿/有异常   │
└──────────────────────┘   └──────────────────────────┘
```

---

## 物理隔离机制

| 角色 | 能碰什么 | 不能碰什么 |
|------|---------|-----------|
| 🐱 哈基米 | 写 Task JSON、读报告、派 subagent | **不能写 code/** |
| ✍️ Writer（CC） | 改 task 指定的 code/ 文件 | 不能碰 data.js/ui.js/index.html（task forbidden） |
| 🔍 Verifier | 读 code/ 所有文件 | **不能写任何文件** |
| 🤖 Playwright | 读 tests/fixtures/ 代码快照 | **不能碰 code/** |
| 🌉 Bridge | 读写 msp/ | **不能改 code/** |

---

## 测试基础设施

```
tests/
  fixtures/v2.3-baseline/    ← code/ 的冻结快照（只读）
  fixtures/v2.5-baseline/    ← 新版本快照
  scripts/                    ← Playwright 测试脚本
  reports/                    ← .md 报告
  screenshots/                ← 截图证据
```

**两类测试：**

A. **功能验证** — 改了什么测什么
B. **圣物组合回归** — 11 单 + 14 双 × 5 HP 梯度，4 条硬标准自动标记

---

## 技术细节

### Session Resume
CC 每次调用的上下文缓存到 disk。下一个 task 用 `-r UUID` 恢复，省 ~80% token。实测首次 ~2min，后续 ~1min。

### 自动 Diff + 备份
每次 task 执行前自动备份到 `msp/archive/backup-{taskId}/`，完成后 `git diff --no-index` 对比，写入 autoDiff。

### Playwright 不点 UI
`page.evaluate()` 直接调 `Zhan.Rules.calcAttackValue()` 等引擎函数，0.5 秒/组。不是 Selenium 式模拟点击。

### 版本号自动递增
v2.2 → v2.3 → v2.4 → v2.5，Build 后自动生成 `artifacts/zhan_vX.Y.html`。

---

## 今天的战绩

| 版本 | 改动 | Verifier | Playwright | 耗时 |
|------|------|----------|-----------|------|
| v2.2 | buff初始化 + unmatchedPenalty | - | - | 4min |
| v2.3 | 易伤UI倍率 + 行动顺序 | 6/6 | - | 5min |
| v2.4 | 过载减半 + 舔毛5回合 | 5/5 | 11/11 | 3min |
| v2.5 | BUFF_TYPES散牌扣血 | 8/8 | 5/5 | 3min |

**4 个版本，0 个手动操作。**

---

## 核心哲学

> **哈基米不写代码。CC 不改测试。Verifier 不调 UI。Playwright 不碰源码。**
>
> 每个人只做一件事，物理隔离，自动化衔接。
>
> 老大只管"要什么"和"行不行"——中间的全部由管线接管。

---

*斩项目 · 全自动开发管线 v2 · 2026-06-05*
