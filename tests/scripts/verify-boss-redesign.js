#!/usr/bin/env node
// ============================================================
//  verify-boss-redesign.js — Boss 行为循环重设计验证 (Playwright)
//  验证: 能力值增长 / 暴击伤害 / 舔毛周期 / 意图展示
// ============================================================

var playwright = require('playwright');
var path = require('path');
var fs = require('fs');

// ========== 配置 ==========
var CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
// v3.0-baseline 不存在，使用当前 code/ 目录（已含新 boss 循环）
var GAME_PATH = path.resolve(__dirname, '..', '..', 'code', 'index.html');
var REPORT_PATH = path.resolve(__dirname, '..', 'reports', 'verify-boss-redesign.md');
var GAME_URL = 'file:///' + GAME_PATH.replace(/\\/g, '/');

// ========== 验证项 ==========
var CHECKS = [];

// ========== 主流程 ==========
(async function main() {
  console.log('=== Boss 行为循环重设计验证 ===');
  console.log('Target: ' + GAME_URL + '\n');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

  var browser;
  var allPassed = true;

  try {
    browser = await playwright.chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    var page = await browser.newPage();

    console.log('[1/4] 加载页面...');
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    var loaded = await page.evaluate(function() {
      return !!(window.Zhan && window.Zhan.Engine && window.Zhan.Engine.state);
    });
    if (!loaded) { console.error('FAIL: 页面加载失败'); process.exit(1); }
    console.log('  OK\n');

    // ---- Test 1: T0 intent display ----
    console.log('[2/4] T0 意图验证...');
    var t0Result = await page.evaluate(function() {
      window.G = {};
      window.G.bossId = 'tabby';
      window.G.currentStage = 3;
      window.G.isEndless = false;
      window.newGame();
      var st = window.Zhan.Engine.state;
      window.Zhan.Engine._updateEnemyIntent();
      return {
        turn: st.turn,
        power: st.power,
        intentHTML: st._intentHTML,
        intentExtra: st._intentExtraHTML
      };
    });

    var t0Pass = t0Result.intentHTML.indexOf('能力值buff') >= 0;
    CHECKS.push({ id: 'T0_intent', desc: 'T0意图=能力值buff', pass: t0Pass, detail: t0Result.intentHTML });
    console.log('  ' + (t0Pass ? '✓' : '✗') + ' intent: ' + t0Result.intentHTML +
      ' power=' + t0Result.power);
    if (!t0Pass) allPassed = false;

    // ---- Test 2: Skeleton 5-turn power growth ----
    console.log('\n[3/4] 毛线团 power 增长验证...');
    var skeletonResult = await page.evaluate(function() {
      window.G = {};
      window.G.bossId = 'skeleton';
      window.G.currentStage = 2;
      window.G.isEndless = false;
      window.newGame();
      var st = window.Zhan.Engine.state;
      var log = [];
      // initial
      log.push({ turn: st.turn, power: st.power });

      // Run 5 turns (T0 buff_self + T1-T4)
      for (var i = 0; i < 5; i++) {
        st.playerHP = 9999; // prevent death
        st.over = false;
        window.Zhan.Engine._enemyTurn();
        log.push({ turn: st.turn, power: st.power });
      }
      return log;
    });

    // Verify power: T0=12, T1=13, T2=14, T3=15, T4=16, T5=17
    var expectedPower = [12, 13, 14, 15, 16, 17];
    var skelPass = true;
    for (var si = 0; si < skeletonResult.length; si++) {
      var exp = expectedPower[si];
      var act = skeletonResult[si].power;
      var ok = act === exp;
      if (!ok) skelPass = false;
      console.log('  ' + (ok ? '✓' : '✗') + ' T' + skeletonResult[si].turn +
        ' power=' + act + ' (expect ' + exp + ')');
    }
    CHECKS.push({ id: 'skel_power', desc: '毛线团5回合power:12→17', pass: skelPass, detail: JSON.stringify(skeletonResult.map(function(s) { return 'T' + s.turn + ':' + s.power; })) });
    if (!skelPass) allPassed = false;

    // ---- Test 3: Skeleton T5 crit damage = 32 ----
    console.log('\n  T5 暴击伤害验证...');
    var critResult = await page.evaluate(function() {
      window.G = {};
      window.G.bossId = 'skeleton';
      window.G.currentStage = 2;
      window.G.isEndless = false;
      window.newGame();
      var st = window.Zhan.Engine.state;

      // Run T0-T4
      for (var i = 0; i < 4; i++) {
        st.playerHP = 9999; st.over = false;
        window.Zhan.Engine._enemyTurn();
      }
      // Now T4 crit action
      var hpBefore = st.playerHP;
      st.over = false;
      window.Zhan.Engine._enemyTurn();
      var hpAfter = st.playerHP;
      var dmg = hpBefore - hpAfter;
      return { turn: st.turn - 1, power: st.power - 1, dmg: dmg, playerHP: st.playerHP };
    });

    var critExpected = 32; // 16 × 2
    var critPass = critResult.dmg === critExpected;
    CHECKS.push({ id: 'skel_crit', desc: '毛线团T5暴击=32(16×2)', pass: critPass, detail: 'dmg=' + critResult.dmg + ' power=' + critResult.power + ' turn=' + critResult.turn });
    console.log('  ' + (critPass ? '✓' : '✗') + ' T5 crit dmg=' + critResult.dmg +
      ' (expect ' + critExpected + ') power=' + critResult.power);
    if (!critPass) allPassed = false;

    // ---- Test 4: Groom clears debuffs at correct turn ----
    console.log('\n[4/4] 舔毛清除 Debuff 验证...');
    var groomResult = await page.evaluate(function() {
      window.G = {};
      window.G.bossId = 'tabby';
      window.G.currentStage = 3;
      window.G.isEndless = false;
      window.newGame();
      var st = window.Zhan.Engine.state;

      // Set enemy debuffs before groom
      st.enemyEffects.vulnerable = 3;
      st.enemyEffects.atk_down = 2;
      st.enemyEffects.atk_down_pct = 30;
      st.enemyEffects.stun = 1;

      // Run 4 turns to reach turn=4 (T5, groom trigger)
      for (var i = 0; i < 4; i++) {
        st.playerHP = 9999; st.over = false;
        window.Zhan.Engine._enemyTurn();
      }

      // Check debuffs status after groom (triggered at turn=4)
      return {
        turn: st.turn,
        vulnerable: st.enemyEffects.vulnerable || 0,
        atk_down: st.enemyEffects.atk_down || 0,
        stun: st.enemyEffects.stun || 0,
        groomTriggered: (st.enemyEffects.vulnerable || 0) === 0
      };
    });

    var groomPass = groomResult.vulnerable === 0 && groomResult.atk_down === 0 && groomResult.stun === 0;
    CHECKS.push({ id: 'groom', desc: '舔毛T5清除全部Debuff', pass: groomPass,
      detail: 'turn=' + groomResult.turn + ' vul=' + groomResult.vulnerable + ' atkD=' + groomResult.atk_down + ' stun=' + groomResult.stun });
    console.log('  ' + (groomPass ? '✓' : '✗') + ' turn=' + groomResult.turn +
      ' vul=' + groomResult.vulnerable + ' atkD=' + groomResult.atk_down +
      ' stun=' + groomResult.stun);
    if (!groomPass) allPassed = false;

    // ---- 生成报告 ----
    console.log('\n生成报告...');
    var md = buildReport(CHECKS);
    fs.writeFileSync(REPORT_PATH, md, 'utf-8');
    console.log('报告: ' + REPORT_PATH);

    var passN = CHECKS.filter(function(c) { return c.pass; }).length;
    console.log('\n=== DONE ===');
    console.log('Pass: ' + passN + '/' + CHECKS.length);
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
function buildReport(checks) {
  var L = [];
  L.push('# Boss 行为循环重设计验证报告');
  L.push('');
  L.push('> 版本：v3.0-baseline (new boss cycle)');
  L.push('> 时间：' + new Date().toISOString().replace('T', ' ').substring(0, 16));
  L.push('> 环境：Playwright + Chrome headless');
  L.push('');

  L.push('## 验证结果');
  L.push('');
  L.push('| # | 验证项 | 结果 | 详情 |');
  L.push('|---|--------|------|------|');
  for (var i = 0; i < checks.length; i++) {
    var c = checks[i];
    L.push('| ' + c.id + ' | ' + c.desc + ' | ' + (c.pass ? '✅' : '❌') + ' | ' + (c.detail || '') + ' |');
  }
  L.push('');

  var passN = checks.filter(function(c) { return c.pass; }).length;
  L.push('**结论**: ' + passN + '/' + checks.length + ' PASS');
  L.push('');
  L.push('---');
  L.push('*verify-boss-redesign.js — ' + new Date().toISOString() + '*');
  return L.join('\n');
}
