# MSP Watcher — 任务完成"亮灯"机制

## 原理

1. Scheduler 投递 task 后，写 `pending.txt` = taskId
2. 同时创建 cron job "5分钟后检查"
3. cron 触发 → isolated session 检查 outbox/result-{taskId}.json 是否存在
4. 存在且 DONE → 汇报老大 + 删 pending.txt + 删 cron job
5. 存在且 FAILED → 汇报老大 + 删 pending.txt + 删 cron job  
6. 不存在 → 更新 pending.txt（标记第N次检查）+ 自延 5 分钟
7. 超过 6 次（30分钟）仍未完成 → 汇报超时 + 清理

## pending.txt 格式

每行一个字段：
```
taskId={taskId}
checks={N}
maxChecks=6
intervalMin=5
```

## cron job 命名规则

`msp-watch-{taskId}`
