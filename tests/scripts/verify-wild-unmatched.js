// verify-wild-unmatched.js
// ============================================================
//  verify-wild-unmatched.js — 通配卡未消费扣血修复 Playwright 验证
// ============================================================

var playwright = require('playwright');
var path = require('path');
var fs = require('fs');

var CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
var FIXTURE_PATH = path.resolve(__dirname, '..', '..', 'code', 'index.html');
var SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');
var REPORT_PATH = path.resolve(__dirname, '..', 'reports', 'wild-unmatched-report.md');
var FIXTURE_URL = 'file:///' + FIXTURE_PATH.replace(/\\/g, '/');

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
var dirReports = path.dirname(REPORT_PATH);
if (!fs.existsSync(dirReports)) fs.mkdirSync(dirReports, { recursive: true });

var results = [], passCount = 0, failCount = 0;
function result(id, desc, passed, detail) {
  results.push({ id: id, desc: desc, passed: passed, detail: detail || '' });
  if (passed) passCount++; else failCount++;
  console.log((passed ? 'PASS' : 'FAIL') + ' [' + id + '] ' + desc + (detail ? ' — ' + detail : ''));
}

// Helper: run one scenario in browser, return log analysis
async function runScenario(page, slotCards, opts) {
  opts = opts || {};
  return await page.evaluate(function(arg) {
    var slotCards = arg.slotCards;
    var minComboOverride = arg.minComboOverride;
    var st = window.Zhan.Engine.state;

    st.phase = 'player';
    st.over = false;
    st.playerSkipped = false;
    st.noUnmatchedPenalty = false;
    st.wildCoreSlot = false;
    st.playerHP = st.playerMaxHP;
    st.playerShield = 0;
    st.enemyHP = st.enemyMaxHP;
    st.enemyShield = 0;
    st.enemyEffects = {};
    st.playerEffects = {};
    st.slot = [];
    st.lockedSlots = {};
    st.lockedPiles = {};
    st.turn = 0;
    if (minComboOverride !== undefined) st.effectiveMinCombo = minComboOverride;

    for (var i = 0; i < slotCards.length; i++) {
      st.slot.push({ type: slotCards[i], id: st.pickedId++ });
    }

    var hpBefore = st.playerHP;
    var logStart = st.logLines.length;

    window.Zhan.Engine._executeTurn();

    var newLogs = st.logLines.slice(logStart);
    var unmatchedCount = 0;
    for (var li = 0; li < newLogs.length; li++) {
      var m = newLogs[li].match(/♀未消除×(\d+)/);
      if (m) {
        unmatchedCount = parseInt(m[1], 10);
        break;
      }
    }

    return {
      logLines: newLogs,
      unmatchedCount: unmatchedCount,
      hpBefore: hpBefore,
      hpAfter: st.playerHP,
      hpDelta: hpBefore - st.playerHP
    };
  }, { slotCards: slotCards, minComboOverride: opts.minComboOverride });
}

async function main() {
  console.log('通配卡未消费扣血修复 Playwright 验证');
  console.log('Fixture: ' + FIXTURE_PATH + '\n');

  var browser = await playwright.chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  var ctx = await browser.newContext({
    viewport: { width: 390, height: 844, deviceScaleFactor: 2 }
  });
  var page = await ctx.newPage();

  try {
    // Load the game
    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForFunction(function() {
      return window.Zhan && window.Zhan.Engine && window.Zhan.Engine._executeTurn;
    }, { timeout: 10000 });
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'wild-unmatched-00-loaded.png') });
    result('0', '页面加载成功', true);

    // Scenario 1: [wild, attack, wild, heal×9] → unmatched=0
    console.log('\n--- 场景1: wild+attack+wild+heal×9 ---');
    var sc1 = await runScenario(page,
      ['wild','attack','wild',
       'heal','heal','heal','heal','heal','heal','heal','heal','heal']
    );
    console.log('  unmatchedCount=' + sc1.unmatchedCount + ' hpDelta=' + sc1.hpDelta);
    result('1', '场景1 wild+attack+wild+heal×9 unmatched=0', sc1.unmatchedCount === 0,
      'unmatched=' + sc1.unmatchedCount + ' hpDelta=' + sc1.hpDelta);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'wild-unmatched-01-scenario1.png'), fullPage: false });

    // Scenario 2: [attack×5] → unmatched=0
    console.log('\n--- 场景2: attack×5 ---');
    var sc2 = await runScenario(page, ['attack','attack','attack','attack','attack']);
    console.log('  unmatchedCount=' + sc2.unmatchedCount + ' hpDelta=' + sc2.hpDelta);
    result('2', '场景2 attack×5 unmatched=0', sc2.unmatchedCount === 0,
      'unmatched=' + sc2.unmatchedCount + ' hpDelta=' + sc2.hpDelta);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'wild-unmatched-02-scenario2.png'), fullPage: false });

    // Scenario 3: [attack, attack, heal] minCombo=3 → unmatched=3
    console.log('\n--- 场景3: attack+attack+heal minCombo=3 ---');
    var sc3 = await runScenario(page, ['attack','attack','heal'], { minComboOverride: 3 });
    console.log('  unmatchedCount=' + sc3.unmatchedCount + ' hpDelta=' + sc3.hpDelta);
    result('3', '场景3 attack+attack+heal minCombo=3 unmatched=3', sc3.unmatchedCount === 3,
      'unmatched=' + sc3.unmatchedCount + ' hpDelta=' + sc3.hpDelta);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'wild-unmatched-03-scenario3.png'), fullPage: false });

  } catch (err) {
    console.error('ERR: ' + err.message);
    result('ERR', '异常', false, err.message);
  } finally {
    await browser.close();
  }

  // Generate report
  var report = '# 通配卡未消费扣血修复 — Playwright 验证\n\n';
  report += '**Fixture**: `code/index.html` (含 `_consumedIndices` 修复)\n\n';
  report += '| # | 测试 | 结果 | 详情 |\n|---|---|---|---|\n';
  for (var ri = 0; ri < results.length; ri++) {
    var r = results[ri];
    report += '| ' + r.id + ' | ' + r.desc + ' | ' + (r.passed ? '✅ PASS' : '❌ FAIL') + ' | ' + (r.detail || '') + ' |\n';
  }
  report += '\n## 汇总\n';
  report += 'PASS: ' + passCount + ' / FAIL: ' + failCount + '\n\n';
  report += '## 验证场景\n\n';
  report += '| 场景 | 槽位 | minCombo | 预期 unmatched |\n|---|---|---|---|\n';
  report += '| 1 | 💎🗡💎❤×9 | 3 | 0 |\n';
  report += '| 2 | 🗡×5 | 3 | 0 |\n';
  report += '| 3 | 🗡🗡❤ | 3 | 3 |\n';

  fs.writeFileSync(REPORT_PATH, report, 'utf-8');
  console.log('\n报告: ' + REPORT_PATH);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(function(err) { console.error('FATAL: ' + err.message); process.exit(1); });
