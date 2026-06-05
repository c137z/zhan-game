# 待办

## P0（下一步）
- [ ] 多线并行 MSP（Bridge 同时 spawn 多个 CC CLI，改不同文件的可并行）

## P1（近期）
- [ ] Bridge 进程守护（退出自动重启）
- [ ] 设计手册更新（overview.md 同步代码当前实际状态）
- [ ] **卡牌重命名**（data.js label 字段，7种改名） // 挂起，等老大对齐后执行
  - 回血 → 治疗 | 万能 → 全能 | 降攻 → 虚弱 | 易伤 → 破甲 | 眩晕 → 击晕 | 加攻 → 暴击
  - 不变：攻击、防御、减伤、废牌、特攻、特防、免伤

## P2（未来）
- [ ] autoDiff 不依赖 git CLI（纯 JS diff）
- [ ] stdout 截断提高
- [ ] Bridge 任务完成主动通知（文件监控触发）

## 已完成 ✅
- [x] Step 1：单文件拆分（code/ 四文件）
- [x] Step 2：还债（全局 function → Engine、core/ui 切分、CONFIG 替换）
- [x] Step 3：修 bug（Fury 默认值、Preview UI、小数串、浮点精度）
- [x] Think 开关（--model deepseek-v4-pro 关 thinking）
- [x] 批量打包规范（同文件修改合并为一个 task）
- [x] Bridge .notify marker 机制
- [x] 自检轮询规范（3 分钟循环）
- [x] 项目迁移至 projects/zhan/ 统一工作区
- [x] 文件全局整理归档
