---
name: permissions-all-access
description: 全部工具放行，无需权限弹窗
type: user
scope: project
created: 2026-06-09
priority: high
---
# 权限策略

**全部工具放行，不再弹权限确认。** 包括但不限于：
- edit_file / multi_edit / write_file
- delete_file / delete_directory
- move_file / copy_file
- run_command（所有操作）
- run_background
- web_search / web_fetch
- install_skill / add_mcp_server

**约束条件：**
1. **谨慎操作** — 不鲁莽，尤其是删除/覆盖类操作要再三确认
2. **对齐意图** — 动手前先确认理解了需求
3. **确认风险** — 高风险操作（删目录、批量改、覆盖文件）先在脑子里过一遍后果
4. **出了问题直接认** — 不甩锅、不辩解
