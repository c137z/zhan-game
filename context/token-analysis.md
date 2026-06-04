# 斩项目 Token 消耗分析与优化报告

> 时间：2026-06-04
> 涉及：Step 2 还债（13 个 CC CLI task）+ Step 3 修 bug（4 个 task）
> 总量：约 2000 万 token，约 ¥54（DeepSeek V4 Pro）

---

## 一、Token 消耗链路

```
Scheduler (哈基米，主 session)
  │  用 DeepSeek V4 Pro，跟你聊天、审阅 result、派 Verifier
  │  消耗：约 200 万 token（253KB 上下文 × 持续对话）
  │
  └─→ Bridge (Node.js 进程)
        │  5s polling 扫描 inbox/，读到 task JSON
        │  spawn CC CLI 子进程
        │
        └─→ CC CLI (Claude Code / DeepSeek V4 Pro + thinking)
              │  每次 spawn 是全新进程：
              │  1. 读 Bridge 生成的 prompt（含 task spec + 文件路径）
              │  2. 读源文件（core.js 44KB）
              │  3. 理解代码、定位修改点
              │  4. thinking 链：推理如何修改、影响范围
              │  5. 编辑文件 → 生成 diff → TASK_DONE
              │
              │  单个 task 消耗：100-200 万 token（thinking 占大头）
              │  退出后无缓存，下次 spawn 从头来
```

---

## 二、问题发现与解决

### 问题 1：Thinking 模型烧钱（主要根因）

**发现**：Step 2 还债 13 个 task，不到 10 分钟实际改动，烧了 2000 万 token。

**根因**：CC CLI 用的是 DeepSeek V4 Pro **thinking 模式**。每个 task 的 thinking 推理链比最终输出大 20 倍——理解 400 行 `executeTurn`、分析调用链、推断影响范围，thinking token 不计入输出但照常收费。

**解决**：Bridge `spawn` 命令加了 `--model deepseek-v4-pro`，关掉 thinking，用普通模型。纯机械重构（函数迁移、CONFIG 替换）不需要思考链。

**结果**：后续 task（301-304）token 消耗明显下降，每个 task 从 100-200 万降到估计 30-50 万。

### 问题 2：每次 spawn 无法命中缓存

**发现**：即使关了 thinking，token 消耗仍然偏高。同一份 `core.js` 被读了 14 次，但没有一次命中缓存。

**根因**：CC CLI 每次被 Bridge spawn 都是**全新子进程、全新独立 session**。没有对话历史可以复用，模型每次都要从头扫描完整文件来理解上下文。你主会话的缓存命中率也只有 3%（因为对话不重复，工具输出不进缓存）。

**解决**：没办法在 CC CLI 层面做缓存（它设计就是一次性 command）。改为**减少 spawn 次数**——批量打包 task。

**结果**：AGENTS.md 写入新规范：改同一个文件的修改合并为一个 task，一个 task = 一个 spawn = 一次文件读取。

### 问题 3：多 task 串行 + CC CLI 读文件理解慢

**发现**：4 个 bug 只改了约 10 行代码，但花了 70 分钟。Bridge 串行处理 task（一个做完才拿下一个），CC CLI 每次 spawn 的"启动认知成本"很高（读完 44KB core.js + 理解函数结构）。

**根因**：Bridge 单线程 + CC CLI 无状态。没有持久化 agent 可以连续干活。

**解决**：
- 短期：批量打包 task（相同文件合并）
- 长期：多线并行（改不同文件的 task 可以同时 spawn 多个 CC CLI）

### 问题 4：Task 过多

**发现**：Step 2 拆了 8 个 task（原方案 13 个），每个都是类似的"函数迁移"操作，但各开了一个 CC CLI 进程。

**根因**：方案设计时过度拆分，想要"每一步都验证"。实际上一批同类操作完全可以合并。

**解决**：不再跑细小 task。改 `core.js` 的 bug 打包成一个 task，改 `ui.js` 的打包成一个。

---

## 三、最终优化效果

| 优化项 | 前 | 后 |
|--------|----|----|
| Thinking 模式 | 开（每个 task 100-200 万 token） | 关（预计 30-50 万 token） |
| Task 粒度 | 每个修改独立 task | 同文件合并 |
| CC CLI 策略 | 单个函数迁移 = 一个 task | 批量打包，一次 spawn 改完 |
| 缓存 | 无（每次全新 spawn） | 仍无，但减少 spawn 次数 |
| 并行 | 不支持 | 待做（改不同文件可并行） |

**估算收益**：同样的工作量，优化后 token 消耗降到原来的 25-30%。

---

## 四、AGENTS.md 变更记录

在 ② PLAN 步骤中新增批量打包原则：

```
**批量打包原则**：改同一个文件的多个修改合并成一个 task（省 token，CC CLI 只读一次文件）
  - 改 core.js 的 bug → 一个 task，spec 里列所有修改点
  - 改 ui.js 的优化 → 一个 task
  - 改多个文件的内容合并为一个大 task，在 spec 里分文件列出约束
```
