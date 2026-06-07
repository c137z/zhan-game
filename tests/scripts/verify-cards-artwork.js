#!/usr/bin/env node
// ============================================================
//  verify-cards-artwork.js — 卡牌美术替换v1 Playwright验证
//  验证：CSS规则、文字白底黑字、特殊卡保留
// ============================================================

const playwright = require('playwright');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FIXTURE_PATH = path.resolve(__dirname, '..', 'fixtures', 'v2.6-baseline', 'index.html');
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');
const REPORT_PATH = path.resolve(__dirname, '..', 'reports', 'verify-cards-artwork.md');
const FIXTURE_URL = 'file:///' + FIXTURE_PATH.replace(/\\/g, '/');

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const dirReports = path.dirname(REPORT_PATH);
if (!fs.existsSync(dirReports)) fs.mkdirSync(dirReports, { recursive: true });

let results = [];
let passCount = 0;
let failCount = 0;

function result(id, desc, passed, detail) {
  results.push({ id, desc, passed, detail: detail || '' });
  if (passed) passCount++; else failCount++;
  console.log((passed ? 'PASS' : 'FAIL') + ' [' + id + '] ' + desc + (detail ? ' — ' + detail : ''));
}

async function main() {
  console.log('卡牌美术替换 Playwright 验证');
  console.log('Fixture: ' + FIXTURE_PATH + '\n');

  const browser = await playwright.chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844, deviceScaleFactor: 2 }
  });
  const page = await context.newPage();

  try {
    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'cards-01-loaded.png'), fullPage: true });
    result('1', '页面加载', true);

    // ======== 1. CSS 规则检查 ========
    const artworkClasses = [
      'card-attack','card-defend','card-heal','card-wild',
      'card-atk-down','card-vulnerable','card-stun',
      'card-atk-buff','card-def-buff','card-junk'
    ];

    let allBgImage = true, allCover = true, allBlack = true;
    for (const cls of artworkClasses) {
      const info = await page.evaluate((cn) => {
        const sheets = document.styleSheets;
        for (const s of sheets) {
          try {
            for (const r of s.cssRules) {
              if (r.selectorText && r.selectorText.trim() === '.' + cn) {
                return { bgImage: r.style.backgroundImage, bgSize: r.style.backgroundSize, color: r.style.color };
              }
            }
          } catch (e) {}
        }
        return null;
      }, cls);

      if (!info || !info.bgImage || info.bgImage === 'none') { allBgImage = false; console.log('  X ' + cls + ' bgImage missing'); }
      if (!info || info.bgSize !== 'cover') { allCover = false; console.log('  X ' + cls + ' bgSize=' + (info ? info.bgSize : '?')); }
      if (!info || info.color !== 'rgb(0, 0, 0)') { allBlack = false; console.log('  X ' + cls + ' color=' + (info ? info.color : '?')); }
    }
    result('2', '10种卡牌CSS使用base64 background-image', allBgImage);
    result('3', '10种卡牌background-size:cover + color:#000', allCover && allBlack);

    // ======== 2. card-label 检查 ========
    const labelInfo = await page.evaluate(() => {
      const sheets = document.styleSheets;
      for (const s of sheets) {
        try {
          for (const r of s.cssRules) {
            if (r.selectorText && r.selectorText.includes('.card-label')) {
              return { bg: r.style.background, color: r.style.color, opacity: r.style.opacity };
            }
          }
        } catch (e) {}
      }
      return null;
    });
    const labelOk = labelInfo && labelInfo.bg.includes('255, 255, 255') && labelInfo.color === 'rgb(0, 0, 0)' && labelInfo.opacity === '1';
    result('4', 'card-label白底黑字opacity:1', labelOk, labelInfo ? JSON.stringify(labelInfo) : '未找到');

    // ======== 3. card-count 检查 ========
    const countInfo = await page.evaluate(() => {
      const sheets = document.styleSheets;
      for (const s of sheets) {
        try {
          for (const r of s.cssRules) {
            if (r.selectorText && r.selectorText.includes('.card-count')) {
              return { bg: r.style.background, color: r.style.color, opacity: r.style.opacity };
            }
          }
        } catch (e) {}
      }
      return null;
    });
    const countOk = countInfo && countInfo.bg.includes('255, 255, 255') && countInfo.color === 'rgb(0, 0, 0)' && countInfo.opacity === '1';
    result('5', 'card-count白底黑字opacity:1', countOk, countInfo ? JSON.stringify(countInfo) : '未找到');

    // ======== 4. 特殊卡保留 ========
    let specialOk = true;
    for (const cls of ['card-special-atk','card-special-def','card-divine','card-special']) {
      const info = await page.evaluate((cn) => {
        const sheets = document.styleSheets;
        for (const s of sheets) {
          try {
            for (const r of s.cssRules) {
              if (r.selectorText && r.selectorText.trim() === '.' + cn) {
                return { bg: r.style.background, bgImage: r.style.backgroundImage, color: r.style.color };
              }
            }
          } catch (e) {}
        }
        return null;
      }, cls);
      // 背景应为白色(#fff=rgb(255,255,255))，无 background-image（initial/none）
      if (!info) {
        if (cls !== 'card-divine') { specialOk = false; console.log('  X ' + cls + ' 未找到CSS规则'); }
      } else if (info.bgImage && info.bgImage !== 'none' && info.bgImage !== 'initial') {
        specialOk = false; console.log('  X ' + cls + ' 异常拥有background-image');
      } else if (info.bg !== 'rgb(255, 255, 255)' && info.bg !== '#fff' && info.bg !== 'white') {
        specialOk = false; console.log('  X ' + cls + ' 背景=' + info.bg);
      }
    }
    result('6', '特殊卡CSS保持原样(白底无背景图)', specialOk);

    // ======== 5. stack-count 未改动 ========
    const stackInfo = await page.evaluate(() => {
      const sheets = document.styleSheets;
      for (const s of sheets) {
        try {
          for (const r of s.cssRules) {
            if (r.selectorText && r.selectorText.includes('.stack-count')) {
              return { bg: r.style.background, color: r.style.color };
            }
          }
        } catch (e) {}
      }
      return null;
    });
    const stackOk = stackInfo && stackInfo.bg.includes('255, 255, 255') && stackInfo.color === 'rgb(17, 17, 17)';
    result('7', 'stack-count保持白底黑字(未改动)', stackOk, stackInfo ? JSON.stringify(stackInfo) : '?');

    // ======== 截图 ========
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'cards-02-final.png'), fullPage: false });

  } catch (err) {
    console.error('ERR: ' + err.message);
    result('ERR', '测试异常', false, err.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'cards-ERR.png'), fullPage: true });
  } finally {
    await browser.close();
  }

  // ======== 报告 ========
  let report = '# 卡牌美术替换 v1 — Playwright 验证\n\n';
  report += '| # | 测试 | 结果 | \n|---|---|---|\n';
  for (const r of results) {
    report += '| ' + r.id + ' | ' + r.desc + ' | ' + (r.passed ? 'PASS' : 'FAIL') + ' |\n';
  }
  report += '\n## 汇总\n';
  report += 'PASS: ' + passCount + ' / FAIL: ' + failCount + ' / 总计: ' + (passCount + failCount) + '\n';
  report += '\n## 截图\n- cards-01-loaded.png\n- cards-02-final.png\n';

  fs.writeFileSync(REPORT_PATH, report, 'utf-8');
  console.log('\n报告已写入: ' + REPORT_PATH);

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => { console.error('FATAL: ' + err.message); process.exit(1); });
