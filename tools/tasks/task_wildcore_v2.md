# Task: wildcore_v2 — 万能牌+万能核心逻辑重构

## GOAL

万能牌=变形怪。搜卡左优先。被 `computeCombos` 扫描归组（无论最终是否凑够 `minCombo`）即视为"消费"，未消除惩罚中不扣血；没被归组的万能牌当散牌照扣。万能核心=扩容1格+首槽固定塞一张万能卡，无额外连击加成。

## ALLOWED FILES

- `code/core.js`
- `code/ui.js`

## IMMUTABLE RULES

禁止修改 ALLOWED FILES 以外的任何文件。
禁止修改任何非万能牌/万能核心相关逻辑。

---

## 改动1: resolveWildType 改左优先

- **位置**：`code/core.js` `resolveWildType`
- **当前**：最近邻居策略（两边搜，取距离更近；等距取左）
- **要求**：先向左搜非万能非废牌，找到即返回该类型；左边没有才向右搜；右边也找不到返回 `'wild'`。注意向左搜时遇到万能牌/废牌要跳过继续往左。

## 改动2: computeCombos 去掉万能核心 bonus+1

- **位置**：`code/core.js` `computeCombos`
- **当前**：`if (G.wildCoreSlot) { comboLen += 1; }`
- **要求**：删除整段。万能核心仅提供 `effectiveSlotSize + 1` 和首槽固定万能卡，不再给任何连击组额外 +1。

## 改动3: computeCombos 返回 claimed 信息

- **位置**：`code/core.js` `computeCombos`
- **当前**：返回 `combos[]` 数组
- **要求**：在返回的 `combos` 数组上附加属性 `_claimedWildIndices: number[]`，记录所有被扫描归组（无论该组最终是否 ≥ `minCombo`）的万能牌在 `slot` 中的原始索引。

 实现提示：在现有 `for (var ci = i; ci < j; ci++) { if (resolved[ci].card.type === 'wild') { resolved[ci].claimed = true; ... } }` 循环中，把标记了 `claimed` 的索引 `ci` push 进 `_claimedWildIndices`。

## 改动4: executeTurn 未消除惩罚改查 claimed

- **位置**：`code/core.js` `executeTurn` 未消除惩罚段（原 `if (G.slot[si2].type === 'wild') continue` 附近）
- **当前**：`if (G.slot[si2].type === 'wild') continue;`（所有万能牌无条件跳过）
- **要求**：
 1. 先调 `var combos = computeCombos(G.slot);`
 2. 从 `combos._claimedWildIndices` 构建 `claimedSet`（Object/Set）
 3. 遍历 `G.slot` 时，若 `claimedSet[si2] === true` 则跳过（被消费的万能不扣血）
 4. 其余牌（含未被归组的万能）正常 `resolveWildType` 后按类型统计，数量 < `minCombo` 照扣

## 改动5: updateComboPreview 同步未消除惩罚逻辑

- **位置**：`code/ui.js` `updateComboPreview` 末尾未消除预览段
- **当前**：只跳过 `special` 卡，万能牌解析后计入预览扣血
- **要求**：与改动4对齐——先调 `computeCombos(G.slot)` 取 `_claimedWildIndices`，被消费的万能预览不扣血，没被消费的照扣。
