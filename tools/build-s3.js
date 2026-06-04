// build-s3.js — Node.js script to generate sprint3 core.js + ui.js + single-file HTML
const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/kyzha/.openclaw/projects/zhan';
const codeDir = dir + '/code';

// Read source files
const dataJS = fs.readFileSync(codeDir + '/data.js', 'utf8');
const styleCSS = fs.readFileSync(codeDir + '/style.css', 'utf8');
const relicCSS = fs.readFileSync(codeDir + '/relic.css', 'utf8');
const indexHTML = fs.readFileSync(codeDir + '/index.html', 'utf8');

// Read backup
const coreBak = fs.readFileSync(codeDir + '/core.js.bak', 'utf8');
const uiBak = fs.readFileSync(codeDir + '/ui.js.bak', 'utf8');

// ========== BUILD CORE.JS ==========
const coreMarker = '// ========== 游戏状态 ==========';
const coreIdx = coreBak.indexOf(coreMarker);
const corePrefix = coreBak.substring(0, coreIdx);

// Build Engine suffix (the complete replacement)
const coreSuffix = fs.readFileSync(dir + '/tools/engine_suffix.js', 'utf8');
const newCore = corePrefix + coreSuffix;
fs.writeFileSync(codeDir + '/core.js', newCore, 'utf8');
console.log('core.js written:', newCore.length, 'bytes');

// ========== BUILD UI.JS ==========
// Read the new ui suffix
const uiSuffix = fs.readFileSync(dir + '/tools/ui_adapted.js', 'utf8');
fs.writeFileSync(codeDir + '/ui.js', uiSuffix, 'utf8');
console.log('ui.js written:', uiSuffix.length, 'bytes');

// ========== BUILD SINGLE HTML ==========
// Inline all JS and CSS into index.html
let html = indexHTML;

// Remove external script references, inline instead
html = html.replace('<script src="data.js"></script>', '<script>\n' + dataJS + '\n</script>');
html = html.replace('<script src="core.js"></script>', '<script>\n' + newCore + '\n</script>');
html = html.replace('<script src="ui.js"></script>', '<script>\n' + uiSuffix + '\n</script>');

// Remove external style references, inline instead
// style tag already inline, relic tag is separate
// But relic.css was loaded via a second <style> block — check if it's already inline
if (html.includes('relic.css')) {
  html = html.replace(/<link[^>]*relic\.css[^>]*>/i, '<style>\n' + relicCSS + '\n</style>');
}

// Write with UTF-8 BOM
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
const htmlBuf = Buffer.concat([bom, Buffer.from(html, 'utf8')]);
fs.writeFileSync(dir + '/zhan_v1.98_sprint3.html', htmlBuf);
console.log('zhan_v1.98_sprint3.html written:', htmlBuf.length, 'bytes');
console.log('DONE');
