# Task: bug_boss_emoji — 战斗日志硬编码骷髅 emoji

## GOAL
修复：所有 log() 中硬编码的 💀 改为 G.boss.emoji。Boss 关不再显示骷髅。

## ROOT CAUSE
core.js 中约 13 处 log() 硬编码了 💀（攻击/特攻/击败/敌人行动/防御/蓄力/怒击/双重攻击/HP显示/败北）。

## ALLOWED FILES
- code/core.js

## IMMUTABLE RULES
- 只改 emoji 的取值方式（字符串 💀 换为 G.boss.emoji），不改任何游戏逻辑
- 第一关毛线团 boss emoji 已是 💀，不受影响
- 不碰 ui.js 或 data.js
