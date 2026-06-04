# 斩项目迁移方案

## 目标

Workspace 下 `projects/zhan/` → 迁移到 `C:\Users\kyzha\.openclaw\projects\zhan\` 作为唯一办公地点。

## 现状

| 目录 | 内容 |
|------|------|
| workspace/projects/zhan/ | 最新 code/ + msp/ (Bridge) + context/ + docs/ + .gitignore + TODO.md + 打包版 html |
| projects/zhan/ | 旧版代码 + 设计手册 + 元文件 (AGENTS/SOUL/USER/IDENTITY) |

## 迁移步骤

### 1. 同步 workspace 的新文件到旧目录
- code/* (data.js/core.js/ui.js/index.html) → projects/zhan/code/
- msp/* (bridge.js + inbox/outbox/archive 目录结构) → projects/zhan/msp/
- context/* (step2-spec.md/bug-list.md/config-classification.md) → projects/zhan/context/
- docs/* (sprint-review + design/ + contracts/) → projects/zhan/docs/
- .gitignore / TODO.md / 打包版 html → projects/zhan/
- zhan_v1.99_sprint4.html (workspace 的应该更新) → projects/zhan/
- AGENTS.md (workspace 的更新) → projects/zhan/

### 2. 旧目录独有文件保留
- HEARTBEAT.md / IDENTITY.md / SOUL.md / TOOLS.md / USER.md — 已在 projects/zhan/ 不动
- qa/ / tools/ / artifacts/ / .openclaw/ — 保留不动

### 3. Bridge 适配
- Bridge 用 `__dirname`，msp/ 搬到哪 PROJECT_ROOT 自动解析到新的
- 不需要改 bridge.js

### 4. 清理 workspace
- 删除 workspace/projects/zhan/（确认迁移完成后）
- workspace 如需要可保留，但只做临时工作区

### 5. AGENTS.md 更新
- AGENTS.md 中所有路径引用改为 projects/zhan/ 下的绝对路径

## 影响范围

| 组件 | 改动 |
|------|------|
| Bridge | 不需要改（__dirname 自适配） |
| CC CLI prompt | 不需要改（Bridge 用 PROJECT_ROOT） |
| 飞书 serve 服务 | 改目录路径 |
| AGENTS.md | 更新路径引用 |
| Workspace 全局入口 | MEMORY.md 中项目路径更新 |
