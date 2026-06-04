# Housekeeping Log

## 2026-06-05 — 大规模整理

### 整理内容

1. **确定正式工作区**：`C:\Users\kyzha\.openclaw\projects\zhan\` 为唯一工作区
2. **清理 workspace**：`workspace/projects/zhan/` 精简为骨架（6 个文件 + 冻结版备份），删 code/msp/context/docs/archive 全目录
3. **清理 code/**：删 core.js.bak、verify_task203_204.ps1
4. **归档旧打包版**：zhan_v2.0_sprint4_fixed/split + zhan_v2.0 → archive/
5. **归档 msp prompt**：43 份历史 prompt → msp/archive/prompts/
6. **清理 msp/**：保留 bridge.js，其余移到 archive
7. **清理 inbox/outbox**：全部清空
8. **整理 context/**：保留 4 份当前文件（bug-list、config-classification、step2-spec、token-analysis），旧版设计手册归档到 archive/
9. **Workspace MEMORY.md** 更新项目路径

### 当前结构

```
projects/zhan/              ← 唯一正式工作区
├── code/                   ← 源文件（4 个）
│   └── data.js, core.js, ui.js, index.html
├── context/                ← 当前文档（4 个）
│   └── bug-list, config-classification, step2-spec, token-analysis
├── msp/                    ← Bridge（bridge.js + archive/）
├── docs/                   ← 设计文档 + 审计报告
│   ├── design/overview.md  ← 最新设计手册
│   └── sprint-review-v1.95-v1.99.md
├── archive/                ← 历史归档
│   ├── html_snapshots/     ← 旧 HTML 版本
│   ├── prompts/            ← 旧 msp prompt
│   └── ...
├── zhan_v1.99_sprint4.html ← 冻结版
└── zhan_v2.1.html          ← 发布版

workspace/projects/zhan/    ← 骨架副本（6 个元文件）
```

### 设计手册位置

- 最新版：`docs/design/overview.md`（v2.7，完整蓝图）
- 历史版：`archive/` 下

### 下次整理

- 每隔一个大阶段完成后整理一次
- 优先归档：旧 HTML 打包版、msp prompt、outbox result
