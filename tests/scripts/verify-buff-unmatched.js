#!/usr/bin/env node
// ============================================================
//  verify-buff-unmatched.js — BUFF_TYPES 未匹配散牌扣血修正验证
//  在 v2.3 fixture 上手动实现 v2.5 computeUnmatchedPenalty 逻辑
//  5 个 test case, exit 0 = 全 PASS
// ============================================================

var playwright = require('playwright');
var path = require('path');
var fs = require('fs');

// ========== 配置 ==========
var CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
var FIXTURE_PATH = path.resolve(__dirname, '..', 'fixtures', 'v2.3-baseline', 'index.html');
var REPORT_PATH = path.resolve(__dirname, '..', 'reports', 'buff-unmatched-verify-report.md');
var FIXTURE_URL = 'file:///' + FIXTURE_PATH.replace(/\\/g, '/');

// ========== 5 个 test case ==========
var TEST_CASES = [
  {
    id: 'A',
    desc: 'atk_buff×1 无连击',
    slot: [{ type: 'atk_buff', id: 1 }],
    expected: 1
  },
  {
    id: 'B',
    desc: 'atk_buff×3有连击 + def_buff×1散牌',
    slot: [
      { type: 'atk_buff', id: 1 }, { type: 'atk_buff', id: 2 }, { type: 'atk_buff', id: 3 },
      { type: 'def_buff', id: 4 }
    ],
    expected: 1
  },
  {
    id: 'C',
    desc: 'attack×3有连击 + atk_buff×1散牌',
    slot: [
      { type: 'attack', id: 1 }, { type: 'attack', id: 2 }, { type: 'attack', id: 3 },
      { type: 'atk_buff', id: 4 }
    ],
    expected: 1
  },
  {
    id: 'D',
    desc: 'attack×3+atk_buff×3都有连击 + def_buff×1散牌',
    slot: [
      { type: 'attack', id: 1 }, { type: 'attack', id: 2 }, { type: 'attack', id: 3 },
      { type: 'atk_buff', id: 4 }, { type: 'atk_buff', id: 5 }, { type: 'atk_buff', id: 6 },
      { type: 'def_buff', id: 7 }
    ],
    expected: 1
  },
  {
    id: 'E',
    desc: 'attack×3有连击 + atk_buff×1+def_buff×1都是散牌',
    slot: [
      { type: 'attack', id: 1 }, { type: 'attack', id: 2 }, { type: 'attack', id: 3 },
      { type: 'atk_buff', id: 4 },
      { type: 'def_buff', id: 5 }
    ],
    expected: 2
  }
];

// ========== v2.5 逻辑（在 page.evaluate 中手动实现） ==========
function makeEvalFn() {
  return function(testCase) {
    var slot = testCase.slot;
    var minCombo = CONFIG.MIN_COMBO; // 3

    // Step 1: 调 fixture 的 computeCombos
    var combos = Zhan.Rules.computeCombos(slot, minCombo);
    var claimedWildIndices = combos._claimedWildIndices || [];

    // Step 2: 提取 activeComboTypes（只有 BUFF_TYPES 中的类型）
    var activeComboTypes = [];
    for (var ci = 0; ci < combos.length; ci++) {
      if (BUFF_TYPES[combos[ci].type]) {
        activeComboTypes.push(combos[ci].type);
      }
    }

    // Step 3: v2.5 手动统计 unmatchedByType
    var unmatchedByType = {};
    var claimedSet = {};
    for (var cwi = 0; cwi < claimedWildIndices.length; cwi++) {
      claimedSet[claimedWildIndices[cwi]] = true;
    }

    for (var si = 0; si < slot.length; si++) {
      if (!slot[si]) continue;
      if (slot[si].special) continue;
      if (slot[si].type === 'wild') {
        if (claimedSet[si]) continue;
        unmatchedByType['wild'] = (unmatchedByType['wild'] || 0) + 1;
        continue;
      }
      // v2.5: only skip buff cards whose type formed a valid combo
      if (BUFF_TYPES[slot[si].type]) {
        if (activeComboTypes.length > 0) {
          var resolvedType = Zhan.Rules.resolveWildType(slot, si);
          if (activeComboTypes.indexOf(resolvedType) >= 0) continue;
          // not in active combo types → count as unmatched
        } else {
          continue; // backward compat: no activeComboTypes → skip all buffs
        }
      }
      var mt = Zhan.Rules.resolveWildType(slot, si);
      if (!unmatchedByType[mt]) unmatchedByType[mt] = 0;
      unmatchedByType[mt]++;
    }

    // Step 4: compute totalUnmatched
    var totalUnmatched = 0;
    for (var ut in unmatchedByType) {
      if (unmatchedByType[ut] < minCombo) {
        totalUnmatched += unmatchedByType[ut];
      }
    }

    return {
      combosCount: combos.length,
      comboTypes: combos.map(function(c) { return c.type; }),
      activeComboTypes: activeComboTypes,
      unmatchedByType: unmatchedByType,
      totalUnmatched: totalUnmatched
    };
  };
}

// ========== 主流程 ==========
(async function main() {
  console.log('=== BUFF_TYPES 未匹配散牌扣血修正验证 ===\n');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

  var browser;
  var allPassed = true;
  var results = [];

  try {
    browser = await playwright.chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    var page = await browser.newPage();

    console.log('[1/2] 加载 fixture...');
    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    var loaded = await page.evaluate(function() {
      return !!(window.Zhan && window.Zhan.Rules && window.Zhan.Rules.computeCombos);
    });
    if (!loaded) { console.error('FAIL: 加载失败'); process.exit(1); }
    console.log('  OK\n');

    var evalFn = makeEvalFn();

    console.log('[2/2] 跑 ' + TEST_CASES.length + ' 个 test case...\n');

    for (var ti = 0; ti < TEST_CASES.length; ti++) {
      var tc = TEST_CASES[ti];

      var r = await page.evaluate(evalFn, tc);

      var pass = r.totalUnmatched === tc.expected;

      results.push({
        id: tc.id,
        desc: tc.desc,
        slotLen: tc.slot.length,
        combosCount: r.combosCount,
        comboTypes: r.comboTypes,
        activeComboTypes: r.activeComboTypes,
        unmatchedByType: r.unmatchedByType,
        totalUnmatched: r.totalUnmatched,
        expected: tc.expected,
        pass: pass
      });

      if (!pass) allPassed = false;

      console.log('  ' + (pass ? '✓' : '✗') + ' Case ' + tc.id + ': ' + tc.desc +
        ' → totalUnmatched=' + r.totalUnmatched + ' (expect ' + tc.expected + ')' +
        ' combos=' + r.combosCount + ' buffTypes=' + JSON.stringify(r.activeComboTypes) +
        ' unmatched=' + JSON.stringify(r.unmatchedByType));
    }

    // 生成报告
    console.log('\n生成报告...');
    var md = buildReport(results);
    fs.writeFileSync(REPORT_PATH, md, 'utf-8');
    console.log('报告: ' + REPORT_PATH);

    var passN = results.filter(function(r) { return r.pass; }).length;
    console.log('\n=== DONE ===');
    console.log('Pass: ' + passN + '/' + results.length);
    console.log('Verdict: ' + (allPassed ? 'ALL PASS' : 'HAS FAILURES'));

  } catch (err) {
    console.error('FATAL: ' + err.message);
    allPassed = false;
  } finally {
    if (browser) await browser.close();
  }

  process.exit(allPassed ? 0 : 1);
})();

// ========== 报告生成 ==========
function buildReport(results) {
  var L = [];
  L.push('# BUFF_TYPES 未匹配散牌扣血修正验证报告');
  L.push('');
  L.push('> 版本：v2.5 逻辑验证（基于 v2.3-baseline fixture + 手动注入 v2.5 逻辑）');
  L.push('> 时间：' + new Date().toISOString().replace('T', ' ').substring(0, 16));
  L.push('> 环境：Playwright + Chrome headless');
  L.push('> minCombo = 3 (CONFIG.MIN_COMBO)');
  L.push('');

  L.push('## 测试结果');
  L.push('');
  L.push('| Case | 描述 | 槽位 | combos | activeBuffTypes | unmatchedByType | total | 期望 | 结果 |');
  L.push('|------|------|------|--------|-----------------|-----------------|-------|------|------|');
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    L.push('| ' + r.id + ' | ' + r.desc + ' | ' + r.slotLen + ' | ' +
      r.combosCount + ' [' + r.comboTypes.join(',') + '] | ' +
      '[' + r.activeComboTypes.join(',') + '] | ' +
      JSON.stringify(r.unmatchedByType) + ' | ' +
      r.totalUnmatched + ' | ' + r.expected + ' | ' +
      (r.pass ? '✅' : '❌') + ' |');
  }
  L.push('');

  var passN = results.filter(function(r) { return r.pass; }).length;
  L.push('**结论**: ' + passN + '/' + results.length + ' PASS');
  L.push('');

  L.push('---');
  L.push('*verify-buff-unmatched.js — ' + new Date().toISOString() + '*');
  return L.join('\n');
}
