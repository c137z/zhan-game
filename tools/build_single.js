const fs = require('fs');
const dir = 'C:/Users/kyzha/.openclaw/projects/zhan';

// Read all source files
const dataJS = fs.readFileSync(dir + '/code/data.js', 'utf8');
const coreJS = fs.readFileSync(dir + '/code/core.js', 'utf8');
const uiJS = fs.readFileSync(dir + '/code/ui.js', 'utf8');
let html = fs.readFileSync(dir + '/code/index.html', 'utf8');

// Replace external script refs with inline
html = html.replace('<script src="data.js"></script>', '<script>\n' + dataJS + '\n</script>');
html = html.replace('<script src="core.js"></script>', '<script>\n' + coreJS + '\n</script>');
html = html.replace('<script src="ui.js"></script>', '<script>\n' + uiJS + '\n</script>');

// Write with UTF-8 BOM
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
const htmlBuf = Buffer.concat([bom, Buffer.from(html, 'utf8')]);
fs.writeFileSync(dir + '/zhan_latest.html', htmlBuf);
console.log('Single-file HTML written: zhan_latest.html (' + htmlBuf.length + ' bytes)');
console.log('DONE');
