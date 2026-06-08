// verify-global-settings.js
var playwright = require('playwright'), path = require('path'), fs = require('fs');
var CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
var FIXTURE_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'code', 'index.html').replace(/\\/g, '/');
var SD = path.resolve(__dirname, '..', 'screenshots');
var RP = path.resolve(__dirname, '..', 'reports', 'global-settings-report.md');
if (!fs.existsSync(SD)) fs.mkdirSync(SD, { recursive: true });

var rs = [], pc = 0, fc = 0;
function r(id, desc, pass, det) {
  rs.push({id:id, desc:desc, pass:pass, det:det||''});
  if (pass) pc++; else fc++;
  console.log((pass?'PASS':'FAIL') + ' [' + id + '] ' + desc + (det ? ' — ' + det : ''));
}

(async function() {
  var b = await playwright.chromium.launch({executablePath:CHROME_PATH, headless:true});
  var p = await b.newPage();
  p.on('pageerror', function(e) { console.error('PAGE ERROR:', e.message); });

  await p.goto(FIXTURE_URL, { waitUntil:'networkidle', timeout:15000 });
  await new Promise(function(res) { setTimeout(res, 1200); });

  // === A: 齿轮全局常驻 ===
  var gear = await p.$('#btn-settings');
  r('A1', '齿轮按钮存在', gear !== null);
  
  // 齿轮在首页可见
  var gv = await p.evaluate(function() { var el=document.getElementById('btn-settings'); return el && window.getComputedStyle(el).display !== 'none'; });
  r('A2', '首页齿轮可见', gv);

  // 齿轮 position:fixed
  var gp = await p.evaluate(function() { return window.getComputedStyle(document.getElementById('btn-settings')).position; });
  r('A3', '齿轮position:fixed', gp === 'fixed', gp);

  // 设置面板position:fixed
  var sp = await p.evaluate(function() { return window.getComputedStyle(document.getElementById('settings-panel')).position; });
  r('A4', '设置面板position:fixed', sp === 'fixed', sp);

  // === B: 进入战斗→齿轮仍可见 ===
  await p.click('#btn-adventure');
  await new Promise(function(res) { setTimeout(res, 600); });
  var cells = await p.$$('.stage-cell');
  if (cells.length > 0) {
    await cells[0].click();
    await new Promise(function(res) { setTimeout(res, 1200); });
    
    var gv_battle = await p.evaluate(function() { var el=document.getElementById('btn-settings'); return el && window.getComputedStyle(el).display !== 'none'; });
    r('B1', '战斗界面齿轮仍可见', gv_battle);

    // 战斗界面点齿轮→设置面板弹出
    await p.click('#btn-settings');
    await new Promise(function(res) { setTimeout(res, 300); });
    var spv = await p.evaluate(function() { var el=document.getElementById('settings-panel'); return el && window.getComputedStyle(el).display !== 'none'; });
    r('B2', '战斗界面齿轮→面板展开', spv);
    await p.click('#btn-settings'); // 收起

    // 先确保设置面板收起
    await p.evaluate(function() { var sp=document.getElementById('settings-panel'); if(sp) sp.classList.remove('show'); });
    await new Promise(function(res) { setTimeout(res, 200); });

    // === C: 点击敌人头像弹窗 ===
    await p.click('#enemy-avatar');
    await new Promise(function(res) { setTimeout(res, 400); });
    var biv = await p.evaluate(function() { var el=document.getElementById('boss-info-overlay'); return el && el.style.display !== 'none'; });
    r('C1', '点击敌人→Boss信息弹窗', biv, biv ? '' : 'NOT SHOWN');

    var bim = await p.evaluate(function() { return document.getElementById('boss-info-mechanic').textContent; });
    r('C2', '第1关Boss弹窗有内容', bim && bim.length > 0, bim);

    // 关闭弹窗（用evaluate绕过z-index冲突）
    await p.evaluate(function() { document.getElementById('boss-info-overlay').style.display = 'none'; });
    await p.screenshot({ path: path.join(SD, 'global-settings-battle.png') });
    await new Promise(function(res) { setTimeout(res, 400); });

    // === D: 第20关能力值描述 ===
    // 先返回首页
    await p.evaluate(function() {
      var ov = document.getElementById('result-overlay');
      if (ov) ov.classList.remove('show');
      try { localStorage.setItem('zhan_save', JSON.stringify({version:1,catMao:250,advUnlocked:20,mazeUnlocked:true,towerUnlocked:true})); } catch(e){}
      if(window.Zhan.UI&&window.Zhan.UI.renderMainMenu)window.Zhan.UI.renderMainMenu();
    });
    await new Promise(function(res) { setTimeout(res, 600); });
    await p.click('#btn-adventure');
    await new Promise(function(res) { setTimeout(res, 600); });
    var cells2 = await p.$$('.stage-cell');
    if (cells2.length >= 20) {
      await cells2[19].scrollIntoViewIfNeeded();
      await new Promise(function(res) { setTimeout(res, 300); });
      await cells2[19].click();
      // 等待战斗加载
      await new Promise(function(res) { setTimeout(res, 2000); });

      // 确认 enemy-avatar 可见后再点击
      try {
        await p.waitForSelector('#enemy-avatar', { state: 'visible', timeout: 5000 });
        await p.click('#enemy-avatar');
        await new Promise(function(res) { setTimeout(res, 400); });
        var stats20 = await p.evaluate(function() { return document.getElementById('boss-info-stats').textContent; });
        var hasGrowth = stats20.indexOf('每回合攻击+') >= 0;
        r('D1', '第20关弹窗显示能力值加成', hasGrowth, stats20);
        await p.screenshot({ path: path.join(SD, 'global-settings-stage20-boss.png') });
      } catch(derr) {
        r('D1', '第20关enemy-avatar不可见', false, derr.message);
      }
    } else {
      r('D1', '第20关无法进入', false, 'cells=' + cells2.length);
    }

    // 清理存档
    await p.evaluate(function() { try { localStorage.removeItem('zhan_save'); } catch(e){} });
  }

  await b.close();

  var md = '# 齿轮全局 + Boss点击弹窗 验证报告\n\n> ' + new Date().toISOString() + '\n\n';
  md += '| 状态 | 数量 |\n|------|------|\n| PASS | ' + pc + ' |\n| FAIL | ' + fc + ' |\n| **合计** | **' + (pc+fc) + '** |\n\n## 逐项\n\n| # | 检测 | 结果 | 详情 |\n|---|------|:----:|------|\n';
  for (var ri = 0; ri < rs.length; ri++) {
    md += '| ' + rs[ri].id + ' | ' + rs[ri].desc + ' | ' + (rs[ri].pass?'✅ PASS':'❌ FAIL') + ' | ' + (rs[ri].det||'') + ' |\n';
  }
  md += '\n## 截图\n- 战斗界面齿轮: `screenshots/global-settings-battle.png`\n- 第20关Boss弹窗: `screenshots/global-settings-stage20-boss.png`\n';
  fs.writeFileSync(RP, md, 'utf8');
  console.log('\n=== ' + RP + ' ===');
  console.log('PASS: ' + pc + ' / FAIL: ' + fc);
  process.exit(fc > 0 ? 1 : 0);
})();
