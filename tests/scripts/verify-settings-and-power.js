// verify-settings-and-power.js
// ============================================================
//  验证 1) 设置面板 toggle  2) powerGrowth 首回合行为
// ============================================================

var playwright = require('playwright');
var path = require('path');
var fs = require('fs');

var CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
var FIXTURE_PATH = path.resolve(__dirname, '..', '..', 'code', 'index.html');
var SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');
var REPORT_PATH = path.resolve(__dirname, '..', 'reports', 'settings-power-report.md');
var FIXTURE_URL = 'file:///' + FIXTURE_PATH.replace(/\\/g, '/');

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
var dirReports = path.dirname(REPORT_PATH);
if (!fs.existsSync(dirReports)) fs.mkdirSync(dirReports, { recursive: true });

var results = [], passCount = 0, failCount = 0;
function rst(id, desc, passed, detail) {
  results.push({ id: id, desc: desc, passed: passed, detail: detail || '' });
  if (passed) passCount++; else failCount++;
  console.log((passed ? 'PASS' : 'FAIL') + ' [' + id + '] ' + desc + (detail ? ' — ' + detail : ''));
}

(async function() {
  var browser = await playwright.chromium.launch({ executablePath: CHROME_PATH, headless: true });
  var page = await browser.newPage();
  page.on('pageerror', function(err) { console.error('PAGE ERROR:', err.message); });

  console.log('Loading page...');
  await page.goto(FIXTURE_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await new Promise(function(r) { setTimeout(r, 1200); });

  // ============================================================
  // Part A: Settings Panel Toggle
  // ============================================================
  // A1: 齿轮按钮存在
  var btnSettings = await page.$('#btn-settings');
  rst('A1', '齿轮按钮存在', btnSettings !== null);

  // A2: 初始面板隐藏
  var panelVisible = await page.evaluate(function() {
    var el = document.getElementById('settings-panel');
    return el && window.getComputedStyle(el).display !== 'none';
  });
  rst('A2', '设置面板初始隐藏', !panelVisible, panelVisible ? 'visible' : 'hidden');

  // A3: 点击齿轮→面板展开
  await page.click('#btn-settings');
  await new Promise(function(r) { setTimeout(r, 300); });
  var panelNowVisible = await page.evaluate(function() {
    var el = document.getElementById('settings-panel');
    return el && window.getComputedStyle(el).display !== 'none';
  });
  rst('A3', '点击齿轮→面板展开', panelNowVisible);

  // A4: 面板含四个元素
  var hasMusic = await page.$('#slider-music');
  var hasSfx = await page.$('#slider-sfx');
  var hasVibrate = await page.$('#toggle-vibrate');
  var hasHome = await page.$('#btn-back-to-home');
  rst('A4', '面板含音乐/音效/震动/返回主页', hasMusic && hasSfx && hasVibrate && hasHome !== null, 
    'music:' + !!hasMusic + ' sfx:' + !!hasSfx + ' vibrate:' + !!hasVibrate + ' home:' + !!hasHome);

  // A5: 再次点击齿轮→面板收起
  await page.click('#btn-settings');
  await new Promise(function(r) { setTimeout(r, 300); });
  var panelHiddenAgain = await page.evaluate(function() {
    var el = document.getElementById('settings-panel');
    return el && window.getComputedStyle(el).display === 'none';
  });
  rst('A5', '再次点击齿轮→面板收起', panelHiddenAgain);

  // A6: 点击外部区域→面板收起
  await page.click('#btn-settings');
  await new Promise(function(r) { setTimeout(r, 300); });
  await page.click('#menu-title');
  await new Promise(function(r) { setTimeout(r, 300); });
  var panelHiddenClickOutside = await page.evaluate(function() {
    var el = document.getElementById('settings-panel');
    return el && window.getComputedStyle(el).display === 'none';
  });
  rst('A6', '点击面板外(标题)→面板收起', panelHiddenClickOutside);

  // Screenshot: settings panel open
  await page.click('#btn-settings');
  await new Promise(function(r) { setTimeout(r, 300); });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'settings-panel-open.png') });
  await page.click('#btn-settings');

  // ============================================================
  // Part B: PowerGrowth — 冒险1-19关首回合无能力值buff
  // ============================================================
  // B1: 第1关 (growth=0) — 首回合不打印'能力值buff！'
  await page.click('#btn-adventure');
  await new Promise(function(r) { setTimeout(r, 600); });
  
  // 点击第1关
  var cells = await page.$$('.stage-cell');
  if (cells.length > 0) {
    await cells[0].click();
    await new Promise(function(r) { setTimeout(r, 1200); });
    
    // 检查日志不应包含"能力值buff"
    var logText = await page.evaluate(function() {
      var logEl = document.getElementById('log');
      return logEl ? logEl.innerText : '';
    });
    var hasBuffLog1 = logText.indexOf('能力值buff') >= 0;
    rst('B1', '第1关(growth=0)首回合无能力值buff日志', !hasBuffLog1, hasBuffLog1 ? 'FOUND buff log' : '');

    // B1b: T0 意图显示
    var intentText = await page.evaluate(function() {
      var intent = document.getElementById('enemy-intent');
      return intent ? intent.innerHTML : '';
    });
    var hasBuffIntent1 = intentText.indexOf('能力值buff') >= 0;
    rst('B1b', '第1关(growth=0)意图不显示能力值buff', !hasBuffIntent1, intentText);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'adventure-stage1-no-buff.png') });

    // B2: 第20关 (growth=1) — 首回合应该有'能力值buff！'
    // 先解锁第20关（手动设SAVE）
    await page.evaluate(function() {
      try { localStorage.setItem('zhan_save', JSON.stringify({version:1,catMao:250,advUnlocked:20,mazeUnlocked:true,towerUnlocked:true})); } catch(e) {}
    });
    // 返回首页→关卡选择
    await page.evaluate(function() {
      if (window.Zhan.UI && window.Zhan.UI.renderMainMenu) window.Zhan.UI.renderMainMenu();
    });
    await new Promise(function(r) { setTimeout(r, 400); });
    await page.click('#btn-adventure');
    await new Promise(function(r) { setTimeout(r, 600); });

    // 点击第20关
    var cells2 = await page.$$('.stage-cell');
    if (cells2.length >= 20) {
      await cells2[19].scrollIntoViewIfNeeded();
      await new Promise(function(r) { setTimeout(r, 200); });
      await cells2[19].click();
      await new Promise(function(r) { setTimeout(r, 1200); });

      var logText2 = await page.evaluate(function() {
        var logEl = document.getElementById('log');
        return logEl ? logEl.innerText : '';
      });
      var hasBuffLog2 = logText2.indexOf('能力值buff') >= 0;
      rst('B2', '第20关(growth=1)首回合有能力值buff日志', hasBuffLog2, hasBuffLog2 ? '' : 'NOT FOUND buff log');

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'adventure-stage20-has-buff.png') });
    } else {
      rst('B2', '第20关(growth=1)首回合有能力值buff', false, 'grid count=' + cells2.length);
    }

    // B3: 清除存档恢复
    await page.evaluate(function() {
      try { localStorage.removeItem('zhan_save'); } catch(e) {}
    });
  } else {
    rst('B1', '第1关无法进入', false, 'cells=' + (cells ? cells.length : 0));
  }

  // ============================================================
  // Report
  // ============================================================
  await browser.close();

  var md = '# 设置面板 + powerGrowth 验证报告\n\n';
  md += '> ' + new Date().toISOString() + '\n\n';
  md += '## 汇总\n\n| 状态 | 数量 |\n|------|------|\n';
  md += '| PASS | ' + passCount + ' |\n| FAIL | ' + failCount + ' |\n';
  md += '| **合计** | **' + (passCount + failCount) + '** |\n\n';
  md += '## Part A: 设置面板\n\n';
  md += '| # | 检测 | 结果 | 详情 |\n|---|------|:----:|------|\n';
  for (var ri = 0; ri < results.length; ri++) {
    if (results[ri].id.indexOf('B') !== 0) continue;
    if (ri > 0 && results[ri-1].id.indexOf('A') === 0 && results[ri].id.indexOf('B') === 0) {
      md += '\n## Part B: powerGrowth\n\n| # | 检测 | 结果 | 详情 |\n|---|------|:----:|------|\n';
    }
    md += '| ' + results[ri].id + ' | ' + results[ri].desc + ' | ' + (results[ri].passed ? '✅ PASS' : '❌ FAIL') + ' | ' + (results[ri].detail || '') + ' |\n';
  }

  md += '\n## 截图\n';
  md += '- 设置面板展开: `screenshots/settings-panel-open.png`\n';
  md += '- 第1关无buff: `screenshots/adventure-stage1-no-buff.png`\n';
  md += '- 第20关有buff: `screenshots/adventure-stage20-has-buff.png`\n';

  fs.writeFileSync(REPORT_PATH, md, 'utf8');
  console.log('\n=== ' + REPORT_PATH + ' ===');
  console.log('PASS: ' + passCount + ' / FAIL: ' + failCount + ' / TOTAL: ' + (passCount + failCount));
  process.exit(failCount > 0 ? 1 : 0);
})();
