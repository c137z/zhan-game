# 圣物组合测试脚本详细需求

## 测试范围（硬编码，不允许改）

### 单圣物（11 组）
double_wild, combo_core, slot_plus2, endurance_core, wild_core, overload_core, spirit_core, lifesaving_fur, tenacity_core, fury_core, life_core

### 双圣物组合（14 组，必须完全一致）
1. overload_core + fury_core
2. overload_core + endurance_core
3. fury_core + endurance_core
4. fury_core + life_core
5. endurance_core + life_core
6. tenacity_core + life_core
7. tenacity_core + endurance_core
8. wild_core + spirit_core
9. combo_core + wild_core
10. combo_core + spirit_core
11. combo_core + tenacity_core
12. wild_core + fury_core
13. overload_core + tenacity_core
14. spirit_core + fury_core

## 4 条硬标准（必须用这些阈值和标记名）

标准1 - 伤害异常 DAMAGE: bestCaseDamage > 120
标准2 - BUFF异常 BUFF_DUR: maxBuffDuration > 12
标准3 - 机制异常 MECHANICS: effectiveMinCombo === 2 && noUnmatchedPenalty === true
标准4 - 防守异常 DEFENSE: tenacityUsed === false && effectiveHP > 200

## HP 梯度（5 档）
100%, 75%, 50%, 25%, 1%

## 测试方法

用 page.evaluate() 调用引擎函数，纯逻辑测试，不模拟 UI 点击。

### mockState 函数（直接写入脚本）

```js
function mockState(activeRelics, hpPct) {
  var maxHP = CONFIG.PLAYER_MAX_HP;
  if (activeRelics.indexOf('life_core') >= 0) maxHP += 50;
  var hp = Math.floor(maxHP * hpPct);
  var st = {
    playerHP: hp, playerMaxHP: maxHP,
    enemyHP: 300, enemyMaxHP: 300,
    effectiveMinCombo: CONFIG.MIN_COMBO,
    effectiveSlotSize: CONFIG.SLOT_SIZE,
    effectiveAtkBuffMult: 0,
    effectiveVulnMult: 0,
    atkBuffMult: CONFIG.ATK_BUFF_MULT,
    vulnMult: CONFIG.VULN_MULT,
    defBuffRatio: CONFIG.DEF_BUFF_RATIO,
    buffDurationBonus: 0,
    playerEffects: {}, enemyEffects: {},
    tenacityUsed: false,
    furyEnabled: false,
    noUnmatchedPenalty: false,
    wildCoreSlot: false,
    deckConfig: JSON.parse(JSON.stringify(DECK_SIZES)),
    activeRelics: activeRelics,
    boss: { id: 'tabby', name: '测试Boss', emoji: '🧶', hpTriggers: ['groom','hiss'], maxHP: 300, baseAtk: 24, traits: [], cycle: BOSS_CYCLE_TEMPLATE },
    lockedSlots: {}
  };
  Zhan.Systems.Relic.applyInit(st);
  Zhan.Engine._updateEffectiveFury(st);
  return st;
}
```

### bestCaseDamage 计算

模拟最佳场景：10 张同类攻击牌连击（maxLen=10, totalCount=10）

```js
function calcBestCaseDamage(st) {
  var mc = st.effectiveMinCombo || CONFIG.MIN_COMBO;
  var totalAtk = 10, maxLen = 10;
  var baseVal = Zhan.Rules.calcBaseValue(totalAtk, mc);
  var pursuitMult = Zhan.Rules.calcPursuitMultiplier(maxLen, mc);
  var d = Math.ceil(baseVal * pursuitMult);
  d = Zhan.Rules.applyStatusEffects('attack', d, {
    atkBuffMult: st.effectiveAtkBuffMult,
    vulnMult: st.effectiveVulnMult,
    defBuffRatio: st.defBuffRatio
  });
  return d;
}
```

### maxBuffDuration 计算

```js
function calcMaxBuffDuration(st) {
  var mc = st.effectiveMinCombo || CONFIG.MIN_COMBO;
  var dur = Zhan.Rules.getComboDuration(10, mc);
  dur += st.buffDurationBonus || 0;
  return dur;
}
```

### effectiveHP 计算

```js
function calcEffectiveHP(st) {
  var ratio = st.effectiveDefBuffRatio || st.defBuffRatio || CONFIG.DEF_BUFF_RATIO;
  var effHP = ratio > 0 ? Math.floor(st.playerMaxHP / ratio) : 9999;
  if (!st.tenacityUsed) effHP += st.playerMaxHP;
  return effHP;
}
```

## 4 条标准判定逻辑

```js
function checkStandards(st, bestDamage, maxBuffDur) {
  var flags = [];
  if (bestDamage > 120) flags.push('DAMAGE');
  if (maxBuffDur > 12) flags.push('BUFF_DUR');
  if (st.effectiveMinCombo === 2 && st.noUnmatchedPenalty === true) flags.push('MECHANICS');
  var effHP = calcEffectiveHP(st);
  if (!st.tenacityUsed && effHP > 200) flags.push('DEFENSE');
  return { flags: flags, effectiveHP: effHP };
}
```

## 报告格式（必须这个结构）

```markdown
# 圣物组合测试报告

> 版本：v2.3-baseline
> 时间：YYYY-MM-DD HH:MM
> 环境：Playwright + Chrome headless
> 测试范围：11 单圣物 + 14 双圣物组合 × 5 HP 梯度

## 总览

| 状态 | 数量 |
|------|------|
| PASS | N |
| DAMAGE | N |
| BUFF_DUR | N |
| MECHANICS | N |
| DEFENSE | N |

## 单圣物基线

| 圣物 | HP% | atkBuffMult | vulnMult | defBuffRatio | bestDamage | maxBuffDur | minCombo | noPenalty | effHP | 标记 |
|------|-----|-------------|----------|--------------|------------|------------|----------|-----------|-------|------|

## 双圣物组合

| 组合 | HP% | atkBuffMult | vulnMult | defBuffRatio | bestDamage | maxBuffDur | minCombo | noPenalty | effHP | 标记 |
|------|-----|-------------|----------|--------------|------------|------------|----------|-----------|-------|------|

## 异常汇总

### DAMAGE（伤害 > 120）
(每个异常一行)

### BUFF_DUR（持续 > 12）
(每个异常一行)

### MECHANICS（minCombo=2 且 免惩罚）
(每个异常一行)

### DEFENSE（免死 + effectiveHP > 200）
(每个异常一行)
```

## 截图要求

- 每个组合在每个 HP 梯度截一张 `page.screenshot({ fullPage: true })`
- 路径：`tests/screenshots/relic-combo-{组合名}-HP{百分比}.png`
- 组合名格式：单圣物用 relic_id，双圣物用 `relicA-relicB`（按字母序）

## 最终约束

- 脚本放 tests/scripts/run-relic-combos.js
- require('playwright')
- 用系统 Chrome：executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
- headless: true
- 全 PASS → exit 0，有 FAIL → exit 1
- 文件写入到 tests/scripts/run-relic-combos.js（**不要把报告格式当作脚本内容**）
