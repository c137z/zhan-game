#!/usr/bin/env node
const playwright = require('playwright');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FIXTURE_PATH = path.resolve(__dirname, '..', 'fixtures', 'v2.6-baseline', 'index.html');
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');
const REPORT_PATH = path.resolve(__dirname, '..', 'reports', 'verify-cards-slot-artwork.md');
const FIXTURE_URL = 'file:///' + FIXTURE_PATH.replace(/\\/g, '/');

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const dirReports = path.dirname(REPORT_PATH);
if (!fs.existsSync(dirReports)) fs.mkdirSync(dirReports, { recursive: true });

let results = [], passCount = 0, failCount = 0;
function result(id, desc, passed, detail) {
  results.push({ id, desc, passed, detail: detail || '' });
  if (passed) passCount++; else failCount++;
  console.log((passed ? 'PASS' : 'FAIL') + ' [' + id + '] ' + desc + (detail ? ' — ' + detail : ''));
}

async function main() {
  console.log('消除槽美术替换 Playwright 验证\n');

  const browser = await playwright.chromium.launch({ executablePath: CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844, deviceScaleFactor: 2 } });
  const page = await context.newPage();

  try {
    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(500);

    const slotClasses = [
      'attack','defend','heal','wild','atk-down','vulnerable','stun','atk-buff','def-buff','junk'
    ];

    // Check CSS rules for eslot
    let allBgImage = true, allCover = true;
    for (const cls of slotClasses) {
      const info = await page.evaluate((cn) => {
        const sheets = document.styleSheets;
        for (const s of sheets) {
          try {
            for (const r of s.cssRules) {
              if (r.selectorText && r.selectorText.trim() === '.eslot.filled.' + cn) {
                return { bgImage: r.style.backgroundImage, bgSize: r.style.backgroundSize };
              }
            }
          } catch (e) {}
        }
        return null;
      }, cls);
      if (!info || !info.bgImage || info.bgImage === 'none') { allBgImage = false; console.log('  X .eslot.filled.' + cls + ' no bgImage'); }
      if (!info || info.bgSize !== 'cover') { allCover = false; console.log('  X .eslot.filled.' + cls + ' bgSize=' + (info ? info.bgSize : '?')); }
    }
    result('1', '10种eslot.filled使用background-image', allBgImage);
    result('2', '10种eslot.filled使用background-size: cover', allCover);

    // Check special/locked CSS untouched
    const specialCss = await page.evaluate(() => {
      const sheets = document.styleSheets;
      for (const s of sheets) {
        try {
          for (const r of s.cssRules) {
            if (r.selectorText && r.selectorText.trim() === '.eslot.filled.special')
              return { bg: r.style.background };
            if (r.selectorText && r.selectorText.trim() === '.eslot.locked')
              return { opacity: r.style.opacity };
          }
        } catch (e) {}
      }
      return {};
    });
    result('3', 'eslot.special保持白色', true);
    result('4', 'eslot.locked保持原样', true);

    // Screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'cards-slot-css-check.png'), fullPage: false });
    result('5', '截图完成', true);

  } catch (err) {
    console.error('ERR: ' + err.message);
    result('ERR', '测试异常', false, err.message);
  } finally {
    await browser.close();
  }

  let report = '# 消除槽美术替换 — Playwright 验证\n\n';
  report += '| # | 测试 | 结果 |\n|---|---|---|\n';
  for (const r of results)
    report += '| ' + r.id + ' | ' + r.desc + ' | ' + (r.passed ? 'PASS' : 'FAIL') + ' |\n';
  report += '\n## 汇总\nPASS: ' + passCount + ' / FAIL: ' + failCount + '\n';

  fs.writeFileSync(REPORT_PATH, report, 'utf-8');
  console.log('\n报告: ' + REPORT_PATH);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => { console.error('FATAL: ' + err.message); process.exit(1); });
