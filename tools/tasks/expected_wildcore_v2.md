# Expected: wildcore_v2 — 万能牌+万能核心逻辑重构

> Contract version: `a038d75`

---

## VERIFICATION CHECKLIST (IMMUTABLE)

1. resolveWildType 改为左优先：先左搜、再右搜、最后 fallback 'wild'
2. computeCombos 中 wildCoreSlot bonus+1 已删除
3. computeCombos 返回 _claimedWildIndices（含 < minCombo 的未生效组内万能）
4. executeTurn 未消除惩罚：claimed 万能跳过、未 claimed 万能按 wild 统计照扣
5. updateComboPreview 未消除预览与 core 逻辑一致（claimed 万能预览中不扣血）
6. Case A 推演正确：[wildCore, attack, defend], minCombo=3 → 无连击生效，扣2血
7. Case B 推演正确：[wildCore, wild, attack, attack, attack, defend, defend, def_buff, def_buff, heal], minCombo=3 → 攻击10，扣5血
8. Case C 推演正确：[wildCore, wild, attack, wild, defend, defend, atk_down, atk_down], minCombo=3 → 攻击7，扣4血
9. Case D 推演正确：[wildCore, attack, defend] → 与 Case A 一致
10. 全槽万能边界正确：[wildCore, wild, wild] → 全部解析为 wild，无 claimed 标记，按 wild 统计照扣
11. 万能核心首槽卡与普通万能牌等价，无特殊加成
12. claimed 标记时机：computeCombos 扫描段内万能牌在 minCombo 判定前即标记 claimed
13. 非万能牌扣血规则不变（即使被归入未生效段仍按自身类型统计）
14. no side-effect on mechanics
15. no UI mismatch
16. no runtime mismatch
17. Contract A2: render 系列函数内无全局/持久 DOM 事件监听器泄漏
18. Contract A3a: animationend 事件注册（如有）带 {once:true}
19. Contract B2: G.enemyHP 减法操作有 Math.max(0, ...) 保护
20. Contract B3: G.phase 赋值仅限白名单值
21. Contract C2: BOSSES cycle 数组无空数组
22. Contract A1a: renderBoard 开头有 board.innerHTML='' 清空
23. Contract A3b: isAnimating 动画锁（如有）有释放路径

---

## INPUT CASE + EXPECTED VALUE

### Case A

**Slot（从左到右）**：`[wild(核心), attack, defend]`
**minCombo**：3

**推演**：
- resolveWildType: idx0 wild 左无→右找 attack→attack。resolved=[attack, attack, defend]
- attack 组 2 连 < 3 不生效，但 idx0 wild 已被归组 claimed=true
- defend 组 1 连不生效
- 未消除：idx0 claimed 跳过；idx1 attack 1<3 扣1；idx2 defend 1<3 扣1

**预期**：无连击生效，扣2血

---

### Case B

**Slot（从左到右）**：`[wild(核心), wild, attack, attack, attack, defend, defend, def_buff, def_buff, heal]`
**minCombo**：3

**推演**：
- 前5张全解析为 attack
- attack 组 5 连 ≥ 3 生效，idx0/1 claimed=true
- defend/def_buff/heal 均 < 3 不生效
- 未消除：2 张 wild claimed 跳过；attack 3 张 ≥ 3 不扣；defend 2 + def_buff 2 + heal 1 = 各 < 3 扣 2+2+1 = 5
- 伤害：base=8，pursuit mult=1.2，ceil(8×1.2)=10

**预期**：攻击10伤害，扣5血

---

### Case C

**Slot（从左到右）**：`[wild(核心), wild, attack, wild, defend, defend, atk_down, atk_down]`
**minCombo**：3

**推演**：
- 前4张全解析为 attack（idx3 wild 左有 attack 距1）
- attack 组 4 连 ≥ 3 生效，idx0/1/3 claimed=true
- defend/atk_down 均 < 3 不生效
- 未消除：3 张 wild claimed 跳过；attack 1 张 < 3 扣1；defend 2 + atk_down 2 = 各 < 3 扣 2+2 = 4
- 伤害：base=6，pursuit mult=1.1，ceil(6×1.1)=7

**预期**：攻击7伤害，扣4血

---

### Case D

**Slot（从左到右）**：`[wild(核心), attack, defend]`
**minCombo**：3

**预期**：同 Case A — 无连击生效，扣2血

---

## 边界说明

1. **全槽万能**（如 `[wildCore, wild, wild]`）：全部解析为 `'wild'`，`computeCombos` 中 `typ='wild'` 被跳过，无 claimed 标记（未进入任何组）。未消除惩罚中按 `'wild'` 类型统计，若数量 ≥ `minCombo` 则不扣，< `minCombo` 照扣。

2. **万能核心首槽卡**：与普通万能牌完全等价，仅由圣物机制固定在 `slot[0]`，无特殊加成。

3. **claimed 标记时机**：在 `computeCombos` 的 `while` 扫描中，段内万能牌在 `minCombo` 判定之前即标记 `claimed=true`。这意味着即使段长 < `minCombo`（未生效），段内万能牌仍被视为"已消费"，未消除惩罚中跳过。

4. **非万能牌扣血规则不变**：原生 attack/defend 等即使被归入未生效的段，仍按自身类型统计，数量 < `minCombo` 照扣。
