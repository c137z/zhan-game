# Task: bug_smear_stun — 布偶猫涂抹 + 耐久核心眩晕修复

## GOAL
1. 装备耐久核心后，眩晕连击预览同步加 1 回合（和其他 buff/debuff 一致）
2. 布偶猫涂抹机制：牌面 UI 显示❓遮盖，效果不变；涂抹持续整个玩家回合

## ALLOWED FILES
- code/core.js
- code/data.js
- code/ui.js
- code/style.css

## BUG LIST

### Bug #1 — getEffectDescription 中 stun 预览缺少 buffDurationBonus
- 位置：core.js L366-368 `getEffectDescription` 的 `case 'stun':`
- 当前：
  ```
  case 'stun':
      var stunDur = getStunDuration(n);
      return '眩晕 ' + stunDur + '回合';
  ```
- 要求：stunDur 后加上 `stunDur += G.buffDurationBonus || 0;`，与其他 buff 类型对齐
- 效果：耐久核心激活时，预览显示"眩晕 2回合"（3连=1+1），实际结算也正确（Phase 1 L440-450 已有 bonus）

### Bug #2 — 布偶猫 onTurnEnd 清空涂抹导致玩家回合无效果
- 位置：data.js L255（布偶猫 ragdoll 的 `onTurnEnd`）
- 当前：`onTurnEnd: function(G) { G.smearedPiles = {}; }`
- 要求：删除 onTurnEnd，改为在 onTurnStart 开头先清空 `G.smearedPiles = {};` 再设新的
- 效果：涂抹从敌方回合 onTurnStart 设置后，持续到下一次 onTurnStart（覆盖整个玩家回合）

### Bug #3 — 涂抹 UI 用 blur 模糊而非 ❓ 遮盖
- 位置：
  - ui.js L95-96：涂抹时只加了 `smeared` class，没有改图标和标签
  - style.css L59：`.card-slot.smeared { filter: blur(4px); }`
- 要求：
  - 涂抹的卡牌 icon 显示 ❓，label 显示 ??
  - 卡面背景改为灰色（#555/#ccc/#666）
  - 涂抹不改变卡牌实际类型（抽出来仍是原卡）
  - 堆叠数正常显示
  - style.css 中 `.card-slot.smeared` 清空或移除 blur

## IMMUTABLE RULES
- 不改变卡牌结算逻辑（resolveWildType、computeCombos、executeTurn Phase 1/2）
- 不改变 enemyTurn 的执行顺序（哈气→舔毛→眩晕检查→onTurnStart→行动→onTurnEnd→衰减）
- 不改变 buffDurationBonus 的计算逻辑（只在 Phase 1 L441 和 getEffectDescription L358 使用）
- 不改变 CONFIG 常量
- 不改变 BOSSES/圣物定义中的其他 trait
- Contract B2 (enemyHP Math.max) / B3 (phase 白名单) / C2 (cycle 非空) 不可破坏
