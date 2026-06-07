#!/usr/bin/env node
// ============================================================
//  run-relic-combos.js — 圣物组合回归测试 (Playwright)
//  11 单圣物 + 14 双圣物 × 5 HP 梯度
//  4 条硬标准: DAMAGE / BUFF_DUR / MECHANICS / DEFENSE
// ============================================================

var playwright = require('playwright');
var path = require('path');
var fs = require('fs');

// ========== 配置 ==========
var CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
var FIXTURE_PATH = path.resolve(__dirname, '..', 'fixtures', 'v2.3-baseline', 'index.html');
var REPORT_PATH = path.resolve(__dirname, '..', 'reports', 'relic-combo-report.md');
var SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'screenshots');
var FIXTURE_URL = 'file:///' + FIXTURE_PATH.replace(/\\/g, '/');

// ========== 测试矩阵（严格按 prompt-relic-combo-test.md） ==========
var SINGLE_RELICS = [
  'double_wild', 'combo_core', 'slot_plus2', 'endurance_core', 'wild_core',
  'overload_core', 'spirit_core', 'lifesaving_fur', 'tenacity_core', 'fury_core', 'life_core'
];

var DUAL_COMBOS = [
  ['overload_core', 'fury_core'],
  ['overload_core', 'endurance_core'],
  ['fury_core', 'endurance_core'],
  ['fury_core', 'life_core'],
  ['endurance_core', 'life_core'],
  ['tenacity_core', 'life_core'],
  ['tenacity_core', 'endurance_core'],
  ['wild_core', 'spirit_core'],
  ['combo_core', 'wild_core'],
  ['combo_core', 'spirit_core'],
  ['combo_core', 'tenacity_core'],
  ['wild_core', 'fury_core'],
  ['overload_core', 'tenacity_core'],
  ['spirit_core', 'fury_core']
];

var HP_GRADIENTS = [100, 75, 50, 25, 1]; // 百分比

// ========== page.evaluate 内联逻辑 ==========
// 所有函数定义在浏览器上下文中运行，依赖 fixture 页面全局变量

function makeEvalFunc() {
  return function(params) {
    var activeRelics = params.activeRelics;
    var hpPct = params.hpPct;

    // ---- mockState（严格按 prompt JS 代码） ----
    function mockState(activeRelics, hpFraction) {
      var maxHP = CONFIG.PLAYER_MAX_HP;
      if (activeRelics.indexOf('life_core') >= 0) maxHP += 50;
      var hp = Math.floor(maxHP * hpFraction);
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

    // ---- calcBestCaseDamage（严格按 prompt JS 代码） ----
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

    // ---- calcMaxBuffDuration（严格按 prompt JS 代码） ----
    function calcMaxBuffDuration(st) {
      var mc = st.effectiveMinCombo || CONFIG.MIN_COMBO;
      var dur = Zhan.Rules.getComboDuration(10, mc);
      dur += st.buffDurationBonus || 0;
      return dur;
    }

    // ---- calcEffectiveHP（严格按 prompt JS 代码） ----
    function calcEffectiveHP(st) {
      var ratio = st.effectiveDefBuffRatio || st.defBuffRatio || CONFIG.DEF_BUFF_RATIO;
      var effHP = ratio > 0 ? Math.floor(st.playerMaxHP / ratio) : 9999;
      if (!st.tenacityUsed) effHP += st.playerMaxHP;
      return effHP;
    }

    // ---- checkStandards（严格按 prompt JS 代码） ----
    function checkStandards(st, bestDamage, maxBuffDur) {
      var flags = [];
      if (bestDamage > 120) flags.push('DAMAGE');
      if (maxBuffDur > 12) flags.push('BUFF_DUR');
      if (st.effectiveMinCombo === 2 && st.noUnmatchedPenalty === true) flags.push('MECHANICS');
      var effHP = calcEffectiveHP(st);
      if (!st.tenacityUsed && effHP > 200) flags.push('DEFENSE');
      return { flags: flags, effectiveHP: effHP };
    }

    // ---- 执行 ----
    var hpFraction = hpPct / 100;
    var st = mockState(activeRelics, hpFraction);
    var bestDamage = calcBestCaseDamage(st);
    var maxBuffDur = calcMaxBuffDuration(st);
    var checkResult = checkStandards(st, bestDamage, maxBuffDur);

    return {
      atkBuffMult: st.effectiveAtkBuffMult || st.atkBuffMult,
      vulnMult: st.effectiveVulnMult || st.vulnMult,
      defBuffRatio: st.effectiveDefBuffRatio || st.defBuffRatio,
      bestDamage: bestDamage,
      maxBuffDur: maxBuffDur,
      minCombo: st.effectiveMinCombo,
      noPenalty: st.noUnmatchedPenalty,
      effHP: checkResult.effectiveHP,
      flags: checkResult.flags
    };
  };
}

// ========== 辅助 ==========
function comboId(relics) {
  return relics.join('+');
}

function screenshotName(relics, hpPct) {
  var sorted;
  if (relics.length === 1) {
    sorted = relics[0];
  } else {
    sorted = relics.slice().sort().join('-');
  }
  return 'relic-combo-' + sorted + '-HP' + hpPct + '.png';
}

// ========== 主流程 ==========
(async function main() {
  console.log('=== 圣物组合回归测试 v4 ===');
  console.log('Target: ' + FIXTURE_URL);
  console.log('Reports: ' + REPORT_PATH);
  console.log('Screenshots: ' + SCREENSHOTS_DIR + '\n');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  var browser;
  var allPassed = true;
  var results = [];

  try {
    browser = await playwright.chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    var context = await browser.newContext({ viewport: { width: 520, height: 900 } });
    var page = await context.newPage();

    console.log('[1/3] 加载 fixture 页面...');
    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    var loaded = await page.evaluate(function() {
      return !!(window.Zhan && window.Zhan.Engine && window.Zhan.Engine.state);
    });
    if (!loaded) { console.error('FAIL: 页面加载失败'); process.exit(1); }
    console.log('  OK\n');

    // 构建全部组合
    var allCombos = [];
    for (var i = 0; i < SINGLE_RELICS.length; i++) {
      allCombos.push({ type: 'single', relics: [SINGLE_RELICS[i]] });
    }
    for (var i = 0; i < DUAL_COMBOS.length; i++) {
      allCombos.push({ type: 'dual', relics: DUAL_COMBOS[i] });
    }

    console.log('[2/3] 跑 ' + allCombos.length + ' 组组合 × ' + HP_GRADIENTS.length + ' HP梯度\n');

    var evalFn = makeEvalFunc();

    for (var ci = 0; ci < allCombos.length; ci++) {
      var combo = allCombos[ci];
      var cid = comboId(combo.relics);

      var relicNames = await page.evaluate(function(relics) {
        return relics.map(function(r) { return (window.RELICS[r] && window.RELICS[r].name) || r; });
      }, combo.relics);
      var cname = relicNames.join(' + ');

      var label = '[' + (ci + 1) + '/' + allCombos.length + '] ' + cid;
      process.stdout.write(label + ' ');

      for (var hi = 0; hi < HP_GRADIENTS.length; hi++) {
        var hpPct = HP_GRADIENTS[hi];

        var rowResult = await page.evaluate(evalFn, {
          activeRelics: combo.relics,
          hpPct: hpPct
        });

        results.push({
          type: combo.type,
          comboId: cid,
          comboName: cname,
          relics: combo.relics,
          hpPct: hpPct,
          atkBuffMult: rowResult.atkBuffMult,
          vulnMult: rowResult.vulnMult,
          defBuffRatio: rowResult.defBuffRatio,
          bestDamage: rowResult.bestDamage,
          maxBuffDur: rowResult.maxBuffDur,
          minCombo: rowResult.minCombo,
          noPenalty: rowResult.noPenalty,
          effHP: rowResult.effHP,
          flags: rowResult.flags
        });

        if (rowResult.flags.length > 0) {
          allPassed = false;
        }

        // 截图
        var ssName = screenshotName(combo.relics, hpPct);
        var ssPath = path.join(SCREENSHOTS_DIR, ssName);
        try {
          await page.screenshot({ path: ssPath, fullPage: true });
        } catch (e) {
          ssName = '(截图失败)';
        }
        process.stdout.write('.');
      }

      var comboFlags = results.filter(function(r) { return r.comboId === cid && r.flags.length > 0; });
      if (comboFlags.length > 0) {
        var flagStrs = [];
        for (var fi = 0; fi < comboFlags.length; fi++) {
          flagStrs.push('HP' + comboFlags[fi].hpPct + '%:' + comboFlags[fi].flags.join(','));
        }
        console.log(' ⚠ ' + flagStrs.join(' | '));
      } else {
        console.log(' ✓');
      }
    }

    // ========== 生成报告 ==========
    console.log('\n[3/3] 生成报告...');
    var md = buildReport(results);
    fs.writeFileSync(REPORT_PATH, md, 'utf-8');
    console.log('报告: ' + REPORT_PATH);

    var passCount = results.filter(function(r) { return r.flags.length === 0; }).length;
    var dmgCount = results.filter(function(r) { return r.flags.indexOf('DAMAGE') >= 0; }).length;
    var bufCount = results.filter(function(r) { return r.flags.indexOf('BUFF_DUR') >= 0; }).length;
    var mechCount = results.filter(function(r) { return r.flags.indexOf('MECHANICS') >= 0; }).length;
    var defCount = results.filter(function(r) { return r.flags.indexOf('DEFENSE') >= 0; }).length;

    console.log('\n=== DONE ===');
    console.log('总计: ' + results.length + ' 行, PASS: ' + passCount +
      ', DAMAGE: ' + dmgCount + ', BUFF_DUR: ' + bufCount +
      ', MECHANICS: ' + mechCount + ', DEFENSE: ' + defCount);
    console.log('Verdict: ' + (allPassed ? 'ALL PASS' : 'HAS FLAGS'));

  } catch (err) {
    console.error('FATAL: ' + err.message);
    console.error(err.stack);
    allPassed = false;
  } finally {
    if (browser) await browser.close();
  }

  process.exit(allPassed ? 0 : 1);
})();

// ========== 报告生成（严格按 prompt Markdown 模板） ==========
function buildReport(results) {
  var L = [];

  L.push('# 圣物组合测试报告');
  L.push('');
  L.push('> 版本：v2.3-baseline');
  L.push('> 时间：' + new Date().toISOString().replace('T', ' ').substring(0, 16));
  L.push('> 环境：Playwright + Chrome headless');
  L.push('> 测试范围：11 单圣物 + 14 双圣物组合 × 5 HP 梯度');
  L.push('');

  var passCount = results.filter(function(r) { return r.flags.length === 0; }).length;
  var dmgCount = results.filter(function(r) { return r.flags.indexOf('DAMAGE') >= 0; }).length;
  var bufCount = results.filter(function(r) { return r.flags.indexOf('BUFF_DUR') >= 0; }).length;
  var mechCount = results.filter(function(r) { return r.flags.indexOf('MECHANICS') >= 0; }).length;
  var defCount = results.filter(function(r) { return r.flags.indexOf('DEFENSE') >= 0; }).length;

  L.push('## 总览');
  L.push('');
  L.push('| 状态 | 数量 |');
  L.push('|------|------|');
  L.push('| PASS | ' + passCount + ' |');
  L.push('| DAMAGE | ' + dmgCount + ' |');
  L.push('| BUFF_DUR | ' + bufCount + ' |');
  L.push('| MECHANICS | ' + mechCount + ' |');
  L.push('| DEFENSE | ' + defCount + ' |');
  L.push('');

  // 单圣物表
  var singleResults = results.filter(function(r) { return r.type === 'single'; });
  L.push('## 单圣物基线');
  L.push('');
  L.push('| 圣物 | HP% | atkBuffMult | vulnMult | defBuffRatio | bestDamage | maxBuffDur | minCombo | noPenalty | effHP | 标记 |');
  L.push('|------|-----|-------------|----------|--------------|------------|------------|----------|-----------|-------|------|');
  for (var i = 0; i < singleResults.length; i++) {
    var r = singleResults[i];
    var tag = r.flags.length > 0 ? r.flags.join(', ') : 'PASS';
    L.push('| ' + r.comboName + ' | ' + r.hpPct + '% | ' +
      parseFloat(r.atkBuffMult.toFixed(2)) + ' | ' +
      parseFloat(r.vulnMult.toFixed(2)) + ' | ' +
      parseFloat(r.defBuffRatio.toFixed(2)) + ' | ' +
      r.bestDamage + ' | ' + r.maxBuffDur + ' | ' +
      r.minCombo + ' | ' + r.noPenalty + ' | ' +
      r.effHP + ' | ' + tag + ' |');
  }
  L.push('');

  // 双圣物表
  var dualResults = results.filter(function(r) { return r.type === 'dual'; });
  L.push('## 双圣物组合');
  L.push('');
  L.push('| 组合 | HP% | atkBuffMult | vulnMult | defBuffRatio | bestDamage | maxBuffDur | minCombo | noPenalty | effHP | 标记 |');
  L.push('|------|-----|-------------|----------|--------------|------------|------------|----------|-----------|-------|------|');
  for (var j = 0; j < dualResults.length; j++) {
    var dr = dualResults[j];
    var dtag = dr.flags.length > 0 ? dr.flags.join(', ') : 'PASS';
    L.push('| ' + dr.comboName + ' | ' + dr.hpPct + '% | ' +
      parseFloat(dr.atkBuffMult.toFixed(2)) + ' | ' +
      parseFloat(dr.vulnMult.toFixed(2)) + ' | ' +
      parseFloat(dr.defBuffRatio.toFixed(2)) + ' | ' +
      dr.bestDamage + ' | ' + dr.maxBuffDur + ' | ' +
      dr.minCombo + ' | ' + dr.noPenalty + ' | ' +
      dr.effHP + ' | ' + dtag + ' |');
  }
  L.push('');

  // 异常汇总
  L.push('## 异常汇总');
  L.push('');

  // DAMAGE
  L.push('### DAMAGE（伤害 > 120）');
  L.push('');
  var dmgRows = results.filter(function(r) { return r.flags.indexOf('DAMAGE') >= 0; });
  if (dmgRows.length === 0) {
    L.push('(无异常)');
  } else {
    for (var di = 0; di < dmgRows.length; di++) {
      L.push('- `' + dmgRows[di].comboId + '` @ HP ' + dmgRows[di].hpPct + '%: bestDamage = ' + dmgRows[di].bestDamage);
    }
  }
  L.push('');

  // BUFF_DUR
  L.push('### BUFF_DUR（持续 > 12）');
  L.push('');
  var bufRows = results.filter(function(r) { return r.flags.indexOf('BUFF_DUR') >= 0; });
  if (bufRows.length === 0) {
    L.push('(无异常)');
  } else {
    for (var bi = 0; bi < bufRows.length; bi++) {
      L.push('- `' + bufRows[bi].comboId + '` @ HP ' + bufRows[bi].hpPct + '%: maxBuffDur = ' + bufRows[bi].maxBuffDur);
    }
  }
  L.push('');

  // MECHANICS
  L.push('### MECHANICS（minCombo=2 且 免惩罚）');
  L.push('');
  var mechRows = results.filter(function(r) { return r.flags.indexOf('MECHANICS') >= 0; });
  if (mechRows.length === 0) {
    L.push('(无异常)');
  } else {
    for (var mi = 0; mi < mechRows.length; mi++) {
      L.push('- `' + mechRows[mi].comboId + '` @ HP ' + mechRows[mi].hpPct + '%: minCombo=' + mechRows[mi].minCombo + ' noPenalty=' + mechRows[mi].noPenalty);
    }
  }
  L.push('');

  // DEFENSE
  L.push('### DEFENSE（免死 + effectiveHP > 200）');
  L.push('');
  var defRows = results.filter(function(r) { return r.flags.indexOf('DEFENSE') >= 0; });
  if (defRows.length === 0) {
    L.push('(无异常)');
  } else {
    for (var dei = 0; dei < defRows.length; dei++) {
      L.push('- `' + defRows[dei].comboId + '` @ HP ' + defRows[dei].hpPct + '%: effHP = ' + defRows[dei].effHP);
    }
  }
  L.push('');

  return L.join('\n');
}
