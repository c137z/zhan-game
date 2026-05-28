# Task: bug_emoji_endless — 日志emoji动态化 + 无尽去重

## GOAL
1. 所有 log() 中的硬编码 💀 改为 G.boss.emoji（约13处）
2. 确认/修复 startEndlessNextCat 的过滤逻辑

## ALLOWED FILES
- code/core.js

## IMMUTABLE RULES
- 只改 emoji 取值方式，不改任何游戏逻辑
- 第一关 skeleton emoji 仍是 💀，不受影响
- ENDLESS_DEFEATED 结构不变
- 不碰 data.js
