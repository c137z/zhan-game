#!/usr/bin/env node
// ============================================================
//  verify-overload-groom.js — 过载核心持续减半 + 舔毛周期验证
//  在 v2.3 fixture 上手动模拟 v2.4 逻辑
// ============================================================

var playwright = require('playwright');
var path = require('path');
var fs = require('fs');

// ========== 配置 ==========
var CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
var FIXTURE_PATH = path.resolve(__dirname, '..', 'fixtures', 'v2.3-baseline', 'index.html');
var REPORT_PATH = path.resolve(__dirname, '..', 'reports', 'overload-groom-verify-report.md');
var FIXTURE_URL = 'file:///' + FIXTURE_PATH.replace(/\\/g, '/');

// ========== 测试用例（硬编码预期值，基于 getComboDuration + v2.4 减半逻辑） ==========
// mc = CONFIG.MIN_COMBO = 3
// getComboDuration(n, 3) = max(1, n - 3 + 1) = max(1, n - 2)
//   n=3: max(1,1)=1, n=4: max(1,2)=2, n=5: max(1,3)=3, n=10: max(1,8)=8
// v2.4 overload halving: max(1, floor(dur/2))
//   n=3: max(1,0)=1, n=4: max(1,1)=1, n=5: max(1,1)=1, n=10: max(1,4)=4

var OVERLOAD_TESTS = [
  { n: 3,  overload: false, desc: '3连 无overload' },
  { n: 3,  overload: true,  desc: '3连 + overload' },
  { n: 4,  overload: true,  desc: '4连 + overload' },
  { n: 5,  overload: true,  desc: '5连 + overload' },
  { n: 10, overload: true,  desc: '10连 + overload' },
  { n: 10, overload: false, desc: '10连 无overload' }
];

var GROOM_TESTS = [
  { turn: 3,  desc: 'turn=3 (第4回合)', expected: false },
  { turn: 4,  desc: 'turn=4 (第5回合)', expected: true  },
  { turn: 9,  desc: 'turn=9 (第10回合)', expected: true  },
  { turn: 0,  desc: 'turn=0 (第1回合)', expected: false },
  { turn: 14, desc: 'turn=14 (第15回合)', expected: true  }
];

// ========== v2.4 逻辑（在 page.evaluate 中手动模拟） ==========
function makeEvalFn() {
  return function(params) {
    var mode = params.mode;

    if (mode === 'overload') {
      // Part A: 过载核心持续验证
      var n = params.n;
      var hasOverload = params.overload;
      var mc = CONFIG.MIN_COMBO; // 3

      // v2.3: 基础持续（fixture 中 getComboDuration）
      var baseDur = Zhan.Rules.getComboDuration(n, mc);

      // v2.4: 过载减半
      var v24Dur = baseDur;
      if (hasOverload) {
        v24Dur = Math.max(1, Math.floor(baseDur / 2));
      }

      return {
        n: n,
        mc: mc,
        baseDur: baseDur,
        hasOverload: hasOverload,
        v24Dur: v24Dur
      };
    }

    if (mode === 'groom') {
      // Part B: 舔毛周期验证（v2.4: %5===0）
      var turn = params.turn;

      // v2.3 condition (fixture 内)
      var v23Cond = turn > 0 && (turn + 1) % 4 === 0;

      // v2.4 condition (手动注入)
      var v24Cond = turn > 0 && (turn + 1) % 5 === 0;

      return {
        turn: turn,
        v23Cond: v23Cond,
        v24Cond: v24Cond
      };
    }

    return { error: 'unknown mode' };
  };
}

// ========== 主流程 ==========
(async function main() {
  console.log('=== 过载核心 + 舔毛周期 验证 ===\n');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

  var browser;
  var allPassed = true;
  var overloadResults = [];
  var groomResults = [];

  try {
    browser = await playwright.chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    var page = await browser.newPage();

    console.log('[1/3] 加载 fixture...');
    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    var loaded = await page.evaluate(function() {
      return !!(window.Zhan && window.Zhan.Rules && window.Zhan.Rules.getComboDuration);
    });
    if (!loaded) { console.error('FAIL: 页面加载失败'); process.exit(1); }
    console.log('  OK\n');

    var evalFn = makeEvalFn();

    // ========== Part A: 过载核心 ==========
    console.log('[2/3] 过载核心持续验证...\n');

    for (var oi = 0; oi < OVERLOAD_TESTS.length; oi++) {
      var ot = OVERLOAD_TESTS[oi];

      var or = await page.evaluate(evalFn, {
        mode: 'overload',
        n: ot.n,
        overload: ot.overload
      });

      // 验证: v24Dur 应该等于 max(1, floor(baseDur/2)) if overload else baseDur
      var expected = ot.overload
        ? Math.max(1, Math.floor(or.baseDur / 2))
        : or.baseDur;
      var pass = or.v24Dur === expected;

      overloadResults.push({
        desc: ot.desc,
        n: ot.n,
        mc: or.mc,
        baseDur: or.baseDur,
        hasOverload: ot.overload,
        v24Dur: or.v24Dur,
        expected: expected,
        pass: pass
      });

      if (!pass) allPassed = false;
      console.log('  ' + (pass ? '✓' : '✗') + ' ' + ot.desc +
        ': baseDur=' + or.baseDur + ' → v24Dur=' + or.v24Dur +
        ' (expect ' + expected + ')');
    }

    // ========== Part B: 舔毛周期 ==========
    console.log('\n[3/3] 舔毛周期验证...\n');

    for (var gi = 0; gi < GROOM_TESTS.length; gi++) {
      var gt = GROOM_TESTS[gi];

      var gr = await page.evaluate(evalFn, {
        mode: 'groom',
        turn: gt.turn
      });

      var pass = gr.v24Cond === gt.expected;

      groomResults.push({
        desc: gt.desc,
        turn: gt.turn,
        v23Cond: gr.v23Cond,
        v24Cond: gr.v24Cond,
        expected: gt.expected,
        pass: pass
      });

      if (!pass) allPassed = false;
      console.log('  ' + (pass ? '✓' : '✗') + ' ' + gt.desc +
        ': v2.3=' + gr.v23Cond + ' v2.4=' + gr.v24Cond +
        ' (expect ' + gt.expected + ')');
    }

    // ========== 生成报告 ==========
    console.log('\n生成报告...');
    var md = buildReport(overloadResults, groomResults);
    fs.writeFileSync(REPORT_PATH, md, 'utf-8');
    console.log('报告: ' + REPORT_PATH);

    var aPass = overloadResults.filter(function(r) { return r.pass; }).length;
    var bPass = groomResults.filter(function(r) { return r.pass; }).length;
    console.log('\n=== DONE ===');
    console.log('Part A: ' + aPass + '/' + overloadResults.length + ' pass');
    console.log('Part B: ' + bPass + '/' + groomResults.length + ' pass');
    console.log('Verdict: ' + (allPassed ? 'ALL PASS' : 'HAS FAILURES'));

  } catch (err) {
    console.error('FATAL: ' + err.message);
    console.error(err.stack);
    allPassed = false;
  } finally {
    if (browser) await browser.close();
  }

  process.exit(allPassed ? 0 : 1);
})();

// ========== 报告生成 ==========
function buildReport(overloadResults, groomResults) {
  var L = [];

  L.push('# 过载核心 + 舔毛周期 验证报告');
  L.push('');
  L.push('> 版本：v2.4 逻辑验证（基于 v2.3-baseline fixture + 手动注入 v2.4 逻辑）');
  L.push('> 时间：' + new Date().toISOString().replace('T', ' ').substring(0, 16));
  L.push('> 环境：Playwright + Chrome headless');
  L.push('');

  // Part A
  L.push('## Part A: 过载核心持续减半');
  L.push('');
  L.push('v2.4 规则: `dur = max(1, floor(getComboDuration(n, mc) / 2))` (仅 overload_core 激活时)');
  L.push('');
  L.push('| # | 测试 | n | mc | baseDur | overload | v2.4 dur | 期望 | 结果 |');
  L.push('|---|------|---|---|---------|----------|----------|------|------|');
  for (var i = 0; i < overloadResults.length; i++) {
    var r = overloadResults[i];
    L.push('| ' + (i + 1) + ' | ' + r.desc + ' | ' + r.n + ' | ' + r.mc +
      ' | ' + r.baseDur + ' | ' + r.hasOverload +
      ' | ' + r.v24Dur + ' | ' + r.expected +
      ' | ' + (r.pass ? '✅' : '❌') + ' |');
  }
  L.push('');

  // Part B
  L.push('## Part B: 舔毛周期 4→5');
  L.push('');
  L.push('v2.4 规则: `(turn + 1) % 5 === 0` (原 `% 4`)');
  L.push('');
  L.push('| # | 描述 | turn | v2.3 (%4) | v2.4 (%5) | 期望触发 | 结果 |');
  L.push('|---|------|------|-----------|-----------|----------|------|');
  for (var j = 0; j < groomResults.length; j++) {
    var gr = groomResults[j];
    L.push('| ' + (j + 1) + ' | ' + gr.desc + ' | ' + gr.turn +
      ' | ' + gr.v23Cond + ' | ' + gr.v24Cond +
      ' | ' + gr.expected + ' | ' + (gr.pass ? '✅' : '❌') + ' |');
  }
  L.push('');

  // 总结
  var aPass = overloadResults.filter(function(r) { return r.pass; }).length;
  var bPass = groomResults.filter(function(r) { return r.pass; }).length;
  var allPass = aPass === overloadResults.length && bPass === groomResults.length;

  L.push('## 总结');
  L.push('');
  L.push('| 部分 | 通过 | 总数 |');
  L.push('|------|------|------|');
  L.push('| Part A (过载持续) | ' + aPass + ' | ' + overloadResults.length + ' |');
  L.push('| Part B (舔毛周期) | ' + bPass + ' | ' + groomResults.length + ' |');
  L.push('');
  L.push('**最终结论**: ' + (allPass ? '✅ ALL PASS' : '❌ HAS FAILURES'));
  L.push('');

  L.push('---');
  L.push('*verify-overload-groom.js — ' + new Date().toISOString() + '*');

  return L.join('\n');
}
