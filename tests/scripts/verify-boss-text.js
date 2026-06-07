#!/usr/bin/env node
const playwright = require('playwright');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FIXTURE_PATH = path.resolve(__dirname, '..', 'fixtures', 'v3.0-baseline', 'index.html');
const REPORT_PATH = path.resolve(__dirname, '..', 'reports', 'verify-boss-text.md');
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');
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
  console.log('Boss UI文字对齐 Playwright 验证\n');

  const browser = await playwright.chromium.launch({ executablePath: CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844, deviceScaleFactor: 2 } });
  const page = await context.newPage();

  try {
    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(500);

    // 直接check源码中的字符串
    const uiContent = fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'v3.0-baseline', 'ui.js'), 'utf8');
    const coreContent = fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'v3.0-baseline', 'core.js'), 'utf8');

    // Check ui.js badges
    const hasBaoji = uiContent.includes('暴击×') && !uiContent.includes('攻×');
    result('1', 'ui.js badge 暴击×（不再有攻×）', hasBaoji);

    const hasJiyun = uiContent.includes('击晕 ') && !uiContent.includes('眩晕 ');
    result('2', 'ui.js badge 击晕（不再有眩晕）', hasJiyun);

    const hasPojia = uiContent.includes('破甲×') && !uiContent.includes('易伤×');
    result('3', 'ui.js badge 破甲×（不再有易伤×）', hasPojia);

    const hasXuruo = uiContent.includes('虚弱-') && !uiContent.includes('降攻-');
    result('4', 'ui.js badge 虚弱（不再有降攻）', hasXuruo);

    // Check core.js strings
    const coreGroom = coreContent.includes('破甲/虚弱/击晕');
    result('5', 'core.js 舔毛日志 破甲/虚弱/击晕', coreGroom);

    const coreEffectDesc = coreContent.includes('破甲×') && coreContent.includes('击晕 ') && coreContent.includes('虚弱-') && coreContent.includes('暴击×');
    result('6', 'core.js getEffectDescription 全部新名称', coreEffectDesc);

    const coreNoOld = !coreContent.includes('眩晕 ') && !coreContent.includes('降攻 ') && !coreContent.includes('易伤 ') && !coreContent.includes('攻击加成');
    result('7', 'core.js 无旧名称残留', coreNoOld);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'boss-text-verify.png'), fullPage: false });
    result('8', '截图完成', true);

  } catch (err) {
    console.error('ERR: ' + err.message);
    result('ERR', '异常', false, err.message);
  } finally {
    await browser.close();
  }

  let report = '# Boss UI文字对齐 — Playwright 验证\n\n';
  report += '| # | 测试 | 结果 |\n|---|---|---|\n';
  for (const r of results)
    report += '| ' + r.id + ' | ' + r.desc + ' | ' + (r.passed ? 'PASS' : 'FAIL') + ' |\n';
  report += '\n## 汇总\nPASS: ' + passCount + ' / FAIL: ' + failCount + '\n';

  fs.writeFileSync(REPORT_PATH, report, 'utf-8');
  console.log('\n报告: ' + REPORT_PATH);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => { console.error('FATAL: ' + err.message); process.exit(1); });
