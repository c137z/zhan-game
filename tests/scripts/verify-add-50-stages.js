// verify-add-50-stages.js
// ============================================================
//  验证 add-50-stages（冒险第6-50关数据）的浏览器端表现
// ============================================================

var playwright = require('playwright');
var path = require('path');
var fs = require('fs');

var CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
var FIXTURE_PATH = path.resolve(__dirname, '..', '..', 'code', 'index.html');
var SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');
var REPORT_PATH = path.resolve(__dirname, '..', 'reports', 'add-50-stages-report.md');
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
  var browser = await playwright.chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });
  var page = await browser.newPage();

  page.on('pageerror', function(err) {
    console.error('PAGE ERROR:', err.message);
  });

  console.log('Loading page...');
  await page.goto(FIXTURE_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await new Promise(function(r) { setTimeout(r, 1200); });

  // ============================================================
  // Test 1: 首页可见
  // ============================================================
  var mainMenu = await page.$('#main-menu');
  var battleView = await page.$('#battle-view');
  var stageSelect = await page.$('#stage-select');

  var mainMenuVisible = await page.evaluate(function(el) { return el && window.getComputedStyle(el).display !== 'none'; }, mainMenu);
  var battleHidden = await page.evaluate(function(el) { return el && window.getComputedStyle(el).display === 'none'; }, battleView);
  var stageHidden = await page.evaluate(function(el) { return el && window.getComputedStyle(el).display === 'none'; }, stageSelect);

  rst('1', '首页可见 (main-menu:flex)', mainMenuVisible, mainMenuVisible ? '' : 'main-menu display=' + (await page.evaluate(function(el) { return window.getComputedStyle(el).display; }, mainMenu)));
  rst('2', '战斗界面隐藏 (battle-view:none)', battleHidden, battleHidden ? '' : 'battle-view display=' + (await page.evaluate(function(el) { return window.getComputedStyle(el).display; }, battleView)));
  rst('3', '关卡选择隐藏 (stage-select:none)', stageHidden, stageHidden ? '' : 'stage-select display=' + (await page.evaluate(function(el) { return window.getComputedStyle(el).display; }, stageSelect)));

  // ============================================================
  // Test 2: 点击猫咪冒险→关卡选择页 50 格
  // ============================================================
  console.log('Clicking adventure button...');
  await page.click('#btn-adventure');
  await new Promise(function(r) { setTimeout(r, 600); });

  var stageGrid = await page.$('#stage-grid');
  var cellCount = await page.evaluate(function(el) { return el ? el.children.length : 0; }, stageGrid);
  rst('4', '关卡选择页显示50个格子', cellCount === 50, '实际: ' + cellCount);

  var stageVisible = await page.evaluate(function(el) { return el && window.getComputedStyle(el).display !== 'none'; }, stageSelect);
  rst('5', '关卡选择页可见', stageVisible);

  // ============================================================
  // Test 3: 解锁/锁定状态
  // ============================================================
  var cells = await page.$$('.stage-cell');
  var unlockedCount = 0, lockedCount = 0;
  for (var ci = 0; ci < cells.length; ci++) {
    var classes = await cells[ci].evaluate(function(el) { return el.className; });
    if (classes.indexOf('unlocked') >= 0) unlockedCount++;
    if (classes.indexOf('locked') >= 0) lockedCount++;
  }
  // advUnlocked初始为1(仅第1关解锁)，其余需逐关通关
  rst('6', '至少第1关解锁 (至少1个.unlocked)', unlockedCount >= 1, 'unlocked: ' + unlockedCount);
  rst('7', '有锁定关卡 (有.locked)', lockedCount >= 1, 'locked: ' + lockedCount);

  // ============================================================
  // Test 4: 点击第1关→战斗界面,Boss逗猫棒
  // ============================================================
  var firstCell = cells[0];
  await firstCell.click();
  await new Promise(function(r) { setTimeout(r, 1000); });

  var battleNowVisible = await page.evaluate(function(el) { return el && window.getComputedStyle(el).display !== 'none'; }, battleView);
  rst('8', '点击第1关后战斗界面可见', battleNowVisible);

  var bossEmoji = await page.evaluate(function() {
    var st = window.Zhan.Engine.state;
    return st && st.boss ? (st.boss.emoji || '') : '';
  });
  rst('9', '第1关Boss为逗猫棒(🪄)', bossEmoji === '🪄', '实际: ' + bossEmoji);

  var modeCheck = await page.evaluate(function() {
    var st = window.Zhan.Engine.state;
    return st ? (st.mode === 'adventure' && st.adventureStageId === 1) : false;
  });
  rst('10', '第1关mode=adventure, stageId=1', modeCheck);

  // 截图第1关战斗
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'add-50-stages-stage1.png') });

  // ============================================================
  // Test 5: 关卡选择滚动支持
  // ============================================================
  // 返回首页→关卡选择
  await page.evaluate(function() {
    var overlay = document.getElementById('result-overlay');
    if (overlay) overlay.classList.remove('show');
    if (window.Zhan.UI && window.Zhan.UI.renderMainMenu) window.Zhan.UI.renderMainMenu();
  });
  await new Promise(function(r) { setTimeout(r, 400); });

  await page.click('#btn-adventure');
  await new Promise(function(r) { setTimeout(r, 600); });

  var hasScrollStyle = await page.evaluate(function() {
    var s = document.getElementById('stage-scroll-style');
    return s ? s.textContent : null;
  });
  rst('11', '关卡选择滚动CSS注入 (max-height:85vh overflow-y:auto)', hasScrollStyle && hasScrollStyle.indexOf('max-height') >= 0 && hasScrollStyle.indexOf('overflow-y') >= 0, hasScrollStyle || 'NOT FOUND');

  // 滚动到第50关
  var allCells2 = await page.$$('.stage-cell');
  if (allCells2.length === 50) {
    await allCells2[49].scrollIntoViewIfNeeded();
    await new Promise(function(r) { setTimeout(r, 300); });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'add-50-stages-stage50-grid.png') });
    rst('12', '可滚动到第50关并截图', true, '第50格已滚动到视野');
  } else {
    rst('12', '可滚动到第50关', false, 'grid只有' + allCells2.length + '格');
  }

  // ============================================================
  // Test 6: 第50关数据验证 (Node.js 侧)
  // ============================================================
  var validate50 = await page.evaluate(function() {
    if (typeof ADVENTURE_STAGES === 'undefined') return 'ADVENTURE_STAGES undefined';
    var stage50 = ADVENTURE_STAGES[49];
    if (!stage50) return 'stage50 missing';
    return {
      id: stage50.id,
      bossId: stage50.bossId,
      name: stage50.name,
      emoji: stage50.emoji,
      hp: stage50.hp,
      atk: stage50.atk,
      cycle: stage50.cycle,
      desc: stage50.desc
    };
  });
  rst('13', 'ADVENTURE_STAGES[49]存在', typeof validate50 === 'object', JSON.stringify(validate50));
  rst('14', '第50关id=50', typeof validate50 === 'object' && validate50.id === 50, 'id=' + (validate50.id || 'N/A'));
  rst('15', '第50关bossId=straycat', typeof validate50 === 'object' && validate50.bossId === 'straycat', 'bossId=' + (validate50.bossId || 'N/A'));
  rst('16', '第50关name=野猫首领', typeof validate50 === 'object' && validate50.name === '野猫首领', 'name=' + (validate50.name || 'N/A'));
  rst('17', '第50关hp=300', typeof validate50 === 'object' && validate50.hp === 300, 'hp=' + (validate50.hp || 'N/A'));

  // ============================================================
  // Test 7: resolveCycle 新类型
  // ============================================================
  var cycle5 = await page.evaluate(function() {
    if (typeof resolveCycle !== 'function') return 'resolveCycle not found';
    var c = resolveCycle('atk_def_atk_focus_crit', 18);
    return c.map(function(x) { return x.type; });
  });
  rst('18', 'resolveCycle(atk_def_atk_focus_crit)返回5元素', Array.isArray(cycle5) && cycle5.length === 5, JSON.stringify(cycle5));
  rst('19', 'cycle类型: attack,defend,attack,focus,crit', Array.isArray(cycle5) && cycle5.join(',') === 'attack,defend,attack,focus,crit', JSON.stringify(cycle5));

  // ============================================================
  // Test 8: CAT_BOSS_IDS 存在
  // ============================================================
  var catIds = await page.evaluate(function() {
    if (typeof CAT_BOSS_IDS === 'undefined') return 'CAT_BOSS_IDS undefined';
    return CAT_BOSS_IDS.length;
  });
  rst('20', 'CAT_BOSS_IDS.length===10', catIds === 10, '实际: ' + catIds);

  // ============================================================
  // Report
  // ============================================================
  await browser.close();

  var md = '# add-50-stages 验证报告\n\n';
  md += '> 生成时间: ' + new Date().toISOString() + '\n\n';
  md += '## 汇总\n\n';
  md += '| 状态 | 数量 |\n|------|------|\n';
  md += '| PASS | ' + passCount + ' |\n';
  md += '| FAIL | ' + failCount + ' |\n';
  md += '| **合计** | **' + (passCount + failCount) + '** |\n\n';

  md += '## 逐项结果\n\n';
  md += '| # | 检测项 | 结果 | 详情 |\n|---|------|:----:|------|\n';
  for (var ri = 0; ri < results.length; ri++) {
    var r = results[ri];
    md += '| ' + r.id + ' | ' + r.desc + ' | ' + (r.passed ? '✅ PASS' : '❌ FAIL') + ' | ' + (r.detail || '') + ' |\n';
  }

  md += '\n## 截图\n\n';
  md += '- 第1关战斗: `screenshots/add-50-stages-stage1.png`\n';
  md += '- 50关网格: `screenshots/add-50-stages-stage50-grid.png`\n';

  fs.writeFileSync(REPORT_PATH, md, 'utf8');
  console.log('\n=== Report written to ' + REPORT_PATH + ' ===');
  console.log('PASS: ' + passCount + ' / FAIL: ' + failCount + ' / TOTAL: ' + (passCount + failCount));
  process.exit(failCount > 0 ? 1 : 0);
})();
