# CONFIG 直读分类清单
> 产出：Scheduler 手工扫描（2026-06-04）
> 用于：Task 204 — 批量替换

---

## 应改：运行时可能变化的值

这些 `CONFIG.xxx` 应改为 `G.effectiveXxx || CONFIG.xxx` 形式。

### MIN_COMBO → G.effectiveMinCombo

圣物 combo_core 可能将最小连击从 3 降到 2。

| 文件 | 行号 | 原引用 |
|------|------|--------|
| core.js | 392 | CONFIG.MIN_COMBO |
| core.js | 523 | CONFIG.MIN_COMBO |
| core.js | 686 | CONFIG.MIN_COMBO |
| core.js | 751 | CONFIG.MIN_COMBO |
| core.js | 765 | CONFIG.MIN_COMBO |
| core.js | 821 | CONFIG.MIN_COMBO |
| core.js | 824 | CONFIG.MIN_COMBO |
| core.js | 848 | CONFIG.MIN_COMBO |
| core.js | 851 | CONFIG.MIN_COMBO |
| core.js | 863 | CONFIG.MIN_COMBO |
| core.js | 866 | CONFIG.MIN_COMBO |
| ui.js | 225 | CONFIG.MIN_COMBO |
| ui.js | 251 | CONFIG.MIN_COMBO |
| ui.js | 254 | CONFIG.MIN_COMBO |
| ui.js | 283 | CONFIG.MIN_COMBO |
| ui.js | 423 | CONFIG.MIN_COMBO |

**共 16 处**

### ATK_BUFF_MULT → G.effectiveAtkBuffMult

狂暴核心 (fury_core) 实时根据玩家血量翻倍攻击加成。

| 文件 | 行号 | 原引用 |
|------|------|--------|
| core.js | 404 | CONFIG.ATK_BUFF_MULT |
| core.js | 413 | CONFIG.ATK_BUFF_MULT |
| ui.js | 40 | CONFIG.ATK_BUFF_MULT |

**共 3 处**

### VULN_MULT → G.effectiveVulnMult

狂暴核心实时翻倍易伤倍率。

| 文件 | 行号 | 原引用 |
|------|------|--------|
| core.js | 405 | CONFIG.VULN_MULT |
| core.js | 414 | CONFIG.VULN_MULT |
| core.js | 691 | CONFIG.VULN_MULT |

**共 3 处**

### ATK_DOWN_PCT → G.enemyEffects.atk_down_pct

狂暴核心翻倍降攻百分比（同时过载核心也改成 50%）。

| 文件 | 行号 | 原引用 |
|------|------|--------|
| core.js | 699 | CONFIG.ATK_DOWN_PCT |
| core.js | 790 | CONFIG.ATK_DOWN_PCT |
| core.js | 1029 | CONFIG.ATK_DOWN_PCT |
| ui.js | 57 | CONFIG.ATK_DOWN_PCT |

**共 4 处**

---

## 保留：真常量

这些 CONFIG 字段不受圣物、fury、关卡影响，保留不改。

| 文件 | 行号 | CONFIG 字段 | 原因 |
|------|------|------------|------|
| core.js | 45 | SLOT_SIZE | 棋盘槽位数，固定 |
| core.js | 49 | SLOT_SIZE | 同上 |
| core.js | 60 | PLAYER_MAX_HP | 基础 HP，用作初始值 |
| core.js | 123 | SLOT_SIZE | 同上 |
| core.js | 406 | DEF_BUFF_RATIO | effective 值由 _updateEffectiveFury 计算（L958 也在用），但 getEffectDescription 中作为 fallback 保留 |
| core.js | 411 | DEF_BUFF_RATIO | 同上 |
| core.js | 506 | PLAYER_MAX_HP | 初始 HP |
| core.js | 507 | PLAYER_MAX_HP | 初始 HP |
| core.js | 524 | SLOT_SIZE | 槽位 |
| core.js | 604 | BOARD_ROWS | 棋盘尺寸固定 |
| core.js | 606 | BOARD_COLS | 棋盘尺寸固定 |
| core.js | 610 | BOARD_ROWS | 同上 |
| core.js | 614 | BOARD_ROWS | 同上 |
| core.js | 615 | BOARD_COLS | 同上 |
| core.js | 643 | BOARD_COLS | 同上 |
| core.js | 660 | SLOT_SIZE | 槽位 |
| core.js | 905 | UNMATCHED_PENALTY | 惩罚规则配置 |
| core.js | 958 | DEF_BUFF_RATIO | 防御减伤 fallback |
| ui.js | 45 | DEF_BUFF_RATIO | 渲染展示 fallback |
| ui.js | 91 | BOARD_ROWS | 棋盘尺寸固定 |
| ui.js | 92 | BOARD_COLS | 同上 |
| ui.js | 98 | BOARD_COLS | 同上 |
| ui.js | 155 | DOUBLE_TAP_DELAY | 交互参数 |
| ui.js | 170 | SWIPE_THRESHOLD | 交互参数 |
| ui.js | 183 | SLOT_SIZE | 槽位 |
| ui.js | 356 | LOG_MAX_LINES | 日志上限 |
| ui.js | 373 | LONG_PRESS_DELAY | 交互参数 |
| ui.js | 405 | LONG_PRESS_DELAY | 交互参数 |

---

## 汇总

| 分类 | CONFIG 字段 | 处数 | 替换目标 |
|------|------------|------|---------|
| 改 | MIN_COMBO | 16 | `state.effectiveMinCombo \|\| CONFIG.MIN_COMBO` |
| 改 | ATK_BUFF_MULT | 3 | `state.effectiveAtkBuffMult \|\| CONFIG.ATK_BUFF_MULT` |
| 改 | VULN_MULT | 3 | `state.effectiveVulnMult \|\| CONFIG.VULN_MULT` |
| 改 | ATK_DOWN_PCT | 4 | `state.enemyEffects.atk_down_pct \|\| CONFIG.ATK_DOWN_PCT` |
| 保留 | 其他 | 27 | 不动 |

**共 26 处应改，27 处保留。**
