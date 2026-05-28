# 斩 — 工作流 v3.0 修订方案

> 基于 2026-05-28 事故复盘 + Claude 代码审查（致命漏洞 1/2/3 + 中等漏洞 4/5/6）
> 待老大审阅批准后，写入 `tools/roles/scheduler/RULES.md`

---

## 改动清单

| # | 类型 | 内容 | 影响 |
|---|------|------|------|
| 1 | 🔴 致命 | Phase 2 增加 Writer 完成硬校验 | Phase 2 |
| 2 | 🔴 致命 | Phase 3 增加 Verifier 完成硬校验 | Phase 3 |
| 3 | 🔴 致命 | Phase 5 git add 改为范围锁定+显式文件列表 | Phase 5 |
| 4 | 🔴 致命 | STALL 期间补禁 git add 及所有写操作 | STALL |
| 5 | 🟡 中等 | Phase 1 记录 contract 版本 hash | Phase 1 |
| 6 | 🟡 中等 | 重试计数器持久化 | Phase 4 |
| 7 | 🟡 中等 | 备份范围从 code/ 扩大到 projects/zhan/ 全量 | 强制备份 |

---

## 修改详情

### 改动 1：Phase 2 增加 Writer 完成硬校验

**现状**：Phase 2 只有"等待 Writer 完成"，没有客观完成标准。上一轮 Scheduler 靠文件时间戳推断完成。

**修改**：在 Phase 2 末尾增加硬校验步骤：

```
Phase 2 — Writer 完成校验（新增）
Writer 声称完成后，Scheduler 必须逐项执行：

1. git diff --stat → 确认修改文件数与 ALLOWED FILES 一致
   - 若多了或少了 → STALL

2. git diff --name-only → 确认每个修改文件都在 ALLOWED FILES 白名单内
   - 若出现白名单外文件 → STALL

3. 检查 Writer 输出是否包含 "FINAL CONSISTENCY PASS"
   - 若缺失 → STALL

4. 以上三项全部通过 → 进入 Phase 3
   任一项失败 → STALL，汇报老大
```

---

### 改动 2：Phase 3 增加 Verifier 完成硬校验

**现状**：Phase 3 只有"等待 Verifier 完成"，上一轮 Verifier 输出被截断也无法检测。

**修改**：在 Phase 3 末尾增加硬校验步骤：

```
Phase 3 — Verifier 完成校验（新增）
每个 Verifier 声称完成后，Scheduler 必须逐项检查：

1. 文件存在：Test-Path qa/reports/verdict_<id>.md → 不存在则 STALL

2. 完整性检查：文件大小 > 500 bytes → 不足则 STALL

3. 结论完整性：文件包含 "Verdict: PASS" 或 "Verdict: FAIL"
   - 若缺失 → STALL

4. CHECKLIST 覆盖：文件中出现 CHECKLIST 全部条目的编号（1. 2. 3. ...）
   - 若条目缺失 → STALL

5. 所有已发射 Verifier 全部通过以上 4 项检查 → 进入 Phase 4
   任一 Verifier 未通过 → STALL，汇报老大
```

---

### 改动 3：Phase 5 git add 改为范围锁定

**现状**：Phase 5 用 `git add` 全量 stage。如果 Writer 越界修改了文件，会被一起 commit。

**修改**：改为逐文件审查 + 显式 add：

```
Phase 5 — Git Commit + Build（修改）

仅在 Verdict = PASS 且所有 Verifier 全部通过硬校验后执行。

1. 范围锁定：
   git diff --name-only → 提取变更文件列表
   逐文件比对 ALLOWED FILES + task/expected/verdict 文件
   若出现超范围文件 → STALL，汇报老大（列出超范围文件）

2. 逐文件审查：
   对每个变更文件执行 git diff <file>
   Scheduler 只确认改动与 task 目标相关（不判断对错）
   若发现无关改动 → STALL

3. 安全 add（禁止 git add . 或 git add code/）：
   git add code/<allowed_file_1> code/<allowed_file_2> ...
   git add tools/tasks/<task_files>
   git add qa/reports/<verdict_files>
   必须显式列出每个文件，不使用通配符

4. commit：
   git commit -m "task_<id>: <简述> [VERDICT: PASS]"
   若 repo 未初始化或无 commit 历史 → 先 git init + 初始 commit

5. build：
   运行 tools/build_standalone.py
   若 exit code ≠ 0 → STALL，不进入步骤 6

6. 产物 commit：
   git add artifacts/zhan_v*.html
   git commit -m "build: v<MAJOR>.<COMMIT_COUNT> [task_<id>]"

7. 汇报：
   发送 commit hash + 产物路径 + git diff --stat 摘要
```

---

### 改动 4：STALL 协议补充（禁 git add + 全禁写操作）

**现状**：STALL 协议禁止了 commit/merge/build/宣布 PASS，但没禁止 `git add`。上一轮 Scheduler 在 STALL 前可能已 stage 了文件。

**修改**：STALL 期间禁止项增加：

```
停摆期间绝对禁止（补充）：
- git add（任何文件、任何参数）
- git reset（任何参数）
- git checkout（任何参数）
- build_standalone.py / 任何写文件操作
- 写 task/expected/verdict 文件
- 写 docs/ 下任何文件

停摆期间只允许：
- git status（只读）
- git diff / git diff --cached（只读）
- git log（只读）
- 读文件（Get-Content, Select-String）

若发现已 staged 未 commit 的文件：
1. 执行 git reset HEAD（取消 staged，不丢工作区修改）
2. 汇报老大："发现未完成的 staged 变更，已取消，等你指令"
```

---

### 改动 5：Phase 1 记录 contract 版本

**现状**：contract 文件可能在不同任务间被更新，Verifier 引用的版本不确定。

**修改**：Phase 1 追加一步：

```
Phase 1 追加步骤：
- 读取 contract 后，记录当前版本：
  git log -1 --format=%h docs/contracts/combat-core.contract.md
- 将 contract 版本 hash 写入 expected 文件头部：
  "Contract version: <hash>"
```

---

### 改动 6：重试计数器持久化

**现状**：最多 3 轮重试，但计数在 Scheduler 内存中，重启丢失。

**修改**：Phase 4 追加：

```
Phase 4 重试机制（修改）：
- 首次重试前，在 tools/tasks/ 下创建 task_<id>_retries.md
- 内容格式：1（当前重试次数）
- 每次重试前读取，+1 写入
- 若读取值 ≥ 3 → 不再重试，STALL 转人工
- task 完成后删除 retries 文件
```

---

### 改动 7：备份范围扩大到全项目

**现状**：`backup_project.ps1` 做了全量备份，但没在 RULES.md 里明确备份范围。

**修改**：强制备份描述改为：

```
## 强制备份

在 Phase 2（分发给 Writer）之前，必须先执行：
  pwsh -ExecutionPolicy Bypass -File tools/backup_project.ps1 -Reason "before_<task_id>"

备份范围：projects/zhan/ 全量（自动排除 .git/ 和 node_modules/）
包括：code/、docs/、tools/、qa/、artifacts/、context/ 等所有子目录
保留最近 10 份备份

备份完成确认后再发 Writer。
```

---

## 修改后的完整 Phase 列表

```
Phase 0: 接收需求
Phase 1: 生成 task + expected（+ 记录 contract 版本 hash）
Phase 2: 备份 → 发 Writer → 等待 → 硬校验 4 项 → 失败则 STALL
Phase 3: 发 Verifier → 等待 → 硬校验 5 项（每 Verifier）→ 失败则 STALL
Phase 4: 读 verdict → 原样转发 → FAIL+retries<3 则回写（计数器持久化）→ 否则 STALL
Phase 5: 范围锁定 → 逐文件审查 → 显式 add → commit → build（失败则 STALL）→ 产物 commit → 汇报
STALL: 禁止一切写操作（含 git add）→ 若有 staged 则 reset HEAD → 汇报状态 → 等老大指令
```

---

## 落地步骤（待审阅批准后执行）

1. 将以上 7 项改动写入 `tools/roles/scheduler/RULES.md`
2. git commit RULES.md 改动
3. 跑一个最小验证任务（例如改一个注释），验证 STALL 和硬校验点是否生效
4. 验证通过后，再修 5 个 bug
