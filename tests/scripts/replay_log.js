// ============================================================
//  replay_log.js — 读日志文件 → 按种子重跑 → 验证回归
//  策略直接复用 play_smart.js 的策略逻辑
//  用法: node replay_log.js <日志文件.jsonl>
// ============================================================

var playwright = require('playwright');
var fs = require('fs');
var path = require('path');

var LOG_FILE = process.argv[2];
if (!LOG_FILE) { console.error('用法: node replay_log.js <日志文件.jsonl>'); process.exit(1); }

var CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
var FIXTURE_PATH = path.resolve(__dirname, '..', '..', 'code', 'index.html');

var games = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
console.log('读取 ' + games.length + ' 局日志\n');

// ===== 策略函数（与 play_smart.js 一致的决策逻辑）=====
var FN_READ_BOARD = function() {
  var st = Zhan.Engine.state;
  if (!st || st.over) return null;
  var slotTypes = (st.slot || []).map(function(c) { return c ? c.type : null; });
  var piles = [];
  for (var r = 0; r < 5; r++) {
    for (var c = 0; c < 5; c++) {
      var pile = st.piles && st.piles[r] && st.piles[r][c];
      var top = (pile && pile.length) ? pile[pile.length - 1] : null;
      piles.push({ r:r, c:c, topType: top ? top.type : null, count: pile ? pile.length : 0,
        locked: st.lockedPiles && st.lockedPiles[r*5+c] ? true : false });
    }
  }
  return {
    playerHP: st.playerHP, playerMaxHP: st.playerMaxHP, playerShield: st.playerShield,
    slotLen: st.slot ? st.slot.length : 0, maxSlot: st.effectiveSlotSize || 10,
    slotTypes: slotTypes, piles: piles,
    removeUsed: st.removeUsed || 0, shuffleUsed: st.shuffleUsed || 0
  };
};

async function playCard(page, r, c) {
  await page.evaluate(function(args) {
    var st = Zhan.Engine.state;
    if (st && st.phase === 'player' && !st.over) Zhan.Engine.dispatch({ type:'PLAY_CARD', r:args.r, c:args.c });
  }, {r:r, c:c});
  await page.waitForTimeout(80);
}

async function main() {
  var browser = await playwright.chromium.launch({
    executablePath: CHROME_PATH, headless: false, args: ['--no-sandbox','--disable-gpu']
  });
  var page = await (await browser.newContext({ viewport:{width:480,height:900}, deviceScaleFactor:2 })).newPage();

  await page.goto('file:///' + FIXTURE_PATH.replace(/\\/g, '/'), { waitUntil:'networkidle', timeout:15000 });
  await page.waitForSelector('#main-menu', { timeout:5000 });
  console.log('✅ 首页加载完成\n');

  var same = 0, diff = 0;

  for (var gi = 0; gi < games.length; gi++) {
    var g = games[gi];

    // 启动战斗：用日志中的 seed + relics + bossId
    var deck = { attack:160, defend:40, heal:20, wild:30, atk_down:20, vulnerable:40, stun:20, atk_buff:40, def_buff:10 };
    await page.evaluate(function(args) {
      newGame({ mode:'normal', bossId:args.bossId, activeRelics:args.relics, currentStage:2, seed:args.seed, deckOverride:args.deck });
      var st = Zhan.Engine.state;
      st.enemyHP = 60; st.enemyMaxHP = 60;
      Zhan.UI._showView('battle-view');
    }, { seed:g.seed, bossId:g.bossId, relics:g.relics || [], deck: deck });
    await page.waitForTimeout(400);

    // 智能出牌（与 play_smart.js 策略一致）
    var maxSteps = 400;
    for (var step = 0; step < maxSteps; step++) {
      var over = await page.evaluate(function() { var st=Zhan.Engine.state; return st?st.over:true; });
      if (over) break;

      var phase = await page.evaluate(function() { var st=Zhan.Engine.state; return st?st.phase:'unknown'; });
      if (phase !== 'player') { await page.waitForTimeout(150); continue; }

      var info = await page.evaluate(FN_READ_BOARD);
      if (!info) break;

      var available = info.piles.filter(function(p) { return p.count > 0 && !p.locked; });
      if (available.length === 0 && info.slotLen === 0) break;

      var slotCounts = {};
      for (var si = 0; si < info.slotTypes.length; si++) { var t = info.slotTypes[si]; if (t) slotCounts[t] = (slotCounts[t]||0)+1; }

      var picked = false;
      var attackCount = slotCounts['attack'] || 0;

      // 【起手】槽空
      if (info.slotLen === 0) {
        var order = ['attack','vulnerable','atk_buff','wild','atk_down','stun','def_buff','heal','defend'];
        for (var oi = 0; oi < order.length; oi++) {
          var c = available.find(function(p) { return p.topType === order[oi]; });
          if (c) { await playCard(page, c.r, c.c); picked = true; break; }
        }
      } else {
        // 【核心】死磕攻击
        if (attackCount < 6) {
          var c = available.find(function(p) { return p.topType === 'attack'; });
          if (c) { await playCard(page, c.r, c.c); picked = true; }
        }
        // 【buff】补暴击/破甲
        if (!picked) {
          var buffTargets = ['atk_buff','vulnerable'];
          for (var bi = 0; bi < buffTargets.length; bi++) {
            var c = available.find(function(p) { return p.topType === buffTargets[bi]; });
            if (c) { await playCard(page, c.r, c.c); picked = true; break; }
          }
        }
        // 【万能】
        if (!picked) {
          var c = available.find(function(p) { return p.topType === 'wild'; });
          if (c) { await playCard(page, c.r, c.c); picked = true; }
        }
        // 【低血量保命】
        if (!picked && info.playerHP / info.playerMaxHP < 0.3) {
          var c = available.find(function(p) { return p.topType === 'defend' || p.topType === 'heal'; });
          if (c) { await playCard(page, c.r, c.c); picked = true; }
        }
        // 【保底】
        if (!picked && available.length > 0 && info.slotLen < info.maxSlot - 1) {
          await playCard(page, available[0].r, available[0].c); picked = true;
        }
      }

      // 决定是否结束回合
      var info2 = await page.evaluate(FN_READ_BOARD);
      if (info2) info = info2;

      var finalCounts = {};
      for (var si2 = 0; si2 < info.slotTypes.length; si2++) { var t2 = info.slotTypes[si2]; if (t2) finalCounts[t2] = (finalCounts[t2]||0)+1; }
      var bestCount = 0; for (var fc in finalCounts) { if (finalCounts[fc] > bestCount) bestCount = finalCounts[fc]; }

      var endIt = false;
      if (info.slotLen >= info.maxSlot - 1) endIt = true;
      if (info.slotLen >= 7 && bestCount >= 4) endIt = true;
      if (info.slotLen >= 5 && bestCount >= 5) endIt = true;

      if (endIt && info.slotLen > 0) {
        await page.click('#btn-end-turn');
        await page.waitForTimeout(500);
      } else if (!picked) {
        await page.waitForTimeout(50);
      }
    }

    // 等结算
    await page.waitForTimeout(800);

    // 关结算面板
    await page.evaluate(function() {
      var overlay = document.getElementById('result-overlay');
      if (overlay) overlay.classList.remove('show');
    });
    await page.waitForTimeout(200);

    // 采集结果
    var result = await page.evaluate(function() {
      var st = Zhan.Engine.state; if (!st) return null;
      return {
        win: st.win, turn: st.turn, maxCombo: st.maxCombo || 0,
        maxDamage: st.maxDamage || 0, totalDamage: st.totalDamage || 0,
        enemyHP: Math.max(0,st.enemyHP||0), enemyMaxHP: st.enemyMaxHP || 60
      };
    });

    if (result) {
      var oldWon = g.result === 'win';
      var sameResult = result.win === oldWon;
      if (sameResult) same++; else diff++;
      var icon = sameResult ? '✅' : '⚠️';
      console.log(icon + ' #' + (gi+1) + ' ' + (g.bossName || g.boss || '?') +
        ' | seed=' + g.seed +
        ' 原始: ' + (oldWon?'胜':'负') + ' 重跑: ' + (result.win?'胜':'负') +
        ' | turn=' + result.turn + ' combo=' + result.maxCombo +
        ' dmg=' + result.maxDamage + ' total=' + result.totalDamage +
        ' enemy=' + result.enemyHP + '/' + result.enemyMaxHP);
    }
  }

  console.log('\n=== 完成 ===');
  console.log('重跑 ' + games.length + ' 局');
  console.log('结果一致: ' + same + ' | 结果差异: ' + diff);
  if (diff > 0) console.log('⚠️ 差异局可能因 AI 决策波动，需人工确认');

  await browser.close();
}

main().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
