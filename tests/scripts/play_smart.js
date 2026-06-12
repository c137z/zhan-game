// ============================================================
//  play_smart.js — Playwright 智能游玩 + 战斗日志采集
//  模式：双圣物 + 猫 Boss 塔式连续挑战（HP 200）
//  策略 v2：预读意图、算余量延伸连击、眩晕防暴击
//  用法: node play_smart.js [局数]
//  输出: play_logs_<timestamp>.jsonl
// ============================================================

var playwright = require('playwright');
var fs = require('fs');
var path = require('path');

var TOTAL_RUNS = parseInt(process.argv[2], 10) || 10;
var CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
var FIXTURE_PATH = path.resolve(__dirname, '..', '..', 'code', 'index.html');
var LOG_FILE = path.resolve(__dirname, '..', '..', 'code', 'play_logs_' + Date.now() + '.jsonl');

console.log('🔧 日志输出: ' + LOG_FILE);
console.log('');

// ===== 工具函数（在浏览器页面上执行）=====
var FN_START_RUN = function(args) {
  // 压缩卡组：多攻击、少防守，让 AI 更容易凑大连击
  var deck = {
    attack: 160, defend: 40, heal: 20, wild: 30,
    atk_down: 20, vulnerable: 40, stun: 20,
    atk_buff: 40, def_buff: 10
  };
  newGame({ mode: 'normal', bossId: args.bossId, activeRelics: args.relics,
    currentStage: 2, seed: Date.now(), deckOverride: deck });
  var st = Zhan.Engine.state;
  st.enemyHP = 60;
  st.enemyMaxHP = 60;
  Zhan.UI._showView('battle-view');
};

var FN_READ_BOARD = function() {
  var st = Zhan.Engine.state;
  if (!st || st.over) return null;
  var slotTypes = (st.slot || []).map(function(c) { return c ? c.type : null; });
  var piles = [];
  for (var r = 0; r < 5; r++) {
    for (var c = 0; c < 5; c++) {
      var pile = st.piles && st.piles[r] && st.piles[r][c];
      var top = (pile && pile.length) ? pile[pile.length - 1] : null;
      piles.push({
        r: r, c: c, topType: top ? top.type : null,
        count: pile ? pile.length : 0,
        locked: st.lockedPiles && st.lockedPiles[r*5+c] ? true : false,
        smeared: st.smearedPiles && st.smearedPiles[r*5+c] ? true : false
      });
    }
  }
  return {
    playerHP: st.playerHP, playerMaxHP: st.playerMaxHP, playerShield: st.playerShield,
    slotLen: st.slot ? st.slot.length : 0,
    maxSlot: st.effectiveSlotSize || 10,
    slotTypes: slotTypes,
    piles: piles,
    removeUsed: st.removeUsed || 0,
    shuffleUsed: st.shuffleUsed || 0,
    turn: st.turn,
    // Boss 意图
    bossIntent: st._intentHTML || '',
    // 下回合 Boss 行动索引
    nextBossAction: (function() {
      if (!st.boss || !st.boss.cycle) return null;
      var t = st.turn;
      // 当前 cycle 索引：turn=0 显示 T0 意图
      var cycleIdx = t % st.boss.cycle.length;
      var nextCycle = st.boss.cycle[cycleIdx];
      return nextCycle ? nextCycle.type : null;
    })()
  };
};

var FN_COLLECT_LOG = function(killCount) {
  var st = Zhan.Engine.state;
  if (!st) return null;
  return {
    seed: st.battleSeed || 0,
    killCount: killCount,
    boss: (st.boss && st.boss.name) || 'unknown',
    bossId: (st.boss && st.boss.id) || 'unknown',
    relics: st.activeRelicNames || [],
    turn: st.turn || 0,
    result: st.win ? 'win' : 'lose',
    playerHP: Math.max(0, st.playerHP || 0),
    playerMaxHP: st.playerMaxHP || 100,
    enemyHP: Math.max(0, st.enemyHP || 0),
    enemyMaxHP: st.enemyMaxHP || 200,
    maxCombo: st.maxCombo || 0,
    maxDamage: st.maxDamage || 0,
    totalDamage: st.totalDamage || 0,
    logs: st.logLines
  };
};

// ===== 主流程 =====
async function main() {
  var browser = await playwright.chromium.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: ['--no-sandbox', '--disable-gpu']
  });
  var context = await browser.newContext({
    viewport: { width: 480, height: 900 },
    deviceScaleFactor: 2
  });
  var page = await context.newPage();

  console.log('🔧 打开游戏...');
  await page.goto('file:///' + FIXTURE_PATH.replace(/\\/g, '/'), { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('#main-menu', { timeout: 5000 });
  console.log('✅ 首页加载完成\n');

  var totalLogs = 0;

  for (var run = 1; run <= TOTAL_RUNS; run++) {
    console.log('═══ 第 ' + run + '/' + TOTAL_RUNS + ' 轮 ═══');

    try {
      // 固定圣物组合：连击核心 + 狂暴核心 + 生命核心
      var relics = ['combo_core', 'fury_core', 'life_core'];

      var allCatIds = await page.evaluate(function() { return CAT_BOSS_IDS; });
      var beaten = [];
      var currentBossId = allCatIds[Math.floor(Math.random() * allCatIds.length)];
      var killCount = 0;
      var runLogs = [];

      while (currentBossId) {
        await page.evaluate(FN_START_RUN, { relics: relics, bossId: currentBossId });
        await page.waitForTimeout(500);

        var maxSteps = 400;
        var stepCount = 0;
        var lastPlayedType = null;
        while (stepCount < maxSteps) {
          stepCount++;
          var gameOver = await page.evaluate(function() {
            var st = Zhan.Engine.state;
            return st ? st.over : true;
          });
          if (gameOver) break;

          // 确保是玩家回合（最多等 2 秒）
          var phase = await page.evaluate(function() {
            var st = Zhan.Engine.state;
            return st ? st.phase : 'unknown';
          });
          if (phase !== 'player') { await page.waitForTimeout(150); continue; }

          var info = await page.evaluate(FN_READ_BOARD);
          if (!info) break;

          var available = info.piles.filter(function(p) {
            return p.count > 0 && !p.locked && !p.smeared;
          });
          if (available.length === 0 && info.slotLen === 0) { break; }

          // 统计场上各类型顶牌数量
          var topCounts = {};
          for (var ai = 0; ai < available.length; ai++) {
            var tp = available[ai].topType;
            if (tp && tp !== 'junk') topCounts[tp] = (topCounts[tp] || 0) + 1;
          }

          // 统计槽里各类型数量
          var slotCounts = {};
          for (var si = 0; si < info.slotTypes.length; si++) {
            var t = info.slotTypes[si];
            if (t) slotCounts[t] = (slotCounts[t] || 0) + 1;
          }

          var hpRatio = info.playerHP / info.playerMaxHP;
          var nextAction = info.nextBossAction;
          var slotLen = info.slotLen;
          var maxSlot = info.maxSlot;
          var picked = false;

          // ===== 简化后的策略：死磕攻击 =====

          // 【致命暴击防御】Boss 下回合暴击 → 找眩晕
          if (nextAction === 'crit') {
            var stunCard = available.find(function(p) { return p.topType === 'stun'; });
            if (stunCard && slotLen < maxSlot - 1) {
              await playCard(page, stunCard.r, stunCard.c); picked = true;
            }
            // 没眩晕且低血量 → 防/奶
            if (!picked && hpRatio < 0.5) {
              var defCard = available.find(function(p) { return p.topType === 'defend' || p.topType === 'heal'; });
              if (defCard && slotLen < maxSlot - 1) {
                await playCard(page, defCard.r, defCard.c); picked = true;
              }
            }
          }

          // 【残血保命】
          if (!picked && hpRatio < 0.25) {
            var safeCard = available.find(function(p) { return p.topType === 'defend' || p.topType === 'heal'; });
            if (safeCard && slotLen < maxSlot - 1) {
              await playCard(page, safeCard.r, safeCard.c); picked = true;
            }
          }

          if (!picked) {
            // 【核心策略】死磕攻击，少量配 buff
            // 槽空 → 先拉 attack，凑够 5+ 张做主攻
            // 槽有攻击 → 继续补 attack 到 7+ 张
            // 剩余 2-3 格补 atk_buff/vulnerable
            var attackCount = slotCounts['attack'] || 0;
            var buffCount = (slotCounts['atk_buff']||0) + (slotCounts['vulnerable']||0);

            // 还有多少空位
            var emptySlots = maxSlot - 1 - slotLen;

            if (slotLen === 0) {
              // 起手：优先找 attack
              if ((topCounts['attack'] || 0) >= 2) {
                var card = available.find(function(p) { return p.topType === 'attack'; });
                if (card) { await playCard(page, card.r, card.c); picked = true; }
              } else {
                // attack 不够 → 拿场上最多的攻击相关
                for (var pi = 0; pi < ['vulnerable','atk_buff','atk_down','stun','def_buff','heal','defend','wild'].length; pi++) {
                  var t = ['vulnerable','atk_buff','atk_down','stun','def_buff','heal','defend','wild'][pi];
                  if ((topCounts[t] || 0) >= 2) {
                    var card = available.find(function(p) { return p.topType === t; });
                    if (card) { await playCard(page, card.r, card.c); picked = true; break; }
                  }
                }
              }
            } else {
              // 槽有牌：继续补攻击（主攻）或 buff（副攻）
              // 如果攻击还没堆够，优先补攻击
              if (attackCount < 5 && (topCounts['attack'] || 0) > 0) {
                var card = available.find(function(p) { return p.topType === 'attack'; });
                if (card) { await playCard(page, card.r, card.c); picked = true; }
              }
              // 攻击堆够了或场上没攻击牌了 → 补 buff
              if (!picked && buffCount < 3 && emptySlots >= 1) {
                var buffTargets = ['atk_buff', 'vulnerable'];
                for (var bi = 0; bi < buffTargets.length; bi++) {
                  if ((topCounts[buffTargets[bi]] || 0) > 0) {
                    var card = available.find(function(p) { return p.topType === buffTargets[bi]; });
                    if (card) { await playCard(page, card.r, card.c); picked = true; break; }
                  }
                }
              }
              // 补万能
              if (!picked) {
                var wild = available.find(function(p) { return p.topType === 'wild'; });
                if (wild) { await playCard(page, wild.r, wild.c); picked = true; }
              }
              // 场上只剩防守牌，拉一张保命
              if (!picked && hpRatio < 0.5) {
                var def = available.find(function(p) { return p.topType === 'defend' || p.topType === 'heal'; });
                if (def) { await playCard(page, def.r, def.c); picked = true; }
              }
            }
          }

          // 保底：实在没牌出就洗牌
          if (!picked) {
            var playable = available.filter(function(p) { return !p.locked; });
            if (playable.length <= 2 && info.shuffleUsed < 1) {
              await page.click('#btn-shuffle');
              await page.waitForTimeout(200);
              picked = true;
            }
          }

          // 最终保底
          if (!picked && available.length > 0 && slotLen < maxSlot - 1) {
            var best = null, bestCnt = 0;
            for (var ct in topCounts) { if (topCounts[ct] > bestCnt) { bestCnt = topCounts[ct]; best = ct; } }
            var card = best ? available.find(function(p) { return p.topType === best; }) : available[0];
            if (card) { await playCard(page, card.r, card.c); picked = true; }
          }

          // 重新读槽状态，决定是否结束回合
          var info2 = await page.evaluate(FN_READ_BOARD);
          if (info2) info = info2;

          var finalCounts = {};
          for (var si3 = 0; si3 < info.slotTypes.length; si3++) {
            var t3 = info.slotTypes[si3];
            if (t3) finalCounts[t3] = (finalCounts[t3] || 0) + 1;
          }
          var maxTypeCount = 0;
          for (var fc in finalCounts) { if (finalCounts[fc] > maxTypeCount) maxTypeCount = finalCounts[fc]; }

          var shouldEnd = false;
          // 必须堆满至少 7 张才结束回合
          if (info.slotLen >= info.maxSlot - 1) shouldEnd = true;
          if (info.slotLen >= 7 && maxTypeCount >= 4) shouldEnd = true;
          if (info.slotLen >= 5 && maxTypeCount >= 5) shouldEnd = true;
          if (info.slotLen >= 3 && hpRatio < 0.1) shouldEnd = true;  // 垂死挣扎

          if (shouldEnd && info.slotLen > 0) {
            await page.click('#btn-end-turn');
            await page.waitForTimeout(500);
          } else if (!picked) {
            await page.waitForTimeout(50);
          }
        }

        // 等结算
        await page.waitForTimeout(1000);

        var logData = await page.evaluate(FN_COLLECT_LOG, killCount);
        if (logData) runLogs.push(logData);

        var didWin = await page.evaluate(function() {
          var st = Zhan.Engine.state;
          return st ? st.win : false;
        });

        if (didWin) {
          killCount++;
          beaten.push(currentBossId);
          console.log('  ✅ 击杀 ' + logData.boss + ' (连胜 ' + killCount + ')');

          // 关掉结算面板
          await page.evaluate(function() {
            var overlay = document.getElementById('result-overlay');
            if (overlay) overlay.classList.remove('show');
          });
          await page.waitForTimeout(200);

          var unpicked = allCatIds.filter(function(id) { return beaten.indexOf(id) < 0; });
          if (unpicked.length > 0) {
            currentBossId = unpicked[Math.floor(Math.random() * unpicked.length)];
            continue;
          } else {
            console.log('  🏆 全猫通关！');
            currentBossId = null;
          }
        } else {
          console.log('  ❌ 败于 ' + logData.boss + ' | 击杀 ' + killCount + ' 只');
          currentBossId = null;
        }
      }

      // 写日志
      for (var li = 0; li < runLogs.length; li++) {
        fs.appendFileSync(LOG_FILE, JSON.stringify(runLogs[li]) + '\n', 'utf8');
        totalLogs++;
      }
      console.log('  本轮 ' + runLogs.length + ' 局\n');

      await page.evaluate(function() {
        var overlay = document.getElementById('result-overlay');
        if (overlay && overlay.classList.contains('show')) {
          var btn = document.getElementById('btn-return-home');
          if (btn) btn.click();
        }
        window.Zhan.UI.renderMainMenu();
      });
      await page.waitForTimeout(500);

    } catch(e) {
      console.log('  ❌ 轮异常: ' + e.message);
      try { await page.evaluate(function() { window.Zhan.UI.renderMainMenu(); }); } catch(e2) {}
    }
  }

  console.log('\n=== 完成 ===');
  console.log('运行轮数: ' + TOTAL_RUNS);
  console.log('成功采集: ' + totalLogs + ' 局');
  console.log('日志文件: ' + LOG_FILE);

  await browser.close();
}

async function playCard(page, r, c) {
  await page.evaluate(function(args) {
    var st = Zhan.Engine.state;
    if (st && st.phase === 'player' && !st.over) {
      Zhan.Engine.dispatch({ type: 'PLAY_CARD', r: args.r, c: args.c });
    }
  }, {r: r, c: c});
  await page.waitForTimeout(80);
}

main().catch(function(e) {
  console.error('FATAL: ' + e.message);
  console.error(e.stack);
  process.exit(1);
});
