---
name: auto-git-after-edit
description: 改代码+更新记忆后自动 git 提交
type: feedback
scope: global
created: 2026-06-09
priority: high
---
# 自动 git 提交

以下情况自动 git 提交：
1. 改完代码后 → `git add -A && git commit -m "描述性信息"`
2. 自己的记忆文件更新后（`remember` 调用后）→ 同样 git 提交

如果当前目录没有 git 仓库，跳过不报错。
