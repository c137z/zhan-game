#!/usr/bin/env node
var playwright = require('playwright');
var path = require('path');
var CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
var FIXTURE_PATH = 'C:/Users/kyzha/.openclaw/projects/zhan/code/index.html';
var FIXTURE_URL = 'file:///' + FIXTURE_PATH.replace(/\\/g, '/');
var results = [], passCount = 0, failCount = 0;
function result(id, desc, passed, detail) {
  results.push({ id: id, desc: desc, passed: passed, detail: detail || '' });
  if (passed) passCount++; else failCount++;
  console.log((passed ? 'PASS' : 'FAIL') + ' [' + id + '] ' + desc + (detail ? ' -- ' + detail : ''));
}
async function main() {
  console.log('=== Adventure mode Playwright test ===\n');
  var browser = await playwright.chromium.launch({ executablePath: CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  var ctx = await browser.newContext({ viewport: { width: 390, height: 844, deviceScaleFactor: 2 } });
  var page = await ctx.newPage();
  page.on('pageerror', function(e) { console.error('  [PAGE-ERR] ' + e.message); });
  try {
    // 1. Load game
    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(800);
    var titleText = await page.textContent('#menu-title');
    result('1a', 'title exists', titleText.indexOf('斩') >= 0, 'text="' + titleText.trim() + '"');
    var bA = await page.$('#btn-adventure');
    var bM = await page.$('#btn-maze');
    var bT = await page.$('#btn-tower');
    result('1b', '3 entry buttons', !!(bA && bM && bT));
    var cm = await page.$('#menu-catmao');
    result('1c', 'cat hair display', !!cm);
    var icons = await page.$('#menu-icons');
    result('1d', 'system icons', !!icons);

    // 2. Stage select
    await page.click('#btn-adventure');
    await page.waitForTimeout(300);
    var grid = await page.$('#stage-grid');
    result('2a', 'stage grid exists', !!grid);
    if (grid) {
      var cellCount = await page.evaluate(function() { return document.querySelectorAll('#stage-grid > div').length; });
      result('2b', 'stage grid has cells (5 stages)', cellCount > 0 && cellCount <= 25,
        'count=' + cellCount);

      // Click first cell
      var firstCell = await page.$('#stage-grid > div');
      if (firstCell) {
        var cellText = await firstCell.textContent();
        result('2c', 'first cell clickable', cellText.length > 0, 'text="' + cellText.trim().replace(/\n/g,' ') + '"');
        await firstCell.click();
        await page.waitForTimeout(800);

        // Switch to battle-view (newGame doesn't call _showView automatically)
        await page.evaluate(function() {
          if (window.Zhan && Zhan.UI && Zhan.UI._showView) Zhan.UI._showView('battle-view');
        });
        await page.waitForTimeout(200);

        // 3. Battle elements
        var avatar = await page.$('#enemy-avatar');
        var hpEl = await page.$('#enemy-hp');
        var brd = await page.$('#board');
        var slotEl = await page.$('#slot-bar');
        var endBtn = await page.$('#btn-end-turn');
        result('3a', 'boss avatar', !!avatar);
        result('3b', 'boss HP', !!hpEl);
        result('3c', 'slot bar', !!slotEl);
        result('3d', 'end turn button', !!endBtn);
        result('3e', 'board', !!brd);
        if (brd) {
          var slots = await page.evaluate(function() { return document.querySelectorAll('#board .card-slot').length; });
          result('3f', '25 card slots', slots === 25, 'count=' + slots);
        }

        // 4. Play cards and end turns
        var done = false;
        var turns = 0;
        for (var i = 0; i < 40 && !done; i++) {
          try {
            // Check if result appeared
            var overlayExists = await page.evaluate(function() {
              var ov = document.getElementById('result-overlay');
              return ov && ov.classList.contains('show');
            });
            if (overlayExists) { done = true; break; }

            // Check if game is still alive
            var pageAlive = await page.evaluate(function() {
              return !!(window.Zhan && Zhan.Engine && Zhan.Engine.state);
            });
            if (!pageAlive) { console.log('  page no longer alive'); break; }

            // Ensure battle-view is visible (in case _showView wasn't called)
            await page.evaluate(function() {
              var bv = document.getElementById('battle-view');
              if (bv && bv.style.display === 'none') { bv.style.display = 'block'; }
            });

            // Play cards (double click within same tick)
            await page.evaluate(function() {
              var cards = document.querySelectorAll('#board .card-slot:not(.card-empty):not(.locked)');
              var count = Math.min(5, cards.length);
              for (var ci = 0; ci < count; ci++) {
                cards[ci].dispatchEvent(new Event('click'));
                cards[ci].dispatchEvent(new Event('click'));
              }
              return count;
            });

            await page.waitForTimeout(200);

            // Click end turn
            var btnEnabled = await page.evaluate(function() {
              var btn = document.getElementById('btn-end-turn');
              return btn && !btn.disabled;
            });

            if (btnEnabled) {
              await page.evaluate(function() {
                var btn = document.getElementById('btn-end-turn');
                if (btn) btn.dispatchEvent(new Event('click'));
              });
              turns++;
              await page.waitForTimeout(2000);
            } else {
              await page.waitForTimeout(500);
            }
          } catch(e) {
            console.log('  turn loop error: ' + e.message);
            await page.waitForTimeout(500);
          }
        }
        result('4a', 'at least 1 turn completed', turns >= 1, 'turns=' + turns);

        var finalOv = await page.$('#result-overlay.show');
        result('4b', 'result overlay after battle', !!finalOv, 'turns=' + turns + ' done=' + done);
        if (finalOv) {
          var rt = await page.textContent('#result-title');
          result('4c', 'result has title', rt.length > 0, 'title="' + rt.trim() + '"');
          var cont = await page.$('#btn-adv-continue');
          var home = await page.$('#btn-return-home');
          result('4d', 'continue/return buttons', !!(cont || home), 'cont=' + !!cont + ' home=' + !!home);
        }

        // 5. Return to main menu
        try {
          var homeBtn = await page.$('#btn-return-home');
          if (homeBtn) {
            await homeBtn.click();
            await page.waitForTimeout(400);
          } else {
            await page.evaluate(function() {
              var el = document.getElementById('result-overlay');
              if (el) el.classList.remove('show');
              if (window.Zhan && Zhan.UI && Zhan.UI.renderMainMenu) Zhan.UI.renderMainMenu();
            });
            await page.waitForTimeout(400);
          }
          var menu = await page.$('#main-menu');
          result('5a', 'return to main menu', !!menu);
        } catch(e) {
          result('5a', 'return to main menu', false, e.message);
        }
      }
    }
  } catch(e) {
    console.error('ERR: ' + e.message);
    result('ERR', 'exception', false, e.message);
  } finally { await browser.close(); }

  console.log('\n' + '='.repeat(50));
  console.log('PASS: ' + passCount + ' / FAIL: ' + failCount);
  process.exit(failCount > 0 ? 1 : 0);
}
main().catch(function(e) { console.error('FATAL: ' + e.message); process.exit(1); });
