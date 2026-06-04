const fs = require('fs');
const dir = 'C:/Users/kyzha/.openclaw/projects/zhan';

// Read all source files
const dataJS = fs.readFileSync(dir + '/code/data.js', 'utf8');
const coreJS = fs.readFileSync(dir + '/code/core.js', 'utf8');
const uiJS = fs.readFileSync(dir + '/code/ui.js', 'utf8');
const styleCSS = fs.readFileSync(dir + '/code/style.css', 'utf8');
const relicCSS = fs.readFileSync(dir + '/code/relic.css', 'utf8');
let html = fs.readFileSync(dir + '/code/index.html', 'utf8');

// Replace external script refs with inline
html = html.replace('<script src="data.js"></script>', '<script>\n' + dataJS + '\n</script>');
html = html.replace('<script src="core.js"></script>', '<script>\n' + coreJS + '\n</script>');
html = html.replace('<script src="ui.js"></script>', '<script>\n' + uiJS + '\n</script>');

// Update init script to use Engine
html = html.replace(
  "G.currentStage = 1;\r\nG.bossId = 'skeleton';\r\nG.isEndless = false;\r\nENDLESS_DEFEATED = {};\r\nnewGame();",
  "var st = Zhan.Engine.init();\r\nst.currentStage = 1;\r\nst.bossId = 'skeleton';\r\nst.isEndless = false;\r\nENDLESS_DEFEATED = {};\r\nif (Zhan.UI && Zhan.UI.render) Zhan.UI.render(st);"
);

// Write with UTF-8 BOM
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
const htmlBuf = Buffer.concat([bom, Buffer.from(html, 'utf8')]);
fs.writeFileSync(dir + '/zhan_v1.98_sprint3.html', htmlBuf);
console.log('Single-file HTML written:', htmlBuf.length, 'bytes');
console.log('DONE');
